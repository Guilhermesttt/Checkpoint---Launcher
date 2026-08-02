import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync("src/components/spotify/SpotifyPage.tsx", "utf8");

describe("layout hibrido do Spotify", () => {
  it("organiza biblioteca, conteudo, fila e transporte persistente", () => {
    expect(source).toContain('data-testid="spotify-navigation"');
    expect(source).toContain('data-testid="spotify-content"');
    expect(source).toContain('data-testid="spotify-queue"');
    expect(source).toContain('data-testid="spotify-transport"');
  });

  it("usa busca instantanea e playlists reais do Spotify", () => {
    expect(source).toContain("useSpotifySearch");
    expect(source).toContain("useSpotifyPlaylists");
    expect(source).toContain("player.addToQueue");
    expect(source).toContain("playlists.addTrack");
  });

  it("expoe embaralhamento, proxima faixa e criacao de playlist", () => {
    expect(source).toContain("player.toggleShuffle");
    expect(source).toContain("player.queue.upcoming");
    expect(source).toContain("playlists.createPlaylist");
  });
});
