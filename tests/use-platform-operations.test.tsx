// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import React from "react";
import { renderHook, act } from "@testing-library/react";
import { usePlatformOperations } from "../src/hooks/usePlatformOperations";

vi.mock("../src/services/epic", () => ({
  authenticateEpic: vi.fn().mockResolvedValue({ success: true }),
  syncEpicLibraryToLocal: vi.fn().mockResolvedValue(5),
}));

vi.mock("../src/services/steam", () => ({
  syncSteamLibraryToLocal: vi.fn().mockResolvedValue(10),
  disconnectSteamAccount: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../src/services/platformLifecycle", () => ({
  disconnectPlatform: vi.fn().mockResolvedValue({
    platform: "epic",
    complete: true,
    local: { games: 2, sessions: 1 },
    cloud: { deletedGames: 2 },
  }),
  resumePendingPlatformCleanup: vi.fn().mockResolvedValue([]),
}));

describe("usePlatformOperations hook", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("initializes in idle state and transitions when syncing", async () => {
    const { result } = renderHook(() =>
      usePlatformOperations({ userUid: "user-1" }),
    );

    expect(result.current.operations.epic.status).toBe("idle");
    expect(result.current.operations.steam.status).toBe("idle");

    let syncPromise: Promise<any>;
    await act(async () => {
      syncPromise = result.current.syncPlatform("epic");
    });

    await act(async () => {
      const count = await syncPromise;
      expect(count).toBe(5);
    });

    expect(result.current.operations.epic.status).toBe("idle");
  });

  it("handles disconnect workflow smoothly", async () => {
    const { result } = renderHook(() =>
      usePlatformOperations({ userUid: "user-1" }),
    );

    let disconnectPromise: Promise<any>;
    await act(async () => {
      disconnectPromise = result.current.disconnectPlatform("epic");
    });

    await act(async () => {
      const res = await disconnectPromise;
      expect(res.complete).toBe(true);
    });

    expect(result.current.operations.epic.status).toBe("idle");
  });
});
