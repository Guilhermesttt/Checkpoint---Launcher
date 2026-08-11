import { describe, expect, it } from "vitest";

import { getRetroCaseMotion } from "../src/features/retro/shelf/retroCaseMotion";

describe("retro game case motion", () => {
  it("brings the selected case forward at a larger physical scale", () => {
    expect(
      getRetroCaseMotion({ selected: true, reducedMotion: false }),
    ).toEqual({
      rotationY: -0.13,
      scale: 1.28,
      damping: 5.5,
    });
  });

  it("settles the closed case quickly for reduced motion", () => {
    expect(getRetroCaseMotion({ selected: true, reducedMotion: true })).toEqual(
      {
        rotationY: -0.13,
        scale: 1.28,
        damping: 18,
      },
    );
  });
});
