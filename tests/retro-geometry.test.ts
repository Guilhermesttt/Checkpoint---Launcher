import { describe, expect, it } from "vitest";
import * as THREE from "three";

import { splitGeometryByDepth } from "../src/features/retro/retroGeometry";

function triangleCentroids(geometry: THREE.BufferGeometry) {
  const positions = geometry.getAttribute("position");
  const values: number[] = [];
  for (let index = 0; index < positions.count; index += 3) {
    values.push(
      (positions.getZ(index) +
        positions.getZ(index + 1) +
        positions.getZ(index + 2)) /
        3,
    );
  }
  return values;
}

describe("retro GLB geometry adaptation", () => {
  it("splits a closed case into front and rear triangles by local depth", () => {
    const source = new THREE.BoxGeometry(2, 3, 0.2).toNonIndexed();
    const result = splitGeometryByDepth(source);

    expect(result).not.toBeNull();
    expect(result!.front.getAttribute("position").count).toBeGreaterThan(0);
    expect(result!.rear.getAttribute("position").count).toBeGreaterThan(0);
    expect(
      result!.front.getAttribute("position").count +
        result!.rear.getAttribute("position").count,
    ).toBe(source.getAttribute("position").count);
    expect(
      triangleCentroids(result!.front).every((centroid) => centroid >= 0),
    ).toBe(true);
    expect(
      triangleCentroids(result!.rear).every((centroid) => centroid < 0),
    ).toBe(true);
  });

  it("preserves UV and normal attributes on both articulated halves", () => {
    const result = splitGeometryByDepth(
      new THREE.BoxGeometry(2, 3, 0.2).toNonIndexed(),
    );

    expect(result!.front.hasAttribute("uv")).toBe(true);
    expect(result!.front.hasAttribute("normal")).toBe(true);
    expect(result!.rear.hasAttribute("uv")).toBe(true);
    expect(result!.rear.hasAttribute("normal")).toBe(true);
  });

  it("returns null for geometry without positions", () => {
    expect(splitGeometryByDepth(new THREE.BufferGeometry())).toBeNull();
  });
});
