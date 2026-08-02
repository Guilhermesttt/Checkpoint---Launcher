import { describe, expect, it } from "vitest";
import {
  applySpotifyPlaybackCommand,
  advanceSpotifyPlayback,
  mapSpotifyPlaybackState,
  mapSpotifyWebApiPlayback,
} from "../src/services/spotifyPlayback";

describe("estado do Spotify Web Playback", () => {
  it("normaliza faixa, progresso e pausa enviados pelo SDK", () => {
    expect(mapSpotifyPlaybackState({
      paused: false,
      position: 12_000,
      duration: 180_000,
      track_window: {
        current_track: {
          id: "one",
          uri: "spotify:track:one",
          name: "Genesis",
          artists: [{ name: "Justice" }],
          album: { images: [{ url: "cover" }] },
        },
      },
    })).toEqual({
      paused: false,
      positionMs: 12_000,
      durationMs: 180_000,
      track: {
        id: "one",
        uri: "spotify:track:one",
        title: "Genesis",
        artist: "Justice",
        coverUrl: "cover",
        spotifyUrl: "https://open.spotify.com/track/one",
        durationMs: 180_000,
      },
    });
  });

  it("retorna estado vazio quando nao existe faixa", () => {
    expect(mapSpotifyPlaybackState(null)).toEqual({
      paused: true,
      positionMs: 0,
      durationMs: 0,
      track: null,
    });
  });

  it("normaliza playback remoto da Web API como fallback", () => {
    expect(mapSpotifyWebApiPlayback({
      is_playing: true,
      progress_ms: 5_000,
      item: {
        id: "remote",
        uri: "spotify:track:remote",
        name: "Around the World",
        duration_ms: 430_000,
        artists: [{ name: "Daft Punk" }],
        album: { images: [{ url: "remote-cover" }] },
        external_urls: { spotify: "https://open.spotify.com/track/remote" },
      },
    }).track).toMatchObject({ title: "Around the World", artist: "Daft Punk" });
  });

  it("avanca a minutagem de um em um segundo enquanto toca", () => {
    const playback = mapSpotifyPlaybackState({
      paused: false,
      position: 5_000,
      duration: 7_000,
      track_window: { current_track: {
        id: "clock", uri: "spotify:track:clock", name: "Clock", artists: [], album: { images: [] },
      } },
    });

    expect(advanceSpotifyPlayback(playback, 1_000).positionMs).toBe(6_000);
    expect(advanceSpotifyPlayback(playback, 3_000).positionMs).toBe(7_000);
    expect(advanceSpotifyPlayback({ ...playback, paused: true }, 1_000).positionMs).toBe(5_000);
  });

  it("reflete imediatamente os comandos remotos no estado local", () => {
    const playback = mapSpotifyWebApiPlayback({
      is_playing: false,
      progress_ms: 5_000,
      item: { id: "track", uri: "spotify:track:track", name: "Track", duration_ms: 20_000 },
    });
    expect(applySpotifyPlaybackCommand(playback, "toggle").paused).toBe(false);
    expect(applySpotifyPlaybackCommand(playback, "seek", 12_000).positionMs).toBe(12_000);
  });
});
