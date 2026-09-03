export interface ReleaseHighlight {
  id: "controller" | "stability" | "platforms" | "search" | "mods" | "voice";
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
  version: "3.2.4",
  title: "Telemetria de Controle, Voz Ultrarrápida & Galeria In-Game",
  description: "Detecção nativa de bateria e conexão USB/Bluetooth para DualSense, DS4 e Xbox, conexões de voz instantâneas com LiveKit Cloud e seleção aprimorada de fotos por controle.",
  releaseUrl: "https://github.com/Guilhermesttt/Checkpoint---Launcher/releases/tag/v3.2.4",
  highlights: [
    {
      id: "controller",
      title: "Telemetria & Bateria Precisa do Controle",
      description: "Leitura nativa precisa de bateria e detecção determinística de cabo USB vs Bluetooth para PlayStation DualSense (PS5), DualShock 4 e Xbox.",
    },
    {
      id: "voice",
      title: "Chamadas de Voz com Conexão Instantânea",
      description: "Conexão ultrarrápida via LiveKit Cloud SFU e WebRTC Trickle ICE paralelo com CSP otimizado, sem atrasos no estabelecimento da chamada.",
    },
    {
      id: "stability",
      title: "Galeria & Seleção de Fotos no Controle",
      description: "Navegação espacial por D-Pad no overlay in-game e no painel de detalhes do jogo, visualizador em tela cheia e atalho no botão Quadrado/X para exclusão rápida.",
    },
  ],
};

const releasesByVersion = new Map([
  [LATEST_RELEASE.version, LATEST_RELEASE],
  ["3.2.3", LATEST_RELEASE],
  ["3.2.2", LATEST_RELEASE],
  ["3.2.1", LATEST_RELEASE],
  ["3.2.0", LATEST_RELEASE],
]);

export const getReleaseHighlights = (version: string) =>
  releasesByVersion.get(String(version || "").trim()) ?? LATEST_RELEASE;
