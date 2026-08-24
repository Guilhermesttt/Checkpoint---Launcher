// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import "../electron/overlay-video.js";

const { createOverlayVideoLayer, appendOverlayVideoLayer } = (window as typeof window & {
  CheckpointOverlayVideo: {
  createOverlayVideoLayer: (
    kind: "social" | "achievement",
    documentRef?: Document,
  ) => HTMLDivElement;
  appendOverlayVideoLayer: (
    shell: HTMLElement,
    kind: "social" | "achievement",
    documentRef?: Document,
  ) => HTMLDivElement;
  };
}).CheckpointOverlayVideo;

describe("videos decorativos dos overlays", () => {
  it.each([
    ["social", "hedrabionics_pindown.io.mp4", true],
    ["achievement", "Overlay_Background.mp4", true],
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

  it("enquadra os videos verticais sem a ampliacao antiga e mantem o fundo visivel", () => {
    const overlayCss = readFileSync(
      path.join(process.cwd(), "electron", "overlay.html"),
      "utf8",
    );

    expect(overlayCss).not.toContain("width: 160%;");
    expect(overlayCss).not.toContain("height: 160%;");
    expect(overlayCss).toContain("width: 35%;");
    expect(overlayCss).toContain("height: 286%;");
    expect(overlayCss).toContain("object-fit: fill;");
    expect(overlayCss).toContain("opacity: 0.52;");
  });

  it("insere a camada antes do conteudo existente do card", () => {
    const shell = document.createElement("div");
    const content = document.createElement("div");
    content.className = "overlay-content";
    shell.append(content);

    const layer = appendOverlayVideoLayer(shell, "social", document);

    expect(shell.firstElementChild).toBe(layer);
    expect(shell.lastElementChild).toBe(content);
  });

  it("inclui os dois videos no pacote e fora da compactacao ASAR", () => {
    const packageJson = JSON.parse(
      readFileSync(path.join(process.cwd(), "package.json"), "utf8"),
    ) as { build: { files: string[]; asarUnpack: string[] } };
    const videos = [
      "src/assets/hedrabionics_pindown.io.mp4",
      "src/assets/Overlay_Background.mp4",
    ];

    expect(packageJson.build.files).toEqual(expect.arrayContaining(videos));
    expect(packageJson.build.asarUnpack).toEqual(expect.arrayContaining(videos));
  });
});
