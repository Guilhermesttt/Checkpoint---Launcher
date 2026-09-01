// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type { TrophyUnlock } from "../src/services/achievementDetector";

// Mock the service that owns the Supabase channel + detector so the hook
// only needs to test React lifecycle + IPC wiring.
vi.mock("../src/services/trophyUnlockStream", () => {
  const start = vi.fn().mockResolvedValue(undefined);
  const stop = vi.fn().mockResolvedValue(undefined);
  const stream = { start, stop };
  return {
    createTrophyUnlockStream: vi.fn(() => stream),
    __stream: stream,
  };
});

// Imported lazily so the mock above is registered first.
async function setupHook() {
  const { useTrophyUnlockStream } = await import("../src/hooks/useTrophyUnlockStream");
  const mod = await import("../src/services/trophyUnlockStream");
  return { useTrophyUnlockStream, __stream: mod.__stream as { start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn> } };
}

const sampleUnlock: TrophyUnlock = {
  id: "trophy-1",
  trophyTitle: "Primeira Platina",
  trophyDescription: "Conclua o jogo",
  tier: "platinum",
  xp: 300,
  unlockedAt: "2026-08-31T00:00:00Z",
  source: "realtime",
};

beforeEach(() => {
  // @ts-expect-error – test scaffolding for window.checkpoint
  globalThis.window = globalThis.window ?? {};
  // @ts-expect-error – test scaffolding
  globalThis.window.checkpoint = undefined;
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("useTrophyUnlockStream", () => {
  it("does nothing when userId is null", async () => {
    const { useTrophyUnlockStream, __stream } = await setupHook();
    renderHook(() => useTrophyUnlockStream({ userId: null }));
    expect(__stream.start).not.toHaveBeenCalled();
    expect(__stream.stop).not.toHaveBeenCalled();
  });

  it("does nothing when enabled is false", async () => {
    const { useTrophyUnlockStream, __stream } = await setupHook();
    renderHook(() => useTrophyUnlockStream({ userId: "user-1", enabled: false }));
    expect(__stream.start).not.toHaveBeenCalled();
  });

  it("starts the stream when userId becomes available", async () => {
    const { useTrophyUnlockStream, __stream } = await setupHook();
    renderHook(() => useTrophyUnlockStream({ userId: "user-1" }));
    expect(__stream.start).toHaveBeenCalledTimes(1);
  });

  it("stops the stream on unmount", async () => {
    const { useTrophyUnlockStream, __stream } = await setupHook();
    const { unmount } = renderHook(() => useTrophyUnlockStream({ userId: "user-1" }));
    unmount();
    expect(__stream.stop).toHaveBeenCalledTimes(1);
  });

  it("stops the previous stream when userId changes", async () => {
    const { useTrophyUnlockStream, __stream } = await setupHook();
    const { rerender } = renderHook(
      ({ userId }: { userId: string | null }) => useTrophyUnlockStream({ userId }),
      { initialProps: { userId: "user-1" as string | null } },
    );
    rerender({ userId: "user-2" });
    expect(__stream.start).toHaveBeenCalledTimes(2);
    expect(__stream.stop).toHaveBeenCalledTimes(1);
  });

  it("forwards unlocks to the in-page onUnlock callback", async () => {
    const { useTrophyUnlockStream, __stream } = await setupHook();
    const onUnlock = vi.fn();
    renderHook(() => useTrophyUnlockStream({ userId: "user-1", onUnlock }));

    // Grab the onUnlock handler the hook installed on the stream and
    // invoke it with a sample trophy.
    const factory = (await import("../src/services/trophyUnlockStream")).createTrophyUnlockStream as unknown as ReturnType<typeof vi.fn>;
    const handler = factory.mock.calls.at(-1)![0].onUnlock as (u: TrophyUnlock) => void;
    handler(sampleUnlock);
    expect(onUnlock).toHaveBeenCalledWith(sampleUnlock);
  });

  it("invokes the system push IPC when checkpoint is exposed", async () => {
    const notify = vi.fn().mockResolvedValue({ shown: true });
    // @ts-expect-error – global side effect
    globalThis.window.checkpoint = { notifyTrophyUnlock: notify };

    const { useTrophyUnlockStream } = await setupHook();
    renderHook(() => useTrophyUnlockStream({ userId: "user-1" }));

    const factory = (await import("../src/services/trophyUnlockStream")).createTrophyUnlockStream as unknown as ReturnType<typeof vi.fn>;
    const handler = factory.mock.calls.at(-1)![0].onUnlock as (u: TrophyUnlock) => void;
    handler(sampleUnlock);
    expect(notify).toHaveBeenCalledWith({
      trophyTitle: sampleUnlock.trophyTitle,
      trophyDescription: sampleUnlock.trophyDescription,
      tier: sampleUnlock.tier,
      xp: sampleUnlock.xp,
      iconUrl: sampleUnlock.iconUrl,
    });
  });

  it("does not throw when window.checkpoint is absent", async () => {
    const { useTrophyUnlockStream } = await setupHook();
    renderHook(() => useTrophyUnlockStream({ userId: "user-1" }));
    const factory = (await import("../src/services/trophyUnlockStream")).createTrophyUnlockStream as unknown as ReturnType<typeof vi.fn>;
    const handler = factory.mock.calls.at(-1)![0].onUnlock as (u: TrophyUnlock) => void;
    expect(() => handler(sampleUnlock)).not.toThrow();
  });

  it("swallows rejections from the system-push IPC", async () => {
    const onError = vi.fn();
    const reject = vi.fn().mockRejectedValue(new Error("ipc boom"));
    // @ts-expect-error – global side effect
    globalThis.window.checkpoint = { notifyTrophyUnlock: reject };

    const { useTrophyUnlockStream } = await setupHook();
    renderHook(() => useTrophyUnlockStream({ userId: "user-1", onError }));
    const factory = (await import("../src/services/trophyUnlockStream")).createTrophyUnlockStream as unknown as ReturnType<typeof vi.fn>;
    const handler = factory.mock.calls.at(-1)![0].onUnlock as (u: TrophyUnlock) => void;
    await act(async () => {
      handler(sampleUnlock);
      // Flush the floating .catch microtask.
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(reject).toHaveBeenCalled();
    // The hook must NOT surface the IPC failure as a stream error — the
    // system push is best-effort, not a source of truth.
    expect(onError).not.toHaveBeenCalled();
  });

  it("routes onUnlock callback exceptions to onError", async () => {
    const onError = vi.fn();
    const boom = new Error("boom");
    const { useTrophyUnlockStream } = await setupHook();
    renderHook(() =>
      useTrophyUnlockStream({
        userId: "user-1",
        onUnlock: () => {
          throw boom;
        },
        onError,
      }),
    );
    const factory = (await import("../src/services/trophyUnlockStream")).createTrophyUnlockStream as unknown as ReturnType<typeof vi.fn>;
    const handler = factory.mock.calls.at(-1)![0].onUnlock as (u: TrophyUnlock) => void;
    handler(sampleUnlock);
    expect(onError).toHaveBeenCalledWith(expect.stringContaining("onUnlock threw"), boom);
  });

  it("stops the stream when userId transitions to null", async () => {
    const { useTrophyUnlockStream, __stream } = await setupHook();
    const { rerender } = renderHook(
      ({ userId }: { userId: string | null }) => useTrophyUnlockStream({ userId }),
      { initialProps: { userId: "user-1" as string | null } },
    );
    expect(__stream.start).toHaveBeenCalledTimes(1);
    rerender({ userId: null });
    expect(__stream.stop).toHaveBeenCalledTimes(1);
  });

  it("routes stream onError callbacks to the hook's onError", async () => {
    const onError = vi.fn();
    const { useTrophyUnlockStream } = await setupHook();
    renderHook(() => useTrophyUnlockStream({ userId: "user-1", onError }));
    const factory = (await import("../src/services/trophyUnlockStream")).createTrophyUnlockStream as unknown as ReturnType<typeof vi.fn>;
    const onErrorFromStream = factory.mock.calls.at(-1)![0].onError as (
      msg: string,
      err: unknown,
    ) => void;
    const sentinel = new Error("realtime down");
    onErrorFromStream("[trophyRealtime] channel status: ERROR", sentinel);
    expect(onError).toHaveBeenCalledWith(
      expect.stringContaining("channel status"),
      sentinel,
    );
  });
});

describe("useTrophyUnlockStream — historyClient integration (T3.5)", () => {
  const realUuid = "11111111-2222-3333-4444-555555555555";
  const realUuid2 = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
  const bridgeUnlock: TrophyUnlock = {
    id: "fortnite:ach_battle_royale_win",
    trophyTitle: "Vitória Royale",
    trophyDescription: "Vença uma partida de Battle Royale",
    tier: "gold",
    xp: 120,
    unlockedAt: "2026-08-31T01:00:00Z",
    source: "bridge",
  };

  const makeHistoryClient = () => ({
    upsertTrophyProgress: vi.fn().mockResolvedValue({ id: "row-1" }),
    fetchTrophies: vi.fn(),
    fetchXpEvents: vi.fn(),
    fetchStats: vi.fn(),
    fetchLevel: vi.fn(),
  });

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("schedules a debounced upsert when historyClient is provided", async () => {
    const client = makeHistoryClient();
    const { useTrophyUnlockStream } = await setupHook();
    renderHook(() =>
      useTrophyUnlockStream({
        userId: "user-1",
        historyClient: client,
        historyDebounceMs: 2000,
      }),
    );
    const factory = (await import("../src/services/trophyUnlockStream")).createTrophyUnlockStream as unknown as ReturnType<typeof vi.fn>;
    const handler = factory.mock.calls.at(-1)![0].onUnlock as (u: TrophyUnlock) => void;
    handler({ ...sampleUnlock, id: realUuid });
    // Not yet — the debounce is still pending.
    expect(client.upsertTrophyProgress).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(2000);
    expect(client.upsertTrophyProgress).toHaveBeenCalledTimes(1);
    expect(client.upsertTrophyProgress).toHaveBeenCalledWith(
      "user-1",
      realUuid,
      1,
      expect.objectContaining({ source: "realtime", tier: "platinum" }),
    );
  });

  it("coalesces multiple unlocks of the same trophy into a single upsert", async () => {
    const client = makeHistoryClient();
    const { useTrophyUnlockStream } = await setupHook();
    renderHook(() =>
      useTrophyUnlockStream({
        userId: "user-1",
        historyClient: client,
        historyDebounceMs: 2000,
      }),
    );
    const factory = (await import("../src/services/trophyUnlockStream")).createTrophyUnlockStream as unknown as ReturnType<typeof vi.fn>;
    const handler = factory.mock.calls.at(-1)![0].onUnlock as (u: TrophyUnlock) => void;
    handler({ ...sampleUnlock, id: realUuid });
    await vi.advanceTimersByTimeAsync(800);
    handler({ ...sampleUnlock, id: realUuid });
    await vi.advanceTimersByTimeAsync(800);
    handler({ ...sampleUnlock, id: realUuid });
    // Still pending — the third unlock reset the debounce window.
    expect(client.upsertTrophyProgress).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(2000);
    expect(client.upsertTrophyProgress).toHaveBeenCalledTimes(1);
  });

  it("fires one upsert per trophy when several distinct trophies unlock in parallel", async () => {
    const client = makeHistoryClient();
    const { useTrophyUnlockStream } = await setupHook();
    renderHook(() =>
      useTrophyUnlockStream({
        userId: "user-1",
        historyClient: client,
        historyDebounceMs: 2000,
      }),
    );
    const factory = (await import("../src/services/trophyUnlockStream")).createTrophyUnlockStream as unknown as ReturnType<typeof vi.fn>;
    const handler = factory.mock.calls.at(-1)![0].onUnlock as (u: TrophyUnlock) => void;
    handler({ ...sampleUnlock, id: realUuid });
    handler({ ...sampleUnlock, id: realUuid2 });
    await vi.advanceTimersByTimeAsync(2000);
    expect(client.upsertTrophyProgress).toHaveBeenCalledTimes(2);
    const trophyIds = client.upsertTrophyProgress.mock.calls.map((c) => c[1]);
    expect(trophyIds).toContain(realUuid);
    expect(trophyIds).toContain(realUuid2);
  });

  it("skips upsert for non-UUID unlock ids (bridge / level sources)", async () => {
    const client = makeHistoryClient();
    const { useTrophyUnlockStream } = await setupHook();
    renderHook(() =>
      useTrophyUnlockStream({
        userId: "user-1",
        historyClient: client,
        historyDebounceMs: 2000,
      }),
    );
    const factory = (await import("../src/services/trophyUnlockStream")).createTrophyUnlockStream as unknown as ReturnType<typeof vi.fn>;
    const handler = factory.mock.calls.at(-1)![0].onUnlock as (u: TrophyUnlock) => void;
    handler(bridgeUnlock);
    await vi.advanceTimersByTimeAsync(2000);
    expect(client.upsertTrophyProgress).not.toHaveBeenCalled();
  });

  it("cancels pending debounced upserts on unmount", async () => {
    const client = makeHistoryClient();
    const { useTrophyUnlockStream } = await setupHook();
    const { unmount } = renderHook(() =>
      useTrophyUnlockStream({
        userId: "user-1",
        historyClient: client,
        historyDebounceMs: 2000,
      }),
    );
    const factory = (await import("../src/services/trophyUnlockStream")).createTrophyUnlockStream as unknown as ReturnType<typeof vi.fn>;
    const handler = factory.mock.calls.at(-1)![0].onUnlock as (u: TrophyUnlock) => void;
    handler({ ...sampleUnlock, id: realUuid });
    unmount();
    await vi.advanceTimersByTimeAsync(5000);
    expect(client.upsertTrophyProgress).not.toHaveBeenCalled();
  });

  it("routes upsert failures to the hook's onError", async () => {
    const client = makeHistoryClient();
    client.upsertTrophyProgress.mockRejectedValueOnce(new Error("rls denial"));
    const onError = vi.fn();
    const { useTrophyUnlockStream } = await setupHook();
    renderHook(() =>
      useTrophyUnlockStream({
        userId: "user-1",
        historyClient: client,
        historyDebounceMs: 100,
        onError,
      }),
    );
    const factory = (await import("../src/services/trophyUnlockStream")).createTrophyUnlockStream as unknown as ReturnType<typeof vi.fn>;
    const handler = factory.mock.calls.at(-1)![0].onUnlock as (u: TrophyUnlock) => void;
    handler({ ...sampleUnlock, id: realUuid });
    await vi.advanceTimersByTimeAsync(200);
    // Flush the floating Promise rejection so the .catch microtask runs.
    await Promise.resolve();
    await Promise.resolve();
    expect(client.upsertTrophyProgress).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(
      expect.stringContaining(`history upsert failed for ${realUuid}`),
      expect.objectContaining({ message: "rls denial" }),
    );
  });

  it("does nothing when historyClient is omitted", async () => {
    const { useTrophyUnlockStream } = await setupHook();
    renderHook(() => useTrophyUnlockStream({ userId: "user-1" }));
    const factory = (await import("../src/services/trophyUnlockStream")).createTrophyUnlockStream as unknown as ReturnType<typeof vi.fn>;
    const handler = factory.mock.calls.at(-1)![0].onUnlock as (u: TrophyUnlock) => void;
    handler({ ...sampleUnlock, id: realUuid });
    await vi.advanceTimersByTimeAsync(5000);
    // No assertion against a mock — the test is that the hook does not
    // throw and does not try to import the history client. The mock factory
    // is called once for the stream; no second call should have happened.
    expect(factory).toHaveBeenCalledTimes(1);
  });
});
