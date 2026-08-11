// @vitest-environment jsdom

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { readFileSync } from "node:fs";
import type { ComponentProps, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@react-three/fiber", async () => {
  const React = await import("react");

  return {
    Canvas: ({ children, onCreated }: {
      children?: ReactNode;
      onCreated?: (state: { gl: { domElement: HTMLCanvasElement } }) => void;
    }) => {
      const canvasRef = React.useRef<HTMLCanvasElement>(null);
      const onCreatedRef = React.useRef(onCreated);

      React.useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        onCreatedRef.current?.({ gl: { domElement: canvas } });
        return () => {
          canvas.dispatchEvent(new Event("webglcontextlost", { cancelable: true }));
        };
      }, []);

      return <>{onCreated ? children : null}<canvas ref={canvasRef} /></>;
    },
  };
});

vi.mock("@react-three/drei", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@react-three/drei")>();
  return {
    ...actual,
    OrthographicCamera: () => null,
    useProgress: () => ({ active: false, progress: 100, loaded: 0, total: 0 }),
  };
});

vi.mock("framer-motion", () => ({
  useReducedMotion: () => false,
  AnimatePresence: ({ children }: { children?: ReactNode }) => children,
  motion: {
    div: ({ children, ...props }: ComponentProps<"div">) => <div {...props}>{children}</div>,
    section: ({ children, ...props }: ComponentProps<"section">) => (
      <section {...props}>{children}</section>
    ),
  },
}));

vi.mock("../src/context/PreferencesContext", () => ({
  usePreferences: () => ({
    toggleLauncherMode: vi.fn(),
    effectsVolume: 70,
    soundTheme: "ps2",
    notificationVolume: 70,
  }),
}));

vi.mock("../src/auth/AuthProvider", () => ({
  useAuth: () => ({ user: { uid: "user-1" }, userProfile: { retroAchievementsUlid: "01TEST" } }),
}));

vi.mock("../src/hooks/useSoundEffects", () => ({
  useSoundEffects: () => ({ playSound: vi.fn() }),
}));

vi.mock("../src/context/GamepadContext", () => ({
  useGamepadButton: vi.fn(),
}));

vi.mock("../src/features/retro/components/RetroInterface", () => ({
  RetroInterface: () => null,
}));

vi.mock("../src/features/retro/crt/RetroCrtPass", () => ({
  RetroCrtPass: () => null,
}));

vi.mock("../src/features/retro/shelf/RetroShelf", () => ({
  RetroShelf: () => null,
}));

vi.mock("../src/features/retro/ps2/RetroPs2ConsoleDisplay", () => ({
  RetroPs2ConsoleDisplay: () => null,
}));

vi.mock("../src/features/retro/platform/RetroPlatformDisplay", () => ({
  RetroPlatformDisplay: ({ game, visible }: { game: { id: string }; visible: boolean }) => (
    <div
      data-testid="retro-platform-display"
      data-game={game.id}
      data-visible={String(visible)}
    />
  ),
}));

import RetroGamingPage from "../src/pages/RetroGamingPage";

describe("RetroGamingPage semantic interface", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it("lets the CRT insets define the centered viewport size", () => {
    render(<RetroGamingPage />);

    const viewport = screen.getByRole("main", { name: "Acervo de jogos retrô" });
    expect(viewport).toHaveClass("retro-tv-viewport");
    expect(viewport).not.toHaveClass("h-full", "w-full");
    expect(viewport).toHaveStyle({
      "--retro-tv-curve": "clamp(8px, 1.1vw, 20px)",
    });
  });

  it("moves circularly and announces the active game", () => {
    render(<RetroGamingPage />);

    fireEvent.click(screen.getByRole("button", { name: "Jogo anterior" }));
    act(() => vi.advanceTimersByTime(240));

    expect(screen.getByRole("status")).toHaveTextContent(
      "The Legend of Zelda: Tears of the Kingdom",
    );
  });

  it("uses the graphite gray background in both the page and CRT scene", () => {
    render(<RetroGamingPage />);
    const source = readFileSync("src/pages/RetroGamingPage.tsx", "utf8");

    expect(screen.getByRole("main", { name: "Acervo de jogos retrô" }))
      .toHaveClass("bg-[#303030]");
    expect(source).toContain('args={[view === "library" ? "#303030" : "#09090a"]}');
  });

  it("places the library inside an external CRT glass and bezel", () => {
    render(<RetroGamingPage />);

    expect(screen.getByTestId("retro-crt-screen")).toBeInTheDocument();
    expect(screen.getByTestId("retro-crt-glass")).toBeInTheDocument();
    expect(screen.getByTestId("retro-crt-bezel")).toBeInTheDocument();
  });

  it("returns through the supplied callback", () => {
    const onReturn = vi.fn();
    render(<RetroGamingPage onReturnToStandard={onReturn} />);

    fireEvent.click(screen.getByRole("button", { name: "Voltar ao launcher" }));

    expect(onReturn).toHaveBeenCalledTimes(1);
  });

  it("filters the semantic game list and resets selection", () => {
    render(<RetroGamingPage />);

    fireEvent.click(screen.getByRole("button", { name: "Filtrar anos 1990" }));
    act(() => vi.advanceTimersByTime(240));

    expect(screen.getByRole("status")).toHaveTextContent("Castlevania");
    expect(
      screen.queryByRole("button", { name: /God of War, 2005/ }),
    ).not.toBeInTheDocument();
  });

  it("opens details from the selected game without exposing the old details action", () => {
    render(<RetroGamingPage />);

    fireEvent.click(
      screen.getByRole("button", { name: "Abrir detalhes do jogo selecionado" }),
    );

    expect(screen.queryByRole("dialog", { name: "Detalhes de God of War" }))
      .not.toBeInTheDocument();
    act(() => vi.advanceTimersByTime(719));
    expect(screen.queryByRole("dialog", { name: "Detalhes de God of War" }))
      .not.toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1));

    expect(screen.getByRole("dialog", { name: "Detalhes de God of War" }))
      .toBeInTheDocument();
    expect(screen.queryByText("DETALHES")).not.toBeInTheDocument();
  });

  it("leaves Enter and Space available to native controls inside details", () => {
    render(<RetroGamingPage />);

    fireEvent.click(
      screen.getByRole("button", { name: "Abrir detalhes do jogo selecionado" }),
    );
    act(() => vi.advanceTimersByTime(720));

    const aboutTab = screen.getByRole("tab", { name: "SOBRE" });
    aboutTab.focus();
    let enterWasAllowed = false;
    act(() => {
      enterWasAllowed = aboutTab.dispatchEvent(new KeyboardEvent("keydown", {
        key: "Enter",
        bubbles: true,
        cancelable: true,
      }));
      if (enterWasAllowed) aboutTab.click();
    });
    expect(enterWasAllowed).toBe(true);
    expect(aboutTab).toHaveAttribute("aria-selected", "true");

    const achievementsTab = screen.getByRole("tab", { name: "CONQUISTAS" });
    achievementsTab.focus();
    let spaceWasAllowed = false;
    act(() => {
      spaceWasAllowed = achievementsTab.dispatchEvent(new KeyboardEvent("keydown", {
        key: " ",
        bubbles: true,
        cancelable: true,
      }));
      if (spaceWasAllowed) achievementsTab.click();
    });
    expect(spaceWasAllowed).toBe(true);
    expect(achievementsTab).toHaveAttribute("aria-selected", "true");
  });

  it("drives the platform display with the selected game in detail mode", () => {
    const caseSource = readFileSync("src/features/retro/shelf/RetroGameCase.tsx", "utf8");

    render(<RetroGamingPage />);

    fireEvent.click(
      screen.getByRole("button", { name: "Abrir detalhes do jogo selecionado" }),
    );
    act(() => vi.advanceTimersByTime(720));

    expect(screen.getByTestId("retro-platform-display")).toHaveAttribute("data-game", "gow");
    expect(screen.getByTestId("retro-platform-display")).toHaveAttribute("data-visible", "true");
    expect(caseSource).toContain("detailIdleMotion");
  });

  it("preloads the retro library behind a CRT boot screen when the mode opens", () => {
    render(<RetroGamingPage />);

    expect(screen.getByRole("region", { name: "Inicializando modo retrô" }))
      .toBeInTheDocument();

    act(() => vi.advanceTimersByTime(3500));
    act(() => vi.advanceTimersByTime(620));

    expect(screen.queryByRole("region", { name: "Inicializando modo retrô" }))
      .not.toBeInTheDocument();
    expect(screen.getByTestId("retro-crt-screen")).toBeInTheDocument();
  });

  it("returns from details before leaving the retro page", () => {
    const onReturn = vi.fn();
    render(<RetroGamingPage onReturnToStandard={onReturn} />);

    fireEvent.click(
      screen.getByRole("button", { name: "Abrir detalhes do jogo selecionado" }),
    );
    fireEvent.keyDown(window, { key: "Backspace" });

    expect(
      screen.getByRole("button", { name: "Abrir detalhes do jogo selecionado" }),
    ).toBeInTheDocument();
    expect(onReturn).not.toHaveBeenCalled();

    fireEvent.keyDown(window, { key: "Backspace" });
    expect(onReturn).toHaveBeenCalledTimes(1);
  });

  it("does not report an interrupted TV signal after leaving details", () => {
    render(<RetroGamingPage />);

    fireEvent.click(
      screen.getByRole("button", { name: "Abrir detalhes do jogo selecionado" }),
    );
    act(() => vi.advanceTimersByTime(720));
    fireEvent.click(screen.getByRole("button", { name: "Fechar detalhes" }));

    expect(screen.queryByText(/O sinal da TV foi interrompido/))
      .not.toBeInTheDocument();
  });

  it("removes a bundled game from the collection after modal confirmation", () => {
    render(<RetroGamingPage />);

    fireEvent.click(
      screen.getByRole("button", { name: "Abrir detalhes do jogo selecionado" }),
    );
    act(() => vi.advanceTimersByTime(720));
    fireEvent.click(screen.getByRole("button", { name: "CONFIGURAR JOGO" }));
    fireEvent.click(screen.getByRole("button", { name: "Excluir jogo" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar exclusão" }));

    expect(screen.queryByRole("button", { name: /God of War, 2005/ }))
      .not.toBeInTheDocument();
    expect(JSON.parse(
      localStorage.getItem("checkpoint_retro_hidden_game_ids") ?? "[]",
    )).toContain("gow");
  });
});
