// @vitest-environment jsdom
import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import SpotifyRotatingMessage from "../src/components/spotify/SpotifyRotatingMessage";

afterEach(() => {
  vi.useRealTimers();
  Reflect.deleteProperty(window, "electronAPI");
});

describe("mensagens editoriais do Spotify", () => {
  it("alterna as chamadas e abre o repositorio pela mensagem do GitHub", () => {
    vi.useFakeTimers();
    const openExternalUrl = vi.fn();
    Object.defineProperty(window, "electronAPI", {
      configurable: true,
      value: { openExternalUrl },
    });
    render(<SpotifyRotatingMessage intervalMs={1_000} />);

    fireEvent.click(screen.getByRole("button", { name: /estrela no github/i }));
    expect(openExternalUrl).toHaveBeenCalledWith(
      "https://github.com/Guilhermesttt/Checkpoint---Launcher",
    );

    act(() => vi.advanceTimersByTime(1_000));
    expect(screen.getByText(/crie sua própria vibe/i)).toBeInTheDocument();
  });
});
