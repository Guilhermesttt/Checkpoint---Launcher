import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { detectModConflicts } = require("../electron/mod-conflict-detector.cjs");

describe("mod-conflict-detector", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "checkpoint-conflict-test-"));
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("retorna lista vazia quando a pasta não possui manifestos", () => {
    const conflicts = detectModConflicts(tempDir);
    expect(conflicts).toEqual([]);
  });

  it("retorna lista vazia quando mods não sobrescrevem os mesmos arquivos", () => {
    const mod1 = {
      installId: "mod1",
      name: "Mod A",
      enabled: true,
      files: [{ relativePath: "bin/x64/script_a.dll" }],
    };
    const mod2 = {
      installId: "mod2",
      name: "Mod B",
      enabled: true,
      files: [{ relativePath: "bin/x64/script_b.dll" }],
    };

    fs.writeFileSync(path.join(tempDir, "mod1.json"), JSON.stringify(mod1));
    fs.writeFileSync(path.join(tempDir, "mod2.json"), JSON.stringify(mod2));

    const conflicts = detectModConflicts(tempDir);
    expect(conflicts).toEqual([]);
  });

  it("detecta conflito quando dois mods ativos tentam modificar o mesmo arquivo", () => {
    const mod1 = {
      installId: "mod1",
      modId: "101",
      name: "HD Textures",
      enabled: true,
      files: [{ relativePath: "archive/pc/content/textures.archive" }],
    };
    const mod2 = {
      installId: "mod2",
      modId: "202",
      name: "Cyberpunk Overhaul",
      enabled: true,
      files: [{ relativePath: "archive/pc/content/textures.archive" }],
    };

    fs.writeFileSync(path.join(tempDir, "mod1.json"), JSON.stringify(mod1));
    fs.writeFileSync(path.join(tempDir, "mod2.json"), JSON.stringify(mod2));

    const conflicts = detectModConflicts(tempDir);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].relativePath).toBe("archive/pc/content/textures.archive");
    expect(conflicts[0].mods).toHaveLength(2);
    expect(conflicts[0].mods[0].name).toBe("HD Textures");
    expect(conflicts[0].mods[1].name).toBe("Cyberpunk Overhaul");
  });

  it("ignora mods desativados (enabled: false) na detecção de conflitos", () => {
    const mod1 = {
      installId: "mod1",
      name: "Mod Ativo",
      enabled: true,
      files: [{ relativePath: "engine/config.ini" }],
    };
    const mod2 = {
      installId: "mod2",
      name: "Mod Inativo",
      enabled: false,
      files: [{ relativePath: "engine/config.ini" }],
    };

    fs.writeFileSync(path.join(tempDir, "mod1.json"), JSON.stringify(mod1));
    fs.writeFileSync(path.join(tempDir, "mod2.json"), JSON.stringify(mod2));

    const conflicts = detectModConflicts(tempDir);
    expect(conflicts).toEqual([]);
  });
});
