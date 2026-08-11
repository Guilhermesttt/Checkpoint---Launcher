import { Suspense, useEffect, useMemo, useRef } from "react";
import { useGLTF, useTexture } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

import pvmModelUrl from "../../../assets/3D_OBJS/sony_pvm-1341__sony_playstation.glb";
import {
  cloneFilteredPlatformScene,
  createOwnedPlatformMaterialDisposer,
  shouldKeepPvmMeshByMaterial,
} from "./retroPlatformModel";
import { RetroPlatformModelBoundary } from "./RetroPlatformModelBoundary";

export interface RetroPvmTelevisionProps {
  artworkUrl?: string;
  reducedMotion: boolean;
}

function PvmArtworkScreen({ artworkUrl }: { artworkUrl: string }) {
  const sourceTexture = useTexture(artworkUrl);
  const texture = useMemo(() => {
    const ownedTexture = sourceTexture.clone();
    ownedTexture.colorSpace = THREE.SRGBColorSpace;
    ownedTexture.wrapS = THREE.ClampToEdgeWrapping;
    ownedTexture.wrapT = THREE.ClampToEdgeWrapping;
    ownedTexture.needsUpdate = true;
    return ownedTexture;
  }, [sourceTexture]);

  useEffect(() => () => texture.dispose(), [texture]);

  return (
    <mesh position={[0, 0, 0.006]}>
      <planeGeometry args={[2.54, 1.72]} />
      <meshBasicMaterial
        map={texture}
        color={new THREE.Color(2.2, 2.08, 1.82)}
        toneMapped={false}
      />
    </mesh>
  );
}

export function RetroPvmTelevision({
  artworkUrl,
  reducedMotion,
}: RetroPvmTelevisionProps) {
  const groupRef = useRef<THREE.Group>(null);
  const { scene: sourceScene } = useGLTF(pvmModelUrl);
  const adapted = useMemo(() => {
    const result = cloneFilteredPlatformScene(
      sourceScene,
      // Filtra por materiais (os meshes da PVM se chamam Object_N, sem significado no nome)
      (_name, matNames) => shouldKeepPvmMeshByMaterial("television", matNames),
      4.35,
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
  }, [sourceScene]);

  useEffect(
    () => createOwnedPlatformMaterialDisposer(adapted.materials),
    [adapted.materials],
  );

  useFrame(({ clock }) => {
    const group = groupRef.current;
    if (!group) return;
    group.position.y = -1.16 + (
      reducedMotion ? 0 : Math.sin(clock.elapsedTime * 0.48) * 0.012
    );
  });

  return (
    <group
      ref={groupRef}
      data-testid="retro-pvm-television"
      position={[1.25, -1.16, -1.15]}
      rotation={[0, -0.08, 0]}
    >
      <primitive object={adapted.scene} />
      <group
        data-testid="retro-pvm-screen"
        position={[0.02, 1.42, 1.065]}
        rotation={[0, 0, 0]}
      >
        <mesh>
          <planeGeometry args={[2.54, 1.72]} />
          <meshBasicMaterial color="#09090a" toneMapped={false} />
        </mesh>
        {artworkUrl ? (
          <RetroPlatformModelBoundary resetKey={artworkUrl}>
            <Suspense fallback={null}>
              <PvmArtworkScreen artworkUrl={artworkUrl} />
            </Suspense>
          </RetroPlatformModelBoundary>
        ) : null}
      </group>
    </group>
  );
}

useGLTF.preload(pvmModelUrl);
