// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, act } from "@testing-library/react";
import { TrophyUnlockToast } from "../src/components/TrophyUnlockToast";
import type { TrophyUnlock } from "../src/services/achievementDetector";

// Capture every call to the stream hook so the test can drive onUnlock
// directly without standing up a real supabase channel.
const captured: Array<{
  userId: string | null;
  onUnlock: (u: TrophyUnlock) => void;
  onError: (msg: string, err?: unknown) => void;
  enabled: boolean;
}> = [];

vi.mock("../src/hooks/useTrophyUnlockStream", () => ({
  useTrophyUnlockStream: (opts: (typeof captured)[number]) => {
    captured.push(opts);
  },
}));

// Shared notify spy — the component reads this via the mocked hook so we
// can always observe the latest call without closure staleness.
let notifySpy = vi.fn();

vi.mock("../src/components/NotificationCenter", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/components/NotificationCenter")>();
  return {
    ...actual,
    useNotification: () => ({
      notify: (...args: unknown[]) => notifySpy(...args),
      preferences: {
        enabled: true,
        soundEnabled: false,
        defaultDuration: 4200,
        showInOverlay: true,
        types: {} as Record<string, { enabled: boolean; duration?: number; sound?: boolean }>,
      },
      updatePreferences: vi.fn(),
      dismissAll: vi.fn(),
    }),
  };
});

// No-op provider wrapper — the mock short-circuits useNotification so we
// do not need the real NotificationProvider tree.
const renderWithProviders = (ui: React.ReactNode) => render(<>{ui}</>);

const sampleUnlock: TrophyUnlock = {
  id: "t-1",
  trophyTitle: "Platina Hunter",
  trophyDescription: "Conclua o jogo sem morrer.",
  tier: "platinum",
  xp: 300,
  unlockedAt: "2026-08-31T12:00:00.000Z",
  iconUrl: "https://cdn.example/trophy.png",
  source: "realtime",
  dedupKey: "realtime:t-1:2026-08-31T12:00:00.000Z",
};

beforeEach(() => {
  captured.length = 0;
  notifySpy = vi.fn();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("TrophyUnlockToast", () => {
  it("does not start the stream when userId is null", () => {
    renderWithProviders(<TrophyUnlockToast userId={null} />);
    expect(captured).toHaveLength(1);
    expect(captured[0].enabled).toBe(false);
    expect(captured[0].userId).toBeNull();
  });

  it("starts the stream with the supplied userId", () => {
    renderWithProviders(<TrophyUnlockToast userId="user-1" />);
    expect(captured).toHaveLength(1);
    expect(captured[0].enabled).toBe(true);
    expect(captured[0].userId).toBe("user-1");
  });

  it("forwards an unlock to the notification center with tier-coloured title", () => {
    renderWithProviders(<TrophyUnlockToast userId="user-1" />);
    const onUnlock = captured[0].onUnlock;
    act(() => {
      onUnlock(sampleUnlock);
    });
    expect(notifySpy).toHaveBeenCalledTimes(1);
    const [description, type, options] = notifySpy.mock.calls[0];
    expect(type).toBe("achievement");
    expect(description).toBe(sampleUnlock.trophyDescription);
    expect(options).toMatchObject({
      title: "Platina · Platina Hunter (+300 XP)",
      imageUrl: sampleUnlock.iconUrl,
      duration: 10000, // platinum gets the longer toast
      metadata: {
        kind: "trophy_unlock",
        tier: "platinum",
        xp: 300,
        source: "realtime",
      },
    });
  });

  it("uses the shorter 8s duration for non-platinum tiers", () => {
    renderWithProviders(<TrophyUnlockToast userId="user-1" />);
    const onUnlock = captured[0].onUnlock;
    act(() => {
      onUnlock({ ...sampleUnlock, tier: "bronze", xp: 15 });
    });
    expect(notifySpy).toHaveBeenCalledTimes(1);
    const [, , options] = notifySpy.mock.calls[0];
    expect(options?.duration).toBe(8000);
    expect(options?.title).toContain("Bronze");
  });

  it("omits the XP suffix when xp is zero (e.g. level-up events)", () => {
    renderWithProviders(<TrophyUnlockToast userId="user-1" />);
    const onUnlock = captured[0].onUnlock;
    act(() => {
      onUnlock({ ...sampleUnlock, xp: 0 });
    });
    expect(notifySpy).toHaveBeenCalledTimes(1);
    const [, , options] = notifySpy.mock.calls[0];
    expect(options?.title as string).not.toContain("+0 XP");
  });

  it("routes stream errors to the onError handler without crashing", () => {
    const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    renderWithProviders(<TrophyUnlockToast userId="user-1" />);
    const onError = captured[0].onError;
    expect(() => onError("[trophyRealtime] channel down", new Error("boom"))).not.toThrow();
    expect(consoleSpy).toHaveBeenCalled();
  });
});
