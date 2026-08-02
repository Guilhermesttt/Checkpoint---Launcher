import * as React from "react";
import type { SpotifyTrack } from "../services/spotify";
import {
  addSpotifyPlaylistItems,
  createSpotifyPlaylist,
  getSpotifyPlaylist,
  listSpotifyPlaylists,
  removeSpotifyPlaylistItem,
  reorderSpotifyPlaylistItem,
  type CreateSpotifyPlaylistInput,
  type SpotifyPlaylistDetails,
  type SpotifyPlaylistSummary,
} from "../services/spotifyPlaylists";

export const useSpotifyPlaylists = (
  tokenProvider: () => Promise<string>,
) => {
  const tokenProviderRef = React.useRef(tokenProvider);
  tokenProviderRef.current = tokenProvider;
  const [playlists, setPlaylists] = React.useState<SpotifyPlaylistSummary[]>([]);
  const [activePlaylist, setActivePlaylist] = React.useState<SpotifyPlaylistDetails | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [pendingAction, setPendingAction] = React.useState("");
  const [error, setError] = React.useState("");

  const token = React.useCallback(() => tokenProviderRef.current(), []);

  const refreshPlaylists = React.useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const next = await listSpotifyPlaylists(await token());
      setPlaylists(next);
      return next;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
      throw reason;
    } finally {
      setLoading(false);
    }
  }, [token]);

  React.useEffect(() => {
    void refreshPlaylists().catch(() => undefined);
  }, [refreshPlaylists]);

  const openPlaylist = React.useCallback(async (playlistId: string) => {
    setPendingAction(`open:${playlistId}`);
    setError("");
    try {
      const details = await getSpotifyPlaylist(await token(), playlistId);
      setActivePlaylist(details);
      return details;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
      throw reason;
    } finally {
      setPendingAction("");
    }
  }, [token]);

  const createPlaylist = React.useCallback(async (input: CreateSpotifyPlaylistInput) => {
    setPendingAction("create");
    setError("");
    try {
      const created = await createSpotifyPlaylist(await token(), input);
      setPlaylists((current) => [created, ...current.filter((item) => item.id !== created.id)]);
      return created;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
      throw reason;
    } finally {
      setPendingAction("");
    }
  }, [token]);

  const addTrack = React.useCallback(async (playlistId: string, track: SpotifyTrack) => {
    setPendingAction(`add:${track.id}`);
    try {
      await addSpotifyPlaylistItems(await token(), playlistId, [track.uri]);
      if (activePlaylist?.id === playlistId) await openPlaylist(playlistId);
    } finally {
      setPendingAction("");
    }
  }, [activePlaylist?.id, openPlaylist, token]);

  const removeTrack = React.useCallback(async (index: number) => {
    const playlist = activePlaylist;
    const track = playlist?.items[index];
    if (!playlist || !track) return;
    setPendingAction(`remove:${track.id}`);
    try {
      await removeSpotifyPlaylistItem(
        await token(), playlist.id, track.uri, playlist.snapshotId,
      );
      await openPlaylist(playlist.id);
    } finally {
      setPendingAction("");
    }
  }, [activePlaylist, openPlaylist, token]);

  const moveTrack = React.useCallback(async (from: number, to: number) => {
    const playlist = activePlaylist;
    if (!playlist || from === to || to < 0 || to >= playlist.items.length) return;
    setPendingAction(`move:${from}`);
    try {
      await reorderSpotifyPlaylistItem(
        await token(), playlist.id, from, to, playlist.snapshotId,
      );
      await openPlaylist(playlist.id);
    } finally {
      setPendingAction("");
    }
  }, [activePlaylist, openPlaylist, token]);

  return {
    playlists,
    activePlaylist,
    loading,
    pendingAction,
    error,
    refreshPlaylists,
    openPlaylist,
    createPlaylist,
    addTrack,
    removeTrack,
    moveTrack,
    setActivePlaylist,
  };
};
