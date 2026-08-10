/* eslint-disable react-refresh/only-export-components -- The GLB adapter reuses the component's disc texture factory. */
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

import type { RetroGame } from "./retroCollection";

interface RetroDiscProps {
  game: RetroGame;
  visible: boolean;
  reducedMotion: boolean;
}

export function createRetroDiscTexture(game: RetroGame) {
  const canvas = document.createElement("canvas");
  canvas.width = 768;
  canvas.height = 768;
  const context = canvas.getContext("2d");
  if (!context) return null;

  const center = canvas.width / 2;
  const gradient = context.createRadialGradient(
    center,
    center,
    40,
    center,
    center,
    360,
  );
  gradient.addColorStop(0, "#0d0d0d");
  gradient.addColorStop(0.18, "#292522");
  gradient.addColorStop(0.62, game.accent);
  gradient.addColorStop(1, "#11100f");
  context.fillStyle = gradient;
  context.fillRect(0, 0, canvas.width, canvas.height);

  context.strokeStyle = "rgba(238, 233, 221, 0.46)";
  context.lineWidth = 5;
  context.beginPath();
  context.arc(center, center, 326, 0, Math.PI * 2);
  context.stroke();

  context.fillStyle = "#eee9dd";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.font = "700 54px Georgia, serif";
  const title = game.title.toUpperCase();
  context.fillText(
    title.length > 24 ? `${title.slice(0, 22)}…` : title,
    center,
    232,
  );
  context.font = "28px monospace";
  context.fillStyle = "rgba(238, 233, 221, 0.78)";
  context.fillText(`${game.console}  /  ${game.year}`, center, 292);
  context.fillText("CHECKPOINT ARCHIVE", center, 515);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  return texture;
}

export function RetroDisc({ game, visible, reducedMotion }: RetroDiscProps) {
  const discRef = useRef<THREE.Group>(null);
  const texture = useMemo(() => createRetroDiscTexture(game), [game]);

  useEffect(
    () => () => {
      texture?.dispose();
    },
    [texture],
  );

  useFrame((_, delta) => {
    if (!discRef.current || !visible || reducedMotion) return;
    discRef.current.rotation.z -= delta * 0.34;
  });

  return (
    <group ref={discRef} visible={visible} position={[0.18, 0, 0.092]}>
      <mesh>
        <ringGeometry args={[0.082, 0.43, 96]} />
        <meshStandardMaterial
          map={texture ?? undefined}
          color={texture ? "#ffffff" : game.accent}
          metalness={0.42}
          roughness={0.34}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh position={[0, 0, 0.004]}>
        <ringGeometry args={[0.056, 0.09, 48]} />
        <meshStandardMaterial
          color="#d8d5cc"
          metalness={0.82}
          roughness={0.2}
        />
      </mesh>
    </group>
  );
}
