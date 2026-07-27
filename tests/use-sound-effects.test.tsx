// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
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

    act(() => window.dispatchEvent(new Event("blur")));
    expect(first.pause).toHaveBeenCalledOnce();
    expect(second.pause).toHaveBeenCalledOnce();
  });

  it("nao toca sons da interface sem foco", () => {
    vi.stubGlobal("Audio", FakeAudio);
    vi.spyOn(document, "hasFocus").mockReturnValue(false);
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });
    const { result } = renderHook(() => useSoundEffects());

    act(() => result.current.playSound("friendRequest"));

    expect(FakeAudio.played).toHaveLength(0);
  });
});
