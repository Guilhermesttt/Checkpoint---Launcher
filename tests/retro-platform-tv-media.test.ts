import { describe, expect, it } from "vitest";

import { getRetroPlatformJogosWallpaper } from "../src/features/retro/platform/retroPlatformTvMedia";

describe("getRetroPlatformJogosWallpaper", () => {
  it("returns the PS2 standby video on Jogos view", () => {
    expect(getRetroPlatformJogosWallpaper("ps2")).toContain("playstation-2-wallpaper.mp4");
  });

  it("returns the PS1 startup video for the PVM model", () => {
    expect(getRetroPlatformJogosWallpaper("ps1")).toContain("PlayStation-Startup.mp4");
  });

  it("returns the NES startup video for the NES model", () => {
    expect(getRetroPlatformJogosWallpaper("nes")).toContain("NES-Startup.mp4");
  });

  it("returns undefined for platforms without a standby loop", () => {
    expect(getRetroPlatformJogosWallpaper("snes")).toBeUndefined();
    expect(getRetroPlatformJogosWallpaper(undefined)).toBeUndefined();
  });
});
