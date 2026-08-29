import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("metadados da release", () => {
  it("mantem pacote, lockfile e notas na mesma versao", () => {
    const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
    const lockfile = JSON.parse(readFileSync("package-lock.json", "utf8"));
    const releaseNotes = readFileSync("RELEASE_NOTES.md", "utf8");

    expect(packageJson.version).toBe(lockfile.version);
    expect(lockfile.version).toBe(lockfile.packages[""].version);
    expect(releaseNotes).toContain(`Phelierium Game Hub — v${packageJson.version}`);
  });
});

