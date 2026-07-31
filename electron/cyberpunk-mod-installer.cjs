"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const AdmZip = require("adm-zip");

const CYBERPUNK_ROOTS = new Set([
  "archive",
  "bin",
  "engine",
  "mods",
  "r6",
  "red4ext",
  "tools",
]);
const MAX_ARCHIVE_ENTRIES = 20_000;
const MAX_ENTRY_BYTES = 768 * 1024 * 1024;

const isInside = (parent, candidate) => {
  const relative = path.relative(path.resolve(parent), path.resolve(candidate));
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
};

const validateCyberpunkGameRoot = async (rawGameRoot) => {
  const gameRoot = path.resolve(String(rawGameRoot || ""));
  if (!path.isAbsolute(String(rawGameRoot || ""))) {
    throw new Error("Configure a pasta raiz do Cyberpunk 2077 antes de instalar.");
  }
  const executable = path.join(gameRoot, "bin", "x64", "Cyberpunk2077.exe");
  const stats = await fs.promises.stat(executable).catch(() => null);
  if (!stats?.isFile()) {
    throw new Error(
      "A pasta selecionada não parece ser a raiz do Cyberpunk 2077 (bin\\x64\\Cyberpunk2077.exe não encontrado).",
    );
  }
  return gameRoot;
};

const normalizeEntryName = (entryName) => {
  const normalized = String(entryName || "").replace(/\\/g, "/").replace(/^\/+/, "");
  const parts = normalized.split("/").filter(Boolean);
  if (
    normalized.includes("\0")
    || parts.length === 0
    || parts.some((part) => part === "." || part === "..")
    || /^[a-z]:/i.test(normalized)
  ) {
    throw new Error("O pacote contém um caminho de arquivo inseguro.");
  }
  return parts;
};

const assertNoSymlinkPath = async (gameRoot, destination) => {
  const relativeParts = path.relative(gameRoot, destination).split(path.sep).filter(Boolean);
  let current = gameRoot;
  for (const part of relativeParts) {
    current = path.join(current, part);
    const stats = await fs.promises.lstat(current).catch(() => null);
    if (stats?.isSymbolicLink()) {
      throw new Error("A pasta de destino contém um link simbólico inseguro.");
    }
  }
};

const findContentLayout = (entries) => {
  const candidates = new Map();
  for (const { parts } of entries) {
    for (let offset = 0; offset < Math.min(parts.length, 5); offset += 1) {
      if (!CYBERPUNK_ROOTS.has(parts[offset].toLowerCase())) continue;
      const prefix = parts.slice(0, offset).map((part) => part.toLowerCase());
      const key = prefix.join("/");
      const current = candidates.get(key) || { prefix, offset, count: 0 };
      current.count += 1;
      candidates.set(key, current);
      break;
    }
  }
  return [...candidates.values()].sort((left, right) => right.count - left.count)[0] || null;
};

const installCyberpunkZip = async ({
  archivePath,
  gameRoot: rawGameRoot,
  backupRoot,
  manifestRoot,
  modId,
  fileId,
  modName,
}) => {
  const gameRoot = await validateCyberpunkGameRoot(rawGameRoot);
  const resolvedArchive = path.resolve(String(archivePath || ""));
  if (path.extname(resolvedArchive).toLowerCase() !== ".zip") {
    throw new Error("A instalação automática desta versão aceita apenas arquivos ZIP.");
  }
  const archiveStats = await fs.promises.stat(resolvedArchive).catch(() => null);
  if (!archiveStats?.isFile()) throw new Error("O arquivo ZIP baixado não foi encontrado.");

  const zip = new AdmZip(resolvedArchive);
  const rawEntries = zip.getEntries();
  if (rawEntries.length === 0 || rawEntries.length > MAX_ARCHIVE_ENTRIES) {
    throw new Error("O pacote ZIP está vazio ou possui arquivos demais.");
  }

  const entries = rawEntries
    .filter((entry) => !entry.isDirectory)
    .map((entry) => {
      const size = Number(entry.header?.size || 0);
      if (size > MAX_ENTRY_BYTES) {
        throw new Error(`O arquivo ${entry.entryName} é grande demais para a instalação segura.`);
      }
      return { entry, parts: normalizeEntryName(entry.entryName) };
    });
  const contentLayout = findContentLayout(entries);
  if (!contentLayout) {
    throw new Error(
      "A estrutura deste ZIP não foi reconhecida. O download foi mantido para instalação manual.",
    );
  }

  const installEntries = entries.filter(({ parts }) =>
    parts.slice(0, contentLayout.offset).every(
      (part, index) => part.toLowerCase() === contentLayout.prefix[index],
    )
    && CYBERPUNK_ROOTS.has(String(parts[contentLayout.offset] || "").toLowerCase()));
  if (installEntries.length === 0) {
    throw new Error("Nenhum arquivo instalável do Cyberpunk 2077 foi encontrado no ZIP.");
  }

  const installId = `${Date.now()}-${crypto.randomUUID()}`;
  const resolvedBackupRoot = path.resolve(backupRoot, "cyberpunk2077", String(modId), installId);
  const resolvedManifestRoot = path.resolve(manifestRoot, "cyberpunk2077", String(modId));
  const changed = [];

  try {
    for (const { entry, parts } of installEntries) {
      const relativeParts = parts.slice(contentLayout.offset);
      const destination = path.resolve(gameRoot, ...relativeParts);
      if (!isInside(gameRoot, destination) || destination === gameRoot) {
        throw new Error("O pacote tentou escrever fora da pasta do jogo.");
      }
      await assertNoSymlinkPath(gameRoot, destination);

      const existing = await fs.promises.lstat(destination).catch(() => null);
      let backupPath = null;
      if (existing?.isDirectory()) {
        throw new Error(`Não foi possível substituir a pasta ${relativeParts.join("\\")}.`);
      }
      if (existing?.isFile()) {
        backupPath = path.resolve(resolvedBackupRoot, ...relativeParts);
        if (!isInside(resolvedBackupRoot, backupPath)) {
          throw new Error("O caminho de backup calculado é inválido.");
        }
        await fs.promises.mkdir(path.dirname(backupPath), { recursive: true });
        await fs.promises.copyFile(destination, backupPath);
      }

      await fs.promises.mkdir(path.dirname(destination), { recursive: true });
      const data = entry.getData();
      await fs.promises.writeFile(destination, data, { flag: "w" });
      changed.push({
        relativePath: relativeParts.join("/"),
        destination,
        backupPath,
      });
    }
  } catch (error) {
    for (const item of [...changed].reverse()) {
      if (item.backupPath) {
        await fs.promises.copyFile(item.backupPath, item.destination).catch(() => {});
      } else if (isInside(gameRoot, item.destination)) {
        await fs.promises.rm(item.destination, { force: true }).catch(() => {});
      }
    }
    throw error;
  }

  await fs.promises.mkdir(resolvedManifestRoot, { recursive: true });
  const manifestPath = path.join(resolvedManifestRoot, `${fileId}-${installId}.json`);
  const manifest = {
    schemaVersion: 1,
    gameDomain: "cyberpunk2077",
    gameRoot,
    modId: String(modId),
    fileId: String(fileId),
    modName: String(modName || ""),
    archivePath: resolvedArchive,
    installedAt: new Date().toISOString(),
    files: changed.map(({ relativePath, backupPath }) => ({ relativePath, backupPath })),
  };
  await fs.promises.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  return {
    installedFiles: changed.length,
    backedUpFiles: changed.filter(({ backupPath }) => Boolean(backupPath)).length,
    manifestPath,
  };
};

module.exports = {
  CYBERPUNK_ROOTS,
  installCyberpunkZip,
  isInside,
  validateCyberpunkGameRoot,
};
