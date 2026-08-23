import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(path, "utf8");

describe("superficies compartilhadas do Spotify", () => {
  it("expoe uma categoria e pagina dedicada sem dock permanente", () => {
    const sidebar = source("src/components/Sidebar.tsx");
    const home = source("src/pages/Home.tsx");
    expect(sidebar).toContain('id: "SPOTIFY"');
    expect(home).toContain("<SpotifyPage");
    expect(home).not.toContain("<SpotifyDock");
    expect(home).toContain("language={launcherLanguage}");
  });

  it("localiza a superficie Spotify em todos os idiomas do launcher", () => {
    const page = source("src/components/spotify/SpotifyPage.tsx");
    for (const language of ["pt-BR", "en-US", "es-ES", "fr-FR", "de-DE", "it-IT"]) {
      expect(page).toContain(`"${language}":`);
    }
    expect(page).toContain("const copy = SPOTIFY_COPY[language]");
  });

  it("inclui controles Spotify e seek no overlay in-game", () => {
    const overlay = source("electron/overlay.html");
    expect(overlay).toContain('data-panel-tab="spotify"');
    expect(overlay).toContain('data-panel-view="spotify"');
    expect(overlay).toContain('id="spotify-overlay-seek"');
    expect(overlay).toContain('kind: "spotify-seek"');
    expect(overlay).toContain('kind: direction < 0 ? "spotify-previous" : "spotify-next"');
  });

  it("protege o tema do launcher durante toda reproducao Spotify", () => {
    const app = source("src/App.tsx");
    expect(app).toContain("spotifyPlayingRef.current");
    expect(app.match(/if \(spotifyPlayingRef\.current\) return/g)?.length).toBeGreaterThanOrEqual(2);
  });

  it("usa a capa da faixa na notificacao compacta do launcher", () => {
    const home = source("src/pages/Home.tsx");
    const notifications = source("src/components/NotificationCenter.tsx");
    expect(home).toContain("imageUrl: track.coverUrl");
    expect(notifications).toContain("imageUrl: options?.imageUrl");
  });
});
