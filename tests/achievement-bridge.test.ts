import { createRequire } from "node:module";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const require = createRequire(import.meta.url);
const { createAchievementBridge } = require("../electron/achievement-bridge.cjs") as {
  createAchievementBridge: (options: Record<string, unknown>) => {
    unlockAchievement: (gameId: string, achievementId: string) => Promise<{
      duplicate: boolean;
      achievementId: string;
      achievement: { name: string; icon: string };
    }>;
    migrateAchievementAliases: (
      gameId: string,
      aliases: Record<string, string>,
    ) => Promise<{ migrated: number }>;
  };
};

const temporaryDirectories: string[] = [];

const createFixture = () => {
  const userDataPath = mkdtempSync(path.join(tmpdir(), "checkpoint-achievements-"));
  temporaryDirectories.push(userDataPath);
  const achievementsDir = path.join(userDataPath, "achievements");
  mkdirSync(achievementsDir, { recursive: true });
  writeFileSync(path.join(achievementsDir, "local-game-id.json"), JSON.stringify({
    steamAppId: "2050650",
    achievements: [{
      id: "5",
      name: "Uma Experiência de Quase Morte",
      description: "Resgate Ashley.",
      icon: "https://cdn.example/achievement.jpg",
    }],
  }));
  return userDataPath;
};

afterEach(() => {
  while (temporaryDirectories.length > 0) {
    rmSync(temporaryDirectories.pop()!, { recursive: true, force: true });
  }
});

describe("pipeline central de conquistas", () => {
  it("normaliza, resolve metadados e deduplica IDs RUNE", async () => {
    const userDataPath = createFixture();
    const onAchievementUnlocked = vi.fn();
    const bridge = createAchievementBridge({
      userDataPath,
      appUrl: null,
      onAchievementUnlocked,
      normalizeAchievementId: async (_gameId: string, id: string) => id === "00000" ? "5" : id,
    });

    const first = await bridge.unlockAchievement("steam_2050650", "00000");
    const duplicate = await bridge.unlockAchievement("steam_2050650", "5");

    expect(first).toMatchObject({
      duplicate: false,
      achievementId: "5",
      achievement: { name: "Uma Experiência de Quase Morte" },
    });
    expect(duplicate.duplicate).toBe(true);
    expect(onAchievementUnlocked).toHaveBeenCalledTimes(2);
    const progress = JSON.parse(readFileSync(
      path.join(userDataPath, "user_progress_steam_2050650.json"),
      "utf8",
    ));
    expect(Object.keys(progress.unlockedAchievements)).toEqual(["5"]);
  });

  it("migra progresso legado sem disparar um novo overlay", async () => {
    const userDataPath = createFixture();
    writeFileSync(path.join(userDataPath, "user_progress_steam_2050650.json"), JSON.stringify({
      gameId: "steam_2050650",
      unlockedAchievements: {
        "00000": { id: "00000", name: "00000", unlockedAt: "2026-07-15T10:00:00.000Z" },
      },
      updatedAt: "2026-07-15T10:00:00.000Z",
    }));
    const onAchievementUnlocked = vi.fn();
    const bridge = createAchievementBridge({ userDataPath, appUrl: null, onAchievementUnlocked });

    await expect(bridge.migrateAchievementAliases("steam_2050650", { "00000": "5" }))
      .resolves.toEqual({ migrated: 1 });
    const progress = JSON.parse(readFileSync(
      path.join(userDataPath, "user_progress_steam_2050650.json"),
      "utf8",
    ));
    expect(progress.unlockedAchievements["00000"]).toBeUndefined();
    expect(progress.unlockedAchievements["5"]).toMatchObject({
      id: "5",
      name: "Uma Experiência de Quase Morte",
    });
    expect(onAchievementUnlocked).not.toHaveBeenCalled();
  });
});
