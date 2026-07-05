#!/usr/bin/env node

const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");
const packageJson = require(path.join(projectRoot, "package.json"));
const pngToIco = require("png-to-ico");

const run = (command, args, options = {}) => {
  const result = spawnSync(command, args, {
    cwd: projectRoot,
    stdio: "inherit",
    shell: false,
    ...options,
  });

  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed with code ${result.status}`);
  }
};

const ensureFreshFile = (filePath) => {
  if (fs.existsSync(filePath)) {
    fs.rmSync(filePath, { force: true });
  }
};

const regenerateWindowsIcon = async () => {
  const sourcePng = path.join(projectRoot, "assets", "icon.png");
  const targetIco = path.join(projectRoot, "assets", "icon.ico");
  const icoBuffer = await pngToIco.default(sourcePng);
  fs.writeFileSync(targetIco, icoBuffer);
  console.log(`[build-portable] regenerated ${path.relative(projectRoot, targetIco)}`);
};

const cleanReleaseDirectories = () => {
  for (const entryName of [
    "win-unpacked",
    "win-unpacked.tmp",
    "builder-debug.yml",
    "builder-effective-config.yaml",
    `Checkpoint-Launcher-${packageJson.version}-windows.zip`,
  ]) {
    const target = path.join(projectRoot, "release", entryName);
    if (fs.existsSync(target)) {
      fs.rmSync(target, { recursive: true, force: true });
    }
  }
};

const runBuilder = (extraArgs = []) => {
  run(process.execPath, [
    path.join(projectRoot, "node_modules", "electron-builder", "cli.js"),
    "--win",
    "dir",
    ...extraArgs,
  ]);
};

const buildPortable = () => {
  run(process.execPath, [path.join(projectRoot, "node_modules", "vite", "bin", "vite.js"), "build"]);
  cleanReleaseDirectories();

  try {
    runBuilder();
  } catch (error) {
    const fallbackElectronDist = path.dirname(require("electron"));
    console.log("[build-portable] electron-builder hit a Windows rename lock. Retrying...");
    runBuilder([`--config.electronDist=${fallbackElectronDist}`]);
  }
};

const zipPortable = () => {
  const artifactBaseName = `Checkpoint-Launcher-${packageJson.version}-windows`;
  const releaseDir = path.join(projectRoot, "release");
  const unpackedDir = path.join(releaseDir, "win-unpacked");
  const zipPath = path.join(releaseDir, `${artifactBaseName}.zip`);

  if (!fs.existsSync(unpackedDir)) {
    throw new Error(`Windows folder not found: ${unpackedDir}`);
  }

  ensureFreshFile(zipPath);

  run("tar.exe", ["-a", "-c", "-f", zipPath, path.basename(unpackedDir)], {
    cwd: releaseDir,
  });

  return { unpackedDir, zipPath };
};

const publishDownloadArtifacts = ({ unpackedDir, zipPath }) => {
  const downloadDir = path.join(projectRoot, "public", "download");
  fs.mkdirSync(downloadDir, { recursive: true });

  const stableZipPath = path.join(downloadDir, "Checkpoint-Launcher-Windows.zip");
  const versionedZipPath = path.join(downloadDir, path.basename(zipPath));

  ensureFreshFile(stableZipPath);
  ensureFreshFile(versionedZipPath);

  fs.copyFileSync(zipPath, versionedZipPath);
  fs.copyFileSync(zipPath, stableZipPath);

  console.log(`[build-portable] windows folder: ${path.relative(projectRoot, unpackedDir)}`);
  console.log(`[build-portable] windows zip: ${path.relative(projectRoot, zipPath)}`);
  console.log(`[build-portable] published: ${path.relative(projectRoot, stableZipPath)}`);
};

const main = async () => {
  await regenerateWindowsIcon();
  buildPortable();
  const artifacts = zipPortable();
  publishDownloadArtifacts(artifacts);
};

main().catch((error) => {
  console.error("[build-portable] failed", error);
  process.exit(1);
});
