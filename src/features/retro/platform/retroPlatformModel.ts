import * as THREE from "three";

import type { RetroPlatformKey } from "./retroPlatformRegistry";

// ===========================================================================
// Classificação dos nós da PVM (arquivo compartilhado PS1 + TV)
// ===========================================================================
//
// Nós reais em sony_pvm-1341__sony_playstation.glb (inspecionados via GLB JSON):
//
// TV PVM:
//   Nodes pai:  (nenhum padrão claro — os meshes filhos são Object_N)
//   Materials:  pvm_side_body_mat, pvm_panel_and_more_mat,
//               pvm_front_and_back_mat, pvm_screen_and_details_mat
//
// Hardware PS1:
//   Nodes pai:  Ps1_body_18, body_inner_12, laser_disc_rotor_13,
//               laser_plate_14, Ps1_body_details_15, ps1_cap_16,
//               ps_controller.001_4, ps_controller.002_5,
//               power_10, power.001_11,
//               connector.001_0, connector_1, connector_2.001_2, connector_2_3
//   Materials:  ps1_body_mat, ps1_details_mat, ps1_controller, ps1_cable_mat,
//               plugs
//
// ===========================================================================

export type PvmNodeRole = "television" | "ps1-hardware" | "discard";

// Materiais da TV PVM (usados para classificar os meshes Object_N)
const PVM_TV_MATERIALS = new Set([
  "pvm_side_body_mat",
  "pvm_panel_and_more_mat",
  "pvm_front_and_back_mat",
  "pvm_screen_and_details_mat",
]);

// Materiais do hardware PS1
const PS1_HARDWARE_MATERIALS = new Set([
  "ps1_body_mat",
  "ps1_details_mat",
  "ps1_controller",
  "ps1_cable_mat",
  "plugs",
]);

/**
 * Classifica um mesh do arquivo PVM pela lista de nomes de materiais que ele possui.
 * (Os meshes no arquivo PVM se chamam Object_0 .. Object_26 — sem significado no nome.)
 */
export function classifyPvmMesh(materialNames: readonly string[]): PvmNodeRole {
  for (const name of materialNames) {
    if (PVM_TV_MATERIALS.has(name)) return "television";
    if (PS1_HARDWARE_MATERIALS.has(name)) return "ps1-hardware";
  }
  return "discard";
}

/** Mantém compatibilidade com código que usa classifyPvmNode por nome de nó */
export function classifyPvmNode(_name: string): PvmNodeRole {
  return "discard"; // sem informação — use classifyPvmMesh com materiais
}

// ===========================================================================
// Filtragem de nós por console (baseada em nomes reais dos GLBs)
// ===========================================================================
//
// sony_playstation_2.glb  → nós: PS2_Body, PS2_Box, PS2_Details, Object009
//   Todos começam com "PS2_" ou "Object009"
//
// super_yes.glb           → único mesh: Cylinder001_03 - Default_0
//   Nó pai: Cylinder001
//
// nes_console_and_controller.glb → Console_0 (console) + Controller_1 (controle)
//
// ===========================================================================

export function shouldKeepPlatformNode(key: RetroPlatformKey, name: string): boolean {
  switch (key) {
    case "ps1":
      // Classificado por material (via classifyPvmMesh) — este path não é usado
      // diretamente; RetroPlatformHardware usa shouldKeepPlatformMesh() abaixo.
      return false;
    case "ps2":
      // Nodes reais: PS2_Body, PS2_Box, PS2_Details, Object009 (e seus filhos mesh)
      return /^PS2_/i.test(name) || /^Object009/i.test(name);
    case "snes":
      // Node real: Cylinder001 e o mesh filho Cylinder001_03 - Default_0
      return /^Cylinder001/i.test(name);
    case "nes":
      // Nodes reais: Console_0 e Controller_1 (e filhos Object_N)
      return /^(?:Console|Controller)/i.test(name);
  }
}

/**
 * Classifica um mesh do arquivo PVM para uso em cloneFilteredPlatformScene.
 * Recebe os materiais do mesh para identificar a que parte pertence.
 */
export function shouldKeepPvmMeshByMaterial(
  role: "television" | "ps1-hardware",
  materialNames: readonly string[],
): boolean {
  return classifyPvmMesh(materialNames) === role;
}

// ===========================================================================
// Clonar + filtrar cena GLB
// ===========================================================================

export function cloneFilteredPlatformScene(
  source: THREE.Object3D,
  keepNode: (name: string, materialNames: readonly string[]) => boolean,
  targetWidth: number,
): { scene: THREE.Object3D; materials: THREE.Material[]; scale: number } {
  const scene = source.clone(true);
  const materials: THREE.Material[] = [];
  const rejectedMeshes: THREE.Mesh[] = [];

  scene.traverse((node) => {
    if (!(node instanceof THREE.Mesh)) return;

    const originalMaterials = Array.isArray(node.material)
      ? node.material
      : [node.material];
    const matNames = originalMaterials.map((m) => m.name ?? "");

    if (!keepNode(node.name, matNames)) {
      rejectedMeshes.push(node);
      return;
    }

    const ownedMaterials = originalMaterials.map((material) => {
      const owned = material.clone();
      owned.needsUpdate = true;
      materials.push(owned);
      return owned;
    });

    node.material = Array.isArray(node.material)
      ? ownedMaterials
      : ownedMaterials[0];

    node.castShadow = true;
    node.receiveShadow = true;
  });

  rejectedMeshes.forEach((mesh) => mesh.parent?.remove(mesh));
  scene.updateMatrixWorld(true);

  const bounds = new THREE.Box3().setFromObject(scene);
  const size = bounds.getSize(new THREE.Vector3());
  const width = size.x;
  const scale =
    Number.isFinite(targetWidth) && targetWidth > 0 && width > Number.EPSILON
      ? targetWidth / width
      : 1;

  scene.scale.setScalar(scale);
  scene.updateMatrixWorld(true);

  return { scene, materials, scale };
}

export function createOwnedPlatformMaterialDisposer(
  materials: readonly THREE.Material[],
): () => void {
  const ownedMaterials = [...new Set(materials)];
  let disposed = false;

  return () => {
    if (disposed) return;
    disposed = true;
    ownedMaterials.forEach((material) => material.dispose());
  };
}
