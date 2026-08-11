import { describe, expect, it } from "vitest";

import { isPs2ConsoleMeshName } from "../src/features/retro/ps2/retroPs2Console";

describe("PS2 detail console isolation", () => {
  it("keeps only the PS2 body, shell and detail meshes", () => {
    expect(isPs2ConsoleMeshName("PS2_Body_M_PS2_Details_0")).toBe(true);
    expect(isPs2ConsoleMeshName("PS2_Box_M_PS2_Box_0")).toBe(true);
    expect(isPs2ConsoleMeshName("PS2_Details_M_PS2_Details_0")).toBe(true);
    expect(isPs2ConsoleMeshName("Object009_M_PS2_Body_0")).toBe(true);
  });

  it("rejects controller, cable and game-box meshes", () => {
    expect(isPs2ConsoleMeshName("DualShock_Controller")).toBe(false);
    expect(isPs2ConsoleMeshName("Controller_Cable")).toBe(false);
    expect(isPs2ConsoleMeshName("Game_Case_God_Of_War")).toBe(false);
  });
});
