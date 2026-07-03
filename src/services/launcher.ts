import type { Game } from "../types/domain";

export const launchGame = async (game: Game): Promise<void> => {
  if (!game.executablePath && !game.epicCatalogId) {
    throw new Error("Jogo sem caminho de execução ou Epic Catalog ID configurado.");
  }

  // Steam
  if (game.launcherType === "steam" || /^\d+$/.test(game.executablePath || "") || game.steamAppId) {
    const steamId = game.steamAppId ?? game.executablePath;
    if (!steamId) throw new Error("Steam App ID não encontrado para esse jogo.");
    window.location.assign(`steam://run/${steamId}`);
    return;
  }

  // Epic Games
  if (game.launcherType === "epic" || game.epicCatalogId) {
    const epicId = game.executablePath ?? game.epicCatalogId;
    if (!epicId) throw new Error("Epic Catalog ID não encontrado para esse jogo.");
    window.location.assign(`com.epicgames.launcher://apps/${epicId}?action=launch&silent=true`);
    return;
  }

  // Local (desktop only)
  if ((window as Window & { electronAPI?: { launchExecutable?: (path: string) => Promise<void> } }).electronAPI?.launchExecutable && game.executablePath) {
    await (window as Window & { electronAPI?: { launchExecutable?: (path: string) => Promise<void> } }).electronAPI?.launchExecutable?.(
      game.executablePath,
    );
    return;
  }

  throw new Error(
    "Execução local requer runtime desktop. No modo web, Steam e Epic são suportados via URLs do launcher.",
  );
};
