import { describe, expect, it, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { cleanupPlatformAchievementFiles } from "../electron/platform-data-cleanup.cjs";

describe("platform-data-cleanup", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "platform-cleanup-test-"));
    fs.mkdirSync(path.join(tempDir, "achievements"), { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("removes only matching Steam achievement definitions and progress files", async () => {
    const steamFile1 = path.join(tempDir, "achievements", "steam_730.json");
    const steamFile2 = path.join(tempDir, "user_progress_steam_730.json");
    const epicFile = path.join(tempDir, "achievements", "epic_cat123.json");
    const manualFile = path.join(tempDir, "achievements", "manual_game.json");

    fs.writeFileSync(steamFile1, "{}");
    fs.writeFileSync(steamFile2, "{}");
    fs.writeFileSync(epicFile, "{}");
    fs.writeFileSync(manualFile, "{}");

    const result = await cleanupPlatformAchievementFiles({
      userDataPath: tempDir,
      steamAppIds: ["730"],
      platform: "steam",
    });

    expect(result.deletedFiles.length).toBe(2);
    expect(fs.existsSync(steamFile1)).toBe(false);
    expect(fs.existsSync(steamFile2)).toBe(false);
    expect(fs.existsSync(epicFile)).toBe(true);
    expect(fs.existsSync(manualFile)).toBe(true);
  });

  it("removes only matching Epic achievement definitions and progress files", async () => {
    const epicFile1 = path.join(tempDir, "achievements", "epic_cat123.json");
    const epicFile2 = path.join(tempDir, "user_progress_epic_cat123.json");
    const steamFile = path.join(tempDir, "achievements", "steam_730.json");

    fs.writeFileSync(epicFile1, "{}");
    fs.writeFileSync(epicFile2, "{}");
    fs.writeFileSync(steamFile, "{}");

    const result = await cleanupPlatformAchievementFiles({
      userDataPath: tempDir,
      epicCatalogIds: ["cat123"],
      platform: "epic",
    });

    expect(result.deletedFiles.length).toBe(2);
    expect(fs.existsSync(epicFile1)).toBe(false);
    expect(fs.existsSync(epicFile2)).toBe(false);
    expect(fs.existsSync(steamFile)).toBe(true);
  });
});
