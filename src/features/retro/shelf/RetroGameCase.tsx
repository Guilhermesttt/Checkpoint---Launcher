import { useEffect, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

import type { RetroGame } from "./retroCollection";
import { getRetroCaseMotion } from "./retroCaseMotion";
import { sampleRetroDetailTransition } from "./retroDetailTransition";
import { sampleRetroLibraryReveal } from "./retroLibraryReveal";
import { RetroRealCaseModel3D } from "./RetroRealCaseModel3D";

interface RetroGameCaseProps {
  game: RetroGame;
  position: [number, number, number];
  selected: boolean;
  reducedMotion: boolean;
  detailMode?: boolean;
  revealed?: boolean;
  revealDelayMs?: number;
  onSelect: () => void;
}

// Giro continuo em Y (rad/s) suave ao selecionar o case (0.22 * PI)
const SPIN_SPEED = Math.PI * 0.22;

// Inclinacao elegante ao selecionar
const TILT_X = THREE.MathUtils.degToRad(-2.5);
const TILT_Y = THREE.MathUtils.degToRad(-2.5);

// Cache com limite de 30 entradas (LRU simples): evita crescimento ilimitado
// de texturas na GPU quando o usuário tem muitos jogos customizados.
const TEXTURE_CACHE_MAX = 30;
const coverTextureCache = new Map<string, Promise<THREE.Texture>>();

function loadCoverTexture(url: string): Promise<THREE.Texture> {
  const cached = coverTextureCache.get(url);
  if (cached) return cached;

  // Eviction LRU: remove a entrada mais antiga se o cache está cheio
  if (coverTextureCache.size >= TEXTURE_CACHE_MAX) {
    const oldestKey = coverTextureCache.keys().next().value;
    if (oldestKey !== undefined) coverTextureCache.delete(oldestKey);
  }

  const pending = new Promise<THREE.Texture>((resolve, reject) => {
    new THREE.TextureLoader().load(
      url,
      (texture) => {
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.wrapS = THREE.ClampToEdgeWrapping;
        texture.wrapT = THREE.ClampToEdgeWrapping;
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

  useEffect(() => {
    let active = true;
    if (!url) return () => undefined;

    loadCoverTexture(url).then(
      (loaded) => {
        if (active) setTexture(loaded);
      },
      () => {
        if (active) setTexture(null);
      },
    );

    return () => {
      active = false;
    };
  }, [url]);

  return texture;
}


export function RetroGameCase({
  game,
  position,
  selected,
  reducedMotion,
  detailMode = false,
  revealed = true,
  revealDelayMs = 0,
  onSelect,
}: RetroGameCaseProps) {
  const groupRef = useRef<THREE.Group>(null);
  const spinRef = useRef(0);
  const detailElapsedRef = useRef(0);
  const detailStartRotationRef = useRef<number | null>(null);
  const revealElapsedRef = useRef(0);
  const coverTexture = useCoverTexture(game.coverImage);
  const backTexture = useCoverTexture(game.backImage);
  const wrapTexture = useCoverTexture(game.wrapImage);
  const motion = getRetroCaseMotion({
    selected,
    reducedMotion,
    is3D: true,
  });

  useFrame((state, delta) => {
    const group = groupRef.current;
    if (!group) return;

    if (detailMode) {
      if (detailStartRotationRef.current === null) {
        detailStartRotationRef.current = group.rotation.y;
        detailElapsedRef.current = 0;
      }
      detailElapsedRef.current += reducedMotion ? 1000 : delta * 1000;
      const sample = sampleRetroDetailTransition(
        detailElapsedRef.current,
        detailStartRotationRef.current,
      );
      const detailIdleMotion = sample.progress >= 1 && !reducedMotion
        ? {
            y: Math.sin(state.clock.elapsedTime * 1.35) * 0.035,
            rotationY: Math.sin(state.clock.elapsedTime * 0.85) * 0.035,
            rotationZ: Math.sin(state.clock.elapsedTime * 1.1) * 0.012,
          }
        : { y: 0, rotationY: 0, rotationZ: 0 };
      group.position.set(
        position[0] + sample.x,
        position[1] + sample.y + detailIdleMotion.y,
        position[2] + sample.z,
      );
      group.scale.setScalar(motion.scale * sample.scale);
      group.rotation.x = THREE.MathUtils.damp(group.rotation.x, 0, 16, delta);
      group.rotation.y = sample.rotationY + detailIdleMotion.rotationY;
      group.rotation.z = detailIdleMotion.rotationZ;
      spinRef.current = sample.rotationY % (Math.PI * 2);
      return;
    }

    detailStartRotationRef.current = null;
    detailElapsedRef.current = 0;
    group.rotation.z = THREE.MathUtils.damp(group.rotation.z, 0, 12, delta);

    if (!revealed) {
      revealElapsedRef.current = 0;
      group.position.set(position[0], position[1] - 0.72, position[2] - 1.4);
      group.scale.setScalar(0.08);
      return;
    }

    revealElapsedRef.current += delta * 1000;
    const revealMotion = sampleRetroLibraryReveal(
      revealElapsedRef.current,
      revealDelayMs,
      reducedMotion,
    );

    if (revealMotion.progress < 1) {
      group.position.set(
        position[0],
        position[1] + revealMotion.y,
        position[2] + revealMotion.z,
      );
      group.scale.setScalar(motion.scale * revealMotion.scale);
      group.rotation.x = THREE.MathUtils.damp(group.rotation.x, 0, 12, delta);
      group.rotation.y = THREE.MathUtils.damp(
        group.rotation.y,
        motion.rotationY,
        10,
        delta,
      );
      return;
    }

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
    group.scale.setScalar(
      THREE.MathUtils.damp(group.scale.x, motion.scale, motion.damping, delta),
    );

    if (selected) {
      // Giro continuo suave ao estar selecionado
      spinRef.current += delta * SPIN_SPEED;
      const fullTurn = Math.PI * 2;
      spinRef.current = ((spinRef.current % fullTurn) + fullTurn) % fullTurn;

      group.rotation.y = spinRef.current + TILT_Y;
      group.rotation.x = THREE.MathUtils.damp(
        group.rotation.x,
        TILT_X,
        motion.damping,
        delta,
      );
    } else {
      spinRef.current = THREE.MathUtils.damp(
        spinRef.current,
        0,
        motion.damping,
        delta,
      );
      group.rotation.y = THREE.MathUtils.damp(
        group.rotation.y,
        motion.rotationY,
        motion.damping,
        delta,
      );
      group.rotation.x = THREE.MathUtils.damp(
        group.rotation.x,
        0,
        motion.damping,
        delta,
      );
    }
  });

  return (
    <group
      ref={groupRef}
      position={position}
      onClick={(event) => {
        event.stopPropagation();
        if (!detailMode) onSelect();
      }}
      onPointerEnter={(event) => {
        event.stopPropagation();
        if (!detailMode) document.body.style.cursor = "pointer";
      }}
      onPointerLeave={() => {
        document.body.style.cursor = "default";
      }}
    >
      <RetroRealCaseModel3D
        game={game}
        coverTexture={coverTexture}
        backTexture={backTexture}
        wrapTexture={wrapTexture}
      />
    </group>
  );
}
