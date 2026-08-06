// ─── Configuração de Download Direto e Servidor de Atualizações ────────────────

export const CURRENT_LAUNCHER_VERSION = "3.0.6";

// URL base do servidor ou bucket de hospedagem do executável e latest.yml
export const UPDATE_SERVER_URL =
  import.meta.env.VITE_UPDATE_SERVER_URL ||
  "https://checkpointlauncher.com/downloads";

// Nome do instalador .exe gerado pelo electron-builder (ex: Checkpoint-Launcher-Setup-3.0.6.exe)
export const LAUNCHER_EXE_FILENAME = `Checkpoint-Launcher-Setup-${CURRENT_LAUNCHER_VERSION}.exe`;

// URL direta do instalador .exe para o botão de download no site
export const DIRECT_LAUNCHER_DOWNLOAD_URL =
  import.meta.env.VITE_DIRECT_DOWNLOAD_URL ||
  `${UPDATE_SERVER_URL}/${LAUNCHER_EXE_FILENAME}`;
