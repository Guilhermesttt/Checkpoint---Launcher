import { readFileSync } from "fs";
import { join } from "path";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

const file = process.argv[2];
if (!file) {
  console.error("Usage: node scripts/inspect-glb.mjs <path-to-glb>");
  process.exit(1);
}

const loader = new GLTFLoader();
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
