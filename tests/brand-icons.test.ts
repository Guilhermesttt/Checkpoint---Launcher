import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { resolveBackendUrl } from "../src/services/api";

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

  it("exports EaBrandIcon and has transparent alpha mask on ea.png", async () => {
    expect(sidebar).toContain("export const EaBrandIcon");
    const stats = await sharp("src/assets/brands/ea.png").stats();
    const alphaChannel = stats.channels[3];
    expect(alphaChannel).toBeDefined();
    // Verify alpha is not a solid opaque square
    expect(alphaChannel.min).toBe(0);
    expect(alphaChannel.max).toBe(255);
    expect(alphaChannel.mean).toBeLessThan(200);
    expect(alphaChannel.mean).toBeGreaterThan(10);
  });
});

describe("resolveBackendUrl", () => {
  it("falls back to PROD_BACKEND_URL in production mode even if .env has localhost", () => {
    const prodUrl = resolveBackendUrl("http://localhost:8787", true, "file://", "localhost");
    expect(prodUrl).toBe("https://checkpoint-launcher.onrender.com");
  });

  it("preserves explicit remote backend URL in production mode", () => {
    const customUrl = resolveBackendUrl("https://my-backend.org", true, "", "");
    expect(customUrl).toBe("https://my-backend.org");
  });

  it("uses localhost in development mode", () => {
    const devUrl = resolveBackendUrl("http://localhost:8787", false, "http://localhost:5173", "localhost");
    expect(devUrl).toBe("http://localhost:8787");
  });
});
