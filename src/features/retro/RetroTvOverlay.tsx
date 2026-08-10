/* eslint-disable react-hooks/immutability -- Three.js renderer and cloned GLB resources are imperative by design. */
import { useEffect, useMemo } from "react";
import { createPortal, useFrame, useThree } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";

import jvcTvModelUrl from "../../assets/3D_OBJS/old_jvc_tv(1).glb";
import { classifyJvcMesh, getJvcOverlayScale } from "./retroModels";

function materialList(material: THREE.Material | THREE.Material[]) {
  return Array.isArray(material) ? material : [material];
}

export function RetroTvOverlay() {
  const { scene: sourceScene } = useGLTF(jvcTvModelUrl);
  const { gl, camera, size, viewport } = useThree();
  const overlayScene = useMemo(() => new THREE.Scene(), []);

  const prepared = useMemo(() => {
    const model = sourceScene.clone(true);
    const displayBounds = new THREE.Box3();
    const clonedMaterials: THREE.Material[] = [];

    model.updateMatrixWorld(true);
    model.traverse((node: THREE.Object3D) => {
      if (!(node instanceof THREE.Mesh)) return;
      const materials = materialList(node.material);
      const role = classifyJvcMesh(materials.map((material) => material.name));

      if (role === "display") {
        displayBounds.expandByObject(node);
        node.visible = false;
        return;
      }

      const clones = materials.map((material) => {
        const sourceMap =
          material instanceof THREE.MeshStandardMaterial ? material.map : null;
        const clone = new THREE.MeshBasicMaterial({
          map: sourceMap,
          color: "#8b745b",
          transparent: true,
          opacity: 0.32,
          blending: THREE.AdditiveBlending,
          depthTest: false,
          depthWrite: false,
          toneMapped: false,
        });
        clonedMaterials.push(clone);
        return clone;
      });
      node.material = Array.isArray(node.material) ? clones : clones[0];
      node.castShadow = false;
      node.receiveShadow = false;
      node.frustumCulled = false;
    });

    const displaySize = displayBounds.getSize(new THREE.Vector3());
    const displayCenter = displayBounds.getCenter(new THREE.Vector3());
    model.position.copy(displayCenter.multiplyScalar(-1));

    return {
      model,
      displayWidth: Math.max(0.001, displaySize.x),
      displayHeight: Math.max(0.001, displaySize.y),
      clonedMaterials,
    };
  }, [sourceScene]);

  const scale = getJvcOverlayScale(viewport.height, prepared.displayHeight);

  useEffect(
    () => () => {
      prepared.clonedMaterials.forEach((material) => material.dispose());
    },
    [prepared],
  );

  useFrame(() => {
    const previousAutoClear = gl.autoClear;
    const previousScissorTest = gl.getScissorTest();
    const previousScissor = gl.getScissor(new THREE.Vector4());
    const screenWidth = Math.min(
      size.width,
      (prepared.displayWidth * scale * size.width) / viewport.width,
    );
    const screenHeight = Math.min(
      size.height,
      (prepared.displayHeight * scale * size.height) / viewport.height,
    );
    const left = Math.max(0, (size.width - screenWidth) / 2);
    const bottom = Math.max(0, (size.height - screenHeight) / 2);
    const right = left + screenWidth;
    const top = bottom + screenHeight;
    const strips = [
      [0, top, size.width, size.height - top],
      [0, 0, size.width, bottom],
      [0, bottom, left, screenHeight],
      [right, bottom, size.width - right, screenHeight],
    ] as const;

    gl.autoClear = false;
    gl.clearDepth();
    gl.setScissorTest(true);
    strips.forEach(([x, y, width, height]) => {
      if (width <= 0 || height <= 0) return;
      gl.setScissor(x, y, width, height);
      gl.render(overlayScene, camera);
    });
    gl.setScissor(previousScissor);
    gl.setScissorTest(previousScissorTest);
    gl.autoClear = previousAutoClear;
  }, 2);

  return createPortal(
    <>
      <primitive object={prepared.model} scale={scale} />
    </>,
    overlayScene,
  );
}

useGLTF.preload(jvcTvModelUrl);
