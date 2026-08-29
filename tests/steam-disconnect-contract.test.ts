import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("steam-disconnect-contract", () => {
  const serverSource = fs.readFileSync(path.resolve("server/index.mjs"), "utf8");

  it("clears steam_id, steam_username, steam_avatar and last_steam_sync_at on disconnect", () => {
    expect(serverSource).toContain('app.post("/api/steam/disconnect"');
    expect(serverSource).toContain("steam_id: null");
    expect(serverSource).toContain("steam_username: null");
    expect(serverSource).toContain("steam_avatar: null");
    expect(serverSource).toContain("last_steam_sync_at: null");
  });
});
