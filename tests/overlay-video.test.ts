// @vitest-environment jsdom
import { describe, expect, it } from "vitest";

require("../electron/overlay-video.js");
const { createOverlayVideoLayer } = (window as typeof window & {
  CheckpointOverlayVideo: {
  createOverlayVideoLayer: (
    kind: "social" | "achievement",
    documentRef?: Document,
  ) => HTMLDivElement;
  };
}).CheckpointOverlayVideo;

describe("videos decorativos dos overlays", () => {
  it.each([
    ["social", "Kristina_Lane__pindown.io_1785615277.mp4", true],
    ["achievement", "Overlay_Background.mp4", false],
  ] as const)("cria uma camada %s muda e sem interacao", (kind, filename, rotated) => {
    const layer = createOverlayVideoLayer(kind, document);
    const video = layer.querySelector("video");

    expect(video).not.toBeNull();
    expect(video?.muted).toBe(true);
    expect(video?.autoplay).toBe(true);
    expect(video?.loop).toBe(true);
    expect(video?.playsInline).toBe(true);
    expect(video?.getAttribute("src")).toContain(filename);
    expect(video?.classList.contains("is-rotated")).toBe(rotated);
    expect(layer).toHaveAttribute("aria-hidden", "true");
  });
});
