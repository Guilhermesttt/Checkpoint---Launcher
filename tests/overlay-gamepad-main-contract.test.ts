import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("toggle de gamepad do overlay no processo principal", () => {
  it("centraliza e deduplica os toggles recebidos do launcher e do overlay", () => {
    const mainSource = readFileSync("electron/main.cjs", "utf8");

    expect(mainSource).toContain("const OVERLAY_GAMEPAD_TOGGLE_COOLDOWN_MS = 650;");
    expect(mainSource).toContain("const requestOverlayPanelToggle = (source = \"unknown\") =>");
    expect(mainSource).toContain("now - lastOverlayGamepadToggleAt < OVERLAY_GAMEPAD_TOGGLE_COOLDOWN_MS");
    expect(mainSource).toContain("requestOverlayPanelToggle(action?.source)");
    expect(mainSource).toContain('requestOverlayPanelToggle("gamepad")');
  });
});
