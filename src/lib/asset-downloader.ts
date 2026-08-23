// Minimal asset downloader stub used by the runtime to ensure large assets are available.
// Real download and extraction should be implemented in the Electron main process and
// exposed via the electronAPI bridge (window.electronAPI.downloadAssets).

export async function ensureAssetsAvailable(manifestPath = "/assets/manifest.json") {
  if (typeof window !== "undefined" && window?.electronAPI?.downloadAssets) {
    try {
      return await window.electronAPI.downloadAssets(manifestPath);
    } catch (e) {
      console.warn("[assets] Falha ao baixar assets via electronAPI:", e);
      throw e;
    }
  }

  if (typeof process !== "undefined" && process?.versions?.node) {
    console.warn(
      "[assets] Em ambiente Node sem electron bridge: implemente um instalador de assets ou instale manualmente."
    );
    return false;
  }

  // Browser fallback: nada a fazer
  return false;
}
