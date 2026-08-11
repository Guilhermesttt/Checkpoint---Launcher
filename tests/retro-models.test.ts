import { describe, expect, it } from "vitest";

import { classifyPostalPs1Node } from "../src/features/retro/shelf/retroModels";

describe("retro GLB model adaptation", () => {
  it("keeps both PS1 artwork faces and removes both disc meshes", () => {
    expect(classifyPostalPs1Node("Object_2", "Material__28")).toBe("front-artwork");
    expect(classifyPostalPs1Node("Object_5", "Material__26")).toBe("back-artwork");
    expect(classifyPostalPs1Node("Object_3", "Material__97")).toBe("disc");
    expect(classifyPostalPs1Node("Object_10", "Material__99")).toBe("disc");
    expect(classifyPostalPs1Node("Object_7", "Material__29")).toBe("case");
  });
});

