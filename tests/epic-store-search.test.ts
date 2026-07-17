import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const {
  EPIC_STORE_CARD_EXTRACTOR,
  EPIC_STORE_GRAPHQL_QUERY,
  normalizeEpicGraphqlElements,
  normalizeEpicStoreDetails,
  normalizeEpicStoreCards,
} = require("../electron/epic-store-search.cjs") as {
  EPIC_STORE_CARD_EXTRACTOR: string;
  EPIC_STORE_GRAPHQL_QUERY: string;
  normalizeEpicGraphqlElements: (
    elements: Array<Record<string, unknown>>,
    installed?: Array<Record<string, unknown>>,
  ) => Array<Record<string, unknown>>;
  normalizeEpicStoreDetails: (
    payload: Record<string, unknown>,
    requested: Record<string, unknown>,
    installed?: Array<Record<string, unknown>>,
  ) => Record<string, unknown> | null;
  normalizeEpicStoreCards: (
    cards: Array<Record<string, unknown>>,
    installed?: Array<Record<string, unknown>>,
  ) => Array<Record<string, unknown>>;
};

describe("busca da Epic Games Store no Electron", () => {
  it("normaliza somente cards oficiais da loja Epic", () => {
    const results = normalizeEpicStoreCards([
      {
        name: "Fortnite",
        category: "Jogo base",
        price: "Gratuito",
        image: "https://cdn1.epicgames.com/offer/fn/cover",
        productUrl: "https://store.epicgames.com/pt-BR/p/fortnite?lang=pt-BR",
      },
      {
        name: "Resultado externo",
        productUrl: "https://store.steampowered.com/app/123",
      },
    ]);

    expect(results).toEqual([expect.objectContaining({
      id: "epic-store:fortnite",
      name: "Fortnite",
      productSlug: "fortnite",
      productUrl: "https://store.epicgames.com/p/fortnite",
      source: "epic-store",
    })]);
  });

  it("complementa o card da loja com o ID local quando o jogo esta instalado", () => {
    const results = normalizeEpicStoreCards([{
      name: "Grand Theft Auto V Enhanced",
      productUrl: "https://store.epicgames.com/p/grand-theft-auto-v",
    }], [{
      name: "Grand Theft Auto V Enhanced",
      catalogId: "catalog",
      namespace: "namespace",
      appName: "artifact",
      epicLaunchId: "namespace:catalog:artifact",
      executablePath: "D:\\Epic\\GTAV\\GTA5_Enhanced.exe",
    }]);

    expect(results[0]).toMatchObject({
      installed: true,
      catalogId: "catalog",
      namespace: "namespace",
      epicLaunchId: "namespace:catalog:artifact",
      executablePath: "D:\\Epic\\GTAV\\GTA5_Enhanced.exe",
    });
  });

  it("preserva IDs e artes retornados pelo GraphQL oficial", () => {
    const results = normalizeEpicGraphqlElements([{
      id: "catalog",
      namespace: "rocket",
      title: "Rocket League®",
      productSlug: "rocket-league",
      keyImages: [
        { type: "OfferImageTall", url: "https://cdn1.epicgames.com/tall" },
        { type: "OfferImageWide", url: "https://cdn1.epicgames.com/wide" },
      ],
    }], [{
      name: "Rocket League",
      appName: "Sugar",
      epicLaunchId: "rocket:catalog:Sugar",
      executablePath: "D:\\Epic\\RocketLeague.exe",
    }]);

    expect(results[0]).toMatchObject({
      id: "catalog",
      catalogId: "catalog",
      namespace: "rocket",
      cardImage: "https://cdn1.epicgames.com/tall",
      backgroundImage: "https://cdn1.epicgames.com/wide",
      epicLaunchId: "rocket:catalog:Sugar",
      installed: true,
    });
    expect(EPIC_STORE_GRAPHQL_QUERY).toContain("searchStore");
  });

  it("extrai os links /p/ e as imagens renderizadas pelo site", () => {
    expect(EPIC_STORE_CARD_EXTRACTOR).toContain("store.epicgames.com");
    expect(EPIC_STORE_CARD_EXTRACTOR).toContain('a[href*="/p/"]');
    expect(EPIC_STORE_CARD_EXTRACTOR).toContain("currentSrc");
  });

  it("preenche mural, descricao e ficha tecnica somente com dados Epic", () => {
    const details = normalizeEpicStoreDetails({
      productName: "Jogo Epic",
      pages: [{
        _title: "home",
        namespace: "namespace",
        offer: { id: "catalog", namespace: "namespace" },
        data: {
          navTitle: "Jogo Epic",
          about: {
            title: "Jogo Epic",
            shortDescription: "Descricao curta oficial.",
            description: "Descricao completa.\n\n![Cena](https://cdn2.unrealengine.com/cena.jpg)",
            developerAttribution: "Epic Developer",
            publisherAttribution: "Epic Publisher",
            image: { src: "https://cdn2.unrealengine.com/cover.jpg" },
          },
          hero: {
            portraitBackgroundImageUrl: "https://cdn2.unrealengine.com/cover.jpg",
            backgroundImageUrl: "https://cdn2.unrealengine.com/hero.jpg",
            logoImage: { src: "https://cdn2.unrealengine.com/logo.png" },
          },
          meta: {
            releaseDate: "2026-07-17T00:00:00.000Z",
            developer: ["Epic Developer"],
            publisher: ["Epic Publisher"],
            tags: ["ACTION", "MULTIPLAYER"],
          },
          carousel: {
            items: [{
              image: { src: "https://cdn2.unrealengine.com/screenshot.jpg" },
              video: {
                recipes: JSON.stringify({
                  output: ["https://epic-games-store-cdn.qstv.on.epicgames.com/trailer.mp4"],
                }),
              },
            }],
          },
        },
      }],
    }, {
      catalogId: "catalog",
      namespace: "namespace",
      productSlug: "jogo-epic",
    });

    expect(details).toMatchObject({
      catalogId: "catalog",
      namespace: "namespace",
      title: "Jogo Epic",
      cardImage: "https://cdn2.unrealengine.com/cover.jpg",
      backgroundImage: "https://cdn2.unrealengine.com/hero.jpg",
      logoImage: "https://cdn2.unrealengine.com/logo.png",
      description: "Descricao curta oficial.",
      developer: "Epic Developer",
      publisher: "Epic Publisher",
      releaseDate: "17/07/2026",
      tags: ["ACTION", "MULTIPLAYER"],
      trailerUrl: "https://epic-games-store-cdn.qstv.on.epicgames.com/trailer.mp4",
      productUrl: "https://store.epicgames.com/p/jogo-epic",
    });
    expect(details?.screenshots).toEqual([
      "https://cdn2.unrealengine.com/screenshot.jpg",
      "https://cdn2.unrealengine.com/cena.jpg",
    ]);
    expect(String(details?.aboutTheGame)).toContain("<p>Descricao completa.</p>");
    expect(String(details?.aboutTheGame)).not.toContain("cena.jpg");
  });
});
