import { describe, expect, it } from "vitest";

import { resolveRetroPlatform } from "../src/features/retro/platform/retroPlatformRegistry";

describe("retro platform registry", () => {
  it.each([
    ["PS1", "ps1"],
    ["PlayStation", "ps1"],
    ["PSX", "ps1"],
    ["PlayStation 2", "ps2"],
    ["Super Nintendo", "snes"],
    ["Super NES", "snes"],
    ["Nintendo Entertainment System", "nes"],
  ] as const)("resolves %s as %s", (consoleName, key) => {
    expect(resolveRetroPlatform(consoleName)?.key).toBe(key);
  });

  it("returns null for unsupported and blank platforms", () => {
    expect(resolveRetroPlatform("Switch")).toBeNull();
    expect(resolveRetroPlatform("   ")).toBeNull();
  });

  it.each([
    ["PS1", "sony_pvm-1341__sony_playstation.glb"],
    ["PS2", "sony_playstation_2.glb"],
    ["SNES", "super_yes.glb"],
    ["NES", "nes_console_and_controller.glb"],
  ] as const)("uses the approved %s hardware model", (consoleName, modelFileName) => {
    expect(resolveRetroPlatform(consoleName)?.modelUrl).toContain(modelFileName);
  });
});
