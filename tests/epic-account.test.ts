import { describe, expect, it, vi } from "vitest";
import { createEpicAccount } from "../electron/epic-account.cjs";

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
});
