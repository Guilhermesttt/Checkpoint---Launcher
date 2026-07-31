import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import {
  app,
  buildEpicDetails,
  normalizeFriendAchievementAggregate,
  normalizeNexusTrendingMods,
  normalizeSocialActivityInput,
  normalizeSteamPlayerProfile,
  partitionOwnedSteamAppIds,
  projectFriendGame,
  resolveChatRetentionDays,
  resolveLinkedSteamId,
  revokeActivityAudience,
  writeActivityToFeeds,
} from "../server/index.mjs";

describe("API publica", () => {
  it("usa sete dias como retencao padrao do chat", () => {
    expect(resolveChatRetentionDays(undefined)).toBe(7);
    expect(resolveChatRetentionDays("7")).toBe(7);
    expect(resolveChatRetentionDays("30")).toBe(30);
    expect(resolveChatRetentionDays("0")).toBe(7);
    expect(resolveChatRetentionDays("invalido")).toBe(7);
  });

  it("responde ao health check com headers de seguranca", async () => {
    const response = await request(app).get("/health").expect(200);
    expect(response.body).toEqual({ ok: true });
    expect(response.headers["x-content-type-options"]).toBe("nosniff");
    expect(response.headers["x-frame-options"]).toBe("SAMEORIGIN");
  });

  it("recusa busca Steam curta sem chamar servicos externos", async () => {
    const response = await request(app).get("/api/steam/search?q=a").expect(400);
    expect(response.body.error).toMatch(/curta/i);
  });

  it("recusa parametros invalidos nas rotas de catalogo", async () => {
    await request(app).get("/api/steam/app-size?appId=abc").expect(400);
    await request(app).get("/api/epic/app-details").expect(400);
  });

  it("consulta e separa os detalhes da Steam pelo idioma selecionado", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({
        "987654": {
          success: true,
          data: {
            name: "Jeu localisé",
            short_description: "Description française",
            genres: [{ description: "Aventure" }],
          },
        },
      }), { status: 200, headers: { "Content-Type": "application/json" } }),
    );

    try {
      const response = await request(app)
        .get("/api/steam/app-details?appId=987654&language=fr-FR")
        .expect(200);

      expect(response.body.description).toBe("Description française");
      expect(response.body.tags).toContain("Aventure");
      expect(String(fetchMock.mock.calls[0]?.[0])).toContain("l=french");
      expect(String(fetchMock.mock.calls[0]?.[0])).toContain("cc=FR");
    } finally {
      fetchMock.mockRestore();
    }
  });

  it("nao mistura resultados de outra loja quando o GraphQL da Epic e bloqueado", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response("", { status: 403 }));
    try {
      const response = await request(app)
        .get("/api/epic/search?query=portal")
        .expect(502);

      expect(response.body.items).toBeUndefined();
      expect(response.body.error).toMatch(/Epic Games Store/i);
      expect(fetchMock).toHaveBeenCalledOnce();
    } finally {
      fetchMock.mockRestore();
    }
  });

  it("nao permite origem CORS desconhecida", async () => {
    const response = await request(app)
      .get("/health")
      .set("Origin", "https://evil.example")
      .expect(200);
    expect(response.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("aceita apenas campos sociais permitidos e URLs HTTPS", () => {
    expect(normalizeSocialActivityInput({
      kind: "achievement",
      gameId: "portal-2",
      gameTitle: "Portal 2",
      gameImage: "https://cdn.example.com/portal.jpg",
      achievementId: "FIRST_PORTAL",
      achievementName: "Primeiro portal",
      achievementIcon: "data:image/png;base64,AAAA",
      userId: "usuario-forjado",
      userName: "Administrador",
      audienceIds: ["vitima"],
      createdAt: "2999-01-01T00:00:00.000Z",
    })).toEqual({
      kind: "achievement",
      gameId: "portal-2",
      gameTitle: "Portal 2",
      gameImage: "https://cdn.example.com/portal.jpg",
      achievementId: "FIRST_PORTAL",
      achievementName: "Primeiro portal",
    });
  });

  it("rejeita atividades sociais incompletas", () => {
    expect(() => normalizeSocialActivityInput({ kind: "achievement" })).toThrow(/conquista/i);
    expect(() => normalizeSocialActivityInput({ kind: "admin-event" })).toThrow(/tipo/i);
  });

  it("deriva o Steam ID vinculado e usa a query apenas para validacao", () => {
    expect(resolveLinkedSteamId("76561198000000000", undefined)).toEqual({
      ok: true,
      steamId: "76561198000000000",
    });
    expect(resolveLinkedSteamId("76561198000000000", "76561198000000000").ok).toBe(true);
    expect(resolveLinkedSteamId("76561198000000000", "123")).toMatchObject({
      ok: false,
      status: 403,
    });
    expect(resolveLinkedSteamId("", undefined)).toMatchObject({ ok: false, status: 409 });
  });

  it("normaliza nome e avatar retornados pelo perfil Steam", () => {
    expect(normalizeSteamPlayerProfile("76561198000000000", {
      response: {
        players: [{
          steamid: "76561198000000000",
          personaname: "Checkpoint Player",
          avatarfull: "http://avatars.steamstatic.com/avatar.jpg",
        }],
      },
    })).toEqual({
      steam_id: "76561198000000000",
      steam_username: "Checkpoint Player",
      steam_avatar: "https://avatars.steamstatic.com/avatar.jpg",
    });

    expect(normalizeSteamPlayerProfile("76561198000000000", {
      response: { players: [] },
    })).toBeNull();
  });

  it("normaliza o feed público de mods da Nexus sem aceitar URLs inseguras", () => {
    expect(normalizeNexusTrendingMods({
      data: {
        mods: [{
          name: "Unofficial Patch",
          author: "Mod Author",
          summary: "Corrige problemas do jogo.",
          picture_url: "https://staticdelivery.nexusmods.com/mod.jpg",
          mod_page_url: "https://www.nexusmods.com/skyrimspecialedition/mods/1",
        }, {
          name: "URL inválida",
          mod_page_url: "https://example.com/mods/2",
        }],
      },
    })).toEqual([{
      id: "https://www.nexusmods.com/skyrimspecialedition/mods/1",
      name: "Unofficial Patch",
      author: "Mod Author",
      summary: "Corrige problemas do jogo.",
      pictureUrl: "https://staticdelivery.nexusmods.com/mod.jpg",
      modPageUrl: "https://www.nexusmods.com/skyrimspecialedition/mods/1",
    }]);
  });

  it("processa no resumo apenas jogos presentes na biblioteca vinculada", () => {
    expect(partitionOwnedSteamAppIds(
      ["10", "20", "20", "30"],
      new Set(["10", "30"]),
    )).toEqual({
      allowedAppIds: ["10", "30"],
      rejectedAppIds: ["20"],
    });
  });

  it("projeta jogos de amigos sem carregar data URLs", () => {
    const game = projectFriendGame("game-1", {
      title: "Portal 2",
      launcherType: "steam",
      steamAppId: "620",
      image: "data:image/png;base64,AAAA",
      cardImage: "data:image/png;base64,BBBB",
      completedAchievements: 12,
      totalAchievements: 10,
    });
    expect(JSON.stringify(game)).not.toContain("data:image");
    expect(game.cardImage).toContain("/620/");
    expect(game).toMatchObject({ completedAchievements: 12, totalAchievements: 12 });
    expect(normalizeFriendAchievementAggregate({
      totalGames: 80,
      unlocked: 25,
      available: 20,
    }, 4)).toEqual({
      totalGames: 80,
      unlocked: 25,
      available: 25,
      gamesWithAchievements: 4,
    });
  });

  it("devolve o appName executavel informado pelo releaseInfo da Epic", () => {
    const details = buildEpicDetails("catalog-1", "namespace-1", {
      title: "Control",
      releaseInfo: [
        { platform: "Mac", appId: "ControlMac" },
        { platform: "Windows", appId: "Control" },
      ],
    });
    expect(details.appName).toBe("Control");
  });

  it("remove um ex-amigo da audiencia das atividades em lote", async () => {
    const update = vi.fn();
    const deleteFeedEntry = vi.fn();
    const commit = vi.fn().mockResolvedValue(undefined);
    const query = {
      where: vi.fn(),
      limit: vi.fn(),
      get: vi.fn()
        .mockResolvedValueOnce({
          empty: false,
          size: 2,
          docs: [
            { id: "activity-1", ref: "activity-1" },
            { id: "activity-2", ref: "activity-2" },
          ],
        })
        .mockResolvedValueOnce({ empty: true, size: 0, docs: [] }),
    };
    query.where.mockReturnValue(query);
    query.limit.mockReturnValue(query);
    const firestore = {
      collection: vi.fn().mockReturnValue(query),
      doc: vi.fn((path) => path),
      batch: vi.fn(() => ({ update, delete: deleteFeedEntry, commit })),
    };

    await expect(revokeActivityAudience(firestore, "alice", "bob")).resolves.toBe(2);
    expect(query.where).toHaveBeenNthCalledWith(1, "userId", "==", "alice");
    expect(query.where).toHaveBeenNthCalledWith(2, "audienceIds", "array-contains", "bob");
    expect(update).toHaveBeenCalledTimes(2);
    expect(deleteFeedEntry).toHaveBeenCalledWith("feeds/bob/activities/activity-1");
    expect(deleteFeedEntry).toHaveBeenCalledWith("feeds/bob/activities/activity-2");
    expect(deleteFeedEntry).toHaveBeenCalledTimes(2);
    expect(commit).toHaveBeenCalledOnce();
  });

  it("distribui uma atividade somente para os feeds autorizados", async () => {
    const set = vi.fn();
    const commit = vi.fn().mockResolvedValue(undefined);
    const firestore = {
      doc: vi.fn((path) => path),
      batch: vi.fn(() => ({ set, commit })),
    };
    const payload = {
      userId: "alice",
      audienceIds: ["alice", "bob"],
      kind: "game-start",
      gameId: "portal-2",
      gameTitle: "Portal 2",
      createdAt: "2026-07-17T12:00:00.000Z",
    };

    await expect(writeActivityToFeeds(
      firestore,
      "activity-1",
      ["alice", "bob", "bob", ""],
      payload,
    )).resolves.toBe(2);
    expect(set).toHaveBeenCalledWith("feeds/alice/activities/activity-1", payload);
    expect(set).toHaveBeenCalledWith("feeds/bob/activities/activity-1", payload);
    expect(commit).toHaveBeenCalledOnce();
  });
});
