import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const {
  MAX_DATA_IMAGE_CHARACTERS,
  sanitizeOverlayImageSource,
} = require("../electron/overlay-image.cjs") as {
  MAX_DATA_IMAGE_CHARACTERS: number;
  sanitizeOverlayImageSource: (value: unknown) => string;
};

describe("imagens do overlay", () => {
  it("preserva avatares base64 maiores que o antigo limite de URL", () => {
    const avatar = `data:image/webp;base64,${"A".repeat(8_000)}`;
    expect(sanitizeOverlayImageSource(avatar)).toBe(avatar);
  });

  it("aceita HTTPS e rejeita fontes inseguras ou grandes demais", () => {
    expect(sanitizeOverlayImageSource("https://cdn.example.com/avatar.png"))
      .toBe("https://cdn.example.com/avatar.png");
    expect(sanitizeOverlayImageSource("javascript:alert(1)")).toBe("");
    expect(sanitizeOverlayImageSource(
      `data:image/png;base64,${"A".repeat(MAX_DATA_IMAGE_CHARACTERS)}`,
    )).toBe("");
  });
});
