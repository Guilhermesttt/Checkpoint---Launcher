import { describe, expect, it, vi } from "vitest";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { createTheGamesDbClient } = require("../electron/thegamesdb.cjs");

describe("TheGamesDB client", () => {
  it("normalizes metadata and separate front/back box art", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: { games: [{ id: 10, game_title: "Metal Gear Solid", release_date: "1998-09-03", overview: "Tactical espionage action.", publishers: ["Konami"], developers: ["Konami Computer Entertainment Japan"], platform: 10 }] },
        include: {
          platform: { data: { 10: { name: "Sony Playstation" } } },
          boxart: {
            base_url: { original: "https://cdn.thegamesdb.net/images/original/" },
            data: { 10: [
              { type: "boxart", side: "front", filename: "boxart/front/10-1.jpg" },
              { type: "boxart", side: "back", filename: "boxart/back/10-1.jpg" },
            ] },
          },
        },
      }),
    });

    const client = createTheGamesDbClient({ apiKey: "test-key", fetchImpl });
    const matches = await client.searchGamesByName({ name: "Metal Gear Solid" });

    expect(matches[0]).toEqual(expect.objectContaining({
      id: 10,
      title: "Metal Gear Solid",
      year: 1998,
      description: "Tactical espionage action.",
      publisher: "Konami",
      developer: "Konami Computer Entertainment Japan",
      platform: "Sony Playstation",
      frontImage: "https://cdn.thegamesdb.net/images/original/boxart/front/10-1.jpg",
      backImage: "https://cdn.thegamesdb.net/images/original/boxart/back/10-1.jpg",
    }));
    expect(matches[0].images).toHaveLength(2);
    expect(fetchImpl.mock.calls[0][0]).toContain("include=boxart%2Cplatform");
  });

  it("requires an API key", async () => {
    const client = createTheGamesDbClient({ apiKey: "", fetchImpl: vi.fn() });
    await expect(client.searchGamesByName({ name: "Crash" })).rejects.toThrow("THEGAMESDB_API_KEY");
  });
});
