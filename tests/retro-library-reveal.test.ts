import { describe, expect, it } from "vitest";

import { sampleRetroLibraryReveal } from "../src/features/retro/shelf/retroLibraryReveal";

describe("retro library boot reveal", () => {
  it("keeps side games hidden until their stagger begins", () => {
    const sample = sampleRetroLibraryReveal(80, 120, false);

    expect(sample.progress).toBe(0);
    expect(sample.scale).toBeCloseTo(0.08);
    expect(sample.y).toBeCloseTo(-0.72);
    expect(sample.z).toBeCloseTo(-1.4);
  });

  it("settles every game at its shelf transform", () => {
    const sample = sampleRetroLibraryReveal(900, 120, false);

    expect(sample.progress).toBe(1);
    expect(sample.scale).toBe(1);
    expect(sample.y).toBe(0);
    expect(sample.z).toBe(0);
  });

  it("reveals immediately when reduced motion is enabled", () => {
    expect(sampleRetroLibraryReveal(0, 500, true).progress).toBe(1);
  });
});
