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
  version: "3.1.0",
  title: "Chamadas de Voz e Transmissão de Tela",
  description: "Sistema completo de chamadas de voz e vídeo peer-to-peer, transmissão de tela com áudio integrado, retorno de microfone e detecção inteligente de hardware.",
  releaseUrl: "https://github.com/Guilhermesttt/Checkpoint---Launcher/releases/tag/v3.1.0",
  highlights: [
    {
      id: "voice",
      title: "Chamadas de Voz e Vídeo WebRTC",
      description: "Converse com seus amigos em tempo real com baixa latência, cancelamento de eco, supressão de ruído e interface limpa estilo Discord.",
    },
    {
      id: "platforms",
      title: "Transmissão de Tela com Áudio",
      description: "Compartilhe janelas ou sua tela inteira com áudio direto do jogo isolado e sem feedback acústico.",
    },
    {
      id: "stability",
      title: "Retorno de Microfone e Detecção de Dispositivos",
      description: "Monitore sua voz em tempo real e alterne facilmente entre fones e microfones detectados automaticamente pelo launcher.",
    },
  ],
};

const releasesByVersion = new Map([[LATEST_RELEASE.version, LATEST_RELEASE]]);

export const getReleaseHighlights = (version: string) =>
  releasesByVersion.get(String(version || "").trim()) ?? null;
