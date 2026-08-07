import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("metadados da release 3.0.8", () => {
  it("mantem pacote, lockfile e notas na mesma versao", () => {
    const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
    const lockfile = JSON.parse(readFileSync("package-lock.json", "utf8"));
    const releaseNotes = readFileSync("RELEASE_NOTES.md", "utf8");

    expect(packageJson.version).toBe("3.0.8");
    expect(lockfile.version).toBe("3.0.8");
    expect(lockfile.packages[""].version).toBe("3.0.8");
    expect(releaseNotes).toContain("Checkpoint Launcher — v3.0.8");
    expect(releaseNotes).toContain("Detector de conflitos de mods e suporte a armazenamento de perfis de modding.");
    expect(releaseNotes).toContain("Modal dedicado de tratamento de erros no processo de atualização do aplicativo");
  });
});
