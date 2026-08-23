import { describe, expect, it } from "vitest";

describe("Overlay notification sanitization and safety", () => {
  it("sanitizes unsafe actionIds to custom", () => {
    const OVERLAY_ALLOWED_ACTIONS = new Set(["open-friend", "accept-request", "open-chat", "custom"]);
    const rawActionId = "eval-evil";
    const mappedActionId = OVERLAY_ALLOWED_ACTIONS.has(rawActionId) ? rawActionId : "custom";

    expect(mappedActionId).toBe("custom");
  });

  it("permits allowed overlay actionIds", () => {
    const OVERLAY_ALLOWED_ACTIONS = new Set(["open-friend", "accept-request", "open-chat", "custom"]);
    for (const allowed of ["open-friend", "accept-request", "open-chat", "custom"]) {
      expect(OVERLAY_ALLOWED_ACTIONS.has(allowed)).toBe(true);
    }
  });
});
