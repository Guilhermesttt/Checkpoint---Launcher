import * as THREE from "three";
import { describe, expect, it, vi } from "vitest";

import {
  classifyPvmNode,
  cloneFilteredPlatformScene,
  createOwnedPlatformMaterialDisposer,
  shouldKeepPlatformNode,
} from "../src/features/retro/platform/retroPlatformModel";

describe("retro platform model helpers", () => {
  it.each([
    ["main_body_27", "television"],
    ["front_panel_24", "television"],
    ["glass_and_fence_25", "television"],
    ["Ps1_body_18", "ps1-hardware"],
    ["ps_controller.001_4", "ps1-hardware"],
    ["ps_cable_19", "ps1-hardware"],
    ["unknown_mesh", "discard"],
  ] as const)("classifies %s as %s", (nodeName, role) => {
    expect(classifyPvmNode(nodeName)).toBe(role);
  });

  it.each([
    ["nes", "Console_0", true],
    ["nes", "Controller_1", true],
    ["ps2", "DualShock_Controller", false],
    ["snes", "Cylinder001_03 - Default_0", true],
  ] as const)("keeps %s node %s: %s", (platform, nodeName, expected) => {
    expect(shouldKeepPlatformNode(platform, nodeName)).toBe(expected);
  });

  it("filters rejected meshes while cloning owned materials and normalizing width", () => {
    const source = new THREE.Group();
    const sourceMaterial = new THREE.MeshBasicMaterial({ color: "#ff0000" });
    const keptMesh = new THREE.Mesh(new THREE.BoxGeometry(2, 1, 1), sourceMaterial);
    keptMesh.name = "kept-mesh";
    const rejectedMesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), sourceMaterial);
    rejectedMesh.name = "discarded-mesh";
    source.add(keptMesh, rejectedMesh);
    const sourceDispose = vi.spyOn(sourceMaterial, "dispose");

    const result = cloneFilteredPlatformScene(source, (name) => name === "kept-mesh", 4);
    const clonedMesh = result.scene.getObjectByName("kept-mesh") as THREE.Mesh;

    expect(result.scene.getObjectByName("discarded-mesh")).toBeUndefined();
    expect(clonedMesh.material).not.toBe(sourceMaterial);
    expect(keptMesh.material).toBe(sourceMaterial);
    expect(sourceDispose).not.toHaveBeenCalled();
    expect(result.materials).toContain(clonedMesh.material);
    expect(result.scale).toBe(2);
    expect(new THREE.Box3().setFromObject(result.scene).getSize(new THREE.Vector3()).x).toBeCloseTo(4);
  });

  it("adapts only cloned PS2 standard materials without mutating their source", () => {
    const source = new THREE.Group();
    const sourceMaterial = new THREE.MeshStandardMaterial({
      roughness: 0.94,
      metalness: 0.03,
    });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(2, 1, 1), sourceMaterial);
    mesh.name = "PS2_Body_M_PS2_Details_0";
    source.add(mesh);

    const ps2Result = cloneFilteredPlatformScene(source, () => true, 2, "ps2");
    const ps2Material = (ps2Result.scene.getObjectByName(mesh.name) as THREE.Mesh)
      .material as THREE.MeshStandardMaterial;
    expect(ps2Material).not.toBe(sourceMaterial);
    expect(ps2Material.roughness).toBe(0.68);
    expect(ps2Material.metalness).toBe(0.12);
    expect(sourceMaterial.roughness).toBe(0.94);
    expect(sourceMaterial.metalness).toBe(0.03);

    const snesResult = cloneFilteredPlatformScene(source, () => true, 2, "snes");
    const snesMaterial = (snesResult.scene.getObjectByName(mesh.name) as THREE.Mesh)
      .material as THREE.MeshStandardMaterial;
    expect(snesMaterial.roughness).toBe(0.94);
    expect(snesMaterial.metalness).toBe(0.03);
  });

  it("disposes once per ownership cycle and again after lifecycle replay", () => {
    const material = new THREE.MeshBasicMaterial();
    const dispose = vi.spyOn(material, "dispose");
    const firstCycleCleanup = createOwnedPlatformMaterialDisposer([material, material]);
    const replayCycleCleanup = createOwnedPlatformMaterialDisposer([material]);

    expect(() => {
      firstCycleCleanup();
      firstCycleCleanup();
      replayCycleCleanup();
      replayCycleCleanup();
    }).not.toThrow();
    expect(dispose).toHaveBeenCalledTimes(2);
  });
});
