const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("achievementOverlay", {
  onUnlock: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on("achievement:unlock", listener);
    return () => {
      ipcRenderer.removeListener("achievement:unlock", listener);
    };
  },
  onWelcome: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on("achievement:welcome", listener);
    return () => {
      ipcRenderer.removeListener("achievement:welcome", listener);
    };
  },
  onSocial: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on("overlay:social", listener);
    return () => {
      ipcRenderer.removeListener("overlay:social", listener);
    };
  },
  onPlaySound: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on("overlay:play-sound", listener);
    return () => {
      ipcRenderer.removeListener("overlay:play-sound", listener);
    };
  },
});
