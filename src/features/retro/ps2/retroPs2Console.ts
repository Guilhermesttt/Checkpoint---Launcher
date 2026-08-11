import * as THREE from "three";

const PS2_CONSOLE_MESH_PATTERNS = [
  /^PS2_(?:Body|Box|Details)/i,
  /^Object009.*PS2_Body/i,
];

export function isPs2ConsoleMeshName(name: string): boolean {
  return PS2_CONSOLE_MESH_PATTERNS.some((pattern) => pattern.test(name));
}

export function adaptPs2ConsoleMaterial(material: THREE.Material): void {
  if (!(material instanceof THREE.MeshStandardMaterial)) return;

  material.roughness = Math.min(material.roughness, 0.68);
  material.metalness = Math.max(material.metalness, 0.12);
}
