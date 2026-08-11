import { describe, expect, it } from "vitest";

import {
  classifyDvdCaseNode,
  classifyJvcMesh,
  classifyPostalPs1Node,
} from "../src/features/retro/shelf/retroModels";

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

  it("keeps both PS1 artwork faces and removes both disc meshes", () => {
    expect(classifyPostalPs1Node("Object_2", "Material__28")).toBe("front-artwork");
    expect(classifyPostalPs1Node("Object_5", "Material__26")).toBe("back-artwork");
    expect(classifyPostalPs1Node("Object_3", "Material__97")).toBe("disc");
    expect(classifyPostalPs1Node("Object_10", "Material__99")).toBe("disc");
    expect(classifyPostalPs1Node("Object_7", "Material__29")).toBe("case");
  });

});
