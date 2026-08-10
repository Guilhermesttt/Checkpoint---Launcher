// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@react-three/fiber", () => ({
  Canvas: () => null,
}));

vi.mock("framer-motion", () => ({
  useReducedMotion: () => false,
}));

vi.mock("../src/context/PreferencesContext", () => ({
  usePreferences: () => ({
    toggleLauncherMode: vi.fn(),
    effectsVolume: 70,
    soundTheme: "ps2",
    notificationVolume: 70,
  }),
}));

vi.mock("../src/hooks/useSoundEffects", () => ({
  useSoundEffects: () => ({ playSound: vi.fn() }),
}));

vi.mock("../src/context/GamepadContext", () => ({
  useGamepadButton: vi.fn(),
}));

import RetroGamingPage from "../src/pages/RetroGamingPage";

describe("RetroGamingPage semantic interface", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it("moves circularly and announces the active game", () => {
    render(<RetroGamingPage />);

    fireEvent.click(screen.getByRole("button", { name: "Jogo anterior" }));
    act(() => vi.advanceTimersByTime(240));

    expect(screen.getByRole("status")).toHaveTextContent(
      "The Legend of Zelda: Tears of the Kingdom",
    );
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
    expect(screen.queryByRole("button", { name: /God of War, 2005/ })).not.toBeInTheDocument();
  });
});
