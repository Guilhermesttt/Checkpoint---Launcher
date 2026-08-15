/** @vitest-environment jsdom */
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { RetroGame } from "../src/features/retro/shelf/retroCollection";
import { RetroPlatformDisplay } from "../src/features/retro/platform/RetroPlatformDisplay";

vi.mock("../src/features/retro/platform/useRetroTvArtworkUrl", () => ({
  useRetroTvArtworkUrl: (
    game: RetroGame | undefined,
    layoutView: string = "jogos",
  ) => {
    if (layoutView === "jogos") return undefined;
    if (layoutView === "details") return "tgdb-screenshot.jpg";
    return game?.coverImage ?? game?.wrapImage;
  },
  useRetroGameArtworkUrl: (game: RetroGame | undefined) =>
    game?.coverImage ?? game?.wrapImage,
}));

vi.mock("../src/features/retro/platform/RetroDynamicPlatformTvScene", () => ({
  RetroDynamicPlatformTvScene: ({
    consoleName,
    artworkUrl,
  }: {
    consoleName?: string;
    artworkUrl?: string;
  }) => (
    <div
      data-testid="retro-dynamic-platform-scene"
      data-console={consoleName}
      data-artwork={artworkUrl}
    />
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
  it("uses PS2 boot video on the Jogos view without TGDB artwork", () => {
    render(<RetroPlatformDisplay game={game} visible reducedMotion={false} />);

    expect(screen.getByTestId("retro-dynamic-platform-scene")).not.toHaveAttribute(
      "data-artwork",
    );
    expect(screen.getByTestId("retro-dynamic-platform-scene")).toHaveAttribute(
      "data-console",
      "PS2",
    );
    expect(document.querySelector('[name="retro-tv-bloom-light"]')).toBeTruthy();
  });

  it("keeps non-PS2 consoles on standby artwork in Jogos view", () => {
    render(
      <RetroPlatformDisplay
        game={{ ...game, console: "NES" }}
        visible
        reducedMotion={false}
      />,
    );

    expect(screen.getByTestId("retro-dynamic-platform-scene")).not.toHaveAttribute(
      "data-artwork",
    );
  });

  it("uses TGDB artwork on the PS2 details view", () => {
    render(
      <RetroPlatformDisplay
        game={{ ...game, coverImage: undefined }}
        visible
        reducedMotion={false}
        layoutView="details"
      />,
    );

    expect(screen.getByTestId("retro-dynamic-platform-scene")).toHaveAttribute(
      "data-artwork",
      "tgdb-screenshot.jpg",
    );
  });

  it("renders the fallback mesh for unsupported consoles", () => {
    render(
      <RetroPlatformDisplay
        game={{ ...game, console: "SWITCH" }}
        visible
        reducedMotion={false}
      />,
    );

    expect(screen.queryByTestId("retro-dynamic-platform-scene")).not.toBeInTheDocument();
    expect(document.querySelector('[name="retro-tv-bloom-light"]')).toBeTruthy();
  });
});
