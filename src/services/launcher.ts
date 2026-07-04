import type { Game } from "../types/domain";

const EPIC_LAUNCH_URI_PREFIX = "com.epicgames.launcher://apps/";

const safeDecodeURIComponent = (value: string) => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

const buildEpicLaunchUri = (game: Game): string | null => {
  const rawLaunchId = String(game.executablePath || "").trim();
  const catalogId = String(game.epicCatalogId || "").trim();
  const launchId = rawLaunchId || catalogId;

  if (!launchId) {
    return null;
  }

  if (launchId.startsWith(EPIC_LAUNCH_URI_PREFIX)) {
    return launchId;
  }

  const decodedLaunchId = safeDecodeURIComponent(launchId);
  const decodedCatalogId = catalogId ? safeDecodeURIComponent(catalogId) : "";

  // Epic's launch URI needs SandboxID:CatalogID:ArtifactID. A plain catalogId
  // is still sent through the desktop launcher instead of opening the web store.
  const epicAppId =
    decodedLaunchId.includes(":") || decodedLaunchId === decodedCatalogId
      ? encodeURIComponent(decodedLaunchId)
      : launchId;

  return `${EPIC_LAUNCH_URI_PREFIX}${epicAppId}?action=launch&silent=true`;
};

export const launchGame = async (game: Game): Promise<void> => {
  if (!game.executablePath && !game.epicCatalogId && !game.epicStoreUrl) {
    throw new Error("Jogo sem caminho de execucao ou link da loja configurado.");
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
    const epicLaunchUri = buildEpicLaunchUri(game);
    if (epicLaunchUri) {
      window.location.assign(epicLaunchUri);
      return;
    }

    throw new Error(
      "ID da Epic Games nao encontrado. Sincronize a biblioteca da Epic para importar o identificador de launcher.",
    );
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
