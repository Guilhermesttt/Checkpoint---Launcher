// @vitest-environment jsdom
import { describe, expect, it, afterEach } from "vitest";
import React from "react";
import { render, screen, cleanup } from "@testing-library/react";
import { PlatformLibrarySkeleton } from "../src/components/PlatformLibrarySkeleton";

describe("PlatformLibrarySkeleton", () => {
  afterEach(() => {
    cleanup();
  });
  it("renders status badge and 6 skeleton shells in initial mode", () => {
    render(
      <PlatformLibrarySkeleton
        platform="epic"
        mode="initial"
        phase="reading-library"
        existingGames={[]}
      />,
    );

    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-busy", "true");
    expect(screen.getByText(/sincronizando epic games: lendo biblioteca/i)).toBeDefined();
    expect(screen.getAllByTestId("platform-game-skeleton")).toHaveLength(6);
  });

  it("renders existing games and 3 skeleton shells in refresh mode", () => {
    const existingGames: any[] = [
      { id: "g1", title: "Game 1", cardImage: "https://img.com/1.jpg" },
      { id: "g2", title: "Game 2", cardImage: "https://img.com/2.jpg" },
    ];

    render(
      <PlatformLibrarySkeleton
        platform="steam"
        mode="refresh"
        phase="enriching-games"
        existingGames={existingGames}
        completed={2}
        total={5}
      />,
    );

    expect(screen.getByText(/sincronizando steam: obtendo detalhes dos jogos... \(2\/5\)/i)).toBeDefined();
    expect(screen.getByText("Game 1")).toBeDefined();
    expect(screen.getByText("Game 2")).toBeDefined();
    expect(screen.getAllByTestId("platform-game-skeleton")).toHaveLength(3);
  });
});
