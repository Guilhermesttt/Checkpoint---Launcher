import { describe, expect, it } from "vitest";

import {
  buildRetroPlatformTextureCatalog,
  collectPlatformTextureUrls,
  isRetroTvScreenMaterial,
  resolveRetroMaterialTextureKey,
} from "../src/features/retro/platform/retroPlatformTextureCatalog";
import { applyScreenMediaTexture } from "../src/features/retro/platform/applyRetroPlatformTextures";
import * as THREE from "three";

const mockCatalog = buildRetroPlatformTextureCatalog({
  "/Textures/sony_pvm-1341__sony_playstation/pvm_screen_and_details_mat_baseColor.png":
    "/assets/Textures/sony_pvm-1341__sony_playstation/pvm_screen_and_details_mat_baseColor.png",
  "/Textures/sony_pvm-1341__sony_playstation/ps1_body_mat_baseColor.png":
    "/assets/Textures/sony_pvm-1341__sony_playstation/ps1_body_mat_baseColor.png",
});

describe("retro platform texture catalog", () => {
  it("indexes PBR maps by material prefix", () => {
    expect(mockCatalog.get("pvm_screen_and_details_mat")?.baseColor).toContain(
      "pvm_screen_and_details_mat_baseColor",
    );
    expect(mockCatalog.get("ps1_body_mat")?.baseColor).toContain("ps1_body_mat_baseColor");
  });

  it("skips runtime texture packs for pre-textured platforms", () => {
    expect(collectPlatformTextureUrls("ps2", mockCatalog)).toEqual([]);
    expect(collectPlatformTextureUrls("snes", mockCatalog)).toEqual([]);
    expect(collectPlatformTextureUrls("nes", mockCatalog)).toEqual([]);
    expect(collectPlatformTextureUrls("gba", mockCatalog)).toEqual([]);
  });

  it("collects PS1 texture packs when external injection is still enabled", () => {
    const ps1Urls = collectPlatformTextureUrls("ps1", mockCatalog, {
      "../../../assets/3D_OBJS/Textures/sony_pvm-1341__sony_playstation/pvm_screen_and_details_mat_baseColor.png":
        "/assets/pvm_screen_and_details_mat_baseColor.png",
    });
    expect(ps1Urls).toHaveLength(1);
  });

  it("resolves PS1 material keys from mesh names", () => {
    expect(
      resolveRetroMaterialTextureKey("pvm_screen_and_details_mat", "Object_12", [], mockCatalog),
    ).toBe("pvm_screen_and_details_mat");
    expect(
      resolveRetroMaterialTextureKey("", "Object_0_ps1_body_mat_0", [], mockCatalog),
    ).toBe("ps1_body_mat");
  });

  it("detects baked GLB TV screen materials without catalog entries", () => {
    expect(isRetroTvScreenMaterial("display", "defaultMaterial001", [])).toBe(true);
    expect(isRetroTvScreenMaterial("tv_case", "defaultMaterial", [])).toBe(false);
  });

  it("applies game artwork to the TV emissive map", () => {
    const scene = new THREE.Group();
    const material = new THREE.MeshStandardMaterial({ name: "display" });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(), material);
    mesh.name = "defaultMaterial001";
    scene.add(mesh);

    const mediaTexture = new THREE.Texture();
    applyScreenMediaTexture(scene, mediaTexture);

    const applied = (scene.children[0] as THREE.Mesh).material as THREE.MeshStandardMaterial;
    expect(applied.emissiveMap).toBeTruthy();
    expect(applied.map).toBeFalsy();
    expect(applied.emissiveIntensity).toBeGreaterThan(0);
  });
});
