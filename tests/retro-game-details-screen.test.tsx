// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ComponentProps, ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { launchGame, useGamepadButton } = vi.hoisted(() => ({
  launchGame: vi.fn().mockResolvedValue(undefined),
  useGamepadButton: vi.fn(),
}));

vi.mock("../src/services/launcher", () => ({ launchGame }));
vi.mock("../src/context/PreferencesContext", () => ({
  usePreferences: () => ({ closeOnLaunch: true }),
}));
vi.mock("../src/auth/AuthProvider", () => ({
  useAuth: () => ({ userProfile: { retroAchievementsUlid: "01TEST" } }),
}));
vi.mock("../src/context/GamepadContext", () => ({
  useGamepadButton,
}));
vi.mock("@react-three/fiber", () => ({
  Canvas: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="retro-detail-canvas">{children}</div>
  ),
}));
vi.mock("framer-motion", () => ({
  AnimatePresence: ({ children }: { children: ReactNode }) => children,
  motion: {
    div: ({ children, ...props }: ComponentProps<"div">) => <div {...props}>{children}</div>,
    section: ({ children, ...props }: ComponentProps<"section">) => (
      <section {...props}>{children}</section>
    ),
  },
  useReducedMotion: () => false,
}));

import { RetroGameDetailsScreen } from "../src/features/retro/components/RetroGameDetailsScreen";

const game = {
  id: "gow",
  title: "God of War",
  subtitle: "EDIÇÃO CLÁSSICA",
  year: 2005,
  console: "PS2",
  publisher: "SONY COMPUTER ENTERTAINMENT",
  accent: "#b52322",
  coverImage: "god-of-war.jpg",
  executablePath: "C:\\Games\\God of War\\gow.exe",
  retroAchievementsGameId: 2782,
};

describe("RetroGameDetailsScreen", () => {
  afterEach(() => {
    cleanup();
    launchGame.mockClear();
    useGamepadButton.mockClear();
  });

  it("exposes only the three approved tabs and launches only from its play action", async () => {
    render(
      <RetroGameDetailsScreen
        game={game}
        isOpen
        onClose={vi.fn()}
        onEditGame={vi.fn()}
        playSound={vi.fn()}
      />,
    );

    expect(screen.getByRole("dialog", { name: "Detalhes de God of War" }))
      .toBeInTheDocument();
    expect(screen.getAllByRole("tab").map((tab) => tab.textContent)).toEqual([
      "JOGAR",
      "SOBRE",
      "CONQUISTAS",
    ]);
    expect(launchGame).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Jogar God of War" }));

    await waitFor(() => expect(launchGame).toHaveBeenCalledWith({
      id: "gow",
      title: "God of War",
      image: "god-of-war.jpg",
      publisher: "SONY COMPUTER ENTERTAINMENT",
      executablePath: "C:\\Games\\God of War\\gow.exe",
      launcherType: "local",
      source: "manual",
    }, { hideLauncher: true }));
  });

  it("closes without launching the game", () => {
    const onClose = vi.fn();
    render(
      <RetroGameDetailsScreen
        game={game}
        isOpen
        onClose={onClose}
        onEditGame={vi.fn()}
        playSound={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Fechar detalhes" }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(launchGame).not.toHaveBeenCalled();
  });

  it("uses an editorial overlay and keeps the selected shelf case as the visual", () => {
    render(
      <RetroGameDetailsScreen
        game={game}
        isOpen
        onClose={vi.fn()}
        onEditGame={vi.fn()}
        playSound={vi.fn()}
      />,
    );

    expect(screen.queryByTestId("retro-detail-canvas")).not.toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "Detalhes de God of War" }))
      .toHaveClass("retro-detail-editorial");
    expect(screen.getByTestId("retro-detail-backlight")).toBeInTheDocument();
  });

  it("positions the details overlay inside the centered CRT viewport", () => {
    render(
      <RetroGameDetailsScreen
        game={game}
        isOpen
        onClose={vi.fn()}
        onEditGame={vi.fn()}
        playSound={vi.fn()}
      />,
    );

    const dialog = screen.getByRole("dialog", { name: "Detalhes de God of War" });
    expect(dialog).toHaveClass("absolute", "inset-0");
    expect(dialog).not.toHaveClass("fixed");
  });

  it("keeps the PS2 menu and scrollable content in the narrow left column", () => {
    render(
      <RetroGameDetailsScreen
        game={game}
        isOpen
        onClose={vi.fn()}
        onEditGame={vi.fn()}
        playSound={vi.fn()}
      />,
    );

    const dialog = screen.getByRole("dialog", { name: "Detalhes de God of War" });
    const tablist = screen.getByRole("tablist", { name: "Informações de God of War" });

    expect(dialog.querySelector("section")).toHaveClass(
      "w-[clamp(280px,34vw,460px)]",
      "inset-y-4",
      "left-4",
      "xl:inset-y-6",
      "xl:left-6",
      "2xl:inset-y-8",
      "2xl:left-8",
    );
    expect(tablist).toHaveAttribute("aria-orientation", "vertical");
    expect(tablist).toHaveClass("flex-col");
    expect(screen.getByRole("tabpanel")).toHaveClass("min-h-0", "flex-1", "overflow-y-auto");
  });

  it("switches tabs with keyboard and gamepad and closes through O", () => {
    const onClose = vi.fn();
    const playSound = vi.fn();
    render(
      <RetroGameDetailsScreen game={game} isOpen onClose={onClose} onEditGame={vi.fn()} playSound={playSound} />,
    );

    fireEvent.keyDown(window, { key: "ArrowDown" });
    expect(screen.getByRole("tab", { name: "SOBRE" })).toHaveAttribute("aria-selected", "true");

    fireEvent.keyDown(window, { key: "ArrowUp" });
    expect(screen.getByRole("tab", { name: "JOGAR" })).toHaveAttribute("aria-selected", "true");

    const dpadDown = useGamepadButton.mock.calls.find(([button]) => button === "DPAD_DOWN");
    const r1 = useGamepadButton.mock.calls.find(([button]) => button === "R1");
    const o = useGamepadButton.mock.calls.find(([button]) => button === "O");
    expect(dpadDown?.[2]).toBe(true);
    act(() => dpadDown?.[1]());
    expect(screen.getByRole("tab", { name: "SOBRE" })).toHaveAttribute("aria-selected", "true");
    expect(r1?.[2]).toBe(true);
    expect(r1?.[3]).toBeGreaterThan(60);
    act(() => r1?.[1]());
    expect(screen.getByRole("tab", { name: "CONQUISTAS" })).toHaveAttribute("aria-selected", "true");
    act(() => o?.[1]());
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(playSound).toHaveBeenCalledWith("back");
  });

  it("keeps horizontal arrows as tab-focused compatibility navigation", () => {
    render(
      <RetroGameDetailsScreen
        game={game}
        isOpen
        onClose={vi.fn()}
        onEditGame={vi.fn()}
        playSound={vi.fn()}
      />,
    );

    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(screen.getByRole("tab", { name: "JOGAR" })).toHaveAttribute("aria-selected", "true");

    const playTab = screen.getByRole("tab", { name: "JOGAR" });
    playTab.focus();
    fireEvent.keyDown(playTab, { key: "ArrowRight" });
    expect(screen.getByRole("tab", { name: "SOBRE" })).toHaveAttribute("aria-selected", "true");
  });

  it("traps Tab focus without including inactive vertical menu items", () => {
    render(
      <RetroGameDetailsScreen
        game={game}
        isOpen
        onClose={vi.fn()}
        onEditGame={vi.fn()}
        playSound={vi.fn()}
      />,
    );

    const aboutTab = screen.getByRole("tab", { name: "SOBRE" });
    fireEvent.click(aboutTab);
    aboutTab.focus();

    fireEvent.keyDown(window, { key: "Tab", shiftKey: true });
    expect(screen.getByRole("button", { name: "Fechar detalhes" })).toHaveFocus();

    screen.getByRole("button", { name: "Fechar detalhes" }).focus();
    fireEvent.keyDown(window, { key: "Tab" });
    expect(aboutTab).toHaveFocus();
  });

  it("preserves configuration and focus restoration for games without an executable", async () => {
    const onEditGame = vi.fn();
    const focusTarget = document.createElement("button");
    document.body.appendChild(focusTarget);
    focusTarget.focus();
    const restoreFocusRef = { current: focusTarget };
    const gameWithoutExecutable = { ...game, executablePath: undefined };

    const { rerender } = render(
      <RetroGameDetailsScreen
        game={gameWithoutExecutable}
        isOpen
        onClose={vi.fn()}
        onEditGame={onEditGame}
        playSound={vi.fn()}
        restoreFocusRef={restoreFocusRef}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "CONFIGURAR JOGO" }));
    expect(onEditGame).toHaveBeenCalledWith(gameWithoutExecutable);

    onEditGame.mockClear();
    const configureButton = screen.getByRole("button", { name: "CONFIGURAR JOGO" });
    configureButton.focus();
    const x = useGamepadButton.mock.calls.find(([button]) => button === "X");
    act(() => x?.[1]());
    expect(onEditGame).toHaveBeenCalledWith(gameWithoutExecutable);

    rerender(
      <RetroGameDetailsScreen
        game={gameWithoutExecutable}
        isOpen={false}
        onClose={vi.fn()}
        onEditGame={onEditGame}
        playSound={vi.fn()}
        restoreFocusRef={restoreFocusRef}
      />,
    );

    await waitFor(() => expect(focusTarget).toHaveFocus());
    focusTarget.remove();
  });
});
