// @vitest-environment jsdom

import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  addDoc: vi.fn(),
  updateDoc: vi.fn(),
  deleteField: vi.fn(() => "__delete__"),
  notify: vi.fn(),
  fetchSteamDetails: vi.fn(),
  fetchEpicDetails: vi.fn(),
  searchEpicGames: vi.fn(),
  fetch: vi.fn(),
}));

vi.mock("../src/services/localLibrary", () => ({
  createLibraryGame: mocks.addDoc,
  updateLibraryGame: mocks.updateDoc,
}));

vi.mock("../src/auth/AuthProvider", () => ({
  useAuth: () => ({ user: { uid: "user-1" } }),
}));

vi.mock("../src/context/PreferencesContext", () => ({
  usePreferences: () => ({ language: "pt-BR" }),
}));

vi.mock("../src/components/NotificationCenter", () => ({
  useNotification: () => ({ notify: mocks.notify }),
}));

vi.mock("../src/components/ui/ModalShell", () => ({
  default: ({
    isOpen,
    children,
    ariaLabel,
  }: {
    isOpen: boolean;
    children: React.ReactNode;
    ariaLabel: string;
  }) =>
    isOpen ? (
      <div role="dialog" aria-label={ariaLabel}>
        {children}
      </div>
    ) : null,
}));

vi.mock("../src/services/steam", () => ({
  fetchSteamAppDetailsResult: mocks.fetchSteamDetails,
}));

vi.mock("../src/services/epic", () => ({
  fetchEpicAppDetailsResult: mocks.fetchEpicDetails,
  searchEpicGames: mocks.searchEpicGames,
}));

vi.mock("../src/services/api", () => ({
  apiUrl: (path: string) => path,
}));

import AddGameModal from "../src/components/AddGameModal";

const renderModal = (props: Partial<React.ComponentProps<typeof AddGameModal>> = {}) => {
  const onClose = vi.fn();
  const onSaved = vi.fn();
  const playSound = vi.fn();

  render(
    <AddGameModal
      isOpen
      onClose={onClose}
      onSaved={onSaved}
      playSound={playSound}
      {...props}
    />,
  );

  return { onClose, onSaved, playSound };
};

describe("AddGameModal", () => {
  beforeEach(() => {
    mocks.addDoc.mockResolvedValue({ id: "game-new" });
    mocks.updateDoc.mockResolvedValue(undefined);
    mocks.searchEpicGames.mockResolvedValue({ items: [] });
    mocks.fetch.mockResolvedValue({ json: async () => ({ items: [] }) });
    vi.stubGlobal("fetch", mocks.fetch);
  });

  afterEach(() => {
    cleanup();
    Object.defineProperty(window, "electronAPI", {
      configurable: true,
      value: undefined,
    });
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("cria um jogo local apenas uma vez quando os campos obrigatórios estão prontos", async () => {
    const user = userEvent.setup();
    const { onClose, onSaved } = renderModal();

    expect(screen.getByRole("radio", { name: /^Local/i })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    const submit = screen.getByRole("button", { name: /Confirmar Adição/i });
    expect(submit).toBeDisabled();

    await user.type(screen.getByLabelText("Título"), "Control");
    await user.type(
      screen.getByLabelText("Capa"),
      "https://cdn.example.com/control-cover.jpg",
    );

    expect(submit).toBeEnabled();
    await user.click(submit);

    await waitFor(() => expect(mocks.addDoc).toHaveBeenCalledTimes(1));
    expect(mocks.addDoc).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({
        title: "Control",
        launcherType: "local",
        cardImage: "https://cdn.example.com/control-cover.jpg",
      }),
    );
    expect(onClose).toHaveBeenCalledWith(true);
    expect(onSaved).toHaveBeenCalledTimes(1);
  });

  it("salva o caminho absoluto retornado pelo seletor nativo de executavel", async () => {
    const selectExecutable = vi.fn().mockResolvedValue(
      "C:\\Games\\Control\\Control.exe",
    );
    Object.defineProperty(window, "electronAPI", {
      configurable: true,
      value: { selectExecutable },
    });
    const user = userEvent.setup();
    renderModal();

    await user.type(screen.getByLabelText("Título"), "Control");
    await user.click(screen.getByRole("button", { name: /Selecionar \.exe/i }));

    expect(selectExecutable).toHaveBeenCalledTimes(1);
    expect(screen.getByText("C:\\Games\\Control\\Control.exe")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Confirmar Adição/i }));
    await waitFor(() => expect(mocks.addDoc).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({
        launcherType: "local",
        executablePath: "C:\\Games\\Control\\Control.exe",
      }),
    ));
  });

  it("edita um jogo legado da Steam e usa a ação correta de salvar", async () => {
    const user = userEvent.setup();
    const { onClose } = renderModal({
      gameToEdit: {
        id: "game-7",
        title: "Hades",
        launcherType: "steam",
        steamAppId: "1145360",
        cardImage: "https://cdn.example.com/hades.jpg",
      },
    });

    const submit = screen.getByRole("button", { name: /Salvar alterações/i });
    expect(submit).toBeEnabled();
    await user.click(submit);

    await waitFor(() => expect(mocks.updateDoc).toHaveBeenCalledTimes(1));
    expect(mocks.updateDoc).toHaveBeenCalledWith(
      "user-1",
      "game-7",
      expect.objectContaining({
        title: "Hades",
        launcherType: "steam",
        steamAppId: "1145360",
        hasGame: true,
      }),
    );
    expect(onClose).toHaveBeenCalledWith(true);
  });

  it("cancela uma busca agendada ao trocar de plataforma", () => {
    vi.useFakeTimers();
    renderModal();

    fireEvent.click(screen.getByRole("radio", { name: /^Steam/i }));
    const search = screen.getByRole("combobox", { name: /Buscar na Steam/i });
    fireEvent.change(search, { target: { value: "Portal" } });
    expect(search).toHaveValue("Portal");

    fireEvent.click(screen.getByRole("radio", { name: /^Epic Games/i }));
    expect(screen.getByRole("combobox", { name: /Buscar na Epic/i })).toHaveValue("");

    vi.advanceTimersByTime(500);
    expect(mocks.fetch).not.toHaveBeenCalled();
    expect(mocks.searchEpicGames).not.toHaveBeenCalled();
  });
});
