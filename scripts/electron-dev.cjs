#!/usr/bin/env node

const { spawn } = require("node:child_process");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const projectRoot = path.resolve(__dirname, "..");
const isWindows = process.platform === "win32";
const nodeCmd = process.execPath;
const viteEntry = path.join(projectRoot, "node_modules", "vite", "bin", "vite.js");

const children = new Set();
let shuttingDown = false;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const spawnManaged = (command, args, options = {}) => {
  const child = spawn(command, args, {
    cwd: projectRoot,
    env: { ...process.env, ...options.env },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });

  children.add(child);

  const prefix = options.prefix || command;
  child.stdout?.on("data", (chunk) => {
    process.stdout.write(`[${prefix}] ${chunk}`);
  });
  child.stderr?.on("data", (chunk) => {
    process.stderr.write(`[${prefix}] ${chunk}`);
  });
  child.on("exit", () => {
    children.delete(child);
  });

  return child;
};

const killChild = (child) =>
  new Promise((resolve) => {
    if (!child || child.exitCode !== null || child.killed) {
      resolve();
      return;
    }

    child.once("exit", () => resolve());
    child.kill();

    setTimeout(() => {
      if (child.exitCode === null && !child.killed) {
        child.kill("SIGKILL");
      }
    }, 3000).unref();
  });

const shutdown = async (code = 0) => {
  if (shuttingDown) return;
  shuttingDown = true;

  await Promise.all(Array.from(children).map((child) => killChild(child)));
  process.exit(code);
};

const waitForUrl = async (url, attempts = 120, intervalMs = 500) => {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
    } catch {
      // keep polling
    }

    await sleep(intervalMs);
  }

  throw new Error(`Timeout aguardando ${url}`);
};

const attachFailureGuard = (child, name) => {
  child.on("exit", (code, signal) => {
    if (shuttingDown) return;
    const exitCode = code ?? 1;
    console.error(`[${name}] exited early (code=${exitCode}, signal=${signal ?? "none"})`);
    void shutdown(exitCode === 0 ? 1 : exitCode);
  });
};

const main = async () => {
  process.on("SIGINT", () => {
    void shutdown(130);
  });
  process.on("SIGTERM", () => {
    void shutdown(143);
  });

  const vite = spawnManaged(nodeCmd, [viteEntry], {
    prefix: "vite",
  });

  attachFailureGuard(vite, "vite");

  process.env.FRONTEND_URL = "http://127.0.0.1:5173";
  process.env.BACKEND_PUBLIC_URL = "http://localhost:8787";
  process.env.DISCORD_REDIRECT_URI = "http://localhost:8787/auth/discord/callback";
  process.env.GOOGLE_REDIRECT_URI = "http://localhost:8787/auth/google/callback";

  await import(pathToFileURL(path.join(projectRoot, "server", "index.mjs")).href);

  await Promise.all([
    waitForUrl("http://127.0.0.1:5173"),
    waitForUrl("http://localhost:8787/health"),
  ]);

  const electron = spawnManaged(nodeCmd, ["scripts/start-electron-dev.cjs"], {
    prefix: "electron",
    env: {
      ELECTRON_START_URL: "http://127.0.0.1:5173",
    },
  });

  electron.on("exit", (code) => {
    void shutdown(code ?? 0);
  });
};

main().catch((error) => {
  console.error("[electron-dev] failed", error);
  void shutdown(1);
});
