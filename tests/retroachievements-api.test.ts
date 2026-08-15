// @vitest-environment node

import { createRequire } from "node:module";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";

const express: any = createRequire(import.meta.url)("express");

async function createTestApp(options: {
  fetchImpl: typeof fetch;
  loadProfile?: (uid: string) => Promise<Record<string, unknown> | null>;
  saveProfile?: (uid: string, patch: Record<string, unknown>) => Promise<void>;
}) {
  const { createRetroAchievementsRouter } = await import(
    "../server/retroachievements.mjs"
  );
  const app = express();
  app.use(express.json());
  app.use("/api/retroachievements", createRetroAchievementsRouter({
    apiKey: "server-secret",
    fetchImpl: options.fetchImpl,
    requireUser: (req: any, _res: any, next: () => void) => {
      req.firebaseUser = { uid: "user-1" };
      next();
    },
    loadProfile: options.loadProfile ?? (async () => ({
      retroachievements_ulid: "00003EMFWR7XB8SDPEHB3K56ZQ",
      retroachievements_username: "MaxMilyin",
    })),
    saveProfile: options.saveProfile ?? (async () => undefined),
    now: () => 1_723_307_200_000,
  }));
  return app;
}

const jsonResponse = (payload: unknown, status = 200) => new Response(
  JSON.stringify(payload),
  { status, headers: { "Content-Type": "application/json" } },
);

describe("RetroAchievements backend router", () => {
  it("resolves a mutable username to a stable ULID before saving it", async () => {
    const saveProfile = vi.fn().mockResolvedValue(undefined);
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({
      User: "MaxMilyin",
      ULID: "00003EMFWR7XB8SDPEHB3K56ZQ",
      UserPic: "/UserPic/MaxMilyin.png",
      TotalPoints: 399597,
    }));
    const app = await createTestApp({ fetchImpl, saveProfile });

    const response = await request(app)
      .post("/api/retroachievements/link")
      .send({ username: " MaxMilyin " })
      .expect(200);

    expect(saveProfile).toHaveBeenCalledWith("user-1", {
      retroachievements_ulid: "00003EMFWR7XB8SDPEHB3K56ZQ",
      retroachievements_username: "MaxMilyin",
    });
    expect(response.body.identity).toEqual(expect.objectContaining({
      ulid: "00003EMFWR7XB8SDPEHB3K56ZQ",
      username: "MaxMilyin",
      totalPoints: 399597,
    }));
    expect(String(fetchImpl.mock.calls[0][0])).toContain(
      "API_GetUserProfile.php",
    );
    expect(String(fetchImpl.mock.calls[0][0])).toContain("y=server-secret");
    expect(JSON.stringify(response.body)).not.toContain("server-secret");
  });

  it("searches the achievement game list by resolved console and caches both lists", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("API_GetConsoleIDs.php")) {
        return jsonResponse([
          { ID: 21, Name: "PlayStation 2", Active: true, IsGameSystem: true },
        ]);
      }
      if (url.includes("API_GetGameList.php")) {
        return jsonResponse([
          {
            ID: 2782,
            Title: "God of War",
            ConsoleID: 21,
            ConsoleName: "PlayStation 2",
            ImageIcon: "/Images/000001.png",
            NumAchievements: 43,
            Points: 317,
          },
          {
            ID: 123,
            Title: "God of War II",
            ConsoleID: 21,
            ConsoleName: "PlayStation 2",
            ImageIcon: "/Images/000002.png",
            NumAchievements: 50,
            Points: 400,
          },
        ]);
      }
      throw new Error(`Unexpected URL: ${url}`);
    });
    const app = await createTestApp({ fetchImpl: fetchImpl as typeof fetch });

    const first = await request(app)
      .get("/api/retroachievements/games/search")
      .query({ title: "God of War", console: "PS2" })
      .expect(200);
    const second = await request(app)
      .get("/api/retroachievements/games/search")
      .query({ title: "God of War", console: "PlayStation 2" })
      .expect(200);

    expect(first.body.results[0]).toEqual(expect.objectContaining({
      id: 2782,
      title: "God of War",
      consoleName: "PlayStation 2",
      imageUrl: "https://media.retroachievements.org/Images/000001.png",
    }));
    expect(second.body.results).toEqual(first.body.results);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("normalizes personal normal and hardcore achievement progress", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({
      ID: 2782,
      Title: "God of War",
      ConsoleName: "PlayStation 2",
      ImageIcon: "/Images/000001.png",
      NumAchievements: 2,
      Achievements: {
        "9": {
          ID: 9,
          Title: "Poseidon's Rage",
          Description: "Acquire Poseidon's Rage.",
          Points: 2,
          BadgeName: "250336",
          DisplayOrder: 1,
          DateEarned: "2026-08-01 12:00:00",
          DateEarnedHardcore: "2026-08-01 12:00:00",
        },
        "10": {
          ID: 10,
          Title: "Cursed Capital",
          Description: "Reach Athens.",
          Points: 2,
          BadgeName: "250337",
          DisplayOrder: 2,
        },
      },
      NumAwardedToUser: 1,
      NumAwardedToUserHardcore: 1,
      UserCompletion: "50.00%",
      UserCompletionHardcore: "50.00%",
      UserTotalPlaytime: 3600,
      HighestAwardKind: "mastered",
      HighestAwardDate: "2026-08-01T12:00:00+00:00",
    }));
    const app = await createTestApp({ fetchImpl });

    const response = await request(app)
      .get("/api/retroachievements/games/2782/progress")
      .expect(200);

    expect(response.body.summary).toEqual(expect.objectContaining({
      total: 2,
      normalUnlocked: 1,
      hardcoreUnlocked: 1,
      normalPercent: 50,
      hardcorePercent: 50,
      highestAwardKind: "mastered",
    }));
    expect(response.body.achievements).toEqual([
      expect.objectContaining({
        id: 9,
        unlocked: true,
        unlockedHardcore: true,
        badgeUrl: "https://media.retroachievements.org/Badge/250336.png",
      }),
      expect.objectContaining({ id: 10, unlocked: false, unlockedHardcore: false }),
    ]);
    expect(String(fetchImpl.mock.calls[0][0])).toContain(
      "u=MaxMilyin",
    );
  });

  it("returns a stable safe error without leaking the upstream credential", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(
      new Error("https://retroachievements.org/API/failure?y=server-secret"),
    );
    const app = await createTestApp({ fetchImpl });

    const response = await request(app)
      .post("/api/retroachievements/link")
      .send({ username: "MaxMilyin" })
      .expect(502);

    expect(response.body).toEqual({
      error: "RetroAchievements indisponível no momento.",
      code: "RA_UPSTREAM_UNAVAILABLE",
    });
    expect(JSON.stringify(response.body)).not.toContain("server-secret");
  });
});
