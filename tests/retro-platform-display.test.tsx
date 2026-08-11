/** @vitest-environment jsdom */
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { RetroGame } from "../src/features/retro/shelf/retroCollection";
import { RetroPlatformDisplay } from "../src/features/retro/platform/RetroPlatformDisplay";

vi.mock("../src/features/retro/platform/RetroPvmTelevision", () => ({
  RetroPvmTelevision: ({ artworkUrl }: { artworkUrl?: string }) => (
    <div data-testid="retro-pvm-television" data-artwork={artworkUrl} />
  ),
}));

vi.mock("../src/features/retro/platform/RetroPlatformHardware", () => ({
  RetroPlatformHardware: ({ consoleName }: { consoleName: string }) => (
    <div data-testid="retro-platform-hardware" data-console={consoleName} />
  ),
}));

const game: RetroGame = {
  id: "gow",
  title: "God of War",
  subtitle: "EDICAO CLASSICA PLAYSTATION 2",
  year: 2005,
  console: "PS2",
  publisher: "SONY COMPUTER ENTERTAINMENT",
  accent: "#b52322",
  coverImage: "cover.jpg",
  wrapImage: "wrap.jpg",
};

beforeEach(() => {
  const originalError = console.error;
  vi.spyOn(console, "error").mockImplementation((message, ...args) => {
    if (
      typeof message === "string"
      && message.includes("<pointLight /> is using incorrect casing")
    ) {
      return;
    }
    originalError(message, ...args);
  });
});

afterEach(() => {
  cleanup();
});

describe("RetroPlatformDisplay", () => {
  it("composes the shared television, selected platform hardware, and screen light", () => {
    render(<RetroPlatformDisplay game={game} visible reducedMotion={false} />);

    expect(screen.getByTestId("retro-pvm-television")).toHaveAttribute(
      "data-artwork",
      "cover.jpg",
    );
    expect(screen.getByTestId("retro-platform-hardware")).toHaveAttribute(
      "data-console",
      "PS2",
    );
    expect(screen.getByTestId("retro-tv-bloom-light")).toBeInTheDocument();
  });

  it("falls back to wrap artwork when the game has no front cover", () => {
    render(
      <RetroPlatformDisplay
        game={{ ...game, coverImage: undefined }}
        visible
        reducedMotion={false}
      />,
    );

    expect(screen.getByTestId("retro-pvm-television")).toHaveAttribute(
      "data-artwork",
      "wrap.jpg",
    );
  });

  it("keeps the television and omits incorrect hardware for unsupported consoles", () => {
    render(
      <RetroPlatformDisplay
        game={{ ...game, console: "SWITCH" }}
        visible
        reducedMotion={false}
      />,
    );

    expect(screen.getByTestId("retro-pvm-television")).toBeInTheDocument();
    expect(screen.queryByTestId("retro-platform-hardware")).not.toBeInTheDocument();
  });
});
