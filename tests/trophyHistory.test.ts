// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTrophyHistory, type UserTrophy, type XpEvent } from "../src/services/trophyHistory";

// --- Supabase query-builder mock ----------------------------------------------
// Minimal chainable builder that records the operations applied and returns a
// canned result. Each test seeds the rows it wants.

interface QueryPlan {
  table: string;
  filters: Array<{ op: string; col: string; val: unknown }>;
  limit: number | null;
  order: { col: string; asc: boolean; nullsFirst: boolean } | null;
  result: { data: unknown; error: { message: string } | null };
}

const newBuilder = (plan: QueryPlan) => {
  const builder: any = {
    _plan: plan,
    eq(col: string, val: unknown) {
      plan.filters.push({ op: "eq", col, val });
      return builder;
    },
    gte(col: string, val: unknown) {
      plan.filters.push({ op: "gte", col, val });
      return builder;
    },
    lte(col: string, val: unknown) {
      plan.filters.push({ op: "lte", col, val });
      return builder;
    },
    lt(col: string, val: unknown) {
      plan.filters.push({ op: "lt", col, val });
      return builder;
    },
    order(col: string, opts?: { ascending?: boolean; nullsFirst?: boolean }) {
      plan.order = { col, asc: opts?.ascending !== false, nullsFirst: opts?.nullsFirst === true };
      return builder;
    },
    limit(n: number) {
      plan.limit = n;
      return builder;
    },
    select() {
      return builder;
    },
    upsert() {
      return builder;
    },
    single() {
      return Promise.resolve(plan.result);
    },
    maybeSingle() {
      return Promise.resolve(plan.result);
    },
    then(resolve: (r: unknown) => void) {
      resolve(plan.result);
    },
  };
  return builder;
};

const makeClient = (plans: QueryPlan[]) => {
  const consumed: QueryPlan[] = [];
  const from = vi.fn((table: string) => {
    const plan = plans.shift();
    if (!plan) throw new Error(`unexpected .from(${table})`);
    plan.table = table;
    consumed.push(plan);
    return newBuilder(plan);
  });
  return { from, plans: consumed } as any;
};

// --- Tests --------------------------------------------------------------------

const sampleTrophy: UserTrophy = {
  id: "ut-1",
  user_id: "user-1",
  trophy_id: "td-1",
  progress: 1,
  unlocked_at: "2026-08-31T12:00:00.000Z",
  notified_at: null,
  metadata: {},
  trophy: {
    id: "td-1",
    code: "first_trophy",
    title: "Primeira Conquista",
    description: "Desbloqueie sua primeira conquista.",
    tier: "bronze",
    xp_value: 15,
    category: "achievement",
    icon_url: null,
  },
};

const sampleXp: XpEvent = {
  id: "xp-1",
  user_id: "user-1",
  source_type: "trophy_unlock",
  source_id: "ut-1",
  amount: 15,
  level_before: 1,
  level_after: 1,
  reason: null,
  metadata: {},
  created_at: "2026-08-31T12:00:00.000Z",
};

describe("createTrophyHistory.fetchTrophies", () => {
  it("queries user_trophies with the user filter and returns a page", async () => {
    const plans: QueryPlan[] = [
      {
        table: "",
        filters: [],
        limit: null,
        order: null,
        result: { data: [sampleTrophy], error: null },
      },
    ];
    const client = makeClient(plans);
    const history = createTrophyHistory(client);
    const page = await history.fetchTrophies("user-1", { limit: 25 });
    expect(client.plans[0].table).toBe("user_trophies");
    expect(client.plans[0].filters).toEqual([{ op: "eq", col: "user_id", val: "user-1" }]);
    expect(client.plans[0].limit).toBe(26); // +1 for cursor detection
    expect(client.plans[0].order).toEqual({ col: "unlocked_at", asc: false, nullsFirst: false });
    expect(page.rows).toEqual([sampleTrophy]);
    expect(page.nextCursor).toBeNull();
  });

  it("applies tier, since, until, and before filters when supplied", async () => {
    const plans: QueryPlan[] = [
      {
        table: "",
        filters: [],
        limit: null,
        order: null,
        result: { data: [sampleTrophy], error: null },
      },
    ];
    const client = makeClient(plans);
    const history = createTrophyHistory(client);
    await history.fetchTrophies("user-1", {
      limit: 10,
      tier: "gold",
      since: "2026-01-01T00:00:00.000Z",
      until: "2026-12-31T00:00:00.000Z",
      before: "2026-08-31T12:00:00.000Z",
    });
    const ops = client.plans[0].filters.map((f) => `${f.op}:${f.col}=${f.val}`);
    expect(ops).toEqual([
      "eq:user_id=user-1",
      "eq:trophy.tier=gold",
      "gte:unlocked_at=2026-01-01T00:00:00.000Z",
      "lte:unlocked_at=2026-12-31T00:00:00.000Z",
      "lt:unlocked_at=2026-08-31T12:00:00.000Z",
    ]);
    expect(client.plans[0].limit).toBe(11);
  });

  it("clamps oversized limit to the max page size", async () => {
    const plans: QueryPlan[] = [
      { table: "", filters: [], limit: null, order: null, result: { data: [], error: null } },
    ];
    const client = makeClient(plans);
    const history = createTrophyHistory(client);
    await history.fetchTrophies("user-1", { limit: 100_000 });
    expect(client.plans[0].limit).toBe(101); // MAX_PAGE_SIZE + 1
  });

  it("emits a non-null nextCursor when the page is full", async () => {
    const rows: UserTrophy[] = Array.from({ length: 6 }, (_, i) => ({
      ...sampleTrophy,
      id: `ut-${i}`,
      unlocked_at: new Date(Date.parse("2026-08-31T12:00:00.000Z") - i * 1000).toISOString(),
    }));
    const plans: QueryPlan[] = [
      { table: "", filters: [], limit: null, order: null, result: { data: rows, error: null } },
    ];
    const client = makeClient(plans);
    const history = createTrophyHistory(client);
    const page = await history.fetchTrophies("user-1", { limit: 5 });
    expect(page.rows).toHaveLength(5);
    expect(page.nextCursor).toBe(page.rows[page.rows.length - 1].unlocked_at);
  });

  it("falls back to a flat query when the relation is missing", async () => {
    const plans: QueryPlan[] = [
      // First attempt: relation column missing.
      {
        table: "",
        filters: [],
        limit: null,
        order: null,
        result: { data: null, error: { message: "column user_trophies.trophy does not exist" } },
      },
      // Fallback: flat columns.
      {
        table: "",
        filters: [],
        limit: null,
        order: null,
        result: { data: [sampleTrophy], error: null },
      },
    ];
    const client = makeClient(plans);
    const history = createTrophyHistory(client);
    const page = await history.fetchTrophies("user-1", { limit: 5 });
    expect(client.plans[0].table).toBe("user_trophies");
    expect(client.plans[1].table).toBe("user_trophies");
    expect(page.rows).toEqual([sampleTrophy]);
  });

  it("throws on real errors that are not missing-column", async () => {
    const plans: QueryPlan[] = [
      {
        table: "",
        filters: [],
        limit: null,
        order: null,
        result: { data: null, error: { message: "permission denied" } },
      },
    ];
    const client = makeClient(plans);
    const history = createTrophyHistory(client);
    await expect(history.fetchTrophies("user-1")).rejects.toThrow(/permission denied/);
  });
});

describe("createTrophyHistory.fetchXpEvents", () => {
  it("queries xp_events and returns a page", async () => {
    const plans: QueryPlan[] = [
      {
        table: "",
        filters: [],
        limit: null,
        order: null,
        result: { data: [sampleXp], error: null },
      },
    ];
    const client = makeClient(plans);
    const history = createTrophyHistory(client);
    const page = await history.fetchXpEvents("user-1", { limit: 20 });
    expect(client.plans[0].table).toBe("xp_events");
    expect(client.plans[0].order).toEqual({ col: "created_at", asc: false, nullsFirst: false });
    expect(client.plans[0].limit).toBe(21);
    expect(page.rows).toEqual([sampleXp]);
  });

  it("emits a nextCursor when more rows are available", async () => {
    const rows: XpEvent[] = Array.from({ length: 4 }, (_, i) => ({
      ...sampleXp,
      id: `xp-${i}`,
      created_at: new Date(Date.parse("2026-08-31T12:00:00.000Z") - i * 1000).toISOString(),
    }));
    const plans: QueryPlan[] = [
      { table: "", filters: [], limit: null, order: null, result: { data: rows, error: null } },
    ];
    const client = makeClient(plans);
    const history = createTrophyHistory(client);
    const page = await history.fetchXpEvents("user-1", { limit: 3 });
    expect(page.rows).toHaveLength(3);
    expect(page.nextCursor).toBe(rows[2].created_at);
  });

  it("throws on error", async () => {
    const plans: QueryPlan[] = [
      {
        table: "",
        filters: [],
        limit: null,
        order: null,
        result: { data: null, error: { message: "boom" } },
      },
    ];
    const client = makeClient(plans);
    const history = createTrophyHistory(client);
    await expect(history.fetchXpEvents("user-1")).rejects.toThrow(/boom/);
  });

  it("applies since/until/before filters when supplied", async () => {
    const plans: QueryPlan[] = [
      { table: "", filters: [], limit: null, order: null, result: { data: [sampleXp], error: null } },
    ];
    const client = makeClient(plans);
    const history = createTrophyHistory(client);
    await history.fetchXpEvents("user-1", {
      limit: 10,
      since: "2026-01-01T00:00:00.000Z",
      until: "2026-12-31T00:00:00.000Z",
      before: "2026-08-31T12:00:00.000Z",
    });
    const ops = client.plans[0].filters.map((f) => `${f.op}:${f.col}=${f.val}`);
    expect(ops).toEqual([
      "eq:user_id=user-1",
      "gte:created_at=2026-01-01T00:00:00.000Z",
      "lte:created_at=2026-12-31T00:00:00.000Z",
      "lt:created_at=2026-08-31T12:00:00.000Z",
    ]);
  });

  it("defaults to an empty array when no rows are returned", async () => {
    const plans: QueryPlan[] = [
      { table: "", filters: [], limit: null, order: null, result: { data: null, error: null } },
    ];
    const client = makeClient(plans);
    const history = createTrophyHistory(client);
    const page = await history.fetchXpEvents("user-1", { limit: 5 });
    expect(page.rows).toEqual([]);
    expect(page.nextCursor).toBeNull();
  });
});

describe("createTrophyHistory.fetchStats", () => {
  it("queries the user_trophy_stats_view", async () => {
    const plans: QueryPlan[] = [
      {
        table: "",
        filters: [],
        limit: null,
        order: null,
        result: {
          data: {
            user_id: "user-1",
            unlocked_total: 5,
            unlocked_platinum: 1,
            unlocked_gold: 1,
            unlocked_silver: 1,
            unlocked_bronze: 2,
            unlocked_xp: 435,
          },
          error: null,
        },
      },
    ];
    const client = makeClient(plans);
    const history = createTrophyHistory(client);
    const stats = await history.fetchStats("user-1");
    expect(client.plans[0].table).toBe("user_trophy_stats_view");
    expect(stats?.unlocked_total).toBe(5);
    expect(stats?.unlocked_xp).toBe(435);
  });

  it("returns null when the user has no row", async () => {
    const plans: QueryPlan[] = [
      { table: "", filters: [], limit: null, order: null, result: { data: null, error: null } },
    ];
    const client = makeClient(plans);
    const history = createTrophyHistory(client);
    expect(await history.fetchStats("user-1")).toBeNull();
  });

  it("throws on stats error", async () => {
    const plans: QueryPlan[] = [
      { table: "", filters: [], limit: null, order: null, result: { data: null, error: { message: "rls" } } },
    ];
    const client = makeClient(plans);
    const history = createTrophyHistory(client);
    await expect(history.fetchStats("user-1")).rejects.toThrow(/rls/);
  });
});

describe("createTrophyHistory.fetchLevel", () => {
  it("queries level_progress and returns the row", async () => {
    const plans: QueryPlan[] = [
      {
        table: "",
        filters: [],
        limit: null,
        order: null,
        result: {
          data: {
            user_id: "user-1",
            current_level: 12,
            current_level_xp: 30,
            total_xp: 600,
            tier: "bronze",
            last_xp_at: "2026-08-31T12:00:00.000Z",
            updated_at: "2026-08-31T12:00:00.000Z",
          },
          error: null,
        },
      },
    ];
    const client = makeClient(plans);
    const history = createTrophyHistory(client);
    const level = await history.fetchLevel("user-1");
    expect(client.plans[0].table).toBe("level_progress");
    expect(level?.current_level).toBe(12);
  });

  it("returns null when the user has no level row", async () => {
    const plans: QueryPlan[] = [
      { table: "", filters: [], limit: null, order: null, result: { data: null, error: null } },
    ];
    const client = makeClient(plans);
    const history = createTrophyHistory(client);
    expect(await history.fetchLevel("user-1")).toBeNull();
  });

  it("throws on level error", async () => {
    const plans: QueryPlan[] = [
      { table: "", filters: [], limit: null, order: null, result: { data: null, error: { message: "rls" } } },
    ];
    const client = makeClient(plans);
    const history = createTrophyHistory(client);
    await expect(history.fetchLevel("user-1")).rejects.toThrow(/rls/);
  });
});

describe("createTrophyHistory.upsertTrophyProgress", () => {
  it("rejects out-of-range progress", async () => {
    const client = makeClient([]);
    const history = createTrophyHistory(client);
    await expect(history.upsertTrophyProgress("u", "t", -0.1)).rejects.toThrow(/\[0,1\]/);
    await expect(history.upsertTrophyProgress("u", "t", 1.5)).rejects.toThrow(/\[0,1\]/);
  });

  it("upserts with unlocked_at when progress=1", async () => {
    let captured: any = null;
    const client = {
      from(table: string) {
        return {
          upsert(payload: unknown, opts: unknown) {
            captured = { table, payload, opts };
            return this;
          },
          select() {
            return this;
          },
          single() {
            return Promise.resolve({
              data: { ...sampleTrophy, progress: 1, unlocked_at: new Date().toISOString() },
              error: null,
            });
          },
        };
      },
    } as any;
    const history = createTrophyHistory(client);
    const result = await history.upsertTrophyProgress("user-1", "td-1", 1, { source: "test" });
    expect(captured.table).toBe("user_trophies");
    expect(captured.payload.progress).toBe(1);
    expect(captured.payload.unlocked_at).toBeTruthy();
    expect(captured.opts).toEqual({ onConflict: "user_id,trophy_id" });
    expect(result?.progress).toBe(1);
  });

  it("upserts with unlocked_at=null when progress<1", async () => {
    let captured: any = null;
    const client = {
      from() {
        return {
          upsert(payload: unknown) {
            captured = payload;
            return this;
          },
          select() {
            return this;
          },
          single() {
            return Promise.resolve({ data: { ...sampleTrophy, progress: 0.5, unlocked_at: null }, error: null });
          },
        };
      },
    } as any;
    const history = createTrophyHistory(client);
    await history.upsertTrophyProgress("user-1", "td-1", 0.5);
    expect(captured.progress).toBe(0.5);
    expect(captured.unlocked_at).toBeNull();
  });

  it("throws when the upsert errors", async () => {
    const client = {
      from() {
        return {
          upsert() {
            return this;
          },
          select() {
            return this;
          },
          single() {
            return Promise.resolve({ data: null, error: { message: "rls" } });
          },
        };
      },
    } as any;
    const history = createTrophyHistory(client);
    await expect(history.upsertTrophyProgress("u", "t", 0.5)).rejects.toThrow(/rls/);
  });

  it("returns null when the upsert yields no data and no error", async () => {
    const client = {
      from() {
        return {
          upsert() {
            return this;
          },
          select() {
            return this;
          },
          single() {
            return Promise.resolve({ data: null, error: null });
          },
        };
      },
    } as any;
    const history = createTrophyHistory(client);
    expect(await history.upsertTrophyProgress("u", "t", 0.5)).toBeNull();
  });
});

describe("defaultTrophyHistory", () => {
  it("is a non-null TrophyHistoryClient", async () => {
    const { defaultTrophyHistory } = await import("../src/services/trophyHistory");
    expect(defaultTrophyHistory).toBeTruthy();
    expect(typeof defaultTrophyHistory.fetchTrophies).toBe("function");
    expect(typeof defaultTrophyHistory.fetchXpEvents).toBe("function");
    expect(typeof defaultTrophyHistory.fetchStats).toBe("function");
    expect(typeof defaultTrophyHistory.fetchLevel).toBe("function");
    expect(typeof defaultTrophyHistory.upsertTrophyProgress).toBe("function");
  });
});

beforeEach(() => {
  vi.clearAllMocks();
});
