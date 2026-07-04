import { apiUrl } from "./api";

export interface EpicAppDetails {
  catalogId: string;
  namespace?: string;
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

export const searchEpicGames = async (query: string) => {
  const response = await fetch(
    apiUrl(`/api/epic/search?query=${encodeURIComponent(query)}`),
  );
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(payload.error || "Falha ao buscar jogos na Epic Games.");
  }
  return (await response.json()) as { items: any[] };
};

export const fetchEpicAppDetailsResult = async (
  catalogId: string,
  namespaceOverride?: string,
): Promise<EpicAppDetailsFetchResult> => {
  const parts = decodeURIComponent(catalogId).split(":");
  const namespace = namespaceOverride || (parts.length >= 2 ? parts[0] : "");
  const itemId = parts.length >= 2 ? parts[1] : catalogId;
  const params = new URLSearchParams({ catalogId: itemId });
  if (namespace) params.set("namespace", namespace);

  const response = await fetch(apiUrl(`/api/epic/app-details?${params}`));
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    return { ok: false, message: payload.error || "Falha ao buscar detalhes da Epic Games." };
  }
  return { ok: true, data: (await response.json()) as EpicAppDetails };
};
