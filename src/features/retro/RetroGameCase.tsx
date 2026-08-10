import { useEffect, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

import type { RetroGame } from "./retroCollection";
import { CanvasText } from "./CanvasText";

interface RetroGameCaseProps {
  game: RetroGame;
  position: [number, number, number];
  selected: boolean;
  onSelect: () => void;
  onActiveHoverChange?: (hovered: boolean) => void;
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
  onSelect,
  onActiveHoverChange,
}: RetroGameCaseProps) {
  const groupRef = useRef<THREE.Group>(null);
  const { texture, failed } = useCoverTexture(game.coverImage);

  useFrame((_, delta) => {
    const group = groupRef.current;
    if (!group) return;

    group.position.x = THREE.MathUtils.damp(group.position.x, position[0], 8, delta);
    group.position.y = THREE.MathUtils.damp(group.position.y, position[1], 8, delta);
    group.position.z = THREE.MathUtils.damp(group.position.z, position[2], 8, delta);
    group.rotation.y = THREE.MathUtils.damp(group.rotation.y, selected ? -0.13 : -1.47, 8, delta);
    group.scale.setScalar(THREE.MathUtils.damp(group.scale.x, selected ? 1 : 0.94, 8, delta));
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
        if (selected) onActiveHoverChange?.(true);
      }}
      onPointerLeave={() => {
        document.body.style.cursor = "default";
        if (selected) onActiveHoverChange?.(false);
      }}
    >
      <mesh castShadow receiveShadow>
        <boxGeometry args={[1.46, 2.08, 0.16, 1, 1, 1]} />
        <meshStandardMaterial attach="material-0" color="#181716" roughness={0.62} />
        <meshStandardMaterial attach="material-1" color={game.accent} roughness={0.58} />
        <meshStandardMaterial attach="material-2" color="#171615" roughness={0.7} />
        <meshStandardMaterial attach="material-3" color="#11100f" roughness={0.78} />
        <meshStandardMaterial attach="material-4" color="#25211e" roughness={0.62} />
        <meshStandardMaterial attach="material-5" color="#121110" roughness={0.72} />
      </mesh>

      {hasCover && (
        <mesh position={[0, 0, 0.086]}>
          <planeGeometry args={[1.34, 1.96]} />
          <meshBasicMaterial map={texture} toneMapped={false} />
        </mesh>
      )}

      {!hasCover && (
        <group position={[0, 0, 0.086]}>
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

      <group position={[0.742, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
        <mesh position={[0, 0, -0.003]}>
          <planeGeometry args={[0.15, 2]} />
          <meshBasicMaterial color={game.accent} />
        </mesh>
        <CanvasText
          text={game.title.toUpperCase()}
          position={[0, 0.04, 0.004]}
          rotation={[0, 0, Math.PI / 2]}
          fontSize={0.055}
          maxWidth={1.68}
          color={game.accent === "#ddd8ca" ? "#171615" : "#eee9dd"}
        />
      </group>
    </group>
  );
}
