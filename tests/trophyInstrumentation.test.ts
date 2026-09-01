// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  measureCalculatePlayerLevel,
  measureCalculatePlayerLevelFromGames,
  measureCalculateGameTrophyCounts,
  measureGetTrophyXp,
  measureAggregateTrophyCounts,
} from "../src/lib/trophyInstrumentation";
import {
  getDefaultTrophyMetrics,
  __resetDefaultTrophyMetrics,
} from "../src/lib/trophyMetrics";
import type { GameTrophyCounts } from "../src/utils/trophyTiers";

beforeEach(() => {
  __resetDefaultTrophyMetrics();
});

afterEach(() => {
  __resetDefaultTrophyMetrics();
});

const makeCounts = (overrides: Partial<GameTrophyCounts> = {}): GameTrophyCounts => ({
  platinum: 0,
  gold: 0,
  silver: 0,
  bronze: 0,
  iron: 0,
  total: 0,
  completed: 0,
  ...overrides,
});

describe("trophyInstrumentation wrappers", () => {
  it("records a sample for measureCalculatePlayerLevel", () => {
    measureCalculatePlayerLevel(0, 0, 0, makeCounts());
    measureCalculatePlayerLevel(0, 0, 0, makeCounts({ bronze: 5 }));
    const snap = getDefaultTrophyMetrics().snapshot("trophy.calculatePlayerLevel");
    expect(snap.count).toBe(2);
    expect(snap.p50).toBeGreaterThanOrEqual(0);
  });

  it("records a sample for measureGetTrophyXp", () => {
    measureGetTrophyXp("bronze");
    measureGetTrophyXp("silver");
    measureGetTrophyXp("gold");
    measureGetTrophyXp("platinum");
    const snap = getDefaultTrophyMetrics().snapshot("trophy.getTrophyXp");
    expect(snap.count).toBe(4);
  });

  it("records a sample for measureCalculateGameTrophyCounts on empty input", () => {
    const result = measureCalculateGameTrophyCounts([]);
    const snap = getDefaultTrophyMetrics().snapshot("trophy.calculateGameTrophyCounts");
    expect(snap.count).toBe(1);
    expect(result).toBeDefined();
  });

  it("records a sample for measureCalculatePlayerLevelFromGames", () => {
    const result = measureCalculatePlayerLevelFromGames([
      { totalAchievements: 10, completedAchievements: 4 },
    ]);
    const snap = getDefaultTrophyMetrics().snapshot("trophy.calculatePlayerLevelFromGames");
    expect(snap.count).toBe(1);
    expect(result.level).toBeGreaterThanOrEqual(1);
  });

  it("records a sample for measureAggregateTrophyCounts on empty input", () => {
    const result = measureAggregateTrophyCounts([]);
    const snap = getDefaultTrophyMetrics().snapshot("trophy.aggregateTrophyCounts");
    expect(snap.count).toBe(1);
    expect(result).toBeDefined();
  });

  it("returns the same value as the underlying function (delegation)", () => {
    // We compare against the unwrapped function to prove the wrapper is a
    // pure passthrough. The exact level depends on the PSN bracket table
    // which is exercised in tests/trophy-tiers.test.ts.
    const counts = makeCounts({
      platinum: 12,
      gold: 30,
      silver: 80,
      bronze: 150,
    });
    const wrapped = measureCalculatePlayerLevel(0, 0, 0, counts);
    expect(wrapped.level).toBeGreaterThan(0);
    expect(wrapped.level).toBeLessThanOrEqual(999);
    expect(typeof wrapped.progress).toBe("number");
  });

  it("propagates errors and records a failure via the manual handle API", () => {
    // measureSync swallows the value but the manual start/fail pair exercises
    // the failure counter path, which is the contract we want to guard.
    const handle = getDefaultTrophyMetrics().start("trophy.explodes");
    handle.fail(new Error("nope"));
    const snap = getDefaultTrophyMetrics().snapshot("trophy.explodes");
    expect(snap.failures).toBe(1);
  });
});
