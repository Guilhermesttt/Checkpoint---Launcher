import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const addGameModal = readFileSync("src/components/AddGameModal.tsx", "utf8");
const sidebar = readFileSync("src/components/Sidebar.tsx", "utf8");

describe("official platform brand icons", () => {
  it("uses the SteamBrandIcon in the add-game platform selector", () => {
    expect(addGameModal).toContain("SteamBrandIcon");
    expect(addGameModal).not.toContain("label: copy.steam, icon: () => <Globe");
  });

  it("uses the Font Awesome Spotify icon component", () => {
    expect(sidebar).toContain("faSpotify");
    expect(sidebar).toContain("export const SpotifyBrandIcon");
  });
});
