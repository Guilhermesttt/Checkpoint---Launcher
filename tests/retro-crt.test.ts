import { describe, expect, it } from "vitest";

import {
  createRetroTransition,
  curveCrtUvWithOverscan,
  getCrtProfile,
} from "../src/features/retro/retroCrt";
import { retroCrtFragmentShader } from "../src/features/retro/retroShaders";

describe("retro CRT behavior", () => {
  it("keeps every curved viewport corner inside the source texture", () => {
    const curvature = getCrtProfile(false).curvature;
    const corners: Array<[number, number]> = [
      [0, 0],
      [1, 0],
      [0, 1],
      [1, 1],
    ];

    for (const corner of corners) {
      const curved = curveCrtUvWithOverscan(corner, curvature);
      expect(curved[0]).toBeGreaterThanOrEqual(0);
      expect(curved[0]).toBeLessThanOrEqual(1);
      expect(curved[1]).toBeGreaterThanOrEqual(0);
      expect(curved[1]).toBeLessThanOrEqual(1);
    }
  });

  it("does not paint an external black tube mask", () => {
    expect(retroCrtFragmentShader).not.toContain("mask <= 0.001");
    expect(retroCrtFragmentShader).not.toContain("color * mask");
  });

  it("keeps the cinematic tube effect without crushing interface legibility", () => {
    const profile = getCrtProfile(false);

    expect(profile.exposure).toBeGreaterThanOrEqual(1.2);
    expect(profile.exposure).toBeLessThanOrEqual(1.3);
    expect(profile.blackLift).toBeGreaterThanOrEqual(0.012);
    expect(profile.blackLift).toBeLessThanOrEqual(0.025);
    expect(profile.vignette).toBeLessThanOrEqual(0.28);
    expect(profile.scanline).toBeLessThanOrEqual(0.12);
    expect(profile.noise).toBeLessThanOrEqual(0.025);
  });

  it("removes continuous flicker and reduces sync displacement for reduced motion", () => {
    expect(getCrtProfile(true)).toMatchObject({ flicker: 0, syncTear: 0.08 });
    expect(getCrtProfile(false).flicker).toBeGreaterThan(0);
    expect(getCrtProfile(false).syncTear).toBeGreaterThan(0.08);
  });

  it("emits the selection swap once at peak distortion", () => {
    const transition = createRetroTransition(420);
    transition.start(1000);

    expect(transition.sample(1170).shouldSwap).toBe(false);
    expect(transition.sample(1210).shouldSwap).toBe(true);
    expect(transition.sample(1220).shouldSwap).toBe(false);
  });

  it("locks duplicate selection commands only while active", () => {
    const transition = createRetroTransition(420);
    transition.start(1000);

    expect(transition.isLocked(1100)).toBe(true);
    expect(transition.isLocked(1421)).toBe(false);
  });

  it("returns a normalized bell-shaped signal during the fault", () => {
    const transition = createRetroTransition(400);
    transition.start(1000);

    expect(transition.sample(1000).signal).toBe(0);
    expect(transition.sample(1200).signal).toBe(1);
    expect(transition.sample(1400).signal).toBe(0);
  });
});
