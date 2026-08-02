import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const AdmZip = require("adm-zip");
const { adoptUniversalMod, installUniversalMod } = require("../electron/universal-mod-installer.cjs") as {
  installUniversalMod: (request: Record<string, string>) => Promise<{
    installedFiles: number;
    backedUpFiles: number;
    manifestPath: string;
  }>;
  adoptUniversalMod: (request: Record<string, string>) => Promise<{
    adopted: boolean;
    installedFiles: number;
    manifestPath: string;
  }>;
};

const directories: string[] = [];
afterEach(() => {
  directories.splice(0).forEach((directory) =>
    rmSync(directory, { recursive: true, force: true }));
});

const createGameWorkspace = (exeName = "game.exe") => {
  const workspace = mkdtempSync(join(tmpdir(), "checkpoint-universal-"));
  directories.push(workspace);
  const gameRoot = join(workspace, "game");
  mkdirSync(gameRoot, { recursive: true });
  if (exeName.includes("/")) {
    mkdirSync(join(gameRoot, exeName, ".."), { recursive: true });
  }
  writeFileSync(join(gameRoot, exeName), "exe");
  return { workspace, gameRoot };
};

describe("Motor Universal Data-Driven de Mods", () => {
  it("instala mod de Cyberpunk 2077 com auto-redirecionamento de .archive solto", async () => {
    const { workspace, gameRoot } = createGameWorkspace("bin/x64/Cyberpunk2077.exe");
    const archivePath = join(workspace, "cyberpunk-mod.zip");
    const zip = new AdmZip();
    zip.addFile("loose-mod.archive", Buffer.from("archive-content"));
    zip.addFile("r6/scripts/custom.reds", Buffer.from("reds-script"));
    zip.writeZip(archivePath);

    const result = await installUniversalMod({
      archivePath,
      gameRoot,
      backupRoot: join(workspace, "backups"),
      manifestRoot: join(workspace, "manifests"),
      gameDomain: "cyberpunk2077",
      modId: "101",
      fileId: "201",
      modName: "Cyberpunk Mod",
    });

    expect(result.installedFiles).toBe(2);
    expect(existsSync(join(gameRoot, "archive", "pc", "mod", "loose-mod.archive"))).toBe(true);
    expect(existsSync(join(gameRoot, "r6", "scripts", "custom.reds"))).toBe(true);
    expect(existsSync(result.manifestPath)).toBe(true);
  });

  it("instala mod RE Engine removendo pasta wrapper inutil", async () => {
    const { workspace, gameRoot } = createGameWorkspace("re4.exe");
    const archivePath = join(workspace, "re-mod.zip");
    const zip = new AdmZip();
    zip.addFile("WrapperFolder/natives/STM/character.bin", Buffer.from("model"));
    zip.addFile("WrapperFolder/reframework/autorun/script.lua", Buffer.from("lua"));
    zip.writeZip(archivePath);

    const result = await installUniversalMod({
      archivePath,
      gameRoot,
      backupRoot: join(workspace, "backups"),
      manifestRoot: join(workspace, "manifests"),
      gameDomain: "residentevil4",
      modId: "301",
      fileId: "401",
      modName: "RE Mod",
    });

    expect(result.installedFiles).toBe(2);
    expect(existsSync(join(gameRoot, "natives", "STM", "character.bin"))).toBe(true);
    expect(existsSync(join(gameRoot, "reframework", "autorun", "script.lua"))).toBe(true);
    expect(existsSync(result.manifestPath)).toBe(true);
  });

  it("efetua vinculacao (Adoption) universal em qualquer jogo com perfil", async () => {
    const { workspace, gameRoot } = createGameWorkspace("bin/x64/Cyberpunk2077.exe");
    const installedScript = join(gameRoot, "r6", "scripts", "already.reds");
    mkdirSync(join(installedScript, ".."), { recursive: true });
    writeFileSync(installedScript, "script-data");

    const archivePath = join(workspace, "existing.zip");
    const zip = new AdmZip();
    zip.addFile("r6/scripts/already.reds", Buffer.from("script-data"));
    zip.writeZip(archivePath);

    const result = await adoptUniversalMod({
      archivePath,
      gameRoot,
      manifestRoot: join(workspace, "manifests"),
      gameDomain: "cyberpunk2077",
      modId: "501",
      fileId: "601",
      modName: "Adopted Mod",
    });

    expect(result.adopted).toBe(true);
    expect(result.installedFiles).toBe(1);
    expect(existsSync(result.manifestPath)).toBe(true);
  });

  it("instala com fallback bruto (raw) qualquer pacote sem estrutura cadastrada no perfil", async () => {
    const { workspace, gameRoot } = createGameWorkspace("game.exe");
    const archivePath = join(workspace, "raw.zip");
    const zip = new AdmZip();
    zip.addFile("random_folder/unknown.dat", Buffer.from("junk"));
    zip.writeZip(archivePath);

    const result = await installUniversalMod({
      archivePath,
      gameRoot,
      backupRoot: join(workspace, "backups"),
      manifestRoot: join(workspace, "manifests"),
      gameDomain: "cyberpunk2077",
      modId: "999",
      fileId: "999",
      modName: "Raw Fallback Mod",
    });

    expect(result.installedFiles).toBe(1);
    expect(existsSync(join(gameRoot, "unknown.dat"))).toBe(true);
    expect(existsSync(result.manifestPath)).toBe(true);
  });
});
