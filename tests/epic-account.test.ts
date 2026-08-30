import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  createEpicAccount,
  normalizeAchievementList,
  fetchGraphQLAchievements,
  readLegendaryToken,
  readLegendaryAccountId,
} from "../electron/epic-account.cjs";

describe("epic-account", () => {
  it("returns normalized status when authenticated", async () => {
    const legendary = {
      run: vi.fn().mockResolvedValue(
        JSON.stringify({
          account_id: "epic-acc-123",
          display_name: "GamerEpic",
        }),
      ),
      logout: vi.fn(),
    };

    const account = createEpicAccount({ legendary: legendary as any });
    const status = await account.getStatus();
    expect(status).toEqual({
      authenticated: true,
      accountId: "epic-acc-123",
      displayName: "GamerEpic",
    });
    expect(legendary.run).toHaveBeenCalledWith(["status", "--json"]);
  });

  it("never includes tokens in status or errors", async () => {
    const legendary = {
      run: vi.fn().mockRejectedValue(new Error("token=secret-token-12345 error")),
      logout: vi.fn(),
    };

    const account = createEpicAccount({ legendary: legendary as any });
    const status = await account.getStatus();
    expect(status).toEqual({ authenticated: false });
  });

  it("authenticates valid code and emits progress", async () => {
    const legendary = {
      run: vi.fn().mockResolvedValue("Successfully logged in"),
      logout: vi.fn(),
    };
    const emitProgress = vi.fn();

    const account = createEpicAccount({
      legendary: legendary as any,
      emitProgress,
    });

    const result = await account.authenticate({ code: "valid-auth-code-12345" });
    expect(result).toEqual({ success: true });
    expect(emitProgress).toHaveBeenCalledWith({ phase: "authenticating" });
    expect(legendary.run).toHaveBeenCalledWith([
      "auth",
      "--code",
      "valid-auth-code-12345",
      "-y",
    ]);
  });

  it("rejects invalid auth code schema", async () => {
    const legendary = {
      run: vi.fn(),
      logout: vi.fn(),
    };

    const account = createEpicAccount({ legendary: legendary as any });
    await expect(account.authenticate({ code: "short" })).rejects.toThrow();
    await expect(account.authenticate({ code: "code\nwith\nnewlines" })).rejects.toThrow();
    expect(legendary.run).not.toHaveBeenCalled();
  });

  it("returns a normalized library without raw Legendary fields", async () => {
    const rawGames = [
      {
        app_name: "Fortnite",
        app_title: "Fortnite",
        metadata: {
          id: "fn-catalog-id",
          namespace: "fn-namespace",
          description: "Battle Royale Game",
          keyImages: [
            { type: "DieselGameBoxTall", url: "https://image.epic.com/cover.jpg" },
          ],
        },
      },
    ];

    const legendary = {
      run: vi.fn().mockResolvedValue(JSON.stringify(rawGames)),
      logout: vi.fn(),
    };
    const emitProgress = vi.fn();

    const account = createEpicAccount({
      legendary: legendary as any,
      emitProgress,
    });

    const library = await account.listLibrary();
    expect(emitProgress).toHaveBeenCalledWith({ phase: "reading-library" });
    expect(library).toEqual([
      {
        appName: "Fortnite",
        title: "Fortnite",
        catalogId: "fn-catalog-id",
        namespace: "fn-namespace",
        description: "Battle Royale Game",
        keyImages: [
          { type: "DieselGameBoxTall", url: "https://image.epic.com/cover.jpg" },
        ],
      },
    ]);
  });

  it("normalizes achievement list and handles missing achievements safely", async () => {
    const rawAchievements = {
      total_achievements: 2,
      user_unlocked: 1,
      achievements: [
        {
          name: "ACH_1",
          display_name: "First Kill",
          description: "Defeat an enemy",
          unlocked: true,
          unlock_date: "2026-08-01T12:00:00Z",
          icon_url: "https://icon.com/1.png",
          hidden: false,
        },
        {
          name: "ACH_2",
          display_name: "Secret Master",
          description: "Hidden victory",
          unlocked: false,
          icon_url: "https://icon.com/2.png",
          hidden: true,
        },
      ],
    };

    const legendary = {
      run: vi.fn().mockResolvedValue(JSON.stringify(rawAchievements)),
      logout: vi.fn(),
    };

    const account = createEpicAccount({ legendary: legendary as any });
    const result = await account.getAchievements({ appName: "Fortnite" });

    expect(result.total).toBe(2);
    expect(result.completed).toBe(1);
    expect(result.list).toHaveLength(2);
    expect(result.list[0]).toMatchObject({
      apiName: "ACH_1",
      name: "First Kill",
      achieved: true,
    });
  });

  it("performs safe logout", async () => {
    const legendary = {
      run: vi.fn(),
      logout: vi.fn().mockResolvedValue(undefined),
    };

    const account = createEpicAccount({ legendary: legendary as any });
    const result = await account.logout();
    expect(result).toEqual({ success: true });
    expect(legendary.logout).toHaveBeenCalled();
  });

  it("returns empty when appName is missing", async () => {
    const legendary = { run: vi.fn(), logout: vi.fn() };
    const account = createEpicAccount({ legendary: legendary as any });
    const result = await account.getAchievements({});
    expect(result).toEqual({ total: 0, completed: 0, list: [] });
  });

  it("uses cache when available and skips API calls", async () => {
    const cachedData = {
      total: 3,
      completed: 1,
      list: [
        { apiName: "CACHED_ACH", name: "Cached Achievement", achieved: false, unlockTime: 0, icon: "", iconGray: "", hidden: false },
      ],
    };
    const cache = {
      readCache: vi.fn().mockResolvedValue(cachedData),
      writeCache: vi.fn(),
    };
    const legendary = { run: vi.fn(), logout: vi.fn() };

    const account = createEpicAccount({
      legendary: legendary as any,
      achievementsCache: cache as any,
    });
    const result = await account.getAchievements({ appName: "Fortnite" });

    expect(result).toEqual(cachedData);
    expect(cache.readCache).toHaveBeenCalledWith("Fortnite");
    expect(legendary.run).not.toHaveBeenCalled();
  });

  it("falls back to GraphQL when Legendary returns no achievements", async () => {
    const legendary = {
      run: vi.fn().mockRejectedValue(new Error("command not found")),
      logout: vi.fn(),
    };
    const cache = {
      readCache: vi.fn().mockResolvedValue(null),
      writeCache: vi.fn(),
    };

    const account = createEpicAccount({
      legendary: legendary as any,
      achievementsCache: cache as any,
    });

    const result = await account.getAchievements({
      appName: "Fortnite",
      sandboxId: "sandbox-123",
    });

    expect(result.total).toBe(0);
    expect(cache.writeCache).not.toHaveBeenCalled();
  });

  it("writes results to cache after successful fetch", async () => {
    const rawAchievements = {
      total_achievements: 1,
      user_unlocked: 1,
      achievements: [
        {
          name: "ACH_1",
          display_name: "First",
          unlocked: true,
          unlock_date: "2026-08-01T12:00:00Z",
          icon_url: "https://icon.com/1.png",
          hidden: false,
        },
      ],
    };
    const legendary = {
      run: vi.fn().mockResolvedValue(JSON.stringify(rawAchievements)),
      logout: vi.fn(),
    };
    const cache = {
      readCache: vi.fn().mockResolvedValue(null),
      writeCache: vi.fn(),
    };

    const account = createEpicAccount({
      legendary: legendary as any,
      achievementsCache: cache as any,
    });
    await account.getAchievements({ appName: "Fortnite" });

    expect(cache.writeCache).toHaveBeenCalledWith(
      "Fortnite",
      expect.objectContaining({ total: 1, completed: 1 }),
    );
  });
});

describe("normalizeAchievementList", () => {
  it("deduplicates achievements by apiName", () => {
    const raw = [
      { name: "ACH_1", display_name: "First" },
      { name: "ACH_1", display_name: "First Duplicate" },
      { name: "ACH_2", display_name: "Second" },
    ];
    const result = normalizeAchievementList(raw);
    expect(result).toHaveLength(2);
    expect(result[0].apiName).toBe("ACH_1");
    expect(result[1].apiName).toBe("ACH_2");
  });

  it("handles GraphQL-style field names", () => {
    const raw = [
      {
        achievementName: "GQL_ACH",
        unlockedDisplayName: "GraphQL Achievement",
        unlockedDescription: "Unlocked desc",
        lockedDescription: "Locked desc",
        unlockedIconLink: "https://icon.com/unlocked.png",
        lockedIconLink: "https://icon.com/locked.png",
        hidden: true,
        unlocked: true,
        unlockDate: "2026-01-15T10:30:00Z",
      },
    ];
    const result = normalizeAchievementList(raw);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      apiName: "GQL_ACH",
      name: "GraphQL Achievement",
      description: "Unlocked desc",
      icon: "https://icon.com/unlocked.png",
      iconGray: "https://icon.com/locked.png",
      hidden: true,
      achieved: true,
    });
  });

  it("returns empty for empty input", () => {
    expect(normalizeAchievementList([])).toEqual([]);
    expect(normalizeAchievementList(null as any)).toEqual([]);
  });
});

describe("epic-account GraphQL fallback chain", () => {
  it("tries Legendary first, then GraphQL, then returns empty", async () => {
    const legendary = {
      run: vi.fn().mockRejectedValue(new Error("not supported")),
      logout: vi.fn(),
    };
    const emitProgress = vi.fn();

    const account = createEpicAccount({
      legendary: legendary as any,
      emitProgress,
    });

    const result = await account.getAchievements({
      appName: "TestGame",
      sandboxId: "test-sandbox",
    });

    expect(result).toEqual({ total: 0, completed: 0, list: [] });
    expect(legendary.run).toHaveBeenCalledWith([
      "achievements",
      "TestGame",
      "--json",
    ]);
  });

  it("emits reading-achievements-graphql phase when falling back to GraphQL", async () => {
    const legendary = {
      run: vi.fn().mockRejectedValue(new Error("not supported")),
      logout: vi.fn(),
    };
    const emitProgress = vi.fn();

    const account = createEpicAccount({
      legendary: legendary as any,
      emitProgress,
    });

    await account.getAchievements({
      appName: "TestGame",
      sandboxId: "test-sandbox",
    });

    expect(emitProgress).toHaveBeenCalledWith({ phase: "reading-achievements" });
  });
});
