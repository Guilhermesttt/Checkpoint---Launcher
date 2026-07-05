const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  launchExecutable: (executablePath) =>
    ipcRenderer.invoke("launcher:open-executable", executablePath),
  startGoogleBrowserAuth: () => ipcRenderer.invoke("auth:start-google-browser"),
  openExternalUrl: (url) => ipcRenderer.invoke("shell:open-external", url),
  scanLocalGames: () => ipcRenderer.invoke("game:scan-local"),
  testOverlayWelcome: () => ipcRenderer.invoke("overlay:test-welcome"),
  testOverlayAchievement: () => ipcRenderer.invoke("overlay:test-achievement"),
  showGameStartOverlay: (payload) => ipcRenderer.invoke("overlay:show-game-start", payload),
  showFriendPlayingOverlay: (payload) => ipcRenderer.invoke("overlay:show-friend-playing", payload),
  showFriendRequestOverlay: (payload) => ipcRenderer.invoke("overlay:show-friend-request", payload),
});
