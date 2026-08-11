import { Suspense, useEffect, useMemo, useRef } from "react";
import { useTexture } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

export interface RetroTvScreenProps {
  artworkUrl?: string;
  reducedMotion: boolean;
}

// ─── Plano de textura dentro da TV ───────────────────────────────────────────

function TvArtworkPlane({ url }: { url: string }) {
  const sourceTexture = useTexture(url);
  const texture = useMemo(() => {
    const t = sourceTexture.clone();
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = THREE.ClampToEdgeWrapping;
    t.wrapT = THREE.ClampToEdgeWrapping;
    t.needsUpdate = true;
    return t;
  }, [sourceTexture]);

  useEffect(() => () => texture.dispose(), [texture]);

  return (
    <mesh position={[0, 0, 0.005]}>
      <planeGeometry args={[2.55, 1.85]} />
      <meshBasicMaterial
        map={texture}
        // Brilho extra para simular tela CRT iluminada
        color={new THREE.Color(2.0, 1.9, 1.75)}
        toneMapped={false}
      />
    </mesh>
  );
}

// ─── TV procedural CRT ────────────────────────────────────────────────────────
//
//  Dimensões:
//    W=3.1  H=2.5  D=0.32  → proporção clássica CRT 4:3
//    Screen: 2.6 × 1.9
//
//  Posição no mundo:
//    Configurada pelo grupo pai em RetroPlatformDisplay.
//
export function RetroTvScreen({ artworkUrl, reducedMotion }: RetroTvScreenProps) {
  const groupRef = useRef<THREE.Group>(null);

  const W = 3.1;
  const H = 2.5;
  const D = 0.38;
  const SW = 2.6;  // screen width
  const SH = 1.9;  // screen height
  const screenZ = D / 2;

  // Bob suave
  useFrame(({ clock }) => {
    const g = groupRef.current;
    if (!g || reducedMotion) return;
    g.position.y = Math.sin(clock.elapsedTime * 0.42) * 0.015;
  });

  return (
    <group ref={groupRef}>
      {/* Corpo externo da TV */}
      <mesh castShadow receiveShadow>
        <boxGeometry args={[W, H, D]} />
        <meshStandardMaterial
          color="#101014"
          roughness={0.88}
          metalness={0.08}
        />
      </mesh>

      {/* Entalhe interno da tela (recesso escuro) */}
      <mesh position={[0, 0.1, screenZ - 0.005]}>
        <planeGeometry args={[SW + 0.12, SH + 0.08]} />
        <meshStandardMaterial color="#070709" roughness={1} metalness={0} />
      </mesh>

      {/* Detalhe: moldura interna do bezel */}
      <mesh position={[0, 0.1, screenZ - 0.002]}>
        <planeGeometry args={[SW + 0.22, SH + 0.18]} />
        <meshStandardMaterial color="#161618" roughness={0.92} metalness={0.05} />
      </mesh>

      {/* Tela preta de fundo */}
      <mesh position={[0, 0.1, screenZ + 0.002]}>
        <planeGeometry args={[SW, SH]} />
        <meshBasicMaterial color="#010203" toneMapped={false} />
      </mesh>

      {/* Artwork do jogo na tela (colocada na frente de todas as molduras) */}
      {artworkUrl ? (
        <group position={[0, 0.1, screenZ + 0.015]}>
          <Suspense fallback={null}>
            <TvArtworkPlane url={artworkUrl} />
          </Suspense>
        </group>
      ) : null}

      {/* Luz de brilho da tela */}
      <pointLight
        position={[0, 0.1, screenZ + 1.2]}
        color="#b0c8ff"
        intensity={artworkUrl ? 2.8 : 0.6}
        distance={5.5}
        decay={2}
      />

      {/* Base/suporte */}
      <mesh position={[0, -H / 2 - 0.06, 0]} castShadow receiveShadow>
        <boxGeometry args={[W * 0.55, 0.12, D * 0.65]} />
        <meshStandardMaterial color="#0a0a0e" roughness={0.9} metalness={0.05} />
      </mesh>
    </group>
  );
}
