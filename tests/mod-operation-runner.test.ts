import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const AdmZip = require("adm-zip");
const { runModOperation, shutdownModOperationWorker } = require(
  "../electron/mod-operation-runner.cjs",
) as {
  runModOperation: (operation: string, payload: Record<string, string>) => Promise<{
    installedFiles: number;
    manifestPath: string;
  }>;
  shutdownModOperationWorker: () => Promise<void>;
};

const workspaces: string[] = [];
afterEach(async () => {
  await shutdownModOperationWorker();
  workspaces.splice(0).forEach((workspace) =>
    rmSync(workspace, { recursive: true, force: true }));
});

describe("worker de operacoes de mods", () => {
  it("instala fora da thread chamadora e devolve o resultado", async () => {
    const workspace = mkdtempSync(join(tmpdir(), "checkpoint-mod-worker-"));
    workspaces.push(workspace);
    const gameRoot = join(workspace, "game");
    mkdirSync(gameRoot);
    writeFileSync(join(gameRoot, "re9.exe"), "exe");
    const archivePath = join(workspace, "mod.zip");
    const zip = new AdmZip();
    zip.addFile("reframework/autorun/worker.lua", Buffer.from("worker"));
    zip.writeZip(archivePath);

    const result = await runModOperation("install", {
      archivePath,
      gameRoot,
      backupRoot: join(workspace, "backups"),
      manifestRoot: join(workspace, "manifests"),
      gameDomain: "residentevilrequiem",
      modId: "10",
      fileId: "20",
      modName: "Worker test",
    });

    expect(result.installedFiles).toBe(1);
    expect(existsSync(join(gameRoot, "reframework", "autorun", "worker.lua"))).toBe(true);
    expect(existsSync(result.manifestPath)).toBe(true);
  });
});
