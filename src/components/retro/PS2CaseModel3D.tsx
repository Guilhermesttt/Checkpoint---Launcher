import React, { useMemo, useRef } from "react";
import * as THREE from "three";
import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import ps2CaseGlbUrl from "../../assets/3D_OBJS/PS2_case.glb";

// Default fallback PS2 cover
import defaultPs2Cover from "../../assets/Retro_Capes/PS2/gta-san-andreas-box.jpg";

export interface PS2CaseModel3DProps {
  coverUrl?: string;
  isHovered?: boolean;
  isSelected?: boolean;
  rotationY?: number;
  rotationX?: number;
  rotationZ?: number;
  scale?: number;
  autoRotate?: boolean;
  position?: [number, number, number];
}

export const PS2CaseModel3D: React.FC<PS2CaseModel3DProps> = ({
  coverUrl,
  isHovered = false,
  isSelected = false,
  rotationY = 0,
  rotationX = 0,
  rotationZ = 0,
  scale = 0.28,
  autoRotate = true,
  position = [0, 0, 0],
}) => {
  const groupRef = useRef<THREE.Group>(null);
  const { scene } = useGLTF(ps2CaseGlbUrl);

  // Carrega a textura e ajusta o mapeamento UV
  const texture = useMemo(() => {
    const loader = new THREE.TextureLoader();
    const urlToLoad = coverUrl || defaultPs2Cover;
    const tex = loader.load(urlToLoad);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;

    // Rotação da imagem na capa
    tex.center.set(0.5, 0.5);

    // IMPORTANTE: Como vamos girar a malha inteira em 180 graus abaixo,
    // se a imagem ficar de ponta-cabeça, altere tex.rotation para 0.
    tex.rotation = Math.PI;

    return tex;
  }, [coverUrl]);

  // Clona a cena e aplica a textura no material
  const clonedScene = useMemo(() => {
    const cloned = scene.clone(true);

    cloned.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        mesh.castShadow = true;
        mesh.receiveShadow = true;

        if (Array.isArray(mesh.material)) {
          mesh.material = mesh.material.map((mat) => {
            const clonedMat = mat.clone() as THREE.MeshStandardMaterial;
            if (mat.name.toLowerCase().includes("art") || mat.name === "Art.001") {
              clonedMat.map = texture;
              clonedMat.roughness = 0.35;
              clonedMat.metalness = 0.05;
              clonedMat.needsUpdate = true;
            }
            return clonedMat;
          });
        } else if (mesh.material) {
          const clonedMat = mesh.material.clone() as THREE.MeshStandardMaterial;
          if (mesh.material.name.toLowerCase().includes("art") || mesh.material.name === "Art.001") {
            clonedMat.map = texture;
            clonedMat.roughness = 0.35;
            clonedMat.metalness = 0.05;
            clonedMat.needsUpdate = true;
          }
          mesh.material = clonedMat;
        }
      }
    });

    return cloned;
  }, [scene, texture]);

  // Animação suave de flutuação e rotação contínua automática
  useFrame((state, delta) => {
    if (!groupRef.current) return;

    const t = state.clock.getElapsedTime();
    const targetY = position[1] + (isSelected ? Math.sin(t * 1.8) * 0.04 : 0);
    groupRef.current.position.y = THREE.MathUtils.damp(groupRef.current.position.y, targetY, 4, delta);

    if (autoRotate && isSelected) {
      // Rotação 360° contínua suave no eixo Y
      groupRef.current.rotation.y += delta * 0.7;
    } else {
      const baseRotation = isSelected ? rotationY : rotationY + (isHovered ? 0.2 : 0);
      groupRef.current.rotation.y = THREE.MathUtils.damp(groupRef.current.rotation.y, baseRotation, 6, delta);
    }

    groupRef.current.rotation.x = THREE.MathUtils.damp(groupRef.current.rotation.x, rotationX, 6, delta);
    groupRef.current.rotation.z = THREE.MathUtils.damp(groupRef.current.rotation.z, rotationZ, 6, delta);
  });

  return (
    <group ref={groupRef} position={position} scale={[scale, scale, scale]} dispose={null}>
      {/* 
        AQUI ESTÁ A CORREÇÃO DA ORIENTAÇÃO DO MODELO
        Girando a cena primitiva em 180 graus (Math.PI) no eixo Z.
        Caso o eixo correto do seu modelo seja o X, mude para: rotation={[Math.PI, 0, 0]}
        Caso seja 90 graus, use Math.PI / 2
      */}
      <primitive object={clonedScene} rotation={[0, 0, Math.PI]} />
    </group>
  );
};

// Preload do GLB
useGLTF.preload(ps2CaseGlbUrl);

export default PS2CaseModel3D;