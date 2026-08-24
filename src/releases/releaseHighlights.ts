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
  version: "3.2.1",
  title: "Overlay Refinado, Correção de Dependências & Sons GameCube",
  description: "Correção de dependências no app.asar, ícone oficial no overlay Divirta-se, suporte a efeitos sonoros do GameCube e refinamentos de vídeo de fundo.",
  releaseUrl: "https://github.com/Guilhermesttt/Checkpoint---Launcher/releases/tag/v3.2.1",
  highlights: [
    {
      id: "stability",
      title: "Overlay & Identidade Visual",
      description: "Logo oficial Phelierium nos cards sociais de overlay e transparência aprimorada para vídeos de fundo.",
    },
    {
      id: "controller",
      title: "Mapeamento de Áudio GameCube",
      description: "Integração do efeito sonoro fly-out nas interações do tema GameCube e navegação fluida.",
    },
    {
      id: "voice",
      title: "Estabilidade & Pacote app.asar",
      description: "Inclusão do Zod nas dependências de produção para execução sem erros no bundle distribuído.",
    },
  ],
};

const releasesByVersion = new Map([
  [LATEST_RELEASE.version, LATEST_RELEASE],
  ["3.2.0", LATEST_RELEASE],
]);

export const getReleaseHighlights = (version: string) =>
  releasesByVersion.get(String(version || "").trim()) ?? LATEST_RELEASE;
