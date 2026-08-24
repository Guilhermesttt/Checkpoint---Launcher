export interface ReleaseHighlight {
  id: "spotify" | "controller" | "stability" | "platforms" | "search" | "mods" | "voice";
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
  version: "3.2.0",
  title: "Modernização Visual, Performance GPU & Otimização de Assets",
  description: "Redução de bundle com remoção de dependências pesadas, GameCard com aceleração pura por hardware, navegação fluida por controle e estabilidade aprimorada.",
  releaseUrl: "https://github.com/Guilhermesttt/Checkpoint---Launcher/releases/tag/v3.2.0",
  highlights: [
    {
      id: "stability",
      title: "Performance & GPU Acceleration",
      description: "Transições 3D suaves aceleradas por hardware e remoção de overhead para inicialização ultra-rápida.",
    },
    {
      id: "controller",
      title: "Navegação Fluida por Controle",
      description: "Suporte completo e responsivo a gamepads e teclados em toda a interface e overlays.",
    },
    {
      id: "voice",
      title: "Áudio WebRTC Sem Latência",
      description: "Comunicação em tempo real de alta fidelidade com proteção de áudio e barramento U2U instantâneo.",
    },
  ],
};

const releasesByVersion = new Map([[LATEST_RELEASE.version, LATEST_RELEASE]]);

export const getReleaseHighlights = (version: string) =>
  releasesByVersion.get(String(version || "").trim()) ?? null;
