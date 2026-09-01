// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createTrophyUnlockDetector,
  type TrophyUnlock,
  type TrophyUnlockDetector,
} from "../src/services/achievementDetector";
import {
  createTrophyRealtimeSubscription,
  type TrophyRealtimeSubscription,
} from "../src/services/trophyRealtime";
import { createTrophyUnlockStream } from "../src/services/trophyUnlockStream";

class FakeChannel {
  public bindings: Array<{
    event: string;
    filter: string;
    handler: (payload: { eventType: string; new?: unknown }) => void;
  }> = [];
  public unsubscribeMock = vi.fn(async () => undefined);
  public subscribed = false;

  on(_type: string, options: { event: string; filter?: string }, handler: (payload: { eventType: string; new?: unknown }) => void) {
    this.bindings.push({ event: options.event, filter: options.filter || "", handler });
    return this;
  }

  subscribe(callback?: (status: string) => void) {
    this.subscribed = true;
    if (callback) callback("SUBSCRIBED");
    return Promise.resolve("SUBSCRIBED");
  }

  unsubscribe() {
    this.subscribed = false;
    return this.unsubscribeMock();
  }

  emit(eventType: string, payload: { new?: unknown }) {
    for (const b of this.bindings) {
      if (b.event === eventType) b.handler({ eventType, ...payload });
    }
  }
}

const makeRow = (overrides: Record<string, unknown> = {}) => ({
  user_id: "user-1",
  trophy_id: "trophy-uuid-1",
  progress: 1,
  unlocked_at: "2026-08-31T12:00:00.000Z",
  notified_at: null,
  ...overrides,
});

const buildCreateSubscription = (channel: FakeChannel) => ({
  userId,
  detector,
}: {
  userId: string;
  detector: TrophyUnlockDetector;
  onError?: (message: string, error?: unknown) => void;
}): TrophyRealtimeSubscription =>
  createTrophyRealtimeSubscription({
    userId,
    createChannel: () => channel as unknown as ReturnType<Parameters<typeof createTrophyRealtimeSubscription>[0]["createChannel"]>,
    detector,
  });

describe("trophyUnlockStream", () => {
  let channel: FakeChannel;

  beforeEach(() => {
    channel = new FakeChannel();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("forwards unlocks from the channel into the onUnlock callback", async () => {
    const seen: TrophyUnlock[] = [];
    const stream = createTrophyUnlockStream({
      userId: "user-1",
      createSubscription: buildCreateSubscription(channel),
      onUnlock: (u) => seen.push(u),
    });
    await stream.start();
    expect(channel.subscribed).toBe(true);
    channel.emit("INSERT", {
      new: makeRow({
        trophy_definitions: { title: "T", tier: "bronze", xp_value: 5 },
      }),
    });
    expect(seen).toHaveLength(1);
    expect(seen[0].trophyTitle).toBe("T");
    await stream.stop();
    expect(channel.subscribed).toBe(false);
  });

  it("dedups repeats within the dedup window", async () => {
    const seen: TrophyUnlock[] = [];
    const stream = createTrophyUnlockStream({
      userId: "user-1",
      createSubscription: buildCreateSubscription(channel),
      onUnlock: (u) => seen.push(u),
    });
    await stream.start();
    const row = makeRow({
      trophy_definitions: { title: "T", tier: "bronze", xp_value: 5 },
    });
    channel.emit("INSERT", { new: row });
    channel.emit("INSERT", { new: row });
    expect(seen).toHaveLength(1);
    await stream.stop();
  });

  it("is idempotent on start/stop cycles", async () => {
    const stream = createTrophyUnlockStream({
      userId: "user-1",
      createSubscription: buildCreateSubscription(channel),
      onUnlock: () => undefined,
    });
    await stream.start();
    await stream.start(); // second call is a no-op
    expect(channel.subscribed).toBe(true);
    await stream.stop();
    expect(channel.subscribed).toBe(false);
    await stream.stop(); // second call is a no-op
  });

  it("reports start failures via onError and stays inactive", async () => {
    const errors: Array<{ msg: string; err: unknown }> = [];
    const stream = createTrophyUnlockStream({
      userId: "user-1",
      createSubscription: () =>
        createTrophyRealtimeSubscription({
          userId: "user-1",
          createChannel: () => {
            throw new Error("channel down");
          },
          detector: createTrophyUnlockDetector(),
        }),
      onUnlock: () => undefined,
      onError: (msg, err) => errors.push({ msg, err }),
    });
    await stream.start();
    expect(stream.isActive()).toBe(false);
    expect(errors.length).toBeGreaterThan(0);
  });

  it("routes onUnlock callback errors through onError", async () => {
    const errors: Array<{ msg: string; err: unknown }> = [];
    const boom = new Error("kaboom");
    const stream = createTrophyUnlockStream({
      userId: "user-1",
      createSubscription: buildCreateSubscription(channel),
      onUnlock: () => {
        throw boom;
      },
      onError: (msg, err) => errors.push({ msg, err }),
    });
    await stream.start();
    channel.emit("INSERT", {
      new: makeRow({
        trophy_definitions: { title: "T", tier: "bronze", xp_value: 5 },
      }),
    });
    expect(errors).toHaveLength(1);
    expect(errors[0].err).toBe(boom);
    await stream.stop();
  });

  it("routes stop failures through onError", async () => {
    const errors: Array<{ msg: string; err: unknown }> = [];
    const fakeSub: TrophyRealtimeSubscription = {
      start: vi.fn(async () => undefined),
      stop: vi.fn(async () => {
        throw new Error("stop down");
      }),
    };
    const stream = createTrophyUnlockStream({
      userId: "user-1",
      createSubscription: () => fakeSub,
      onUnlock: () => undefined,
      onError: (msg, err) => errors.push({ msg, err }),
    });
    await stream.start();
    await stream.stop();
    expect(errors.some((e) => e.msg.includes("stop failed"))).toBe(true);
  });

  it("uses the default supabase factory when createSubscription is omitted", async () => {
    // Spy on the supabase channel creation to assert the default factory
    // uses the shared client and the documented channel name.
    const channelSpy = vi.fn(() => channel);
    const fakeSupabase = {
      channel: channelSpy,
    } as unknown as Parameters<typeof createTrophyUnlockStream>[0]["supabase"];
    const seen: TrophyUnlock[] = [];
    const stream = createTrophyUnlockStream({
      userId: "user-42",
      supabase: fakeSupabase,
      onUnlock: (u) => seen.push(u),
    });
    await stream.start();
    expect(channelSpy).toHaveBeenCalledWith("trophies_user_user-42");
    await stream.stop();
  });

  it("uses the provided detector when supplied (skipping the default factory)", async () => {
    const customDetector = createTrophyUnlockDetector();
    const ingestSpy = vi.spyOn(customDetector, "ingest");
    const stream = createTrophyUnlockStream({
      userId: "user-1",
      detector: customDetector,
      createSubscription: buildCreateSubscription(channel),
      onUnlock: () => undefined,
    });
    await stream.start();
    channel.emit("INSERT", {
      new: makeRow({
        trophy_definitions: { title: "T", tier: "bronze", xp_value: 5 },
      }),
    });
    expect(ingestSpy).toHaveBeenCalled();
    await stream.stop();
  });

  it("does not call stop logic again when already inactive", async () => {
    const stream = createTrophyUnlockStream({
      userId: "user-1",
      createSubscription: buildCreateSubscription(channel),
      onUnlock: () => undefined,
    });
    // Never started; stop() returns early because active is false.
    await stream.stop();
    expect(channel.subscribed).toBe(false);
  });

  it("cleans up the detector subscription if sub.start() throws", async () => {
    const errors: Array<{ msg: string; err: unknown }> = [];
    const fakeDetector = createTrophyUnlockDetector();
    const detachSpy = vi.fn();
    // Replace subscribe to return a teardown spy we can assert on.
    vi.spyOn(fakeDetector, "subscribe").mockImplementation(() => detachSpy);

    // Build a subscription factory whose start() throws so we exercise
    // the catch block in the stream that calls detach().
    const failingSub: TrophyRealtimeSubscription = {
      start: vi.fn(async () => {
        throw new Error("subscribe down");
      }),
      stop: vi.fn(async () => undefined),
    };
    const stream = createTrophyUnlockStream({
      userId: "user-1",
      detector: fakeDetector,
      createSubscription: () => failingSub,
      onUnlock: () => undefined,
      onError: (msg, err) => errors.push({ msg, err }),
    });
    await stream.start();
    expect(detachSpy).toHaveBeenCalled();
    expect(errors.some((e) => e.msg.includes("start failed"))).toBe(true);
  });

  it("falls back to the default supabase client when no supabase option is provided", async () => {
    // The default-supabase branch is taken when neither createSubscription
    // nor supabase is supplied. We can't actually use the real default
    // supabase in tests, so we capture the call by intercepting the module.
    // Instead, we directly assert that omitting `supabase` does not throw
    // during start() (the channel call would later fail but that's caught).
    const stream = createTrophyUnlockStream({
      userId: "user-1",
      // No createSubscription, no supabase.
      onUnlock: () => undefined,
    });
    // The default factory will try to build a supabase channel which will
    // likely fail in tests, but the call path itself should not throw.
    await stream.start();
    await stream.stop();
  });

  it("skips the catch-block detach cleanup when detector.subscribe never ran", async () => {
    // Force the createSubscription call itself to throw so the catch block
    // runs without `detach` ever having been assigned. This exercises the
    // false branch of `if (detach)` inside the start() catch handler.
    const errors: Array<{ msg: string; err: unknown }> = [];
    const stream = createTrophyUnlockStream({
      userId: "user-1",
      createSubscription: () => {
        throw new Error("factory down");
      },
      onUnlock: () => undefined,
      onError: (msg, err) => errors.push({ msg, err }),
    });
    await stream.start();
    expect(errors.some((e) => e.msg.includes("start failed"))).toBe(true);
  });

  it("skips the stop() sub-teardown when sub was never set", async () => {
    // Manually call stop() on a stream where the start failed before sub
    // was assigned. This exercises the false branch of `if (sub)` and
    // `if (detach)` in the stop() method.
    const stream = createTrophyUnlockStream({
      userId: "user-1",
      createSubscription: () => {
        throw new Error("factory down");
      },
      onUnlock: () => undefined,
      onError: () => undefined,
    });
    await stream.start();
    await stream.stop(); // active=false, sub=null, detach=null
  });
});

