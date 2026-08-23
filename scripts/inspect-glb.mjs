#!/usr/bin/env node
import { readFileSync } from "fs";

const file = process.argv[2];
if (!file) {
  console.error("Usage: node scripts/inspect-glb.mjs <path-to-glb>");
  process.exit(1);
}

(async () => {
  let GLTFLoader;
  try {
    const mod = await import("three/examples/jsm/loaders/GLTFLoader.js");
    GLTFLoader = mod.GLTFLoader;
  } catch (e) {
    console.error("");
    console.error("Este script exige 'three' instalado localmente para inspeção de GLB.");
    console.error("Instale temporariamente com: npm i -D three");
    console.error("Ou execute em um ambiente que tenha three disponível.");
    console.error("");
    process.exit(1);
  }

  const { GLTFLoader: Loader } = { GLTFLoader };
  const loader = new Loader();
  const buf = readFileSync(file);
  loader.parse(
    buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
    "",
    (gltf) => {
      const seen = new Set();
      gltf.scene.traverse((node) => {
        if (!node.isMesh) return;
        const mats = Array.isArray(node.material) ? node.material : [node.material];
        for (const m of mats) {
          const key = `${node.name} | mat:${m?.name || "?"}`;
          if (!seen.has(key)) {
            seen.add(key);
            console.log(key);
          }
        }
      });
    },
    (error) => {
      console.error(error);
      process.exit(1);
    },
  );
})();
