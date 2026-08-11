import React, { useEffect, useMemo, useState, Suspense } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import type { RetroGame } from "./retroCollection";
import { RetroProceduralCase3D } from "./RetroProceduralCase3D";
import { classifyPostalPs1Node } from "./retroModels";

// Importações dos novos e antigos modelos 3D dos consoles e cartuchos
import ps1ModelUrl from "../../../assets/3D_OBJS/postal_x_psx_cd-r_disk.glb";
import ps2ModelUrl from "../../../assets/3D_OBJS/silent_hill_3_ps2_game_cover.glb";
import snesCartridgeUrl from "../../../assets/3D_OBJS/super_nintendo_cartridge.glb";
import nesCartridgeUrl from "../../../assets/3D_OBJS/nes_cartridge__super_mario_bros.glb";

interface RetroRealCaseModel3DProps {
  game: RetroGame;
  coverTexture: THREE.Texture | null;
  backTexture?: THREE.Texture | null;
  wrapTexture: THREE.Texture | null;
}

// Configurações das coordenadas de corte da etiqueta nos cartuchos (textura 1024x1024)
const CARTRIDGE_LABEL_RECTS = {
  SNES: { x: 256, y: 143, w: 358, h: 777 },
  NES: { x: 305, y: 568, w: 673, h: 393 },
};

/**
 * Função de composição dinâmica via Canvas HTML5.
 * Carrega a textura base do cartucho, desenha a capa do jogo por cima da etiqueta
 * e gera uma textura nova de canvas única para o material do jogo.
 */
function compositeLabelTexture(
  originalTexture: THREE.Texture,
  coverTexture: THREE.Texture,
  rect: { x: number; y: number; w: number; h: number },
  rotationDegrees: number
): THREE.Texture {
  // CORREÇÃO TS: Tipagem explícita para o compilador reconhecer os atributos de imagem
  const originalImage = originalTexture.image as HTMLImageElement;
  const coverImage = coverTexture.image as HTMLImageElement;

  if (!originalImage || !coverImage) return originalTexture;

  const canvas = document.createElement("canvas");
  canvas.width = originalImage.width || 1024;
  canvas.height = originalImage.height || 1024;
  const ctx = canvas.getContext("2d");
  if (!ctx) return originalTexture;

  // 1. Desenha a textura original do cartucho (carcaça)
  ctx.drawImage(originalImage, 0, 0);

  // 2. Desenha a capa rotacionada sobre a etiqueta
  ctx.save();
  ctx.translate(rect.x + rect.w / 2, rect.y + rect.h / 2);
  ctx.rotate((rotationDegrees * Math.PI) / 180);
  if (rotationDegrees % 180 !== 0) {
    ctx.drawImage(coverImage, -rect.h / 2, -rect.w / 2, rect.h, rect.w);
  } else {
    ctx.drawImage(coverImage, -rect.w / 2, -rect.h / 2, rect.w, rect.h);
  }
  ctx.restore();

  const canvasTex = new THREE.CanvasTexture(canvas);
  canvasTex.colorSpace = THREE.SRGBColorSpace;
  canvasTex.wrapS = originalTexture.wrapS;
  canvasTex.wrapT = originalTexture.wrapT;
  canvasTex.minFilter = THREE.LinearMipmapLinearFilter;
  canvasTex.magFilter = THREE.LinearFilter;
  canvasTex.generateMipmaps = true;
  canvasTex.needsUpdate = true;

  return canvasTex;
}

/**
 * Componente interno do PS2 Case (Silent Hill 3).
 * Endireita o modelo (zerando a rotação de Cube_4) e desativa animações.
 */
function Ps2CaseModel({
  coverTexture,
  accent,
}: {
  coverTexture: THREE.Texture | null;
  accent: string;
}) {
  const { scene: sourceScene } = useGLTF(ps2ModelUrl);

  const adapted = useMemo(() => {
    // Clona a cena para garantir isolamento
    const model = sourceScene.clone(true);

    // Endireita a caixinha: Cube_4 tem uma rotação padrão que a deixa torta.
    // Zeramos seu quaternion para deixá-la 100% reta.
    const cubeNode = model.getObjectByName("Cube_4");
    if (cubeNode) {
      cubeNode.quaternion.set(0, 0, 0, 1);
    }
    model.updateMatrixWorld(true);

    const root = new THREE.Group();
    const materials: THREE.Material[] = [];
    const geometries: THREE.BufferGeometry[] = [];
    // Texturas clonadas que precisam de dispose separado (não passam pelo material.dispose)
    const ownedTextures: THREE.Texture[] = [];

    model.traverse((node) => {
      if (!(node instanceof THREE.Mesh)) return;

      const geometry = node.geometry.clone();
      // O modelo já é vertical por padrão (Y-up), mas está invertido.
      // Rotacionamos em Y para ficar de frente e em Z para ficar de cabeça para cima.
      geometry.rotateY(Math.PI);
      geometry.rotateZ(Math.PI);

      const sourceMat = Array.isArray(node.material) ? node.material[0] : node.material;
      const material = sourceMat.clone();

      if (material instanceof THREE.MeshStandardMaterial) {
        if (node.name.includes("Object_4") || material.name === "Material.002") {
          // Mesh da capa: aplica a textura do jogo
          if (coverTexture) {
            // Inverte horizontalmente para corrigir o espelhamento.
            // O clone é rastreado em ownedTextures para dispose correto.
            const flippedTexture = coverTexture.clone();
            flippedTexture.wrapS = THREE.RepeatWrapping;
            flippedTexture.repeat.x = -1;
            flippedTexture.needsUpdate = true;
            ownedTextures.push(flippedTexture);

            material.map = flippedTexture;
            material.color.set("#ffffff");
          } else {
            material.color.set("#3a3a3a");
          }
        } else if (node.name.includes("Object_5") || material.name === "Material.001") {
          // Mesh da carcaça plástica: tinge com a cor de acento do jogo
          material.color.set(accent);
          material.roughness = 0.4;
          material.metalness = 0.1;
        }
        material.side = THREE.DoubleSide;
        material.needsUpdate = true;
      }

      const mesh = new THREE.Mesh(geometry, material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.frustumCulled = false;

      geometries.push(geometry);
      materials.push(material);
      root.add(mesh);
    });

    const bounds = new THREE.Box3().setFromObject(root);
    const size = bounds.getSize(new THREE.Vector3());
    const center = bounds.getCenter(new THREE.Vector3());
    root.position.copy(center.multiplyScalar(-1));

    // Altura calibrada do PS2 (reduzida para 1.85 a pedido)
    const targetHeight = 1.85;
    const scale = size.y > 0 ? targetHeight / size.y : 1;

    return { root, materials, geometries, ownedTextures, scale };
  }, [sourceScene, coverTexture, accent]);

  // Limpeza: dispose de geometrias, materiais e texturas clonadas
  useEffect(() => {
    return () => {
      adapted.geometries.forEach((g) => g.dispose());
      adapted.materials.forEach((m) => m.dispose());
      adapted.ownedTextures.forEach((t) => t.dispose());
    };
  }, [adapted]);

  return <primitive object={adapted.root} scale={adapted.scale} />;
}

/**
 * Componente interno do PS1 Case (Postal X CD Case).
 * Mantém as malhas de capa e contracapa e remove as duas superfícies do disco.
 */
function Ps1CaseModel({
  frontTexture,
  backTexture,
}: {
  frontTexture: THREE.Texture | null;
  backTexture: THREE.Texture | null;
}) {
  const { scene: sourceScene } = useGLTF(ps1ModelUrl);

  const adapted = useMemo(() => {
    // Garante que a matriz global do modelo carregado está computada
    sourceScene.updateMatrixWorld(true);

    const root = new THREE.Group();
    const materials: THREE.Material[] = [];
    const geometries: THREE.BufferGeometry[] = [];

    sourceScene.traverse((node) => {
      if (!(node instanceof THREE.Mesh)) return;

      const mat = Array.isArray(node.material) ? node.material[0] : node.material;
      const matName = mat ? mat.name : "";
      const role = classifyPostalPs1Node(node.name, matName);
      if (role === "disc") return;

      const geometry = node.geometry.clone();

      // Recupera a escala e rotações base do arquivo 3D original
      geometry.applyMatrix4(node.matrixWorld);

      // 1. Levanta o modelo (rotaciona 90 graus no eixo X)
      geometry.rotateX(Math.PI / 2.7);

    

      const sourceMat = Array.isArray(node.material) ? node.material[0] : node.material;
      const material = sourceMat.clone();

      if (material instanceof THREE.MeshStandardMaterial) {
        if (role === "front-artwork" || role === "back-artwork") {
          const artworkTexture = role === "front-artwork" ? frontTexture : backTexture;
          if (artworkTexture) {
            material.map = artworkTexture;
            material.color.set("#ffffff");
          } else {
            material.color.set("#3a3a3a");
          }
        }
        material.side = THREE.DoubleSide;
        material.needsUpdate = true;
      }

      const mesh = new THREE.Mesh(geometry, material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.frustumCulled = false;

      geometries.push(geometry);
      materials.push(material);
      root.add(mesh);
    });

    const bounds = new THREE.Box3().setFromObject(root);
    const size = bounds.getSize(new THREE.Vector3());
    const center = bounds.getCenter(new THREE.Vector3());
    root.position.copy(center.multiplyScalar(-1));

    // CORREÇÃO DA ESCALA: Usamos a MAIOR dimensão do modelo (X, Y ou Z) 
    // como referência para dividir pela altura alvo. Isso impede o bug 
    // de o modelo ficar gigante se o eixo Y calhar de ser a lombada fina da caixa.
    const targetHeight = 1.55;
    const maxDimension = Math.max(size.x, size.y, size.z);
    const scale = maxDimension > 0 ? targetHeight / maxDimension : 1;

    return { root, materials, geometries, scale };
  }, [sourceScene, frontTexture, backTexture]);

  useEffect(() => {
    return () => {
      adapted.geometries.forEach((g) => g.dispose());
      adapted.materials.forEach((m) => m.dispose());
    };
  }, [adapted]);

  return <primitive object={adapted.root} scale={adapted.scale} />;
}

/**
 * Componente interno do SNES Cartridge.
 */
function SnesCartridgeModel({
  coverTexture,
}: {
  coverTexture: THREE.Texture | null;
}) {
  const { scene: sourceScene } = useGLTF(snesCartridgeUrl);
  const [compositedTex, setCompositedTex] = useState<THREE.Texture | null>(null);

  // Encontra a textura base original
  const originalTexture = useMemo<THREE.Texture | null>(() => {
    let tex: THREE.Texture | null = null;
    sourceScene.traverse((node) => {
      if (node instanceof THREE.Mesh) {
        const mat = Array.isArray(node.material) ? node.material[0] : node.material;
        if (mat instanceof THREE.MeshStandardMaterial && mat.map) {
          tex = mat.map;
        }
      }
    });
    return tex;
  }, [sourceScene]);

  // Efeito para compor o rótulo assim que a capa carregar
  useEffect(() => {
    if (!originalTexture || !coverTexture) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCompositedTex(null);
      return;
    }

    const checkAndComposite = () => {
      if (originalTexture.image && coverTexture.image) {
        const tex = compositeLabelTexture(
          originalTexture,
          coverTexture,
          CARTRIDGE_LABEL_RECTS.SNES,
          90
        );
        setCompositedTex(tex);
        return true;
      }
      return false;
    };

    if (!checkAndComposite()) {
      const timer = setInterval(() => {
        if (checkAndComposite()) clearInterval(timer);
      }, 50);
      return () => clearInterval(timer);
    }
  }, [originalTexture, coverTexture]);

  const adapted = useMemo(() => {
    const root = new THREE.Group();
    const materials: THREE.Material[] = [];
    const geometries: THREE.BufferGeometry[] = [];

    sourceScene.traverse((node) => {
      if (!(node instanceof THREE.Mesh)) return;

      const geometry = node.geometry.clone();
      // Aplica matriz e rotaciona para ficar na vertical de frente
      geometry.applyMatrix4(node.matrixWorld);
      geometry.rotateX(-Math.PI / 2);
      geometry.rotateZ(-Math.PI / 2);

      const sourceMat = Array.isArray(node.material) ? node.material[0] : node.material;
      const material = sourceMat.clone();

      if (material instanceof THREE.MeshStandardMaterial) {
        if (compositedTex) {
          material.map = compositedTex;
        }
        material.needsUpdate = true;
      }

      const mesh = new THREE.Mesh(geometry, material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.frustumCulled = false;

      geometries.push(geometry);
      materials.push(material);
      root.add(mesh);
    });

    const bounds = new THREE.Box3().setFromObject(root);
    const size = bounds.getSize(new THREE.Vector3());
    const center = bounds.getCenter(new THREE.Vector3());
    root.position.copy(center.multiplyScalar(-1));

    // Altura proporcional na prateleira retrô
    const targetHeight = 1.35;
    const scale = size.y > 0 ? targetHeight / size.y : 1;

    return { root, materials, geometries, scale };
  }, [sourceScene, compositedTex]);

  // Atualiza dinamicamente o material se o compositedTex chegar depois
  useEffect(() => {
    if (!compositedTex) return;
    adapted.materials.forEach((m) => {
      if (m instanceof THREE.MeshStandardMaterial) {
        m.map = compositedTex;
        m.needsUpdate = true;
      }
    });
  }, [compositedTex, adapted.materials]);

  // Limpeza de recursos para evitar vazamento de memória da GPU
  useEffect(() => {
    return () => {
      adapted.geometries.forEach((g) => g.dispose());
      adapted.materials.forEach((m) => m.dispose());
      if (compositedTex) compositedTex.dispose();
    };
  }, [adapted, compositedTex]);

  return <primitive object={adapted.root} scale={adapted.scale} />;
}

/**
 * Componente interno do NES Cartridge.
 */
function NesCartridgeModel({
  coverTexture,
}: {
  coverTexture: THREE.Texture | null;
}) {
  const { scene: sourceScene } = useGLTF(nesCartridgeUrl);
  const [compositedTex, setCompositedTex] = useState<THREE.Texture | null>(null);

  // Encontra a textura base original
  const originalTexture = useMemo<THREE.Texture | null>(() => {
    let tex: THREE.Texture | null = null;
    sourceScene.traverse((node) => {
      if (node instanceof THREE.Mesh) {
        const mat = Array.isArray(node.material) ? node.material[0] : node.material;
        if (mat instanceof THREE.MeshStandardMaterial && mat.map) {
          tex = mat.map;
        }
      }
    });
    return tex;
  }, [sourceScene]);

  // Efeito para compor o rótulo assim que a capa do jogo carregar
  useEffect(() => {
    if (!originalTexture || !coverTexture) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCompositedTex(null);
      return;
    }

    const checkAndComposite = () => {
      if (originalTexture.image && coverTexture.image) {
        const tex = compositeLabelTexture(
          originalTexture,
          coverTexture,
          CARTRIDGE_LABEL_RECTS.NES,
          90
        );
        setCompositedTex(tex);
        return true;
      }
      return false;
    };

    if (!checkAndComposite()) {
      const timer = setInterval(() => {
        if (checkAndComposite()) clearInterval(timer);
      }, 50);
      return () => clearInterval(timer);
    }
  }, [originalTexture, coverTexture]);

  const adapted = useMemo(() => {
    const root = new THREE.Group();
    const materials: THREE.Material[] = [];
    const geometries: THREE.BufferGeometry[] = [];

    sourceScene.traverse((node) => {
      if (!(node instanceof THREE.Mesh)) return;

      const geometry = node.geometry.clone();
      // Ajusta orientação e escala para ficar na vertical de frente
      geometry.applyMatrix4(node.matrixWorld);
      geometry.rotateX(-Math.PI / 2);
      geometry.rotateZ(-Math.PI / 2);

      const sourceMat = Array.isArray(node.material) ? node.material[0] : node.material;
      const material = sourceMat.clone();

      if (material instanceof THREE.MeshStandardMaterial) {
        if (compositedTex) {
          material.map = compositedTex;
        }
        material.needsUpdate = true;
      }

      const mesh = new THREE.Mesh(geometry, material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.frustumCulled = false;

      geometries.push(geometry);
      materials.push(material);
      root.add(mesh);
    });

    const bounds = new THREE.Box3().setFromObject(root);
    const size = bounds.getSize(new THREE.Vector3());
    const center = bounds.getCenter(new THREE.Vector3());
    root.position.copy(center.multiplyScalar(-1));

    // Altura proporcional na prateleira retrô
    const targetHeight = 1.95;
    const scale = size.y > 0 ? targetHeight / size.y : 1;

    return { root, materials, geometries, scale };
  }, [sourceScene, compositedTex]);

  // Atualiza dinamicamente o material se o compositedTex chegar depois
  useEffect(() => {
    if (!compositedTex) return;
    adapted.materials.forEach((m) => {
      if (m instanceof THREE.MeshStandardMaterial) {
        m.map = compositedTex;
        m.needsUpdate = true;
      }
    });
  }, [compositedTex, adapted.materials]);

  // Limpeza de recursos para evitar vazamento de memória da GPU
  useEffect(() => {
    return () => {
      adapted.geometries.forEach((g) => g.dispose());
      adapted.materials.forEach((m) => m.dispose());
      if (compositedTex) compositedTex.dispose();
    };
  }, [adapted, compositedTex]);

  return <primitive object={adapted.root} scale={adapted.scale} />;
}

/**
 * Componente principal que escolhe e renderiza o modelo 3D real do case
 * correspondente ao console do jogo. Fallbacks automáticos garantidos.
 */
export function RetroRealCaseModel3D({
  game,
  coverTexture,
  backTexture,
  wrapTexture,
}: RetroRealCaseModel3DProps) {
  const consoleName = game.console.toUpperCase();

  switch (consoleName) {
    case "PS2":
      return (
        <Suspense
          fallback={
            <RetroProceduralCase3D
              game={game}
              coverTexture={coverTexture}
              wrapTexture={wrapTexture}
              frontTexture={coverTexture}
              backTexture={backTexture}
            />
          }
        >
          <Ps2CaseModel coverTexture={coverTexture || wrapTexture} accent={game.accent} />
        </Suspense>
      );

    case "PS1":
      return (
        <Suspense
          fallback={
            <RetroProceduralCase3D
              game={game}
              coverTexture={coverTexture}
              wrapTexture={wrapTexture}
              frontTexture={coverTexture}
              backTexture={backTexture}
            />
          }
        >
          <Ps1CaseModel
            frontTexture={coverTexture || wrapTexture}
            backTexture={backTexture || coverTexture || wrapTexture}
          />
        </Suspense>
      );

    case "SNES":
      return (
        <Suspense
          fallback={
            <RetroProceduralCase3D
              game={game}
              coverTexture={coverTexture}
              wrapTexture={wrapTexture}
            />
          }
        >
          <SnesCartridgeModel coverTexture={coverTexture || wrapTexture} />
        </Suspense>
      );

    case "NES":
      return (
        <Suspense
          fallback={
            <RetroProceduralCase3D
              game={game}
              coverTexture={coverTexture}
              wrapTexture={wrapTexture}
            />
          }
        >
          <NesCartridgeModel coverTexture={coverTexture || wrapTexture} />
        </Suspense>
      );

    default:
      // Fallback padrão para consoles sem modelo dedicado (ex: SWITCH, VHS, GENESIS)
      return (
        <RetroProceduralCase3D
          game={game}
          coverTexture={coverTexture}
          wrapTexture={wrapTexture}
          frontTexture={coverTexture}
          backTexture={backTexture}
        />
      );
  }
}
