import type { SpotifyTrack } from "./spotify";

export interface SpotifyPlaybackSnapshot {
  paused: boolean;
  positionMs: number;
  durationMs: number;
  track: SpotifyTrack | null;
}

interface SdkPlaybackState {
  paused?: boolean;
  position?: number;
  duration?: number;
  track_window?: {
    current_track?: {
      id?: string;
      uri?: string;
      name?: string;
      artists?: Array<{ name?: string }>;
      album?: { images?: Array<{ url?: string }> };
    };
  };
}

interface WebApiPlaybackState {
  is_playing?: boolean;
  progress_ms?: number;
  item?: {
    id?: string;
    uri?: string;
    name?: string;
    duration_ms?: number;
    artists?: Array<{ name?: string }>;
    album?: { images?: Array<{ url?: string }> };
    external_urls?: { spotify?: string };
  };
}

export const EMPTY_SPOTIFY_PLAYBACK: SpotifyPlaybackSnapshot = {
  paused: true,
  positionMs: 0,
  durationMs: 0,
  track: null,
};

export const advanceSpotifyPlayback = (
  playback: SpotifyPlaybackSnapshot,
  elapsedMs = 1_000,
): SpotifyPlaybackSnapshot => {
  if (playback.paused || !playback.track || elapsedMs <= 0) return playback;
  const nextPosition = playback.positionMs + elapsedMs;
  return {
    ...playback,
    positionMs: playback.durationMs > 0
      ? Math.min(playback.durationMs, nextPosition)
      : nextPosition,
  };
};

export const applySpotifyPlaybackCommand = (
  playback: SpotifyPlaybackSnapshot,
  command: "toggle" | "seek",
  value = 0,
): SpotifyPlaybackSnapshot => {
  if (command === "toggle") return { ...playback, paused: !playback.paused };
  return {
    ...playback,
    positionMs: Math.max(0, Math.min(playback.durationMs || Number.MAX_SAFE_INTEGER, value)),
  };
};

export const buildSpotifyPlaybackSequence = (
  selected: SpotifyTrack,
  candidates: SpotifyTrack[],
  random: () => number = Math.random,
): SpotifyTrack[] => {
  const uniqueCandidates = Array.from(
    new Map(candidates
      .filter((track) => track.id !== selected.id)
      .map((track) => [track.id, track])).values(),
  );
  for (let index = uniqueCandidates.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [uniqueCandidates[index], uniqueCandidates[target]] = [uniqueCandidates[target], uniqueCandidates[index]];
  }
  return [selected, ...uniqueCandidates].slice(0, 8);
};

export const getSpotifyCarouselOffset = (index: number) => {
  if (index === 0) return 0;
  const distance = Math.ceil(index / 2);
  return index % 2 === 1 ? -distance : distance;
};

export const mapSpotifyPlaybackState = (
  rawState: unknown,
): SpotifyPlaybackSnapshot => {
  const state = rawState as SdkPlaybackState | null | undefined;
  const current = state?.track_window?.current_track;
  if (!current?.id || !current.uri || !current.name) return EMPTY_SPOTIFY_PLAYBACK;
  const durationMs = Number(state?.duration) || 0;
  return {
    paused: state?.paused !== false,
    positionMs: Number(state?.position) || 0,
    durationMs,
    track: {
      id: current.id,
      uri: current.uri,
      title: current.name,
      artist: (current.artists ?? []).map((artist) => artist.name).filter(Boolean).join(", "),
      coverUrl: current.album?.images?.[0]?.url || "",
      spotifyUrl: `https://open.spotify.com/track/${current.id}`,
      durationMs,
    },
  };
};

export const mapSpotifyWebApiPlayback = (
  rawState: unknown,
): SpotifyPlaybackSnapshot => {
  const state = rawState as WebApiPlaybackState | null | undefined;
  const item = state?.item;
  if (!item?.id || !item.uri || !item.name) return EMPTY_SPOTIFY_PLAYBACK;
  return {
    paused: state?.is_playing !== true,
    positionMs: Number(state?.progress_ms) || 0,
    durationMs: Number(item.duration_ms) || 0,
    track: {
      id: String(item.id),
      uri: String(item.uri),
      title: String(item.name),
      artist: (item.artists ?? []).map((artist: { name?: string }) => artist.name).filter(Boolean).join(", "),
      coverUrl: String(item.album?.images?.[0]?.url || ""),
      spotifyUrl: String(item.external_urls?.spotify || `https://open.spotify.com/track/${item.id}`),
      durationMs: Number(item.duration_ms) || 0,
    },
  };
};
