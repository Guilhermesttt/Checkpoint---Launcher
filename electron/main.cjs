const { app, BrowserWindow, ipcMain, shell, Menu, dialog, screen, Tray } = require("electron");
const crypto = require("node:crypto");
const { execFile, spawn } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const { createAchievementBridge } = require("./achievement-bridge.cjs");
const { detectEmulator, parseAchievementState, getGoldbergV1Paths } = require("./emulator-detector.cjs");

// Backend de produção (Render). Pode ser sobrescrito via env BACKEND_PUBLIC_URL
// se um dia você quiser apontar pra outro ambiente sem mexer no código.
const PROD_BACKEND_URL = "https://checkpoint-backend-vgvx.onrender.com";
const APP_URL = (process.env.BACKEND_PUBLIC_URL || PROD_BACKEND_URL).replace(/\/$/, "");

// ─── Registro de watchers ativos por jogo (gameId → FSWatcher) ───────────────
// Garante que nunca tenhamos dois watchers para o mesmo jogo.
const activeWatchers = new Map();

/**
 * Para e remove o watcher ativo de um jogo, se existir.
 * @param {string} gameId
 */
const stopGameWatcher = (gameId) => {
  const entry = activeWatchers.get(gameId);
  if (!entry) return;
  try { if (entry.watcher) entry.watcher.close(); } catch { /* ignore */ }
  clearTimeout(entry.debounceTimer);
  clearInterval(entry.intervalTimer);
  activeWatchers.delete(gameId);
  console.info(`[achievement-watcher] Watcher encerrado para jogo ${gameId}`);
};

// Em modo dev o ELECTRON_START_URL aponta para o Vite (porta diferente)
const DEV_ORIGIN = process.env.ELECTRON_START_URL
  ? (() => {
    try {
      const u = new URL(process.env.ELECTRON_START_URL);
      return `${u.protocol}//${u.host}`;
    } catch {
      return null;
    }
  })()
  : null;

const APP_ORIGIN = (() => {
  try {
    const u = new URL(APP_URL);
    return `${u.protocol}//${u.host}`;
  } catch {
    return APP_URL;
  }
})();

const STARTUP_LOG_FILE = "desktop-startup.log";

// Render free tier "dorme" após inatividade; cold start pode levar bastante tempo.
const HEALTH_CHECK_MAX_ATTEMPTS = 120; // 120 * 500ms = ~60s de tolerância
const HEALTH_CHECK_INTERVAL_MS = 500;

let mainWindow;
let overlayWindow;
let achievementBridge;
let startupErrorShown = false;
let isQuitting = false;
let tray = null;

const overlayIconUrl = () =>
  `file:///${path.join(app.getAppPath(), "assets", "icon.png").replace(/\\/g, "/")}`;

const hasSingleInstanceLock = app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) {
  app.quit();
}

Menu.setApplicationMenu(null);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const yieldToEventLoop = () => new Promise((resolve) => setImmediate(resolve));

const appendStartupLog = (message, error) => {
  const timestamp = new Date().toISOString();
  const lines = [`[${timestamp}] ${message}`];
  if (error) {
    lines.push(error instanceof Error ? error.stack || error.message : String(error));
  }
  const content = `${lines.join("\n")}\n`;

  try {
    const logPath = path.join(app.getPath("userData"), STARTUP_LOG_FILE);
    fs.mkdirSync(path.dirname(logPath), { recursive: true });
    fs.appendFileSync(logPath, content, "utf8");
  } catch {
    // Ignore logging failures.
  }

  console.error(content.trimEnd());
};

const isLocalAppUrl = (rawUrl) => {
  try {
    const url = new URL(rawUrl);
    const origin = `${url.protocol}//${url.host}`;
    // Aceita tanto a origem do backend de produção quanto do Vite em modo dev
    const backendOk = origin === APP_ORIGIN;
    const devOk = DEV_ORIGIN ? origin === DEV_ORIGIN : false;
    return backendOk || devOk;
  } catch {
    return false;
  }
};

const isExternalProtocol = (rawUrl) => {
  try {
    const protocol = new URL(rawUrl).protocol;
    return protocol === "steam:" || protocol === "com.epicgames.launcher:";
  } catch {
    return false;
  }
};

const isSafeOpenExternalUrl = (rawUrl) => {
  try {
    const url = new URL(String(rawUrl));
    if (url.protocol === "https:") return true;
    if (url.protocol === "http:") return isLocalAppUrl(url.toString());
    return url.protocol === "steam:" || url.protocol === "com.epicgames.launcher:";
  } catch {
    return false;
  }
};

const configureHidAccess = (electronSession) => {
  const SONY_VENDOR_ID = 0x054c;

  electronSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    callback(permission === "hid");
  });

  if (typeof electronSession.setPermissionCheckHandler === "function") {
    electronSession.setPermissionCheckHandler((_webContents, permission) => permission === "hid");
  }

  if (typeof electronSession.setDevicePermissionHandler === "function") {
    electronSession.setDevicePermissionHandler((details) => {
      const device = details?.device;
      return details?.deviceType === "hid" && device?.vendorId === SONY_VENDOR_ID;
    });
  }

  if (electronSession.listenerCount("select-hid-device") === 0) {
    electronSession.on("select-hid-device", (event, details, callback) => {
      event.preventDefault();
      const devices = details?.deviceList ?? [];
      const device = devices.find((candidate) => candidate.vendorId === SONY_VENDOR_ID) ?? devices[0];
      callback(device?.deviceId ?? "");
    });
  }
};

const isAuthPopupUrl = (rawUrl) => {
  if (rawUrl === "about:blank") return true;

  try {
    const url = new URL(rawUrl);
    const host = url.hostname.toLowerCase();
    return (
      host === "accounts.google.com" ||
      host === "ssl.gstatic.com" ||
      host.endsWith(".google.com") ||
      host.endsWith(".gstatic.com") ||
      host.endsWith(".firebaseapp.com") ||
      host.endsWith(".web.app") ||
      url.pathname.startsWith("/__/auth/")
    );
  } catch {
    return false;
  }
};

const fetchHealth = async () => {
  try {
    const response = await fetch(`${APP_URL}/health`);
    return response.ok;
  } catch {
    return false;
  }
};

const waitForServer = async () => {
  for (let attempt = 0; attempt < HEALTH_CHECK_MAX_ATTEMPTS; attempt += 1) {
    if (await fetchHealth()) return;
    await sleep(HEALTH_CHECK_INTERVAL_MS);
  }

  throw new Error(
    `Backend nao respondeu em ${APP_URL}/health apos ${(HEALTH_CHECK_MAX_ATTEMPTS * HEALTH_CHECK_INTERVAL_MS) / 1000}s. Verifique sua conexao com a internet.`,
  );
};

const loadMainWindow = async () => {
  const preferredUrl = process.env.ELECTRON_START_URL || APP_URL;
  const fallbackUrl = process.env.ELECTRON_START_URL ? APP_URL : null;
  const targets = fallbackUrl && fallbackUrl !== preferredUrl ? [preferredUrl, fallbackUrl] : [preferredUrl];

  let lastError = null;
  for (const target of targets) {
    try {
      await mainWindow.loadURL(target);
      return;
    } catch (error) {
      lastError = error;
      appendStartupLog(`Failed to load window URL: ${target}`, error);
      await sleep(700);
    }
  }

  throw lastError ?? new Error("Falha ao carregar a janela principal.");
};

const showFatalStartupError = (error) => {
  if (startupErrorShown) {
    return;
  }
  startupErrorShown = true;
  appendStartupLog("Fatal desktop startup error.", error);
  dialog.showErrorBox(
    "Checkpoint Launcher",
    [
      "O app nao conseguiu iniciar.",
      error instanceof Error ? error.message : String(error),
      `Log: ${path.join(app.getPath("userData"), STARTUP_LOG_FILE)}`,
    ].join("\n\n"),
  );
};

const createWindow = async () => {
  if (!process.env.ELECTRON_START_URL) {
    await waitForServer();
  }

  mainWindow = new BrowserWindow({
    width: 1600,
    height: 900,
    minWidth: 1280,
    minHeight: 720,
    backgroundColor: "#05070a",
    icon: path.join(app.getAppPath(), "assets", "icon.png"),
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
    },
  });

  configureHidAccess(mainWindow.webContents.session);

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });
  setTimeout(() => {
    if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.isVisible()) {
      mainWindow.show();
    }
  }, 2500);

  mainWindow.webContents.on(
    "did-fail-load",
    (_event, errorCode, errorDescription, validatedURL) => {
      if (errorCode === -3) {
        return;
      }
      appendStartupLog(
        `Renderer failed to load URL ${validatedURL} (code=${errorCode}).`,
        new Error(errorDescription),
      );
    },
  );
  mainWindow.webContents.on("render-process-gone", (_event, details) => {
    appendStartupLog(
      `Renderer process exited (${details.reason}).`,
      details.exitCode ? new Error(`exitCode=${details.exitCode}`) : undefined,
    );
  });

  mainWindow.webContents.on("before-input-event", (event, input) => {
    if (input.key === "F11" && input.type === "keyDown") {
      mainWindow.setFullScreen(!mainWindow.isFullScreen());
      event.preventDefault();
    }
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isAuthPopupUrl(url)) {
      return {
        action: "allow",
        overrideBrowserWindowOptions: {
          width: 520,
          height: 720,
          parent: mainWindow,
          modal: false,
          backgroundColor: "#ffffff",
          webPreferences: {
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true,
          },
        },
      };
    }

    shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (isExternalProtocol(url)) {
      event.preventDefault();
      shell.openExternal(url);
      return;
    }

    if (!isLocalAppUrl(url)) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  mainWindow.webContents.on("will-redirect", (event, url) => {
    if (isLocalAppUrl(url)) {
      return;
    }

    event.preventDefault();
    shell.openExternal(url);
  });

  mainWindow.on("close", (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;

    if (overlayWindow && !overlayWindow.isDestroyed()) {
      overlayWindow.close();
    }

    if (process.platform !== "darwin" && !isQuitting) {
      isQuitting = true;
      app.quit();
    }
  });

  await loadMainWindow();

  // Checa atualizações de forma silenciosa na inicialização
  if (app.isPackaged) {
    setTimeout(() => {
      autoUpdater.checkForUpdates().catch((err) => {
        console.error("[AutoUpdater] Erro ao buscar atualizações automáticas:", err);
      });
    }, 5000); // aguarda 5s após abrir a janela principal para não sobrecarregar a inicialização

    // Checa por atualizações a cada 2 horas
    setInterval(() => {
      autoUpdater.checkForUpdates().catch((err) => {
        console.error("[AutoUpdater] Erro ao buscar atualizações periódicas:", err);
      });
    }, 2 * 60 * 60 * 1000);
  }
};

const syncOverlayBounds = () => {
  if (!overlayWindow || overlayWindow.isDestroyed()) {
    return;
  }

  const display = screen.getPrimaryDisplay();
  overlayWindow.setBounds(display.bounds);
};

const createOverlayWindow = () => {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    return overlayWindow;
  }

  overlayWindow = new BrowserWindow({
    x: 0,
    y: 0,
    width: 800,
    height: 600,
    show: false,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    focusable: false,
    hasShadow: false,
    alwaysOnTop: true,
    webPreferences: {
      preload: path.join(__dirname, "overlay-preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      backgroundThrottling: false,
      webSecurity: false,
    },
  });

  overlayWindow.setIgnoreMouseEvents(true, { forward: true });
  overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  overlayWindow.setAlwaysOnTop(true, "screen-saver");
  syncOverlayBounds();
  overlayWindow.loadFile(path.join(__dirname, "overlay.html"));
  overlayWindow.once("ready-to-show", () => {
    overlayWindow.showInactive();
  });
  overlayWindow.on("closed", () => {
    overlayWindow = null;
  });

  return overlayWindow;
};

const sendOverlayEvent = (channel, payload) => {
  createOverlayWindow();
  if (!overlayWindow || overlayWindow.isDestroyed()) {
    throw new Error("Overlay indisponivel.");
  }

  overlayWindow.webContents.send(channel, payload);
};

const playOverlaySound = (sound) => {
  createOverlayWindow();
  if (!overlayWindow || overlayWindow.isDestroyed()) {
    throw new Error("Overlay indisponivel.");
  }

  overlayWindow.webContents.send("overlay:play-sound", { sound });
};

const startAchievementBridge = async () => {
  achievementBridge = createAchievementBridge({
    userDataPath: app.getPath("userData"),
    appUrl: APP_URL,
    logger: console,
    onAchievementUnlocked: async (payload) => {
      // payload vem do emulador como { gameId, achievementId, unlockedAt, duplicate }
      if (payload.duplicate) return;

      const schema = await getSchemaByAppIdOrGameId(payload.gameId);
      if (schema) {
        const ach = schema.find(a => String(a.id).toLowerCase() === String(payload.achievementId).toLowerCase());
        if (ach) {
          payload.achievement = {
            id: ach.id,
            name: ach.name,
            description: ach.description || "",
            icon: ach.icon || "",
          };
        }
      }

      // Fallback para caso não consigamos ler o schema
      if (!payload.achievement) {
        payload.achievement = {
          id: payload.achievementId,
          name: payload.achievementId,
          description: "",
          icon: ""
        };
      }

      sendOverlayEvent("achievement:unlock", payload);
      playOverlaySound("achievement-unlock");
    },
  });

  return achievementBridge.start();
};

ipcMain.handle("achievement:get-definitions", async (_event, gameId) => {
  try {
    const achievementsDir = path.join(app.getPath("userData"), "achievements");
    const definitionsPath = path.join(achievementsDir, `${gameId}.json`);
    if (fs.existsSync(definitionsPath)) {
      const content = await fs.promises.readFile(definitionsPath, "utf8");
      return JSON.parse(content);
    }
  } catch (error) {
    console.error("Error reading achievement definitions:", error);
  }
  return null;
});

ipcMain.handle("achievement:get-progress", async (_event, gameId) => {
  try {
    const progressPath = path.join(app.getPath("userData"), `user_progress_${gameId}.json`);
    if (fs.existsSync(progressPath)) {
      const content = await fs.promises.readFile(progressPath, "utf8");
      return JSON.parse(content);
    }
  } catch (error) {
    console.error("Error reading achievement progress:", error);
  }
  return null;
});

const { readLocalSavesRetroactive } = require("./emulator-detector.cjs");
ipcMain.handle("achievement:get-local-state", async (_event, appId) => {
  try {
    if (!appId) return {};
    return readLocalSavesRetroactive(appId);
  } catch (error) {
    console.error("Error reading retroactive achievement state:", error);
    return {};
  }
});

ipcMain.handle("achievement:save-definitions", async (_event, gameId, definitions, steamAppId) => {
  try {
    const achievementsDir = path.join(app.getPath("userData"), "achievements");
    const definitionsPath = path.join(achievementsDir, `${gameId}.json`);

    await fs.promises.mkdir(achievementsDir, { recursive: true });
    const payload = { steamAppId, achievements: definitions };
    await fs.promises.writeFile(definitionsPath, JSON.stringify(payload, null, 2), "utf8");
    return true;
  } catch (error) {
    console.error("Error saving achievement definitions:", error);
    throw error;
  }
});

ipcMain.handle("achievement:unlock", async (_event, gameId, achievementId) => {
  try {
    if (achievementBridge) {
      return await achievementBridge.unlockAchievement(gameId, achievementId);
    }
    throw new Error("Achievement bridge nao iniciada.");
  } catch (error) {
    console.error("Error unlocking achievement:", error);
    throw error;
  }
});

ipcMain.handle("overlay:show-achievement", async (_event, payload) => {
  sendOverlayEvent("achievement:unlock", payload);
  playOverlaySound("achievement-unlock");
});

ipcMain.handle("overlay:show-friend-message", async (_event, payload) => {
  const senderName = String(payload?.senderName || "").trim() || "Amigo";
  const messageText = String(payload?.messageText || "").trim() || "Nova mensagem";
  const avatarUrl = String(payload?.avatarUrl || "").trim();

  sendOverlayEvent("overlay:social", {
    kind: "friend-message",
    title: senderName,
    description: messageText,
    avatarUrl: avatarUrl || overlayIconUrl(),
  });
});

/**
 * Helper genérico para localizar e parsear o schema de conquistas
 * usando tanto o Game ID local quanto o App ID da Steam (ex: "steam_3764200").
 */
async function getSchemaByAppIdOrGameId(key) {
  const achievementsDir = path.join(app.getPath("userData"), "achievements");
  if (!fs.existsSync(achievementsDir)) return null;

  const isSteamAppId = String(key).startsWith("steam_");
  const targetAppId = isSteamAppId ? key.replace("steam_", "") : null;

  const files = await fs.promises.readdir(achievementsDir);
  for (const file of files) {
    if (!file.endsWith(".json")) continue;

    const gameId = path.basename(file, ".json");
    if (!isSteamAppId && gameId === key) {
      try {
        const content = await fs.promises.readFile(path.join(achievementsDir, file), "utf8");
        return JSON.parse(content).achievements;
      } catch { /* ignora */ }
    }

    if (isSteamAppId) {
      try {
        const content = await fs.promises.readFile(path.join(achievementsDir, file), "utf8");
        const parsed = JSON.parse(content);
        if (String(parsed.steamAppId) === String(targetAppId)) {
          return parsed.achievements;
        }
      } catch { /* ignora */ }
    }
  }
  return null;
}

/**
 * Injeta o arquivo steam_settings/achievements.json no emulador e
 * inicializa o arquivo de saves no AppData com { earned: false }.
 */
async function injectGoldbergDefinitions(appId, settingsPath) {
  try {
    // 1. Procurar o schema salvo usando o steamAppId
    const targetSchema = await getSchemaByAppIdOrGameId(`steam_${appId}`);
    if (!targetSchema || targetSchema.length === 0) return;

    // 2. Gerar steam_settings/achievements.json
    const steamSettingsPath = path.join(settingsPath, "achievements.json");
    if (!fs.existsSync(steamSettingsPath)) {
      const goldbergSettings = targetSchema.map(ach => ({
        name: ach.id, // O ID técnico do Steam que o jogo requisitará
        hidden: false,
        icon: "",
        icon_gray: "",
        display_name: { english: ach.name },
        description: { english: ach.description || "" }
      }));
      await fs.promises.writeFile(steamSettingsPath, JSON.stringify(goldbergSettings, null, 4), "utf8");
      console.info(`[goldberg-injector] Arquivo steam_settings/achievements.json criado para o AppID ${appId}.`);
    }

    // 3. Inicializar progresso vazio no AppData
    const paths = getGoldbergV1Paths(appId);
    if (!fs.existsSync(paths.watchDir)) {
      await fs.promises.mkdir(paths.watchDir, { recursive: true });
    }

    let currentSaves = {};
    if (fs.existsSync(paths.savePath)) {
      try {
        const raw = await fs.promises.readFile(paths.savePath, "utf8");
        const normalized = raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw;
        currentSaves = JSON.parse(normalized);
      } catch (e) {
        console.error(`[goldberg-injector] Erro de parse no save atual:`, e);
      }
    }

    let modified = false;
    for (const ach of targetSchema) {
      if (!currentSaves[ach.id]) {
        currentSaves[ach.id] = { earned: false, earned_time: 0 };
        modified = true;
      }
    }

    if (modified || Object.keys(currentSaves).length === 0) {
      await fs.promises.writeFile(paths.savePath, JSON.stringify(currentSaves, null, 2), "utf8");
      console.info(`[goldberg-injector] Arquivo de progresso inicializado no AppData para o AppID ${appId}.`);
    }
  } catch (error) {
    console.error(`[goldberg-injector] Falha ao injetar conquistas:`, error);
  }
}

ipcMain.handle("launcher:open-executable", async (_event, executablePath) => {
  const target = String(executablePath || "").trim();
  if (!target) {
    throw new Error("Caminho do executavel vazio.");
  }

  const normalizedTarget = path.normalize(target);
  if (!path.isAbsolute(normalizedTarget)) {
    throw new Error("Caminho do executavel invalido.");
  }

  if (path.extname(normalizedTarget).toLowerCase() !== ".exe") {
    throw new Error("Apenas arquivos .exe podem ser iniciados.");
  }

  let stats;
  try {
    stats = fs.statSync(normalizedTarget);
  } catch {
    throw new Error("Executavel nao encontrado.");
  }

  if (!stats.isFile()) {
    throw new Error("Executavel invalido.");
  }

  // Autoconfiguração de ponte de conquistas para emuladores Steam locais (Goldberg)
  try {
    const gameDir = path.dirname(normalizedTarget);
    const parentDir = path.dirname(gameDir);

    const pathsToCheck = [
      path.join(gameDir, "steam_settings"),
      path.join(parentDir, "steam_settings")
    ];

    const hasSteamDll = fs.existsSync(path.join(gameDir, "steam_api64.dll")) ||
      fs.existsSync(path.join(gameDir, "steam_api.dll"));

    let settingsPath = null;
    for (const p of pathsToCheck) {
      if (fs.existsSync(p)) {
        settingsPath = p;
        break;
      }
    }

    if (!settingsPath && hasSteamDll) {
      settingsPath = path.join(gameDir, "steam_settings");
      fs.mkdirSync(settingsPath, { recursive: true });
    }

    if (settingsPath) {
      fs.writeFileSync(path.join(settingsPath, "achievements_receiver.txt"), "http://127.0.0.1:3000", "utf8");

      // Tenta obter o App ID para configurar as conquistas no emulador Goldberg
      let appId = null;
      const appidPaths = [
        path.join(gameDir, "steam_appid.txt"),
        path.join(settingsPath, "steam_appid.txt")
      ];
      for (const ap of appidPaths) {
        if (fs.existsSync(ap)) {
          const content = fs.readFileSync(ap, "utf8").trim();
          if (/^\d+$/.test(content)) {
            appId = content;
            break;
          }
        }
      }

      if (appId) {
        // Injeta as definições das conquistas antes do jogo abrir
        await injectGoldbergDefinitions(appId, settingsPath);
      }

      if (appId) {
        const achievementsDir = path.join(app.getPath("userData"), "achievements");
        let schemaAchievements = null;

        if (fs.existsSync(achievementsDir)) {
          const files = fs.readdirSync(achievementsDir);
          for (const file of files) {
            if (file.endsWith(".json")) {
              const gameId = path.basename(file, ".json");
              try {
                const rawContent = fs.readFileSync(path.join(achievementsDir, file), "utf8");
                const parsed = JSON.parse(rawContent);
                // Verifica se bate com o appId
                if (
                  gameId.endsWith(`_steam_${appId}`) ||
                  gameId === appId ||
                  String(parsed.steamAppId) === String(appId)
                ) {
                  if (parsed && Array.isArray(parsed.achievements)) {
                    schemaAchievements = parsed.achievements;
                    break;
                  }
                }
              } catch {
                // ignore
              }
            }
          }
        }

        // Se encontramos conquistas salvas, criamos os arquivos vazios no Goldberg
        if (schemaAchievements && schemaAchievements.length > 0) {
          const goldbergAchDir = path.join(settingsPath, "achievements");
          fs.mkdirSync(goldbergAchDir, { recursive: true });

          for (const ach of schemaAchievements) {
            const apiName = ach.apiName || ach.id;
            if (apiName) {
              const achFilePath = path.join(goldbergAchDir, String(apiName).trim());
              if (!fs.existsSync(achFilePath)) {
                fs.writeFileSync(achFilePath, "", "utf8");
              }
            }
          }
        }
      }
    }
  } catch (err) {
    console.error("Erro na autoconfiguração do receptor de conquistas:", err);
  }

  const gameDir = path.dirname(normalizedTarget);

  // ── Detectar emulador e preparar watcher de conquistas ─────────────────────
  // Extrai o appId do steam_appid.txt para que o detector saiba onde procurar.
  let detectedGameAppId = null;
  {
    const appidCandidates = [
      path.join(gameDir, "steam_appid.txt"),
      path.join(gameDir, "steam_settings", "steam_appid.txt"),
      path.join(gameDir, "steam_emu.ini"),
      path.join(gameDir, "tenoke.ini"),
      path.join(gameDir, "ALI213.ini")
    ];
    for (const ap of appidCandidates) {
      if (fs.existsSync(ap)) {
        const raw = fs.readFileSync(ap, "utf8").trim();
        if (ap.endsWith(".txt")) {
          if (/^\d+$/.test(raw)) { detectedGameAppId = raw; break; }
        } else {
          const match = raw.match(/AppId\s*=\s*(\d+)/i);
          if (match && match[1]) {
            detectedGameAppId = match[1];
            break;
          }
        }
      }
    }
  }

  // gameId para associar o watcher — usamos o appId como chave porque é estável.
  const watcherKey = detectedGameAppId ? `steam_${detectedGameAppId}` : path.basename(normalizedTarget, ".exe");

  // Para qualquer watcher anterior do mesmo jogo antes de iniciar um novo.
  stopGameWatcher(watcherKey);

  // Função chamada pelo watcher quando o arquivo de saves muda.
  // Compara o estado novo com o estado anterior e dispara IPC para cada
  // conquista recém-desbloqueada.
  const handleAchievementFileChange = (detectedEmulator) => {
    const newState = parseAchievementState(detectedEmulator);
    const entry = activeWatchers.get(watcherKey);
    if (!entry) return;

    const prevState = entry.lastState;
    const newlyUnlocked = [];

    for (const [id, current] of Object.entries(newState)) {
      const previous = prevState[id];
      const justUnlocked = current.earned && (!previous || !previous.earned);
      if (justUnlocked) {
        newlyUnlocked.push({ id, earnedTime: current.earnedTime });
      }
    }

    // Atualiza o estado armazenado independentemente de ter desbloqueado algo.
    entry.lastState = newState;

    if (newlyUnlocked.length === 0) return;

    // Resolve os metadados (nome, ícone) via achievement-bridge e dispara IPC.
    for (const { id, earnedTime } of newlyUnlocked) {
      if (achievementBridge) {
        achievementBridge
          .unlockAchievement(watcherKey, id)
          .catch((err) => console.error("[achievement-watcher] unlockAchievement error:", err));
      }

      // Envia evento em tempo real para o renderer atualizar a UI.
      const payload = {
        gameId: watcherKey,
        achievementId: id,
        earnedTime,   // Unix timestamp (segundos) vindo do emulador
        unlockedAt: earnedTime > 0
          ? new Date(earnedTime * 1000).toISOString()
          : new Date().toISOString(),
      };

      try {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send("achievement:realtime-unlock", payload);
        }
      } catch (e) {
        console.error("[achievement-watcher] IPC send error:", e);
      }
    }
  };

  /**
   * Inicia o fs.watch no diretório de saves do emulador.
   * @param {object} detectedEmulator
   * @param {Function|null} onExit - chamada quando o jogo encerrar (pode ser null)
   */
  const startGameWatcher = (detectedEmulator, onExit) => {
    if (!detectedEmulator) return;

    // Garante que o diretório de saves existe (Goldberg pode não tê-lo criado ainda).
    try { fs.mkdirSync(detectedEmulator.watchDir, { recursive: true }); } catch { /* ignore */ }

    // Lê o estado inicial ANTES de montar o watcher para poder comparar depois.
    const initialState = parseAchievementState(detectedEmulator);

    let debounceTimer = null;
    let watcher = null;
    let intervalTimer = null;

    // Se for emulador genérico (.ini como RUNE/CODEX), fs.watch falha. Usamos Polling!
    if (detectedEmulator.emulatorType === "generic_ini") {
      console.info(`[achievement-watcher] Usando Polling de 3s para o emulador INI em: ${detectedEmulator.savePath}`);
      intervalTimer = setInterval(() => {
        handleAchievementFileChange(detectedEmulator);
      }, 3000);
    } else {
      // Para Goldberg/Tenoke (.json), fs.watch funciona perfeitamente.
      try {
        watcher = fs.watch(detectedEmulator.watchDir, { persistent: false }, (_event, filename) => {
          const saveFile = path.basename(detectedEmulator.savePath);
          if (filename && filename !== saveFile) return;

          clearTimeout(debounceTimer);
          debounceTimer = setTimeout(() => {
            handleAchievementFileChange(detectedEmulator);
          }, 300);

          const entry = activeWatchers.get(watcherKey);
          if (entry) entry.debounceTimer = debounceTimer;
        });
      } catch (watchErr) {
        console.error("[achievement-watcher] Falha ao iniciar fs.watch:", watchErr);
        return;
      }

      watcher.on("error", (err) => {
        console.error("[achievement-watcher] Erro no watcher:", err);
        stopGameWatcher(watcherKey);
      });
    }

    activeWatchers.set(watcherKey, {
      watcher,
      intervalTimer, // Salva o timer para o stopGameWatcher matar depois
      debounceTimer: null,
      lastState: initialState,
    });

    console.info(
      `[achievement-watcher] Monitorando conquistas do jogo ${watcherKey}` +
      ` em ${detectedEmulator.watchDir}` +
      ` (emulador: ${detectedEmulator.emulatorType})`
    );

    if (onExit) {
      onExit(() => stopGameWatcher(watcherKey));
    }
  };

  const detectedEmulator = detectedGameAppId
    ? detectEmulator(gameDir, detectedGameAppId)
    : null;

  try {
    const child = spawn(normalizedTarget, [], {
      cwd: gameDir,
      detached: true,
      stdio: "ignore",
    });

    // Flag: true apenas se o processo filho realmente iniciou (evento "spawn" do Node).
    // Quando o spawn falha (EACCES, etc.) o Node dispara "error" + "exit"/"close" com
    // código null, mas NÃO dispara "spawn". Usamos isso para não encerrar o watcher
    // prematuramente quando o jogo é iniciado via shell.openPath como fallback.
    let didSpawn = false;
    child.once("spawn", () => {
      didSpawn = true;
      if (mainWindow) {
        mainWindow.hide();
      }
    });

    // Registra os hooks de saída ANTES do unref() — o evento ainda é emitido
    // mesmo após o processo pai "desacoplar" do filho via unref().
    // Só encerra o watcher se o processo realmente havia iniciado.
    const registerExitHook = (stopFn) => {
      const handleExit = () => {
        if (didSpawn) {
          stopFn();
          if (mainWindow) {
            mainWindow.show();
            mainWindow.focus();
          }
        }
      };
      child.once("exit", handleExit);
      child.once("close", handleExit);
    };

    // Inicia o watcher usando o hook de saída do child process.
    if (detectedEmulator) {
      startGameWatcher(detectedEmulator, registerExitHook);
    }

    child.on("error", async (err) => {
      console.error("Falha ao iniciar via spawn (child_process), tentando shell.openPath:", err);
      // NÃO paramos o watcher aqui: shell.openPath vai abrir o jogo com as
      // permissões corretas (UAC/admin) e o watcher deve continuar monitorando.
      // Só paramos se shell.openPath também falhar.
      const openError = await shell.openPath(normalizedTarget);
      if (openError) {
        console.error("Falha ao iniciar pelo shell.openPath:", openError);
        // Ambos os métodos falharam: o jogo não iniciou, encerra o watcher.
        stopGameWatcher(watcherKey);
      } else {
        console.info("[achievement-watcher] Jogo aberto via shell.openPath — watcher mantido ativo.");
      }
    });

    child.unref();
  } catch (spawnError) {
    console.error("Falha síncrona ao iniciar via spawn, tentando shell.openPath:", spawnError);
    // Na exceção síncrona do spawn também tentamos shell.openPath antes de desistir.
    const openError = await shell.openPath(normalizedTarget);
    if (openError) {
      stopGameWatcher(watcherKey);
      throw new Error(openError);
    } else {
      console.info("[achievement-watcher] Jogo aberto via shell.openPath (fallback síncrono) — watcher mantido ativo.");
    }
  }
});

ipcMain.handle("launcher:is-executable-running", async (_event, executablePath) => {
  const target = String(executablePath || "").trim();
  if (!target) {
    return false;
  }

  const normalizedTarget = path.normalize(target);
  const executableName = path.basename(normalizedTarget);
  if (!executableName || path.extname(executableName).toLowerCase() !== ".exe") {
    return false;
  }

  const output = await new Promise((resolve, reject) => {
    execFile(
      "tasklist",
      ["/fo", "csv", "/nh", "/fi", `imagename eq ${executableName}`],
      { windowsHide: true },
      (error, stdout = "") => {
        if (error) {
          reject(error);
          return;
        }
        resolve(stdout);
      },
    );
  }).catch(() => "");

  return String(output)
    .split(/\r?\n/)
    .some((line) => line.trim().toLowerCase().startsWith(`"${executableName.toLowerCase()}"`));
});

ipcMain.handle("launcher:detect-running-games", async (_event, executablePaths) => {
  const normalizedTargets = Array.isArray(executablePaths)
    ? executablePaths
      .map((value) => String(value || "").trim())
      .filter(Boolean)
      .map((value) => path.normalize(value))
      .filter((value) => path.isAbsolute(value) && path.extname(value).toLowerCase() === ".exe")
    : [];

  if (normalizedTargets.length === 0) {
    return [];
  }

  const output = await new Promise((resolve, reject) => {
    execFile("tasklist", ["/fo", "csv", "/nh"], { windowsHide: true }, (error, stdout = "") => {
      if (error) {
        reject(error);
        return;
      }
      resolve(stdout);
    });
  }).catch(() => "");

  const runningNames = new Set(
    String(output)
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => line.match(/^"([^"]+)"/)?.[1]?.toLowerCase())
      .filter(Boolean),
  );

  return normalizedTargets.filter((target) =>
    runningNames.has(path.basename(target).toLowerCase()),
  );
});

ipcMain.handle("auth:start-google-browser", async () => {
  const state = crypto.randomUUID();
  const authUrl = new URL("/auth/google/start", APP_URL);
  authUrl.searchParams.set("state", state);
  await shell.openExternal(authUrl.toString());
  return { state };
});

ipcMain.handle("shell:open-external", async (_event, url) => {
  const rawUrl = String(url || "").trim();
  if (!isSafeOpenExternalUrl(rawUrl)) {
    throw new Error("Protocolo nao permitido.");
  }
  await shell.openExternal(rawUrl);
});

ipcMain.handle("overlay:test-welcome", async () => {
  sendOverlayEvent("overlay:social", {
    kind: "game-start",
    title: "Divirta-se",
    description: "O overlay esta ativo enquanto voce joga.",
  });
});

ipcMain.handle("overlay:test-achievement", async () => {
  sendOverlayEvent("achievement:unlock", {
    gameId: "checkpoint-lab",
    achievementId: "overlay-smoke-test",
    achievement: {
      id: "overlay-smoke-test",
      name: "Primeiro Abate",
      description: "Teste visual do overlay do Checkpoint.",
      icon: overlayIconUrl(),
    },
    unlockedAt: new Date().toISOString(),
    duplicate: false,
  });
  playOverlaySound("achievement-unlock");
});

ipcMain.handle("overlay:show-game-start", async (_event, payload) => {
  const gameTitle = String(payload?.gameTitle || "").trim();
  sendOverlayEvent("overlay:social", {
    kind: "game-start",
    title: "Divirta-se",
    description: gameTitle
      ? `Voce esta jogando agora ${gameTitle}`
      : "O overlay esta ativo enquanto voce joga.",
  });
});

ipcMain.handle("overlay:show-friend-playing", async (_event, payload) => {
  const playerName = String(payload?.playerName || "").trim() || "Jogador";
  const gameTitle = String(payload?.gameTitle || "").trim() || "agora";
  const avatarUrl = String(payload?.avatarUrl || "").trim();

  sendOverlayEvent("overlay:social", {
    kind: "friend-playing",
    title: playerName,
    description: `Esta jogando agora ${gameTitle}`,
    avatarUrl: avatarUrl || overlayIconUrl(),
  });
});

ipcMain.handle("overlay:show-friend-request", async (_event, payload) => {
  const playerName = String(payload?.playerName || "").trim() || "Jogador";
  const avatarUrl = String(payload?.avatarUrl || "").trim();

  sendOverlayEvent("overlay:social", {
    kind: "friend-request",
    title: playerName,
    description: "Enviou um pedido de amizade",
    avatarUrl: avatarUrl || overlayIconUrl(),
  });
});

ipcMain.handle("overlay:show-friend-accepted", async (_event, payload) => {
  const playerName = String(payload?.playerName || "").trim() || "Jogador";
  const avatarUrl = String(payload?.avatarUrl || "").trim();

  sendOverlayEvent("overlay:social", {
    kind: "friend-accepted",
    title: playerName,
    description: "Aceitou teu pedido de amizade",
    avatarUrl: avatarUrl || overlayIconUrl(),
  });
});

// Patterns that suggest the exe is NOT an actual game (installer, updater, etc.)
const SKIP_EXE_PATTERN = /setup|install|uninst|update|updater|crash|helper|launcher_updater|redist|vcredist|directx|dxsetup|dotnet|oalinst|ue4|ue5prereq/i;
const MAX_DEPTH = 4;
const MAX_RESULTS = 200;

const isGameExecutable = (filePath) => {
  const baseName = path.basename(filePath).toLowerCase();
  return baseName.endsWith(".exe") && !SKIP_EXE_PATTERN.test(baseName);
};

const pushExeResult = (filePath, results, seenPaths) => {
  const normalizedPath = path.normalize(filePath);
  if (seenPaths.has(normalizedPath) || !isGameExecutable(normalizedPath)) {
    return;
  }

  seenPaths.add(normalizedPath);
  results.push({
    name: path.basename(normalizedPath, ".exe"),
    path: normalizedPath,
  });
};

const scanForExe = async (dir, results = [], seenPaths = new Set(), depth = 0) => {
  if (depth > MAX_DEPTH || results.length >= MAX_RESULTS) return results;
  let entries;
  try {
    entries = await fs.promises.readdir(dir, { withFileTypes: true });
  } catch {
    return results;
  }
  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index];
    if (results.length >= MAX_RESULTS) break;
    if (index > 0 && index % 40 === 0) {
      await yieldToEventLoop();
    }
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      // Skip hidden and system dirs
      if (entry.name.startsWith(".") || entry.name === "node_modules" || entry.name === "$RECYCLE.BIN") continue;
      await scanForExe(fullPath, results, seenPaths, depth + 1);
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".exe")) {
      pushExeResult(fullPath, results, seenPaths);
    }
  }
  return results;
};

ipcMain.handle("game:scan-local", async (_event) => {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    title: "Selecione pastas ou executaveis para buscar jogos",
    properties: ["openDirectory", "openFile", "multiSelections"],
    buttonLabel: "Buscar Jogos",
    filters: [{ name: "Executaveis", extensions: ["exe"] }],
  });
  if (canceled || filePaths.length === 0) return [];

  const results = [];
  const seenPaths = new Set();
  for (const selectedPath of filePaths) {
    let stats;
    try {
      stats = fs.statSync(selectedPath);
    } catch {
      continue;
    }

    if (stats.isDirectory()) {
      await scanForExe(selectedPath, results, seenPaths);
      continue;
    }

    if (stats.isFile()) {
      pushExeResult(selectedPath, results, seenPaths);
    }
  }
  return results;
});

// ─── Auto-Updater ───────────────────────────────────────────────────────────
const { autoUpdater } = require("electron-updater");

// Desativa o autoDownload para dar controle ao usuário (ele decide baixar pelo botão)
autoUpdater.autoDownload = false;

// Repassa eventos do autoUpdater para a interface de usuário (Vite/React)
autoUpdater.on("checking-for-update", () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("update:message", "checking-for-update");
  }
});

autoUpdater.on("update-available", (info) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("update:message", "update-available", info);
  }
});

autoUpdater.on("update-not-available", (info) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("update:message", "update-not-available", info);
  }
});

autoUpdater.on("error", (err) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("update:message", "error", err ? err.message : "Erro desconhecido");
  }
});

autoUpdater.on("download-progress", (progressObj) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("update:download-progress", progressObj);
  }
});

autoUpdater.on("update-downloaded", (info) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("update:message", "update-downloaded", info);
  }
});

ipcMain.handle("app:get-version", () => {
  return app.getVersion();
});

ipcMain.handle("update:check-for-updates", async () => {
  try {
    if (!app.isPackaged) {
      return { status: "development", message: "O atualizador não funciona em ambiente de desenvolvimento." };
    }
    const result = await autoUpdater.checkForUpdates();
    return result;
  } catch (error) {
    console.error("[auto-updater] Erro ao checar atualizações:", error);
    throw error;
  }
});

ipcMain.handle("update:start-download", async () => {
  try {
    return await autoUpdater.downloadUpdate();
  } catch (error) {
    console.error("[auto-updater] Erro ao iniciar download:", error);
    throw error;
  }
});

ipcMain.handle("update:quit-and-install", () => {
  isQuitting = true;
  autoUpdater.quitAndInstall();
});

app.commandLine.appendSwitch("autoplay-policy", "no-user-gesture-required");

app.whenReady().then(async () => {
  try {
    const iconPath = path.join(app.getAppPath(), "assets", "icon.png");
    try {
      if (fs.existsSync(iconPath)) {
        tray = new Tray(iconPath);
        const contextMenu = Menu.buildFromTemplate([
          { label: "Abrir Checkpoint", click: () => { if (mainWindow) { mainWindow.show(); mainWindow.focus(); } } },
          { label: "Sair", click: () => { isQuitting = true; app.quit(); } }
        ]);
        tray.setToolTip("Checkpoint Launcher");
        tray.setContextMenu(contextMenu);
        tray.on("double-click", () => {
          if (mainWindow) {
            mainWindow.show();
            mainWindow.focus();
          }
        });
      }
    } catch (e) {
      console.warn("Não foi possível inicializar a System Tray:", e);
    }

    createOverlayWindow();
    screen.on("display-metrics-changed", syncOverlayBounds);
    screen.on("display-added", syncOverlayBounds);
    screen.on("display-removed", syncOverlayBounds);
    await startAchievementBridge();
    await createWindow();
  } catch (error) {
    showFatalStartupError(error);
    app.quit();
  }
});

app.on("second-instance", () => {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }
  mainWindow.focus();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createOverlayWindow();
    createWindow();
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("will-quit", () => {
  process.exit(0);
});

app.on("before-quit", () => {
  isQuitting = true;
  screen.removeListener("display-metrics-changed", syncOverlayBounds);
  screen.removeListener("display-added", syncOverlayBounds);
  screen.removeListener("display-removed", syncOverlayBounds);
  if (achievementBridge) {
    achievementBridge.stop().catch((error) => {
      appendStartupLog("Failed to stop achievement bridge.", error);
    });
  }
});

process.on("unhandledRejection", (reason) => {
  appendStartupLog("Unhandled promise rejection in Electron main.", reason);
});

process.on("uncaughtException", (error) => {
  appendStartupLog("Uncaught exception in Electron main.", error);
});
