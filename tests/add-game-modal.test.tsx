// @vitest-environment jsdom

import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  addDoc: vi.fn(),
  updateDoc: vi.fn(),
  deleteField: vi.fn(() => "__delete__"),
  notify: vi.fn(),
  fetchSteamDetails: vi.fn(),
  fetchSteamAchievementSchema: vi.fn(),
  fetchEpicDetails: vi.fn(),
  fetchEpicAchievements: vi.fn(),
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
  fetchSteamAchievementSchema: mocks.fetchSteamAchievementSchema,
}));

vi.mock("../src/services/epic", () => ({
  fetchEpicAppDetailsResult: mocks.fetchEpicDetails,
  searchEpicGames: mocks.searchEpicGames,
  fetchEpicAchievements: mocks.fetchEpicAchievements,
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
    mocks.addDoc.mockReset();
    mocks.updateDoc.mockReset();
    mocks.notify.mockReset();
    mocks.fetchSteamDetails.mockReset();
    mocks.fetchSteamAchievementSchema.mockReset();
    mocks.fetchEpicDetails.mockReset();
    mocks.fetchEpicAchievements.mockReset();
    mocks.searchEpicGames.mockReset();
    mocks.fetch.mockReset();
    mocks.addDoc.mockResolvedValue({ id: "game-new" });
    mocks.updateDoc.mockResolvedValue(undefined);
    mocks.searchEpicGames.mockResolvedValue({ items: [] });
    mocks.fetchSteamAchievementSchema.mockResolvedValue({
      achievements: [],
      total: 0,
      unlocked: 0,
    });
    mocks.fetchEpicAchievements.mockResolvedValue({ total: 0, completed: 0, list: [] });
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
  }, 15000);

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

  it("preserva as conquistas ao editar um jogo da Epic", async () => {
    const user = userEvent.setup();
    renderModal({
      gameToEdit: {
        id: "epic-7",
        title: "Alan Wake 2",
        launcherType: "epic",
        epicCatalogId: "catalog-7",
        cardImage: "https://cdn.example.com/alan-wake-2.jpg",
        totalAchievements: 66,
        completedAchievements: 21,
      },
    });

    await user.click(screen.getByRole("button", { name: /Salvar alterações/i }));

    await waitFor(() => expect(mocks.updateDoc).toHaveBeenCalledWith(
      "user-1",
      "epic-7",
      expect.objectContaining({
        totalAchievements: 66,
        completedAchievements: 21,
      }),
    ));
  });

  it("zera conquistas antigas ao selecionar outro jogo Epic sem conquistas", async () => {
    mocks.searchEpicGames.mockResolvedValue({
      items: [{
        id: "new-catalog",
        catalogId: "new-catalog",
        namespace: "new-namespace",
        productSlug: "new-game",
        name: "New Epic Game",
      }],
    });
    mocks.fetchEpicDetails.mockResolvedValue({
      ok: true,
      data: {
        catalogId: "new-catalog",
        namespace: "new-namespace",
        appName: "new-app",
        title: "New Epic Game",
      },
    });
    mocks.fetchEpicAchievements.mockResolvedValue({ total: 0, completed: 0, list: [] });
    const user = userEvent.setup();
    renderModal({
      gameToEdit: {
        id: "epic-old",
        title: "Old Epic Game",
        launcherType: "epic",
        epicCatalogId: "old-catalog",
        totalAchievements: 50,
        completedAchievements: 20,
      },
    });

    const search = screen.getByRole("combobox", { name: /Buscar na Epic/i });
    await user.type(search, "New Epic");
    await user.click(await screen.findByRole("option", { name: /New Epic Game/i }));
    await waitFor(() => expect(screen.getByLabelText("Título")).toHaveValue("New Epic Game"));
    await user.click(screen.getByRole("button", { name: /Confirmar que possuo/i }));
    await user.click(screen.getByRole("button", { name: /Salvar alterações/i }));

    await waitFor(() => expect(mocks.updateDoc).toHaveBeenCalledWith(
      "user-1",
      "epic-old",
      expect.objectContaining({
        epicCatalogId: "new-catalog",
        totalAchievements: 0,
        completedAchievements: 0,
      }),
    ));
  });

  it("ignora conquistas Steam atrasadas depois de trocar de plataforma", async () => {
    let resolveSchema!: (value: {
      achievements: unknown[];
      total: number;
      unlocked: number;
    }) => void;
    mocks.fetchSteamAchievementSchema.mockReturnValue(new Promise((resolve) => {
      resolveSchema = resolve;
    }));
    mocks.fetchSteamDetails.mockResolvedValue({
      ok: true,
      data: { title: "Portal 2", cardImage: "https://cdn.example.com/portal.jpg" },
    });
    mocks.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ items: [{ id: "620", name: "Portal 2" }] }),
    });
    const user = userEvent.setup();
    renderModal();

    await user.click(screen.getByRole("radio", { name: /^Steam/i }));
    await user.type(screen.getByRole("combobox", { name: /Buscar na Steam/i }), "Portal");
    await user.click(await screen.findByRole("option", { name: /Portal 2/i }));
    await waitFor(() => expect(mocks.fetchSteamAchievementSchema).toHaveBeenCalledTimes(1));
    await user.click(screen.getByRole("radio", { name: /^Epic Games/i }));

    await act(async () => {
      resolveSchema({ achievements: [], total: 0, unlocked: 0 });
    });

    expect(screen.getByLabelText("Título")).toHaveValue("");
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
