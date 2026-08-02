import {
  mapSpotifyTrack,
  spotifyRequest,
  type SpotifyTrack,
  type SpotifyTrackPayload,
} from "./spotify";

export interface SpotifyPlaylistSummary {
  id: string;
  name: string;
  description: string;
  isPublic: boolean;
  collaborative: boolean;
  ownerId: string;
  ownerName: string;
  coverUrl: string;
  totalItems: number;
  spotifyUrl: string;
  snapshotId: string;
  uri: string;
}

export interface SpotifyPlaylistDetails extends SpotifyPlaylistSummary {
  items: SpotifyTrack[];
  itemsRestricted: boolean;
}

export interface CreateSpotifyPlaylistInput {
  name: string;
  description: string;
  isPublic: boolean;
}

interface SpotifyPlaylistPayload {
  id?: string;
  name?: string;
  description?: string | null;
  public?: boolean | null;
  collaborative?: boolean;
  owner?: { id?: string; display_name?: string | null };
  images?: Array<{ url?: string }>;
  external_urls?: { spotify?: string };
  snapshot_id?: string;
  uri?: string;
  items?: {
    total?: number;
    items?: Array<{ item?: SpotifyTrackPayload | null }>;
  };
}

const mapPlaylist = (playlist: SpotifyPlaylistPayload): SpotifyPlaylistSummary | null => {
  if (!playlist.id || !playlist.name) return null;
  return {
    id: playlist.id,
    name: playlist.name,
    description: playlist.description || "",
    isPublic: playlist.public === true,
    collaborative: playlist.collaborative === true,
    ownerId: playlist.owner?.id || "",
    ownerName: playlist.owner?.display_name || "",
    coverUrl: playlist.images?.[0]?.url || "",
    totalItems: Number(playlist.items?.total) || 0,
    spotifyUrl: playlist.external_urls?.spotify || `https://open.spotify.com/playlist/${playlist.id}`,
    snapshotId: playlist.snapshot_id || "",
    uri: playlist.uri || `spotify:playlist:${playlist.id}`,
  };
};

export const listSpotifyPlaylists = async (
  accessToken: string,
  fetchImpl: typeof fetch = fetch,
): Promise<SpotifyPlaylistSummary[]> => {
  const payload = await spotifyRequest<{ items?: SpotifyPlaylistPayload[] }>(
    accessToken,
    "/me/playlists?limit=20",
    {},
    fetchImpl,
  );
  return (payload?.items ?? [])
    .map(mapPlaylist)
    .filter((playlist): playlist is SpotifyPlaylistSummary => playlist !== null);
};

export const createSpotifyPlaylist = async (
  accessToken: string,
  input: CreateSpotifyPlaylistInput,
  fetchImpl: typeof fetch = fetch,
): Promise<SpotifyPlaylistSummary> => {
  const payload = await spotifyRequest<SpotifyPlaylistPayload>(
    accessToken,
    "/me/playlists",
    {
      method: "POST",
      body: JSON.stringify({
        name: input.name.trim(),
        description: input.description.trim(),
        public: input.isPublic,
      }),
    },
    fetchImpl,
  );
  const playlist = payload ? mapPlaylist(payload) : null;
  if (!playlist) throw new Error("O Spotify nao retornou a playlist criada.");
  return playlist;
};

export const getSpotifyPlaylist = async (
  accessToken: string,
  playlistId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<SpotifyPlaylistDetails> => {
  const payload = await spotifyRequest<SpotifyPlaylistPayload>(
    accessToken,
    `/playlists/${encodeURIComponent(playlistId)}`,
    {},
    fetchImpl,
  );
  const playlist = payload ? mapPlaylist(payload) : null;
  if (!playlist || !payload) throw new Error("Playlist Spotify indisponivel.");
  return {
    ...playlist,
    items: (payload.items?.items ?? [])
      .map((entry) => mapSpotifyTrack(entry.item))
      .filter((track): track is SpotifyTrack => track !== null),
    itemsRestricted: !payload.items,
  };
};

const snapshotId = (payload: { snapshot_id?: string } | null) => payload?.snapshot_id || "";

export const addSpotifyPlaylistItems = async (
  accessToken: string,
  playlistId: string,
  uris: string[],
  fetchImpl: typeof fetch = fetch,
) => snapshotId(await spotifyRequest<{ snapshot_id?: string }>(
  accessToken,
  `/playlists/${encodeURIComponent(playlistId)}/items`,
  { method: "POST", body: JSON.stringify({ uris }) },
  fetchImpl,
));

export const removeSpotifyPlaylistItem = async (
  accessToken: string,
  playlistId: string,
  uri: string,
  currentSnapshotId = "",
  fetchImpl: typeof fetch = fetch,
) => snapshotId(await spotifyRequest<{ snapshot_id?: string }>(
  accessToken,
  `/playlists/${encodeURIComponent(playlistId)}/items`,
  {
    method: "DELETE",
    body: JSON.stringify({
      items: [{ uri }],
      ...(currentSnapshotId ? { snapshot_id: currentSnapshotId } : {}),
    }),
  },
  fetchImpl,
));

export const reorderSpotifyPlaylistItem = async (
  accessToken: string,
  playlistId: string,
  rangeStart: number,
  insertBefore: number,
  currentSnapshotId = "",
  fetchImpl: typeof fetch = fetch,
) => snapshotId(await spotifyRequest<{ snapshot_id?: string }>(
  accessToken,
  `/playlists/${encodeURIComponent(playlistId)}/items`,
  {
    method: "PUT",
    body: JSON.stringify({
      range_start: rangeStart,
      insert_before: insertBefore,
      range_length: 1,
      ...(currentSnapshotId ? { snapshot_id: currentSnapshotId } : {}),
    }),
  },
  fetchImpl,
));
