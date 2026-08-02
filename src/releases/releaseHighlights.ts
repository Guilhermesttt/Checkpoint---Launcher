export interface ReleaseHighlight {
  id: "spotify" | "controller" | "stability";
  title: string;
  description: string;
}

export interface ReleaseHighlights {
  version: string;
  title: string;
  description: string;
  releaseUrl: string;
  highlights: ReleaseHighlight[];
}

export const LATEST_RELEASE: ReleaseHighlights = {
  version: "3.0.5",
  title: "Uma nova fase do Checkpoint",
  description: "Música, controle e uma experiência mais fluida dentro e fora dos seus jogos.",
  releaseUrl: "https://github.com/Guilhermesttt/Checkpoint---Launcher/releases/tag/v3.0.5",
  highlights: [
    {
      id: "spotify",
      title: "Spotify dentro do launcher",
      description: "Player redesenhado, busca instantânea, playlists, fila inteligente e sessões Jam.",
    },
    {
      id: "controller",
      title: "Controle também no jogo",
      description: "Navegue pelo overlay, troque de aba e controle suas faixas sem sair da partida.",
    },
    {
      id: "stability",
      title: "Perfis e estabilidade",
      description: "Melhor organização visual e correções importantes no Spotify, inputs e notificações.",
    },
  ],
};

const releasesByVersion = new Map([[LATEST_RELEASE.version, LATEST_RELEASE]]);

export const getReleaseHighlights = (version: string) =>
  releasesByVersion.get(String(version || "").trim()) ?? null;
