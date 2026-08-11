import { useEffect, useMemo } from "react";
import * as THREE from "three";
import type { RetroGame } from "./retroCollection";
import { CanvasText } from "../components/CanvasText";

interface RetroProceduralCase3DProps {
  game: RetroGame;
  coverTexture: THREE.Texture | null;
  wrapTexture: THREE.Texture | null;
  // Scans avulsos (Internet Archive, Pinterest, etc.) — quando existem,
  // têm prioridade sobre o slicing do wrapTexture, já que representam a
  // face real em vez de um recorte aproximado. spineTexture é opcional
  // de propósito: lombada raramente tem scan dedicado, então na
  // ausência dela o fallback de texto continua entrando normalmente.
  frontTexture?: THREE.Texture | null;
  backTexture?: THREE.Texture | null;
  spineTexture?: THREE.Texture | null;
}

interface ConsoleCaseSpecs {
  width: number;
  height: number;
  depth: number;
  plasticColor: string;
  clearcoat: number;
  transmission: number;
  roughness: number;
  // fração do wrap total (0-1) ocupada pela lombada. Se omitido, é
  // calculada por depth / (2*width + depth) — aproximação física do
  // quanto a lombada "pesa" no wrap comparado às capas frente/trás.
  // Deixe explícito quando a arte de referência tiver bleed/margem
  // diferente do cálculo puro (foi o caso do PS2 abaixo).
  spineFraction?: number;
}

const CONSOLE_SPECS: Record<string, ConsoleCaseSpecs> = {
  PS2: {
    width: 1.36,
    height: 2.02,
    depth: 0.14,
    plasticColor: "#141312",
    clearcoat: 0.6,
    transmission: 0.12,
    roughness: 0.35,
    spineFraction: 0.07, // valor calibrado a olho pro wrap original, mantido
  },
  PS1: {
    width: 1.72,
    height: 1.72,
    depth: 0.15,
    plasticColor: "#22252a",
    clearcoat: 0.85,
    transmission: 0.25,
    roughness: 0.2,
  },
  SNES: {
    width: 1.85,
    height: 1.35,
    depth: 0.22,
    plasticColor: "#2a2622",
    clearcoat: 0.3,
    transmission: 0.05,
    roughness: 0.65,
  },
  SWITCH: {
    width: 1.2,
    height: 1.92,
    depth: 0.12,
    plasticColor: "#1a1918",
    clearcoat: 0.7,
    transmission: 0.15,
    roughness: 0.25,
  },
  // Fita VHS: mais estreita de frente, bem mais funda (lombada larga),
  // acabamento fosco de papelão/sleeve — sem transmissão, sem clearcoat,
  // roughness bem mais alto que os cases de plástico.
  VHS: {
    width: 1.05,
    height: 1.91,
    depth: 0.25,
    plasticColor: "#100f0e",
    clearcoat: 0.05,
    transmission: 0,
    roughness: 0.85,
    spineFraction: 0.13,
  },
};

const DEFAULT_SPECS: ConsoleCaseSpecs = {
  width: 1.36,
  height: 2.02,
  depth: 0.14,
  plasticColor: "#181716",
  clearcoat: 0.5,
  transmission: 0.1,
  roughness: 0.4,
};

// Fonte única de specs — a prateleira/layout deve importar isto em vez de
// manter uma tabela de larguras separada, senão geometria e espaçamento
// dessincronizam assim que alguém mexer num valor só de um lado.
export function getCaseSpecs(consoleKey: string): ConsoleCaseSpecs {
  return CONSOLE_SPECS[consoleKey] ?? DEFAULT_SPECS;
}

function resolveSpineFraction(specs: ConsoleCaseSpecs) {
  if (specs.spineFraction != null) return specs.spineFraction;
  return specs.depth / (2 * specs.width + specs.depth);
}

export function RetroProceduralCase3D({
  game,
  coverTexture,
  wrapTexture,
  frontTexture,
  backTexture,
  spineTexture,
}: RetroProceduralCase3DProps) {
  const specs = getCaseSpecs(game.console);
  const { width, height, depth } = specs;

  // Meio das dimensões para posicionamento relativo das superfícies
  const halfW = width / 2;
  const halfH = height / 2;
  const halfD = depth / 2;

  // Offsets planos
  const frontZ = halfD + 0.001;
  const backZ = -halfD - 0.001;
  const spineX = -halfW - 0.001;

  // ─── Fatiamento de Texturas (Frente, Lombada e Costas) ─────────────────────
  // Quando uma imagem de Box Wrap completo está disponível (ex: GTA SA, Silent Hill 2, GoW),
  // fatiamos as 3 regiões com precisão milimétrica, agora parametrizado por
  // spineFraction (cada formato tem uma lombada proporcionalmente diferente):
  // - Esquerda (0 a backFraction): Capa Traseira (Costas)
  // - Centro   (backFraction a backFraction+spineFraction): Lombada (Spine)
  // - Direita  (backFraction+spineFraction a 1): Capa Frontal (Frente)
  const { frontTex, spineTex, backTex } = useMemo(() => {
    // Scans avulsos têm prioridade: são a face real, não um recorte
    // aproximado. spine fica de fora do "some" de propósito — pode não
    // existir, e nesse caso cai no fallback de texto mais abaixo mesmo
    // com front/back vindos de scan.
    if (frontTexture || backTexture) {
      return {
        frontTex: frontTexture ?? coverTexture,
        spineTex: spineTexture ?? null,
        backTex: backTexture ?? null,
      };
    }

    if (wrapTexture) {
      const spineFraction = resolveSpineFraction(specs);
      const sideFraction = (1 - spineFraction) / 2; // frente e costas iguais
      const spineOffset = sideFraction; // início da lombada no wrap

      // 1. Capa Frontal (Direita)
      const front = wrapTexture.clone();
      front.wrapS = THREE.ClampToEdgeWrapping;
      front.wrapT = THREE.ClampToEdgeWrapping;
      front.repeat.set(sideFraction, 1);
      front.offset.set(spineOffset + spineFraction, 0);
      front.needsUpdate = true;

      // 2. Lombada (Centro - invertida no U para conectar a Frente com a Frente e as Costas com as Costas)
      const spine = wrapTexture.clone();
      spine.wrapS = THREE.ClampToEdgeWrapping;
      spine.wrapT = THREE.ClampToEdgeWrapping;
      spine.repeat.set(-spineFraction, 1);
      spine.offset.set(spineOffset + spineFraction, 0);
      spine.needsUpdate = true;

      // 3. Capa Traseira (Esquerda)
      const back = wrapTexture.clone();
      back.wrapS = THREE.ClampToEdgeWrapping;
      back.wrapT = THREE.ClampToEdgeWrapping;
      back.repeat.set(sideFraction, 1);
      back.offset.set(0.0, 0);
      back.needsUpdate = true;

      return { frontTex: front, spineTex: spine, backTex: back };
    }

    return {
      frontTex: coverTexture,
      spineTex: null,
      backTex: null,
    };
  }, [coverTexture, wrapTexture, frontTexture, backTexture, spineTexture, specs]);

  useEffect(
    () => () => {
      // Só faz dispose das texturas que este componente clonou (as do
      // slicing do wrap). Texturas avulsas ou o coverTexture puro vêm
      // de fora (cache do hook) e quem criou é quem deve descartar.
      if (wrapTexture && !frontTexture && !backTexture) {
        frontTex?.dispose();
        spineTex?.dispose();
        backTex?.dispose();
      }
    },
    [frontTex, spineTex, backTex, wrapTexture, frontTexture, backTexture],
  );

  const hasFrontCover = Boolean(frontTex);

  return (
    <group>
      {/* ─── Corpo Plástico Principal da Caixa 3D ─────────────────────────── */}
      <mesh castShadow receiveShadow>
        <boxGeometry args={[width, height, depth]} />
        <meshPhysicalMaterial
          color={specs.plasticColor}
          roughness={specs.roughness}
          metalness={0.04}
          clearcoat={specs.clearcoat}
          clearcoatRoughness={0.2}
          transmission={specs.transmission}
          thickness={0.3}
          ior={1.45}
        />
      </mesh>

      {/* ─── Borda Interna / Recuo do Estojo ──────────────────────────────── */}
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[width * 0.98, height * 0.98, depth * 0.92]} />
        <meshStandardMaterial
          color="#0c0b0a"
          roughness={0.8}
          metalness={0.1}
        />
      </mesh>

      {/* ─── Capa Frontal (+Z) ────────────────────────────────────────────── */}
      <group position={[0, 0, frontZ]}>
        {hasFrontCover && frontTex ? (
          <mesh>
            <planeGeometry args={[width * 0.96, height * 0.97]} />
            <meshBasicMaterial
              map={frontTex}
              toneMapped={false}
              side={THREE.FrontSide}
            />
          </mesh>
        ) : (
          <group>
            {/* Fallback procedural quando não há capa */}
            <mesh>
              <planeGeometry args={[width * 0.96, height * 0.97]} />
              <meshBasicMaterial color="#22201d" />
            </mesh>
            <mesh position={[0, height * 0.38, 0.001]}>
              <planeGeometry args={[width * 0.96, height * 0.06]} />
              <meshBasicMaterial color={game.accent} />
            </mesh>
            <CanvasText
              text={game.console}
              position={[0, height * 0.415, 0.004]}
              fontSize={height * 0.042}
              maxWidth={width * 0.8}
              color="#ddd8ca"
            />
            <CanvasText
              text={game.title}
              position={[0, 0, 0.004]}
              fontSize={height * 0.09}
              lineHeight={0.9}
              maxWidth={width * 0.82}
              color="#eee9dd"
              fontRole="display"
            />
            <CanvasText
              text={game.publisher}
              position={[0, -height * 0.41, 0.004]}
              fontSize={height * 0.03}
              maxWidth={width * 0.8}
              color="#928d84"
            />
          </group>
        )}

        {/* Camada de Plástico Transparente / Reflexo Reflexivo Frontal */}
        <mesh position={[0, 0, 0.0015]}>
          <planeGeometry args={[width * 0.96, height * 0.97]} />
          <meshBasicMaterial
            color="#ffffff"
            transparent
            opacity={0.06}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      </group>

      {/* ─── Lombada / Spine (-X) ─────────────────────────────────────────── */}
      <group position={[spineX, 0, 0]} rotation={[0, -Math.PI / 2, 0]}>
        <mesh>
          <planeGeometry args={[depth * 0.96, height * 0.97]} />
          {spineTex ? (
            <meshBasicMaterial
              map={spineTex}
              toneMapped={false}
              side={THREE.DoubleSide}
            />
          ) : (
            <meshBasicMaterial color={game.accent} side={THREE.DoubleSide} />
          )}
        </mesh>

        {/* Texto da Lombada se não houver imagem de lombada */}
        {!spineTex && (
          <CanvasText
            text={game.title.toUpperCase()}
            position={[0, 0, 0.003]}
            rotation={[0, 0, Math.PI / 2]}
            fontSize={Math.min(depth * 0.45, 0.065)}
            maxWidth={height * 0.85}
            color={game.accent === "#ddd8ca" ? "#171615" : "#eee9dd"}
          />
        )}

        {/* Brilho de Plástico na Lombada */}
        <mesh position={[0, 0, 0.001]}>
          <planeGeometry args={[depth * 0.96, height * 0.97]} />
          <meshBasicMaterial
            color="#ffffff"
            transparent
            opacity={0.08}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </mesh>
      </group>

      {/* ─── Capa Traseira (-Z) ───────────────────────────────────────────── */}
      <group position={[0, 0, backZ]} rotation={[0, Math.PI, 0]}>
        {backTex ? (
          <mesh>
            <planeGeometry args={[width * 0.96, height * 0.97]} />
            <meshBasicMaterial
              map={backTex}
              toneMapped={false}
              side={THREE.FrontSide}
            />
          </mesh>
        ) : (
          <group>
            <mesh>
              <planeGeometry args={[width * 0.96, height * 0.97]} />
              <meshStandardMaterial
                color="#1d1b19"
                roughness={0.6}
                metalness={0.1}
              />
            </mesh>
            <CanvasText
              text={game.title.toUpperCase()}
              position={[0, height * 0.35, 0.002]}
              fontSize={height * 0.045}
              maxWidth={width * 0.8}
              color="#757068"
            />
            <CanvasText
              text={`${game.console} • ${game.year} • ${game.publisher}`}
              position={[0, -height * 0.4, 0.002]}
              fontSize={height * 0.03}
              maxWidth={width * 0.85}
              color="#524e48"
            />
          </group>
        )}

        {/* Brilho de Plástico Traseiro */}
        <mesh position={[0, 0, 0.0015]}>
          <planeGeometry args={[width * 0.96, height * 0.97]} />
          <meshBasicMaterial
            color="#ffffff"
            transparent
            opacity={0.05}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      </group>
    </group>
  );
}