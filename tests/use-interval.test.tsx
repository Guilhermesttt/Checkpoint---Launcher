// @vitest-environment jsdom
import React from "react";
import { act, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useInterval } from "../src/hooks/useInterval";

const Harness: React.FC<{ callback: () => void; pauseWhenHidden: boolean }> = ({
  callback,
  pauseWhenHidden,
}) => {
  useInterval(callback, 1000, { pauseWhenHidden });
  return null;
};

afterEach(() => {
  vi.useRealTimers();
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    value: "visible",
  });
});

describe("polling em segundo plano", () => {
  it("continua executando quando a janela esta escondida e a pausa foi desativada", () => {
    vi.useFakeTimers();
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden",
    });
    const callback = vi.fn();
    render(<Harness callback={callback} pauseWhenHidden={false} />);

    act(() => vi.advanceTimersByTime(2100));

    expect(callback).toHaveBeenCalledTimes(2);
  });

  it("respeita a pausa por visibilidade quando solicitada", () => {
    vi.useFakeTimers();
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden",
    });
    const callback = vi.fn();
    render(<Harness callback={callback} pauseWhenHidden />);

    act(() => vi.advanceTimersByTime(2100));

    expect(callback).not.toHaveBeenCalled();
  });
});
