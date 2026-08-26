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
  version: "3.2.2",
  title: "Overlay Cósmico Glassmorphism & Performance 60 FPS",
  description: "Redesenho completo do overlay em vidro translúcido monocromático, otimizações de 60 FPS estilo console e novo pacote de efeitos sonoros Phelierium.",
  releaseUrl: "https://github.com/Guilhermesttt/Checkpoint---Launcher/releases/tag/v3.2.2",
  highlights: [
    {
      id: "stability",
      title: "Overlay Cósmico em Vidro Translúcido",
      description: "Design mono espacial com tipografia Space Grotesk + Inter, backdrop-filter de alta definição e visibilidade total do jogo.",
    },
    {
      id: "controller",
      title: "Fluidez 60 FPS Console-Grade",
      description: "Aceleração total por hardware (GPU) e isolamento de layout CSS Containment em todos os cards e listas da interface.",
    },
    {
      id: "voice",
      title: "Áudio & Efeitos Sonoros Phelierium",
      description: "Sons nativos de inicialização de jogo, mensagens no chat e desbloqueio de conquistas perfeitamente integrados.",
    },
  ],
};

const releasesByVersion = new Map([
  [LATEST_RELEASE.version, LATEST_RELEASE],
  ["3.2.1", LATEST_RELEASE],
  ["3.2.0", LATEST_RELEASE],
]);

export const getReleaseHighlights = (version: string) =>
  releasesByVersion.get(String(version || "").trim()) ?? LATEST_RELEASE;
