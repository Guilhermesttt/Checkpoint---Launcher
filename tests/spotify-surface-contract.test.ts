import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(path, "utf8");

describe("superficies compartilhadas do Spotify", () => {
  it("nao expoe a categoria Spotify no launcher", () => {
    const sidebar = source("src/components/Sidebar.tsx");
    const home = source("src/pages/Home.tsx");
    expect(sidebar).not.toContain('{ id: "SPOTIFY"');
    expect(home).not.toContain("<SpotifyPage");
  });

  it("localiza a superficie Spotify em todos os idiomas do launcher", () => {
    const page = source("src/components/spotify/SpotifyPage.tsx");
    for (const language of ["pt-BR", "en-US", "es-ES", "fr-FR", "de-DE", "it-IT"]) {
      expect(page).toContain(`"${language}":`);
    }
    expect(page).toContain("const copy = SPOTIFY_COPY[language]");
  });

  it("nao expoe controles Spotify no overlay in-game para manter a experiencia gamer focada", () => {
    const overlay = source("electron/overlay.html");
    expect(overlay).not.toContain('data-panel-tab="spotify"');
    expect(overlay).not.toContain('data-panel-view="spotify"');
  });

  it("protege o tema do launcher durante toda reproducao Spotify", () => {
    const app = source("src/App.tsx");
    expect(app).toContain("spotifyPlayingRef.current");
    expect(app.match(/if \(spotifyPlayingRef\.current\) return/g)?.length).toBeGreaterThanOrEqual(2);
  });

  it("suporta imageUrl na notificacao compacta do launcher", () => {
    const notifications = source("src/components/NotificationCenter.tsx");
    expect(notifications).toContain("imageUrl: options?.imageUrl");
  });
});
