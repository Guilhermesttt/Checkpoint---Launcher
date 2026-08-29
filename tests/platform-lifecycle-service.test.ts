// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { disconnectPlatform, resumePendingPlatformCleanup } from "../src/services/platformLifecycle";
import { supabase } from "../src/services/supabase";

vi.mock("../src/services/supabase", () => ({
  supabase: {
    rpc: vi.fn(),
    from: vi.fn().mockReturnValue({
      upsert: vi.fn().mockResolvedValue({ error: null }),
      select: vi.fn().mockResolvedValue({ data: [], error: null }),
    }),
  },
}));

vi.mock("../src/services/steam", () => ({
  disconnectSteamAccount: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../src/services/localLibrary", () => ({
  syncPublicLibrarySummary: vi.fn().mockResolvedValue(true),
}));

describe("platformLifecycle service", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("completes every cleanup phase in strict order before reporting success", async () => {
    const callOrder: string[] = [];

    const mockApi = {
      setPlatformCleanupPhase: vi.fn().mockImplementation((_uid, _plat, _opId, phase) => {
        callOrder.push(`journal:${phase}`);
        return Promise.resolve();
      }),
      logoutEpic: vi.fn().mockImplementation(() => {
        callOrder.push("revoke");
        return Promise.resolve({ success: true });
      }),
      purgeLocalPlatformData: vi.fn().mockImplementation(() => {
        callOrder.push("local");
        return Promise.resolve({
          games: 1,
          sessions: 1,
          gameIds: ["epic-1"],
          steamAppIds: [],
          epicCatalogIds: ["epic-cat-1"],
          deletedFiles: [],
        });
      }),
      completePlatformCleanup: vi.fn().mockImplementation(() => {
        callOrder.push("complete");
        return Promise.resolve();
      }),
    };

    (supabase.rpc as any).mockImplementation(() => {
      callOrder.push("cloud");
      return Promise.resolve({ data: { deletedGames: 1 }, error: null });
    });

    Object.defineProperty(window, "electronAPI", {
      value: mockApi,
      configurable: true,
      writable: true,
    });

    const result = await disconnectPlatform({
      uid: "user-1",
      platform: "epic",
      operationId: "op-1",
    });

    expect(result.complete).toBe(true);
    expect(callOrder).toEqual([
      "journal:revoking-account",
      "revoke",
      "journal:removing-local-data",
      "local",
      "journal:removing-cloud-data",
      "cloud",
      "journal:refreshing-profile",
      "complete",
    ]);
  });

  it("retries safely when cloud call fails and then succeeds", async () => {
    const mockApi = {
      setPlatformCleanupPhase: vi.fn().mockResolvedValue(undefined),
      logoutEpic: vi.fn().mockResolvedValue({ success: true }),
      purgeLocalPlatformData: vi.fn().mockResolvedValue({
        games: 0,
        sessions: 0,
        gameIds: [],
        steamAppIds: [],
        epicCatalogIds: [],
        deletedFiles: [],
      }),
      completePlatformCleanup: vi.fn().mockResolvedValue(undefined),
    };

    Object.defineProperty(window, "electronAPI", {
      value: mockApi,
      configurable: true,
      writable: true,
    });

    (supabase.rpc as any)
      .mockResolvedValueOnce({ data: null, error: new Error("Network error") })
      .mockResolvedValueOnce({ data: { deletedGames: 0 }, error: null });

    await expect(
      disconnectPlatform({
        uid: "user-1",
        platform: "epic",
        operationId: "op-1",
      }),
    ).rejects.toThrow("Nao foi possivel concluir a remocao");

    const secondTry = await disconnectPlatform({
      uid: "user-1",
      platform: "epic",
      operationId: "op-1",
    });
    expect(secondTry.complete).toBe(true);
  });
});
