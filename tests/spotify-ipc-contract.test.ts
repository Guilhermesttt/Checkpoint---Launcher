import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("contrato IPC Spotify", () => {
  it("expoe autenticacao e token temporario apenas pelo preload", () => {
    const preload = readFileSync(path.resolve("electron/preload.cjs"), "utf8");
    const main = readFileSync(path.resolve("electron/main.cjs"), "utf8");
    const types = readFileSync(path.resolve("src/types/electron.d.ts"), "utf8");
    for (const channel of ["spotify:get-status", "spotify:connect", "spotify:disconnect", "spotify:get-access-token"]) {
      expect(preload).toContain(channel);
      expect(main).toContain(channel);
    }
    expect(types).toContain("getSpotifyStatus");
    expect(types).toContain("connectSpotify");
    expect(types).toContain("getSpotifyAccessToken");
    expect(main).toContain("safeStorage.encryptString");
  });
});
