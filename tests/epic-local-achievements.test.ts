import { afterEach, describe, expect, it } from "vitest";
import { createRequire } from "node:module";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const require = createRequire(import.meta.url);
const {
  collectJsonAchievements,
  readEpicLocalAchievements,
} = require("../electron/epic-local-achievements.cjs") as {
  collectJsonAchievements: (data: unknown, sourcePath: string) => Array<Record<string, unknown>>;
  readEpicLocalAchievements: (
    request: Record<string, string>,
    options: Record<string, unknown>,
  ) => {
    status: string;
    total: number;
    unlocked: number;
    binarySaveDetected: boolean;
    achievements: Array<{
      apiName: string;
      name: string;
      description: string;
      achieved: boolean;
      unlockTime: number;
    }>;
  };
};

const temporaryDirectories: string[] = [];

afterEach(() => {
  temporaryDirectories.splice(0).forEach((directory) =>
    fs.rmSync(directory, { recursive: true, force: true }));
});

const createGame = () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "checkpoint-epic-achievements-"));
  temporaryDirectories.push(root);
  const executablePath = path.join(root, "Binaries", "Game.exe");
  fs.mkdirSync(path.dirname(executablePath), { recursive: true });
  fs.writeFileSync(executablePath, "");
  return { root, executablePath };
};

describe("conquistas locais da Epic", () => {
  it("lê definições e progresso em JSON dentro da instalação", () => {
    const { root, executablePath } = createGame();
    const achievementDirectory = path.join(root, "Config", "Achievements");
    fs.mkdirSync(achievementDirectory, { recursive: true });
    fs.writeFileSync(path.join(achievementDirectory, "achievements.json"), JSON.stringify({
      achievements: [
        {
          achievementId: "FIRST_WIN",
          displayName: { "pt-BR": "Primeira vitória" },
          description: "Vença uma partida.",
          isUnlocked: true,
          unlockedAt: "2026-07-17T12:00:00.000Z",
        },
        {
          achievementId: "TEN_WINS",
          displayName: "Dez vitórias",
          isUnlocked: false,
        },
      ],
    }));

    const result = readEpicLocalAchievements(
      {
        title: "Meu Jogo",
        epicCatalogId: "catalog",
        executablePath,
      },
      {
        installedGames: [{
          title: "Meu Jogo",
          catalogId: "catalog",
          executablePath,
          installLocation: root,
        }],
        localAppData: path.join(root, "missing-local"),
        appData: path.join(root, "missing-roaming"),
        documents: path.join(root, "missing-documents"),
        savedGames: path.join(root, "missing-saved-games"),
      },
    );

    expect(result).toMatchObject({
      status: "ok",
      total: 2,
      unlocked: 1,
      binarySaveDetected: false,
    });
    expect(result.achievements[0]).toMatchObject({
      apiName: "FIRST_WIN",
      name: "Primeira vitória",
      description: "Vença uma partida.",
      achieved: true,
      unlockTime: 1784289600,
    });
  });

  it("combina um arquivo de definições com um arquivo de estado", () => {
    const { root, executablePath } = createGame();
    fs.writeFileSync(path.join(root, "achievements.json"), JSON.stringify({
      achievements: [{
        id: "ACH_EXPLORER",
        display_name: "Explorador",
        description: "Visite o mapa inteiro.",
      }],
    }));
    fs.writeFileSync(path.join(root, "achievement-progress.json"), JSON.stringify({
      achievements: {
        ACH_EXPLORER: { earned: "1", earned_time: 321 },
      },
    }));

    const result = readEpicLocalAchievements(
      { title: "Explorer", executablePath },
      {
        installedGames: [{
          title: "Explorer",
          executablePath,
          installLocation: root,
        }],
        localAppData: path.join(root, "missing"),
        appData: path.join(root, "missing"),
        documents: path.join(root, "missing"),
        savedGames: path.join(root, "missing"),
      },
    );

    expect(result.achievements).toContainEqual(expect.objectContaining({
      apiName: "ACH_EXPLORER",
      name: "Explorador",
      achieved: true,
      unlockTime: 321,
    }));
  });

  it("não inventa conquistas quando o jogo usa um save binário", () => {
    const { root, executablePath } = createGame();
    const saveDirectory = path.join(root, "SaveDataEpic");
    fs.mkdirSync(saveDirectory);
    fs.writeFileSync(path.join(saveDirectory, "profile.save"), Buffer.from([0, 1, 2, 3]));

    const result = readEpicLocalAchievements(
      { title: "Binary Game", executablePath },
      {
        installedGames: [{
          title: "Binary Game",
          executablePath,
          installLocation: root,
        }],
        localAppData: path.join(root, "missing"),
        appData: path.join(root, "missing"),
        documents: path.join(root, "missing"),
        savedGames: path.join(root, "missing"),
      },
    );

    expect(result).toMatchObject({
      status: "binary-save",
      total: 0,
      unlocked: 0,
      binarySaveDetected: true,
    });
  });

  it("ignora objetos genéricos que não são conquistas", () => {
    expect(collectJsonAchievements({
      profile: { id: "user-1", name: "Jogador", completed: false },
    }, "profile.json")).toEqual([]);
  });
});
