import * as THREE from "three";

export interface SplitRetroGeometry {
  front: THREE.BufferGeometry;
  rear: THREE.BufferGeometry;
}

function buildGeometryFromVertices(
  source: THREE.BufferGeometry,
  vertexIndices: readonly number[],
): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();

  for (const [name, sourceAttribute] of Object.entries(source.attributes)) {
    const attribute = sourceAttribute as THREE.BufferAttribute;
    const values = new Float32Array(vertexIndices.length * attribute.itemSize);

    vertexIndices.forEach((sourceIndex, targetIndex) => {
      for (let component = 0; component < attribute.itemSize; component += 1) {
        values[targetIndex * attribute.itemSize + component] =
          attribute.array[sourceIndex * attribute.itemSize + component];
      }
    });

    geometry.setAttribute(
      name,
      new THREE.BufferAttribute(
        values,
        attribute.itemSize,
        attribute.normalized,
      ),
    );
  }

  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

export function splitGeometryByDepth(
  geometry: THREE.BufferGeometry,
): SplitRetroGeometry | null {
  if (!geometry.hasAttribute("position")) return null;

  const source = geometry.index ? geometry.toNonIndexed() : geometry;
  const positions = source.getAttribute("position");
  source.computeBoundingBox();
  const bounds = source.boundingBox;
  if (!bounds || positions.count < 3) return null;

  const centerDepth = (bounds.min.z + bounds.max.z) / 2;
  const frontVertices: number[] = [];
  const rearVertices: number[] = [];

  for (let index = 0; index + 2 < positions.count; index += 3) {
    const centroid =
      (positions.getZ(index) +
        positions.getZ(index + 1) +
        positions.getZ(index + 2)) /
      3;
    const target = centroid >= centerDepth ? frontVertices : rearVertices;
    target.push(index, index + 1, index + 2);
  }

  if (frontVertices.length === 0 || rearVertices.length === 0) return null;
  return {
    front: buildGeometryFromVertices(source, frontVertices),
    rear: buildGeometryFromVertices(source, rearVertices),
  };
}
