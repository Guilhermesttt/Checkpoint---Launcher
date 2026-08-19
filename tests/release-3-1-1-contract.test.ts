import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("metadados da release 3.1.1", () => {
  it("mantem pacote, lockfile e notas na mesma versao", () => {
    const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
    const lockfile = JSON.parse(readFileSync("package-lock.json", "utf8"));
    const releaseNotes = readFileSync("RELEASE_NOTES.md", "utf8");

    expect(packageJson.version).toBe("3.1.1");
    expect(lockfile.version).toBe("3.1.1");
    expect(lockfile.packages[""].version).toBe("3.1.1");
    expect(releaseNotes).toContain("Checkpoint Launcher — v3.1.1");
    expect(releaseNotes).toContain("Supressão de Ruído Avançada por IA (RNNoise WASM)");
    expect(releaseNotes).toContain("Ganho de Microfone Real WebRTC");
  });
});
