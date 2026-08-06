import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("metadados da release 3.0.7", () => {
  it("mantem pacote, lockfile e notas na mesma versao", () => {
    const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
    const lockfile = JSON.parse(readFileSync("package-lock.json", "utf8"));
    const releaseNotes = readFileSync("RELEASE_NOTES.md", "utf8");

    expect(packageJson.version).toBe("3.0.7");
    expect(lockfile.version).toBe("3.0.7");
    expect(lockfile.packages[""].version).toBe("3.0.7");
    expect(releaseNotes).toContain("Checkpoint Launcher — v3.0.7");
    expect(releaseNotes).toContain("Correção de bugs de inicialização do servidor e autenticação do Discord.");
    expect(releaseNotes).toContain("Otimização do seletor de executáveis da biblioteca para evitar duplicados.");
  });
});
