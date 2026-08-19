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
  version: "3.1.1",
  title: "Processamento de Áudio com IA e Ganho Real",
  description: "Supressão de ruído avançada por rede neural (RNNoise WASM), amplificação real de ganho via Web Audio, foco em câmera e notificações globais de chat.",
  releaseUrl: "https://github.com/Guilhermesttt/Checkpoint---Launcher/releases/tag/v3.1.1",
  highlights: [
    {
      id: "voice",
      title: "Supressão de Ruído por IA (RNNoise)",
      description: "Filtre ruídos de teclado mecânico, ventiladores e ambiente com processamento neural em tempo real.",
    },
    {
      id: "stability",
      title: "Ganho Real de Microfone (0–200%)",
      description: "Amplificação de volume transmitida diretamente para a chamada com compressor anti-clipping integrado.",
    },
    {
      id: "platforms",
      title: "Notificações de Chat e Foco em Câmera",
      description: "Notificações instantâneas de novas mensagens e visualização da câmera em tela cheia no modo focado.",
    },
  ],
};

const releasesByVersion = new Map([[LATEST_RELEASE.version, LATEST_RELEASE]]);

export const getReleaseHighlights = (version: string) =>
  releasesByVersion.get(String(version || "").trim()) ?? null;
