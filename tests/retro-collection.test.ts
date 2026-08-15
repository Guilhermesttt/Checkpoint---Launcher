import { describe, expect, it } from "vitest";

import {
  filterRetroGames,
  getCircularOffset,
  getSelectionAtFilterChange,
  getWrappedIndex,
  matchesRetroConsoleFilter,
  RETRO_COLLECTION,
} from "../src/features/retro/shelf/retroCollection";

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
  {
    id: "c",
    title: "C",
    subtitle: "",
    year: 1990,
    console: "SNES",
    publisher: "TEST",
    accent: "#ef4444",
  },
];

describe("retro collection behavior", () => {
  it("filters games by console family", () => {
    expect(filterRetroGames(games, "PS1").map((game) => game.id)).toEqual(["a"]);
    expect(filterRetroGames(games, "PS2").map((game) => game.id)).toEqual(["b"]);
    expect(filterRetroGames(games, "SNES").map((game) => game.id)).toEqual(["c"]);
  });

  it("returns an empty collection for a console without games", () => {
    expect(filterRetroGames(games, "GBA")).toEqual([]);
  });

  it("treats generic PlayStation as PS1 but not PS2", () => {
    expect(matchesRetroConsoleFilter("PlayStation", "PS1")).toBe(true);
    expect(matchesRetroConsoleFilter("PlayStation 2", "PS1")).toBe(false);
  });

  it("wraps previous and next selection at both boundaries", () => {
    expect(getWrappedIndex(0, -1, 2)).toBe(1);
    expect(getWrappedIndex(1, 1, 2)).toBe(0);
  });

  it("does not produce an invalid index for an empty collection", () => {
    expect(getWrappedIndex(0, 1, 0)).toBe(0);
  });

  it("resets filter selection to the first matching game", () => {
    expect(getSelectionAtFilterChange(games, "PS2")).toEqual({
      games: [games[1]],
      selectedIndex: 0,
    });
  });

  it("distributes a wrapped collection on both sides of the active game", () => {
    expect(Array.from({ length: 8 }, (_, index) => getCircularOffset(index, 0, 8))).toEqual([
      0,
      1,
      2,
      3,
      -4,
      -3,
      -2,
      -1,
    ]);
  });

  it("ships only verified RetroAchievements IDs for the built-in collection", () => {
    expect(Object.fromEntries(
      RETRO_COLLECTION.map((game) => [game.id, game.retroAchievementsGameId]),
    )).toEqual({
      gow: 2782,
      sotn: 11240,
      smw: 228,
      chrono: 319,
      "san-andreas": 2772,
      "tekken-3": 11259,
      "silent-hill-2": 1324,
      "zelda-totk": undefined,
    });
  });
});
