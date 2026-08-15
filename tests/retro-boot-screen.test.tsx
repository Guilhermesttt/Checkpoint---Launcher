// @vitest-environment jsdom

import { act, cleanup, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";

const progressState = vi.hoisted(() => ({
  active: false,
  progress: 100,
  loaded: 4,
  total: 4,
}));

vi.mock("@react-three/drei", () => ({
  useProgress: () => progressState,
}));
vi.mock("@react-three/fiber", () => ({
  Canvas: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("../src/features/retro/boot/RetroBootScene", () => ({
  RetroBootScene: () => null,
}));
vi.mock("../src/features/retro/crt/RetroCrtPass", () => ({
  RetroCrtPass: () => null,
}));

import { RetroBootScreen } from "../src/features/retro/boot/RetroBootScreen";

describe("RetroBootScreen", () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    progressState.active = false;
    progressState.progress = 100;
    progressState.loaded = 4;
    progressState.total = 4;
  });

  it("keeps the CRT boot visible for a minimum time before revealing loaded assets", () => {
    vi.useFakeTimers();
    const onReady = vi.fn();
    const onRevealStart = vi.fn();

    render(
      <RetroBootScreen
        minimumDuration={900}
        exitDuration={300}
        onReady={onReady}
        onRevealStart={onRevealStart}
      />,
    );

    expect(screen.getByRole("region", { name: "Inicializando modo retrô" }))
      .toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "0");

    act(() => vi.advanceTimersByTime(250));
    const movingProgress = Number(screen.getByRole("progressbar").getAttribute("aria-valuenow"));
    expect(movingProgress).toBeGreaterThan(0);
    expect(movingProgress).toBeLessThan(100);

    act(() => vi.advanceTimersByTime(649));
    expect(onReady).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(1));
    expect(onRevealStart).toHaveBeenCalledTimes(1);
    expect(onReady).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(300));
    expect(onReady).toHaveBeenCalledTimes(1);
  });

  it("waits for active model and cover loading even after the minimum time", () => {
    vi.useFakeTimers();
    progressState.active = true;
    progressState.progress = 45;
    progressState.loaded = 2;
    progressState.total = 4;
    const onReady = vi.fn();

    const { rerender } = render(
      <RetroBootScreen minimumDuration={500} exitDuration={300} onReady={onReady} />,
    );

    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "0");

    act(() => vi.advanceTimersByTime(250));
    expect(Number(screen.getByRole("progressbar").getAttribute("aria-valuenow")))
      .toBeGreaterThan(0);

    act(() => vi.advanceTimersByTime(250));
    expect(onReady).not.toHaveBeenCalled();

    progressState.active = false;
    progressState.progress = 100;
    progressState.loaded = 4;
    rerender(<RetroBootScreen minimumDuration={500} exitDuration={300} onReady={onReady} />);

    expect(onReady).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(50));
    act(() => vi.advanceTimersByTime(300));
    expect(onReady).toHaveBeenCalledTimes(1);
  });

  it("reports the real Three.js loading progress to the global transition", () => {
    vi.useFakeTimers();
    progressState.active = true;
    progressState.progress = 64;
    progressState.loaded = 3;
    progressState.total = 5;
    const onProgressChange = vi.fn();

    render(
      <RetroBootScreen
        minimumDuration={900}
        onReady={vi.fn()}
        onProgressChange={onProgressChange}
      />,
    );

    expect(onProgressChange).toHaveBeenLastCalledWith(64);
    act(() => vi.advanceTimersByTime(250));
    expect(onProgressChange).toHaveBeenLastCalledWith(64);
    expect(screen.getByRole("progressbar")).not.toHaveAttribute(
      "aria-valuenow",
      "64",
    );
  });

  it("waits for the first prerendered library frame after assets reach 100%", () => {
    vi.useFakeTimers();
    const onReady = vi.fn();
    const onAssetsReady = vi.fn();
    const { rerender } = render(
      <RetroBootScreen
        minimumDuration={500}
        exitDuration={300}
        sceneReady={false}
        onAssetsReady={onAssetsReady}
        onReady={onReady}
      />,
    );

    act(() => vi.advanceTimersByTime(500));
    expect(onAssetsReady).toHaveBeenCalledTimes(1);
    act(() => vi.advanceTimersByTime(300));
    expect(onReady).not.toHaveBeenCalled();

    rerender(
      <RetroBootScreen
        minimumDuration={500}
        exitDuration={300}
        sceneReady
        onAssetsReady={onAssetsReady}
        onReady={onReady}
      />,
    );
    act(() => vi.advanceTimersByTime(50));
    act(() => vi.advanceTimersByTime(300));

    expect(onReady).toHaveBeenCalledTimes(1);
  });

  it("uses the supplied CRT splash design tokens and local STIX font", () => {
    const css = readFileSync("src/index.css", "utf8");
    const entry = readFileSync("src/main.tsx", "utf8");

    expect(css).toContain("--retro-boot-surface: #3d3d9e");
    expect(css).toContain("font-family: 'STIX Two Text'");
    expect(entry).toContain('@fontsource/stix-two-text/400.css');
    expect(entry).toContain('@fontsource/stix-two-text/700.css');
  });

  it("renders the splash through the same WebGL CRT shader used by the library", () => {
    const source = readFileSync("src/features/retro/boot/RetroBootScreen.tsx", "utf8");

    expect(source).toContain("<Canvas");
    expect(source).toContain("<RetroCrtPass");
    expect(source).toContain("is-exiting");
    expect(source).toContain("onRevealStart");
  });
});
