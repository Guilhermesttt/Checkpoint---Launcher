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
  version: "3.1.3",
  title: "Áudio WebRTC Instantâneo, Barramento U2U e Overlays",
  description: "Reprodução automática de áudio WebRTC em DOM nativo, barramento WebSocket U2U em tempo real, edição de canais de voz e overlays reativos instantâneos.",
  releaseUrl: "https://github.com/Guilhermesttt/Checkpoint---Launcher/releases/tag/v3.1.3",
  highlights: [
    {
      id: "voice",
      title: "Áudio WebRTC Sem Latência",
      description: "Captura ontrack e reprodução automática imediata via DOM AutoPlay e Soft Limiter profissional.",
    },
    {
      id: "stability",
      title: "Barramento Global U2U em Tempo Real",
      description: "Status de amigos (Jogando/Online), mensagens diretas e convites trafegam por via rápida WebSocket (<50ms).",
    },
    {
      id: "platforms",
      title: "Edição de Canais & Overlays Reativos",
      description: "Personalização de canais criados (tema, nome, ícone), simulador de chamadas e pop-ups instantâneos.",
    },
  ],
};

const releasesByVersion = new Map([[LATEST_RELEASE.version, LATEST_RELEASE]]);

export const getReleaseHighlights = (version: string) =>
  releasesByVersion.get(String(version || "").trim()) ?? null;
