#!/usr/bin/env node
/**
 * start-electron-dev.js
 * Inicia o Electron em modo dev garantindo:
 *   - ELECTRON_RUN_AS_NODE removido (evita que o electron rode como node puro)
 *   - ELECTRON_START_URL apontando para o Vite
 *   - Usa o binário do electron local (node_modules), não o instalado no sistema
 *   - Aguarda o Vite estar pronto antes de abrir (evita tela em branco no profile:2)
 */

const { spawn } = require("child_process");
const path = require("path");
const http = require("http");

const VITE_URL = "http://127.0.0.1:5173";
const WAIT_TIMEOUT_MS = 60_000;  // 60s máximo de espera
const POLL_INTERVAL_MS = 500;

// Resolve o binário do electron a partir do node_modules local
const electronPath = require("electron");

// Prepara o ambiente: copia process.env, remove ELECTRON_RUN_AS_NODE, seta ELECTRON_START_URL
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
env.ELECTRON_START_URL = VITE_URL;

const projectRoot = path.resolve(__dirname, "..");

console.log(`[start-electron-dev] Electron: ${electronPath}`);
console.log(`[start-electron-dev] CWD: ${projectRoot}`);
console.log(`[start-electron-dev] ELECTRON_START_URL: ${env.ELECTRON_START_URL}`);

const extraArgs = process.argv.slice(2);

/** Verifica se o Vite já está respondendo em VITE_URL */
function checkVite() {
  return new Promise((resolve) => {
    const req = http.get(VITE_URL, (res) => {
      resolve(res.statusCode < 500);
    });
    req.on("error", () => resolve(false));
    req.setTimeout(1000, () => { req.destroy(); resolve(false); });
  });
}

/** Aguarda o Vite ficar pronto, com timeout */
async function waitForVite() {
  const start = Date.now();
  while (Date.now() - start < WAIT_TIMEOUT_MS) {
    const ready = await checkVite();
    if (ready) return;
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
  throw new Error(`[start-electron-dev] Timeout: Vite nao iniciou em ${WAIT_TIMEOUT_MS / 1000}s. Certifique-se de que "npm run electron:dev" esta rodando primeiro.`);
}

async function main() {
  console.log("[start-electron-dev] Aguardando Vite em", VITE_URL, "...");
  await waitForVite();
  console.log("[start-electron-dev] Vite pronto! Iniciando Electron...");

  const child = spawn(electronPath, [".", ...extraArgs], {
    cwd: projectRoot,
    env,
    stdio: "inherit",
  });

  child.on("close", (code) => {
    console.log(`[start-electron-dev] Electron exited with code ${code}`);
    process.exit(code ?? 0);
  });

  child.on("error", (err) => {
    console.error("[start-electron-dev] Failed to start Electron:", err);
    process.exit(1);
  });
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
