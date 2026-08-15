// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TransitionOverlay } from "../src/components/TransitionOverlay";
import { useLauncherTransition } from "../src/hooks/useLauncherTransition";
import type { LauncherMode } from "../src/context/PreferencesContext";

function TransitionHarness({ requestedMode }: { requestedMode: LauncherMode }) {
  const transition = useLauncherTransition({
    requestedMode,
    enabled: true,
    collapseDuration: 600,
    blindDuration: 800,
  });

  return (
    <TransitionOverlay phase={transition.phase} bootProgress={37}>
      <output data-testid="mounted-mode">{transition.mountedMode}</output>
      <output data-testid="transition-phase">{transition.phase}</output>
      <button type="button" onClick={transition.completeBoot}>
        Completar boot
      </button>
    </TransitionOverlay>
  );
}

describe("launcher cinematic transition", () => {
  afterEach(() => {
    cleanup();
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it("swaps the mode only inside the static blind spot and waits for boot readiness", () => {
    vi.useFakeTimers();
    const { rerender } = render(<TransitionHarness requestedMode="standard" />);

    rerender(<TransitionHarness requestedMode="retro" />);

    expect(screen.getByTestId("mounted-mode")).toHaveTextContent("standard");
    expect(screen.getByTestId("transition-phase")).toHaveTextContent("collapse");
    expect(screen.getByTestId("launcher-mode-stage")).toHaveClass("is-crt-collapsing");

    act(() => vi.advanceTimersByTime(599));
    expect(screen.getByTestId("mounted-mode")).toHaveTextContent("standard");

    act(() => vi.advanceTimersByTime(1));
    expect(screen.getByTestId("mounted-mode")).toHaveTextContent("retro");
    expect(screen.getByTestId("transition-phase")).toHaveTextContent("blind");
    expect(screen.getByTestId("launcher-transition-overlay")).toHaveClass("is-blind");

    act(() => vi.advanceTimersByTime(800));
    expect(screen.getByTestId("transition-phase")).toHaveTextContent("boot");
    expect(screen.getByRole("progressbar", { name: "Inicializando modo retro" }))
      .toHaveAttribute("aria-valuenow", "37");

    act(() => vi.advanceTimersByTime(10_000));
    expect(screen.getByTestId("transition-phase")).toHaveTextContent("boot");

    fireEvent.click(screen.getByRole("button", { name: "Completar boot" }));
    expect(screen.getByTestId("transition-phase")).toHaveTextContent("idle");
  });

  it("reveals the standard mode after the blind spot without waiting for retro boot", () => {
    vi.useFakeTimers();
    const { rerender } = render(<TransitionHarness requestedMode="retro" />);

    fireEvent.click(screen.getByRole("button", { name: "Completar boot" }));
    rerender(<TransitionHarness requestedMode="standard" />);

    expect(screen.getByTestId("transition-phase")).toHaveTextContent("collapse");
    act(() => vi.advanceTimersByTime(600));
    expect(screen.getByTestId("mounted-mode")).toHaveTextContent("standard");
    expect(screen.getByTestId("transition-phase")).toHaveTextContent("blind");

    act(() => vi.advanceTimersByTime(800));
    expect(screen.getByTestId("transition-phase")).toHaveTextContent("idle");
  });

  it("cancels stale timers when the requested mode changes during collapse", () => {
    vi.useFakeTimers();
    const { rerender } = render(<TransitionHarness requestedMode="standard" />);

    rerender(<TransitionHarness requestedMode="retro" />);
    act(() => vi.advanceTimersByTime(240));
    rerender(<TransitionHarness requestedMode="standard" />);

    expect(screen.getByTestId("mounted-mode")).toHaveTextContent("standard");
    expect(screen.getByTestId("transition-phase")).toHaveTextContent("idle");

    act(() => vi.advanceTimersByTime(10_000));
    expect(screen.getByTestId("mounted-mode")).toHaveTextContent("standard");
    expect(screen.getByTestId("transition-phase")).toHaveTextContent("idle");
  });

  it("can leave retro while boot is still active", () => {
    vi.useFakeTimers();
    const { rerender } = render(<TransitionHarness requestedMode="retro" />);

    expect(screen.getByTestId("transition-phase")).toHaveTextContent("boot");
    rerender(<TransitionHarness requestedMode="standard" />);
    expect(screen.getByTestId("transition-phase")).toHaveTextContent("collapse");

    act(() => vi.advanceTimersByTime(600));
    expect(screen.getByTestId("mounted-mode")).toHaveTextContent("standard");
    expect(screen.getByTestId("transition-phase")).toHaveTextContent("blind");

    act(() => vi.advanceTimersByTime(800));
    expect(screen.getByTestId("transition-phase")).toHaveTextContent("idle");
  });

  it("clears timers when the transition owner unmounts during the blind spot", () => {
    vi.useFakeTimers();
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { rerender, unmount } = render(
      <TransitionHarness requestedMode="standard" />,
    );

    rerender(<TransitionHarness requestedMode="retro" />);
    act(() => vi.advanceTimersByTime(600));
    unmount();
    act(() => vi.advanceTimersByTime(10_000));

    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
