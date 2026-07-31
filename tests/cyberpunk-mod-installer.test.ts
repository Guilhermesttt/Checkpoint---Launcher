import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const AdmZip = require("adm-zip");
const { installCyberpunkZip } = require("../electron/cyberpunk-mod-installer.cjs") as {
  installCyberpunkZip: (request: {
    archivePath: string;
    gameRoot: string;
    backupRoot: string;
    manifestRoot: string;
    modId: string;
    fileId: string;
    modName: string;
  }) => Promise<{
    installedFiles: number;
    backedUpFiles: number;
    manifestPath: string;
  }>;
};

const directories: string[] = [];
afterEach(() => {
  directories.splice(0).forEach((directory) =>
    rmSync(directory, { recursive: true, force: true }));
});

const createGameRoot = () => {
  const root = mkdtempSync(join(tmpdir(), "checkpoint-cyberpunk-"));
  directories.push(root);
  mkdirSync(join(root, "bin", "x64"), { recursive: true });
  writeFileSync(join(root, "bin", "x64", "Cyberpunk2077.exe"), "exe");
  return root;
};

describe("instalador seguro de mods do Cyberpunk", () => {
  it("instala um ZIP com pasta wrapper e salva backup dos arquivos substituidos", async () => {
    const gameRoot = createGameRoot();
    const workspace = mkdtempSync(join(tmpdir(), "checkpoint-mod-package-"));
    directories.push(workspace);
    const destination = join(gameRoot, "archive", "pc", "mod", "checkpoint.archive");
    mkdirSync(join(gameRoot, "archive", "pc", "mod"), { recursive: true });
    writeFileSync(destination, "original");

    const archivePath = join(workspace, "mod.zip");
    const zip = new AdmZip();
    zip.addFile("README.txt", Buffer.from("instructions"));
    zip.addFile("Example Mod/archive/pc/mod/checkpoint.archive", Buffer.from("modded"));
    zip.addFile("Example Mod/r6/scripts/checkpoint.reds", Buffer.from("script"));
    zip.writeZip(archivePath);

    const result = await installCyberpunkZip({
      archivePath,
      gameRoot,
      backupRoot: join(workspace, "backups"),
      manifestRoot: join(workspace, "manifests"),
      modId: "501",
      fileId: "9001",
      modName: "Example Mod",
    });

    expect(result.installedFiles).toBe(2);
    expect(result.backedUpFiles).toBe(1);
    expect(readFileSync(destination, "utf8")).toBe("modded");
    expect(readFileSync(join(gameRoot, "r6", "scripts", "checkpoint.reds"), "utf8")).toBe("script");
    expect(existsSync(result.manifestPath)).toBe(true);
  });

  it("recusa pacotes que nao possuem uma estrutura conhecida do jogo", async () => {
    const gameRoot = createGameRoot();
    const workspace = mkdtempSync(join(tmpdir(), "checkpoint-invalid-mod-"));
    directories.push(workspace);
    const archivePath = join(workspace, "invalid.zip");
    const zip = new AdmZip();
    zip.addFile("random/file.txt", Buffer.from("unsafe target"));
    zip.writeZip(archivePath);

    await expect(installCyberpunkZip({
      archivePath,
      gameRoot,
      backupRoot: join(workspace, "backups"),
      manifestRoot: join(workspace, "manifests"),
      modId: "1",
      fileId: "2",
      modName: "Invalid",
    })).rejects.toThrow(/estrutura/i);
    expect(existsSync(join(gameRoot, "random", "file.txt"))).toBe(false);
  });
});
