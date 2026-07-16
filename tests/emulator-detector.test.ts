import { createRequire } from "node:module";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const detector = require("../electron/emulator-detector.cjs") as {
  detectEmulator: (gameDir: string, appId: string) => unknown;
  parseGenericIniAchievements: (content: string) => Record<string, { earned: boolean }>;
  parseJsonAchievementState: (data: unknown) => Record<string, { earned: boolean; earnedTime: number }>;
  parseRuneAchievements: (content: string) => Record<string, { earned: boolean; earnedTime: number }>;
  parseRuneAchievementAliases: (content: string) => Record<string, string>;
};

const temporaryDirectories: string[] = [];
const runeFixture = readFileSync(
  path.join(process.cwd(), "tests", "fixtures", "rune-achievements.ini"),
  "utf8",
);

afterEach(() => {
  while (temporaryDirectories.length > 0) {
    rmSync(temporaryDirectories.pop()!, { recursive: true, force: true });
  }
});

describe("detector de emuladores", () => {
  it("normaliza os índices internos do RUNE para IDs canônicos", () => {
    expect(detector.parseRuneAchievementAliases(runeFixture)).toEqual({
      "00000": "5",
      "00001": "1",
      "00002": "2",
    });
    const state = detector.parseRuneAchievements(runeFixture);
    expect(state["1"]).toMatchObject({ earned: true, earnedTime: 1784147027 });
    expect(state["2"].earned).toBe(true);
    expect(state["5"].earned).toBe(true);
    expect(state["00000"]).toBeUndefined();
  });

  it("não interpreta seções arbitrárias como conquista sem estado reconhecido", () => {
    expect(detector.parseGenericIniAchievements("[Video]\nWidth=1920\nHeight=1080\n")).toEqual({});
  });

  it("lê estados JSON Goldberg/TENOKE sem transformar a string zero em true", () => {
    expect(detector.parseJsonAchievementState({
      ACH_ONE: { earned: true, earned_time: 123 },
      ACH_TWO: { achieved: "0", unlockTime: 0 },
    })).toEqual({
      ACH_ONE: { earned: true, earnedTime: 123 },
      ACH_TWO: { earned: false, earnedTime: 0 },
    });
  });

  it("lê o formato INI por ID técnico sem confundir Count e timestamps", () => {
    const state = detector.parseGenericIniAchievements(
      "[Achievements]\nACH_FIRST=1\nACH_FIRST_TIME=1234\nACH_SECOND=0\nCount=2\n",
    );
    expect(state).toEqual({
      ACH_FIRST: { earned: true, earnedTime: 1234 },
      ACH_SECOND: { earned: false, earnedTime: 0 },
    });
  });

  it("não assume Goldberg apenas porque um jogo possui steam_api64.dll", () => {
    const gameDir = mkdtempSync(path.join(tmpdir(), "checkpoint-legit-steam-"));
    temporaryDirectories.push(gameDir);
    writeFileSync(path.join(gameDir, "steam_api64.dll"), "fixture");

    expect(detector.detectEmulator(gameDir, "999999999")).toBeNull();
    expect(readFileSync(path.join(gameDir, "steam_api64.dll"), "utf8")).toBe("fixture");
  });
});
