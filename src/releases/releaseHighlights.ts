export interface ReleaseHighlight {
  id: "spotify" | "controller" | "stability" | "platforms" | "search";
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
  version: "3.0.7",
  title: "Mais opções, mais liberdade",
  description: "Novas plataformas suportadas e ferramentas de busca de metadados aprimoradas para organizar sua biblioteca.",
  releaseUrl: "https://github.com/Guilhermesttt/Checkpoint---Launcher/releases/tag/v3.0.7",
  highlights: [
    {
      id: "platforms",
      title: "Novas Plataformas Suportadas",
      description: "Agora você pode adicionar e organizar jogos da Riot Games, Battle.net, Rockstar, GOG, EA App e Ubisoft.",
    },
    {
      id: "search",
      title: "Busca Inteligente de Metadados",
      description: "Escolha entre as bases de dados da Steam e Epic Games para encontrar as melhores capas e informações.",
    },
    {
      id: "stability",
      title: "Melhorias e Ajustes",
      description: "Aprimoramentos visuais na tela inicial e correções gerais de usabilidade no sistema de biblioteca.",
    },
  ],
};

const releasesByVersion = new Map([[LATEST_RELEASE.version, LATEST_RELEASE]]);

export const getReleaseHighlights = (version: string) =>
  releasesByVersion.get(String(version || "").trim()) ?? null;
