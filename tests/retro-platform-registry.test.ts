import { describe, expect, it } from "vitest";

import {
  isRetroPlatformPreTextured,
  resolveRetroPlatform,
} from "../src/features/retro/platform/retroPlatformRegistry";

describe("retro platform registry", () => {
  it.each([
    ["PS1", "ps1"],
    ["PlayStation", "ps1"],
    ["PSX", "ps1"],
    ["PlayStation 2", "ps2"],
    ["Super Nintendo", "snes"],
    ["Super NES", "snes"],
    ["Nintendo Entertainment System", "nes"],
    ["Game Boy Advance", "gba"],
  ] as const)("resolves %s as %s", (consoleName, key) => {
    expect(resolveRetroPlatform(consoleName)?.key).toBe(key);
  });

  it("returns null for unsupported and blank platforms", () => {
    expect(resolveRetroPlatform("Switch")).toBeNull();
    expect(resolveRetroPlatform("   ")).toBeNull();
  });

  it.each([
    ["PS1", "sony_pvm-1341__sony_playstation.glb"],
    ["PS2", "ps2+tv.glb"],
    ["SNES", "super_yes.glb"],
    ["NES", "nes_console_and_controller.glb"],
  ] as const)("uses the available %s hardware model", (consoleName, modelFileName) => {
    const platform = resolveRetroPlatform(consoleName);
    expect(platform?.modelUrl).toContain(modelFileName);
  });

  it("marks user-authored GLBs as pre-textured", () => {
    expect(isRetroPlatformPreTextured("ps2")).toBe(true);
    expect(isRetroPlatformPreTextured("snes")).toBe(true);
    expect(isRetroPlatformPreTextured("nes")).toBe(true);
    expect(isRetroPlatformPreTextured("gba")).toBe(true);
    expect(isRetroPlatformPreTextured("ps1")).toBe(true);
  });

  it("uses combined pre-textured models without a separate TV GLB", () => {
    expect(resolveRetroPlatform("SNES")?.tvModelUrl).toBeUndefined();
    expect(resolveRetroPlatform("NES")?.tvModelUrl).toBeUndefined();
    expect(resolveRetroPlatform("PS2")?.tvModelUrl).toBeUndefined();
  });

  it("composes the GBA console and cartridge accessory", () => {
    const gba = resolveRetroPlatform("GBA");
    expect(gba?.modelUrl).toContain("GBA.glb");
    expect(gba?.accessoryModelUrl).toContain("gba_cartidge.glb");
  });
});
