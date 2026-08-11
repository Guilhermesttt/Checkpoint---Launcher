import { describe, expect, it } from "vitest";

import {
  RETRO_DISPLAY_FONT,
  RETRO_INTERFACE_FONT,
} from "../src/features/retro/components/retroFonts";

describe("retro font assets", () => {
  it("keeps distinct local display and interface font files", () => {
    expect(RETRO_DISPLAY_FONT).toContain("700-normal.woff");
    expect(RETRO_INTERFACE_FONT).toContain("400-normal.woff");
    expect(RETRO_DISPLAY_FONT).not.toBe(RETRO_INTERFACE_FONT);
  });
});
