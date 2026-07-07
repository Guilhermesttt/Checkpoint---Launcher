/**
 * emulator-detector.cjs
 *
 * Detects the Steam emulator type used by a local game and provides
 * a normalised parser for its achievement save state.
 *
 * Currently supported:
 *   - Goldberg Steam Emulator v1  (single achievements.json)
 *
 * Designed to be extended easily — add a new EMULATOR_TYPE constant,
 * a detector block in `detectEmulator`, and a parser in `parseAchievementState`.
 */

const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");

// ─── Emulator type identifiers ────────────────────────────────────────────────

const EMULATOR_TYPES = {
  GOLDBERG_V1: "goldberg_v1",
  // Ready for future additions:
  // GOLDBERG_V2: "goldberg_v2",
  // ALI213:      "ali213",
  // TENOKE:      "tenoke",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Reads a UTF-8 (or UTF-8 BOM) file and JSON-parses it.
 * Returns null on any error.
 * @param {string} filePath
 * @returns {object|null}
 */
const tryReadJson = (filePath) => {
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const normalized = raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw;
    return JSON.parse(normalized);
  } catch {
    return null;
  }
};

// ─── Parsers (one per emulator type) ─────────────────────────────────────────

/**
 * Parses Goldberg v1's achievements.json.
 *
 * File lives in:
 *   %APPDATA%\Goldberg SteamEmu Saves\<AppID>\achievements.json
 *
 * Expected structure:
 * {
 *   "ACH_SOME_ID": { "earned": true,  "earned_time": 1720000000 },
 *   "ACH_OTHER":   { "earned": false, "earned_time": 0 },
 *   ...
 * }
 *
 * @param {string} filePath
 * @returns {{ [achievementId: string]: { earned: boolean, earnedTime: number } }}
 */
const parseGoldbergV1 = (filePath) => {
  const data = tryReadJson(filePath);
  if (!data || typeof data !== "object") return {};

  const result = {};
  for (const [id, entry] of Object.entries(data)) {
    if (entry && typeof entry === "object") {
      result[id] = {
        earned: Boolean(entry.earned),
        earnedTime: Number(entry.earned_time ?? entry.earnedTime ?? 0),
      };
    }
  }
  return result;
};

// ─── Emulator detection ───────────────────────────────────────────────────────

/**
 * Retorna os caminhos de diretório e arquivo de saves do Goldberg v1.
 *
 * @param {string} appId Steam App ID
 * @returns {{ savePath: string, watchDir: string }}
 */
function getGoldbergV1Paths(appId) {
  const appDataRoaming = path.join(os.homedir(), "AppData", "Roaming");
  const goldbergClassic = path.join(appDataRoaming, "Goldberg SteamEmu Saves", String(appId));
  const goldbergGse = path.join(appDataRoaming, "GSE Saves", String(appId));

  const appDataBase = fs.existsSync(goldbergGse) ? goldbergGse : goldbergClassic;
  return {
    watchDir: appDataBase,
    savePath: path.join(appDataBase, "achievements.json"),
  };
}

/**
 * Inspects a game directory and returns an object describing the emulator
 * type and the path to the achievement save file/directory to watch.
 *
 * @param {string} gameDir    Absolute path to the folder containing the game .exe
 * @param {string} appId      Steam App ID (as a string of digits)
 * @returns {{
 *   emulatorType: string,
 *   savePath:     string,   // Path to the file (or dir for folder-based emulators)
 *   watchDir:     string,   // Directory to pass to fs.watch()
 * } | null}
 */
function detectEmulator(gameDir, appId) {
  if (!gameDir || !appId) return null;

  const hasSteamApi =
    fs.existsSync(path.join(gameDir, "steam_api64.dll")) ||
    fs.existsSync(path.join(gameDir, "steam_api.dll"));

  if (!hasSteamApi) return null;

  // ── Goldberg v1 — %APPDATA% save (most common) ───────────────────────────
  const paths = getGoldbergV1Paths(appId);

  // Return even if the file doesn't exist yet — the watcher will pick it up
  // the moment Goldberg creates it on first boot or first unlock.
  return {
    emulatorType: EMULATOR_TYPES.GOLDBERG_V1,
    savePath: paths.savePath,
    watchDir: paths.watchDir,   // watch the folder so we catch file creation too
  };

  // ─────────────────────────────────────────────────────────────────────────
  // FUTURE — Goldberg v2 (folder-based, one file per achievement)
  //
  // const goldbergV2Dir = path.join(appDataBase, "achievements");
  // if (fs.existsSync(goldbergV2Dir)) {
  //   return {
  //     emulatorType: EMULATOR_TYPES.GOLDBERG_V2,
  //     savePath:  goldbergV2Dir,
  //     watchDir:  goldbergV2Dir,
  //   };
  // }
  //
  // FUTURE — ALI213 / TENOKE / CODEX
  // Check for ALI213.ini, tenoke_settings/, valve.ini, etc.
  // ─────────────────────────────────────────────────────────────────────────
};

// ─── Unified state parser ─────────────────────────────────────────────────────

/**
 * Given a detected emulator descriptor, reads the current achievement state
 * from disk and returns a normalised map.
 *
 * @param {{ emulatorType: string, savePath: string } | null} detectedEmulator
 * @returns {{ [achievementId: string]: { earned: boolean, earnedTime: number } }}
 */
const parseAchievementState = (detectedEmulator) => {
  if (!detectedEmulator?.savePath) return {};

  switch (detectedEmulator.emulatorType) {
    case EMULATOR_TYPES.GOLDBERG_V1:
      return parseGoldbergV1(detectedEmulator.savePath);

    // Future parsers will be added here as case blocks:
    // case EMULATOR_TYPES.GOLDBERG_V2: return parseGoldbergV2(detectedEmulator.savePath);
    // case EMULATOR_TYPES.ALI213:      return parseAli213(detectedEmulator.savePath);

    default:
      return {};
  }
};

/**
 * Lê o estado de saves do emulador de forma pontual (retroativa) sem iniciar um watcher.
 * Utilizado para popular o painel de conquistas ao carregar a tela.
 *
 * @param {string} appId Steam App ID
 * @returns {{ [achievementId: string]: { earned: boolean, earnedTime: number } }}
 */
function readLocalSavesRetroactive(appId) {
  if (!appId) return {};
  const paths = getGoldbergV1Paths(appId);
  // Por ora suporta apenas Goldberg v1. Pode ser expandido futuramente chamando outros parsers.
  return parseGoldbergV1(paths.savePath);
}

// ─── Exports ─────────────────────────────────────────────────────────────────

module.exports = {
  EMULATOR_TYPES,
  getGoldbergV1Paths,
  detectEmulator,
  parseAchievementState,
  readLocalSavesRetroactive,
};
