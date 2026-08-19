import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("metadados da release 3.1.2", () => {
  it("mantem pacote, lockfile e notas na mesma versao", () => {
    const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
    const lockfile = JSON.parse(readFileSync("package-lock.json", "utf8"));
    const releaseNotes = readFileSync("RELEASE_NOTES.md", "utf8");

    expect(packageJson.version).toBe("3.1.2");
    expect(lockfile.version).toBe("3.1.2");
    expect(lockfile.packages[""].version).toBe("3.1.2");
    expect(releaseNotes).toContain("Checkpoint Launcher — v3.1.2");
    expect(releaseNotes).toContain("Áudio WebRTC Sem Latência e DOM AutoPlay");
    expect(releaseNotes).toContain("Barramento Global de Eventos U2U em Tempo Real");
  });
});
