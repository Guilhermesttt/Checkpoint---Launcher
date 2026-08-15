import { readFileSync } from "fs";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

const file = process.argv[2];
if (!file) {
  console.error("Usage: node scripts/inspect-glb-textures.mjs <path-to-glb>");
  process.exit(1);
}

const loader = new GLTFLoader();
const buf = readFileSync(file);
loader.parse(
  buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
  "",
  (gltf) => {
    const { parser } = gltf;
    const json = parser.json;

    console.log("=== IMAGES ===");
    (json.images ?? []).forEach((img, i) => {
      console.log(`[${i}]`, img.uri ?? `bufferView:${img.bufferView}`, img.mimeType ?? "");
    });

    console.log("\n=== TEXTURES ===");
    (json.textures ?? []).forEach((tex, i) => {
      console.log(`[${i}] source image=${tex.source}`);
    });

    console.log("\n=== MATERIALS ===");
    (json.materials ?? []).forEach((mat, i) => {
      const pbr = mat.pbrMetallicRoughness ?? {};
      console.log(`[${i}] ${mat.name}`, {
        baseColorTexture: pbr.baseColorTexture?.index,
        normalTexture: mat.normalTexture?.index,
      });
    });

    console.log("\n=== MESHES ===");
    const seen = new Set();
    gltf.scene.traverse((node) => {
      if (!node.isMesh) return;
      const mats = Array.isArray(node.material) ? node.material : [node.material];
      for (const m of mats) {
        const key = `${node.name} | mat:${m?.name || "?"}`;
        if (!seen.has(key)) {
          seen.add(key);
          const map = m?.map;
          const img = map?.image;
          console.log(key, {
            mapSize: img ? `${img.width}x${img.height}` : null,
            textureIndex: map?.userData?.gltfTextureIndex,
          });
        }
      }
    });
  },
  (error) => {
    console.error(error);
    process.exit(1);
  },
);
