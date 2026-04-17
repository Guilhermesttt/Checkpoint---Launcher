import { collection, doc, serverTimestamp, writeBatch } from "firebase/firestore";
import { db } from "../../Firebase";
import { apiUrl } from "./api";
import type { Game, SteamOwnedGame } from "../types/domain";

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
  const gamesCollection = collection(db, "games");
  const batch = writeBatch(db);

  payload.games.forEach((owned) => {
    const id = `${uid}_steam_${owned.appid}`;
    const assets = buildSteamAssets(owned.appid);
    const mapped: Omit<Game, "id"> = {
      ownerUid: uid,
      title: owned.name || `Steam App ${owned.appid}`,
      image: assets.image,
      cardImage: assets.cardImage,
      category: "STEAM",
      description: `Importado da Steam. Dados da conta conectada. AppID ${owned.appid}.`,
      executablePath: String(owned.appid),
      launcherType: "steam",
      steamAppId: String(owned.appid),
      steamPlaytimeMinutes: owned.playtime_forever,
      hoursPlayed: Number((owned.playtime_forever / 60).toFixed(1)),
      source: "steam",
      lastSyncedAt: new Date().toISOString(),
    };
    batch.set(doc(gamesCollection, id), mapped, { merge: true });
  });

  await batch.commit();

  // Atualização de perfil não pode bloquear sincronização dos jogos.
  try {
    await writeBatch(db)
      .set(
        doc(db, "profiles", uid),
        {
          steamId,
          lastSteamSyncAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      )
      .commit();
  } catch {
    // Sem permissão no profile, mantém sync dos jogos concluída.
  }

  return payload.games.length;
};
