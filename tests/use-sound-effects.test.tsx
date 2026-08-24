// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/context/PreferencesContext", () => ({
  usePreferences: () => ({ launcherMode: "standard" }),
}));

import { useSoundEffects } from "../src/hooks/useSoundEffects";

class FakeAudio {
  static played: FakeAudio[] = [];

  currentTime = 0;
  preload = "";
  src = "";
  volume = 1;
  paused = true;
  pause = vi.fn(() => {
    this.paused = true;
  });

  constructor(src = "") {
    this.src = src;
  }

  addEventListener() {}
  load() {}
  cloneNode() {
    return new FakeAudio(this.src);
  }
  play() {
    this.paused = false;
    FakeAudio.played.push(this);
    return Promise.resolve();
  }
}

afterEach(() => {
  FakeAudio.played = [];
  vi.restoreAllMocks();
});

describe("launcher sound effects", () => {
  it("permite efeitos simultaneos e silencia todos quando perde foco", () => {
    vi.stubGlobal("Audio", FakeAudio);
    vi.spyOn(document, "hasFocus").mockReturnValue(true);
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });
    const { result } = renderHook(() => useSoundEffects(0.5, "ps5", 0.4));

    act(() => result.current.playSound("select"));
    const first = FakeAudio.played[0];
    act(() => result.current.playSound("back"));
    const second = FakeAudio.played[1];

    expect(first.pause).not.toHaveBeenCalled();
    expect(second.volume).toBe(0.5);
    expect(second.src).toContain("PS5_Plus/deck_ui_out_of_game_detail.wav");

    act(() => window.dispatchEvent(new Event("blur")));
    expect(first.pause).toHaveBeenCalledOnce();
    expect(second.pause).toHaveBeenCalledOnce();
  });

  it.each([
    ["ps5", "PS5_Plus/deck_ui_out_of_game_detail.wav"],
    ["ps4", "PS4/deck_ui_out_of_game_detail.wav"],
    ["psp", "PSP%20Sounds/deck_ui_out_of_game_detail.wav"],
    ["ps2", "PS2%20System%20Sounds/deck_ui_out_of_game_detail.wav"],
    ["gamecube", "Nintendo%20GameCube%20Menu%20SFX/deck_ui_out_of_game_detail.wav"],
    ["cyberpunk", "Cyberpunk%202077%20UI%20SFX%20PACK/deck_ui_out_of_game_detail.wav"],
    ["xbox360", "Xbox%20One/deck_ui_out_of_game_detail.wav"],
  ] as const)("usa o retorno nativo do tema %s", (theme, expectedPath) => {
    vi.stubGlobal("Audio", FakeAudio);
    vi.spyOn(document, "hasFocus").mockReturnValue(true);
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });
    const { result, unmount } = renderHook(() => useSoundEffects(0.5, theme));

    act(() => result.current.playSound("modalClose"));

    expect(FakeAudio.played.at(-1)?.src).toContain(expectedPath);
    unmount();
  });

  it("nao toca sons da interface sem foco", () => {
    vi.stubGlobal("Audio", FakeAudio);
    vi.spyOn(document, "hasFocus").mockReturnValue(false);
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });
    const { result } = renderHook(() => useSoundEffects());

    act(() => result.current.playSound("select"));

    expect(FakeAudio.played).toHaveLength(0);
  });

  it.each([
    ["visible", false],
    ["hidden", true],
  ])("toca notificacoes com visibilityState=%s e hasFocus=%s", (visibilityState, hasFocus) => {
    vi.stubGlobal("Audio", FakeAudio);
    vi.spyOn(document, "hasFocus").mockReturnValue(hasFocus);
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: visibilityState,
    });
    const { result } = renderHook(() => useSoundEffects(0.5, "ps5", 0.4));

    act(() => result.current.playSound("friendRequest"));

    expect(FakeAudio.played).toHaveLength(1);
    expect(FakeAudio.played[0].volume).toBe(0.4);
  });

  it("nao interrompe uma notificacao quando a janela perde foco", () => {
    vi.stubGlobal("Audio", FakeAudio);
    vi.spyOn(document, "hasFocus").mockReturnValue(true);
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });
    const { result } = renderHook(() => useSoundEffects());

    act(() => result.current.playSound("friendRequest"));
    const notification = FakeAudio.played[0];
    act(() => window.dispatchEvent(new Event("blur")));

    expect(notification.pause).not.toHaveBeenCalled();
  });
});
