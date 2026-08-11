const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const manifestPath = path.join(root, "src", "features", "retro", "retroConsoleAssets.ts");
const noticePath = path.join(root, "assets", "THIRD_PARTY_3D_ASSETS.md");
const modelsDirectory = path.join(root, "src", "assets", "3D_OBJS", "consoles");
const requiredKeys = ["ps2", "ps1", "snes", "nes", "n64", "genesis", "gba", "switch", "psp"];
const errors = [];

const manifest = fs.readFileSync(manifestPath, "utf8");
const notice = fs.readFileSync(noticePath, "utf8");

const field = (block, name) => block.match(new RegExp(`${name}:\\s*"([^"]+)"`))?.[1];

for (const [index, key] of requiredKeys.entries()) {
  const start = manifest.indexOf(`  ${key}: {`);
  const nextKey = requiredKeys[index + 1];
  const end = nextKey ? manifest.indexOf(`  ${nextKey}: {`, start) : manifest.indexOf("\n};", start);
  if (start < 0 || end < 0) {
    errors.push(`${key}: registro ausente no manifesto`);
    continue;
  }
  const block = manifest.slice(start, end);
  const filename = field(block, "filename");
  const sourceUrl = field(block, "sourceUrl");
  const author = field(block, "author");
  const license = field(block, "license");
  const attribution = field(block, "attribution");

  if (!filename || !filename.endsWith(".glb")) errors.push(`${key}: filename GLB inválido`);
  if (!sourceUrl?.startsWith("https://sketchfab.com/3d-models/")) errors.push(`${key}: URL de origem inválida`);
  if (!author?.trim()) errors.push(`${key}: autor ausente`);
  if (license !== "CC-BY-4.0" || /(?:NC|ND|unknown|ambig)/i.test(license || "")) errors.push(`${key}: licença não permitida`);
  if (!attribution?.includes(author || "__missing__")) errors.push(`${key}: atribuição não contém o autor`);
  if (filename && !fs.existsSync(path.join(modelsDirectory, filename))) errors.push(`${key}: arquivo ausente src/assets/3D_OBJS/consoles/${filename}`);
  for (const token of [filename, sourceUrl, author]) {
    if (token && !notice.includes(token)) errors.push(`${key}: ${token} ausente em THIRD_PARTY_3D_ASSETS.md`);
  }
}

if (errors.length > 0) {
  console.error("Falha na verificação dos assets retrô:");
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log("Assets retrô verificados: 9 modelos CC BY 4.0 com atribuição completa.");
}
