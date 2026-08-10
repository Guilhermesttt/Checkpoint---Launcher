import { describe, expect, it } from "vitest";

import { getRetroCaseMotion } from "../src/features/retro/retroCaseMotion";

describe("retro game case motion", () => {
  it("brings the selected case forward at a larger physical scale", () => {
    expect(getRetroCaseMotion({ selected: true, inspected: false, reducedMotion: false })).toMatchObject({
      rotationY: -0.13,
      scale: 1.28,
      hingeRotation: 0,
      damping: 5.5,
    });
  });

  it("opens the selected cover around its hinge", () => {
    const motion = getRetroCaseMotion({ selected: true, inspected: true, reducedMotion: false });

    expect(motion.hingeRotation).toBeLessThan(-1.8);
    expect(motion.hingeRotation).toBeGreaterThan(-2);
    expect(motion.discVisible).toBe(true);
  });

  it("settles quickly and disables continuous disc motion for reduced motion", () => {
    expect(getRetroCaseMotion({ selected: true, inspected: true, reducedMotion: true })).toMatchObject({
      damping: 18,
      rotateDisc: false,
    });
  });
});
