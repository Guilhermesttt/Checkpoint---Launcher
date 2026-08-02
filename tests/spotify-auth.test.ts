import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const {
  SPOTIFY_SCOPES,
  createSpotifyAuthorizationRequest,
  hasRequiredSpotifyScopes,
  isSpotifyCallbackUrl,
  normalizeSpotifyTokenPayload,
} = require("../electron/spotify-auth.cjs");

describe("autenticacao Spotify", () => {
  it("cria autorizacao PKCE com callback loopback e escopos de playback", () => {
    const request = createSpotifyAuthorizationRequest({
      clientId: "checkpoint-client",
      redirectUri: "http://127.0.0.1:43821/callback",
      randomBytes: (size: number) => Buffer.alloc(size, 7),
    });
    const url = new URL(request.url);

    expect(url.origin).toBe("https://accounts.spotify.com");
    expect(url.searchParams.get("client_id")).toBe("checkpoint-client");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("redirect_uri")).toBe("http://127.0.0.1:43821/callback");
    expect(url.searchParams.get("scope")).toContain("streaming");
    expect(url.searchParams.get("scope")).toContain("user-modify-playback-state");
    expect(request.verifier.length).toBeGreaterThanOrEqual(43);
    expect(request.state).not.toBe("");
  });

  it("aceita apenas o callback exato configurado", () => {
    const redirect = "http://127.0.0.1:43821/callback";
    expect(isSpotifyCallbackUrl(`${redirect}?code=abc`, redirect)).toBe(true);
    expect(isSpotifyCallbackUrl("http://localhost:43821/callback?code=abc", redirect)).toBe(false);
    expect(isSpotifyCallbackUrl("https://attacker.test/callback?code=abc", redirect)).toBe(false);
  });

  it("normaliza expiracao e preserva refresh token anterior", () => {
    const token = normalizeSpotifyTokenPayload({
      access_token: "access",
      expires_in: 3600,
      scope: "streaming",
    }, "refresh-anterior", 1_000);

    expect(token.accessToken).toBe("access");
    expect(token.refreshToken).toBe("refresh-anterior");
    expect(token.expiresAt).toBe(3_601_000);
  });

  it("solicita e valida os escopos de playlists", () => {
    expect(SPOTIFY_SCOPES).toEqual(expect.arrayContaining([
      "playlist-read-private",
      "playlist-read-collaborative",
      "playlist-modify-public",
      "playlist-modify-private",
    ]));
    expect(hasRequiredSpotifyScopes("streaming user-read-private")).toBe(false);
    expect(hasRequiredSpotifyScopes(SPOTIFY_SCOPES.join(" "))).toBe(true);
  });
});
