import { createRequire } from "node:module";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const { readAchievementLibrarySummary } = require("../electron/achievement-summary.cjs") as {
  readAchievementLibrarySummary: (userDataPath: string) => Promise<{
    byGameId: Record<string, { total: number; unlocked: number }>;
    bySteamAppId: Record<string, { total: number; unlocked: number }>;
  }>;
};

const temporaryDirectories: string[] = [];

const createUserData = () => {
  const directory = mkdtempSync(path.join(tmpdir(), "checkpoint-summary-"));
  temporaryDirectories.push(directory);
  mkdirSync(path.join(directory, "achievements"), { recursive: true });
  return directory;
};

afterEach(() => {
  while (temporaryDirectories.length > 0) {
    rmSync(temporaryDirectories.pop()!, { recursive: true, force: true });
  }
});

describe("resumo local de conquistas", () => {
  it("aplica o progresso steam_<appid> ao gameId usado pelas definicoes", async () => {
    const userDataPath = createUserData();
    writeFileSync(
      path.join(userDataPath, "achievements", "library-game-id.json"),
      JSON.stringify({
        steamAppId: "123",
        achievements: [{ id: "A" }, { id: "B" }, { id: "C" }],
      }),
    );
    writeFileSync(
      path.join(userDataPath, "user_progress_steam_123.json"),
      JSON.stringify({ unlockedAchievements: { A: {}, C: {} } }),
    );

    const summary = await readAchievementLibrarySummary(userDataPath);

    expect(summary.byGameId["library-game-id"]).toEqual({ total: 3, unlocked: 2 });
    expect(summary.byGameId["steam_123"]).toEqual({ total: 0, unlocked: 2 });
    expect(summary.bySteamAppId["123"]).toEqual({ total: 3, unlocked: 2 });
  });

  it("deduplica caches repetidos do mesmo jogo", async () => {
    const userDataPath = createUserData();
    const first = { steamAppId: "456", achievements: [{ id: "ONE" }, { id: "TWO" }] };
    const second = { steamAppId: "456", achievements: [{ id: "TWO" }, { id: "THREE" }] };
    writeFileSync(path.join(userDataPath, "achievements", "game-a.json"), JSON.stringify(first));
    writeFileSync(path.join(userDataPath, "achievements", "game-b.json"), JSON.stringify(second));
    writeFileSync(
      path.join(userDataPath, "user_progress_game-a.json"),
      JSON.stringify({ unlockedAchievements: { ONE: {} } }),
    );
    writeFileSync(
      path.join(userDataPath, "user_progress_game-b.json"),
      JSON.stringify({ unlockedAchievements: { ONE: {}, TWO: {} } }),
    );

    const summary = await readAchievementLibrarySummary(userDataPath);

    expect(summary.bySteamAppId["456"]).toEqual({ total: 3, unlocked: 2 });
  });

  it("ignora um arquivo corrompido sem perder os demais", async () => {
    const userDataPath = createUserData();
    writeFileSync(path.join(userDataPath, "achievements", "broken.json"), "{");
    writeFileSync(
      path.join(userDataPath, "achievements", "working.json"),
      JSON.stringify({ achievements: [{ id: "OK" }] }),
    );

    const summary = await readAchievementLibrarySummary(userDataPath);

    expect(summary.byGameId.working).toEqual({ total: 1, unlocked: 0 });
    expect(summary.byGameId.broken).toBeUndefined();
  });
});
