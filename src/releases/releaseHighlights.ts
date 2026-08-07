export interface ReleaseHighlight {
  id: "spotify" | "controller" | "stability" | "platforms" | "search" | "mods";
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
  version: "3.0.8",
  title: "Gestão Avançada de Mods e Social",
  description: "Novo detector de conflitos de mods, perfis customizados, melhorias na atualização do app e central de amigos aprimorada.",
  releaseUrl: "https://github.com/Guilhermesttt/Checkpoint---Launcher/releases/tag/v3.0.8",
  highlights: [
    {
      id: "mods",
      title: "Detector de Conflitos e Perfis de Mods",
      description: "Gerencie perfis de modding e detecte automaticamente conflitos entre mods instalados.",
    },
    {
      id: "stability",
      title: "Atualizações Mais Confiáveis",
      description: "Novo sistema de tratamento de erros e relatórios claros no processo de atualização do launcher.",
    },
    {
      id: "search",
      title: "Navegação e Social Aprimorados",
      description: "Navegação em breadcrumbs interativa, melhorias na aba de amigos e na exibição dos detalhes de jogos.",
    },
  ],
};

const releasesByVersion = new Map([[LATEST_RELEASE.version, LATEST_RELEASE]]);

export const getReleaseHighlights = (version: string) =>
  releasesByVersion.get(String(version || "").trim()) ?? null;
