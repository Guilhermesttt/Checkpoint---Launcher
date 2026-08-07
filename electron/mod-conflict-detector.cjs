const fs = require("node:fs");
const path = require("node:path");

/**
 * Lê os manifestos salvos na pasta de manifestos de um jogo e identifica
 * arquivos destino comuns afetados por mais de um mod ativo simultaneamente.
 *
 * @param {string} manifestRoot Caminho absoluto da pasta de manifestos
 * @returns {Array<{ relativePath: string, mods: Array<{ installId: string, modId: string, name: string }> }>}
 */
function detectModConflicts(manifestRoot) {
  if (!manifestRoot || typeof manifestRoot !== "string" || !fs.existsSync(manifestRoot)) {
    return [];
  }

  const fileToModsMap = new Map();

  try {
    const entries = fs.readdirSync(manifestRoot);
    for (const entry of entries) {
      if (!entry.endsWith(".json")) continue;
      const manifestPath = path.join(manifestRoot, entry);
      try {
        const raw = fs.readFileSync(manifestPath, "utf-8");
        const manifest = JSON.parse(raw);

        // Apenas considera mods ativos (enabled !== false)
        if (manifest && manifest.enabled !== false && Array.isArray(manifest.files)) {
          const modMeta = {
            installId: manifest.installId || entry.replace(".json", ""),
            modId: manifest.modId || "",
            name: manifest.name || entry,
          };

          for (const fileItem of manifest.files) {
            if (!fileItem || !fileItem.relativePath) continue;
            const normPath = String(fileItem.relativePath).replace(/\\/g, "/").toLowerCase();
            const existing = fileToModsMap.get(normPath) || [];
            existing.push(modMeta);
            fileToModsMap.set(normPath, existing);
          }
        }
      } catch {
        // Ignora manifestos corrompidos silenciosamente
      }
    }
  } catch {
    return [];
  }

  const conflicts = [];
  for (const [relativePath, mods] of fileToModsMap.entries()) {
    if (mods.length > 1) {
      conflicts.push({ relativePath, mods });
    }
  }

  return conflicts;
}

module.exports = {
  detectModConflicts,
};
