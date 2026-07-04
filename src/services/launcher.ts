import type { Game } from "../types/domain";

const EPIC_LAUNCH_URI_PREFIX = "com.epicgames.launcher://apps/";

const safeDecodeURIComponent = (value: string) => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

const hasCompleteEpicLaunchId = (value: string) =>
  safeDecodeURIComponent(value)
    .split(":")
    .filter(Boolean).length >= 3;

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

  if (!hasCompleteEpicLaunchId(launchId)) {
    return null;
  }

  const decodedLaunchId = safeDecodeURIComponent(launchId);
  const decodedCatalogId = catalogId ? safeDecodeURIComponent(catalogId) : "";

  // Epic's launch URI needs SandboxID:CatalogID:ArtifactID.
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

    if (game.epicStoreUrl) {
      window.open(game.epicStoreUrl, "_blank", "noopener,noreferrer");
      return;
    }

    throw new Error(
      "ID da Epic Games nao encontrado. Adicione o jogo pela busca da Epic para criar um atalho de launcher.",
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
