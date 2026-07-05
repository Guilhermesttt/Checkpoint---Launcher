#!/usr/bin/env node
/**
 * start-electron-dev.js
 * Inicia o Electron em modo dev garantindo:
 *   - ELECTRON_RUN_AS_NODE removido (evita que o electron rode como node puro)
 *   - ELECTRON_START_URL apontando para o Vite
 *   - Usa o binário do electron local (node_modules), não o instalado no sistema
 */

const { spawn } = require("child_process");
const path = require("path");

// Resolve o binário do electron a partir do node_modules local
const electronPath = require("electron");

// Prepara o ambiente: copia process.env, remove ELECTRON_RUN_AS_NODE, seta ELECTRON_START_URL
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
env.ELECTRON_START_URL = "http://127.0.0.1:5173";

const projectRoot = path.resolve(__dirname, "..");

console.log(`[start-electron-dev] Electron: ${electronPath}`);
console.log(`[start-electron-dev] CWD: ${projectRoot}`);
console.log(`[start-electron-dev] ELECTRON_START_URL: ${env.ELECTRON_START_URL}`);

const child = spawn(electronPath, ["."], {
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
