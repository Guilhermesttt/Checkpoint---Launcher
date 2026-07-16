import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getIdToken: vi.fn(),
  fetch: vi.fn(),
  auth: {
    currentUser: {
      uid: "user-1",
      getIdToken: vi.fn(),
    },
  },
}));

vi.mock("../Firebase", () => ({
  auth: mocks.auth,
  db: {},
}));

vi.mock("firebase/firestore", () => ({
  collection: vi.fn(),
  limit: vi.fn(),
  onSnapshot: vi.fn(),
  orderBy: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
}));

vi.mock("../src/services/api", () => ({
  apiUrl: (path: string) => `https://backend.example${path}`,
}));

import { publishSocialActivity } from "../src/services/socialActivity";

describe("publicação de atividade social", () => {
  beforeEach(() => {
    mocks.auth.currentUser.getIdToken.mockResolvedValue("firebase-token");
    mocks.fetch.mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
    vi.stubGlobal("fetch", mocks.fetch);
  });

  it("envia apenas o conteúdo do evento e deixa identidade, audiência e horário para o backend", async () => {
    await publishSocialActivity(
      "user-1",
      {
        uid: "user-1",
        displayName: "Nome controlado pelo cliente",
        checkpointFriends: [{ uid: "friend-1", displayName: "Friend" }],
      },
      {
        kind: "achievement",
        gameId: "portal-2",
        gameTitle: "Portal 2",
        achievementId: "FIRST_PORTAL",
        achievementName: "Primeiro portal",
        dedupeKey: "valor-controlado-pelo-cliente",
      },
    );

    expect(mocks.fetch).toHaveBeenCalledOnce();
    const [url, init] = mocks.fetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://backend.example/api/social/activity");
    expect(init.headers).toEqual({
      Authorization: "Bearer firebase-token",
      "Content-Type": "application/json",
    });
    expect(JSON.parse(String(init.body))).toEqual({
      kind: "achievement",
      gameId: "portal-2",
      gameTitle: "Portal 2",
      achievementId: "FIRST_PORTAL",
      achievementName: "Primeiro portal",
    });
  });

  it("recusa publicar em nome de outra sessão", async () => {
    await expect(publishSocialActivity(
      "outro-user",
      null,
      { kind: "game-start", gameId: "portal", gameTitle: "Portal" },
    )).rejects.toThrow(/sessão/i);
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
});
