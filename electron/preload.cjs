const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  launchExecutable: (executablePath) =>
    ipcRenderer.invoke("launcher:open-executable", executablePath),
  startGoogleBrowserAuth: () => ipcRenderer.invoke("auth:start-google-browser"),
  openExternalUrl: (url) => ipcRenderer.invoke("shell:open-external", url),
  scanLocalGames: () => ipcRenderer.invoke("game:scan-local"),
});
