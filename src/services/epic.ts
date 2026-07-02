import {
  serverTimestamp,
  writeBatch,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { auth, db } from "../../Firebase";
import { apiUrl } from "./api";
import type { Game } from "../types/domain";
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

export interface EpicAppDetails {
  catalogId: string;
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

export type EpicAppDetailsFetchResult =
  | { ok: true; data: EpicAppDetails }
  | { ok: false; message: string };

interface EpicOwnedGame {
  namespace: string;
  catalogId: string;
  title?: string;
  image?: string;
  backgroundImage?: string;
  cardImage?: string;
  logoImage?: string;
  description?: string;
  aboutTheGame?: string;
  releaseDate?: string;
  developer?: string;
  publisher?: string;
  tags?: string[];
  screenshots?: string[];
  executablePath?: string;
}

interface EpicLibraryResponse {
  epicAccountId: string;
  gameCount?: number;
  games: EpicOwnedGame[];
}

const getAuthHeaders = async () => {
  const token = await auth.currentUser?.getIdToken();
  if (!token) {
    throw new Error("Sessão expirada. Entre novamente para conectar a Epic Games.");
  }
  return { Authorization: `Bearer ${token}` };
};

export const getEpicLinkUrl = async (): Promise<string> => {
  const response = await fetch(apiUrl("/auth/epic/start"), {
    method: "POST",
    headers: await getAuthHeaders(),
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(payload.error || "Não foi possível iniciar a conexão com a Epic Games.");
  }
  const payload = (await response.json()) as { url?: string };
  if (!payload.url) {
    throw new Error("Backend não retornou a URL de autenticação da Epic Games.");
  }
  return payload.url;
};

export const disconnectEpicAccount = async () => {
  const response = await fetch(apiUrl("/api/epic/disconnect"), {
    method: "POST",
    headers: await getAuthHeaders(),
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(payload.error || "Falha ao desconectar Epic Games.");
  }
};

export const fetchEpicLibrary = async (
  epicAccountId: string,
): Promise<EpicLibraryResponse> => {
  const response = await fetch(
    apiUrl(`/api/epic/library?epicAccountId=${encodeURIComponent(epicAccountId)}`),
    { headers: await getAuthHeaders() },
  );
  if (!response.ok) {
    let message = "Falha ao buscar biblioteca da Epic Games.";
    try {
      const body = (await response.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {}
    throw new Error(message);
  }
  return (await response.json()) as EpicLibraryResponse;
};

export const syncEpicLibraryToFirestore = async (
  uid: string,
  epicAccountId: string,
) => {
  const payload = await fetchEpicLibrary(epicAccountId);
  const batch = writeBatch(db);

  const existingGamesSnap = await getDocs(
    query(userGamesCollectionRef(uid), where("epicCatalogId", "!=", "")),
  );

  const catalogIdToDocId = new Map<string, string>();
  existingGamesSnap.docs.forEach((doc) => {
    const data = doc.data() as Game;
    if (data.epicCatalogId) {
      catalogIdToDocId.set(String(data.epicCatalogId), doc.id);
    }
  });

  payload.games.forEach((owned) => {
    const catalogId = String(owned.catalogId);
    const existingDocId = catalogIdToDocId.get(catalogId);
    const id = existingDocId || `${uid}_epic_${catalogId}`;

    const mapped: Omit<Game, "id"> = {
      title: owned.title || `Epic Item ${catalogId}`,
      image: owned.image || owned.backgroundImage || owned.cardImage || "",
      backgroundImage: owned.backgroundImage || owned.image || "",
      cardImage: owned.cardImage || owned.image || "",
      logoImage: owned.logoImage || "",
      category: "EPIC",
      description:
        owned.description ||
        `Importado da Epic Games. Dados da conta conectada. Catalog ID ${catalogId}.`,
      aboutTheGame: owned.aboutTheGame || owned.description || "",
      executablePath: owned.executablePath || catalogId,
      launcherType: "epic",
      epicCatalogId: catalogId,
      sizeGB: 0,
      trailerUrl: "",
      screenshots: owned.screenshots || [],
      releaseDate: owned.releaseDate || "",
      developer: owned.developer || "",
      publisher: owned.publisher || "",
      tags: owned.tags || [],
      source: "epic",
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
        lastEpicSyncAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
    await profileBatch.commit();
  } catch (err) {
    console.error("Erro ao atualizar perfil Epic:", err);
  }

  return payload.games.length;
};

// Placeholder search and details functions for Epic Games (to be connected to real backend)
export const searchEpicGames = async (query: string) => {
  // This will call /api/epic/search on your backend
  return { items: [] };
};

export const fetchEpicAppDetailsResult = async (
  catalogId: string
): Promise<EpicAppDetailsFetchResult> => {
  // This will call /api/epic/app-details?catalogId=... on your backend
  return {
    ok: true,
    data: {
      catalogId,
      title: catalogId,
      description: "",
      aboutTheGame: "",
      backgroundImage: "",
      cardImage: "",
    },
  };
};
