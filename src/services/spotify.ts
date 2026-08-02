export interface SpotifyTrack {
  id: string;
  uri: string;
  title: string;
  artist: string;
  coverUrl: string;
  spotifyUrl: string;
  durationMs: number;
}

export interface SpotifyTrackPayload {
  id?: string;
  uri?: string;
  name?: string;
  duration_ms?: number;
  artists?: Array<{ name?: string }>;
  album?: { images?: Array<{ url?: string }> };
  external_urls?: { spotify?: string };
}

export interface SpotifyQueueSnapshot {
  current: SpotifyTrack | null;
  upcoming: SpotifyTrack[];
}

export const mapSpotifyTrack = (
  track?: SpotifyTrackPayload | null,
): SpotifyTrack | null => {
  if (!track?.id || !track.uri || !track.name) return null;
  return {
    id: track.id,
    uri: track.uri,
    title: track.name,
    artist: (track.artists ?? []).map((artist) => artist.name).filter(Boolean).join(", "),
    coverUrl: track.album?.images?.[0]?.url || "",
    spotifyUrl: track.external_urls?.spotify || `https://open.spotify.com/track/${track.id}`,
    durationMs: Number(track.duration_ms) || 0,
  };
};

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
  const rawBody = await response.text();
  if (!response.ok) {
    const payload = (() => {
      try { return JSON.parse(rawBody || "{}"); } catch { return {}; }
    })() as {
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
  if (!rawBody.trim()) return null;
  try {
    return JSON.parse(rawBody) as T;
  } catch {
    if (init.method && init.method !== "GET") return null;
    throw new SpotifyApiError("O Spotify retornou uma resposta inválida.", response.status, "invalid_response");
  }
};

export const searchSpotifyTracks = async (
  accessToken: string,
  query: string,
  fetchImpl: typeof fetch = fetch,
): Promise<SpotifyTrack[]> => {
  if (!query.trim()) return [];
  const payload = await spotifyRequest<{
    tracks?: { items?: SpotifyTrackPayload[] };
  }>(accessToken, `/search?type=track&limit=8&q=${encodeURIComponent(query.trim())}`, {}, fetchImpl);

  return (payload?.tracks?.items ?? [])
    .map(mapSpotifyTrack)
    .filter((track): track is SpotifyTrack => track !== null);
};

const spotifyDeviceSuffix = (deviceId: string) => deviceId.trim()
  ? `&device_id=${encodeURIComponent(deviceId.trim())}`
  : "";

export const getSpotifyQueue = async (
  accessToken: string,
  fetchImpl: typeof fetch = fetch,
): Promise<SpotifyQueueSnapshot> => {
  const payload = await spotifyRequest<{
    currently_playing?: SpotifyTrackPayload | null;
    queue?: SpotifyTrackPayload[];
  }>(accessToken, "/me/player/queue", {}, fetchImpl);
  const current = mapSpotifyTrack(payload?.currently_playing);
  const seen = new Set(current ? [current.id] : []);
  const upcoming = (payload?.queue ?? [])
    .map(mapSpotifyTrack)
    .filter((track): track is SpotifyTrack => track !== null)
    .filter((track) => {
      if (seen.has(track.id)) return false;
      seen.add(track.id);
      return true;
    });
  return { current, upcoming };
};

export const addSpotifyTrackToQueue = (
  accessToken: string,
  uri: string,
  deviceId = "",
  fetchImpl: typeof fetch = fetch,
) => spotifyRequest(
  accessToken,
  `/me/player/queue?uri=${encodeURIComponent(uri)}${spotifyDeviceSuffix(deviceId)}`,
  { method: "POST" },
  fetchImpl,
);

export const startSpotifyTrackSequence = async (
  accessToken: string,
  selectedUri: string,
  nextUris: string[],
  deviceId: string,
  fetchImpl: typeof fetch = fetch,
) => {
  await spotifyRequest(
    accessToken,
    `/me/player/play?device_id=${encodeURIComponent(deviceId)}`,
    { method: "PUT", body: JSON.stringify({ uris: [selectedUri] }) },
    fetchImpl,
  );
  for (const uri of nextUris) {
    await addSpotifyTrackToQueue(accessToken, uri, deviceId, fetchImpl);
  }
};

export const setSpotifyShuffle = (
  accessToken: string,
  enabled: boolean,
  deviceId = "",
  fetchImpl: typeof fetch = fetch,
) => spotifyRequest(
  accessToken,
  `/me/player/shuffle?state=${enabled}${spotifyDeviceSuffix(deviceId)}`,
  { method: "PUT" },
  fetchImpl,
);

export const playSpotifyContext = (
  accessToken: string,
  contextUri: string,
  deviceId: string,
  fetchImpl: typeof fetch = fetch,
) => spotifyRequest(
  accessToken,
  `/me/player/play?device_id=${encodeURIComponent(deviceId)}`,
  { method: "PUT", body: JSON.stringify({ context_uri: contextUri }) },
  fetchImpl,
);

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
