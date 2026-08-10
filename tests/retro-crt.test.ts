import { describe, expect, it } from "vitest";

import { createRetroTransition, getCrtProfile } from "../src/features/retro/retroCrt";

describe("retro CRT behavior", () => {
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
