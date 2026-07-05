const { app, BrowserWindow, ipcMain, shell, Menu, dialog } = require("electron");
const { spawn } = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const PORT = process.env.PORT || "8787";
const APP_URL = `http://localhost:${PORT}`;
const STARTUP_LOG_FILE = "desktop-startup.log";

let mainWindow;
let serverStarted = false;
let serverProcess = null;
let startupErrorShown = false;

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
    return (
      (url.hostname === "localhost" || url.hostname === "127.0.0.1") &&
      url.port === PORT
    );
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

const startBundledServer = async () => {
  if (process.env.ELECTRON_START_URL || serverStarted || (await fetchHealth())) {
    serverStarted = true;
    return;
  }

  const serverEntry = path.join(app.getAppPath(), "server", "bootstrap.cjs");
  serverProcess = spawn(process.execPath, [serverEntry], {
    cwd: app.getAppPath(),
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: "1",
      PORT,
      FRONTEND_URL: APP_URL,
      BACKEND_PUBLIC_URL: APP_URL,
      DISCORD_REDIRECT_URI: `${APP_URL}/auth/discord/callback`,
      GOOGLE_REDIRECT_URI: `${APP_URL}/auth/google/callback`,
    },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });

  serverProcess.stdout?.on("data", (chunk) => {
    const text = String(chunk);
    appendStartupLog(`[desktop server][stdout] ${text.trimEnd()}`);
    process.stdout.write(`[desktop server] ${text}`);
  });
  serverProcess.stderr?.on("data", (chunk) => {
    const text = String(chunk);
    appendStartupLog(`[desktop server][stderr] ${text.trimEnd()}`);
    process.stderr.write(`[desktop server] ${text}`);
  });
  serverProcess.on("exit", (code, signal) => {
    serverStarted = false;
    serverProcess = null;
    appendStartupLog(`Desktop backend exited (code=${code}, signal=${signal ?? "none"}).`);
  });
  serverProcess.on("error", (error) => {
    appendStartupLog("Desktop backend failed to start.", error);
  });

  serverStarted = true;
};

const waitForServer = async () => {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (await fetchHealth()) return;
    if (serverProcess && serverProcess.exitCode !== null) {
      throw new Error(`Backend desktop encerrou antes do health check (exit ${serverProcess.exitCode}).`);
    }
    await sleep(250);
  }

  throw new Error(`Backend nao respondeu em ${APP_URL}/health.`);
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
  await startBundledServer();

  if (!process.env.ELECTRON_START_URL) {
    await waitForServer();
  }

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 640,
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

  mainWindow.webContents.session.setPermissionRequestHandler(
    (_webContents, _permission, callback) => callback(false),
  );

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

  await loadMainWindow();
};

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

  const error = await shell.openPath(normalizedTarget);
  if (error) {
    throw new Error(error);
  }
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

app.whenReady().then(async () => {
  try {
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
    createWindow();
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  if (serverProcess && !serverProcess.killed) {
    serverProcess.kill();
  }
});

process.on("unhandledRejection", (reason) => {
  appendStartupLog("Unhandled promise rejection in Electron main.", reason);
});

process.on("uncaughtException", (error) => {
  appendStartupLog("Uncaught exception in Electron main.", error);
});
