import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
import { afterEach, describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const { createLocalGameLibrary } = require("../electron/local-game-library.cjs") as {
  createLocalGameLibrary: (directory: string) => {
    create: (uid: string, game: Record<string, unknown>) => Record<string, unknown>;
    update: (uid: string, id: string, patch: Record<string, unknown>) => void;
    list: (uid: string) => Array<Record<string, unknown>>;
    bulkUpsert: (
      uid: string,
      games: Array<Record<string, unknown>>,
    ) => Array<Record<string, unknown>>;
    getSummary: (uid: string) => {
      stats: { games: number; minutesPlayed: number; favorites: number };
      topGames: Array<{ id: string; minutesPlayed: number; imageUrl: string }>;
      revision: number;
      dirty: boolean;
    };
    markSummarySynced: (uid: string, revision: number) => void;
    close: () => void;
  };
};

const temporaryDirectories: string[] = [];
afterEach(() => {
  temporaryDirectories.splice(0).forEach((directory) =>
    rmSync(directory, { recursive: true, force: true }));
});

describe("biblioteca SQLite", () => {
  it("persiste jogos e produz um resumo compacto sem imagens base64", () => {
    const directory = mkdtempSync(join(tmpdir(), "checkpoint-library-"));
    temporaryDirectories.push(directory);
    const library = createLocalGameLibrary(directory);
    library.create("alice", {
      id: "steam:730",
      title: "Counter-Strike 2",
      launcherType: "steam",
      steamAppId: "730",
      steamPlaytimeMinutes: 120,
      locallyTrackedMinutes: 150,
      hoursPlayed: 2.5,
      isFavorite: true,
      cardImage: "data:image/webp;base64,AAAA",
      totalAchievements: 10,
      completedAchievements: 4,
    });

    const summary = library.getSummary("alice");
    expect(summary.stats).toEqual({
      games: 1,
      minutesPlayed: 150,
      favorites: 1,
    });
    expect(summary.topGames[0]).toMatchObject({
      id: "steam:730",
      minutesPlayed: 150,
      imageUrl: "",
    });
    expect(summary.dirty).toBe(true);

    library.markSummarySynced("alice", summary.revision);
    expect(library.getSummary("alice").dirty).toBe(false);
    library.close();
  });

  it("faz upsert Steam pelo app id sem apagar preferencias locais", () => {
    const directory = mkdtempSync(join(tmpdir(), "checkpoint-library-"));
    temporaryDirectories.push(directory);
    const library = createLocalGameLibrary(directory);
    library.create("alice", {
      id: "manual-game",
      title: "Portal",
      launcherType: "steam",
      steamAppId: "400",
      isFavorite: true,
    });
    library.bulkUpsert("alice", [{
      id: "generated-steam-id",
      title: "Portal Updated",
      launcherType: "steam",
      steamAppId: "400",
      steamPlaytimeMinutes: 60,
    }]);

    expect(library.list("alice")).toEqual([
      expect.objectContaining({
        id: "manual-game",
        title: "Portal Updated",
        isFavorite: true,
        steamPlaytimeMinutes: 60,
      }),
    ]);
    library.close();
  });

  it("purges only matching games and their sessions", () => {
    const directory = mkdtempSync(join(tmpdir(), "checkpoint-library-"));
    temporaryDirectories.push(directory);
    const library = createLocalGameLibrary(directory);

    const steamGame = { id: "steam-1", title: "Steam Game", launcherType: "steam", steamAppId: "730" };
    const epicGame = { id: "epic-1", title: "Epic Game", launcherType: "epic", epicCatalogId: "fn-cat" };
    const localGame = { id: "local-1", title: "Local Game", launcherType: "local", steamAppId: "730" };

    library.create("alice", steamGame);
    library.create("alice", epicGame);
    library.create("alice", localGame);

    const validSession = {
      startedAt: new Date(Date.now() - 3600000).toISOString(),
      endedAt: new Date().toISOString(),
      durationMinutes: 60,
    };
    library.recordSession("alice", steamGame.id, validSession);
    library.recordSession("alice", epicGame.id, validSession);

    const result = library.purgePlatform("alice", "steam");
    expect(result).toMatchObject({
      games: 1,
      sessions: 1,
      gameIds: [steamGame.id],
      steamAppIds: ["730"],
    });

    const remaining = library.list("alice").map((game: any) => game.id);
    expect(remaining).toEqual(expect.arrayContaining([epicGame.id, localGame.id]));
    expect(remaining).not.toContain(steamGame.id);

    library.close();
  });

  it("persists the last cleanup phase across library reopen", () => {
    const directory = mkdtempSync(join(tmpdir(), "checkpoint-library-"));
    temporaryDirectories.push(directory);
    const library1 = createLocalGameLibrary(directory);

    library1.setPlatformCleanupPhase("alice", "epic", "op-1", "removing-cloud-data");
    library1.close();

    const library2 = createLocalGameLibrary(directory);
    const state = library2.getPlatformCleanup("alice", "epic");
    expect(state).toMatchObject({
      operationId: "op-1",
      phase: "removing-cloud-data",
    });

    library2.completePlatformCleanup("alice", "epic", "op-1");
    expect(library2.getPlatformCleanup("alice", "epic")).toBeNull();
    library2.close();
  });
});
