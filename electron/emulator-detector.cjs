/**
 * emulator-detector.cjs
 *
 * Implementa o Padrão Adapter para suportar múltiplos emuladores da cena
 * sem quebrar a assinatura original esperada pelo 'main.cjs'.
 */

const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");

// ─── Emulator type identifiers ────────────────────────────────────────────────
const EMULATOR_TYPES = {
  GOLDBERG_V1: "goldberg_v1",
  GOLDBERG_SOCIALCLUB: "goldberg_socialclub",
  TENOKE: "tenoke",
  GENERIC_INI: "generic_ini"
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
const tryReadJson = (filePath) => {
  try {
    if (!fs.existsSync(filePath)) return null;
    const raw = fs.readFileSync(filePath, "utf8");
    const normalized = raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw;
    return JSON.parse(normalized);
  } catch {
    return null;
  }
};

// ─── Estrutura de Adaptadores ───────────────────────────────────────────────

class GoldbergAdapter {
  constructor() {
    this.emulatorType = EMULATOR_TYPES.GOLDBERG_V1;
  }

  _getPaths(appId) {
    const appDataRoaming = path.join(os.homedir(), "AppData", "Roaming");
    const goldbergClassic = path.join(appDataRoaming, "Goldberg SteamEmu Saves", String(appId));
    const goldbergGse = path.join(appDataRoaming, "GSE Saves", String(appId));
    const appDataBase = fs.existsSync(goldbergGse) ? goldbergGse : goldbergClassic;
    return {
      watchDir: appDataBase,
      savePath: path.join(appDataBase, "achievements.json"),
    };
  }

  detect(gamePath) {
    if (!gamePath) return false;
    const hasSteamApi =
      fs.existsSync(path.join(gamePath, "steam_api64.dll")) ||
      fs.existsSync(path.join(gamePath, "steam_api.dll"));
    const hasSteamSettings = fs.existsSync(path.join(gamePath, "steam_settings"));
    return hasSteamApi || hasSteamSettings;
  }

  readAchievements(appId, gamePath, providedSavePath) {
    const savePath = providedSavePath || this._getPaths(appId).savePath;
    const data = tryReadJson(savePath);
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
  }

  writeAchievements(appId, data, gamePath) {
    // Escrita é delegada no main.cjs
    return false;
  }

  watchSaves(appId, callback) {
    return null;
  }
  
  getWatchInfo(appId) {
    const paths = this._getPaths(appId);
    return {
      emulatorType: this.emulatorType,
      savePath: paths.savePath,
      watchDir: paths.watchDir
    };
  }
}

class GoldbergSocialClubAdapter {
  constructor() {
    this.emulatorType = EMULATOR_TYPES.GOLDBERG_SOCIALCLUB;
  }

  _getPaths(appId) {
    const appDataRoaming = path.join(os.homedir(), "AppData", "Roaming");
    const appDataBase = path.join(appDataRoaming, "Goldberg Socialclub Emu Saves", String(appId));
    return {
      watchDir: appDataBase,
      savePath: path.join(appDataBase, "achievements.json"),
    };
  }

  detect(gamePath) {
    if (!gamePath) return false;
    return fs.existsSync(path.join(gamePath, "socialclub_emu.ini")) || 
           fs.existsSync(path.join(gamePath, "socialclub.dll")) ||
           fs.existsSync(path.join(gamePath, "GTA5.exe")) ||
           fs.existsSync(path.join(gamePath, "RDR2.exe"));
  }

  readAchievements(appId, gamePath, providedSavePath) {
    const savePath = providedSavePath || this._getPaths(appId).savePath;
    const data = tryReadJson(savePath);
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
  }

  writeAchievements(appId, data, gamePath) {
    return false;
  }

  watchSaves(appId, callback) {
    return null;
  }
  
  getWatchInfo(appId) {
    const paths = this._getPaths(appId);
    return {
      emulatorType: this.emulatorType,
      savePath: paths.savePath,
      watchDir: paths.watchDir
    };
  }
}

class TenokeAdapter {
  constructor() {
    this.emulatorType = EMULATOR_TYPES.TENOKE;
  }

  _getPaths(appId) {
    const appDataLocal = path.join(os.homedir(), "AppData", "Local");
    const appDataBase = path.join(appDataLocal, "TENOKE", String(appId));
    return {
      watchDir: appDataBase,
      savePath: path.join(appDataBase, "achievements.json"),
    };
  }

  detect(gamePath) {
    if (!gamePath) return false;
    return fs.existsSync(path.join(gamePath, "tenoke.ini"));
  }

  readAchievements(appId, gamePath, providedSavePath) {
    const savePath = providedSavePath || this._getPaths(appId).savePath;
    const data = tryReadJson(savePath);
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
  }

  writeAchievements(appId, data, gamePath) {
    return false;
  }

  watchSaves(appId, callback) {
    return null;
  }
  
  getWatchInfo(appId) {
    const paths = this._getPaths(appId);
    return {
      emulatorType: this.emulatorType,
      savePath: paths.savePath,
      watchDir: paths.watchDir
    };
  }
}

class GenericIniAdapter {
  constructor() {
    this.emulatorType = EMULATOR_TYPES.GENERIC_INI;
  }

  _getPaths(appId, gamePath) {
    let iniPath = null;
    let watchDir = null;
    
    if (gamePath) {
      if (fs.existsSync(path.join(gamePath, "steam_emu.ini"))) {
        iniPath = path.join(gamePath, "steam_emu.ini");
      } else if (fs.existsSync(path.join(gamePath, "ALI213.ini"))) {
        iniPath = path.join(gamePath, "ALI213.ini");
      }
      if (iniPath) watchDir = path.dirname(iniPath);
    }
    
    const publicDocs = path.join(process.env.PUBLIC || "C:\\Users\\Public", "Documents");
    const runePath = path.join(publicDocs, "Steam", "RUNE", String(appId), "remote", "achievements.ini");
    const codexPath = path.join(publicDocs, "Steam", "CODEX", String(appId), "remote", "achievements.ini");
    
    if (fs.existsSync(runePath)) {
      return { watchDir: path.dirname(runePath), savePath: runePath };
    }
    if (fs.existsSync(codexPath)) {
      return { watchDir: path.dirname(codexPath), savePath: codexPath };
    }

    return {
      watchDir: watchDir || gamePath || "",
      savePath: iniPath || "",
    };
  }

  detect(gamePath) {
    if (!gamePath) return false;
    return fs.existsSync(path.join(gamePath, "steam_emu.ini")) || 
           fs.existsSync(path.join(gamePath, "ALI213.ini"));
  }

  readAchievements(appId, gamePath, providedSavePath) {
    const savePath = providedSavePath || this._getPaths(appId, gamePath).savePath;
    if (!savePath || !fs.existsSync(savePath)) return {};

    try {
      const content = fs.readFileSync(savePath, "utf8");
      // Extração simples via RegEx de chaves sob [Achievements]
      const achievementsBlockRegex = /\[(?:Steam)?Achievements\]([\s\S]*?)(?:\[|$)/i;
      const match = content.match(achievementsBlockRegex);
      
      const result = {};
      if (match && match[1]) {
        const lines = match[1].split("\n");
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith(";") || trimmed.startsWith("#")) continue;
          
          const parts = trimmed.split("=");
          if (parts.length >= 2) {
            const key = parts[0].trim();
            const val = parts[1].trim();
            if (key && key.toLowerCase() !== "count") {
              const lowerVal = val.toLowerCase();
              const isBooleanVal = lowerVal === "1" || lowerVal === "0" || lowerVal === "true" || lowerVal === "false";
              
              if (isBooleanVal) {
                // CODEX / ALI213: NomeDaConquista=1
                result[key] = {
                  earned: lowerVal === "1" || lowerVal === "true",
                  earnedTime: Date.now() / 1000
                };
              } else {
                // RUNE: Achievement0=NomeDaConquista
                result[val] = {
                  earned: true,
                  earnedTime: Date.now() / 1000
                };
              }
            }
          }
        }
      }
      return result;
    } catch {
      return {};
    }
  }

  writeAchievements(appId, data, gamePath) {
    return false; // Modo Read-Only
  }

  watchSaves(appId, callback) {
    return null; // Modo Read-Only
  }
  
  getWatchInfo(appId, gamePath) {
    const paths = this._getPaths(appId, gamePath);
    return {
      emulatorType: this.emulatorType,
      savePath: paths.savePath,
      watchDir: paths.watchDir
    };
  }
}

// ─── Seletor Universal e Escaneamento de Caminhos (Baseado no Hydra) ──────────

const adapters = [
  new GoldbergSocialClubAdapter(), // Prioridade alta para testes de GTA
  new TenokeAdapter(),
  new GenericIniAdapter(),
  new GoldbergAdapter() // Fallback padrão
];

const getScannedEmulator = (appId, gameDir) => {
  if (!appId) return null;

  const appData = path.join(os.homedir(), "AppData", "Roaming");
  const localAppData = path.join(os.homedir(), "AppData", "Local");
  const programData = process.env.PROGRAMDATA || "C:\\ProgramData";
  const publicDocs = path.join(process.env.PUBLIC || "C:\\Users\\Public", "Documents");
  const documents = path.join(os.homedir(), "Documents");

  const candidates = [
    // Goldberg
    {
      emulatorType: EMULATOR_TYPES.GOLDBERG_V1,
      savePath: path.join(appData, "Goldberg SteamEmu Saves", String(appId), "achievements.json"),
      watchDir: path.join(appData, "Goldberg SteamEmu Saves", String(appId))
    },
    {
      emulatorType: EMULATOR_TYPES.GOLDBERG_V1,
      savePath: path.join(appData, "GSE Saves", String(appId), "achievements.json"),
      watchDir: path.join(appData, "GSE Saves", String(appId))
    },
    // Goldberg Social Club
    {
      emulatorType: EMULATOR_TYPES.GOLDBERG_SOCIALCLUB,
      savePath: path.join(appData, "Goldberg Socialclub Emu Saves", String(appId), "achievements.json"),
      watchDir: path.join(appData, "Goldberg Socialclub Emu Saves", String(appId))
    },
    // Tenoke
    {
      emulatorType: EMULATOR_TYPES.TENOKE,
      savePath: path.join(localAppData, "TENOKE", String(appId), "achievements.json"),
      watchDir: path.join(localAppData, "TENOKE", String(appId))
    },
    // RUNE
    {
      emulatorType: EMULATOR_TYPES.GENERIC_INI,
      savePath: path.join(publicDocs, "Steam", "RUNE", String(appId), "achievements.ini"),
      watchDir: path.join(publicDocs, "Steam", "RUNE", String(appId))
    },
    {
      emulatorType: EMULATOR_TYPES.GENERIC_INI,
      savePath: path.join(publicDocs, "Steam", "RUNE", String(appId), "remote", "achievements.ini"),
      watchDir: path.join(publicDocs, "Steam", "RUNE", String(appId), "remote")
    },
    // CODEX
    {
      emulatorType: EMULATOR_TYPES.GENERIC_INI,
      savePath: path.join(publicDocs, "Steam", "CODEX", String(appId), "achievements.ini"),
      watchDir: path.join(publicDocs, "Steam", "CODEX", String(appId))
    },
    {
      emulatorType: EMULATOR_TYPES.GENERIC_INI,
      savePath: path.join(publicDocs, "Steam", "CODEX", String(appId), "remote", "achievements.ini"),
      watchDir: path.join(publicDocs, "Steam", "CODEX", String(appId), "remote")
    },
    {
      emulatorType: EMULATOR_TYPES.GENERIC_INI,
      savePath: path.join(appData, "Steam", "CODEX", String(appId), "achievements.ini"),
      watchDir: path.join(appData, "Steam", "CODEX", String(appId))
    },
    // OnlineFix
    {
      emulatorType: EMULATOR_TYPES.GENERIC_INI,
      savePath: path.join(publicDocs, "OnlineFix", String(appId), "Stats", "Achievements.ini"),
      watchDir: path.join(publicDocs, "OnlineFix", String(appId), "Stats")
    },
    {
      emulatorType: EMULATOR_TYPES.GENERIC_INI,
      savePath: path.join(publicDocs, "OnlineFix", String(appId), "Achievements.ini"),
      watchDir: path.join(publicDocs, "OnlineFix", String(appId))
    },
    // RLD! / DODI / PLAZA
    {
      emulatorType: EMULATOR_TYPES.GENERIC_INI,
      savePath: path.join(programData, "RLD!", String(appId), "achievements.ini"),
      watchDir: path.join(programData, "RLD!", String(appId))
    },
    {
      emulatorType: EMULATOR_TYPES.GENERIC_INI,
      savePath: path.join(programData, "Steam", "Player", String(appId), "stats", "achievements.ini"),
      watchDir: path.join(programData, "Steam", "Player", String(appId), "stats")
    },
    {
      emulatorType: EMULATOR_TYPES.GENERIC_INI,
      savePath: path.join(programData, "Steam", "RLD!", String(appId), "stats", "achievements.ini"),
      watchDir: path.join(programData, "Steam", "RLD!", String(appId), "stats")
    },
    {
      emulatorType: EMULATOR_TYPES.GENERIC_INI,
      savePath: path.join(programData, "Steam", "dodi", String(appId), "stats", "achievements.ini"),
      watchDir: path.join(programData, "Steam", "dodi", String(appId), "stats")
    },
    // Skidrow
    {
      emulatorType: EMULATOR_TYPES.GENERIC_INI,
      savePath: path.join(documents, "SKIDROW", String(appId), "SteamEmu", "UserStats", "achiev.ini"),
      watchDir: path.join(documents, "SKIDROW", String(appId), "SteamEmu", "UserStats")
    },
    {
      emulatorType: EMULATOR_TYPES.GENERIC_INI,
      savePath: path.join(documents, "Player", String(appId), "SteamEmu", "UserStats", "achiev.ini"),
      watchDir: path.join(documents, "Player", String(appId), "SteamEmu", "UserStats")
    },
    {
      emulatorType: EMULATOR_TYPES.GENERIC_INI,
      savePath: path.join(localAppData, "SKIDROW", String(appId), "SteamEmu", "UserStats", "achiev.ini"),
      watchDir: path.join(localAppData, "SKIDROW", String(appId), "SteamEmu", "UserStats")
    },
    // SmartSteamEmu
    {
      emulatorType: EMULATOR_TYPES.GENERIC_INI,
      savePath: path.join(appData, "SmartSteamEmu", String(appId), "User", "Achievements.ini"),
      watchDir: path.join(appData, "SmartSteamEmu", String(appId), "User")
    },
    // CreamAPI
    {
      emulatorType: EMULATOR_TYPES.GENERIC_INI,
      savePath: path.join(appData, "CreamAPI", String(appId), "stats", "CreamAPI.Achievements.cfg"),
      watchDir: path.join(appData, "CreamAPI", String(appId), "stats")
    },
    // RLE
    {
      emulatorType: EMULATOR_TYPES.GENERIC_INI,
      savePath: path.join(appData, "RLE", String(appId), "achievements.ini"),
      watchDir: path.join(appData, "RLE", String(appId))
    },
    {
      emulatorType: EMULATOR_TYPES.GENERIC_INI,
      savePath: path.join(appData, "RLE", String(appId), "Achievements.ini"),
      watchDir: path.join(appData, "RLE", String(appId))
    }
  ];

  // Adiciona caminhos internos da pasta do jogo se fornecida
  if (gameDir) {
    candidates.push(
      {
        emulatorType: EMULATOR_TYPES.GOLDBERG_V1,
        savePath: path.join(gameDir, "steam_settings", "achievements.json"),
        watchDir: path.join(gameDir, "steam_settings")
      },
      {
        emulatorType: EMULATOR_TYPES.GENERIC_INI,
        savePath: path.join(gameDir, "steam_settings", "achievements.ini"),
        watchDir: path.join(gameDir, "steam_settings")
      },
      {
        emulatorType: EMULATOR_TYPES.GENERIC_INI,
        savePath: path.join(gameDir, "SteamData", "user_stats.ini"),
        watchDir: path.join(gameDir, "SteamData")
      },
      {
        emulatorType: EMULATOR_TYPES.GENERIC_INI,
        savePath: path.join(gameDir, "3DMGAME", "Player", "stats", "achievements.ini"),
        watchDir: path.join(gameDir, "3DMGAME", "Player", "stats")
      }
    );
  }

  // Verifica se algum arquivo dos emuladores realmente existe no disco
  for (const cand of candidates) {
    if (fs.existsSync(cand.savePath)) {
      console.log(`[EmulatorDetector] Arquivo existente encontrado: ${cand.savePath} (Emulador: ${cand.emulatorType})`);
      return cand;
    }
  }

  return null;
};

const getEmulatorForGame = (gamePath) => {
  if (!gamePath) return null;
  console.log(`[EmulatorDetector] Procurando emulador na pasta do jogo: ${gamePath}`);
  for (const adapter of adapters) {
    if (adapter.detect(gamePath)) {
      console.log(`[EmulatorDetector] Emulador detectado via assinatura: ${adapter.emulatorType}`);
      return adapter;
    }
  }
  console.log(`[EmulatorDetector] Nenhum emulador específico detectado na raiz do jogo.`);
  return null;
};

// ─── Compatibilidade IPC (Retro-compatível com main.cjs) ─────────────────────

function detectEmulator(gameDir, appId) {
  if (!gameDir || !appId) return null;
  
  // 1. Tenta escaneamento global/Hydra para encontrar arquivos já criados
  const scanned = getScannedEmulator(appId, gameDir);
  if (scanned) {
    console.log(`[EmulatorDetector] Sucesso no escaneamento automático para appId ${appId}!`);
    return {
      ...scanned,
      appId,
      gameDir
    };
  }

  // 2. Fallback: detecção de emulador baseada nas DLLs do jogo para novos saves
  const adapter = getEmulatorForGame(gameDir) || new GoldbergAdapter();
  const watchInfo = adapter.getWatchInfo(appId, gameDir);
  
  console.log(`[EmulatorDetector] Fallback de detecção de emulador para appId: ${appId} | Emulador: ${adapter.emulatorType}`);
  console.log(`[EmulatorDetector] Pasta de saves (watchDir): ${watchInfo.watchDir}`);
  console.log(`[EmulatorDetector] Arquivo alvo (savePath): ${watchInfo.savePath}`);

  return {
    ...watchInfo,
    appId,
    gameDir
  };
}

function parseAchievementState(detectedEmulator) {
  if (!detectedEmulator || !detectedEmulator.savePath) return {};
  
  const adapter = adapters.find(a => a.emulatorType === detectedEmulator.emulatorType);
  if (!adapter) return {};

  return adapter.readAchievements(detectedEmulator.appId, detectedEmulator.gameDir, detectedEmulator.savePath);
}

function readLocalSavesRetroactive(appId, gameDir = null) {
  if (!appId) return {};
  
  // Tenta ler do escaneamento automático primeiro
  const scanned = getScannedEmulator(appId, gameDir);
  if (scanned && fs.existsSync(scanned.savePath)) {
    const adapter = adapters.find(a => a.emulatorType === scanned.emulatorType);
    if (adapter) {
      // Como readAchievements aceita savePath customizado ou lê do padrão,
      // nós temporariamente instanciamos para ler o arquivo do local correto.
      if (scanned.emulatorType === EMULATOR_TYPES.GENERIC_INI) {
        try {
          const content = fs.readFileSync(scanned.savePath, "utf8");
          const achievementsBlockRegex = /\[(?:Steam)?Achievements\]([\s\S]*?)(?:\[|$)/i;
          const match = content.match(achievementsBlockRegex);
          const result = {};
          if (match && match[1]) {
            const lines = match[1].split("\n");
            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed || trimmed.startsWith(";") || trimmed.startsWith("#")) continue;
              const parts = trimmed.split("=");
              if (parts.length >= 2) {
                const key = parts[0].trim();
                const val = parts[1].trim();
                if (key && key.toLowerCase() !== "count") {
                  const lowerVal = val.toLowerCase();
                  const isBooleanVal = lowerVal === "1" || lowerVal === "0" || lowerVal === "true" || lowerVal === "false";
                  
                  if (isBooleanVal) {
                    result[key] = {
                      earned: lowerVal === "1" || lowerVal === "true",
                      earnedTime: Date.now() / 1000
                    };
                  } else {
                    result[val] = {
                      earned: true,
                      earnedTime: Date.now() / 1000
                    };
                  }
                }
              }
            }
          }
          return result;
        } catch {
          return {};
        }
      } else {
        const data = tryReadJson(scanned.savePath);
        if (data && typeof data === "object") {
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
        }
      }
    }
  }

  const adapter = gameDir ? (getEmulatorForGame(gameDir) || new GoldbergAdapter()) : new GoldbergAdapter();
  return adapter.readAchievements(appId, gameDir);
}

// Mantemos esse helper exportado solto para a autoconfiguração antiga no main.cjs
function getGoldbergV1Paths(appId) {
  return new GoldbergAdapter()._getPaths(appId);
}

module.exports = {
  EMULATOR_TYPES,
  getGoldbergV1Paths,
  detectEmulator,
  parseAchievementState,
  readLocalSavesRetroactive,
  getEmulatorForGame
};
