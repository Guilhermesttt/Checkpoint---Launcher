const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  launchExecutable: (executablePath) =>
    ipcRenderer.invoke("launcher:open-executable", executablePath),
  isExecutableRunning: (executablePath) =>
    ipcRenderer.invoke("launcher:is-executable-running", executablePath),
  detectRunningGames: (executablePaths) =>
    ipcRenderer.invoke("launcher:detect-running-games", executablePaths),
  startGoogleBrowserAuth: () => ipcRenderer.invoke("auth:start-google-browser"),
  openExternalUrl: (url) => ipcRenderer.invoke("shell:open-external", url),
  scanLocalGames: () => ipcRenderer.invoke("game:scan-local"),
  testOverlayWelcome: () => ipcRenderer.invoke("overlay:test-welcome"),
  testOverlayAchievement: () => ipcRenderer.invoke("overlay:test-achievement"),
  showGameStartOverlay: (payload) => ipcRenderer.invoke("overlay:show-game-start", payload),
  showFriendPlayingOverlay: (payload) => ipcRenderer.invoke("overlay:show-friend-playing", payload),
  showFriendRequestOverlay: (payload) => ipcRenderer.invoke("overlay:show-friend-request", payload),
  showFriendAcceptedOverlay: (payload) => ipcRenderer.invoke("overlay:show-friend-accepted", payload),
  getLocalAchievementDefinitions: (gameId) => ipcRenderer.invoke("achievement:get-definitions", gameId),
  getLocalAchievementProgress: (gameId) => ipcRenderer.invoke("achievement:get-progress", gameId),
  saveLocalAchievementDefinitions: (gameId, definitions) => ipcRenderer.invoke("achievement:save-definitions", gameId, definitions),
  unlockLocalAchievement: (gameId, achievementId) => ipcRenderer.invoke("achievement:unlock", gameId, achievementId),
  showAchievementOverlay: (payload) => ipcRenderer.invoke("overlay:show-achievement", payload),
  showFriendMessageOverlay: (payload) => ipcRenderer.invoke("overlay:show-friend-message", payload),
});
