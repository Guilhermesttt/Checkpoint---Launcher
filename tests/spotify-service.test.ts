import { describe, expect, it, vi } from "vitest";
import {
  addSpotifyTrackToQueue,
  getSpotifyQueue,
  playSpotifyContext,
  resolveSpotifyPlaybackDevice,
  searchSpotifyTracks,
  setSpotifyShuffle,
  spotifyRequest,
  startSpotifyTrackSequence,
} from "../src/services/spotify";

describe("cliente Spotify", () => {
  it("trata 204 como comando concluido", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    await expect(spotifyRequest("token", "/me/player/pause", { method: "PUT" }, fetchImpl)).resolves.toBeNull();
  });

  it("aceita corpo textual em comandos bem-sucedidos sem tentar ler JSON", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response("OK", { status: 200 }));
    await expect(spotifyRequest("token", "/me/player/pause", { method: "PUT" }, fetchImpl)).resolves.toBeNull();
  });

  it("inicia uma playlist externa como contexto de reproducao", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    await playSpotifyContext("token", "spotify:playlist:external", "device-1", fetchImpl);
    expect(String(fetchImpl.mock.calls[0][0])).toContain("/me/player/play?device_id=device-1");
    expect(JSON.parse(String(fetchImpl.mock.calls[0][1]?.body))).toEqual({
      context_uri: "spotify:playlist:external",
    });
  });

  it("toca exatamente a faixa clicada antes de preencher a fila", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    await startSpotifyTrackSequence(
      "token",
      "spotify:track:clicked",
      ["spotify:track:next", "spotify:track:later"],
      "device-1",
      fetchImpl,
    );

    expect(JSON.parse(String(fetchImpl.mock.calls[0][1]?.body))).toEqual({
      uris: ["spotify:track:clicked"],
    });
    expect(fetchImpl.mock.calls.slice(1).map(([url]) => String(url))).toEqual([
      expect.stringContaining("uri=spotify%3Atrack%3Anext"),
      expect.stringContaining("uri=spotify%3Atrack%3Alater"),
    ]);
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

  it("normaliza a faixa atual e as proximas da fila", async () => {
    const rawTrack = (id: string) => ({
      id,
      uri: `spotify:track:${id}`,
      name: id,
      duration_ms: 180_000,
      artists: [{ name: "Artist" }],
      album: { images: [{ url: `${id}.jpg` }] },
      external_urls: { spotify: `https://open.spotify.com/track/${id}` },
    });
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      currently_playing: rawTrack("current"),
      queue: [rawTrack("next"), rawTrack("later")],
    }), { status: 200, headers: { "Content-Type": "application/json" } }));

    await expect(getSpotifyQueue("token", fetchImpl)).resolves.toMatchObject({
      current: { id: "current" },
      upcoming: [{ id: "next" }, { id: "later" }],
    });
  });

  it("remove a faixa atual e repeticoes da fila retornada pelo Spotify", async () => {
    const rawTrack = (id: string) => ({
      id,
      uri: `spotify:track:${id}`,
      name: id,
      duration_ms: 180_000,
      artists: [{ name: "Artist" }],
      album: { images: [] },
    });
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      currently_playing: rawTrack("elite"),
      queue: [rawTrack("elite"), rawTrack("change"), rawTrack("change"), rawTrack("digital-bath")],
    }), { status: 200, headers: { "Content-Type": "application/json" } }));

    await expect(getSpotifyQueue("token", fetchImpl)).resolves.toMatchObject({
      current: { id: "elite" },
      upcoming: [{ id: "change" }, { id: "digital-bath" }],
    });
  });

  it("adiciona uma faixa a fila do dispositivo selecionado", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    await addSpotifyTrackToQueue("token", "spotify:track:one", "device-1", fetchImpl);

    expect(String(fetchImpl.mock.calls[0][0])).toContain(
      "/me/player/queue?uri=spotify%3Atrack%3Aone&device_id=device-1",
    );
    expect(fetchImpl.mock.calls[0][1]).toMatchObject({ method: "POST" });
  });

  it("altera o modo aleatorio no dispositivo selecionado", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    await setSpotifyShuffle("token", true, "device-1", fetchImpl);

    expect(String(fetchImpl.mock.calls[0][0])).toContain(
      "/me/player/shuffle?state=true&device_id=device-1",
    );
    expect(fetchImpl.mock.calls[0][1]).toMatchObject({ method: "PUT" });
  });
});
