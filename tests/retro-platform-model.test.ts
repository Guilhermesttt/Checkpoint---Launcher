import * as THREE from "three";
import { describe, expect, it, vi } from "vitest";

import {
  classifyPvmMesh,
  cloneFilteredPlatformScene,
  createOwnedPlatformMaterialDisposer,
  shouldKeepPlatformNode,
  shouldKeepPvmMeshByMaterial,
} from "../src/features/retro/platform/retroPlatformModel";

describe("retro platform model helpers", () => {
  it.each([
    ["pvm_panel_and_more_mat", "television"],
    ["pvm_screen_and_details_mat", "television"],
    ["ps1_body_mat", "ps1-hardware"],
    ["ps1_controller", "ps1-hardware"],
    ["unknown_mat", "discard"],
  ] as const)("classifies material %s as %s", (matName, role) => {
    expect(classifyPvmMesh([matName])).toBe(role);
  });

  it("identifies PVM television vs PS1 hardware by material", () => {
    expect(shouldKeepPvmMeshByMaterial("television", ["pvm_panel_and_more_mat"])).toBe(true);
    expect(shouldKeepPvmMeshByMaterial("television", ["ps1_body_mat"])).toBe(false);
    expect(shouldKeepPvmMeshByMaterial("ps1-hardware", ["ps1_body_mat"])).toBe(true);
  });

  it.each([
    ["nes", "Console_0", true],
    ["nes", "Controller_1", true],
    ["ps2", "PS2_Body_M_PS2_Details_0", true],
    ["ps2", "Object009_M_PS2_Body_0", true],
    ["ps2", "Other_Node", false],
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

