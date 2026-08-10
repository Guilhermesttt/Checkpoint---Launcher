/* eslint-disable react-hooks/immutability -- Three.js GLB adaptation is intentionally imperative. */
import { useEffect, useMemo } from "react";
import type { RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF, useTexture } from "@react-three/drei";
import * as THREE from "three";

import dvdCaseModelUrl from "../../assets/3D_OBJS/dvdgame_case(1).glb";
import godOfWarWrapUrl from "../../assets/Retro_Capes/PS2/god-of-war-wrap-optimized.jpg";
import type { RetroGame } from "./retroCollection";
import { createRetroDiscTexture } from "./RetroDisc";
import { splitGeometryByDepth } from "./retroGeometry";
import { classifyDvdCaseNode, type DvdCaseNodeRole } from "./retroModels";

interface RetroPs2GameCaseModelProps {
  game: RetroGame;
  inspected: boolean;
  reducedMotion: boolean;
  hingeRef: RefObject<THREE.Group | null>;
}

interface AdaptedCaseResources {
  root: THREE.Group;
  disc: THREE.Group;
  frontPivot: THREE.Group;
  geometries: THREE.BufferGeometry[];
  materials: THREE.Material[];
  scale: number;
}

function sourceMaterials(material: THREE.Material | THREE.Material[]) {
  return Array.isArray(material) ? material : [material];
}

function prepareMaterial(
  source: THREE.Material,
  role: DvdCaseNodeRole,
  artwork: THREE.Texture,
  discArtwork: THREE.Texture | null,
) {
  const material = source.clone();
  if (material instanceof THREE.MeshStandardMaterial) {
    if (role === "artwork") {
      material.map = artwork;
      material.color.set("#ffffff");
    } else if (role === "disc-art" && discArtwork) {
      material.map = discArtwork;
      material.color.set("#ffffff");
    }
    material.side = THREE.DoubleSide;
    material.needsUpdate = true;
  }
  return material;
}

function makeMesh(geometry: THREE.BufferGeometry, material: THREE.Material) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.frustumCulled = false;
  return mesh;
}

export function RetroPs2GameCaseModel({
  game,
  inspected,
  reducedMotion,
  hingeRef,
}: RetroPs2GameCaseModelProps) {
  const { scene: sourceScene } = useGLTF(dvdCaseModelUrl);
  const sourceArtwork = useTexture(godOfWarWrapUrl);
  const artwork = useMemo(() => {
    const texture = sourceArtwork.clone();
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.flipY = false;
    texture.needsUpdate = true;
    return texture;
  }, [sourceArtwork]);
  const discArtwork = useMemo(() => createRetroDiscTexture(game), [game]);

  const adapted = useMemo<AdaptedCaseResources>(() => {
    sourceScene.updateMatrixWorld(true);
    const root = new THREE.Group();
    const rear = new THREE.Group();
    const frontPivot = new THREE.Group();
    const frontContent = new THREE.Group();
    const disc = new THREE.Group();
    const geometries: THREE.BufferGeometry[] = [];
    const materials: THREE.Material[] = [];
    const caseBounds = new THREE.Box3();

    sourceScene.traverse((node: THREE.Object3D) => {
      if (!(node instanceof THREE.Mesh)) return;
      const role = classifyDvdCaseNode(node.name);
      if (role === "discard" || role === "detail") return;
      if (role === "disc" && node.name.toLowerCase().includes("colored"))
        return;

      const bakedGeometry = node.geometry.clone();
      bakedGeometry.applyMatrix4(node.matrixWorld);
      bakedGeometry.rotateX(-Math.PI / 2);
      bakedGeometry.rotateZ(-Math.PI / 2);
      const material = prepareMaterial(
        sourceMaterials(node.material)[0],
        role,
        artwork,
        discArtwork,
      );
      materials.push(material);

      if (role === "disc" || role === "disc-art") {
        geometries.push(bakedGeometry);
        disc.add(makeMesh(bakedGeometry, material));
        return;
      }

      caseBounds.expandByObject(makeMesh(bakedGeometry, material));
      const split = splitGeometryByDepth(bakedGeometry);
      if (!split) {
        geometries.push(bakedGeometry);
        rear.add(makeMesh(bakedGeometry, material));
        return;
      }

      bakedGeometry.dispose();
      geometries.push(split.front, split.rear);
      frontContent.add(makeMesh(split.rear, material));
      rear.add(makeMesh(split.front, material));
    });

    const leftEdge = caseBounds.isEmpty() ? -0.095 : caseBounds.min.x;
    const caseDepth = caseBounds.isEmpty()
      ? 0.014
      : caseBounds.max.z - caseBounds.min.z;
    frontPivot.position.x = leftEdge;
    frontContent.position.x = -leftEdge;
    frontContent.position.z = caseDepth * 1.02;
    frontPivot.add(frontContent);
    root.add(rear, frontPivot, disc);
    const size = caseBounds.getSize(new THREE.Vector3());
    const center = caseBounds.getCenter(new THREE.Vector3());
    root.position.copy(center.multiplyScalar(-1));

    return {
      root,
      disc,
      frontPivot,
      geometries,
      materials,
      scale: size.x > 0 ? 1.08 / size.x : 1,
    };
  }, [artwork, discArtwork, sourceScene]);

  useEffect(() => {
    hingeRef.current = adapted.frontPivot;
    return () => {
      adapted.geometries.forEach((geometry) => geometry.dispose());
      adapted.materials.forEach((material) => material.dispose());
      artwork.dispose();
      discArtwork?.dispose();
      if (hingeRef.current === adapted.frontPivot) hingeRef.current = null;
    };
  }, [adapted, artwork, discArtwork, hingeRef]);

  useFrame((_, delta) => {
    adapted.disc.visible = inspected;
    if (!inspected || reducedMotion) return;
    adapted.disc.rotation.z -= delta * 0.34;
  });

  return <primitive object={adapted.root} scale={adapted.scale} />;
}

useGLTF.preload(dvdCaseModelUrl);
useTexture.preload(godOfWarWrapUrl);
