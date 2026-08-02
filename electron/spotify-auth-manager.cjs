"use strict";

const {
  createSpotifyAuthorizationRequest,
  hasRequiredSpotifyScopes,
  isSpotifyCallbackUrl,
  normalizeSpotifyTokenPayload,
} = require("./spotify-auth.cjs");

const SPOTIFY_TOKEN_URL = "https://accounts.spotify.com/api/token";
const SPOTIFY_PROFILE_URL = "https://api.spotify.com/v1/me";

const createSpotifyAuthManager = ({
  BrowserWindow,
  fetchImpl = fetch,
  credentialStore,
  redirectUri = "http://127.0.0.1:43821/callback",
}) => {
  let tokens = credentialStore.read?.() || null;
  let account = tokens?.account || null;

  const requestToken = async (params, previousRefreshToken = "") => {
    const response = await fetchImpl(SPOTIFY_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(params),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload?.error_description || payload?.error || "Falha ao autenticar com Spotify.");
    }
    return normalizeSpotifyTokenPayload(payload, previousRefreshToken);
  };

  const readProfile = async (accessToken) => {
    const response = await fetchImpl(SPOTIFY_PROFILE_URL, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (response.status === 403) {
        throw new Error(
          "Spotify recusou o perfil (HTTP 403). Adicione esta conta Premium em Users Management no painel do app Spotify e tente novamente.",
        );
      }
      const apiMessage = payload?.error?.message;
      throw new Error(
        apiMessage
          ? `Falha ao carregar perfil Spotify (HTTP ${response.status}): ${apiMessage}`
          : `Falha ao carregar perfil Spotify (HTTP ${response.status}).`,
      );
    }
    return {
      id: String(payload.id || ""),
      displayName: String(payload.display_name || payload.id || "Spotify"),
      imageUrl: String(payload.images?.[0]?.url || ""),
      product: String(payload.product || ""),
    };
  };

  const persist = () => credentialStore.write?.({ ...tokens, account });

  const refresh = async (clientId) => {
    if (!tokens?.refreshToken) throw new Error("Spotify desconectado.");
    tokens = await requestToken({
      grant_type: "refresh_token",
      refresh_token: tokens.refreshToken,
      client_id: clientId,
    }, tokens.refreshToken);
    persist();
    return tokens.accessToken;
  };

  const getAccessToken = async (clientId) => {
    if (!clientId?.trim()) throw new Error("Spotify Client ID nao configurado.");
    if (!tokens) throw new Error("Spotify desconectado.");
    if (tokens.expiresAt > Date.now() + 60_000) return tokens.accessToken;
    return refresh(clientId.trim());
  };

  const connect = (clientId) => {
    const normalizedClientId = String(clientId || "").trim();
    const authorization = createSpotifyAuthorizationRequest({
      clientId: normalizedClientId,
      redirectUri,
    });
    const authWindow = new BrowserWindow({
      width: 520,
      height: 760,
      show: false,
      autoHideMenuBar: true,
      title: "Conectar Spotify",
      webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true },
    });

    return new Promise((resolve, reject) => {
      let settled = false;
      const finish = (callback) => {
        if (settled) return;
        settled = true;
        callback();
        if (!authWindow.isDestroyed()) authWindow.close();
      };
      const handleCallback = async (event, currentUrl) => {
        if (!isSpotifyCallbackUrl(currentUrl, redirectUri)) return;
        event.preventDefault();
        const callbackUrl = new URL(currentUrl);
        if (callbackUrl.searchParams.get("state") !== authorization.state) {
          finish(() => reject(new Error("Spotify retornou um state invalido.")));
          return;
        }
        const error = callbackUrl.searchParams.get("error");
        const code = callbackUrl.searchParams.get("code");
        if (error || !code) {
          const message = error === "access_denied"
            ? "Autorizacao do Spotify recusada. Clique em Aceitar e confirme que esta conta Premium foi adicionada em Users Management no painel do app."
            : error || "Spotify nao retornou o codigo de autorizacao.";
          finish(() => reject(new Error(message)));
          return;
        }
        try {
          tokens = await requestToken({
            client_id: normalizedClientId,
            grant_type: "authorization_code",
            code,
            redirect_uri: redirectUri,
            code_verifier: authorization.verifier,
          });
          account = await readProfile(tokens.accessToken);
          persist();
          finish(() => resolve({ connected: true, account }));
        } catch (requestError) {
          finish(() => reject(requestError));
        }
      };

      authWindow.webContents.on("will-navigate", handleCallback);
      authWindow.webContents.on("will-redirect", handleCallback);
      authWindow.once("ready-to-show", () => authWindow.show());
      authWindow.on("closed", () => {
        if (!settled) {
          settled = true;
          reject(new Error("A conexao com Spotify foi cancelada."));
        }
      });
      authWindow.loadURL(authorization.url);
    });
  };

  return {
    connect,
    getAccessToken,
    getStatus: () => ({
      connected: Boolean(tokens?.refreshToken),
      account,
      requiresReauthorization: Boolean(tokens?.refreshToken)
        && !hasRequiredSpotifyScopes(tokens?.scope),
    }),
    disconnect: () => {
      tokens = null;
      account = null;
      credentialStore.clear?.();
      return { connected: false, account: null };
    },
  };
};

module.exports = { createSpotifyAuthManager };
