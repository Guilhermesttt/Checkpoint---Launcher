// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createTrophyUnlockDetector,
  normalizeTrophyUnlock,
  type DetectorListener,
  type TrophyUnlock,
} from "../src/services/achievementDetector";

describe("achievementDetector: normalizeTrophyUnlock", () => {
  it("normalizes a user_trophies row joined with trophy_definitions", () => {
    const row = {
      trophy_id: "trophy-uuid",
      progress: 1,
      unlocked_at: "2026-08-31T12:00:00.000Z",
      notified_at: null,
      trophy_definitions: {
        code: "first_trophy",
        title: "Bem-vindo ao sistema de troféus",
        description: "Desbloqueie seu primeiro troféu.",
        tier: "bronze",
        xp_value: 15,
        icon_url: "https://cdn.example/trophy.png",
      },
    };
    const out = normalizeTrophyUnlock(row, { source: "realtime" });
    expect(out).toMatchObject({
      id: "trophy-uuid",
      trophyTitle: "Bem-vindo ao sistema de troféus",
      trophyDescription: "Desbloqueie seu primeiro troféu.",
      tier: "bronze",
      xp: 15,
      unlockedAt: "2026-08-31T12:00:00.000Z",
      source: "realtime",
      dedupKey: "realtime:trophy-uuid:2026-08-31T12:00:00.000Z",
    });
    expect(out.iconUrl).toBe("https://cdn.example/trophy.png");
  });

  it("normalizes an achievement-bridge payload (local game)", () => {
    const out = normalizeTrophyUnlock(
      {
        gameId: "steam_2050650",
        achievementId: "ACH_BOSS_1",
        achievement: {
          id: "ACH_BOSS_1",
          name: "Boss Derrotado",
          description: "Derrote o primeiro boss.",
          icon: "https://cdn.example/ach.png",
        },
        unlockedAt: "2026-08-31T12:00:05.000Z",
      },
      { source: "bridge" },
    );
    expect(out).toMatchObject({
      trophyTitle: "Boss Derrotado",
      trophyDescription: "Derrote o primeiro boss.",
      tier: "bronze",
      xp: 0,
      iconUrl: "https://cdn.example/ach.png",
      source: "bridge",
      dedupKey: "bridge:steam_2050650:ACH_BOSS_1",
    });
  });

  it("normalizes a level-up milestone payload", () => {
    const out = normalizeTrophyUnlock(
      {
        kind: "level-up",
        level: 10,
        totalXp: 855,
        unlockedAt: "2026-08-31T12:01:00.000Z",
      },
      { source: "level" },
    );
    expect(out).toMatchObject({
      trophyTitle: "Nível 10 alcançado",
      tier: "silver",
      xp: 0,
      source: "level",
      dedupKey: "level:level-up:10",
    });
  });

  it("falls back to bronze for unknown tier values", () => {
    const out = normalizeTrophyUnlock(
      {
        trophy_definitions: { title: "X", tier: "mythic", xp_value: 50 },
        unlocked_at: "2026-08-31T12:00:00.000Z",
      },
      { source: "realtime" },
    );
    expect(out.tier).toBe("bronze");
    expect(out.xp).toBe(50);
  });

  it("returns null when payload is missing required fields", () => {
    expect(normalizeTrophyUnlock(null, { source: "realtime" })).toBeNull();
    expect(normalizeTrophyUnlock({}, { source: "realtime" })).toBeNull();
    expect(
      normalizeTrophyUnlock(
        { achievement: { id: "x", name: "X" } },
        { source: "bridge" },
      ),
    ).toBeNull(); // bridge requires gameId
  });
});

describe("achievementDetector: createTrophyUnlockDetector", () => {
  let now: () => number;
  let listeners: DetectorListener[];

  beforeEach(() => {
    now = () => 1_700_000_000_000;
    listeners = [];
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("emits a normalized unlock for new sources", () => {
    const seen: TrophyUnlock[] = [];
    const detector = createTrophyUnlockDetector({
      now,
      listener: (u) => seen.push(u),
    });
    const accepted = detector.ingest({
      trophy_definitions: { title: "A", tier: "silver", xp_value: 30 },
      unlocked_at: "2026-08-31T12:00:00.000Z",
      trophy_id: "t-1",
    });
    expect(accepted).toBe(true);
    expect(seen).toHaveLength(1);
    expect(seen[0].trophyTitle).toBe("A");
    expect(seen[0].tier).toBe("silver");
  });

  it("dedups by stable key across sources and within the dedup window", () => {
    const seen: TrophyUnlock[] = [];
    const detector = createTrophyUnlockDetector({
      now,
      dedupWindowMs: 60_000,
      listener: (u) => seen.push(u),
    });
    const payload = {
      gameId: "steam_2050650",
      achievementId: "ACH_1",
      achievement: { id: "ACH_1", name: "X", description: "", icon: "" },
      unlockedAt: "2026-08-31T12:00:00.000Z",
    };
    expect(detector.ingest(payload)).toBe(true);
    // Same payload again within the window is deduped.
    expect(detector.ingest(payload)).toBe(false);
    expect(seen).toHaveLength(1);
  });

  it("forgets dedup keys after the window elapses", () => {
    let current = 1_700_000_000_000;
    const seen: TrophyUnlock[] = [];
    const detector = createTrophyUnlockDetector({
      now: () => current,
      dedupWindowMs: 1000,
      listener: (u) => seen.push(u),
    });
    const payload = {
      gameId: "steam_2050650",
      achievementId: "ACH_X",
      achievement: { id: "ACH_X", name: "X", description: "", icon: "" },
      unlockedAt: "2026-08-31T12:00:00.000Z",
    };
    expect(detector.ingest(payload)).toBe(true);
    // Advance past the dedup window.
    current += 5000;
    expect(detector.ingest(payload)).toBe(true);
    expect(seen).toHaveLength(2);
  });

  it("supports multiple listeners (toast + telemetry)", () => {
    const a: TrophyUnlock[] = [];
    const b: TrophyUnlock[] = [];
    const detector = createTrophyUnlockDetector({ now });
    detector.subscribe((u) => a.push(u));
    detector.subscribe((u) => b.push(u));
    detector.ingest({
      trophy_definitions: { title: "Z", tier: "platinum", xp_value: 300 },
      unlocked_at: "2026-08-31T12:00:00.000Z",
      trophy_id: "t-z",
    });
    expect(a).toHaveLength(1);
    expect(b).toHaveLength(1);
  });

  it("returns false and emits nothing for un-normalizable payloads", () => {
    const seen: TrophyUnlock[] = [];
    const detector = createTrophyUnlockDetector({
      now,
      listener: (u) => seen.push(u),
    });
    expect(detector.ingest(null)).toBe(false);
    expect(detector.ingest({})).toBe(false);
    expect(seen).toHaveLength(0);
  });

  it("unsubscribe stops further events for a listener", () => {
    const seen: TrophyUnlock[] = [];
    const detector = createTrophyUnlockDetector({ now });
    const off = detector.subscribe((u) => seen.push(u));
    off();
    detector.ingest({
      trophy_definitions: { title: "T", tier: "bronze", xp_value: 5 },
      unlocked_at: "2026-08-31T12:00:00.000Z",
      trophy_id: "t",
    });
    expect(seen).toHaveLength(0);
  });

  it("stops the in-memory dedup map when disposed", () => {
    const detector = createTrophyUnlockDetector({ now });
    const payload = {
      trophy_definitions: { title: "T", tier: "bronze", xp_value: 5 },
      unlocked_at: "2026-08-31T12:00:00.000Z",
      trophy_id: "t",
    };
    expect(detector.ingest(payload)).toBe(true);
    detector.dispose();
    expect(detector.size()).toBe(0);
  });

  it("normalizes a manual source (already TrophyUnlock-shaped) payload", () => {
    const out = normalizeTrophyUnlock(
      {
        id: "manual-id",
        trophyTitle: "Platina Concedida Manualmente",
        trophyDescription: "Bônus de lançamento",
        tier: "platinum",
        xp: 300,
        unlockedAt: "2026-08-31T12:30:00.000Z",
        iconUrl: "https://cdn.example/manual.png",
      },
      { source: "manual" },
    );
    expect(out).toMatchObject({
      id: "manual-id",
      trophyTitle: "Platina Concedida Manualmente",
      tier: "platinum",
      xp: 300,
      source: "manual",
      dedupKey: "manual:manual-id:2026-08-31T12:30:00.000Z",
    });
    expect(out.iconUrl).toBe("https://cdn.example/manual.png");
  });

  it("returns null for manual source when id or title is missing", () => {
    expect(normalizeTrophyUnlock({ trophyTitle: "T" }, { source: "manual" })).toBeNull();
    expect(normalizeTrophyUnlock({ id: "x" }, { source: "manual" })).toBeNull();
  });

  it("trims the dedup map to maxEntries and drops the oldest keys", () => {
    const seen: TrophyUnlock[] = [];
    const detector = createTrophyUnlockDetector({
      now,
      dedupWindowMs: 60_000,
      maxEntries: 2,
      listener: (u) => seen.push(u),
    });
    const basePayload = (id: string) => ({
      trophy_definitions: { title: id, tier: "bronze" },
      unlocked_at: `2026-08-31T12:00:0${id.slice(-1)}.000Z`,
      trophy_id: id,
    });
    expect(detector.ingest(basePayload("a"))).toBe(true);
    expect(detector.ingest(basePayload("b"))).toBe(true);
    expect(detector.size()).toBe(2);
    expect(detector.ingest(basePayload("c"))).toBe(true);
    // After trim, the oldest key ('a') is gone but 'b' and 'c' remain.
    expect(detector.size()).toBe(2);
    // Re-ingesting 'a' is now allowed because the oldest entry was evicted.
    expect(detector.ingest(basePayload("a"))).toBe(true);
    expect(seen.length).toBeGreaterThanOrEqual(3);
  });

  it("swallows listener exceptions without breaking other listeners", () => {
    const a: TrophyUnlock[] = [];
    const b: TrophyUnlock[] = [];
    const detector = createTrophyUnlockDetector({ now });
    detector.subscribe(() => {
      throw new Error("listener boom");
    });
    detector.subscribe((u) => a.push(u));
    detector.subscribe((u) => b.push(u));
    detector.ingest({
      trophy_definitions: { title: "T", tier: "bronze", xp_value: 5 },
      unlocked_at: "2026-08-31T12:00:00.000Z",
      trophy_id: "t",
    });
    expect(a).toHaveLength(1);
    expect(b).toHaveLength(1);
  });

  it("infers source based on payload shape when no source is given", () => {
    const detector = createTrophyUnlockDetector({ now });
    const seen: TrophyUnlock[] = [];
    detector.subscribe((u) => seen.push(u));
    // kind field => level
    detector.ingest({ kind: "level-up", level: 5 });
    // trophy_id => realtime
    detector.ingest({
      trophy_id: "rt-1",
      trophy_definitions: { title: "RT", tier: "bronze" },
    });
    // gameId => bridge
    detector.ingest({
      gameId: "g",
      achievementId: "a",
      achievement: { id: "a", name: "B" },
    });
    // fallback => manual — needs id + title
    detector.ingest({ id: "m-1", trophyTitle: "M" });
    expect(seen.map((u) => u.source)).toEqual(["level", "realtime", "bridge", "manual"]);
  });

  it("rejects subscribe with a non-function and returns a no-op unsubscribe", () => {
    const detector = createTrophyUnlockDetector({ now });
    const off = detector.subscribe(null as unknown as DetectorListener);
    expect(typeof off).toBe("function");
    expect(() => off()).not.toThrow();
  });

  it("falls back to description when realtime title is empty", () => {
    const out = normalizeTrophyUnlock(
      {
        trophy_id: "rt-2",
        trophy_definitions: { title: "", description: "fallback", tier: "bronze" },
        unlocked_at: "2026-08-31T12:00:00.000Z",
      },
      { source: "realtime" },
    );
    expect(out?.trophyTitle).toBe("fallback");
  });

  it("falls back to the bridge achievementId when no achievement.name is provided", () => {
    const out = normalizeTrophyUnlock(
      {
        gameId: "g",
        achievementId: "ACH_NAMELESS",
        achievement: { id: "ACH_NAMELESS" },
      },
      { source: "bridge" },
    );
    expect(out?.trophyTitle).toBe("ACH_NAMELESS");
  });

  it("uses the injected now when the payload has no unlocked_at field", () => {
    const fixed = 1_700_000_000_000;
    const out = normalizeTrophyUnlock(
      {
        gameId: "g",
        achievementId: "ACH_TIME",
        achievement: { id: "ACH_TIME", name: "X" },
      },
      { source: "bridge", now: () => fixed },
    );
    expect(out?.unlockedAt).toBe(new Date(fixed).toISOString());
  });
});
