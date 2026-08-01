import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const { uninstallNexusMod } = require("../electron/nexus-installation-manager.cjs") as {
  uninstallNexusMod: (options: Record<string, unknown>) => Promise<{
    removedFromGame: boolean;
    archiveRemoved: boolean;
  }>;
};

const directories: string[] = [];
afterEach(() => directories.splice(0).forEach((directory) =>
  rmSync(directory, { recursive: true, force: true })));

describe("gerenciador de instalacoes Nexus", () => {
  it("restaura backups, remove arquivos novos e preserva o download ao desativar", async () => {
    const root = mkdtempSync(join(tmpdir(), "checkpoint-uninstall-"));
    directories.push(root);
    const gameRoot = join(root, "game");
    const installationsRoot = join(root, "manifests");
    const backupRoot = join(root, "backups");
    const downloadRoot = join(root, "downloads");
    const archivePath = join(downloadRoot, "game", "1", "mod.zip");
    const replaced = join(gameRoot, "natives", "old.bin");
    const added = join(gameRoot, "reframework", "new.lua");
    const backup = join(backupRoot, "game", "1", "install", "natives", "old.bin");
    const manifestPath = join(installationsRoot, "game", "1", "manifest.json");
    [archivePath, replaced, added, backup, manifestPath].forEach((file) =>
      mkdirSync(join(file, ".."), { recursive: true }));
    writeFileSync(archivePath, "zip");
    writeFileSync(replaced, "modded");
    writeFileSync(added, "added");
    writeFileSync(backup, "original");
    writeFileSync(manifestPath, JSON.stringify({
      gameRoot,
      files: [
        { relativePath: "natives/old.bin", backupPath: backup },
        { relativePath: "reframework/new.lua", backupPath: null },
      ],
    }));

    await uninstallNexusMod({
      manifestPath,
      archivePath,
      removeArchive: false,
      installationsRoot,
      backupRoot,
      downloadRoots: [downloadRoot],
    });
    expect(readFileSync(replaced, "utf8")).toBe("original");
    expect(existsSync(added)).toBe(false);
    expect(existsSync(archivePath)).toBe(true);
    expect(existsSync(manifestPath)).toBe(false);
  });

  it("apaga tambem o arquivo baixado quando o usuario remove o mod", async () => {
    const root = mkdtempSync(join(tmpdir(), "checkpoint-remove-"));
    directories.push(root);
    const downloadRoot = join(root, "downloads");
    const archivePath = join(downloadRoot, "game", "1", "mod.zip");
    mkdirSync(join(archivePath, ".."), { recursive: true });
    writeFileSync(archivePath, "zip");
    const result = await uninstallNexusMod({
      archivePath,
      removeArchive: true,
      installationsRoot: join(root, "manifests"),
      backupRoot: join(root, "backups"),
      downloadRoots: [downloadRoot],
    });
    expect(result.archiveRemoved).toBe(true);
    expect(existsSync(archivePath)).toBe(false);
  });
});
