// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTrophyUnlockDetector } from "../src/services/achievementDetector";
import {
  createTrophyRealtimeSubscription,
  type ChannelFactory,
  type TrophyRealtimeEvent,
  type TrophyRealtimeRow,
} from "../src/services/trophyRealtime";

class FakeChannel {
  public type = "";
  public table = "";
  public schema = "";
  public event = "";
  public filter = "";
  public postgresBindings: Array<{
    type: string;
    event: string;
    filter: string;
    handler: (payload: TrophyRealtimeEvent) => void;
  }> = [];
  public unsubscribeMock = vi.fn(async () => undefined);
  public subscribeMock = vi.fn(async () => "SUBSCRIBED");

  // supabase-js v2 channel.on(type, options, handler) signature.
  on(type: string, options: { event: string; filter?: string; schema?: string; table?: string }, handler: (payload: TrophyRealtimeEvent) => void) {
    this.type = type;
    this.table = options.table || "";
    this.schema = options.schema || "";
    this.event = options.event;
    this.filter = options.filter || "";
    this.postgresBindings.push({ type, event: options.event, filter: options.filter || "", handler });
    return this;
  }

  subscribe(callback?: (status: string) => void) {
    if (callback) callback("SUBSCRIBED");
    return this.subscribeMock();
  }

  unsubscribe() {
    return this.unsubscribeMock();
  }

  // Test helper to fire a fake payload.
  emit(eventType: TrophyRealtimeEvent["eventType"], payload: Partial<TrophyRealtimeEvent> = {}) {
    for (const binding of this.postgresBindings) {
      if (binding.event === eventType) {
        binding.handler({ eventType, table: this.table, ...payload });
      }
    }
  }
}

const buildFactory = (channel: FakeChannel): ChannelFactory => {
  return () => channel as unknown as ReturnType<ChannelFactory>;
};

const makeRow = (overrides: Partial<TrophyRealtimeRow> = {}): TrophyRealtimeRow => ({
  user_id: "user-1",
  trophy_id: "trophy-uuid-1",
  progress: 1,
  unlocked_at: "2026-08-31T12:00:00.000Z",
  notified_at: null,
  ...overrides,
});

describe("trophyRealtime: createTrophyRealtimeSubscription", () => {
  let channel: FakeChannel;

  beforeEach(() => {
    channel = new FakeChannel();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("subscribes to user_trophies INSERT/UPDATE filtered by user_id", async () => {
    const factory = buildFactory(channel);
    const sub = createTrophyRealtimeSubscription({
      userId: "user-1",
      createChannel: factory,
      detector: createTrophyUnlockDetector(),
    });
    await sub.start();
    expect(channel.table).toBe("user_trophies");
    expect(channel.filter).toContain("user_id=eq.user-1");
    expect(channel.postgresBindings.map((b) => b.event).sort()).toEqual(["INSERT", "UPDATE"]);
    await sub.stop();
  });

  it("forwards a fully-unlocked row to the detector", async () => {
    const detector = createTrophyUnlockDetector();
    const ingestSpy = vi.spyOn(detector, "ingest");
    const sub = createTrophyRealtimeSubscription({
      userId: "user-1",
      createChannel: buildFactory(channel),
      detector,
    });
    await sub.start();
    channel.emit("INSERT", {
      new: makeRow({
        trophy_definitions: {
          title: "First Trophy",
          description: "Welcome",
          tier: "bronze",
          xp_value: 15,
          icon_url: "https://cdn.example/t.png",
        },
      }),
    });
    expect(ingestSpy).toHaveBeenCalledTimes(1);
    expect(ingestSpy.mock.calls[0][0]).toMatchObject({
      trophy_definitions: { title: "First Trophy", tier: "bronze" },
    });
    await sub.stop();
  });

  it("ignores rows that are not yet fully unlocked (progress < 1)", async () => {
    const detector = createTrophyUnlockDetector();
    const ingestSpy = vi.spyOn(detector, "ingest");
    const sub = createTrophyRealtimeSubscription({
      userId: "user-1",
      createChannel: buildFactory(channel),
      detector,
    });
    await sub.start();
    channel.emit("INSERT", { new: makeRow({ progress: 0.5, unlocked_at: null }) });
    expect(ingestSpy).not.toHaveBeenCalled();
    await sub.stop();
  });

  it("ignores rows from other users", async () => {
    const detector = createTrophyUnlockDetector();
    const ingestSpy = vi.spyOn(detector, "ingest");
    const sub = createTrophyRealtimeSubscription({
      userId: "user-1",
      createChannel: buildFactory(channel),
      detector,
    });
    await sub.start();
    channel.emit("INSERT", { new: makeRow({ user_id: "user-2" }) });
    expect(ingestSpy).not.toHaveBeenCalled();
    await sub.stop();
  });

  it("ignores events for a different table", async () => {
    const detector = createTrophyUnlockDetector();
    const ingestSpy = vi.spyOn(detector, "ingest");
    const sub = createTrophyRealtimeSubscription({
      userId: "user-1",
      createChannel: buildFactory(channel),
      detector,
    });
    await sub.start();
    channel.emit("INSERT", { table: "xp_events", new: makeRow() });
    expect(ingestSpy).not.toHaveBeenCalled();
    await sub.stop();
  });

  it("stops forwarding events after stop()", async () => {
    const detector = createTrophyUnlockDetector();
    const ingestSpy = vi.spyOn(detector, "ingest");
    const sub = createTrophyRealtimeSubscription({
      userId: "user-1",
      createChannel: buildFactory(channel),
      detector,
    });
    await sub.start();
    await sub.stop();
    channel.emit("INSERT", { new: makeRow() });
    expect(ingestSpy).not.toHaveBeenCalled();
    expect(channel.unsubscribeMock).toHaveBeenCalled();
  });

  it("is idempotent: calling start() twice is a no-op", async () => {
    const factory = vi.fn(buildFactory(channel));
    const sub = createTrophyRealtimeSubscription({
      userId: "user-1",
      createChannel: factory,
      detector: createTrophyUnlockDetector(),
    });
    await sub.start();
    await sub.start();
    expect(factory).toHaveBeenCalledTimes(1);
    await sub.stop();
  });

  it("ignores events whose type is not INSERT or UPDATE", async () => {
    const detector = createTrophyUnlockDetector();
    const ingestSpy = vi.spyOn(detector, "ingest");
    const sub = createTrophyRealtimeSubscription({
      userId: "user-1",
      createChannel: buildFactory(channel),
      detector,
    });
    await sub.start();
    channel.emit("DELETE", { new: makeRow() });
    expect(ingestSpy).not.toHaveBeenCalled();
    await sub.stop();
  });

  it("treats events with no eventType as INSERT (compatible with Supabase keepalives)", async () => {
    const detector = createTrophyUnlockDetector();
    const ingestSpy = vi.spyOn(detector, "ingest");
    const sub = createTrophyRealtimeSubscription({
      userId: "user-1",
      createChannel: buildFactory(channel),
      detector,
    });
    await sub.start();
    // Hand-craft a payload with no eventType; the handler should treat it
    // as a valid row (the table filter is the source of truth).
    const handler = channel.postgresBindings[0].handler;
    handler({ table: "user_trophies", new: makeRow() });
    expect(ingestSpy).toHaveBeenCalled();
    await sub.stop();
  });

  it("ignores payloads with no `new` row", async () => {
    const detector = createTrophyUnlockDetector();
    const ingestSpy = vi.spyOn(detector, "ingest");
    const sub = createTrophyRealtimeSubscription({
      userId: "user-1",
      createChannel: buildFactory(channel),
      detector,
    });
    await sub.start();
    channel.emit("INSERT", { new: null });
    expect(ingestSpy).not.toHaveBeenCalled();
    await sub.stop();
  });

  it("logs when detector.ingest throws and continues operating", async () => {
    const detector = createTrophyUnlockDetector();
    vi.spyOn(detector, "ingest").mockImplementation(() => {
      throw new Error("detector down");
    });
    const logger = vi.fn();
    const sub = createTrophyRealtimeSubscription({
      userId: "user-1",
      createChannel: buildFactory(channel),
      detector,
      logger,
    });
    await sub.start();
    channel.emit("INSERT", { new: makeRow() });
    expect(logger).toHaveBeenCalledWith(
      "[trophyRealtime] detector.ingest threw",
      expect.any(Error),
    );
    await sub.stop();
  });

  it("logs the channel status when it is not SUBSCRIBED", async () => {
    const logger = vi.fn();
    // Build a wrapper that calls the callback with CHANNEL_ERROR
    const factory: ChannelFactory = () => ({
      on: (type: string, options: { event: string; table?: string; filter?: string; schema?: string }, handler: (payload: TrophyRealtimeEvent) => void) => {
        channel.on(type, options, handler);
        return channel;
      },
      subscribe: (cb?: (status: string) => void) => {
        if (cb) cb("CHANNEL_ERROR");
        return Promise.resolve("CHANNEL_ERROR");
      },
      unsubscribe: () => Promise.resolve(undefined),
    });
    const sub = createTrophyRealtimeSubscription({
      userId: "user-1",
      createChannel: factory,
      detector: createTrophyUnlockDetector(),
      logger,
    });
    await sub.start();
    expect(logger).toHaveBeenCalledWith(expect.stringContaining("CHANNEL_ERROR"));
    await sub.stop();
  });

  it("logs unsubscribe failures", async () => {
    const logger = vi.fn();
    channel.unsubscribeMock.mockImplementationOnce(async () => {
      throw new Error("teardown down");
    });
    const sub = createTrophyRealtimeSubscription({
      userId: "user-1",
      createChannel: buildFactory(channel),
      detector: createTrophyUnlockDetector(),
      logger,
    });
    await sub.start();
    await sub.stop();
    expect(logger).toHaveBeenCalledWith(
      "[trophyRealtime] unsubscribe failed",
      expect.any(Error),
    );
  });

  it("reports isActive correctly", async () => {
    const sub = createTrophyRealtimeSubscription({
      userId: "user-1",
      createChannel: buildFactory(channel),
      detector: createTrophyUnlockDetector(),
    });
    expect(sub.isActive()).toBe(false);
    await sub.start();
    expect(sub.isActive()).toBe(true);
    await sub.stop();
    expect(sub.isActive()).toBe(false);
  });
});
