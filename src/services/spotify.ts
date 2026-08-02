export interface SpotifyTrack {
  id: string;
  uri: string;
  title: string;
  artist: string;
  coverUrl: string;
  spotifyUrl: string;
  durationMs: number;
}

export class SpotifyApiError extends Error {
  code: string;
  status: number;
  retryAfter: number;

  constructor(message: string, status: number, code = "spotify_api_error", retryAfter = 0) {
    super(message);
    this.name = "SpotifyApiError";
    this.code = code;
    this.status = status;
    this.retryAfter = retryAfter;
  }
}

export const spotifyRequest = async <T = unknown>(
  accessToken: string,
  endpoint: string,
  init: RequestInit = {},
  fetchImpl: typeof fetch = fetch,
): Promise<T | null> => {
  const response = await fetchImpl(`https://api.spotify.com/v1${endpoint}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
  });
  if (response.status === 204) return null;
  if (!response.ok) {
    const payload = await response.json().catch(() => ({})) as {
      error?: { message?: string } | string;
    };
    const message = typeof payload.error === "string"
      ? payload.error
      : payload.error?.message || "O Spotify recusou a operacao.";
    const retryAfter = Number(response.headers.get("Retry-After")) || 0;
    throw new SpotifyApiError(
      message,
      response.status,
      response.status === 429 ? "rate_limited" : "spotify_api_error",
      retryAfter,
    );
  }
  return response.json() as Promise<T>;
};

export const searchSpotifyTracks = async (
  accessToken: string,
  query: string,
  fetchImpl: typeof fetch = fetch,
): Promise<SpotifyTrack[]> => {
  if (!query.trim()) return [];
  const payload = await spotifyRequest<{
    tracks?: { items?: Array<{
      id?: string;
      uri?: string;
      name?: string;
      duration_ms?: number;
      artists?: Array<{ name?: string }>;
      album?: { images?: Array<{ url?: string }> };
      external_urls?: { spotify?: string };
    }> };
  }>(accessToken, `/search?type=track&limit=8&q=${encodeURIComponent(query.trim())}`, {}, fetchImpl);

  return (payload?.tracks?.items ?? []).flatMap((track) => {
    if (!track.id || !track.uri || !track.name) return [];
    return [{
      id: track.id,
      uri: track.uri,
      title: track.name,
      artist: (track.artists ?? []).map((artist) => artist.name).filter(Boolean).join(", "),
      coverUrl: track.album?.images?.[0]?.url || "",
      spotifyUrl: track.external_urls?.spotify || "",
      durationMs: Number(track.duration_ms) || 0,
    }];
  });
};

export const resolveSpotifyPlaybackDevice = async (
  accessToken: string,
  preferredDeviceId = "",
  fetchImpl: typeof fetch = fetch,
): Promise<string> => {
  if (preferredDeviceId.trim()) return preferredDeviceId.trim();

  const payload = await spotifyRequest<{
    devices?: Array<{
      id?: string | null;
      is_active?: boolean;
      is_restricted?: boolean;
    }>;
  }>(accessToken, "/me/player/devices", {}, fetchImpl);
  const controllableDevices = (payload?.devices ?? []).filter(
    (device) => Boolean(device.id) && device.is_restricted !== true,
  );
  const selected = controllableDevices.find((device) => device.is_active)
    ?? controllableDevices[0];
  if (!selected?.id) {
    throw new SpotifyApiError(
      "Abra o Spotify no computador ou celular e reproduza uma musica uma vez.",
      404,
      "no_playback_device",
    );
  }
  return selected.id;
};

export const getSpotifyClientId = () => String(import.meta.env.VITE_SPOTIFY_CLIENT_ID || "").trim();
