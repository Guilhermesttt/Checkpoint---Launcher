import { Suspense, useEffect, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

import type { RetroGame } from "./retroCollection";
import { getRetroCaseMotion } from "./retroCaseMotion";
import { CanvasText } from "./CanvasText";
import { RetroDisc } from "./RetroDisc";
import { RetroPs2GameCaseModel } from "./RetroPs2GameCaseModel";

interface RetroGameCaseProps {
  game: RetroGame;
  position: [number, number, number];
  selected: boolean;
  inspected: boolean;
  reducedMotion: boolean;
  onSelect: () => void;
}

const coverTextureCache = new Map<string, Promise<THREE.Texture>>();

function loadCoverTexture(url: string): Promise<THREE.Texture> {
  const cached = coverTextureCache.get(url);
  if (cached) return cached;

  const pending = new Promise<THREE.Texture>((resolve, reject) => {
    new THREE.TextureLoader().load(
      url,
      (texture) => {
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.wrapS = THREE.ClampToEdgeWrapping;
        texture.needsUpdate = true;
        resolve(texture);
      },
      undefined,
      reject,
    );
  });

  coverTextureCache.set(url, pending);
  return pending;
}

function useCoverTexture(url?: string) {
  const [texture, setTexture] = useState<THREE.Texture | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    if (!url) return () => undefined;

    loadCoverTexture(url).then(
      (loaded) => {
        if (active) setTexture(loaded);
      },
      () => {
        if (active) setFailed(true);
      },
    );

    return () => {
      active = false;
    };
  }, [url]);

  return { texture, failed };
}

export function RetroGameCase({
  game,
  position,
  selected,
  inspected,
  reducedMotion,
  onSelect,
}: RetroGameCaseProps) {
  const groupRef = useRef<THREE.Group>(null);
  const frontCoverRef = useRef<THREE.Group>(null);
  const { texture, failed } = useCoverTexture(game.coverImage);
  const motion = getRetroCaseMotion({ selected, inspected, reducedMotion });
  const usesPs2Model = selected && game.console === "PS2";

  useFrame((_, delta) => {
    const group = groupRef.current;
    if (!group) return;

    group.position.x = THREE.MathUtils.damp(
      group.position.x,
      position[0],
      motion.damping,
      delta,
    );
    group.position.y = THREE.MathUtils.damp(
      group.position.y,
      position[1],
      motion.damping,
      delta,
    );
    group.position.z = THREE.MathUtils.damp(
      group.position.z,
      position[2],
      motion.damping,
      delta,
    );
    group.rotation.y = THREE.MathUtils.damp(
      group.rotation.y,
      motion.rotationY,
      motion.damping,
      delta,
    );
    group.scale.setScalar(
      THREE.MathUtils.damp(group.scale.x, motion.scale, motion.damping, delta),
    );
    if (frontCoverRef.current) {
      frontCoverRef.current.rotation.y = THREE.MathUtils.damp(
        frontCoverRef.current.rotation.y,
        motion.hingeRotation,
        motion.damping,
        delta,
      );
    }
  });

  const hasCover = Boolean(texture && !failed);

  return (
    <group
      ref={groupRef}
      position={position}
      onClick={(event) => {
        event.stopPropagation();
        onSelect();
      }}
      onPointerEnter={(event) => {
        event.stopPropagation();
        document.body.style.cursor = "pointer";
      }}
      onPointerLeave={() => {
        document.body.style.cursor = "default";
      }}
    >
      <group visible={!usesPs2Model}>
        <mesh castShadow receiveShadow position={[0, 0, -0.015]}>
          <boxGeometry args={[1.46, 2.08, 0.13]} />
          <meshStandardMaterial
            color="#171615"
            roughness={0.58}
            metalness={0.08}
          />
        </mesh>

        <mesh position={[0, 0, 0.054]}>
          <planeGeometry args={[1.32, 1.94]} />
          <meshStandardMaterial
            color="#3d3935"
            emissive="#151311"
            emissiveIntensity={0.22}
            roughness={0.68}
          />
        </mesh>
        <mesh position={[0.18, 0, 0.074]}>
          <torusGeometry args={[0.108, 0.024, 18, 64]} />
          <meshStandardMaterial color="#34302c" roughness={0.5} />
        </mesh>
        <RetroDisc
          game={game}
          visible={motion.discVisible}
          reducedMotion={!motion.rotateDisc}
        />

        <group
          ref={usesPs2Model ? undefined : frontCoverRef}
          position={[-0.73, 0, 0.06]}
        >
          <group position={[0.73, 0, 0]}>
            <mesh castShadow>
              <boxGeometry args={[1.46, 2.08, 0.075]} />
              <meshPhysicalMaterial
                color="#201e1c"
                roughness={0.38}
                metalness={0.04}
                clearcoat={0.42}
                clearcoatRoughness={0.32}
              />
            </mesh>

            <mesh position={[0, 0, -0.039]} rotation={[0, Math.PI, 0]}>
              <planeGeometry args={[1.32, 1.94]} />
              <meshStandardMaterial
                color="#403b37"
                emissive="#171411"
                emissiveIntensity={0.18}
                roughness={0.64}
                side={THREE.DoubleSide}
              />
            </mesh>

            {hasCover && (
              <mesh position={[0, 0, 0.039]}>
                <planeGeometry args={[1.34, 1.96]} />
                <meshBasicMaterial map={texture} toneMapped={false} />
              </mesh>
            )}

            {!hasCover && (
              <group position={[0, 0, 0.041]}>
                <mesh position={[0, 0, -0.002]}>
                  <planeGeometry args={[1.34, 1.96]} />
                  <meshBasicMaterial color="#24211e" />
                </mesh>
                <mesh position={[0, 0.7, 0]}>
                  <planeGeometry args={[1.34, 0.055]} />
                  <meshBasicMaterial color={game.accent} />
                </mesh>
                <CanvasText
                  text={game.console}
                  position={[0, 0.77, 0.006]}
                  fontSize={0.085}
                  maxWidth={0.72}
                  color="#ddd8ca"
                />
                <CanvasText
                  text={game.title}
                  position={[0, 0.06, 0.006]}
                  fontSize={0.2}
                  lineHeight={0.9}
                  maxWidth={1.06}
                  color="#eee9dd"
                  fontRole="display"
                />
                <CanvasText
                  text={game.publisher}
                  position={[0, -0.78, 0.006]}
                  fontSize={0.052}
                  maxWidth={1.05}
                  color="#928d84"
                />
              </group>
            )}
          </group>
        </group>

        <group position={[0.742, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
          <mesh position={[0, 0, -0.003]}>
            <planeGeometry args={[0.15, 2]} />
            <meshBasicMaterial color={game.accent} />
          </mesh>
          <CanvasText
            text={game.title.toUpperCase()}
            position={[0, 0.04, 0.004]}
            rotation={[0, 0, Math.PI / 2]}
            fontSize={0.062}
            maxWidth={1.68}
            color={game.accent === "#ddd8ca" ? "#171615" : "#eee9dd"}
          />
        </group>
      </group>

      {usesPs2Model && (
        <Suspense fallback={null}>
          <RetroPs2GameCaseModel
            game={game}
            inspected={inspected}
            reducedMotion={reducedMotion}
            hingeRef={frontCoverRef}
          />
        </Suspense>
      )}
    </group>
  );
}
