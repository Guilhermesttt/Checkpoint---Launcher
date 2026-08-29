import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("epic-ipc-contract", () => {
  const mainSource = fs.readFileSync(path.resolve("electron/main.cjs"), "utf8");
  const preloadSource = fs.readFileSync(path.resolve("electron/preload.cjs"), "utf8");
  const typesSource = fs.readFileSync(path.resolve("src/types/electron.d.ts"), "utf8");

  it("registers secure handlers in main.cjs using registerSecureIpcHandler", () => {
    expect(mainSource).toContain('registerSecureIpcHandler("epic:get-status"');
    expect(mainSource).toContain('registerSecureIpcHandler("epic:authenticate"');
    expect(mainSource).toContain('registerSecureIpcHandler("epic:list-library"');
    expect(mainSource).toContain('registerSecureIpcHandler("epic:get-achievements"');
    expect(mainSource).toContain('registerSecureIpcHandler("epic:logout"');
    expect(mainSource).not.toMatch(/ipcMain\.handle\("epic:/);
  });

  it("exposes typed methods and progress subscription in preload.cjs without exposing tokens", () => {
    expect(preloadSource).toContain('getEpicStatus: () => ipcRenderer.invoke("epic:get-status")');
    expect(preloadSource).toContain('authenticateEpic: (request) => ipcRenderer.invoke("epic:authenticate", request)');
    expect(preloadSource).toContain('getEpicLibrary: () => ipcRenderer.invoke("epic:list-library")');
    expect(preloadSource).toContain('getEpicAchievements: (request) => ipcRenderer.invoke("epic:get-achievements", request)');
    expect(preloadSource).toContain('logoutEpic: () => ipcRenderer.invoke("epic:logout")');
    expect(preloadSource).toContain('onEpicProgress: (callback) => {');
    expect(preloadSource).not.toMatch(/token|getEpicToken/i);
  });

  it("defines exact types in electron.d.ts", () => {
    expect(typesSource).toContain("getEpicStatus: () => Promise<EpicAccountStatus>");
    expect(typesSource).toContain("authenticateEpic: (request: { code: string }) => Promise<{ success: boolean }>");
    expect(typesSource).toContain("getEpicLibrary: () => Promise<EpicLibraryGame[]>");
    expect(typesSource).toContain("getEpicAchievements: (request?: { sandboxId?: string; appName?: string }) => Promise<EpicAchievementsResult>");
    expect(typesSource).toContain("logoutEpic: () => Promise<{ success: boolean }>");
    expect(typesSource).toContain("onEpicProgress: (callback: (progress: EpicProgressEvent) => void) => () => void");
  });
});
