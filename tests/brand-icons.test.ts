import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const addGameModal = readFileSync("src/components/AddGameModal.tsx", "utf8");
const sidebar = readFileSync("src/components/Sidebar.tsx", "utf8");

describe("official platform brand icons", () => {
  it("uses the Font Awesome Steam icon in the add-game platform selector", () => {
    expect(addGameModal).toContain('import { faSteam } from "@fortawesome/free-brands-svg-icons"');
    expect(addGameModal).toContain('icon: () => <FontAwesomeIcon icon={faSteam} className="h-[17px] w-[17px]" />');
    expect(addGameModal).not.toContain("label: copy.steam, icon: () => <Globe");
  });

  it("uses the Font Awesome Spotify icon in the sidebar", () => {
    expect(sidebar).toContain("faSpotify");
    expect(sidebar).toContain("export const SpotifyBrandIcon");
    expect(sidebar).toContain('{ id: "SPOTIFY", label: "Spotify", Icon: SpotifyBrandIcon }');
    expect(sidebar).not.toContain('{ id: "SPOTIFY", label: "Spotify", Icon: Music2 }');
  });
});
