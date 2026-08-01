const { app, BrowserWindow, ipcMain, shell, clipboard, Menu, dialog, screen, Tray, globalShortcut, desktopCapturer, Notification, safeStorage } = require("electron");

const crypto = require("node:crypto");
const { execFile, spawn } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL, fileURLToPath } = require("node:url");
const { createAchievementBridge } = require("./achievement-bridge.cjs");
const { readAchievementLibrarySummary } = require("./achievement-summary.cjs");
const { normalizeLaunchProfile } = require("./launch-profile.cjs");
const { sanitizeOverlayImageSource } = require("./overlay-image.cjs");
const { readInstalledEpicGames } = require("./epic-manifests.cjs");
const { readEpicLocalAchievements } = require("./epic-local-achievements.cjs");
const {
  EPIC_STORE_CARD_EXTRACTOR,
  EPIC_STORE_GRAPHQL_QUERY,
  normalizeEpicGraphqlElements,
  normalizeEpicStoreDetails,
  normalizeEpicStoreCards,
} = require("./epic-store-search.cjs");
const {
  createGameProcessTracker,
  normalizeWindowsPath,
  parseProcessSnapshot,
} = require("./game-process-monitor.cjs");
const { createSecureIpcRegistrar } = require("./ipc-security.cjs");
const { createLocalGameLibrary } = require("./local-game-library.cjs");
const { createNexusCredentialStore } = require("./nexus-credential-store.cjs");
const {
  getNexusDownloadLinks,
  getNexusModCatalog,
  getNexusModDetails,
  getNexusModFiles,
  normalizeGameDomain,
  normalizeModId,
  validateNexusApiKey,
} = require("./nexus-api.cjs");
const { downloadNexusFile, parseNxmUrl } = require("./nexus-download-manager.cjs");
const { assertAllowedArchive } = require("./nexus-installation-manager.cjs");
const { selectModGameDirectory } = require("./mod-game-directory.cjs");
const { runModOperation, shutdownModOperationWorker } = require("./mod-operation-runner.cjs");
const {
  detectEmulator,
  parseAchievementState,
  getGoldbergV1Paths,
  getAchievementAliases,
  resolveEmulatorAchievementId,
  detectKnownEmulatorSave,
} = require("./emulator-detector.cjs");

// Backend de produção (Render). Pode ser sobrescrito via env BACKEND_PUBLIC_URL
// se um dia você quiser apontar pra outro ambiente sem mexer no código.
const PROD_BACKEND_URL = "https://checkpoint-backend-vgvx.onrender.com";
const APP_URL = (process.env.BACKEND_PUBLIC_URL || PROD_BACKEND_URL).replace(/\/$/, "");
const IS_SMOKE_TEST = process.argv.includes("--smoke-test");
const AUTO_START_ARG = "--checkpoint-autostart";
const IS_AUTO_START = process.argv.includes(AUTO_START_ARG);
const ENABLE_EMULATOR_FILE_INJECTION = process.env.CHECKPOINT_ENABLE_EMULATOR_INJECTION === "1";

// ─── Registro de watchers ativos por jogo (gameId → FSWatcher) ───────────────
// Garante que nunca tenhamos dois watchers para o mesmo jogo.
const activeWatchers = new Map();
const activeGameMonitors = new Map();
const activeRescanTimers = new Map();

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
let overlayReady = false;
let overlayDisplayId = null;
let overlayPanelOpen = false;
let inGameOverlayActive = false;
let overlayPanelState = {
  language: "pt-BR",
  friends: [],
  achievements: { unlocked: 0, available: 0, items: [], loading: false },
  currentGame: null,
  captures: [],
  settings: {
    captureShortcut: "F8",
    achievementVolume: 22,
    achievementSoundTheme: "ps5",
    achievementNotificationsEnabled: true,
    customAchievementNotifications: true,
    achievementNotificationPosition: "top-right",
  },
  chat: null,
  profile: { name: "Jogador", avatar: "", discordConnected: false, discordUsername: "", achievements: 0 },
};
const overlayEventCopy = {
  "pt-BR": { enjoy: "Divirta-se", active: "O overlay está ativo enquanto você joga.", playing: "Você está jogando agora", open: "Abra sem sair do jogo", shortcut: "Use o botão central do controle ou Ctrl + Shift + O.", player: "Jogador", now: "agora", friendPlaying: "Está jogando agora", request: "Enviou um pedido de amizade", accepted: "Aceitou seu pedido de amizade", firstKill: "Primeiro Abate", testAchievement: "Teste visual do overlay do Checkpoint.", newMessage: "Nova mensagem", captureSaved: "Captura salva" },
  "en-US": { enjoy: "Have fun", active: "The overlay is active while you play.", playing: "You are now playing", open: "Open without leaving the game", shortcut: "Use the controller’s center button or Ctrl + Shift + O.", player: "Player", now: "now", friendPlaying: "Is now playing", request: "Sent you a friend request", accepted: "Accepted your friend request", firstKill: "First Kill", testAchievement: "Checkpoint overlay visual test.", newMessage: "New message", captureSaved: "Capture saved" },
  "es-ES": { enjoy: "Diviértete", active: "El overlay está activo mientras juegas.", playing: "Ahora estás jugando a", open: "Ábrelo sin salir del juego", shortcut: "Usa el botón central del mando o Ctrl + Shift + O.", player: "Jugador", now: "ahora", friendPlaying: "Está jugando ahora a", request: "Te envió una solicitud de amistad", accepted: "Aceptó tu solicitud de amistad", firstKill: "Primera baja", testAchievement: "Prueba visual del overlay de Checkpoint.", newMessage: "Nuevo mensaje", captureSaved: "Captura guardada" },
  "fr-FR": { enjoy: "Amusez-vous", active: "L’overlay est actif pendant que vous jouez.", playing: "Vous jouez maintenant à", open: "Ouvrez-le sans quitter le jeu", shortcut: "Utilisez le bouton central de la manette ou Ctrl + Shift + O.", player: "Joueur", now: "maintenant", friendPlaying: "Joue maintenant à", request: "Vous a envoyé une demande d’ami", accepted: "A accepté votre demande d’ami", firstKill: "Première élimination", testAchievement: "Test visuel de l’overlay Checkpoint.", newMessage: "Nouveau message", captureSaved: "Capture enregistrée" },
  "de-DE": { enjoy: "Viel Spaß", active: "Das Overlay ist während des Spielens aktiv.", playing: "Du spielst jetzt", open: "Öffnen, ohne das Spiel zu verlassen", shortcut: "Verwende die mittlere Controllertaste oder Strg + Umschalt + O.", player: "Spieler", now: "jetzt", friendPlaying: "Spielt jetzt", request: "Hat dir eine Freundschaftsanfrage gesendet", accepted: "Hat deine Freundschaftsanfrage angenommen", firstKill: "Erster Abschuss", testAchievement: "Visueller Test des Checkpoint-Overlays.", newMessage: "Neue Nachricht", captureSaved: "Aufnahme gespeichert" },
  "it-IT": { enjoy: "Buon divertimento", active: "L’overlay è attivo mentre giochi.", playing: "Ora stai giocando a", open: "Apri senza uscire dal gioco", shortcut: "Usa il pulsante centrale del controller o Ctrl + Maiusc + O.", player: "Giocatore", now: "ora", friendPlaying: "Sta giocando ora a", request: "Ti ha inviato una richiesta di amicizia", accepted: "Ha accettato la tua richiesta di amicizia", firstKill: "Prima eliminazione", testAchievement: "Test visivo dell’overlay Checkpoint.", newMessage: "Nuovo messaggio", captureSaved: "Cattura salvata" },
};
const getOverlayEventCopy = () => overlayEventCopy[overlayPanelState.language] || overlayEventCopy["pt-BR"];
const nativeAchievementFallbackCopy = {
  "pt-BR": "Conquista desbloqueada",
  "en-US": "Achievement unlocked",
  "es-ES": "Logro desbloqueado",
  "fr-FR": "Succès déverrouillé",
  "de-DE": "Erfolg freigeschaltet",
  "it-IT": "Obiettivo sbloccato",
};
let captureShortcut = "F8";
let achievementVolume = 22;
let achievementSoundTheme = "ps5";
let achievementNotificationsEnabled = true;
let customAchievementNotifications = true;
let achievementNotificationPosition = "top-right";
let recentCaptures = [];
let captureInProgress = false;
const activeNativeNotifications = new Set();
const CAPTURE_HISTORY_LIMIT = 60;

const normalizeCaptureShortcut = (value) => {
  const raw = String(value || "").trim();
  if (!raw || raw.length > 64) return null;
  const parts = raw.split("+").map((part) => part.trim()).filter(Boolean);
  if (parts.length === 0) return null;
  const rawKey = parts.at(-1);
  const modifiers = new Set(parts.slice(0, -1));
  if ([...modifiers].some((modifier) => !["CommandOrControl", "Alt", "Shift"].includes(modifier))) return null;
  const key = /^(?:[A-Z]|[0-9]|F(?:[1-9]|1[0-9]|2[0-4])|Space|Up|Down|Left|Right|Home|End|PageUp|PageDown|Insert|Delete|Backspace|PrintScreen)$/.test(rawKey || "")
    ? rawKey
    : null;
  if (!key) return null;
  if (modifiers.size === 0 && !/^(?:F(?:[1-9]|1[0-9]|2[0-4])|PrintScreen)$/.test(key)) return null;
  const normalized = [
    modifiers.has("CommandOrControl") ? "CommandOrControl" : "",
    modifiers.has("Alt") ? "Alt" : "",
    modifiers.has("Shift") ? "Shift" : "",
    key,
  ].filter(Boolean).join("+");
  return normalized === "CommandOrControl+Shift+O" ? null : normalized;
};
const pendingOverlayEvents = [];
let achievementBridge;
let startupErrorShown = false;
let isQuitting = false;
let tray = null;
let localGameLibrary = null;
let pendingAccountAuthCallback = null;
let nexusCredentialStore = null;
let pendingNexusDownload = null;
let nexusDownloadState = null;
let nexusDownloadInProgress = false;

const overlayIconUrl = () =>
  `file:///${path.join(app.getAppPath(), "assets", "icon.png").replace(/\\/g, "/")}`;

const hasSingleInstanceLock = IS_SMOKE_TEST || app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) {
  app.quit();
}

Menu.setApplicationMenu(null);
if (process.platform === "win32") {
  app.setAppUserModelId("com.checkpoint.launcher");
}

if (!IS_SMOKE_TEST) {
  for (const protocol of ["checkpoint", "nxm"]) {
    if (!app.isPackaged) {
      app.setAsDefaultProtocolClient(protocol, process.execPath, [
        path.resolve(app.getAppPath()),
      ]);
    } else {
      app.setAsDefaultProtocolClient(protocol);
    }
  }
}

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

const parseAccountAuthCallback = (rawUrl) => {
  try {
    const callbackUrl = new URL(String(rawUrl || ""));
    if (callbackUrl.protocol !== "checkpoint:" || callbackUrl.hostname !== "auth") {
      return null;
    }
    if (callbackUrl.pathname.replace(/\/$/, "") !== "/callback") {
      return null;
    }

    const steamStatus = callbackUrl.searchParams.get("steamStatus");
    const discordStatus = callbackUrl.searchParams.get("discordStatus");
    if (!steamStatus && !discordStatus) return null;

    return {
      ...(steamStatus ? { steamStatus: steamStatus.slice(0, 40) } : {}),
      ...(discordStatus ? { discordStatus: discordStatus.slice(0, 40) } : {}),
    };
  } catch {
    return null;
  }
};

const findAccountAuthCallback = (args) =>
  (Array.isArray(args) ? args : [])
    .map(parseAccountAuthCallback)
    .find(Boolean) || null;

const deliverAccountAuthCallback = (payload) => {
  if (!payload) return;
  pendingAccountAuthCallback = payload;

  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();

  if (!mainWindow.webContents.isLoading()) {
    mainWindow.webContents.send("auth:account-callback", payload);
    pendingAccountAuthCallback = null;
  }
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

const registerSecureIpcHandler = createSecureIpcRegistrar({
  ipcMain,
  isAllowedUrl: isLocalAppUrl,
  getExpectedWebContents: () => mainWindow?.webContents ?? null,
});

const NEXUS_DOWNLOAD_REQUEST_TTL_MS = 15 * 60 * 1000;

const getNexusCredentialStore = () => {
  if (!nexusCredentialStore) {
    nexusCredentialStore = createNexusCredentialStore({
      userDataPath: app.getPath("userData"),
      safeStorage,
    });
  }
  return nexusCredentialStore;
};

const getNexusApiKey = () => {
  const apiKey = getNexusCredentialStore().read();
  if (!apiKey) {
    throw new Error("Conecte uma chave pessoal Nexus antes de continuar.");
  }
  return apiKey;
};

const getNexusDownloadRoot = () =>
  path.join(app.getPath("documents"), "Checkpoint", "Mods");
const getLegacyNexusDownloadRoot = () =>
  path.join(app.getPath("downloads"), "Checkpoint", "Nexus Mods");
const getAllowedNexusDownloadRoots = () => [
  getNexusDownloadRoot(),
  getLegacyNexusDownloadRoot(),
];

let nexusDownloadMigrationPromise = null;
const pathExists = async (targetPath) => Boolean(
  await fs.promises.stat(targetPath).catch(() => null),
);
const ensureNexusDownloadRoot = async () => {
  if (nexusDownloadMigrationPromise) return nexusDownloadMigrationPromise;
  nexusDownloadMigrationPromise = (async () => {
    const destination = getNexusDownloadRoot();
    const legacy = getLegacyNexusDownloadRoot();
    const migrationMarker = path.join(destination, ".legacy-downloads-imported");
    await fs.promises.mkdir(destination, { recursive: true });
    const [migrationComplete, legacyExists] = await Promise.all([
      pathExists(migrationMarker),
      pathExists(legacy),
    ]);
    if (migrationComplete || !legacyExists) return destination;
    try {
      await fs.promises.cp(legacy, destination, {
        recursive: true,
        force: false,
        errorOnExist: false,
      });
      await fs.promises.writeFile(migrationMarker, new Date().toISOString(), "utf8");
    } catch (error) {
      console.warn("[nexus] Nao foi possivel importar os downloads antigos:", error);
    }
    return destination;
  })();
  return nexusDownloadMigrationPromise;
};

const installSupportedNexusZip = async ({
  gameDomain,
  archivePath,
  gameFolder,
  modId,
  fileId,
  modName,
}) => {
  return runModOperation("install", {
    gameDomain,
    archivePath,
    gameRoot: gameFolder,
    backupRoot: path.join(app.getPath("userData"), "nexus-backups"),
    manifestRoot: path.join(app.getPath("userData"), "nexus-installations"),
    modId,
    fileId,
    modName,
  });
};

const activeModOperations = new Set();
const runExclusiveModOperation = async (operationKey, operation) => {
  const key = String(operationKey || "");
  if (activeModOperations.has(key)) {
    throw new Error("Ja existe uma operacao em andamento para este mod.");
  }
  activeModOperations.add(key);
  try {
    return await operation();
  } finally {
    activeModOperations.delete(key);
  }
};

const publishNexusDownloadState = (patch) => {
  nexusDownloadState = {
    ...(nexusDownloadState || {}),
    ...patch,
    updatedAt: Date.now(),
  };
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("nexus:download-state", nexusDownloadState);
  }
  return nexusDownloadState;
};

const findNxmUrl = (args) =>
  (Array.isArray(args) ? args : [])
    .find((arg) => typeof arg === "string" && /^nxm:\/\//i.test(arg)) || null;

const handleNexusDownloadUrl = async (rawUrl) => {
  if (!rawUrl) return false;
  let parsed;
  try {
    parsed = parseNxmUrl(rawUrl);
  } catch (error) {
    publishNexusDownloadState({
      status: "error",
      error: error instanceof Error ? error.message : "O link NXM recebido e invalido.",
    });
    return false;
  }

  const pending = pendingNexusDownload;
  if (
    !pending
    || pending.expiresAt < Date.now()
    || pending.gameDomain !== parsed.gameDomain
    || pending.modId !== parsed.modId
    || pending.fileId !== parsed.fileId
  ) {
    publishNexusDownloadState({
      status: "error",
      gameDomain: parsed.gameDomain,
      modId: parsed.modId,
      fileId: parsed.fileId,
      error: "Este download nao foi iniciado pelo Checkpoint ou a solicitacao expirou.",
    });
    return false;
  }
  if (Number(parsed.expires) * 1000 <= Date.now()) {
    publishNexusDownloadState({
      status: "error",
      gameDomain: parsed.gameDomain,
      modId: parsed.modId,
      fileId: parsed.fileId,
      error: "A autorizacao temporaria de download da Nexus expirou.",
    });
    return false;
  }
  if (nexusDownloadInProgress) {
    publishNexusDownloadState({
      status: "error",
      error: "Aguarde o download Nexus atual terminar.",
    });
    return false;
  }

  pendingNexusDownload = null;
  nexusDownloadInProgress = true;
  const downloadId = crypto.randomUUID();
  const baseState = {
    id: downloadId,
    gameDomain: parsed.gameDomain,
    modId: parsed.modId,
    fileId: parsed.fileId,
    modName: pending.modName,
    modAuthor: pending.modAuthor,
    pictureUrl: pending.pictureUrl,
    version: pending.version,
  };
  publishNexusDownloadState({
    ...baseState,
    status: "resolving",
    error: "",
    receivedBytes: 0,
    totalBytes: 0,
  });

  try {
    await ensureNexusDownloadRoot();
    const links = await getNexusDownloadLinks({
      apiKey: getNexusApiKey(),
      appVersion: app.getVersion(),
      ...parsed,
    });
    const mirror = links.mirrors[0];
    if (!mirror) {
      throw new Error("A Nexus nao retornou um servidor de download disponivel.");
    }
    publishNexusDownloadState({
      ...baseState,
      status: "downloading",
      mirror: mirror.name,
    });

    let lastProgressPublishedAt = 0;
    const downloaded = await downloadNexusFile({
      uri: mirror.uri,
      destinationRoot: getNexusDownloadRoot(),
      gameDomain: parsed.gameDomain,
      modId: parsed.modId,
      fileId: parsed.fileId,
      onProgress: ({ receivedBytes, totalBytes }) => {
        const now = Date.now();
        if (receivedBytes < totalBytes && now - lastProgressPublishedAt < 80) return;
        lastProgressPublishedAt = now;
        publishNexusDownloadState({
          ...baseState,
          status: "downloading",
          mirror: mirror.name,
          receivedBytes,
          totalBytes,
        });
      },
    });

    let installation = null;
    let installationError = "";
    if (
      pending.autoInstall
      && path.extname(downloaded.filePath).toLowerCase() === ".zip"
    ) {
      publishNexusDownloadState({
        ...baseState,
        ...downloaded,
        status: "installing",
      });
      try {
        installation = await runExclusiveModOperation(
          `${parsed.gameDomain}:${parsed.modId}`,
          () => installSupportedNexusZip({
          gameDomain: parsed.gameDomain,
          archivePath: downloaded.filePath,
          gameFolder: pending.gameFolder,
          modId: parsed.modId,
          fileId: parsed.fileId,
          modName: pending.modName,
          }),
        );
      } catch (error) {
        installationError = error instanceof Error
          ? error.message
          : "A instalacao automatica falhou.";
      }
    }

    publishNexusDownloadState({
      ...baseState,
      ...downloaded,
      ...(installation || {}),
      status: "completed",
      installed: Boolean(installation),
      installationError,
      error: "",
    });
    return true;
  } catch (error) {
    publishNexusDownloadState({
      ...baseState,
      status: "error",
      error: error instanceof Error ? error.message : "O download Nexus falhou.",
    });
    return false;
  } finally {
    nexusDownloadInProgress = false;
  }
};

registerSecureIpcHandler("nexus:get-status", () =>
  getNexusCredentialStore().getStatus());

registerSecureIpcHandler("nexus:connect-personal-key", async (_event, apiKey) => {
  const account = await validateNexusApiKey({
    apiKey,
    appVersion: app.getVersion(),
  });
  getNexusCredentialStore().save(apiKey);
  return {
    ...getNexusCredentialStore().getStatus(),
    account,
  };
});

registerSecureIpcHandler("nexus:validate-connection", async () => {
  const store = getNexusCredentialStore();
  const apiKey = store.read();
  if (!apiKey) return { ...store.getStatus(), account: null };
  const account = await validateNexusApiKey({
    apiKey,
    appVersion: app.getVersion(),
  });
  return { ...store.getStatus(), account };
});

registerSecureIpcHandler("nexus:disconnect", () => {
  getNexusCredentialStore().clear();
  pendingNexusDownload = null;
  return getNexusCredentialStore().getStatus();
});

registerSecureIpcHandler("nexus:get-mod-catalog", async (_event, request) =>
  getNexusModCatalog({
    apiKey: getNexusApiKey(),
    appVersion: app.getVersion(),
    gameDomain: request?.gameDomain,
  }));

registerSecureIpcHandler("nexus:get-mod-details", async (_event, request) =>
  getNexusModDetails({
    apiKey: getNexusApiKey(),
    appVersion: app.getVersion(),
    gameDomain: request?.gameDomain,
    modId: request?.modId,
  }));

registerSecureIpcHandler("nexus:get-mod-files", async (_event, request) =>
  getNexusModFiles({
    apiKey: getNexusApiKey(),
    appVersion: app.getVersion(),
    gameDomain: request?.gameDomain,
    modId: request?.modId,
  }));

registerSecureIpcHandler("nexus:get-download-state", () => nexusDownloadState);

registerSecureIpcHandler("nexus:list-downloaded-files", async (_event, rawGameDomain) => {
  await ensureNexusDownloadRoot();
  const gameDomain = normalizeGameDomain(rawGameDomain);
  const gameRoot = path.join(getNexusDownloadRoot(), gameDomain);
  const modDirectories = await fs.promises.readdir(gameRoot, { withFileTypes: true })
    .catch((error) => {
      if (error?.code === "ENOENT") return [];
      throw error;
    });
  const downloads = [];
  for (const modDirectory of modDirectories) {
    if (!modDirectory.isDirectory()) continue;
    let modId;
    try {
      modId = normalizeModId(modDirectory.name);
    } catch {
      continue;
    }
    const modRoot = path.join(gameRoot, modId);
    const files = await fs.promises.readdir(modRoot, { withFileTypes: true });
    for (const file of files) {
      if (!file.isFile() || file.name.endsWith(".part")) continue;
      const filePath = path.join(modRoot, file.name);
      const stats = await fs.promises.stat(filePath);
      downloads.push({
        id: `${gameDomain}:${modId}`,
        gameDomain,
        modId,
        filename: file.name,
        filePath,
        bytes: stats.size,
        downloadedAt: stats.mtimeMs,
      });
    }
  }
  return downloads.sort((left, right) => right.downloadedAt - left.downloadedAt);
});

registerSecureIpcHandler("nexus:prepare-free-download", (_event, request) => {
  const gameDomain = normalizeGameDomain(request?.gameDomain);
  const modId = normalizeModId(request?.modId);
  const fileId = normalizeModId(request?.fileId);
  getNexusApiKey();
  const expiresAt = Date.now() + NEXUS_DOWNLOAD_REQUEST_TTL_MS;
  pendingNexusDownload = {
    gameDomain,
    modId,
    fileId,
    gameFolder: String(request?.gameFolder || "").slice(0, 2048),
    modName: String(request?.modName || "").slice(0, 240),
    modAuthor: String(request?.modAuthor || "").slice(0, 120),
    pictureUrl: /^https:\/\//i.test(String(request?.pictureUrl || ""))
      ? String(request.pictureUrl).slice(0, 2048)
      : "",
    version: String(request?.version || "").slice(0, 80),
    autoInstall: Boolean(request?.gameFolder),
    expiresAt,
  };
  return {
    prepared: true,
    autoInstall: pendingNexusDownload.autoInstall,
    expiresAt,
  };
});

registerSecureIpcHandler("nexus:install-downloaded-mod", async (_event, request) => {
  const gameDomain = normalizeGameDomain(request?.gameDomain);
  const modId = normalizeModId(request?.modId);
  const fileId = normalizeModId(request?.fileId || request?.modId);
  const archivePath = assertAllowedArchive(
    request?.filePath,
    getAllowedNexusDownloadRoots(),
  );
  const baseState = {
    id: crypto.randomUUID(),
    gameDomain,
    modId,
    fileId,
    filename: path.basename(archivePath),
    filePath: archivePath,
    modName: String(request?.modName || "").slice(0, 240),
    error: "",
  };
  publishNexusDownloadState({ ...baseState, status: "installing" });
  try {
    const installation = await runExclusiveModOperation(
      `${gameDomain}:${modId}`,
      () => installSupportedNexusZip({
      gameDomain,
      archivePath,
      gameFolder: String(request?.gameFolder || "").slice(0, 2048),
      modId,
      fileId,
      modName: baseState.modName,
      }),
    );
    return publishNexusDownloadState({
      ...baseState,
      ...installation,
      status: "completed",
      installed: true,
      installationError: "",
    });
  } catch (error) {
    publishNexusDownloadState({
      ...baseState,
      status: "error",
      installed: false,
      error: error instanceof Error ? error.message : "A instalacao do mod falhou.",
    });
    throw error;
  }
});

registerSecureIpcHandler("nexus:adopt-installed-mod", async (_event, request) => {
  const gameDomain = normalizeGameDomain(request?.gameDomain);
  const modId = normalizeModId(request?.modId);
  const fileId = normalizeModId(request?.fileId || request?.modId);
  const archivePath = assertAllowedArchive(
    request?.filePath,
    getAllowedNexusDownloadRoots(),
  );
  return runExclusiveModOperation(`${gameDomain}:${modId}`, () => runModOperation("adopt", {
    archivePath,
    gameRoot: String(request?.gameFolder || "").slice(0, 2048),
    manifestRoot: path.join(app.getPath("userData"), "nexus-installations"),
    gameDomain,
    modId,
    fileId,
    modName: String(request?.modName || "").slice(0, 240),
  }));
});

registerSecureIpcHandler("nexus:remove-installed-mod", async (_event, request) => {
  await ensureNexusDownloadRoot();
  const manifestPath = String(request?.manifestPath || "");
  const archivePath = String(request?.filePath || "");
  return runExclusiveModOperation(manifestPath || archivePath, () => runModOperation("uninstall", {
    manifestPath,
    archivePath,
    removeArchive: Boolean(request?.removeArchive),
    installationsRoot: path.join(app.getPath("userData"), "nexus-installations"),
    backupRoot: path.join(app.getPath("userData"), "nexus-backups"),
    downloadRoots: getAllowedNexusDownloadRoots(),
  }));
});

registerSecureIpcHandler("nexus:open-download-location", async (_event, rawGameDomain) => {
  await ensureNexusDownloadRoot();
  if (rawGameDomain) {
    const gameDownloadDirectory = path.join(
      getNexusDownloadRoot(),
      normalizeGameDomain(rawGameDomain),
    );
    await fs.promises.mkdir(gameDownloadDirectory, { recursive: true });
    const openError = await shell.openPath(gameDownloadDirectory);
    if (openError) throw new Error(`Nao foi possivel abrir a pasta de mods: ${openError}`);
    return true;
  }
  if (nexusDownloadState?.filePath && fs.existsSync(nexusDownloadState.filePath)) {
    shell.showItemInFolder(nexusDownloadState.filePath);
    return true;
  }
  await fs.promises.mkdir(getNexusDownloadRoot(), { recursive: true });
  const openError = await shell.openPath(getNexusDownloadRoot());
  if (openError) throw new Error(`Nao foi possivel abrir a pasta de mods: ${openError}`);
  return true;
});

const isExternalProtocol = (rawUrl) => {
  try {
    const protocol = new URL(rawUrl).protocol;
    return protocol === "steam:" || protocol === "com.epicgames.launcher:" || protocol === "checkpoint:";
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
  const BASE_MS = 500;
  const MAX_DELAY_MS = 8_000;
  const TOTAL_TIMEOUT_MS = 65_000;
  const deadline = Date.now() + TOTAL_TIMEOUT_MS;

  let attempt = 0;
  while (Date.now() < deadline) {
    if (await fetchHealth()) return;
    // Exponential backoff com jitter ±20% para evitar thundering herd no Render
    const base = Math.min(BASE_MS * 2 ** attempt, MAX_DELAY_MS);
    const jitter = base * (0.8 + Math.random() * 0.4);
    await sleep(Math.round(jitter));
    attempt++;
  }

  throw new Error(
    `Backend nao respondeu em ${APP_URL}/health apos ${TOTAL_TIMEOUT_MS / 1000}s. Verifique sua conexao com a internet.`,
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
      backgroundThrottling: true,
      spellcheck: false,
      navigateOnDragDrop: false,
      v8CacheOptions: "code",
    },
  });

  configureHidAccess(mainWindow.webContents.session);

  mainWindow.once("ready-to-show", () => {
    if (!IS_AUTO_START) {
      mainWindow.show();
    }
  });
  setTimeout(() => {
    if (!IS_AUTO_START && mainWindow && !mainWindow.isDestroyed() && !mainWindow.isVisible()) {
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
  mainWindow.webContents.on("did-finish-load", () => {
    if (pendingAccountAuthCallback) {
      mainWindow.webContents.send("auth:account-callback", pendingAccountAuthCallback);
      pendingAccountAuthCallback = null;
    }
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

    if (isSafeOpenExternalUrl(url)) {
      void shell.openExternal(url);
    }
    return { action: "deny" };
  });

  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (isExternalProtocol(url)) {
      event.preventDefault();
      void shell.openExternal(url);
      return;
    }

    if (!isLocalAppUrl(url)) {
      event.preventDefault();
      if (isSafeOpenExternalUrl(url)) {
        void shell.openExternal(url);
      }
    }
  });

  mainWindow.webContents.on("will-redirect", (event, url) => {
    if (isLocalAppUrl(url)) {
      return;
    }

    event.preventDefault();
    if (isSafeOpenExternalUrl(url)) {
      void shell.openExternal(url);
    }
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

  const displays = screen.getAllDisplays();
  const display = displays.find((candidate) => candidate.id === overlayDisplayId)
    || (mainWindow && !mainWindow.isDestroyed()
      ? screen.getDisplayMatching(mainWindow.getBounds())
      : screen.getPrimaryDisplay());
  overlayDisplayId = display.id;
  overlayWindow.setBounds(display.bounds);
};

const selectOverlayDisplayFromLauncher = () => {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  overlayDisplayId = screen.getDisplayMatching(mainWindow.getBounds()).id;
  syncOverlayBounds();
};

const applyWindowProfile = (executablePath, launchProfile) => {
  if (!launchProfile || launchProfile.windowMode === "default") return;
  const display = screen.getAllDisplays().find((candidate) => candidate.id === launchProfile.monitorId)
    || screen.getPrimaryDisplay();
  const targetBounds = launchProfile.windowMode === "borderless" ? display.bounds : display.workArea;
  const width = launchProfile.resolutionWidth || targetBounds.width;
  const height = launchProfile.resolutionHeight || targetBounds.height;
  const x = targetBounds.x + Math.max(0, Math.floor((targetBounds.width - width) / 2));
  const y = targetBounds.y + Math.max(0, Math.floor((targetBounds.height - height) / 2));
  execFile("powershell.exe", [
    "-NoProfile",
    "-NonInteractive",
    "-ExecutionPolicy", "Bypass",
    "-File", path.join(__dirname, "apply-window-profile.ps1"),
    "-ExecutablePath", executablePath,
    "-WindowMode", launchProfile.windowMode,
    "-X", String(x),
    "-Y", String(y),
    "-Width", String(width),
    "-Height", String(height),
  ], { windowsHide: true }, (error) => {
    if (error) console.warn("[launcher] Perfil de janela nao foi aplicado:", error.message);
  });
};

const createOverlayWindow = () => {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    return overlayWindow;
  }

  overlayReady = false;
  overlayWindow = new BrowserWindow({
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    fullscreen: true,
    skipTaskbar: true,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    focusable: false,
    hasShadow: false,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "overlay-preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      backgroundThrottling: false,
      webSecurity: false,
    },
  });

  overlayWindow.setAlwaysOnTop(true, "screen-saver", 1);
  overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  overlayWindow.setIgnoreMouseEvents(true, { forward: true });
  syncOverlayBounds();
  const createdOverlayWindow = overlayWindow;
  createdOverlayWindow.loadFile(path.join(__dirname, "overlay.html"));
  createdOverlayWindow.webContents.once("did-finish-load", () => {
    if (createdOverlayWindow.isDestroyed() || overlayWindow !== createdOverlayWindow) return;
    overlayReady = true;
    pendingOverlayEvents.splice(0).forEach(({ channel, payload }) => {
      createdOverlayWindow.webContents.send(channel, payload);
    });
  });
  createdOverlayWindow.once("ready-to-show", () => {
    if (!createdOverlayWindow.isDestroyed()) createdOverlayWindow.showInactive();
  });
  createdOverlayWindow.on("closed", () => {
    if (overlayWindow === createdOverlayWindow) {
      overlayWindow = null;
      overlayReady = false;
    }
  });

  return overlayWindow;
};

const revealOverlayForToast = () => {
  if (!overlayWindow || overlayWindow.isDestroyed()) return;
  try {
    overlayWindow.setAlwaysOnTop(true, "screen-saver");
    overlayWindow.moveTop();
    overlayWindow.showInactive();
  } catch (error) {
    console.warn("[overlay] Nao foi possivel reafirmar a ordem da janela:", error);
  }
};

const sendOverlayEvent = (channel, payload) => {
  createOverlayWindow();
  if (!overlayWindow || overlayWindow.isDestroyed()) {
    throw new Error("Overlay indisponivel.");
  }

  if (channel === "overlay:social" || channel === "achievement:unlock") {
    revealOverlayForToast();
  }

  if (!overlayReady || overlayWindow.webContents.isLoadingMainFrame()) {
    pendingOverlayEvents.push({ channel, payload });
    if (pendingOverlayEvents.length > 32) pendingOverlayEvents.shift();
    return;
  }

  try {
    overlayWindow.setAlwaysOnTop(true, "screen-saver");
    overlayWindow.moveTop();
    overlayWindow.showInactive();
  } catch (error) {
    console.warn("[overlay] Nao foi possivel reafirmar a ordem da janela:", error);
  }
  overlayWindow.webContents.send(channel, payload);
};

const setOverlayPanelOpen = (open) => {
  createOverlayWindow();
  if (!overlayWindow || overlayWindow.isDestroyed()) return;
  overlayPanelOpen = Boolean(open);
  overlayWindow.setFocusable(overlayPanelOpen);

  if (overlayPanelOpen) {
    overlayWindow.setIgnoreMouseEvents(false);
    overlayWindow.show();
    overlayWindow.focus();
  } else {
    overlayWindow.setIgnoreMouseEvents(true, { forward: true });
    overlayWindow.blur();
  }

  sendOverlayEvent("overlay:panel-visibility", {
    open: overlayPanelOpen,
    state: overlayPanelState,
  });
};

const overlaySettingsFile = () => path.join(app.getPath("userData"), "overlay-settings.json");
const captureDirectory = () => path.join(app.getPath("pictures"), "Checkpoint Captures");

const saveOverlaySettings = () => {
  try {
    fs.mkdirSync(path.dirname(overlaySettingsFile()), { recursive: true });
    fs.writeFileSync(
      overlaySettingsFile(),
      JSON.stringify({
        captureShortcut,
        achievementVolume,
        achievementSoundTheme,
        achievementNotificationsEnabled,
        customAchievementNotifications,
        achievementNotificationPosition,
      }, null, 2),
      "utf8",
    );
  } catch (error) {
    console.warn("[overlay] Nao foi possivel salvar as configuracoes:", error);
  }
};

const loadRecentCaptures = () => {
  try {
    const directory = captureDirectory();
    fs.mkdirSync(directory, { recursive: true });
    recentCaptures = fs.readdirSync(directory, { withFileTypes: true })
      .filter((entry) => entry.isFile() && /\.(png|jpe?g)$/i.test(entry.name))
      .map((entry) => {
        const filePath = path.join(directory, entry.name);
        const stat = fs.statSync(filePath);
        return {
          id: `${stat.mtimeMs}:${entry.name}`,
          name: entry.name,
          url: pathToFileURL(filePath).toString(),
          createdAt: stat.mtime.toISOString(),
        };
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, CAPTURE_HISTORY_LIMIT);
  } catch (error) {
    console.warn("[overlay] Nao foi possivel carregar as capturas:", error);
    recentCaptures = [];
  }
};

const captureCurrentDisplay = async () => {
  const display = overlayDisplayId != null
    ? screen.getAllDisplays().find((candidate) => candidate.id === overlayDisplayId)
    : screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
  const targetDisplay = display || screen.getPrimaryDisplay();
  const shouldTemporarilyHideOverlay = process.platform !== "win32"
    && Boolean(overlayWindow && !overlayWindow.isDestroyed() && overlayWindow.isVisible());
  const restorePanel = overlayPanelOpen;

  try {
    if (shouldTemporarilyHideOverlay) {
      overlayWindow.hide();
      await sleep(120);
    }
    const scaleFactor = Math.max(1, Number(targetDisplay.scaleFactor) || 1);
    const captureSize = {
      width: Math.max(1, Math.round(targetDisplay.size.width * scaleFactor)),
      height: Math.max(1, Math.round(targetDisplay.size.height * scaleFactor)),
    };
    let source = null;
    let lastCaptureError = null;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const sources = await desktopCapturer.getSources({
          types: ["screen"],
          thumbnailSize: captureSize,
        });
        source = sources.find((candidate) => String(candidate.display_id) === String(targetDisplay.id))
          || sources[0]
          || null;
        if (source && !source.thumbnail.isEmpty()) break;
        source = null;
        lastCaptureError = new Error("Nenhuma imagem de tela foi retornada.");
      } catch (error) {
        lastCaptureError = error;
      }
      await sleep(100 + attempt * 80);
    }
    if (!source) {
      throw lastCaptureError || new Error("Nenhuma imagem de tela foi retornada.");
    }

    const directory = captureDirectory();
    fs.mkdirSync(directory, { recursive: true });
    const gameTitle = String(overlayPanelState.currentGame?.title || "Desktop")
      .replace(/[<>:"/\\|?*\x00-\x1F]/g, "-")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 70) || "Desktop";
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const fileName = `${gameTitle} ${stamp}.png`;
    const filePath = path.join(directory, fileName);
    fs.writeFileSync(filePath, source.thumbnail.toPNG());
    const capture = {
      id: `${Date.now()}:${fileName}`,
      name: fileName,
      url: pathToFileURL(filePath).toString(),
      createdAt: new Date().toISOString(),
      gameId: String(overlayPanelState.currentGame?.id || ""),
      gameTitle: String(overlayPanelState.currentGame?.title || ""),
    };
    recentCaptures = [capture, ...recentCaptures.filter((item) => item.url !== capture.url)]
      .slice(0, CAPTURE_HISTORY_LIMIT);
    overlayPanelState = { ...overlayPanelState, captures: recentCaptures };
    return capture;
  } finally {
    if (shouldTemporarilyHideOverlay && overlayWindow && !overlayWindow.isDestroyed()) {
      overlayWindow.showInactive();
      overlayWindow.setAlwaysOnTop(true, "screen-saver");
      if (restorePanel) {
        overlayWindow.setFocusable(true);
        overlayWindow.focus();
      }
    }
  }
};

const runCapture = async () => {
  if (captureInProgress) return { ok: false, error: "Uma captura ja esta em andamento." };
  captureInProgress = true;
  try {
    playOverlaySound("screenshot-trigger");
    const capture = await captureCurrentDisplay();
    if (overlayPanelOpen) sendOverlayEvent("overlay:panel-state", overlayPanelState);
    sendOverlayEvent("overlay:social", {
      kind: "capture-saved",
      title: getOverlayEventCopy().captureSaved,
      description: capture.name,
    });
    playOverlaySound("screenshot");
    return { ok: true, capture };
  } catch (error) {
    console.error("[overlay] Falha ao capturar a tela:", error);
    return { ok: false, error: error instanceof Error ? error.message : "Falha ao capturar a tela." };
  } finally {
    captureInProgress = false;
  }
};

const deleteCapture = async (captureId) => {
  const normalizedId = String(captureId || "").slice(0, 256);
  const capture = recentCaptures.find((item) => item.id === normalizedId);
  if (!capture) return { ok: false, error: "Captura nao encontrada." };

  try {
    const directory = path.resolve(captureDirectory());
    const filePath = path.resolve(fileURLToPath(capture.url));
    const relativePath = path.relative(directory, filePath);
    if (!relativePath || relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
      return { ok: false, error: "Arquivo de captura invalido." };
    }
    if (fs.existsSync(filePath)) await shell.trashItem(filePath);
    recentCaptures = recentCaptures.filter((item) => item.id !== normalizedId);
    overlayPanelState = { ...overlayPanelState, captures: recentCaptures };
    if (overlayPanelOpen) sendOverlayEvent("overlay:panel-state", overlayPanelState);
    return { ok: true, trashed: true };
  } catch (error) {
    console.error("[overlay] Falha ao excluir a captura:", error);
    return { ok: false, error: error instanceof Error ? error.message : "Falha ao excluir a captura." };
  }
};

const registerCaptureShortcut = (requestedShortcut) => {
  const nextShortcut = normalizeCaptureShortcut(requestedShortcut);
  if (!nextShortcut) return false;
  const previousShortcut = captureShortcut;
  if (nextShortcut === previousShortcut && globalShortcut.isRegistered(nextShortcut)) return true;
  if (previousShortcut && globalShortcut.isRegistered(previousShortcut)) {
    globalShortcut.unregister(previousShortcut);
  }
  let registered = false;
  try {
    registered = globalShortcut.register(nextShortcut, () => { void runCapture(); });
  } catch (error) {
    console.warn(`[overlay] Atalho de captura invalido: ${nextShortcut}`, error);
  }
  if (!registered) {
    if (previousShortcut && previousShortcut !== nextShortcut) {
      try {
        globalShortcut.register(previousShortcut, () => { void runCapture(); });
      } catch (error) {
        console.warn(`[overlay] Nao foi possivel restaurar o atalho ${previousShortcut}:`, error);
      }
    }
    return false;
  }
  captureShortcut = nextShortcut;
  overlayPanelState = {
    ...overlayPanelState,
    settings: { ...overlayPanelState.settings, captureShortcut },
  };
  saveOverlaySettings();
  return true;
};

const activateInGameOverlay = () => {
  inGameOverlayActive = true;
  createOverlayWindow();
  if (!overlayWindow || overlayWindow.isDestroyed()) return false;

  // The shortcut is registered at startup, but registration can fail while
  // another application temporarily owns it. Re-check it when a running game
  // is detected so capture never depends on opening the overlay panel first.
  if (!globalShortcut.isRegistered(captureShortcut) && !registerCaptureShortcut(captureShortcut)) {
    console.warn(`[overlay] O atalho de captura ${captureShortcut} nao pode ser ativado para a sessao atual.`);
  }

  try {
    syncOverlayBounds();
    overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    overlayWindow.setAlwaysOnTop(true, "screen-saver");
    overlayWindow.moveTop();
    overlayWindow.showInactive();
  } catch (error) {
    console.warn("[overlay] Nao foi possivel ativar a janela para a sessao do jogo:", error);
  }
  return true;
};

const deactivateInGameOverlay = () => {
  inGameOverlayActive = false;
  if (overlayPanelOpen) setOverlayPanelOpen(false);
};

const applyAchievementNotificationSettings = (requestedSettings) => {
  const supportedPositions = new Set(["top-left", "top-right", "bottom-left", "bottom-right"]);
  achievementNotificationsEnabled = requestedSettings?.enabled !== false;
  customAchievementNotifications = requestedSettings?.custom !== false;
  achievementNotificationPosition = supportedPositions.has(requestedSettings?.position)
    ? requestedSettings.position
    : achievementNotificationPosition;
  overlayPanelState = {
    ...overlayPanelState,
    settings: {
      ...overlayPanelState.settings,
      achievementNotificationsEnabled,
      customAchievementNotifications,
      achievementNotificationPosition,
    },
  };
  saveOverlaySettings();
  if (overlayReady && overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.webContents.send("overlay:panel-state", overlayPanelState);
  }
  return {
    enabled: achievementNotificationsEnabled,
    custom: customAchievementNotifications,
    position: achievementNotificationPosition,
  };
};

registerSecureIpcHandler("overlay:update-panel", async (_event, payload) => {
  const previouslyHadRunningGame = Boolean(overlayPanelState.currentGame);
  const friends = Array.isArray(payload?.friends) ? payload.friends.slice(0, 30).map((friend) => ({
    id: String(friend?.id || "").slice(0, 128),
    name: String(friend?.name || "Jogador").slice(0, 80),
    status: ["online", "playing", "offline"].includes(friend?.status) ? friend.status : "offline",
    playing: String(friend?.playing || "").slice(0, 120),
    avatar: sanitizeOverlayImageSource(friend?.avatar),
    unread: Math.max(0, Number(friend?.unread) || 0),
    canChat: Boolean(friend?.canChat),
  })).filter((friend) => friend.id) : [];
  const achievementItems = Array.isArray(payload?.achievements?.items)
    ? payload.achievements.items.slice(0, 300).map((achievement) => ({
      id: String(achievement?.id || "").slice(0, 160),
      name: String(achievement?.name || "Conquista").slice(0, 160),
      description: String(achievement?.description || "").slice(0, 500),
      icon: String(achievement?.icon || "").slice(0, 2048),
      achieved: Boolean(achievement?.achieved),
      unlockedAt: String(achievement?.unlockedAt || "").slice(0, 64),
    })).filter((achievement) => achievement.id)
    : [];
  const messages = Array.isArray(payload?.chat?.messages)
    ? payload.chat.messages.slice(-80).map((message) => ({
      id: String(message?.id || "").slice(0, 180),
      text: String(message?.text || "").slice(0, 2000),
      attachmentUrl: String(message?.attachmentUrl || "").slice(0, 4096),
      attachmentName: String(message?.attachmentName || "").slice(0, 160),
      createdAt: String(message?.createdAt || "").slice(0, 64),
      mine: Boolean(message?.mine),
      pending: Boolean(message?.pending),
    })).filter((message) => message.id && (message.text || message.attachmentUrl))
    : [];
  overlayPanelState = {
    language: ["pt-BR", "en-US", "es-ES", "fr-FR", "de-DE", "it-IT"].includes(payload?.language)
      ? payload.language
      : "pt-BR",
    friends,
    achievements: {
      unlocked: Math.max(0, Number(payload?.achievements?.unlocked) || 0),
      available: Math.max(0, Number(payload?.achievements?.available) || 0),
      loading: Boolean(payload?.achievements?.loading),
      items: achievementItems,
    },
    currentGame: payload?.currentGame ? {
      id: String(payload.currentGame.id || "").slice(0, 160),
      title: String(payload.currentGame.title || "").slice(0, 160),
      image: sanitizeOverlayImageSource(payload.currentGame.image),
      platform: String(payload.currentGame.platform || "").slice(0, 40),
      category: String(payload.currentGame.category || "").slice(0, 80),
      developer: String(payload.currentGame.developer || "").slice(0, 120),
      releaseDate: String(payload.currentGame.releaseDate || "").slice(0, 80),
      executableName: String(payload.currentGame.executableName || "").slice(0, 160),
      totalPlaytimeMinutes: Math.max(0, Number(payload.currentGame.totalPlaytimeMinutes) || 0),
      sessionStartedAt: String(payload.currentGame.sessionStartedAt || "").slice(0, 64),
      windowMode: String(payload.currentGame.windowMode || "").slice(0, 40),
      resolution: String(payload.currentGame.resolution || "").slice(0, 40),
      monitoring: payload.currentGame.monitoring === "verified" ? "verified" : "unverified",
    } : null,
    captures: recentCaptures,
    settings: {
      captureShortcut,
      achievementVolume,
      achievementSoundTheme,
      achievementNotificationsEnabled,
      customAchievementNotifications,
      achievementNotificationPosition,
    },
    chat: payload?.chat ? {
      friendId: String(payload.chat.friendId || "").slice(0, 128),
      friendName: String(payload.chat.friendName || "Amigo").slice(0, 80),
      friendAvatar: sanitizeOverlayImageSource(payload.chat.friendAvatar),
      typing: Boolean(payload.chat.typing),
      sending: Boolean(payload.chat.sending),
      error: String(payload.chat.error || "").slice(0, 300),
      messages,
    } : null,
    profile: {
      name: String(payload?.profile?.name || "Jogador").slice(0, 80),
      avatar: sanitizeOverlayImageSource(payload?.profile?.avatar),
      discordConnected: Boolean(payload?.profile?.discordConnected),
      discordUsername: String(payload?.profile?.discordUsername || "").slice(0, 80),
      achievements: Math.max(0, Number(payload?.profile?.achievements) || 0),
    },
  };
  const hasRunningGame = Boolean(overlayPanelState.currentGame);
  if (hasRunningGame && (!previouslyHadRunningGame || !inGameOverlayActive)) {
    activateInGameOverlay();
  } else if (!hasRunningGame && previouslyHadRunningGame) {
    deactivateInGameOverlay();
  }
  if (overlayPanelOpen) sendOverlayEvent("overlay:panel-state", overlayPanelState);
});

const getLocalGameLibrary = () => {
  if (!localGameLibrary) {
    localGameLibrary = createLocalGameLibrary(app.getPath("userData"));
  }
  return localGameLibrary;
};

registerSecureIpcHandler("library:list", async (_event, uid) =>
  getLocalGameLibrary().list(uid));
registerSecureIpcHandler("library:create", async (_event, uid, game) =>
  getLocalGameLibrary().create(uid, game));
registerSecureIpcHandler("library:update", async (_event, uid, gameId, patch) =>
  getLocalGameLibrary().update(uid, gameId, patch));
registerSecureIpcHandler("library:delete", async (_event, uid, gameId) =>
  getLocalGameLibrary().remove(uid, gameId));
registerSecureIpcHandler("library:delete-by-launcher", async (_event, uid, launcherType) =>
  getLocalGameLibrary().removeByLauncher(uid, launcherType));
registerSecureIpcHandler("library:record-session", async (_event, uid, gameId, session) =>
  getLocalGameLibrary().recordSession(uid, gameId, session));
registerSecureIpcHandler("library:bulk-upsert", async (_event, uid, games) =>
  getLocalGameLibrary().bulkUpsert(uid, games));
registerSecureIpcHandler("library:import-legacy", async (_event, uid, games) =>
  getLocalGameLibrary().importLegacy(uid, games));
registerSecureIpcHandler("library:needs-legacy-import", async (_event, uid) =>
  getLocalGameLibrary().needsLegacyImport(uid));
registerSecureIpcHandler("library:get-summary", async (_event, uid) =>
  getLocalGameLibrary().getSummary(uid));
registerSecureIpcHandler("library:mark-summary-synced", async (_event, uid, revision) =>
  getLocalGameLibrary().markSummarySynced(uid, revision));
registerSecureIpcHandler("library:clear-steam-id", async (_event, uid) =>
  getLocalGameLibrary().clearSteamId(uid));

ipcMain.handle("overlay:panel-action", async (event, action) => {
  if (!overlayWindow || event.sender !== overlayWindow.webContents) {
    throw new Error("Origem do overlay nao autorizada.");
  }
  const kind = String(action?.kind || "");
  if (kind === "toggle") {
    setOverlayPanelOpen(!overlayPanelOpen);
    return { ok: true, open: overlayPanelOpen };
  }
  if (kind === "close") {
    setOverlayPanelOpen(false);
    return;
  }
  if (kind === "set-toast-interactive") {
    if (!overlayPanelOpen && overlayWindow && !overlayWindow.isDestroyed()) {
      overlayWindow.setIgnoreMouseEvents(!Boolean(action?.interactive), { forward: true });
    }
    return { ok: true };
  }
  if (kind === "open-launcher-chat" || kind === "open-launcher-friends") {
    const payload = { kind };
    if (kind === "open-launcher-chat") {
      payload.friendId = String(action?.friendId || "").slice(0, 128);
    }
    if (overlayWindow && !overlayWindow.isDestroyed() && !overlayPanelOpen) {
      overlayWindow.setIgnoreMouseEvents(true, { forward: true });
    }
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
      mainWindow.webContents.send("overlay:panel-action", payload);
    }
    return { ok: true };
  }
  if (kind === "capture-screen") {
    return runCapture();
  }
  if (kind === "open-captures-folder") {
    fs.mkdirSync(captureDirectory(), { recursive: true });
    const error = await shell.openPath(captureDirectory());
    return { ok: !error, error };
  }
  if (kind === "delete-capture") {
    return deleteCapture(action?.captureId);
  }
  if (kind === "set-capture-shortcut") {
    const shortcut = String(action?.shortcut || "");
    const ok = registerCaptureShortcut(shortcut);
    if (ok && overlayPanelOpen) sendOverlayEvent("overlay:panel-state", overlayPanelState);
    return { ok, shortcut: captureShortcut };
  }
  if (kind === "set-achievement-notifications") {
    return applyAchievementNotificationSettings({
      enabled: action?.enabled,
      custom: action?.custom,
      position: action?.position,
    });
  }
  if (["media-play-pause", "media-next", "media-previous"].includes(kind)) {
    const keyCode = kind === "media-play-pause" ? 179 : kind === "media-next" ? 176 : 177;
    execFile("powershell.exe", [
      "-NoProfile", "-NonInteractive", "-Command",
      `$shell = New-Object -ComObject WScript.Shell; $shell.SendKeys([char]${keyCode})`,
    ], { windowsHide: true }, () => undefined);
    return;
  }
  if (["select-chat", "close-chat", "send-message", "send-image", "set-typing"].includes(kind)) {
    const payload = { kind };
    if (kind === "select-chat") payload.friendId = String(action?.friendId || "").slice(0, 128);
    if (kind === "send-message") payload.text = String(action?.text || "").trim().slice(0, 2000);
    if (kind === "set-typing") payload.typing = Boolean(action?.typing);
    if (kind === "send-image") {
      const type = String(action?.type || "").toLowerCase();
      const data = Buffer.from(action?.data || []);
      if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(type) || data.length === 0 || data.length > 8 * 1024 * 1024) {
        return { ok: false, error: "Use uma imagem JPG, PNG, WEBP ou GIF de ate 8 MB." };
      }
      payload.name = String(action?.name || "imagem").slice(0, 160);
      payload.type = type;
      payload.data = data;
    }
    mainWindow?.webContents.send("overlay:panel-action", payload);
    return { ok: true };
  }
});

const playOverlaySound = (sound) => {
  createOverlayWindow();
  if (!overlayWindow || overlayWindow.isDestroyed()) {
    throw new Error("Overlay indisponivel.");
  }

  sendOverlayEvent("overlay:play-sound", {
    sound,
    volume: achievementVolume,
    theme: achievementSoundTheme,
  });
};

const showNativeAchievementNotification = (payload) => {
  if (!Notification.isSupported()) {
    console.warn("[overlay] Notificacoes nativas nao sao suportadas neste sistema.");
    return false;
  }
  const achievement = payload?.achievement || {};
  const notification = new Notification({
    title: String(achievement.name || payload?.achievementId || getOverlayEventCopy().firstKill).slice(0, 160),
    body: String(
      achievement.description
      || nativeAchievementFallbackCopy[overlayPanelState.language]
      || nativeAchievementFallbackCopy["pt-BR"],
    ).slice(0, 500),
    icon: path.join(app.getAppPath(), "assets", "icon.png"),
    silent: true,
  });
  activeNativeNotifications.add(notification);
  notification.on("close", () => activeNativeNotifications.delete(notification));
  notification.on("click", () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    mainWindow.show();
    mainWindow.focus();
  });
  notification.show();
  return true;
};

const dispatchAchievementNotification = (payload) => {
  if (!achievementNotificationsEnabled) return false;
  if (customAchievementNotifications) {
    sendOverlayEvent("achievement:unlock", {
      ...payload,
      position: achievementNotificationPosition,
    });
  } else {
    showNativeAchievementNotification(payload);
  }
  playOverlaySound("achievement-unlock");
  return true;
};

const steamAppIdFromGameKey = (gameId) => {
  const value = String(gameId || "").trim();
  return value.match(/^steam_(\d+)$/i)?.[1] || value.match(/_steam_(\d+)$/i)?.[1] ||
    (/^\d+$/.test(value) ? value : null);
};

const startAchievementBridge = async () => {
  achievementBridge = createAchievementBridge({
    userDataPath: app.getPath("userData"),
    appUrl: APP_URL,
    logger: console,
    normalizeAchievementId: async (gameId, rawAchievementId) => {
      const appId = steamAppIdFromGameKey(gameId);
      return appId
        ? resolveEmulatorAchievementId(appId, rawAchievementId)
        : rawAchievementId;
    },
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

      dispatchAchievementNotification(payload);
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("achievement:realtime-unlock", {
          gameId: payload.gameId,
          achievementId: payload.achievementId,
          achievement: payload.achievement,
          earnedTime: Math.floor(new Date(payload.unlockedAt).getTime() / 1000),
          unlockedAt: payload.unlockedAt,
        });
      }
    },
  });

  return achievementBridge.start();
};

const migrateKnownAchievementProgress = async () => {
  if (!achievementBridge) return;
  const userDataPath = app.getPath("userData");
  let files = [];
  try {
    files = await fs.promises.readdir(userDataPath);
  } catch {
    return;
  }

  for (const file of files) {
    const appId = file.match(/^user_progress_steam_(\d+)\.json$/i)?.[1];
    if (!appId) continue;
    const detected = detectKnownEmulatorSave(appId);
    if (!detected) continue;
    const aliases = getAchievementAliases(detected);
    if (Object.keys(aliases).length === 0) continue;
    try {
      const result = await achievementBridge.migrateAchievementAliases(`steam_${appId}`, aliases);
      if (result.migrated > 0) {
        console.info(`[achievement-migration] ${result.migrated} IDs migrados para steam_${appId}.`);
      }
    } catch (error) {
      console.error(`[achievement-migration] Falha em steam_${appId}:`, error);
    }
  }
};

registerSecureIpcHandler("achievement:get-definitions", async (_event, gameId) => {
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

registerSecureIpcHandler("achievement:get-progress", async (_event, gameId) => {
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
registerSecureIpcHandler("achievement:get-local-state", async (_event, appId) => {
  try {
    if (!appId) return {};
    return readLocalSavesRetroactive(appId);
  } catch (error) {
    console.error("Error reading retroactive achievement state:", error);
    return {};
  }
});

registerSecureIpcHandler("achievement:get-epic-local", async (_event, request) => {
  try {
    const result = readEpicLocalAchievements({
      title: String(request?.title || "").slice(0, 180),
      epicCatalogId: String(request?.epicCatalogId || "").slice(0, 300),
      epicLaunchId: String(request?.epicLaunchId || "").slice(0, 800),
      executablePath: String(request?.executablePath || "").slice(0, 2_000),
    });
    const gameId = String(request?.gameId || "").trim();
    if (/^[a-zA-Z0-9_-]{1,220}$/.test(gameId) && result.achievements.length > 0) {
      const achievementsDir = path.join(app.getPath("userData"), "achievements");
      const definitionsPath = path.join(achievementsDir, `${gameId}.json`);
      const progressPath = path.join(app.getPath("userData"), `user_progress_${gameId}.json`);
      await fs.promises.mkdir(achievementsDir, { recursive: true });
      await Promise.all([
        fs.promises.writeFile(definitionsPath, JSON.stringify({
          source: "epic-local",
          achievements: result.achievements.map((achievement) => ({
            id: achievement.apiName,
            name: achievement.name,
            description: achievement.description,
            icon: achievement.icon,
          })),
        }, null, 2), "utf8"),
        fs.promises.writeFile(progressPath, JSON.stringify({
          gameId,
          unlockedAchievements: Object.fromEntries(
            result.achievements
              .filter((achievement) => achievement.achieved)
              .map((achievement) => [achievement.apiName, {
                id: achievement.apiName,
                name: achievement.name,
                description: achievement.description,
                icon: achievement.icon,
                unlockedAt: achievement.unlockTime > 0
                  ? new Date(achievement.unlockTime * 1_000).toISOString()
                  : new Date().toISOString(),
              }]),
          ),
          updatedAt: new Date().toISOString(),
        }, null, 2), "utf8"),
      ]);
    }
    return result;
  } catch (error) {
    console.error("Error reading Epic local achievements:", error);
    return {
      source: "epic-local",
      status: "no-readable-files",
      installed: false,
      installLocation: "",
      achievements: [],
      total: 0,
      unlocked: 0,
      readableFileCount: 0,
      binarySaveDetected: false,
      scanTruncated: false,
    };
  }
});

registerSecureIpcHandler("achievement:get-library-summary", async () => {
  try {
    return await readAchievementLibrarySummary(app.getPath("userData"));
  } catch (error) {
    console.error("Error reading achievement library summary:", error);
    return { byGameId: {}, bySteamAppId: {}, updatedAt: new Date().toISOString() };
  }
});

registerSecureIpcHandler("achievement:get-diagnostics", async () => ({
  bridgePort: Number(achievementBridge?.getAddress?.()?.port || 0),
  watcherKeys: Array.from(activeWatchers.keys()),
  monitoredGameKeys: Array.from(activeGameMonitors.keys()),
  pendingRescanKeys: Array.from(activeRescanTimers.keys()),
  overlayReady,
  overlayDisplayId,
  overlayVisible: Boolean(overlayWindow && !overlayWindow.isDestroyed() && overlayWindow.isVisible()),
}));

registerSecureIpcHandler("achievement:save-definitions", async (_event, gameId, definitions, steamAppId) => {
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

registerSecureIpcHandler("achievement:unlock", async (_event, gameId, achievementId) => {
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

registerSecureIpcHandler("overlay:show-friend-message", async (_event, payload) => {
  const copy = getOverlayEventCopy();
  const senderName = String(payload?.senderName || "").trim() || copy.player;
  const messageText = String(payload?.messageText || "").trim() || copy.newMessage;
  const avatarUrl = sanitizeOverlayImageSource(payload?.avatarUrl);
  const friendId = String(payload?.friendId || "").trim().slice(0, 128);

  sendOverlayEvent("overlay:social", {
    kind: "friend-message",
    title: senderName,
    description: messageText,
    avatarUrl: avatarUrl || overlayIconUrl(),
    friendId,
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

const parseIniSectionsForMerge = (content) => {
  const sections = new Map();
  let currentSection = "";
  sections.set(currentSection, new Map());

  for (const rawLine of content.split(/\r?\n/)) {
    const trimmed = rawLine.trim();
    if (!trimmed || trimmed.startsWith(";") || trimmed.startsWith("#")) continue;

    const sectionMatch = trimmed.match(/^\[([^\]]+)\]$/);
    if (sectionMatch) {
      currentSection = sectionMatch[1].trim();
      if (!sections.has(currentSection)) sections.set(currentSection, new Map());
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();
    if (key) sections.get(currentSection).set(key, value);
  }

  return sections;
};

const serializeIniSections = (sections) => {
  const chunks = [];
  for (const [sectionName, values] of sections.entries()) {
    if (!sectionName) continue;

    chunks.push(`[${sectionName}]`);
    for (const [key, value] of values.entries()) {
      chunks.push(`${key}=${value}`);
    }
    chunks.push("");
  }

  return chunks.join("\n").trimEnd() + "\n";
};

async function injectGenericIniDefinitions(appId, savePath) {
  try {
    if (!appId || !savePath) return;

    const fileName = path.basename(savePath).toLowerCase();
    if (!fileName.includes("achiev")) return;

    const targetSchema = await getSchemaByAppIdOrGameId(`steam_${appId}`);
    if (!targetSchema || targetSchema.length === 0) return;

    let currentContent = "";
    if (fs.existsSync(savePath)) {
      currentContent = await fs.promises.readFile(savePath, "utf8");
    }

    const sections = parseIniSectionsForMerge(currentContent);
    const existingAchievements = sections.get("Achievements") || new Map();
    const existingSteamAchievements = sections.get("SteamAchievements") || new Map();
    const achievedIds = new Set();

    for (const [key, value] of existingAchievements.entries()) {
      if (!key || key.toLowerCase() === "count") continue;
      const normalizedValue = String(value || "").trim().toLowerCase();
      if (["1", "true", "yes", "on"].includes(normalizedValue)) {
        achievedIds.add(key);
      }
    }

    for (const [sectionName, values] of sections.entries()) {
      if (!sectionName || sectionName === "Achievements" || sectionName === "SteamAchievements") continue;
      for (const [key, value] of values.entries()) {
        if (key.toLowerCase() !== "achieved") continue;
        const normalizedValue = String(value || "").trim().toLowerCase();
        if (["1", "true", "yes", "on"].includes(normalizedValue)) {
          achievedIds.add(sectionName);
        }
      }
    }

    for (const [key, value] of existingSteamAchievements.entries()) {
      if (!/^Achievement\d+$/i.test(key)) continue;
      const normalizedId = String(value || "").trim();
      if (normalizedId) achievedIds.add(normalizedId);
    }

    const achievementIds = targetSchema
      .map((achievement) => String(achievement?.apiName || achievement?.id || "").trim())
      .filter(Boolean);
    if (achievementIds.length === 0) return;

    const achievements = new Map();
    achievements.set("Count", String(achievementIds.length));
    for (const id of achievementIds) {
      achievements.set(id, achievedIds.has(id) ? "1" : "0");
    }

    const nextSections = new Map([["Achievements", achievements]]);
    const nextContent = serializeIniSections(nextSections);
    if (currentContent.trim() !== nextContent.trim()) {
      await fs.promises.mkdir(path.dirname(savePath), { recursive: true });
      await fs.promises.writeFile(savePath, nextContent, "utf8");
      console.info(`[generic-ini-injector] Arquivo de conquistas inicializado para o AppID ${appId}: ${savePath}`);
    }
  } catch (error) {
    console.error(`[generic-ini-injector] Falha ao inicializar conquistas:`, error);
  }
}

registerSecureIpcHandler("launcher:get-displays", async () => screen.getAllDisplays().map((display, index) => ({
  id: display.id,
  label: `Monitor ${index + 1}`,
  primary: display.id === screen.getPrimaryDisplay().id,
  width: display.bounds.width,
  height: display.bounds.height,
})));

registerSecureIpcHandler("launcher:select-executable", async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: "Selecione o executavel do jogo",
    properties: ["openFile"],
    buttonLabel: "Selecionar jogo",
    filters: [{ name: "Executaveis do Windows", extensions: ["exe"] }],
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  const selectedPath = path.normalize(result.filePaths[0]);
  if (
    !path.isAbsolute(selectedPath)
    || path.extname(selectedPath).toLowerCase() !== ".exe"
  ) {
    throw new Error("Selecione um arquivo executavel .exe valido.");
  }
  return selectedPath;
});

registerSecureIpcHandler("mods:select-game-directory", async (_event, gameTitle) =>
  selectModGameDirectory({
    dialog,
    parentWindow: mainWindow,
    gameTitle,
  }));

const epicStoreSearchCache = new Map();
const epicStoreDetailsCache = new Map();
let epicStoreSearchWindow = null;
let epicStoreReadyPromise = null;
let epicStoreIdleTimer = null;

const scheduleEpicStoreWindowShutdown = () => {
  if (epicStoreIdleTimer) clearTimeout(epicStoreIdleTimer);
  epicStoreIdleTimer = setTimeout(() => {
    epicStoreIdleTimer = null;
    if (epicStoreSearchWindow && !epicStoreSearchWindow.isDestroyed()) {
      epicStoreSearchWindow.destroy();
    }
  }, 30_000);
  epicStoreIdleTimer.unref?.();
};

const ensureEpicStoreSearchWindow = async () => {
  if (epicStoreIdleTimer) clearTimeout(epicStoreIdleTimer);
  epicStoreIdleTimer = null;
  if (
    epicStoreSearchWindow
    && !epicStoreSearchWindow.isDestroyed()
    && epicStoreReadyPromise
  ) {
    await epicStoreReadyPromise;
    return epicStoreSearchWindow;
  }

  const searchWindow = new BrowserWindow({
    show: false,
    width: 1100,
    height: 800,
    webPreferences: {
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: true,
      spellcheck: false,
      partition: "persist:epic-store-search",
    },
  });
  epicStoreSearchWindow = searchWindow;
  searchWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  searchWindow.on("closed", () => {
    if (epicStoreSearchWindow === searchWindow) {
      epicStoreSearchWindow = null;
      epicStoreReadyPromise = null;
    }
  });
  epicStoreReadyPromise = searchWindow.loadURL(
    "https://store.epicgames.com/pt-BR/browse?sortBy=relevancy&sortDir=DESC&count=12",
  ).catch((error) => {
    if (!searchWindow.isDestroyed()) searchWindow.destroy();
    throw error;
  });
  await epicStoreReadyPromise;
  return searchWindow;
};

const searchEpicGamesStore = async (rawQuery) => {
  const searchQuery = String(rawQuery || "").trim().slice(0, 100);
  if (searchQuery.length < 2) return [];
  const cacheKey = searchQuery.toLocaleLowerCase("pt-BR");
  const cached = epicStoreSearchCache.get(cacheKey);
  if (cached && Date.now() - cached.createdAt < 5 * 60 * 1_000) return cached.items;

  const searchWindow = await ensureEpicStoreSearchWindow();
  const graphqlBody = JSON.stringify({
    query: EPIC_STORE_GRAPHQL_QUERY,
    variables: {
      keywords: searchQuery,
      locale: "pt-BR",
      country: "BR",
      count: 12,
      start: 0,
    },
  });
  const graphqlResult = await searchWindow.webContents.executeJavaScript(`(async () => {
    const response = await fetch("/graphql", {
      method: "POST",
      headers: { "Content-Type": "application/json;charset=UTF-8" },
      body: ${JSON.stringify(graphqlBody)}
    });
    return {
      ok: response.ok,
      status: response.status,
      payload: await response.json().catch(() => ({}))
    };
  })()`, true).catch(() => ({ ok: false, status: 0, payload: null }));

  const graphqlElements =
    graphqlResult?.payload?.data?.Catalog?.searchStore?.elements;
  const graphqlAvailable = graphqlResult?.ok && Array.isArray(graphqlElements);
  let items = graphqlAvailable
    ? normalizeEpicGraphqlElements(graphqlElements, readInstalledEpicGames())
    : [];

  if (!graphqlAvailable) {
    const targetUrl = new URL("https://store.epicgames.com/pt-BR/browse");
    targetUrl.searchParams.set("q", searchQuery);
    targetUrl.searchParams.set("sortBy", "relevancy");
    targetUrl.searchParams.set("sortDir", "DESC");
    targetUrl.searchParams.set("count", "12");
    await searchWindow.loadURL(targetUrl.toString());
    const deadline = Date.now() + 15_000;
    let cards = [];
    while (Date.now() < deadline && cards.length === 0 && !searchWindow.isDestroyed()) {
      cards = await searchWindow.webContents
        .executeJavaScript(EPIC_STORE_CARD_EXTRACTOR, true)
        .catch(() => []);
      if (cards.length === 0) {
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
    }
    items = normalizeEpicStoreCards(cards, readInstalledEpicGames());
  }

  items = items.slice(0, 12);
  epicStoreSearchCache.set(cacheKey, { createdAt: Date.now(), items });
  if (epicStoreSearchCache.size > 50) {
    epicStoreSearchCache.delete(epicStoreSearchCache.keys().next().value);
  }
  scheduleEpicStoreWindowShutdown();
  return items;
};

registerSecureIpcHandler("launcher:search-epic-store", async (_event, query) =>
  searchEpicGamesStore(query));

const fetchEpicGamesStoreDetails = async (rawRequest) => {
  const productSlug = String(rawRequest?.productSlug || "")
    .trim()
    .replace(/^\/+|\/+$/g, "")
    .replace(/\/home$/i, "");
  if (!/^[a-z0-9][a-z0-9-]{0,199}$/i.test(productSlug)) {
    throw new Error("Produto Epic invalido.");
  }
  const supportedLocales = new Set(["pt-BR", "en-US", "es-ES", "fr-FR", "de-DE", "it-IT"]);
  const locale = supportedLocales.has(rawRequest?.language) ? rawRequest.language : "pt-BR";
  const cacheKey = `${locale}:${productSlug.toLocaleLowerCase("en-US")}`;
  const cached = epicStoreDetailsCache.get(cacheKey);
  if (cached && Date.now() - cached.createdAt < 15 * 60 * 1_000) return cached.details;

  const url = `https://store-content-ipv4.ak.epicgames.com/api/${locale}/content/products/${encodeURIComponent(productSlug)}`;
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "Accept-Language": `${locale},en;q=0.8`,
      Referer: `https://store.epicgames.com/${locale}/p/${productSlug}`,
    },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    throw new Error(`A Epic nao retornou os detalhes do jogo (status ${response.status}).`);
  }
  const payload = await response.json();
  const details = normalizeEpicStoreDetails(payload, {
    productSlug,
    catalogId: String(rawRequest?.catalogId || "").trim(),
    namespace: String(rawRequest?.namespace || "").trim(),
  }, readInstalledEpicGames());
  if (!details) throw new Error("Detalhes nao encontrados na Epic Games Store.");
  epicStoreDetailsCache.set(cacheKey, { createdAt: Date.now(), details });
  if (epicStoreDetailsCache.size > 50) {
    epicStoreDetailsCache.delete(epicStoreDetailsCache.keys().next().value);
  }
  return details;
};

registerSecureIpcHandler("launcher:fetch-epic-store-details", async (_event, request) =>
  fetchEpicGamesStoreDetails(request));

registerSecureIpcHandler("system:set-open-at-login", async (_event, open) => {
  const shouldOpen = Boolean(open);

  if (process.platform === "win32") {
    // Remove the legacy entry first. Older builds could leave Electron/dev
    // arguments registered instead of the installed launcher executable.
    app.setLoginItemSettings({ openAtLogin: false });
    app.setLoginItemSettings({
      openAtLogin: false,
      path: process.execPath,
      args: [AUTO_START_ARG],
    });

    if (shouldOpen && app.isPackaged) {
      app.setLoginItemSettings({
        openAtLogin: true,
        path: process.execPath,
        args: [AUTO_START_ARG],
      });
    }

    return {
      openAtLogin: shouldOpen && app.isPackaged,
      supported: app.isPackaged,
    };
  }

  app.setLoginItemSettings({ openAtLogin: shouldOpen });
  return { openAtLogin: shouldOpen, supported: true };
});

registerSecureIpcHandler("launcher:open-executable", async (
  _event,
  executablePath,
  rawLaunchProfile,
  rawLaunchOptions,
) => {
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

  const defaultWorkingDirectory = path.dirname(normalizedTarget);
  const launchProfile = normalizeLaunchProfile(rawLaunchProfile, defaultWorkingDirectory);
  const hideLauncher = rawLaunchOptions?.hideLauncher !== false;
  if (!fs.existsSync(launchProfile.workingDirectory) || !fs.statSync(launchProfile.workingDirectory).isDirectory()) {
    launchProfile.workingDirectory = defaultWorkingDirectory;
  }
  if (launchProfile.monitorId != null && screen.getAllDisplays().some((display) => display.id === launchProfile.monitorId)) {
    overlayDisplayId = launchProfile.monitorId;
    syncOverlayBounds();
  }

  if (ENABLE_EMULATOR_FILE_INJECTION) {

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
      const bridgeAddress = achievementBridge?.getAddress?.();
      const bridgePort = Number(bridgeAddress?.port || 3000);
      fs.writeFileSync(
        path.join(settingsPath, "achievements_receiver.txt"),
        `http://127.0.0.1:${bridgePort}`,
        "utf8",
      );

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
  stopGameProcessMonitor(watcherKey);
  stopGameWatcher(watcherKey);

  // Função chamada pelo watcher quando o arquivo de saves muda.
  // Async: resolve metadados de conquistas diretamente e envia ao overlay.
  const handleAchievementFileChange = async (detectedEmulator) => {
    try {
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

      // Atualiza o estado — SÓ se o parse retornou dados úteis.
      // Um parse vazio (erro de leitura durante escrita) não deve zerar o
      // estado anterior, evitando falsos positivos na próxima verificação.
      if (Object.keys(newState).length > 0) {
        entry.lastState = newState;
      }

      if (newlyUnlocked.length === 0) return;

      // Uma única entrada para persistência, metadados, dedupe, overlay e IPC.
      for (const { id } of newlyUnlocked) {
        if (!achievementBridge) continue;
        await achievementBridge.unlockAchievement(watcherKey, id);
      }
    } catch (err) {
      console.error("[achievement-watcher] Erro em handleAchievementFileChange:", err);
    }
  };

  /**
   * Inicia o fs.watch no diretório de saves do emulador.
   * @param {object} detectedEmulator
   * @param {Function|null} onExit - chamada quando o jogo encerrar (pode ser null)
   */
  const startGameWatcher = (detectedEmulator, onExit) => {
    if (!detectedEmulator) return;

    // Somente leitura: nunca cria diretórios ou arquivos de save.
    if (!fs.existsSync(detectedEmulator.watchDir) || !fs.existsSync(detectedEmulator.savePath)) return;

    // Lê o estado inicial ANTES de montar o watcher para poder comparar depois.
    const initialState = parseAchievementState(detectedEmulator);

    let debounceTimer = null;
    let watcher = null;
    let intervalTimer = null;

    // Se for emulador genérico (.ini como RUNE/CODEX), fs.watch falha. Usamos Polling!
    if (detectedEmulator.emulatorType === "generic_ini") {
      console.info(`[achievement-watcher] Usando Polling de 3s para o emulador INI em: ${detectedEmulator.savePath}`);
      intervalTimer = setInterval(() => {
        handleAchievementFileChange(detectedEmulator).catch(
          (err) => console.error("[achievement-watcher] Polling error:", err)
        );
      }, 3000);
    } else {
      // Para Goldberg/Tenoke (.json), fs.watch funciona perfeitamente.
      try {
        watcher = fs.watch(detectedEmulator.watchDir, { persistent: false }, (_event, filename) => {
          const saveFile = path.basename(detectedEmulator.savePath);
          if (filename && filename !== saveFile) return;

          clearTimeout(debounceTimer);
          debounceTimer = setTimeout(() => {
            handleAchievementFileChange(detectedEmulator).catch(
              (err) => console.error("[achievement-watcher] Watch error:", err)
            );
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

  // ─── Injector unificado ──────────────────────────────────────────────────
  // Delega ao injector correto com base no tipo de emulador detectado,
  // evitando a dupla chamada a getSchemaByAppIdOrGameId que havia antes.
  const injectAchievementDefinitions = async (appId, emulator, settingsPath) => {
    if (!ENABLE_EMULATOR_FILE_INJECTION) return;
    if (!appId) return;
    if (emulator?.emulatorType === "generic_ini") {
      await injectGenericIniDefinitions(appId, emulator.savePath);
    } else if (settingsPath) {
      await injectGoldbergDefinitions(appId, settingsPath);
    }
  };

  let detectedEmulator = detectedGameAppId
    ? detectEmulator(gameDir, detectedGameAppId)
    : null;

  if (detectedEmulator && achievementBridge) {
    const aliases = getAchievementAliases(detectedEmulator);
    const migration = await achievementBridge.migrateAchievementAliases(watcherKey, aliases);
    if (migration.migrated > 0) {
      console.info(`[achievement-migration] ${migration.migrated} IDs legados migrados em ${watcherKey}.`);
    }
  }

  // Resolve o settingsPath novamente (já foi calculado acima no bloco de autoconfig)
  const _settingsPathForInject = (() => {
    const candidates = [
      path.join(gameDir, "steam_settings"),
      path.join(path.dirname(gameDir), "steam_settings"),
    ];
    for (const p of candidates) {
      if (fs.existsSync(p)) return p;
    }
    return null;
  })();

  await injectAchievementDefinitions(detectedGameAppId, detectedEmulator, _settingsPathForInject);

  // A baseline lets the monitor distinguish a process started by this launch
  // from another executable that was already open in the same directory.
  const launchProcessBaseline = await getRunningProcesses({ forceRefresh: true }).catch(() => []);

  try {
    const child = spawn(normalizedTarget, launchProfile.arguments, {
      cwd: launchProfile.workingDirectory,
      detached: true,
      stdio: "ignore",
    });

    // A sessao passa a ser acompanhada pelo executavel real depois do spawn.
    child.once("spawn", () => {
      if (launchProfile.monitorId == null) selectOverlayDisplayFromLauncher();
      try {
        const priority = launchProfile.processPriority === "high"
          ? -14
          : launchProfile.processPriority === "above-normal" ? -7 : 0;
        process.setPriority(child.pid, priority);
      } catch (error) {
        console.warn("[launcher] Nao foi possivel aplicar prioridade ao processo:", error);
      }
      applyWindowProfile(normalizedTarget, launchProfile);
      startGameProcessMonitor(watcherKey, normalizedTarget, {
        rootPid: child.pid,
        baselineProcesses: launchProcessBaseline,
        restoreLauncher: hideLauncher,
      });
      if (hideLauncher && mainWindow) {
        mainWindow.hide();
      }
    });

    // O watcher nao depende do evento de saida do processo retornado por spawn:
    // launchers intermediarios podem encerrar antes do executavel real do jogo.
    if (detectedEmulator) {
      startGameWatcher(detectedEmulator, null);
    } else if (detectedGameAppId) {
      // ── Re-scan loop: emuladores como RUNE/CODEX criam o arquivo de save ──────
      // somente APÓS o jogo inicializar (2-5s de delay típico). Tentamos
      // re-detectar a cada 3s por até 30s antes de desistir.
      console.info(`[achievement-watcher] Emulador não encontrado imediatamente para appId ${detectedGameAppId}. Iniciando re-scan por 30s...`);
      const RESCAN_INTERVAL_MS = 3000;
      const RESCAN_MAX_ATTEMPTS = 10; // 10 * 3s = 30s
      let rescanAttempt = 0;
      const rescanTimer = setInterval(() => {
        rescanAttempt++;
        const found = detectEmulator(gameDir, detectedGameAppId);
        if (found) {
          clearInterval(rescanTimer);
          activeRescanTimers.delete(watcherKey);
          console.info(`[achievement-watcher] Emulador encontrado após ${rescanAttempt * RESCAN_INTERVAL_MS / 1000}s: ${found.emulatorType}`);
          // Injeta definições agora que o arquivo de save foi criado
          injectAchievementDefinitions(detectedGameAppId, found, _settingsPathForInject).catch(() => {});
          const aliases = getAchievementAliases(found);
          achievementBridge?.migrateAchievementAliases(watcherKey, aliases).catch(
            (error) => console.error("[achievement-migration] Falha:", error),
          );
          startGameWatcher(found, null);
        } else if (rescanAttempt >= RESCAN_MAX_ATTEMPTS) {
          clearInterval(rescanTimer);
          activeRescanTimers.delete(watcherKey);
          console.warn(`[achievement-watcher] Re-scan encerrado: nenhum emulador encontrado para appId ${detectedGameAppId} após 30s.`);
        }
      }, RESCAN_INTERVAL_MS);
      activeRescanTimers.set(watcherKey, rescanTimer);
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
        if (launchProfile.monitorId == null) selectOverlayDisplayFromLauncher();
        applyWindowProfile(normalizedTarget, launchProfile);
        startGameProcessMonitor(watcherKey, normalizedTarget, {
          baselineProcesses: launchProcessBaseline,
          restoreLauncher: hideLauncher,
        });
        if (hideLauncher && mainWindow) mainWindow.hide();
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
      if (launchProfile.monitorId == null) selectOverlayDisplayFromLauncher();
      applyWindowProfile(normalizedTarget, launchProfile);
      startGameProcessMonitor(watcherKey, normalizedTarget, {
        baselineProcesses: launchProcessBaseline,
        restoreLauncher: hideLauncher,
      });
      if (hideLauncher && mainWindow) mainWindow.hide();
    }
  }
});

// ─── Cache de processos em execução (TTL 1.5s) ─────────────────────────────────────────
let _processListCache = { names: new Set(), expiresAt: 0 };

const getRunningProcessNames = async () => {
  if (Date.now() < _processListCache.expiresAt) {
    return _processListCache.names;
  }

  const output = await new Promise((resolve, reject) => {
    execFile("tasklist", ["/fo", "csv", "/nh"], { windowsHide: true }, (error, stdout = "") => {
      if (error) { reject(error); return; }
      resolve(stdout);
    });
  }).catch(() => "");

  const names = new Set(
    String(output)
      .split(/\r?\n/)
      .map((line) => line.match(/^"([^"]+)"/)?.[1]?.toLowerCase())
      .filter(Boolean),
  );

  _processListCache = { names, expiresAt: Date.now() + 1500 };
  return names;
};

let _processSnapshotCache = { processes: [], expiresAt: 0, pending: null };
let _wmicAvailability = "unknown";
let _processSnapshotFallbackLogged = false;

const getRunningProcesses = async ({ forceRefresh = false } = {}) => {
  if (!forceRefresh && Date.now() < _processSnapshotCache.expiresAt) {
    return _processSnapshotCache.processes;
  }
  if (_processSnapshotCache.pending) return _processSnapshotCache.pending;

  const pending = new Promise((resolve, reject) => {
    execFile(
      "wmic.exe",
      ["process", "get", "ProcessId,ParentProcessId,Name,ExecutablePath", "/FORMAT:CSV"],
      { windowsHide: true, maxBuffer: 8 * 1024 * 1024 },
      (error, stdout = "") => {
        if (error) {
          if (error.code === "ENOENT") _wmicAvailability = "unavailable";
          reject(error);
          return;
        }

        try {
          const lines = stdout.split(/\r?\n/).filter((line) => line.trim());
          const processes = [];

          if (lines.length > 1) {
            const header = lines[0].split(",");
            const pathIdx = header.findIndex((h) => h.toLowerCase().includes("executablepath"));
            const nameIdx = header.findIndex((h) => h.toLowerCase().includes("name"));
            const parentIdx = header.findIndex((h) => h.toLowerCase().includes("parentprocessid"));
            const pidIdx = header.findIndex((h) => h.toLowerCase().includes("processid"));

            for (let i = 1; i < lines.length; i++) {
              const cols = lines[i].split(",");
              if (cols.length < header.length) continue;

              const pid = parseInt(cols[pidIdx], 10);
              const parentPid = parseInt(cols[parentIdx], 10);
              const name = (cols[nameIdx] || "").trim().toLowerCase();
              const execPath = (cols[pathIdx] || "").trim();

              if (pid > 0 && name) {
                processes.push({
                  pid,
                  parentPid: Number.isInteger(parentPid) ? parentPid : 0,
                  name,
                  executablePath: execPath ? path.normalize(execPath).toLowerCase() : "",
                });
              }
            }
          }
          _wmicAvailability = "available";
          resolve(processes);
        } catch (parseError) {
          reject(parseError);
        }
      }
    );
  });

  _processSnapshotCache.pending = pending;
  try {
    const processes = await pending;
    _processSnapshotCache = {
      processes,
      expiresAt: Date.now() + 2500,
      pending: null,
    };
    return processes;
  } catch (error) {
    _processSnapshotCache.pending = null;
    throw error;
  }
};

const getProcessSnapshotWithFallback = async ({ forceRefresh = false } = {}) => {
  const getFallbackSnapshot = async () => {
    const runningNames = await getRunningProcessNames().catch(() => new Set());
    return Array.from(runningNames, (name) => ({
      pid: 0,
      parentPid: 0,
      name,
      executablePath: "",
    }));
  };

  // WMIC foi removido das versoes atuais do Windows. Depois do primeiro ENOENT,
  // nao tentamos mais criar um processo que sabemos nao existir.
  if (_wmicAvailability === "unavailable") return getFallbackSnapshot();

  try {
    return await getRunningProcesses({ forceRefresh });
  } catch (error) {
    if (!_processSnapshotFallbackLogged) {
      _processSnapshotFallbackLogged = true;
      console.info("[launcher] WMIC indisponivel; monitoramento usando tasklist nesta sessao.");
    }
    return getFallbackSnapshot();
  }
};

const stopGameProcessMonitor = (watcherKey) => {
  const monitor = activeGameMonitors.get(watcherKey);
  if (monitor) {
    clearInterval(monitor.timer);
    activeGameMonitors.delete(watcherKey);
  }
  const rescanTimer = activeRescanTimers.get(watcherKey);
  if (rescanTimer) {
    clearInterval(rescanTimer);
    activeRescanTimers.delete(watcherKey);
  }
};

const finishMonitoredGameSession = (watcherKey) => {
  const restoreLauncher = activeGameMonitors.get(watcherKey)?.restoreLauncher === true;
  stopGameProcessMonitor(watcherKey);
  stopGameWatcher(watcherKey);
  if (restoreLauncher && mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.show();
    mainWindow.focus();
  }
};

const startGameProcessMonitor = (watcherKey, executablePath, options = {}) => {
  const existingMonitor = activeGameMonitors.get(watcherKey);
  if (existingMonitor) {
    clearInterval(existingMonitor.timer);
    activeGameMonitors.delete(watcherKey);
  }
  const tracker = createGameProcessTracker({
    targetPath: executablePath,
    rootPid: options.rootPid,
    baselineProcesses: options.baselineProcesses || [],
    startedAt: Date.now(),
  });
  const monitor = {
    timer: null,
    checking: false,
    requestedExecutablePath: normalizeWindowsPath(executablePath),
    activeExecutablePath: normalizeWindowsPath(executablePath),
    lastStatus: "starting",
    restoreLauncher: options.restoreLauncher === true,
    tracker,
  };

  const check = async () => {
    if (monitor.checking) return;
    monitor.checking = true;
    try {
      const processes = await getProcessSnapshotWithFallback({ forceRefresh: true });
      const previousActivePath = monitor.activeExecutablePath;
      const result = tracker.observe(processes, Date.now());
      monitor.lastStatus = result.status;
      monitor.activeExecutablePath = result.activeExecutablePath;

      if (result.adopted && previousActivePath !== result.activeExecutablePath) {
        console.info(
          `[launcher] Processo real adotado para ${watcherKey}: ${result.activeExecutablePath}`,
        );
      }
      if (result.status === "finished") finishMonitoredGameSession(watcherKey);
    } finally {
      monitor.checking = false;
    }
  };

  monitor.timer = setInterval(() => void check(), 3000);
  activeGameMonitors.set(watcherKey, monitor);
  void check();
};

const isManagedExecutableActive = (executablePath) => {
  const normalizedTarget = normalizeWindowsPath(executablePath);
  if (!normalizedTarget) return false;
  return Array.from(activeGameMonitors.values()).some((monitor) => (
    monitor.requestedExecutablePath === normalizedTarget
    && monitor.lastStatus !== "finished"
  ));
};

registerSecureIpcHandler("launcher:is-executable-running", async (_event, executablePath) => {
  const target = String(executablePath || "").trim();
  if (!target) return false;

  const normalizedTarget = path.normalize(target);
  const executableName = path.basename(normalizedTarget);
  if (!executableName || path.extname(executableName).toLowerCase() !== ".exe") return false;

  // The configured launcher may have exited after spawning the real game.
  // Keep renderer presence qualified while the managed replacement is alive.
  if (isManagedExecutableActive(normalizedTarget)) return true;

  const runningNames = await getRunningProcessNames().catch(() => new Set());
  return runningNames.has(executableName.toLowerCase());
});

registerSecureIpcHandler("launcher:detect-running-games", async (_event, executablePaths) => {
  const normalizedTargets = Array.isArray(executablePaths)
    ? executablePaths
      .map((value) => String(value || "").trim())
      .filter(Boolean)
      .map((value) => path.normalize(value))
      .filter((value) => path.isAbsolute(value) && path.extname(value).toLowerCase() === ".exe")
    : [];

  if (normalizedTargets.length === 0) return [];

  const runningNames = await getRunningProcessNames().catch(() => new Set());
  return normalizedTargets.filter((target) => (
    isManagedExecutableActive(target)
    || runningNames.has(path.basename(target).toLowerCase())
  ));
});

registerSecureIpcHandler("auth:start-google-browser", async () => {
  const state = crypto.randomUUID();
  const authUrl = new URL("/auth/google/start", APP_URL);
  authUrl.searchParams.set("state", state);
  await shell.openExternal(authUrl.toString());
  return { state };
});

registerSecureIpcHandler("shell:open-external", async (_event, url) => {
  const rawUrl = String(url || "").trim();
  if (!isSafeOpenExternalUrl(rawUrl)) {
    throw new Error("Protocolo nao permitido.");
  }
  await shell.openExternal(rawUrl);
});

registerSecureIpcHandler("system:copy-to-clipboard", async (_event, value) => {
  const text = String(value ?? "").slice(0, 512);
  if (!text) throw new Error("Nenhum texto para copiar.");
  clipboard.writeText(text, "clipboard");
  return { ok: true };
});

registerSecureIpcHandler("overlay:test-welcome", async () => {
  const copy = getOverlayEventCopy();
  selectOverlayDisplayFromLauncher();
  sendOverlayEvent("overlay:social", {
    kind: "game-start",
    title: copy.enjoy,
    description: copy.active,
  });
});

registerSecureIpcHandler("overlay:test-achievement", async () => {
  const copy = getOverlayEventCopy();
  selectOverlayDisplayFromLauncher();
  dispatchAchievementNotification({
    gameId: "checkpoint-lab",
    achievementId: "overlay-smoke-test",
    achievement: {
      id: "overlay-smoke-test",
      name: copy.firstKill,
      description: copy.testAchievement,
      icon: overlayIconUrl(),
    },
    unlockedAt: new Date().toISOString(),
    duplicate: false,
  });
});

registerSecureIpcHandler("overlay:set-achievement-volume", async (_event, requestedVolume) => {
  const numericVolume = Number(requestedVolume);
  achievementVolume = Number.isFinite(numericVolume)
    ? Math.min(100, Math.max(0, Math.round(numericVolume)))
    : 22;
  overlayPanelState = {
    ...overlayPanelState,
    settings: { ...overlayPanelState.settings, achievementVolume },
  };
  saveOverlaySettings();
  return { volume: achievementVolume };
});

registerSecureIpcHandler("overlay:set-achievement-sound-theme", async (_event, requestedTheme) => {
  const supportedThemes = new Set(["ps5", "ps4", "psp", "ps2", "gamecube", "xbox360", "cyberpunk"]);
  achievementSoundTheme = supportedThemes.has(requestedTheme) ? requestedTheme : "ps5";
  overlayPanelState = {
    ...overlayPanelState,
    settings: { ...overlayPanelState.settings, achievementSoundTheme },
  };
  saveOverlaySettings();
  return { theme: achievementSoundTheme };
});

registerSecureIpcHandler("overlay:set-achievement-notification-settings", async (_event, requestedSettings) => {
  return applyAchievementNotificationSettings(requestedSettings);
});

registerSecureIpcHandler("overlay:toggle-panel", async () => {
  setOverlayPanelOpen(!overlayPanelOpen);
  return { open: overlayPanelOpen };
});

registerSecureIpcHandler("overlay:show-game-start", async (_event, payload) => {
  const copy = getOverlayEventCopy();
  selectOverlayDisplayFromLauncher();
  activateInGameOverlay();
  const gameTitle = String(payload?.gameTitle || "").trim();
  sendOverlayEvent("overlay:social", {
    kind: "game-start",
    title: copy.enjoy,
    description: gameTitle
      ? `${copy.playing} ${gameTitle}`
      : copy.active,
  });
  setTimeout(() => {
    sendOverlayEvent("overlay:social", {
      kind: "overlay-hint",
      title: copy.open,
      description: copy.shortcut,
    });
  }, 1400);
});

registerSecureIpcHandler("overlay:show-friend-playing", async (_event, payload) => {
  const copy = getOverlayEventCopy();
  const playerName = String(payload?.playerName || "").trim() || copy.player;
  const gameTitle = String(payload?.gameTitle || "").trim() || copy.now;
  const avatarUrl = sanitizeOverlayImageSource(payload?.avatarUrl);

  sendOverlayEvent("overlay:social", {
    kind: "friend-playing",
    title: playerName,
    description: `${copy.friendPlaying} ${gameTitle}`,
    avatarUrl: avatarUrl || overlayIconUrl(),
  });
});

registerSecureIpcHandler("overlay:show-friend-request", async (_event, payload) => {
  const copy = getOverlayEventCopy();
  const playerName = String(payload?.playerName || "").trim() || copy.player;
  const avatarUrl = sanitizeOverlayImageSource(payload?.avatarUrl);
  const friendId = String(payload?.friendId || "").trim().slice(0, 128);

  sendOverlayEvent("overlay:social", {
    kind: "friend-request",
    title: playerName,
    description: copy.request,
    avatarUrl: avatarUrl || overlayIconUrl(),
    friendId,
  });
});

registerSecureIpcHandler("overlay:show-friend-accepted", async (_event, payload) => {
  const copy = getOverlayEventCopy();
  const playerName = String(payload?.playerName || "").trim() || copy.player;
  const avatarUrl = sanitizeOverlayImageSource(payload?.avatarUrl);

  sendOverlayEvent("overlay:social", {
    kind: "friend-accepted",
    title: playerName,
    description: copy.accepted,
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

// ─── Scheduler de concorrência limitada para scanForExe ────────────────────────────
// Processa até SCAN_CONCURRENCY diretórios em paralelo sem dependência externa.
const SCAN_CONCURRENCY = 4;

const makePLimit = (limit) => {
  let active = 0;
  const queue = [];
  const next = () => {
    if (active >= limit || queue.length === 0) return;
    active++;
    const { fn, resolve, reject } = queue.shift();
    Promise.resolve().then(fn).then(resolve, reject).finally(() => { active--; next(); });
  };
  return (fn) => new Promise((resolve, reject) => { queue.push({ fn, resolve, reject }); next(); });
};

const scanForExe = async (rootDir, results = [], seenPaths = new Set()) => {
  const run = makePLimit(SCAN_CONCURRENCY);

  const scan = async (dir, depth) => {
    if (depth > MAX_DEPTH || results.length >= MAX_RESULTS) return;
    let entries;
    try {
      entries = await fs.promises.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }

    const subdirs = [];
    for (const entry of entries) {
      if (results.length >= MAX_RESULTS) break;
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name.startsWith(".") || entry.name === "node_modules" || entry.name === "$RECYCLE.BIN") continue;
        subdirs.push(fullPath);
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".exe")) {
        pushExeResult(fullPath, results, seenPaths);
      }
    }

    // Processa subdiretórios em paralelo (até SCAN_CONCURRENCY simultâneos)
    await Promise.all(subdirs.map((subdir) => run(() => scan(subdir, depth + 1))));
  };

  await scan(rootDir, 0);
  return results;
};

registerSecureIpcHandler("game:scan-local", async (_event) => {
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
      // Cada pasta raiz selecionada inicia seu próprio scan paralelo
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

// O usuário escolhe quando iniciar o download. Depois de baixada, escolhe quando reiniciar.
autoUpdater.autoDownload = false;
let updaterState = {
  status: "idle",
  info: null,
  progress: null,
  error: "",
};

const formatUpdaterError = (error) => {
  const rawMessage = String(error?.message || error || "");
  if (
    /\b404\b/.test(rawMessage)
    && /github\.com\/Guilhermesttt\/Checkpoint---Launcher\/releases/i.test(rawMessage)
  ) {
    return [
      "Nao foi possivel acessar os releases do Checkpoint no GitHub.",
      "O repositorio esta privado ou nao possui uma release publica com latest.yml.",
    ].join(" ");
  }
  if (/401|bad credentials|authentication token/i.test(rawMessage)) {
    return "O servidor de atualizacoes recusou a autenticacao.";
  }
  const firstLine = rawMessage.split(/\r?\n/, 1)[0]
    .replace(/\b(?:authorization|cookie|set-cookie)\b\s*[:=][^,}]+/gi, "$1: [oculto]")
    .trim();
  return firstLine.slice(0, 500) || "Erro desconhecido ao verificar atualizacoes.";
};

const sendUpdaterMessage = (message, data) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("update:message", message, data);
  }
};

// Repassa eventos do autoUpdater para a interface de usuário (Vite/React)
autoUpdater.on("checking-for-update", () => {
  if (updaterState.status === "downloaded") return;
  updaterState = { ...updaterState, status: "checking", error: "" };
  sendUpdaterMessage("checking-for-update");
});

autoUpdater.on("update-available", (info) => {
  if (updaterState.status === "downloaded") return;
  updaterState = { status: "available", info, progress: null, error: "" };
  sendUpdaterMessage("update-available", info);
});

autoUpdater.on("update-not-available", (info) => {
  if (updaterState.status === "downloaded") return;
  updaterState = { status: "not-available", info, progress: null, error: "" };
  sendUpdaterMessage("update-not-available", info);
});

autoUpdater.on("error", (err) => {
  const message = formatUpdaterError(err);
  updaterState = { ...updaterState, status: "error", error: message };
  sendUpdaterMessage("error", message);
});

autoUpdater.on("download-progress", (progressObj) => {
  updaterState = { ...updaterState, status: "downloading", progress: progressObj, error: "" };
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("update:download-progress", progressObj);
  }
});

autoUpdater.on("update-downloaded", (info) => {
  updaterState = { status: "downloaded", info, progress: { percent: 100 }, error: "" };
  sendUpdaterMessage("update-downloaded", info);
});

registerSecureIpcHandler("app:get-version", () => {
  return app.getVersion();
});

registerSecureIpcHandler("update:get-state", () => updaterState);

registerSecureIpcHandler("update:check-for-updates", async () => {
  try {
    if (!app.isPackaged) {
      return { status: "development", message: "O atualizador não funciona em ambiente de desenvolvimento." };
    }
    const result = await autoUpdater.checkForUpdates();
    return result;
  } catch (error) {
    console.error("[auto-updater] Erro ao checar atualizações:", error);
    throw new Error(formatUpdaterError(error));
  }
});

registerSecureIpcHandler("update:download", async () => {
  if (!app.isPackaged) {
    return { status: "development", message: "O atualizador não funciona em ambiente de desenvolvimento." };
  }
  if (updaterState.status === "downloaded" || updaterState.status === "downloading") {
    return updaterState;
  }
  if (updaterState.status !== "available") {
    throw new Error("Nenhuma atualização está pronta para download.");
  }

  updaterState = {
    ...updaterState,
    status: "downloading",
    progress: { percent: 0 },
    error: "",
  };
  sendUpdaterMessage("download-started", updaterState.info);
  await autoUpdater.downloadUpdate();
  return updaterState;
});

registerSecureIpcHandler("update:quit-and-install", () => {
  isQuitting = true;
  autoUpdater.quitAndInstall();
});

app.commandLine.appendSwitch("autoplay-policy", "no-user-gesture-required");

app.whenReady().then(async () => {
  try {
    if (IS_SMOKE_TEST) {
      const requiredFiles = [
        path.join(app.getAppPath(), "dist", "index.html"),
        path.join(app.getAppPath(), "electron", "preload.cjs"),
        path.join(app.getAppPath(), "assets", "icon.png"),
      ];
      const missingFiles = requiredFiles.filter((filePath) => !fs.existsSync(filePath));
      if (missingFiles.length > 0) {
        throw new Error(`Smoke test falhou; arquivos ausentes: ${missingFiles.join(", ")}`);
      }
      console.log(`[smoke] Checkpoint Launcher ${app.getVersion()} validado.`);
      app.exit(0);
      return;
    }

    try {
      const saved = JSON.parse(fs.readFileSync(overlaySettingsFile(), "utf8"));
      const savedShortcut = normalizeCaptureShortcut(saved?.captureShortcut);
      if (savedShortcut) captureShortcut = savedShortcut;
      const savedAchievementVolume = Number(saved?.achievementVolume);
      if (Number.isFinite(savedAchievementVolume)) {
        achievementVolume = Math.min(100, Math.max(0, Math.round(savedAchievementVolume)));
      }
      if (["ps5", "ps4", "psp", "ps2", "gamecube", "xbox360", "cyberpunk"].includes(saved?.achievementSoundTheme)) {
        achievementSoundTheme = saved.achievementSoundTheme;
      }
      achievementNotificationsEnabled = saved?.achievementNotificationsEnabled !== false;
      customAchievementNotifications = saved?.customAchievementNotifications !== false;
      if (["top-left", "top-right", "bottom-left", "bottom-right"].includes(saved?.achievementNotificationPosition)) {
        achievementNotificationPosition = saved.achievementNotificationPosition;
      }
    } catch {
      // Primeira execucao ou configuracao ainda nao criada.
    }
    loadRecentCaptures();
    overlayPanelState = {
      ...overlayPanelState,
      captures: recentCaptures,
      settings: {
        captureShortcut,
        achievementVolume,
        achievementSoundTheme,
        achievementNotificationsEnabled,
        customAchievementNotifications,
        achievementNotificationPosition,
      },
    };

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

    globalShortcut.register("CommandOrControl+Shift+O", () => setOverlayPanelOpen(!overlayPanelOpen));
    if (!registerCaptureShortcut(captureShortcut)) {
      console.warn(`[overlay] O atalho de captura ${captureShortcut} ja esta em uso.`);
    }
    screen.on("display-metrics-changed", syncOverlayBounds);
    screen.on("display-added", syncOverlayBounds);
    screen.on("display-removed", syncOverlayBounds);
    await startAchievementBridge();
    await migrateKnownAchievementProgress();
    await createWindow();
    deliverAccountAuthCallback(findAccountAuthCallback(process.argv));
    void handleNexusDownloadUrl(findNxmUrl(process.argv));
  } catch (error) {
    showFatalStartupError(error);
    app.quit();
  }
});

app.on("second-instance", (_event, commandLine) => {
  deliverAccountAuthCallback(findAccountAuthCallback(commandLine));
  void handleNexusDownloadUrl(findNxmUrl(commandLine));
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }
  mainWindow.focus();
});

app.on("open-url", (event, url) => {
  event.preventDefault();
  if (/^nxm:\/\//i.test(String(url || ""))) {
    void handleNexusDownloadUrl(url);
  } else {
    deliverAccountAuthCallback(parseAccountAuthCallback(url));
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
  process.exit(0);
});

app.on("before-quit", () => {
  isQuitting = true;
  void shutdownModOperationWorker();
  if (localGameLibrary) {
    try {
      localGameLibrary.close();
    } catch (error) {
      appendStartupLog("Failed to close local game library.", error);
    }
    localGameLibrary = null;
  }
  for (const watcherKey of Array.from(activeGameMonitors.keys())) {
    stopGameProcessMonitor(watcherKey);
  }
  for (const watcherKey of Array.from(activeWatchers.keys())) {
    stopGameWatcher(watcherKey);
  }
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
