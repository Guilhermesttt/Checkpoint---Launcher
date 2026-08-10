import { describe, expect, it } from "vitest";

import {
  classifyDvdCaseNode,
  classifyJvcMesh,
  getJvcOverlayScale,
} from "../src/features/retro/retroModels";

describe("retro GLB model adaptation", () => {
  it("separates the JVC display from its physical cabinet", () => {
    expect(classifyJvcMesh(["display"])).toBe("display");
    expect(classifyJvcMesh(["tv_case"])).toBe("cabinet");
    expect(classifyJvcMesh(["TV_CASE", "display"])).toBe("display");
  });

  it("maps the supplied DVD model node names to stable roles", () => {
    expect(classifyDvdCaseNode("Case_Plastic_0")).toBe("case");
    expect(classifyDvdCaseNode("Case_Art.001_0")).toBe("artwork");
    expect(classifyDvdCaseNode("Cylinder_CD Art_0")).toBe("disc-art");
    expect(classifyDvdCaseNode("Circle_Fingerprint_0")).toBe("disc");
    expect(classifyDvdCaseNode("Camera")).toBe("discard");
    expect(classifyDvdCaseNode("Light")).toBe("discard");
    expect(classifyDvdCaseNode("UnknownNode")).toBe("detail");
  });

  it("crops the TV body while keeping a recognizable bezel around its screen", () => {
    const scale = getJvcOverlayScale(7.6, 0.198);

    expect(scale).toBeGreaterThan(29);
    expect(scale).toBeLessThan(31);
  });
});
