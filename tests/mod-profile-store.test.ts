import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { loadModProfiles, saveModProfile, deleteModProfile } = require("../electron/mod-profile-store.cjs");

describe("mod-profile-store", () => {
  let tempUserData: string;

  beforeEach(() => {
    tempUserData = fs.mkdtempSync(path.join(os.tmpdir(), "checkpoint-profile-store-test-"));
  });

  afterEach(() => {
    if (fs.existsSync(tempUserData)) {
      fs.rmSync(tempUserData, { recursive: true, force: true });
    }
  });

  it("retorna lista vazia se nenhum perfil foi salvo ainda", () => {
    const profiles = loadModProfiles(tempUserData, "cyberpunk2077");
    expect(profiles).toEqual([]);
  });

  it("salva um novo perfil de mods e recupera corretamente", () => {
    const activeIds = ["mod_1", "mod_2"];
    const profiles = saveModProfile(tempUserData, "cyberpunk2077", "Build Singleplayer", activeIds);

    expect(profiles).toHaveLength(1);
    expect(profiles[0].name).toBe("Build Singleplayer");
    expect(profiles[0].activeInstallIds).toEqual(["mod_1", "mod_2"]);

    const reloaded = loadModProfiles(tempUserData, "cyberpunk2077");
    expect(reloaded).toHaveLength(1);
    expect(reloaded[0].name).toBe("Build Singleplayer");
  });

  it("atualiza um perfil existente quando o mesmo nome é utilizado", () => {
    saveModProfile(tempUserData, "cyberpunk2077", "Build Singleplayer", ["mod_1"]);
    const updated = saveModProfile(tempUserData, "cyberpunk2077", "Build Singleplayer", ["mod_1", "mod_3"]);

    expect(updated).toHaveLength(1);
    expect(updated[0].activeInstallIds).toEqual(["mod_1", "mod_3"]);
  });

  it("exclui um perfil pelo ID com sucesso", () => {
    const profiles = saveModProfile(tempUserData, "cyberpunk2077", "Perfil Temporário", ["mod_1"]);
    const profileId = profiles[0].id;

    const remaining = deleteModProfile(tempUserData, "cyberpunk2077", profileId);
    expect(remaining).toHaveLength(0);

    const reloaded = loadModProfiles(tempUserData, "cyberpunk2077");
    expect(reloaded).toHaveLength(0);
  });
});
