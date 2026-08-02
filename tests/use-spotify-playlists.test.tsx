// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  listSpotifyPlaylists: vi.fn(),
  createSpotifyPlaylist: vi.fn(),
  getSpotifyPlaylist: vi.fn(),
  addSpotifyPlaylistItems: vi.fn(),
  removeSpotifyPlaylistItem: vi.fn(),
  reorderSpotifyPlaylistItem: vi.fn(),
}));

vi.mock("../src/services/spotifyPlaylists", () => mocks);

import { useSpotifyPlaylists } from "../src/hooks/useSpotifyPlaylists";

const summary = { id: "one", name: "Mix", description: "", isPublic: false,
  collaborative: false, ownerId: "me", ownerName: "Me", coverUrl: "", totalItems: 0,
  spotifyUrl: "", snapshotId: "snapshot" };

describe("estado de playlists Spotify", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.listSpotifyPlaylists.mockResolvedValue([summary]);
    mocks.getSpotifyPlaylist.mockResolvedValue({ ...summary, items: [] });
  });

  it("carrega a lista e so confirma criacao depois do Spotify devolver um id", async () => {
    let resolveCreate!: (value: typeof summary) => void;
    mocks.createSpotifyPlaylist.mockReturnValue(new Promise((resolve) => { resolveCreate = resolve; }));
    const { result } = renderHook(() => useSpotifyPlaylists(async () => "token"));
    await waitFor(() => expect(result.current.playlists).toHaveLength(1));

    let creating!: Promise<unknown>;
    act(() => { creating = result.current.createPlaylist({ name: "New", description: "", isPublic: false }); });
    expect(result.current.playlists).toHaveLength(1);
    await act(async () => { resolveCreate({ ...summary, id: "new", name: "New" }); await creating; });
    expect(result.current.playlists.some((playlist) => playlist.id === "new")).toBe(true);
  });

  it("preserva a lista atual quando uma atualizacao falha", async () => {
    const { result } = renderHook(() => useSpotifyPlaylists(async () => "token"));
    await waitFor(() => expect(result.current.playlists).toHaveLength(1));
    mocks.listSpotifyPlaylists.mockRejectedValueOnce(new Error("offline"));

    await act(async () => { await result.current.refreshPlaylists().catch(() => undefined); });
    expect(result.current.playlists).toEqual([summary]);
    expect(result.current.error).toBe("offline");
  });
});
