"use strict";

const crypto = require("node:crypto");

const SPOTIFY_SCOPES = [
  "streaming",
  "user-read-email",
  "user-read-private",
  "user-read-playback-state",
  "user-modify-playback-state",
  "user-read-currently-playing",
  "playlist-read-private",
  "playlist-read-collaborative",
  "playlist-modify-public",
  "playlist-modify-private",
];

const hasRequiredSpotifyScopes = (grantedScope = "") => {
  const granted = new Set(String(grantedScope).split(/\s+/).filter(Boolean));
  return SPOTIFY_SCOPES.every((scope) => granted.has(scope));
};

const toBase64Url = (value) => Buffer.from(value)
  .toString("base64")
  .replace(/=/g, "")
  .replace(/\+/g, "-")
  .replace(/\//g, "_");

const createSpotifyAuthorizationRequest = ({
  clientId,
  redirectUri,
  randomBytes = crypto.randomBytes,
}) => {
  if (!clientId?.trim()) throw new Error("Spotify Client ID nao configurado.");
  const redirect = new URL(redirectUri);
  if (redirect.protocol !== "http:" || redirect.hostname !== "127.0.0.1") {
    throw new Error("O callback Spotify deve usar um endereco loopback 127.0.0.1.");
  }

  const verifier = toBase64Url(randomBytes(64));
  const state = toBase64Url(randomBytes(24));
  const challenge = toBase64Url(crypto.createHash("sha256").update(verifier).digest());
  const url = new URL("https://accounts.spotify.com/authorize");
  url.search = new URLSearchParams({
    response_type: "code",
    client_id: clientId.trim(),
    redirect_uri: redirectUri,
    scope: SPOTIFY_SCOPES.join(" "),
    state,
    code_challenge_method: "S256",
    code_challenge: challenge,
  }).toString();

  return { url: url.toString(), verifier, state };
};

const isSpotifyCallbackUrl = (candidate, redirectUri) => {
  try {
    const actual = new URL(candidate);
    const expected = new URL(redirectUri);
    return actual.origin === expected.origin && actual.pathname === expected.pathname;
  } catch {
    return false;
  }
};

const normalizeSpotifyTokenPayload = (payload, previousRefreshToken = "", now = Date.now()) => {
  if (!payload?.access_token) throw new Error("Spotify nao retornou um access token.");
  return {
    accessToken: String(payload.access_token),
    refreshToken: String(payload.refresh_token || previousRefreshToken || ""),
    scope: String(payload.scope || ""),
    tokenType: String(payload.token_type || "Bearer"),
    expiresAt: now + Math.max(1, Number(payload.expires_in) || 3600) * 1000,
  };
};

module.exports = {
  SPOTIFY_SCOPES,
  createSpotifyAuthorizationRequest,
  isSpotifyCallbackUrl,
  normalizeSpotifyTokenPayload,
  hasRequiredSpotifyScopes,
};
