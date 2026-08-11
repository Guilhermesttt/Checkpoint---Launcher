/* eslint-disable react-hooks/immutability -- Three.js render targets, uniforms, and renderer state are imperative by design. */
import { useEffect, useMemo } from "react";
import type { RefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

import { getCrtProfile } from "./retroCrt";
import { retroCrtFragmentShader, retroCrtVertexShader } from "./retroShaders";

interface RetroCrtPassProps {
  reducedMotion: boolean;
  transitionSignal: RefObject<number>;
}

export function RetroCrtPass({ reducedMotion, transitionSignal }: RetroCrtPassProps) {
  const { gl, scene, camera, size } = useThree();

  const resources = useMemo(() => {
    const profile = getCrtProfile(reducedMotion);
    const target = new THREE.WebGLRenderTarget(1, 1, {
      depthBuffer: true,
      stencilBuffer: false,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
    });
    target.texture.name = "RetroCrtSource";

    const postScene = new THREE.Scene();
    const postCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const material = new THREE.ShaderMaterial({
      name: "RetroCrtMaterial",
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
      vertexShader: retroCrtVertexShader,
      fragmentShader: retroCrtFragmentShader,
      uniforms: {
        tDiffuse: { value: target.texture },
        resolution: { value: new THREE.Vector2(1, 1) },
        time: { value: 0 },
        exposure: { value: profile.exposure },
        blackLift: { value: profile.blackLift },
        curvature: { value: profile.curvature },
        chromaticAberration: { value: profile.chromaticAberration },
        rgbSeparationStrength: { value: profile.rgbSeparation },
        pixelSplitStrength: { value: profile.pixelSplit },
        scanlineStrength: { value: profile.scanline },
        phosphorStrength: { value: profile.phosphorMask },
        bloomStrength: { value: profile.bloom },
        noiseStrength: { value: profile.noise },
        vignetteStrength: { value: profile.vignette },
        flickerStrength: { value: profile.flicker },
        syncTearStrength: { value: profile.syncTear },
        transitionSignal: { value: 0 },
      },
    });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
    quad.frustumCulled = false;
    postScene.add(quad);

    return { target, postScene, postCamera, material, quad };
  }, [reducedMotion]);

  useEffect(() => {
    const pixelRatio = gl.getPixelRatio();
    const width = Math.max(1, Math.floor(size.width * pixelRatio));
    const height = Math.max(1, Math.floor(size.height * pixelRatio));
    resources.target.setSize(width, height);
    resources.material.uniforms.resolution.value.set(width, height);
  }, [gl, resources, size.height, size.width]);

  useEffect(
    () => () => {
      resources.target.dispose();
      resources.quad.geometry.dispose();
      resources.material.dispose();
    },
    [resources],
  );

  useFrame(({ clock }) => {
    const previousTarget = gl.getRenderTarget();
    const previousAutoClear = gl.autoClear;
    gl.autoClear = true;

    gl.setRenderTarget(resources.target);
    gl.clear(true, true, true);
    gl.render(scene, camera);

    resources.material.uniforms.time.value = clock.elapsedTime;
    resources.material.uniforms.transitionSignal.value = transitionSignal.current;

    gl.setRenderTarget(previousTarget);
    gl.clear(true, true, true);
    gl.render(resources.postScene, resources.postCamera);
    gl.autoClear = previousAutoClear;
  }, 1);

  return null;
}
