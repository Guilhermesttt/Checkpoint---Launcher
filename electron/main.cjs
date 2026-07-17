const { app, BrowserWindow, ipcMain, shell, Menu, dialog, screen, Tray, globalShortcut, desktopCapturer } = require("electron");
const crypto = require("node:crypto");
const { execFile, spawn } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL, fileURLToPath } = require("node:url");
const { createAchievementBridge } = require("./achievement-bridge.cjs");
const { readAchievementLibrarySummary } = require("./achievement-summary.cjs");
const { normalizeLaunchProfile } = require("./launch-profile.cjs");
const {
  createGameProcessTracker,
  normalizeWindowsPath,
  parseProcessSnapshot,
} = require("./game-process-monitor.cjs");
const { createSecureIpcRegistrar } = require("./ipc-security.cjs");
const { createLocalGameLibrary } = require("./local-game-library.cjs");
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
let overlayPanelState = {
  friends: [],
  achievements: { unlocked: 0, available: 0, items: [], loading: false },
  currentGame: null,
  captures: [],
  settings: { captureShortcut: "F8" },
  chat: null,
  profile: { name: "Jogador", avatar: "", discordConnected: false, discordUsername: "", achievements: 0 },
};
let captureShortcut = "F8";
let recentCaptures = [];
let captureInProgress = false;
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

const overlayIconUrl = () =>
  `file:///${path.join(app.getAppPath(), "assets", "icon.png").replace(/\\/g, "/")}`;

const hasSingleInstanceLock = IS_SMOKE_TEST || app.requestSingleInstanceLock();
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

const registerSecureIpcHandler = createSecureIpcRegistrar({
  ipcMain,
  isAllowedUrl: isLocalAppUrl,
  getExpectedWebContents: () => mainWindow?.webContents ?? null,
});

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
      backgroundThrottling: false,
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

const sendOverlayEvent = (channel, payload) => {
  createOverlayWindow();
  if (!overlayWindow || overlayWindow.isDestroyed()) {
    throw new Error("Overlay indisponivel.");
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
  overlayWindow.setIgnoreMouseEvents(!overlayPanelOpen, { forward: !overlayPanelOpen });
  sendOverlayEvent("overlay:panel-visibility", {
    open: overlayPanelOpen,
    state: overlayPanelState,
  });
  if (overlayPanelOpen) {
    overlayWindow.show();
    overlayWindow.focus();
  }
};

const overlaySettingsFile = () => path.join(app.getPath("userData"), "overlay-settings.json");
const captureDirectory = () => path.join(app.getPath("pictures"), "Checkpoint Captures");

const saveOverlaySettings = () => {
  try {
    fs.mkdirSync(path.dirname(overlaySettingsFile()), { recursive: true });
    fs.writeFileSync(overlaySettingsFile(), JSON.stringify({ captureShortcut }, null, 2), "utf8");
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
    const capture = await captureCurrentDisplay();
    if (overlayPanelOpen) sendOverlayEvent("overlay:panel-state", overlayPanelState);
    sendOverlayEvent("overlay:social", {
      kind: "capture-saved",
      title: "Captura salva",
      description: capture.name,
    });
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

registerSecureIpcHandler("overlay:update-panel", async (_event, payload) => {
  const friends = Array.isArray(payload?.friends) ? payload.friends.slice(0, 30).map((friend) => ({
    id: String(friend?.id || "").slice(0, 128),
    name: String(friend?.name || "Jogador").slice(0, 80),
    status: ["online", "playing", "offline"].includes(friend?.status) ? friend.status : "offline",
    playing: String(friend?.playing || "").slice(0, 120),
    avatar: String(friend?.avatar || "").slice(0, 2048),
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
      createdAt: String(message?.createdAt || "").slice(0, 64),
      mine: Boolean(message?.mine),
      pending: Boolean(message?.pending),
    })).filter((message) => message.id && message.text)
    : [];
  overlayPanelState = {
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
      image: String(payload.currentGame.image || "").slice(0, 2048),
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
    settings: { captureShortcut },
    chat: payload?.chat ? {
      friendId: String(payload.chat.friendId || "").slice(0, 128),
      friendName: String(payload.chat.friendName || "Amigo").slice(0, 80),
      friendAvatar: String(payload.chat.friendAvatar || "").slice(0, 2048),
      typing: Boolean(payload.chat.typing),
      sending: Boolean(payload.chat.sending),
      error: String(payload.chat.error || "").slice(0, 300),
      messages,
    } : null,
    profile: {
      name: String(payload?.profile?.name || "Jogador").slice(0, 80),
      avatar: String(payload?.profile?.avatar || "").slice(0, 2048),
      discordConnected: Boolean(payload?.profile?.discordConnected),
      discordUsername: String(payload?.profile?.discordUsername || "").slice(0, 80),
      achievements: Math.max(0, Number(payload?.profile?.achievements) || 0),
    },
  };
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
  if (["media-play-pause", "media-next", "media-previous"].includes(kind)) {
    const keyCode = kind === "media-play-pause" ? 179 : kind === "media-next" ? 176 : 177;
    execFile("powershell.exe", [
      "-NoProfile", "-NonInteractive", "-Command",
      `$shell = New-Object -ComObject WScript.Shell; $shell.SendKeys([char]${keyCode})`,
    ], { windowsHide: true }, () => undefined);
    return;
  }
  if (["select-chat", "close-chat", "send-message"].includes(kind)) {
    const payload = { kind };
    if (kind === "select-chat") payload.friendId = String(action?.friendId || "").slice(0, 128);
    if (kind === "send-message") payload.text = String(action?.text || "").trim().slice(0, 2000);
    mainWindow?.webContents.send("overlay:panel-action", payload);
  }
});

const playOverlaySound = (sound) => {
  createOverlayWindow();
  if (!overlayWindow || overlayWindow.isDestroyed()) {
    throw new Error("Overlay indisponivel.");
  }

  sendOverlayEvent("overlay:play-sound", { sound });
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

      sendOverlayEvent("achievement:unlock", payload);
      playOverlaySound("achievement-unlock");
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

registerSecureIpcHandler("launcher:open-executable", async (_event, executablePath, rawLaunchProfile) => {
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

  const launchProfile = normalizeLaunchProfile(rawLaunchProfile, path.dirname(normalizedTarget));
  if (!fs.existsSync(launchProfile.workingDirectory) || !fs.statSync(launchProfile.workingDirectory).isDirectory()) {
    throw new Error("Diretorio de trabalho nao encontrado.");
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
      });
      if (mainWindow) {
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
        });
        if (mainWindow) mainWindow.hide();
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
      });
      if (mainWindow) mainWindow.hide();
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

const PROCESS_SNAPSHOT_COMMAND = [
  "$ErrorActionPreference = 'Stop'",
  "$items = Get-CimInstance Win32_Process | ForEach-Object { [PSCustomObject]@{ pid = [int]$_.ProcessId; parentPid = [int]$_.ParentProcessId; name = [string]$_.Name; executablePath = [string]$_.ExecutablePath } }",
  "$items | ConvertTo-Json -Compress",
].join("; ");

let _processSnapshotCache = { processes: [], expiresAt: 0, pending: null };

const getRunningProcesses = async ({ forceRefresh = false } = {}) => {
  if (!forceRefresh && Date.now() < _processSnapshotCache.expiresAt) {
    return _processSnapshotCache.processes;
  }
  if (_processSnapshotCache.pending) return _processSnapshotCache.pending;

  const pending = new Promise((resolve, reject) => {
    execFile("powershell.exe", [
      "-NoProfile",
      "-NonInteractive",
      "-Command",
      PROCESS_SNAPSHOT_COMMAND,
    ], { windowsHide: true, maxBuffer: 4 * 1024 * 1024 }, (error, stdout = "") => {
      if (error) {
        reject(error);
        return;
      }
      try {
        resolve(parseProcessSnapshot(stdout));
      } catch (parseError) {
        reject(parseError);
      }
    });
  });

  _processSnapshotCache.pending = pending;
  try {
    const processes = await pending;
    _processSnapshotCache = {
      processes,
      expiresAt: Date.now() + 1500,
      pending: null,
    };
    return processes;
  } catch (error) {
    _processSnapshotCache.pending = null;
    throw error;
  }
};

const getProcessSnapshotWithFallback = async ({ forceRefresh = false } = {}) => {
  try {
    return await getRunningProcesses({ forceRefresh });
  } catch (error) {
    console.warn(
      "[launcher] Snapshot detalhado de processos indisponivel; usando tasklist:",
      error instanceof Error ? error.message : error,
    );
    const runningNames = await getRunningProcessNames().catch(() => new Set());
    return Array.from(runningNames, (name) => ({
      pid: 0,
      parentPid: 0,
      name,
      executablePath: "",
    }));
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
  stopGameProcessMonitor(watcherKey);
  stopGameWatcher(watcherKey);
  if (mainWindow && !mainWindow.isDestroyed()) {
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

registerSecureIpcHandler("overlay:test-welcome", async () => {
  selectOverlayDisplayFromLauncher();
  sendOverlayEvent("overlay:social", {
    kind: "game-start",
    title: "Divirta-se",
    description: "O overlay esta ativo enquanto voce joga.",
  });
});

registerSecureIpcHandler("overlay:test-achievement", async () => {
  selectOverlayDisplayFromLauncher();
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

registerSecureIpcHandler("overlay:toggle-panel", async () => {
  setOverlayPanelOpen(!overlayPanelOpen);
  return { open: overlayPanelOpen };
});

registerSecureIpcHandler("overlay:show-game-start", async (_event, payload) => {
  selectOverlayDisplayFromLauncher();
  const gameTitle = String(payload?.gameTitle || "").trim();
  sendOverlayEvent("overlay:social", {
    kind: "game-start",
    title: "Divirta-se",
    description: gameTitle
      ? `Você está jogando agora ${gameTitle}`
      : "O overlay está ativo enquanto você joga.",
  });
  setTimeout(() => {
    sendOverlayEvent("overlay:social", {
      kind: "overlay-hint",
      title: "Abra sem sair do jogo",
      description: "Use o botão central do controle ou Ctrl + Shift + O.",
    });
  }, 1400);
});

registerSecureIpcHandler("overlay:show-friend-playing", async (_event, payload) => {
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

registerSecureIpcHandler("overlay:show-friend-request", async (_event, payload) => {
  const playerName = String(payload?.playerName || "").trim() || "Jogador";
  const avatarUrl = String(payload?.avatarUrl || "").trim();

  sendOverlayEvent("overlay:social", {
    kind: "friend-request",
    title: playerName,
    description: "Enviou um pedido de amizade",
    avatarUrl: avatarUrl || overlayIconUrl(),
  });
});

registerSecureIpcHandler("overlay:show-friend-accepted", async (_event, payload) => {
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

registerSecureIpcHandler("app:get-version", () => {
  return app.getVersion();
});

registerSecureIpcHandler("update:check-for-updates", async () => {
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

registerSecureIpcHandler("update:start-download", async () => {
  try {
    return await autoUpdater.downloadUpdate();
  } catch (error) {
    console.error("[auto-updater] Erro ao iniciar download:", error);
    throw error;
  }
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
    } catch {
      // Primeira execucao ou configuracao ainda nao criada.
    }
    loadRecentCaptures();
    overlayPanelState = {
      ...overlayPanelState,
      captures: recentCaptures,
      settings: { captureShortcut },
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

    createOverlayWindow();
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
  globalShortcut.unregisterAll();
  process.exit(0);
});

app.on("before-quit", () => {
  isQuitting = true;
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
