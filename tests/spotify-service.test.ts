import { describe, expect, it, vi } from "vitest";
import {
  resolveSpotifyPlaybackDevice,
  searchSpotifyTracks,
  spotifyRequest,
} from "../src/services/spotify";

describe("cliente Spotify", () => {
  it("trata 204 como comando concluido", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    await expect(spotifyRequest("token", "/me/player/pause", { method: "PUT" }, fetchImpl)).resolves.toBeNull();
  });

  it("retorna Retry-After quando a API limita requisicoes", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response("{}", {
      status: 429,
      headers: { "Retry-After": "7" },
    }));

    await expect(spotifyRequest("token", "/me/player", {}, fetchImpl)).rejects.toMatchObject({
      code: "rate_limited",
      retryAfter: 7,
    });
  });

  it("normaliza resultados de busca para a UI", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      tracks: { items: [{
        id: "track-1",
        uri: "spotify:track:track-1",
        name: "Midnight City",
        artists: [{ name: "M83" }],
        album: { images: [{ url: "https://image.test/cover.jpg" }] },
        external_urls: { spotify: "https://open.spotify.com/track/track-1" },
        duration_ms: 244000,
      }] },
    }), { status: 200, headers: { "Content-Type": "application/json" } }));

    await expect(searchSpotifyTracks("token", "midnight", fetchImpl)).resolves.toEqual([{
      id: "track-1",
      uri: "spotify:track:track-1",
      title: "Midnight City",
      artist: "M83",
      coverUrl: "https://image.test/cover.jpg",
      spotifyUrl: "https://open.spotify.com/track/track-1",
      durationMs: 244000,
    }]);
  });

  it("escolhe um dispositivo disponivel quando nenhum esta ativo", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      devices: [
        { id: "restricted", is_active: false, is_restricted: true, name: "TV" },
        { id: "desktop", is_active: false, is_restricted: false, name: "Spotify Desktop" },
      ],
    }), { status: 200, headers: { "Content-Type": "application/json" } }));

    await expect(resolveSpotifyPlaybackDevice("token", "", fetchImpl)).resolves.toBe("desktop");
  });

  it("explica quando nao existe dispositivo capaz de tocar", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({ devices: [] }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }));

    await expect(resolveSpotifyPlaybackDevice("token", "", fetchImpl)).rejects.toThrow(
      "Abra o Spotify no computador ou celular e reproduza uma musica uma vez.",
    );
  });
});
