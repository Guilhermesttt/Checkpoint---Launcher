// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/services/supabase", () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { access_token: "session-token" } },
      }),
    },
  },
}));

describe("RetroAchievements renderer service", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("links a username through the authenticated launcher backend", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(
      JSON.stringify({
        identity: {
          ulid: "00003EMFWR7XB8SDPEHB3K56ZQ",
          username: "MaxMilyin",
          totalPoints: 399597,
        },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    ));
    const { linkRetroAchievements } = await import(
      "../src/services/retroAchievements"
    );

    const identity = await linkRetroAchievements(" MaxMilyin ");

    expect(identity.ulid).toBe("00003EMFWR7XB8SDPEHB3K56ZQ");
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/retroachievements/link"),
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer session-token",
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({ username: "MaxMilyin" }),
      }),
    );
    expect(JSON.stringify(fetchMock.mock.calls)).not.toContain(
      "RETROACHIEVEMENTS_API_KEY",
    );
  });

  it("surfaces the safe backend error message", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(
      JSON.stringify({
        error: "Usuário da RetroAchievements não encontrado.",
        code: "RA_INVALID_USERNAME",
      }),
      { status: 404, headers: { "Content-Type": "application/json" } },
    ));
    const { linkRetroAchievements } = await import(
      "../src/services/retroAchievements"
    );

    await expect(linkRetroAchievements("missing-user")).rejects.toThrow(
      "Usuário da RetroAchievements não encontrado.",
    );
  });
});
