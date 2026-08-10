import { describe, expect, it } from "vitest";

import {
  filterRetroGames,
  getSelectionAtFilterChange,
  getWrappedIndex,
} from "../src/features/retro/retroCollection";

const games = [
  {
    id: "a",
    title: "A",
    subtitle: "",
    year: 1998,
    console: "PS1",
    publisher: "TEST",
    accent: "#ef4444",
  },
  {
    id: "b",
    title: "B",
    subtitle: "",
    year: 2005,
    console: "PS2",
    publisher: "TEST",
    accent: "#ef4444",
  },
];

describe("retro collection behavior", () => {
  it("filters a decade using an inclusive start and exclusive end", () => {
    expect(filterRetroGames(games, "1990s").map((game) => game.id)).toEqual(["a"]);
  });

  it("returns an empty collection for a decade without games", () => {
    expect(filterRetroGames(games, "1980s")).toEqual([]);
  });

  it("wraps previous and next selection at both boundaries", () => {
    expect(getWrappedIndex(0, -1, 2)).toBe(1);
    expect(getWrappedIndex(1, 1, 2)).toBe(0);
  });

  it("does not produce an invalid index for an empty collection", () => {
    expect(getWrappedIndex(0, 1, 0)).toBe(0);
  });

  it("resets filter selection to the first matching game", () => {
    expect(getSelectionAtFilterChange(games, "2000s")).toEqual({
      games: [games[1]],
      selectedIndex: 0,
    });
  });
});
