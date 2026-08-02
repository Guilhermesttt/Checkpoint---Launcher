import { describe, expect, it, vi } from "vitest";
import {
  addSpotifyPlaylistItems,
  createSpotifyPlaylist,
  getSpotifyPlaylist,
  listSpotifyPlaylists,
  removeSpotifyPlaylistItem,
  reorderSpotifyPlaylistItem,
} from "../src/services/spotifyPlaylists";

const jsonResponse = (payload: unknown, status = 200) => new Response(
  JSON.stringify(payload),
  { status, headers: { "Content-Type": "application/json" } },
);

describe("playlists Spotify", () => {
  it("lista e normaliza playlists disponiveis", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ items: [{
      id: "playlist-1",
      name: "Checkpoint Mix",
      description: "Games",
      public: false,
      collaborative: false,
      owner: { id: "user-1", display_name: "Player" },
      images: [{ url: "cover.jpg" }],
      items: { total: 2 },
      external_urls: { spotify: "https://open.spotify.com/playlist/playlist-1" },
      snapshot_id: "snapshot-1",
    }] }));

    await expect(listSpotifyPlaylists("token", fetchImpl)).resolves.toEqual([
      expect.objectContaining({ id: "playlist-1", name: "Checkpoint Mix", totalItems: 2 }),
    ]);
  });

  it("cria uma playlist privada real na conta", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({
      id: "created",
      name: "Night Run",
      description: "Checkpoint",
      public: false,
      owner: { id: "user-1" },
      images: [],
      items: { total: 0 },
      snapshot_id: "snapshot-created",
    }, 201));

    await expect(createSpotifyPlaylist("token", {
      name: "Night Run",
      description: "Checkpoint",
      isPublic: false,
    }, fetchImpl)).resolves.toMatchObject({ id: "created", isPublic: false });
    expect(JSON.parse(String(fetchImpl.mock.calls[0][1]?.body))).toMatchObject({
      name: "Night Run",
      description: "Checkpoint",
      public: false,
    });
  });

  it("carrega os itens usando o formato atual da API", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({
      id: "playlist-1",
      name: "Mix",
      owner: { id: "user-1" },
      images: [],
      items: { items: [{ item: {
        id: "track-1", uri: "spotify:track:track-1", name: "Track",
        artists: [{ name: "Artist" }], album: { images: [] }, duration_ms: 120_000,
      } }], total: 1 },
      snapshot_id: "snapshot-1",
    }));

    await expect(getSpotifyPlaylist("token", "playlist-1", fetchImpl)).resolves.toMatchObject({
      id: "playlist-1",
      items: [{ id: "track-1" }],
    });
  });

  it("preserva o contexto de uma playlist externa mesmo sem acesso aos itens", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({
      id: "external",
      uri: "spotify:playlist:external",
      name: "Descobertas",
      owner: { id: "another-user", display_name: "Spotify" },
      images: [],
      external_urls: { spotify: "https://open.spotify.com/playlist/external" },
      snapshot_id: "snapshot-external",
    }));

    await expect(getSpotifyPlaylist("token", "external", fetchImpl)).resolves.toMatchObject({
      id: "external",
      uri: "spotify:playlist:external",
      items: [],
      itemsRestricted: true,
    });
  });

  it("adiciona, remove e reordena itens pelo endpoint atual", async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ snapshot_id: "add" }, 201))
      .mockResolvedValueOnce(jsonResponse({ snapshot_id: "remove" }))
      .mockResolvedValueOnce(jsonResponse({ snapshot_id: "reorder" }));

    await expect(addSpotifyPlaylistItems("token", "playlist-1", ["spotify:track:one"], fetchImpl))
      .resolves.toBe("add");
    await expect(removeSpotifyPlaylistItem("token", "playlist-1", "spotify:track:one", "add", fetchImpl))
      .resolves.toBe("remove");
    await expect(reorderSpotifyPlaylistItem("token", "playlist-1", 2, 0, "remove", fetchImpl))
      .resolves.toBe("reorder");

    for (const [url] of fetchImpl.mock.calls) {
      expect(String(url)).toContain("/playlists/playlist-1/items");
      expect(String(url)).not.toContain("/tracks");
    }
  });
});
