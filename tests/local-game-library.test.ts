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
});
