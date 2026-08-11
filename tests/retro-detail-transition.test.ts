import { describe, expect, it } from "vitest";

import {
  RETRO_DETAIL_TRANSITION_MS,
  getFrontFacingRotation,
  sampleRetroDetailTransition,
} from "../src/features/retro/shelf/retroDetailTransition";

describe("retro detail transition", () => {
  it("moves the selected case to the right while completing a fast turn", () => {
    const startRotation = 0.7;
    const halfway = sampleRetroDetailTransition(
      RETRO_DETAIL_TRANSITION_MS / 2,
      startRotation,
    );
    const finished = sampleRetroDetailTransition(
      RETRO_DETAIL_TRANSITION_MS,
      startRotation,
    );

    expect(halfway.x).toBeGreaterThan(0);
    expect(halfway.x).toBeLessThan(finished.x);
    expect(halfway.rotationY).toBeGreaterThan(startRotation);
    expect(finished.x).toBeCloseTo(2.12);
    expect(finished.rotationY % (Math.PI * 2)).toBeCloseTo(0);
  });

  it("always chooses a future front-facing rotation with at least one full turn", () => {
    const startRotation = -1.4;
    const target = getFrontFacingRotation(startRotation);

    expect(target).toBeGreaterThan(startRotation + Math.PI * 2 - 0.001);
    expect(target % (Math.PI * 2)).toBeCloseTo(0);
  });
});
