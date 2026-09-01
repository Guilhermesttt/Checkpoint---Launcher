// tests/performance-budget.test.ts
// Phase 5.7 — Performance budget test.
//
// Goal: every trophy hot path must complete under 5 ms at p95 within a
// rolling 1-second window. We exercise the pure functions directly with
// a fixed clock; failures are recorded via `recordFail` so the metrics
// registry's `failures` counter increments as expected.
//
// This test does NOT measure I/O (no Supabase, no Resend). It's a
// micro-benchmark for the in-process trophy math, which is the surface
// the toast surface + level banner call multiple times per render.

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  getDefaultTrophyMetrics,
  __resetDefaultTrophyMetrics,
} from "../src/lib/trophyMetrics";
import {
  measureCalculatePlayerLevel,
  measureCalculatePlayerLevelFromGames,
  measureCalculateGameTrophyCounts,
  measureAggregateTrophyCounts,
  measureGetTrophyXp,
} from "../src/lib/trophyInstrumentation";
import { calculateGameTrophyCounts, type GameTrophyCounts } from "../src/utils/trophyTiers";

const P95_BUDGET_MS = 5;
const ITERATIONS = 200;

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

const seedRandomCounts = (seed: number): GameTrophyCounts => {
  // Mulberry32 PRNG so the test is deterministic across runs.
  let s = seed >>> 0;
  const rand = () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return makeCounts({
    platinum: Math.floor(rand() * 200),
    gold: Math.floor(rand() * 200),
    silver: Math.floor(rand() * 300),
    bronze: Math.floor(rand() * 500),
    iron: Math.floor(rand() * 50),
    total: 1000,
    completed: 750,
  });
};

beforeEach(() => {
  __resetDefaultTrophyMetrics();
});

afterEach(() => {
  __resetDefaultTrophyMetrics();
});

describe("trophy performance budget (p95 < 5ms)", () => {
  it("calculatePlayerLevel + calculateGameTrophyCounts + getTrophyXp stay under 5ms p95", () => {
    for (let i = 0; i < ITERATIONS; i++) {
      const counts = seedRandomCounts(i);
      measureCalculatePlayerLevel(0, counts.completed, 1, counts);
      measureCalculateGameTrophyCounts([
        { id: `a-${i}`, percent: 0.5 + (i % 50) / 100 },
        { id: `b-${i}`, percent: 0.1 + (i % 90) / 100 },
      ]);
      measureGetTrophyXp("bronze", 0.05);
      measureGetTrophyXp("gold", 0.01);
      measureGetTrophyXp("platinum");
    }
    const ops = [
      { name: "trophy.calculatePlayerLevel", expected: ITERATIONS },
      { name: "trophy.calculateGameTrophyCounts", expected: ITERATIONS },
      { name: "trophy.getTrophyXp", expected: ITERATIONS * 3 },
    ];
    for (const { name: op, expected } of ops) {
      const snap = getDefaultTrophyMetrics().snapshot(op);
      expect(snap.count).toBe(expected);
      expect(snap.p95).toBeLessThan(P95_BUDGET_MS);
    }
  });

  it("calculatePlayerLevelFromGames + aggregateTrophyCounts stay under 5ms p95", () => {
    const gameInputs: Array<{ totalAchievements: number; completedAchievements: number }> = [];
    for (let i = 0; i < 50; i++) {
      gameInputs.push({
        totalAchievements: 10 + (i % 30),
        completedAchievements: 5 + (i % 10),
      });
    }
    for (let i = 0; i < ITERATIONS; i++) {
      measureCalculatePlayerLevelFromGames(gameInputs);
      const perGame = gameInputs.map((g) =>
        calculateGameTrophyCounts(
          Array.from({ length: g.totalAchievements }, (_, j) => ({
            id: `t-${j}`,
            percent: ((j % 100) + 1) / 100,
          })),
        ),
      );
      measureAggregateTrophyCounts(perGame);
    }
    const ops = [
      "trophy.calculatePlayerLevelFromGames",
      "trophy.aggregateTrophyCounts",
    ];
    for (const op of ops) {
      const snap = getDefaultTrophyMetrics().snapshot(op);
      expect(snap.count).toBe(ITERATIONS);
      expect(snap.p95).toBeLessThan(P95_BUDGET_MS);
    }
  });
});
