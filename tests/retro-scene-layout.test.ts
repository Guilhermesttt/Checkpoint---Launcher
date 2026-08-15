import { describe, expect, it } from "vitest";

import { usesRetroEnvironmentScene } from "../src/features/retro/platform/retroPlatformEnvironments";
import {
  clampLayoutValue,
  getRetroSceneLayout,
  resolveSceneLayoutView,
} from "../src/features/retro/scene/retroSceneLayout";

describe("retro scene layout", () => {
  it("resolves layout view from page state", () => {
    expect(resolveSceneLayoutView("details", "jogos")).toBe("details");
    expect(resolveSceneLayoutView("library", "jogos")).toBe("jogos");
    expect(resolveSceneLayoutView("library", "colecao")).toBe("colecao");
    expect(resolveSceneLayoutView("library", "config")).toBe("colecao");
  });

  it("provides per-platform defaults", () => {
    const ps2Jogos = getRetroSceneLayout("ps2", "jogos");
    const ps2Colecao = getRetroSceneLayout("ps2", "colecao");
    const ps1Jogos = getRetroSceneLayout("ps1", "jogos");
    expect(ps2Jogos.cameraZoom).toBe(71.53);
    expect(ps2Jogos.cameraPositionX).toBe(0.44);
    expect(ps2Colecao.cameraZoom).toBe(91.94);
    expect(ps1Jogos.cameraZoom).toBe(68.5);
    expect(ps2Jogos.stageTargetSize).toBeGreaterThan(0);
  });

  it("uses per-platform details scene presets", () => {
    const ps1Details = getRetroSceneLayout("ps1", "details");
    const ps2Details = getRetroSceneLayout("ps2", "details");
    const nesDetails = getRetroSceneLayout("nes", "details");
    const snesDetails = getRetroSceneLayout("snes", "details");
    const gbaDetails = getRetroSceneLayout("gba", "details");
    expect(ps1Details.cameraFov).toBe(47.72);
    expect(ps1Details.cameraZoom).toBe(260);
    expect(ps1Details.stageTargetSize).toBe(3.08);
    expect(ps1Details.environmentRotationY).toBe(1.28);
    expect(ps1Details.caseDetailX).toBe(0.03);
    expect(ps2Details.cameraFov).toBe(45.56);
    expect(ps2Details.cameraPositionX).toBe(1.54);
    expect(ps2Details.caseDetailScale).toBe(0.608);
    expect(ps2Details.stagePositionZ).toBe(13.732);
    expect(nesDetails.caseDetailZ).toBe(8.47);
    expect(nesDetails.caseDetailScale).toBe(0.78);
    expect(snesDetails.caseDetailZ).toBe(7.65);
    expect(snesDetails.caseDetailScale).toBe(0.57);
    expect(gbaDetails.cameraZoom).toBe(124);
    expect(gbaDetails.caseDetailScale).toBe(1.11);
    expect(gbaDetails.stageRotationY).toBe(-0.62);
    expect(ps1Details.stagePositionX).not.toBe(ps2Details.stagePositionX);
  });

  it("clamps layout values to field bounds", () => {
    expect(clampLayoutValue("cameraPositionX", 999)).toBe(20);
    expect(clampLayoutValue("cameraPositionX", -999)).toBe(-20);
  });
});

describe("retro platform environments", () => {
  it("enables shared brutalist room in details for every platform", () => {
    expect(usesRetroEnvironmentScene("ps1", "details")).toBe(true);
    expect(usesRetroEnvironmentScene("ps2", "details")).toBe(true);
    expect(usesRetroEnvironmentScene("snes", "details")).toBe(true);
    expect(usesRetroEnvironmentScene("gba", "details")).toBe(true);
    expect(usesRetroEnvironmentScene("ps1", "jogos")).toBe(false);
  });
});
