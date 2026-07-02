import {
  serverTimestamp,
  writeBatch,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { auth, db } from "../../Firebase";
import { apiUrl } from "./api";
import type { Game, SteamOwnedGame } from "../types/domain";
import {
  profileDocRef,
  userGameDocRef,
  userGamesCollectionRef,
} from "./firestorePaths";

const clean = (obj: any) => {
  const newObj = { ...obj };
  Object.keys(newObj).forEach(
    (key) => newObj[key] === undefined && delete newObj[key],
  );
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

const getAuthHeaders = async () => {
  const token = await auth.currentUser?.getIdToken();
  if (!token) {
    throw new Error("SessÃ£o expirada. Entre novamente para sincronizar a Steam.");
  }
  return { Authorization: `Bearer ${token}` };
};

export const getSteamLinkUrl = async () => {
  const response = await fetch(apiUrl("/auth/steam/start"), {
    method: "POST",
    headers: await getAuthHeaders(),
  });
  if (!response.ok) {
    throw new Error("Nao foi possivel iniciar a conexao com a Steam.");
  }
  const payload = (await response.json()) as { url?: string };
  if (!payload.url) {
    throw new Error("Backend nao retornou a URL de autenticacao da Steam.");
  }
  return payload.url;
};

export const disconnectSteamAccount = async () => {
  const response = await fetch(apiUrl("/api/steam/disconnect"), {
    method: "POST",
    headers: await getAuthHeaders(),
  });
  if (!response.ok) {
    throw new Error("Falha ao desconectar Steam.");
  }
};

export const fetchSteamAppSizeGB = async (appId: string) => {
  if (!/^\d+$/.test(appId)) return undefined;
  const response = await fetch(
    apiUrl(`/api/steam/app-size?appId=${encodeURIComponent(appId)}`),
  );
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

export const fetchSteamAppDetailsResult = async (
  appId: string,
): Promise<SteamAppDetailsFetchResult> => {
  if (!/^\d+$/.test(appId)) {
    return { ok: false, message: "App ID deve conter sÃ³ dÃ­gitos." };
  }
  const url = apiUrl(
    `/api/steam/app-details?appId=${encodeURIComponent(appId)}`,
  );
  try {
    const response = await fetch(url);
    const body = (await response
      .json()
      .catch(() => ({}))) as SteamAppDetails & { error?: string };
    if (!response.ok) {
      const fromApi = typeof body.error === "string" ? body.error : null;
      const message =
        fromApi ||
        (response.status === 502
          ? "O backend nÃ£o conseguiu obter dados na Steam (502)."
          : `O backend respondeu com erro HTTP ${response.status}.`);
      return { ok: false, message };
    }
    return { ok: true, data: body as SteamAppDetails };
  } catch (e) {
    const msg = String(e instanceof Error ? e.message : e).toLowerCase();
    const looksLikeNetwork =
      e instanceof TypeError ||
      msg.includes("failed to fetch") ||
      msg.includes("network");
    return {
      ok: false,
      message: looksLikeNetwork
        ? "Backend inacessÃ­vel (porta 8787). Em outro terminal: npm run server. Ou: npm run dev:full. Teste no browser: http://localhost:8787/health"
        : e instanceof Error
          ? e.message
          : "Falha de rede ao buscar dados da loja Steam.",
    };
  }
};

export const fetchSteamAchievements = async (
  steamId: string,
  appId: string,
) => {
  const url = apiUrl(
    `/api/steam/achievements?steamId=${encodeURIComponent(steamId)}&appId=${encodeURIComponent(appId)}`,
  );
  try {
    const response = await fetch(url, { headers: await getAuthHeaders() });
    if (!response.ok) return { total: 0, unlocked: 0 };
    const data = await response.json();
    return {
      total: data.total || 0,
      unlocked: data.unlocked || 0,
    };
  } catch {
    return { total: 0, unlocked: 0 };
  }
};

export const fetchSteamAppDetails = async (
  appId: string,
): Promise<SteamAppDetails | null> => {
  const r = await fetchSteamAppDetailsResult(appId);
  return r.ok ? r.data : null;
};

export const fetchSteamLibrary = async (
  steamId: string,
): Promise<SteamLibraryResponse> => {
  const response = await fetch(
    apiUrl(`/api/steam/library?steamId=${encodeURIComponent(steamId)}`),
    { headers: await getAuthHeaders() },
  );
  if (!response.ok) {
    let message = "Falha ao buscar biblioteca da Steam.";
    try {
      const body = (await response.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {}
    throw new Error(message);
  }
  return (await response.json()) as SteamLibraryResponse;
};

export const syncSteamLibraryToFirestore = async (
  uid: string,
  steamId: string,
) => {
  const payload = await fetchSteamLibrary(steamId);
  const batch = writeBatch(db);

  const existingGamesSnap = await getDocs(
    query(userGamesCollectionRef(uid), where("steamAppId", "!=", "")),
  );

  const appIdToDocId = new Map<string, string>();
  existingGamesSnap.docs.forEach((doc) => {
    const data = doc.data() as Game;
    if (data.steamAppId) {
      appIdToDocId.set(String(data.steamAppId), doc.id);
    }
  });

  const detailsCache = new Map<string, SteamAppDetails | null>();
  const achievementsCache = new Map<
    string,
    { total: number; unlocked: number } | null
  >();

  const gamesToSync = payload.games.slice(0, 80);
  const CHUNK_SIZE = 10;

  for (let i = 0; i < gamesToSync.length; i += CHUNK_SIZE) {
    const chunk = gamesToSync.slice(i, i + CHUNK_SIZE);
    await Promise.all(
      chunk.map(async (owned) => {
        const appId = String(owned.appid);
        const [details, achievements] = await Promise.all([
          fetchSteamAppDetails(appId).catch(() => null),
          fetchSteamAchievements(steamId, appId).catch(() => null),
        ]);
        detailsCache.set(appId, details);
        achievementsCache.set(appId, achievements);
      }),
    );
  }

  payload.games.forEach((owned) => {
    const appIdStr = String(owned.appid);
    const existingDocId = appIdToDocId.get(appIdStr);
    const id = existingDocId || `${uid}_steam_${owned.appid}`;

    const assets = buildSteamAssets(owned.appid);
    const details = detailsCache.get(appIdStr);
    const achievements = achievementsCache.get(appIdStr);
    const normalizedHours = Math.round((owned.playtime_forever ?? 0) / 60);
    const steamLastPlayedAt =
      owned.rtime_last_played && owned.rtime_last_played > 0
        ? new Date(owned.rtime_last_played * 1000).toISOString()
        : "";
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
      steamLastPlayedAt,
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
