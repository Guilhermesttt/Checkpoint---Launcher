import { Suspense, useEffect, useMemo, useRef } from "react";
import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

import {
  resolveRetroPlatform,
  type RetroPlatformDefinition,
} from "./retroPlatformRegistry";
import {
  cloneFilteredPlatformScene,
  createOwnedPlatformMaterialDisposer,
  shouldKeepPlatformNode,
  shouldKeepPvmMeshByMaterial,
} from "./retroPlatformModel";
import { RetroPlatformModelBoundary } from "./RetroPlatformModelBoundary";

import type { StudioTunerParams } from "../studio/retroStudioTuner";

export interface RetroPlatformHardwareProps {
  consoleName: string;
  reducedMotion: boolean;
  tunerParams?: StudioTunerParams;
}

function RetroPlatformHardwareModel({
  definition,
  reducedMotion,
  tunerParams,
}: {
  definition: RetroPlatformDefinition;
  reducedMotion: boolean;
  tunerParams?: StudioTunerParams;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const { scene: sourceScene } = useGLTF(definition.modelUrl);
  const adapted = useMemo(() => {
    const result = cloneFilteredPlatformScene(
      sourceScene,
      (name, matNames) => {
        // PS1 usa o arquivo PVM compartilhado — filtra por material
        if (definition.key === "ps1") {
          return shouldKeepPvmMeshByMaterial("ps1-hardware", matNames);
        }
        // PS2/SNES/NES usam arquivos dedicados — filtra por nome de nó
        return shouldKeepPlatformNode(definition.key, name);
      },
      definition.targetWidth,
    );

    result.scene.traverse((node) => {
      if (!(node instanceof THREE.Mesh)) return;
      node.castShadow = true;
      node.receiveShadow = true;
    });

    const bounds = new THREE.Box3().setFromObject(result.scene);
    const center = bounds.getCenter(new THREE.Vector3());
    result.scene.position.set(-center.x, -bounds.min.y, -center.z);
    result.scene.updateMatrixWorld(true);
    return result;
  }, [definition, sourceScene]);

  useEffect(
    () => createOwnedPlatformMaterialDisposer(adapted.materials),
    [adapted.materials],
  );

  const rotX = tunerParams?.consoleRotX ?? definition.rotation[0];
  const rotYBase = tunerParams?.consoleRotY ?? definition.rotation[1];
  const rotZ = tunerParams?.consoleRotZ ?? definition.rotation[2];

  useFrame(({ clock }) => {
    const group = groupRef.current;
    if (!group) return;
    const drift = reducedMotion ? 0 : Math.sin(clock.elapsedTime * 0.58) * 0.018;
    group.rotation.set(rotX, rotYBase + drift, rotZ);
  });

  return (
    <group
      ref={groupRef}
      data-testid="retro-platform-hardware"
      data-console={definition.aliases[0]}
      position={[...definition.position]}
      rotation={[rotX, rotYBase, rotZ]}
    >
      <primitive object={adapted.scene} />
    </group>
  );
}

export function RetroPlatformHardware({
  consoleName,
  reducedMotion,
  tunerParams,
}: RetroPlatformHardwareProps) {
  const definition = resolveRetroPlatform(consoleName);
  if (!definition) return null;

  const resetKey = `${definition.key}:${definition.modelUrl}`;
  return (
    <RetroPlatformModelBoundary resetKey={resetKey}>
      <Suspense fallback={null}>
        <RetroPlatformHardwareModel
          definition={definition}
          reducedMotion={reducedMotion}
          tunerParams={tunerParams}
        />
      </Suspense>
    </RetroPlatformModelBoundary>
  );
}
