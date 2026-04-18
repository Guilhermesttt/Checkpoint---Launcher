import { serverTimestamp, writeBatch, getDocs, query, where } from "firebase/firestore";
import { db } from "../../Firebase";
import { apiUrl } from "./api";
import type { Game, SteamOwnedGame } from "../types/domain";
import { profileDocRef, userGameDocRef, userGamesCollectionRef } from "./firestorePaths";

// --- FUNÇÃO AUXILIAR PARA CORRIGIR O ERRO ---
// Remove chaves com valor 'undefined' para não quebrar o Firestore
const clean = (obj: any) => {
  const newObj = { ...obj };
  Object.keys(newObj).forEach(key => newObj[key] === undefined && delete newObj[key]);
  return newObj;
};

interface SteamLibraryResponse {
  steamId: string;
  gameCount?: number;
  games: SteamOwnedGame[];
}

const buildSteamAssets = (appid: number) => ({
  image: `https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/${appid}/library_hero.jpg`,
  cardImage: `https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/${appid}/library_600x900_2x.jpg`,
});

export const getSteamLinkUrl = (firebaseUid: string) =>
  apiUrl(`/auth/steam/start?state=${encodeURIComponent(firebaseUid)}`);

export const getSteamApiKeyPageUrl = () => "https://steamcommunity.com/dev/apikey";

export const isSteamApiKeyConfigured = async () => {
  const response = await fetch(apiUrl("/api/steam/key/status"));
  if (!response.ok) return false;
  const payload = (await response.json()) as { configured?: boolean };
  return Boolean(payload.configured);
};

export const saveSteamApiKey = async (apiKey: string) => {
  const response = await fetch(apiUrl("/api/steam/key"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ apiKey }),
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error || "Não foi possível salvar a API key da Steam.");
  }
};

export const fetchSteamAppSizeGB = async (appId: string) => {
  if (!/^\d+$/.test(appId)) return undefined;
  const response = await fetch(apiUrl(`/api/steam/app-size?appId=${encodeURIComponent(appId)}`));
  if (!response.ok) return undefined;
  const payload = (await response.json()) as { sizeGB?: number | null };
  return typeof payload.sizeGB === "number" ? payload.sizeGB : undefined;
};

export interface SteamAppDetails {
  appId: string;
  title?: string;
  cardImage?: string;
  backgroundImage?: string;
  logoImage?: string;
  description?: string;
  aboutTheGame?: string;
  screenshots?: string[];
  releaseDate?: string;
  developer?: string;
  publisher?: string;
  tags?: string[];
  trailerUrl?: string;
  sizeGB?: number | null;
}

export type SteamAppDetailsFetchResult =
  | { ok: true; data: SteamAppDetails }
  | { ok: false; message: string };

/** Devolve motivo concreto (rede vs HTTP vs corpo) para mostrar no UI. */
export const fetchSteamAppDetailsResult = async (
  appId: string,
): Promise<SteamAppDetailsFetchResult> => {
  if (!/^\d+$/.test(appId)) {
    return { ok: false, message: "App ID deve conter só dígitos." };
  }
  const url = apiUrl(`/api/steam/app-details?appId=${encodeURIComponent(appId)}`);
  try {
    const response = await fetch(url);
    const body = (await response.json().catch(() => ({}))) as SteamAppDetails & { error?: string };
    if (!response.ok) {
      const fromApi = typeof body.error === "string" ? body.error : null;
      const message =
        fromApi ||
        (response.status === 502
          ? "O backend não conseguiu obter dados na Steam (502)."
          : `O backend respondeu com erro HTTP ${response.status}.`);
      return { ok: false, message };
    }
    return { ok: true, data: body as SteamAppDetails };
  } catch (e) {
    const msg = String(e instanceof Error ? e.message : e).toLowerCase();
    const looksLikeNetwork =
      e instanceof TypeError || msg.includes("failed to fetch") || msg.includes("network");
    return {
      ok: false,
      message: looksLikeNetwork
        ? "Backend inacessível (porta 8787). Em outro terminal: npm run server. Ou: npm run dev:full. Teste no browser: http://localhost:8787/health"
        : e instanceof Error
          ? e.message
          : "Falha de rede ao buscar dados da loja Steam.",
    };
  }
};

export const fetchSteamAchievements = async (steamId: string, appId: string) => {
  const url = apiUrl(`/api/steam/achievements?steamId=${encodeURIComponent(steamId)}&appId=${encodeURIComponent(appId)}`);
  try {
    const response = await fetch(url);
    if (!response.ok) return { total: 0, unlocked: 0 };
    const data = await response.json();
    return {
      total: data.total || 0,
      unlocked: data.unlocked || 0
    };
  } catch {
    return { total: 0, unlocked: 0 };
  }
};

export const fetchSteamAppDetails = async (appId: string): Promise<SteamAppDetails | null> => {
  const r = await fetchSteamAppDetailsResult(appId);
  return r.ok ? r.data : null;
};

export const fetchSteamLibrary = async (steamId: string): Promise<SteamLibraryResponse> => {
  const response = await fetch(apiUrl(`/api/steam/library?steamId=${steamId}`));
  if (!response.ok) {
    let message = "Falha ao buscar biblioteca da Steam.";
    try {
      const body = (await response.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      // keep fallback message
    }
    throw new Error(message);
  }
  return (await response.json()) as SteamLibraryResponse;
};

export const syncSteamLibraryToFirestore = async (uid: string, steamId: string) => {
  const payload = await fetchSteamLibrary(steamId);
  const batch = writeBatch(db);

  // 1. Mapear jogos existentes para evitar duplicatas e atualizar os manuais
  const existingGamesSnap = await getDocs(
    query(userGamesCollectionRef(uid), where("steamAppId", "!=", ""))
  );
  
  const appIdToDocId = new Map<string, string>();
  existingGamesSnap.docs.forEach(doc => {
    const data = doc.data() as Game;
    if (data.steamAppId) {
      appIdToDocId.set(String(data.steamAppId), doc.id);
    }
  });

  const detailsCache = new Map<string, SteamAppDetails | null>();
  const achievementsCache = new Map<string, { total: number; unlocked: number } | null>();

  // Limita a busca de detalhes para os primeiros 80 jogos para evitar timeout/rate limit
  await Promise.all(
    payload.games.slice(0, 80).map(async (owned) => {
      const appId = String(owned.appid);
      const [details, achievements] = await Promise.all([
        fetchSteamAppDetails(appId).catch(() => null),
        fetchSteamAchievements(steamId, appId).catch(() => null)
      ]);
      detailsCache.set(appId, details);
      achievementsCache.set(appId, achievements);
    }),
  );

  payload.games.forEach((owned) => {
    const appIdStr = String(owned.appid);
    // Se já existir um documento com esse AppID (mesmo que com ID aleatório), usamos ele.
    const existingDocId = appIdToDocId.get(appIdStr);
    const id = existingDocId || `${uid}_steam_${owned.appid}`;
    
    const assets = buildSteamAssets(owned.appid);
    const details = detailsCache.get(appIdStr);
    const achievements = achievementsCache.get(appIdStr);
    const normalizedHours = Math.round((owned.playtime_forever ?? 0) / 60);
    const resolvedDescription =
      details?.description ??
      `Importado da Steam. Dados da conta conectada. AppID ${owned.appid}.`;

    const mapped: Omit<Game, "id"> = {
      title: details?.title || owned.name || `Steam App ${owned.appid}`,
      image: details?.backgroundImage || assets.image,
      backgroundImage: details?.backgroundImage || assets.image,
      cardImage: details?.cardImage || assets.cardImage,
      logoImage: details?.logoImage || "", 
      category: "STEAM",
      description: resolvedDescription,
      aboutTheGame: details?.aboutTheGame || details?.description || "",
      executablePath: appIdStr,
      launcherType: "steam",
      steamAppId: appIdStr,
      steamPlaytimeMinutes: owned.playtime_forever ?? 0,
      hoursPlayed: normalizedHours,
      sizeGB: Math.max(0, Math.round(details?.sizeGB ?? 0)),
      totalAchievements: achievements?.total || 0,
      completedAchievements: achievements?.unlocked || 0,
      trailerUrl: details?.trailerUrl || "", 
      screenshots: details?.screenshots || [],
      releaseDate: details?.releaseDate || "",
      developer: details?.developer || "",
      publisher: details?.publisher || "",
      tags: details?.tags || [],
      source: "steam",
      lastSyncedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    batch.set(userGameDocRef(uid, id), clean(mapped), { merge: true });
  });

  await batch.commit();

  try {
    const profileBatch = writeBatch(db);
    profileBatch.set(
      profileDocRef(uid),
      {
        steamId,
        lastSteamSyncAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
    await profileBatch.commit();
  } catch (err) {
    console.error("Erro ao atualizar perfil:", err);
  }

  return payload.games.length;
};