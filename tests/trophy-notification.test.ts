import { describe, expect, it, vi } from "vitest";
import { showTrophyNotification, createDefaultDeps } from "../electron/trophy-notification.cjs";

class FakeNotification {
  static calls: Array<{ title: string; body: string; icon?: string; silent?: boolean }> = [];
  lastInstance: { title: string; body: string; icon?: string; silent?: boolean };
  showCount = 0;
  constructor(opts: { title: string; body: string; icon?: string; silent?: boolean }) {
    this.lastInstance = opts;
    FakeNotification.calls.push(opts);
  }
  show() {
    this.showCount += 1;
  }
}

const baseInput = {
  trophyTitle: "First Trophy",
  trophyDescription: "You unlocked your first trophy.",
  tier: "gold" as const,
  xp: 90,
  iconUrl: "https://example.com/icon.png",
};

describe("trophy-notification (Electron push)", () => {
  it("shows a system notification when the window is hidden", () => {
    FakeNotification.calls = [];
    const result = showTrophyNotification(baseInput, {
      NotificationCtor: FakeNotification as unknown as typeof Notification,
      isWindowVisible: () => false,
    });
    expect(result.shown).toBe(true);
    expect(FakeNotification.calls).toHaveLength(1);
    const call = FakeNotification.calls[0];
    expect(call.title).toContain("Gold");
    expect(call.title).toContain("First Trophy");
    expect(call.body).toContain("+90 XP");
    expect(call.icon).toBe("https://example.com/icon.png");
  });

  it("skips the system notification when the window is visible", () => {
    FakeNotification.calls = [];
    const result = showTrophyNotification(baseInput, {
      NotificationCtor: FakeNotification as unknown as typeof Notification,
      isWindowVisible: () => true,
    });
    expect(result.shown).toBe(false);
    expect(result.reason).toBe("window-visible");
    expect(FakeNotification.calls).toHaveLength(0);
  });

  it("returns missing-ctor when no Notification constructor is supplied", () => {
    const result = showTrophyNotification(baseInput, {
      // @ts-expect-error - intentionally bad input
      NotificationCtor: undefined,
      isWindowVisible: () => false,
    });
    expect(result.shown).toBe(false);
    expect(result.reason).toBe("missing NotificationCtor");
  });

  it("catches constructor throws and reports failure", () => {
    const logger = vi.fn();
    const result = showTrophyNotification(baseInput, {
      NotificationCtor: (() => {
        throw new Error("boom");
      }) as unknown as typeof Notification,
      isWindowVisible: () => false,
      logger,
    });
    expect(result.shown).toBe(false);
    expect(result.reason).toBe("throw");
    expect(logger).toHaveBeenCalled();
  });

  it("falls back to bronze when an unknown tier is passed", () => {
    FakeNotification.calls = [];
    showTrophyNotification(
      { ...baseInput, tier: "mythic" as unknown as "gold" },
      {
        NotificationCtor: FakeNotification as unknown as typeof Notification,
        isWindowVisible: () => false,
      },
    );
    expect(FakeNotification.calls[0].title).toContain("Bronze");
  });
});

describe("trophy-notification createDefaultDeps", () => {
  it("returns isWindowVisible=false when no BrowserWindow is supplied", () => {
    const deps = createDefaultDeps();
    expect(deps.isWindowVisible()).toBe(false);
  });

  it("returns isWindowVisible=false when BrowserWindow.getAllWindows throws", () => {
    const deps = createDefaultDeps({
      BrowserWindow: {
        getAllWindows: () => {
          throw new Error("boom");
        },
      } as unknown as Electron.BrowserWindow,
    });
    expect(deps.isWindowVisible()).toBe(false);
  });

  it("returns isWindowVisible=false when there are no windows", () => {
    const deps = createDefaultDeps({
      BrowserWindow: {
        getAllWindows: () => [],
      } as unknown as Electron.BrowserWindow,
    });
    expect(deps.isWindowVisible()).toBe(false);
  });

  it("returns isWindowVisible=false when all windows are destroyed", () => {
    const win = {
      isDestroyed: () => true,
      isFocused: () => false,
      isVisible: () => true,
    };
    const deps = createDefaultDeps({
      BrowserWindow: {
        getAllWindows: () => [win],
      } as unknown as Electron.BrowserWindow,
    });
    expect(deps.isWindowVisible()).toBe(false);
  });

  it("returns isWindowVisible=true when a window is focused", () => {
    const win = {
      isDestroyed: () => false,
      isFocused: () => true,
      isVisible: () => false,
    };
    const deps = createDefaultDeps({
      BrowserWindow: {
        getAllWindows: () => [win],
      } as unknown as Electron.BrowserWindow,
    });
    expect(deps.isWindowVisible()).toBe(true);
  });

  it("returns isWindowVisible=true when a window is visible (not focused)", () => {
    const win = {
      isDestroyed: () => false,
      isFocused: () => false,
      isVisible: () => true,
    };
    const deps = createDefaultDeps({
      BrowserWindow: {
        getAllWindows: () => [win],
      } as unknown as Electron.BrowserWindow,
    });
    expect(deps.isWindowVisible()).toBe(true);
  });

  it("returns isWindowVisible=false when BrowserWindow lacks getAllWindows", () => {
    const deps = createDefaultDeps({
      BrowserWindow: {} as unknown as Electron.BrowserWindow,
    });
    expect(deps.isWindowVisible()).toBe(false);
  });

  it("returns NotificationCtor=undefined when electron is unavailable", () => {
    // In the test runtime electron is not installed; require() throws and
    // createDefaultDeps must swallow it.
    const deps = createDefaultDeps();
    expect(deps.NotificationCtor).toBeUndefined();
  });
});
