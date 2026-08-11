"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { extractArchiveEntry, listArchiveEntries } = require("./archive-manager.cjs");

const MAX_ARCHIVE_ENTRIES = 30_000;
const MAX_ENTRY_BYTES = 768 * 1024 * 1024;
const PROFILES_DIR = path.join(__dirname, "game-profiles");

// Cache em memória para perfis carregados
const profileCache = new Map();

/**
 * Carrega o Perfil de Jogo JSON baseado no domínio ou apelido (alias)
 */
function loadGameProfile(gameDomain) {
  const domainKey = String(gameDomain || "").toLowerCase().trim();
  if (profileCache.has(domainKey)) {
    return profileCache.get(domainKey);
  }

  // 1. Tenta carregar direto pelo nome do arquivo (ex: cyberpunk2077.json)
  const directPath = path.join(PROFILES_DIR, `${domainKey}.json`);
  if (fs.existsSync(directPath)) {
    try {
      const content = fs.readFileSync(directPath, "utf8");
      const profile = JSON.parse(content);
      profileCache.set(domainKey, profile);
      return profile;
    } catch {
      // Se falhar o parse, avança para os demais
    }
  }

  // 2. Busca nos perfis existentes por aliases cadastrados (ex: residentevilrequiem -> re-engine.json)
  if (fs.existsSync(PROFILES_DIR)) {
    const files = fs.readdirSync(PROFILES_DIR);
    for (const file of files) {
      if (!file.endsWith(".json")) continue;
      try {
        const fullPath = path.join(PROFILES_DIR, file);
        const profile = JSON.parse(fs.readFileSync(fullPath, "utf8"));
        if (
          profile.gameDomain === domainKey
          || (Array.isArray(profile.aliases) && profile.aliases.includes(domainKey))
        ) {
          profileCache.set(domainKey, profile);
          return profile;
        }
      } catch {
        // Ignora erros individuais de perfis
      }
    }
  }

  // 3. Fallback genérico caso não exista perfil cadastrado
  const fallbackProfile = {
    schemaVersion: 1,
    gameDomain: domainKey,
    displayName: domainKey,
    rootFolders: [
      "mods", "plugins", "data", "bin", "engine", "r6", "archive", "content",
      "pc", "nativedx11", "nativedx12", "x64", "scripts", "redscript", "cet",
      "tweaks", "ue4ss", "game", "system", "dlc", "reframework"
    ],
    rootFiles: [
      "dinput8.dll", "dxgi.dll", "version.dll", "bink2w64.dll", "winmm.dll",
      "xinput1_3.dll", "xinput1_4.dll", "openhook.dll", "d3d11.dll", "d3d12.dll"
    ],
    routingRules: [],
  };
  profileCache.set(domainKey, fallbackProfile);
  return fallbackProfile;
}

const isInside = (parent, candidate) => {
  const relative = path.relative(path.resolve(parent), path.resolve(candidate));
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
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

const isProfileRootItem = (part, profile) => {
  const lower = String(part || "").toLowerCase();
  const rootFolders = new Set((profile.rootFolders || []).map((f) => f.toLowerCase()));
  const rootFiles = new Set((profile.rootFiles || []).map((f) => f.toLowerCase()));
  if (rootFolders.has(lower) || rootFiles.has(lower)) return true;

  if (Array.isArray(profile.routingRules)) {
    const ext = path.extname(lower);
    for (const rule of profile.routingRules) {
      if (rule.condition?.extension?.toLowerCase() === ext && rule.condition?.rootRelative) {
        return true;
      }
    }
  }

  return false;
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

/**
 * Detecta a estrutura de layout interna e remove diretórios wrapper inúteis
 */
const findContentLayout = (entries, profile) => {
  const candidates = new Map();

  for (const { parts } of entries) {
    for (let offset = 0; offset < Math.min(parts.length, 5); offset += 1) {
      if (!isProfileRootItem(parts[offset], profile)) continue;
      const prefix = parts.slice(0, offset).map((part) => part.toLowerCase());
      const key = prefix.join("/");
      const current = candidates.get(key) || { prefix, offset, count: 0 };
      current.count += 1;
      candidates.set(key, current);
      break;
    }
  }

  const sorted = [...candidates.values()].sort((left, right) => right.count - left.count);
  return sorted.length > 0 ? sorted[0] : null;
};

/**
 * Aplica as regras de roteamento (routingRules) do JSON ao caminho do arquivo
 */
const applyRoutingRules = (relativeParts, profile) => {
  if (!Array.isArray(profile.routingRules) || profile.routingRules.length === 0) {
    return relativeParts;
  }

  const filename = relativeParts.at(-1) || "";
  const ext = path.extname(filename).toLowerCase();
  const isRootRelative = relativeParts.length === 1;

  for (const rule of profile.routingRules) {
    const { condition, targetPath } = rule;
    if (!condition || !targetPath) continue;

    let matches = true;
    if (condition.extension && condition.extension.toLowerCase() !== ext) {
      matches = false;
    }
    if (condition.rootRelative && !isRootRelative) {
      matches = false;
    }

    if (matches) {
      const resolvedTarget = targetPath
        .replace("{filename}", filename)
        .replace("{relativePath}", relativeParts.join("/"));
      return resolvedTarget.split("/").filter(Boolean);
    }
  }

  return relativeParts;
};

/**
 * Motor Universal Data-Driven para Instalação de Mods
 */
async function installUniversalMod({
  archivePath,
  gameRoot: rawGameRoot,
  backupRoot,
  manifestRoot,
  gameDomain,
  modId,
  fileId,
  modName,
}) {
  const profile = loadGameProfile(gameDomain);
  const gameRoot = path.resolve(String(rawGameRoot || ""));
  if (!path.isAbsolute(gameRoot)) {
    throw new Error("Configure a pasta raiz do jogo antes de instalar.");
  }

  const resolvedArchive = path.resolve(String(archivePath || ""));
  const archiveStats = await fs.promises.stat(resolvedArchive).catch(() => null);
  if (!archiveStats?.isFile()) {
    throw new Error("O arquivo de mod baixado não foi encontrado.");
  }

  const archiveCtx = await listArchiveEntries(resolvedArchive);
  if (archiveCtx.entries.length === 0 || archiveCtx.entries.length > MAX_ARCHIVE_ENTRIES) {
    throw new Error("O pacote está vazio ou possui arquivos demais.");
  }

  const entries = archiveCtx.entries
    .filter((entry) => !entry.isDirectory)
    .map((entry) => {
      const size = Number(entry.size || 0);
      if (size > MAX_ENTRY_BYTES) {
        throw new Error(`O arquivo ${entry.name} é grande demais para a instalação segura.`);
      }
      return { entry, parts: normalizeEntryName(entry.name) };
    });

  let contentLayout = findContentLayout(entries, profile);
  let isFallback = false;

  if (!contentLayout) {
    isFallback = true;
    const firstTop = entries[0]?.parts[0]?.toLowerCase();
    const hasCommonWrapper = firstTop && entries.every((e) => e.parts.length > 1 && e.parts[0].toLowerCase() === firstTop);
    if (hasCommonWrapper) {
      contentLayout = { prefix: [firstTop], offset: 1, count: entries.length };
    } else {
      contentLayout = { prefix: [], offset: 0, count: entries.length };
    }
  }

  let installEntries = entries.filter(({ parts }) =>
    parts.slice(0, contentLayout.offset).every(
      (part, index) => part.toLowerCase() === contentLayout.prefix[index],
    )
    && (isFallback || isProfileRootItem(parts[contentLayout.offset], profile)));

  if (installEntries.length === 0) {
    const firstTop = entries[0]?.parts[0]?.toLowerCase();
    const hasCommonWrapper = firstTop && entries.every((e) => e.parts.length > 1 && e.parts[0].toLowerCase() === firstTop);
    if (hasCommonWrapper) {
      contentLayout = { prefix: [firstTop], offset: 1, count: entries.length };
      installEntries = entries;
    } else {
      contentLayout = { prefix: [], offset: 0, count: entries.length };
      installEntries = entries;
    }
  }

  const installId = `${Date.now()}-${crypto.randomUUID()}`;
  const resolvedBackupRoot = path.resolve(backupRoot, profile.gameDomain, String(modId), installId);
  const resolvedManifestRoot = path.resolve(manifestRoot, profile.gameDomain, String(modId));
  const changed = [];

  try {
    for (const { entry, parts } of installEntries) {
      let relativeParts = parts.slice(contentLayout.offset);
      // Aplica regras de roteamento (ex: .archive solto -> archive/pc/mod/)
      relativeParts = applyRoutingRules(relativeParts, profile);

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
      await extractArchiveEntry(archiveCtx, entry.name, destination);
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
    if (error && (error.code === "EACCES" || error.code === "EPERM")) {
      const permErr = new Error(
        `Permissão de arquivo negada (${error.code}). A pasta do jogo está protegida pelo Windows (ex: Program Files). Execute o Checkpoint Launcher como Administrador para poder instalar mods neste jogo.`,
      );
      permErr.code = error.code;
      throw permErr;
    }
    throw error;
  }

  await fs.promises.mkdir(resolvedManifestRoot, { recursive: true });
  const manifestPath = path.join(resolvedManifestRoot, `${fileId}-${installId}.json`);
  const manifest = {
    schemaVersion: 1,
    gameDomain: profile.gameDomain,
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
}

/**
 * Vincula mods já instalados no jogo ao launcher (Adoption Universal)
 */
async function adoptUniversalMod({
  archivePath,
  gameRoot: rawGameRoot,
  manifestRoot,
  gameDomain,
  modId,
  fileId,
  modName,
}) {
  const profile = loadGameProfile(gameDomain);
  const gameRoot = path.resolve(String(rawGameRoot || ""));
  const resolvedArchive = path.resolve(String(archivePath || ""));
  const archiveStats = await fs.promises.stat(resolvedArchive).catch(() => null);
  if (!archiveStats?.isFile()) throw new Error("O arquivo de mod baixado nao foi encontrado.");

  const archiveCtx = await listArchiveEntries(resolvedArchive);
  if (archiveCtx.entries.length === 0) {
    throw new Error("O pacote esta vazio ou possui arquivos demais.");
  }
  const entries = archiveCtx.entries
    .filter((entry) => !entry.isDirectory)
    .map((entry) => ({ entry, parts: normalizeEntryName(entry.name) }));

  let layout = findContentLayout(entries, profile);
  let isFallback = false;
  if (!layout) {
    isFallback = true;
    const firstTop = entries[0]?.parts[0]?.toLowerCase();
    const hasCommonWrapper = firstTop && entries.every((e) => e.parts.length > 1 && e.parts[0].toLowerCase() === firstTop);
    layout = hasCommonWrapper ? { prefix: [firstTop], offset: 1, count: entries.length } : { prefix: [], offset: 0, count: entries.length };
  }

  let installEntries = entries.filter(({ parts }) =>
    parts.slice(0, layout.offset).every(
      (part, index) => part.toLowerCase() === layout.prefix[index],
    )
    && (isFallback || isProfileRootItem(parts[layout.offset], profile)));

  if (installEntries.length === 0) {
    installEntries = entries;
  }

  const matchedFiles = [];
  const tempExtractDir = await fs.promises.mkdtemp(path.join(gameRoot, ".adopt-temp-"));

  try {
    for (const { entry, parts } of installEntries) {
      let relativeParts = parts.slice(layout.offset);
      relativeParts = applyRoutingRules(relativeParts, profile);

      const destination = path.resolve(gameRoot, ...relativeParts);
      if (!isInside(gameRoot, destination) || destination === gameRoot) {
        throw new Error("O pacote tentou acessar um arquivo fora da pasta do jogo.");
      }
      const current = await fs.promises.readFile(destination).catch(() => null);
      if (!current) continue;

      const tempFile = path.join(tempExtractDir, "check.tmp");
      await extractArchiveEntry(archiveCtx, entry.name, tempFile);
      const archiveData = await fs.promises.readFile(tempFile).catch(() => null);
      if (!archiveData) continue;

      const currentHash = crypto.createHash("sha256").update(current).digest("hex");
      const archiveHash = crypto.createHash("sha256").update(archiveData).digest("hex");
      if (currentHash !== archiveHash) {
        throw new Error(
          `O arquivo ${relativeParts.join("\\")} difere do pacote e nao pode ser vinculado com seguranca.`,
        );
      }
      matchedFiles.push({ relativePath: relativeParts.join("/"), backupPath: null });
    }
  } finally {
    await fs.promises.rm(tempExtractDir, { recursive: true, force: true }).catch(() => {});
  }

  if (matchedFiles.length === 0) {
    return {
      adopted: false,
      installedFiles: 0,
      backedUpFiles: 0,
      manifestPath: "",
    };
  }

  const installId = `${Date.now()}-${crypto.randomUUID()}`;
  const resolvedManifestRoot = path.resolve(manifestRoot, profile.gameDomain, String(modId));
  await fs.promises.mkdir(resolvedManifestRoot, { recursive: true });
  const manifestPath = path.join(resolvedManifestRoot, `${fileId}-${installId}.json`);
  await fs.promises.writeFile(manifestPath, `${JSON.stringify({
    schemaVersion: 1,
    adopted: true,
    gameDomain: profile.gameDomain,
    gameRoot,
    modId: String(modId),
    fileId: String(fileId),
    modName: String(modName || ""),
    archivePath: resolvedArchive,
    installedAt: new Date().toISOString(),
    files: matchedFiles,
  }, null, 2)}\n`, "utf8");

  return {
    adopted: true,
    installedFiles: matchedFiles.length,
    backedUpFiles: 0,
    manifestPath,
  };
}

module.exports = {
  adoptUniversalMod,
  installUniversalMod,
  loadGameProfile,
};
