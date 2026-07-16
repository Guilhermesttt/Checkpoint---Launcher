const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  launchExecutable: (executablePath, launchProfile) =>
    ipcRenderer.invoke("launcher:open-executable", executablePath, launchProfile),
  getDisplays: () => ipcRenderer.invoke("launcher:get-displays"),
  isExecutableRunning: (executablePath) =>
    ipcRenderer.invoke("launcher:is-executable-running", executablePath),
  detectRunningGames: (executablePaths) =>
    ipcRenderer.invoke("launcher:detect-running-games", executablePaths),
  startGoogleBrowserAuth: () => ipcRenderer.invoke("auth:start-google-browser"),
  openExternalUrl: (url) => ipcRenderer.invoke("shell:open-external", url),
  scanLocalGames: () => ipcRenderer.invoke("game:scan-local"),
  testOverlayWelcome: () => ipcRenderer.invoke("overlay:test-welcome"),
  testOverlayAchievement: () => ipcRenderer.invoke("overlay:test-achievement"),
  toggleOverlayPanel: () => ipcRenderer.invoke("overlay:toggle-panel"),
  showGameStartOverlay: (payload) => ipcRenderer.invoke("overlay:show-game-start", payload),

  showFriendPlayingOverlay: (payload) => ipcRenderer.invoke("overlay:show-friend-playing", payload),
  showFriendRequestOverlay: (payload) => ipcRenderer.invoke("overlay:show-friend-request", payload),
  showFriendAcceptedOverlay: (payload) => ipcRenderer.invoke("overlay:show-friend-accepted", payload),
  getLocalAchievementDefinitions: (gameId) => ipcRenderer.invoke("achievement:get-definitions", gameId),
  getLocalAchievementProgress: (gameId) => ipcRenderer.invoke("achievement:get-progress", gameId),
  saveLocalAchievementDefinitions: (gameId, definitions, steamAppId) => ipcRenderer.invoke("achievement:save-definitions", gameId, definitions, steamAppId),
  getAchievementProgress: (gameId) => ipcRenderer.invoke("achievement:get-progress", gameId),
  getLocalAchievementState: (appId) => ipcRenderer.invoke("achievement:get-local-state", appId),
  getLocalAchievementLibrarySummary: () => ipcRenderer.invoke("achievement:get-library-summary"),
  getAchievementDiagnostics: () => ipcRenderer.invoke("achievement:get-diagnostics"),
  unlockAchievement: (gameId, achievementId) => ipcRenderer.invoke("achievement:unlock", gameId, achievementId),
  showFriendMessageOverlay: (payload) => ipcRenderer.invoke("overlay:show-friend-message", payload),
  updateOverlayPanel: (payload) => ipcRenderer.invoke("overlay:update-panel", payload),
  onOverlayPanelAction: (callback) => {
    const handler = (_event, payload) => callback(payload);
    ipcRenderer.on("overlay:panel-action", handler);
    return () => ipcRenderer.removeListener("overlay:panel-action", handler);
  },
  // ─ Auto-Updater APIs ────────────────────────────────────────────────────────
  getVersion: () => ipcRenderer.invoke("app:get-version"),
  checkForUpdates: () => ipcRenderer.invoke("update:check-for-updates"),
  startDownload: () => ipcRenderer.invoke("update:start-download"),
  quitAndInstallUpdate: () => ipcRenderer.invoke("update:quit-and-install"),
  onUpdateMessage: (callback) => {
    const handler = (_event, message, data) => callback(message, data);
    ipcRenderer.on("update:message", handler);
    return () => ipcRenderer.removeListener("update:message", handler);
  },
  onDownloadProgress: (callback) => {
    const handler = (_event, progressInfo) => callback(progressInfo);
    ipcRenderer.on("update:download-progress", handler);
    return () => ipcRenderer.removeListener("update:download-progress", handler);
  },
  // ─ Real-time achievement events (push from main → renderer) ─────────────────
  onRealtimeAchievementUnlock: (callback) => {
    const handler = (_event, payload) => callback(payload);
    ipcRenderer.on("achievement:realtime-unlock", handler);
    return handler; // retorna o handler para o renderer poder removê-lo depois
  },
  removeRealtimeAchievementUnlock: (handler) => {
    ipcRenderer.removeListener("achievement:realtime-unlock", handler);
  },
});
