import type { Game } from "../types/domain";

export const launchGame = async (game: Game): Promise<void> => {
  if (!game.executablePath) {
    throw new Error("Jogo sem caminho de execução configurado.");
  }

  if (game.launcherType === "steam" || /^\d+$/.test(game.executablePath)) {
    const steamId = game.steamAppId ?? game.executablePath;
    window.location.assign(`steam://run/${steamId}`);
    return;
  }

  if ((window as Window & { electronAPI?: { launchExecutable?: (path: string) => Promise<void> } }).electronAPI?.launchExecutable) {
    await (window as Window & { electronAPI?: { launchExecutable?: (path: string) => Promise<void> } }).electronAPI?.launchExecutable?.(
      game.executablePath,
    );
    return;
  }

  throw new Error(
    "Execução local requer runtime desktop. No modo web, apenas steam://run é suportado.",
  );
};
