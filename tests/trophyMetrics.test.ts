// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  RollingPercentiles,
  createTrophyMetrics,
  type TrophyMetricsSnapshot,
} from "../src/lib/trophyMetrics";

describe("RollingPercentiles", () => {
  it("returns zeros for an empty window", () => {
    const r = new RollingPercentiles({ windowMs: 1000 });
    const summary = r.summary();
    expect(summary.count).toBe(0);
    expect(summary.p50).toBe(0);
    expect(summary.p95).toBe(0);
    expect(summary.p99).toBe(0);
    expect(summary.min).toBe(0);
    expect(summary.max).toBe(0);
  });

  it("computes accurate percentiles on a known distribution", () => {
    // 1..100 inclusive => p50=50, p95=95, p99=99, min=1, max=100
    const fixedNow = 1_000_000;
    const r = new RollingPercentiles({ windowMs: 60_000, now: () => fixedNow });
    for (let i = 1; i <= 100; i += 1) r.record(i, fixedNow);
    const s = r.summary();
    expect(s.count).toBe(100);
    expect(s.min).toBe(1);
    expect(s.max).toBe(100);
    expect(s.p50).toBe(50);
    expect(s.p95).toBe(95);
    expect(s.p99).toBe(99);
  });

  it("drains samples older than the window", () => {
    let now = 1_000;
    const r = new RollingPercentiles({ windowMs: 1000, now: () => now });
    r.record(10, now);
    r.record(20, now + 500);
    r.record(100, now + 1500); // outside window for the first sample
    now = 1_500;
    const s1 = r.summary();
    expect(s1.count).toBe(3);
    now = 3_000;
    const s2 = r.summary();
    expect(s2.count).toBe(1);
    expect(s2.p50).toBe(100);
  });

  it("is robust to a single sample", () => {
    const fixedNow = 1_000_000;
    const r = new RollingPercentiles({ windowMs: 1000, now: () => fixedNow });
    r.record(42, fixedNow);
    const s = r.summary();
    expect(s.count).toBe(1);
    expect(s.p50).toBe(42);
    expect(s.p95).toBe(42);
    expect(s.p99).toBe(42);
  });

  it("does not store unbounded samples (caps memory)", () => {
    const fixedNow = 1_000_000;
    const r = new RollingPercentiles({ windowMs: 60_000, maxSamples: 100, now: () => fixedNow });
    for (let i = 0; i < 5000; i += 1) r.record(i, fixedNow);
    const s = r.summary();
    expect(s.count).toBeLessThanOrEqual(100);
  });

  it("interpolates nearest-rank percentile (sorted via Array.sort)", () => {
    const fixedNow = 1_000_000;
    const r = new RollingPercentiles({ windowMs: 60_000, now: () => fixedNow });
    [2, 4, 6, 8, 10].forEach((v) => r.record(v, fixedNow));
    const s = r.summary();
    // 5 samples, nearest-rank: ceil(0.50 * 5) = 3rd element after sort => 6
    expect(s.p50).toBe(6);
  });

  it("rejects invalid window", () => {
    expect(() => new RollingPercentiles({ windowMs: 0 })).toThrow();
  });
});

describe("createTrophyMetrics", () => {
  it("isolates per-operation metrics", () => {
    const metrics = createTrophyMetrics();
    metrics.start("trophy.unlock").ok(10);
    metrics.start("trophy.unlock").ok(20);
    metrics.start("trophy.levelUp").ok(5);
    const unlock = metrics.snapshot("trophy.unlock");
    const levelUp = metrics.snapshot("trophy.levelUp");
    expect(unlock.count).toBe(2);
    // 2 samples [10, 20] => p50 = nearest rank(0.5 * 2) = 1st = 10
    expect(unlock.p50).toBe(10);
    expect(levelUp.count).toBe(1);
    expect(levelUp.p50).toBe(5);
  });

  it("records failures with a separate counter", () => {
    const metrics = createTrophyMetrics();
    metrics.start("trophy.unlock").ok(10);
    metrics.start("trophy.unlock").fail(new Error("boom"));
    const snap = metrics.snapshot("trophy.unlock");
    expect(snap.count).toBe(1);
    expect(snap.failures).toBe(1);
  });

  it("emits Prometheus text format", () => {
    const metrics = createTrophyMetrics();
    metrics.start("trophy.unlock").ok(10);
    metrics.start("trophy.unlock").ok(20);
    metrics.start("trophy.unlock").fail(new Error("boom"));
    const text = metrics.prometheus();
    expect(text).toContain("# HELP trophy_unlock_ms");
    expect(text).toContain("# TYPE trophy_unlock_ms summary");
    // Samples: [10, 20] (failures are excluded from the latency distribution).
    // p50 = nearest rank(0.5 * 2) = 1st -> 10.
    expect(text).toMatch(/^trophy_unlock_ms\{quantile="0\.5"\} 10/m);
    expect(text).toMatch(/^trophy_unlock_ms_count 2/m);
    expect(text).toMatch(/^trophy_unlock_failures_total 1/m);
  });

  it("measureSync times a function and reports duration", () => {
    const metrics = createTrophyMetrics();
    const result = metrics.measureSync("trophy.unlock", () => 42);
    expect(result).toBe(42);
    const snap = metrics.snapshot("trophy.unlock");
    expect(snap.count).toBe(1);
    expect(snap.p50).toBeGreaterThanOrEqual(0);
  });

  it("measure times an async function and reports duration", async () => {
    const metrics = createTrophyMetrics();
    const result = await metrics.measure("trophy.unlock", async () => {
      await new Promise((r) => setTimeout(r, 5));
      return "ok";
    });
    expect(result).toBe("ok");
    const snap = metrics.snapshot("trophy.unlock");
    expect(snap.count).toBe(1);
  });

  it("listOperations returns the recorded operation names", () => {
    const metrics = createTrophyMetrics();
    metrics.start("a").ok(1);
    metrics.start("b").ok(2);
    expect(metrics.listOperations().sort()).toEqual(["a", "b"]);
  });

  it("snapshot for an unknown operation returns zeros", () => {
    const metrics = createTrophyMetrics();
    const snap: TrophyMetricsSnapshot = metrics.snapshot("nonexistent");
    expect(snap.count).toBe(0);
    expect(snap.p50).toBe(0);
  });

  it("reset clears all state", () => {
    const metrics = createTrophyMetrics();
    metrics.start("a").ok(1);
    metrics.start("a").fail(new Error("x"));
    metrics.reset();
    expect(metrics.listOperations()).toEqual([]);
    const snap = metrics.snapshot("a");
    expect(snap.count).toBe(0);
    expect(snap.failures).toBe(0);
  });

  it("prometheus returns empty string when no operations recorded", () => {
    const metrics = createTrophyMetrics();
    expect(metrics.prometheus()).toBe("");
  });
});
