import "dotenv/config";
import crypto from "node:crypto";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { getDatabase as getAdminDatabase } from "firebase-admin/database";
import { OAuth2Client } from "google-auth-library";
import path from "path";
import { fileURLToPath } from "url";
import { getGamingNews } from "./gaming-news.mjs";

export const app = express();
const port = Number(process.env.PORT ?? 8787);
const frontendUrl = (process.env.FRONTEND_URL ?? "http://localhost:5173").replace(
  /\/$/,
  "",
);
const parseOrigins = (...values) =>
  values
    .flatMap((value) => String(value ?? "").split(","))
    .map((value) => value.trim().replace(/\/$/, ""))
    .filter(Boolean);

const allowedFrontendOrigins = new Set(
  parseOrigins(
    frontendUrl,
    process.env.FRONTEND_URLS,
    "https://checkpoint-launcher.netlify.app",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
  ),
);
const backendPublicUrl = (
  process.env.BACKEND_PUBLIC_URL ?? `http://localhost:${port}`
).replace(/\/$/, "");
const steamApiKey = process.env.STEAM_API_KEY?.trim();
const epicSandboxId = process.env.EPIC_SANDBOX_ID?.trim();
const discordClientId = process.env.DISCORD_CLIENT_ID?.trim();
const discordClientSecret = process.env.DISCORD_CLIENT_SECRET?.trim();
const discordOauthScope = process.env.DISCORD_OAUTH_SCOPE?.trim() || "identify";
const googleClientId = process.env.GOOGLE_CLIENT_ID?.trim();
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
const firebaseStorageBucket = (
  process.env.FIREBASE_STORAGE_BUCKET?.trim()
  || process.env.VITE_FIREBASE_STORAGE_BUCKET?.trim()
  || ""
);
const firebaseDatabaseUrl = (
  process.env.FIREBASE_DATABASE_URL?.trim()
  || process.env.VITE_FIREBASE_DATABASE_URL?.trim()
  || ""
);
const CHAT_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

const parseFirebaseServiceAccount = () => {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY?.trim();
  if (!raw) return null;

  const serviceAccount = JSON.parse(raw);
  if (typeof serviceAccount.private_key === "string") {
    serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, "\n");
  }
  return serviceAccount;
};

const firebaseServiceAccount = parseFirebaseServiceAccount();
if (firebaseServiceAccount && getApps().length === 0) {
  initializeApp({
    credential: cert(firebaseServiceAccount),
    ...(firebaseStorageBucket ? { storageBucket: firebaseStorageBucket } : {}),
    ...(firebaseDatabaseUrl ? { databaseURL: firebaseDatabaseUrl } : {}),
  });
}

app.set("trust proxy", 1);
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  }),
);
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedFrontendOrigins.has(origin.replace(/\/$/, ""))) {
        callback(null, true);
        return;
      }

      callback(null, false);
    },
    credentials: true,
  }),
);
app.use(express.json({ limit: "128kb" }));

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const steamOpenIdEndpoint = "https://steamcommunity.com/openid/login";
const epicStoreGraphqlEndpoint = "https://store.epicgames.com/graphql";
const discordAuthorizeEndpoint = "https://discord.com/oauth2/authorize";
const discordTokenEndpoint = "https://discord.com/api/oauth2/token";
const discordCurrentUserEndpoint = "https://discord.com/api/users/@me";
const discordRelationshipsEndpoint = "https://discord.com/api/users/@me/relationships";
const pendingStates = new Map();
const pendingDiscordStates = new Map();
const pendingDesktopGoogleStates = new Map();

const appDetailsCache = new Map();
const achievementsCache = new Map();
const achievementSummaryCache = new Map();
const achievementSchemaCache = new Map();
const steamPresenceCache = new Map();
const steamOwnedGamesCache = new Map();
const CACHE_TTL = 1000 * 60 * 60; // 1 hora
const STEAM_PRESENCE_CACHE_TTL = 10 * 1000;
const STEAM_OWNED_GAMES_CACHE_TTL = 10 * 60 * 1000;
const STEAM_API_TIMEOUT_MS = 8 * 1000;
const ACHIEVEMENT_SUMMARY_REQUEST_BUDGET_MS = 25 * 1000;
const MAX_ACHIEVEMENT_CACHE_ENTRIES = 5000;
const MAX_STEAM_OWNED_GAMES_CACHE_ENTRIES = 200;
const MAX_ACHIEVEMENT_SUMMARY_APP_IDS = 250;
const FRIEND_PROFILE_GAME_LIMIT = 500;
const ACTIVITY_AUDIENCE_REVOKE_BATCH_SIZE = 400;
const STEAM_AUTH_STATE_TTL = 1000 * 60 * 10; // 10 minutos
const DISCORD_AUTH_STATE_TTL = 1000 * 60 * 10; // 10 minutos
const DESKTOP_GOOGLE_AUTH_STATE_TTL = 1000 * 60 * 5; // 5 minutos

const steamAuthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
});

const steamPublicLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
});

const steamPrivateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
});

const steamAchievementSummaryLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  keyGenerator: (req) => String(req.firebaseUser?.uid || "unauthenticated"),
  standardHeaders: true,
  legacyHeaders: false,
});

const setBoundedCacheEntry = (cache, key, value, maxEntries = MAX_ACHIEVEMENT_CACHE_ENTRIES) => {
  if (cache.has(key)) cache.delete(key);
  cache.set(key, value);
  while (cache.size > maxEntries) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey === undefined) break;
    cache.delete(oldestKey);
  }
};

const isSteamTimeoutError = (error) =>
  error?.name === "AbortError" || error?.name === "TimeoutError";

const fetchSteamWithTimeout = async (url, options = {}, timeoutMs = STEAM_API_TIMEOUT_MS) => {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    Math.max(1, Math.min(STEAM_API_TIMEOUT_MS, Number(timeoutMs) || STEAM_API_TIMEOUT_MS)),
  );
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
};

const normalizeSteamAppIds = (values) => Array.from(new Set(
  (Array.isArray(values) ? values : [])
    .map((value) => String(value?.appid ?? value).trim())
    .filter((value) => /^\d+$/.test(value)),
));

const cacheOwnedSteamAppIds = (steamId, games) => {
  const appIds = new Set(normalizeSteamAppIds(games));
  setBoundedCacheEntry(
    steamOwnedGamesCache,
    steamId,
    { appIds, timestamp: Date.now() },
    MAX_STEAM_OWNED_GAMES_CACHE_ENTRIES,
  );
  return appIds;
};

const fetchOwnedSteamAppIds = async (steamId) => {
  const cached = steamOwnedGamesCache.get(steamId);
  if (cached && Date.now() - cached.timestamp < STEAM_OWNED_GAMES_CACHE_TTL) {
    return cached.appIds;
  }

  const url = new URL("https://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/");
  url.searchParams.set("key", steamApiKey);
  url.searchParams.set("steamid", steamId);
  url.searchParams.set("include_appinfo", "0");
  url.searchParams.set("include_played_free_games", "1");
  url.searchParams.set("format", "json");

  const response = await fetchSteamWithTimeout(url.toString());
  if (!response.ok) {
    const error = new Error(`Falha ao validar biblioteca Steam (status ${response.status}).`);
    error.statusCode = 502;
    throw error;
  }

  const payload = await response.json();
  if (!payload?.response || (
    payload.response.games !== undefined && !Array.isArray(payload.response.games)
  )) {
    const error = new Error("A Steam retornou uma biblioteca inválida.");
    error.statusCode = 502;
    throw error;
  }

  return cacheOwnedSteamAppIds(steamId, payload.response.games || []);
};

export const partitionOwnedSteamAppIds = (requestedAppIds, ownedAppIds) => {
  const owned = ownedAppIds instanceof Set ? ownedAppIds : new Set(normalizeSteamAppIds(ownedAppIds));
  const requested = normalizeSteamAppIds(requestedAppIds);
  return {
    allowedAppIds: requested.filter((appId) => owned.has(appId)),
    rejectedAppIds: requested.filter((appId) => !owned.has(appId)),
  };
};

const buildSteamReturnTo = (token) =>
  `${backendPublicUrl}/auth/steam/callback?token=${encodeURIComponent(token)}`;

const buildDiscordRedirectUri = () =>
  (
    process.env.DISCORD_REDIRECT_URI?.trim() ||
    `${backendPublicUrl}/auth/discord/callback`
  ).replace(/\/$/, "");

const buildGoogleRedirectUri = () =>
  (
    process.env.GOOGLE_REDIRECT_URI?.trim() ||
    `${backendPublicUrl}/auth/google/callback`
  ).replace(/\/$/, "");

const createGoogleOauthClient = () => {
  if (!googleClientId || !googleClientSecret) {
    throw new Error("GOOGLE_CLIENT_ID ou GOOGLE_CLIENT_SECRET nao configurado no backend.");
  }

  return new OAuth2Client(googleClientId, googleClientSecret, buildGoogleRedirectUri());
};

const buildOAuthSuccessPage = (platform) => `
  <!doctype html>
  <html lang="pt-BR">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>Checkpoint Launcher</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { min-height: 100vh; display: grid; place-items: center; background: #05070a; color: white; font-family: Inter, system-ui, sans-serif; }
        main { max-width: 440px; padding: 40px 32px; text-align: center; border: 1px solid rgba(255,255,255,.1); border-radius: 20px; background: rgba(255,255,255,.04); backdrop-filter: blur(12px); }
        .icon { width: 56px; height: 56px; border-radius: 50%; background: rgba(34,197,94,.15); border: 1px solid rgba(34,197,94,.3); display: flex; align-items: center; justify-content: center; margin: 0 auto 20px; font-size: 26px; }
        h1 { font-size: 22px; font-weight: 600; margin-bottom: 10px; }
        p { color: rgba(255,255,255,.55); line-height: 1.6; font-size: 14px; }
        .badge { display: inline-block; margin-top: 20px; padding: 6px 16px; border-radius: 999px; border: 1px solid rgba(255,255,255,.12); font-size: 11px; color: rgba(255,255,255,.4); letter-spacing: .08em; text-transform: uppercase; }
        .progress { width: 100%; height: 2px; background: rgba(255,255,255,.08); border-radius: 2px; margin-top: 24px; overflow: hidden; }
        .bar { height: 100%; width: 0; background: rgba(34,197,94,.6); animation: fill 1.4s linear forwards; }
        @keyframes fill { to { width: 100%; } }
      </style>
    </head>
    <body>
      <main>
        <div class="icon">✓</div>
        <h1>${platform} conectado!</h1>
        <p>Sua conta ${platform} foi vinculada com sucesso.<br/>Pode fechar esta aba e voltar ao Checkpoint Launcher.</p>
        <div class="progress"><div class="bar"></div></div>
        <span class="badge">Esta aba fechará automaticamente</span>
      </main>
      <script>setTimeout(() => { try { window.close(); } catch(e) {} }, 1500);</script>
    </body>
  </html>
`;

const cleanupPendingStates = () => {
  const now = Date.now();
  for (const [token, pending] of pendingStates.entries()) {
    if (now - pending.createdAt > STEAM_AUTH_STATE_TTL) {
      pendingStates.delete(token);
    }
  }
};

const cleanupPendingDiscordStates = () => {
  const now = Date.now();
  for (const [state, pending] of pendingDiscordStates.entries()) {
    if (now - pending.createdAt > DISCORD_AUTH_STATE_TTL) {
      pendingDiscordStates.delete(state);
    }
  }
};

const cleanupPendingDesktopGoogleStates = () => {
  const now = Date.now();
  for (const [state, pending] of pendingDesktopGoogleStates.entries()) {
    if (now - pending.createdAt > DESKTOP_GOOGLE_AUTH_STATE_TTL) {
      pendingDesktopGoogleStates.delete(state);
    }
  }
};

const buildSteamOpenIdUrl = (token) => {
  const returnTo = buildSteamReturnTo(token);
  const realm = backendPublicUrl;
  const openIdUrl = new URL(steamOpenIdEndpoint);

  openIdUrl.searchParams.set("openid.ns", "http://specs.openid.net/auth/2.0");
  openIdUrl.searchParams.set("openid.mode", "checkid_setup");
  openIdUrl.searchParams.set("openid.return_to", returnTo);
  openIdUrl.searchParams.set("openid.realm", realm);
  openIdUrl.searchParams.set(
    "openid.identity",
    "http://specs.openid.net/auth/2.0/identifier_select",
  );
  openIdUrl.searchParams.set(
    "openid.claimed_id",
    "http://specs.openid.net/auth/2.0/identifier_select",
  );

  return openIdUrl.toString();
};

const buildDiscordAuthorizeUrl = (state) => {
  if (!discordClientId) {
    throw new Error("DISCORD_CLIENT_ID nao configurado no backend.");
  }
  const authorizeUrl = new URL(discordAuthorizeEndpoint);
  authorizeUrl.searchParams.set("client_id", discordClientId);
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("scope", discordOauthScope);
  authorizeUrl.searchParams.set("redirect_uri", buildDiscordRedirectUri());
  authorizeUrl.searchParams.set("state", state);
  authorizeUrl.searchParams.set("prompt", "consent");
  return authorizeUrl.toString();
};

const buildGoogleAuthorizeUrl = (state) => {
  const client = createGoogleOauthClient();
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "select_account",
    scope: ["openid", "email", "profile"],
    state,
  });
};

const resolveFirebaseUserFromGooglePayload = async (payload) => {
  const email = String(payload?.email ?? "").trim();
  const emailVerified = Boolean(payload?.email_verified);
  const googleSub = String(payload?.sub ?? "").trim();

  if (!email || !googleSub) {
    throw new Error("Perfil Google sem email ou identificador.");
  }

  try {
    return await getAuth().getUserByEmail(email);
  } catch (error) {
    if (error?.code !== "auth/user-not-found") {
      throw error;
    }

    return await getAuth().createUser({
      email,
      emailVerified,
      displayName: String(payload?.name ?? email.split("@")[0] ?? "User"),
      photoURL: String(payload?.picture ?? ""),
    });
  }
};

const requestDiscordToken = async (code) => {
  if (!discordClientId || !discordClientSecret) {
    throw new Error("Credenciais Discord nao configuradas no backend.");
  }

  const body = new URLSearchParams();
  body.set("client_id", discordClientId);
  body.set("client_secret", discordClientSecret);
  body.set("grant_type", "authorization_code");
  body.set("code", code);
  body.set("redirect_uri", buildDiscordRedirectUri());

  const response = await fetch(discordTokenEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const payload = await response.json().catch(() => ({}));
  return { response, payload };
};

const discordAvatarUrl = (discordUser) => {
  if (!discordUser?.id || !discordUser?.avatar) return "";
  const extension = String(discordUser.avatar).startsWith("a_") ? "gif" : "png";
  return `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.${extension}`;
};

const discordDisplayName = (discordUser) =>
  discordUser?.discriminator && discordUser.discriminator !== "0"
    ? `${discordUser.username}#${discordUser.discriminator}`
    : String(discordUser?.global_name || discordUser?.username || "Discord");

const fetchDiscordFriends = async (accessToken, tokenType = "Bearer") => {
  try {
    const response = await fetch(discordRelationshipsEndpoint, {
      headers: { Authorization: `${tokenType} ${accessToken}` },
    });
    if (!response.ok) return [];
    const relationships = await response.json().catch(() => []);
    if (!Array.isArray(relationships)) return [];

    return relationships
      .filter((relationship) => relationship?.user?.id)
      .map((relationship) => ({
        id: String(relationship.user.id),
        username: discordDisplayName(relationship.user),
        avatar: discordAvatarUrl(relationship.user),
        relationshipType: relationship.type ?? null,
      }))
      .slice(0, 250);
  } catch {
    return [];
  }
};

const normalizeOpenIdBody = (query) => {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    const normalizedKey = key.replace(/^openid\./, "openid.");
    const finalValue = Array.isArray(value) ? value[0] : String(value ?? "");
    params.append(normalizedKey, finalValue);
  });
  params.set("openid.mode", "check_authentication");
  return params;
};

const steamStoreFetchHeaders = {
  Accept: "application/json",
  "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
};

const EPIC_CATALOG_ITEM_QUERY = `
  query catalogItemQuery($namespace: String!, $id: String!, $locale: String, $withOffers: Boolean!) {
    Catalog {
      catalogItem(namespace: $namespace, id: $id, locale: $locale) {
        id
        namespace
        title
        description
        releaseDate
        seller {
          name
        }
        keyImages {
          type
          url
        }
        categories {
          path
        }
        releaseInfo {
          appId
          platform
        }
        customAttributes {
          key
          value
        }
        dlcItemList {
          id
        }
        mainGameItem {
          id
        }
        offers @include(if: $withOffers) {
          urlSlug
        }
      }
    }
  }
`;

const EPIC_SEARCH_STORE_QUERY = `
  query searchStoreQuery($keywords: String, $locale: String, $country: String!, $count: Int, $start: Int) {
    Catalog {
      searchStore(keywords: $keywords, locale: $locale, country: $country, count: $count, start: $start) {
        elements {
          id
          namespace
          title
          description
          productSlug
          urlSlug
          seller {
            name
          }
          keyImages {
            type
            url
          }
          customAttributes {
            key
            value
          }
        }
      }
    }
  }
`;

const pickEpicImage = (images, preferredTypes) => {
  if (!Array.isArray(images) || images.length === 0) return "";
  const normalized = images.filter((image) => typeof image?.url === "string" && image.url);
  for (const preferredType of preferredTypes) {
    const found = normalized.find(
      (image) =>
        typeof image.type === "string" &&
        image.type.toLowerCase().includes(preferredType.toLowerCase()),
    );
    if (found?.url) return found.url;
  }
  return normalized[0]?.url || "";
};

const extractEpicCustomAttributes = (customAttributes) => {
  if (!Array.isArray(customAttributes)) return {};
  return customAttributes.reduce((acc, entry) => {
    if (entry?.key) {
      acc[entry.key] = entry?.value ?? "";
    }
    return acc;
  }, {});
};

const fetchEpicCatalogItem = async (namespace, itemId, locale = "pt-BR") => {
  const response = await fetch(epicStoreGraphqlEndpoint, {
    method: "POST",
    headers: {
      ...steamStoreFetchHeaders,
      "Content-Type": "application/json;charset=UTF-8",
    },
    body: JSON.stringify({
      query: EPIC_CATALOG_ITEM_QUERY,
      variables: {
        namespace,
        id: itemId,
        locale,
        withOffers: true,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Falha ao consultar catálogo Epic (status ${response.status}).`);
  }

  const payload = await response.json().catch(() => ({}));
  if (Array.isArray(payload?.errors) && payload.errors.length > 0) {
    throw new Error("GraphQL da Epic retornou erros ao consultar o catálogo.");
  }

  return payload?.data?.Catalog?.catalogItem ?? null;
};

const postEpicGraphql = async (query, variables) => {
  const headers = {
    ...steamStoreFetchHeaders,
    Accept: "application/json, text/plain, */*",
    "Content-Type": "application/json;charset=UTF-8",
    Origin: "https://store.epicgames.com",
    Referer: "https://store.epicgames.com/",
  };
  const body = JSON.stringify({ query, variables });

  const response = await fetch(epicStoreGraphqlEndpoint, {
    method: "POST",
    headers,
    body,
  });

  if (response.ok) {
    return { ok: true, status: response.status, payload: await response.json().catch(() => ({})) };
  }

  return { ok: false, status: response.status, payload: null };
};

export const buildEpicDetails = (catalogId, namespace, catalogItem) => {
  const customAttributes = extractEpicCustomAttributes(catalogItem?.customAttributes);
  const keyImages = Array.isArray(catalogItem?.keyImages) ? catalogItem.keyImages : [];
  const releaseInfo = Array.isArray(catalogItem?.releaseInfo) ? catalogItem.releaseInfo : [];
  const preferredRelease = releaseInfo.find(
    (release) => /win/i.test(String(release?.platform || "")) && String(release?.appId || "").trim(),
  ) || releaseInfo.find((release) => String(release?.appId || "").trim());
  const appName = String(preferredRelease?.appId || "").trim();
  
  let screenshots = keyImages
    .filter(
      (image) =>
        typeof image?.url === "string" &&
        typeof image?.type === "string" &&
        (image.type.toLowerCase().includes("screenshot") ||
          image.type.toLowerCase().includes("gallery") ||
          image.type.toLowerCase().includes("wide") ||
          image.type.toLowerCase().includes("hero") ||
          image.type.toLowerCase().includes("vault") ||
          image.type.toLowerCase().includes("featuredmedia"))
    )
    .map((image) => image.url);

  if (screenshots.length === 0) {
    screenshots = keyImages
      .filter(
        (image) =>
          typeof image?.url === "string" &&
          typeof image?.type === "string" &&
          !image.type.toLowerCase().includes("logo")
      )
      .map((image) => image.url);
  }

  const sellerName = String(catalogItem?.seller?.name ?? "").trim();
  const rawReleaseDate = catalogItem?.releaseDate || customAttributes?.releaseDate || "";

  return {
    catalogId,
    namespace,
    appName,
    title:
      String(catalogItem?.title ?? "").trim() ||
      String(customAttributes?.productName ?? "").trim() ||
      catalogId,
    image:
      pickEpicImage(keyImages, ["wide", "hero", "vault", "offerimagewide"]) ||
      pickEpicImage(keyImages, ["thumbnail", "dieselgameboxtall"]),
    backgroundImage: pickEpicImage(keyImages, ["wide", "hero", "vault", "offerimagewide"]),
    cardImage: pickEpicImage(keyImages, ["tall", "thumbnail", "box"]),
    logoImage: pickEpicImage(keyImages, ["logo"]),
    description:
      String(customAttributes?.shortDescription ?? "").trim() ||
      String(catalogItem?.description ?? "").trim(),
    aboutTheGame:
      String(customAttributes?.aboutThisGame ?? "").trim() ||
      String(catalogItem?.description ?? "").trim(),
    releaseDate: String(rawReleaseDate).trim(),
    developer:
      String(customAttributes?.developerName ?? "").trim() ||
      String(customAttributes?.developerDisplayName ?? "").trim() ||
      sellerName,
    publisher:
      String(customAttributes?.publisherName ?? "").trim() ||
      String(customAttributes?.publisherDisplayName ?? "").trim() ||
      sellerName,
    tags: Array.isArray(catalogItem?.categories)
      ? catalogItem.categories
          .map((category) => String(category?.path ?? "").split("/").pop())
          .filter(Boolean)
      : [],
    screenshots,
  };
};

const pickSteamTrailerUrl = (movies) => {
  if (!Array.isArray(movies) || movies.length === 0) return null;
  const list = [...movies].sort(
    (a, b) => Number(Boolean(b?.highlight)) - Number(Boolean(a?.highlight)),
  );
  for (const m of list) {
    const mp4 = m?.mp4;
    const webm = m?.webm;
    if (mp4 && typeof mp4 === "object") {
      const u = mp4.max || mp4["480"];
      if (u) return u;
    }
    if (webm && typeof webm === "object") {
      const u = webm.max || webm["480"];
      if (u) return u;
    }
  }
  return null;
};

const fetchSteamAchievementSchema = async (appId) => {
  const cached = achievementSchemaCache.get(appId);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  const url = new URL(
    "https://api.steampowered.com/ISteamUserStats/GetSchemaForGame/v2/",
  );
  url.searchParams.set("key", steamApiKey);
  url.searchParams.set("appid", appId);
  url.searchParams.set("l", "brazilian");

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`Falha ao consultar schema de conquistas (status ${response.status}).`);
  }

  const payload = await response.json();
  const rawAchievements = payload?.game?.availableGameStats?.achievements;
  const schema = Array.isArray(rawAchievements)
    ? rawAchievements.map((achievement) => ({
        apiName: String(achievement?.name ?? "").trim(),
        displayName: String(
          achievement?.displayName ?? achievement?.name ?? "",
        ).trim(),
        description: String(achievement?.description ?? "").trim(),
        icon: String(achievement?.icon ?? "").trim(),
        iconGray: String(achievement?.icongray ?? "").trim(),
        hidden: Number(achievement?.hidden ?? 0) === 1,
      }))
    : [];

  achievementSchemaCache.set(appId, {
    data: schema,
    timestamp: Date.now(),
  });

  return schema;
};

const parseDiskSizeGb = (text) => {
  if (!text) return null;

  const plain = String(text)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(li|p|div|h\d)>/gi, "\n")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ");

  const storageLabels =
    /(storage|hard\s*drive|disk\s*space|available\s*space|drive\s*space|armazenamento|espa[çc]o\s+em\s+disco|espa[çc]o\s+dispon[ií]vel)/i;
  const nonStorageLabels =
    /(memory|mem[oó]ria|ram|vram|video|graphics|gpu|placa\s+de\s+v[ií]deo)/i;

  const values = [];
  const lines = plain
    .split(/\n|(?=\b(?:storage|hard\s*drive|disk\s*space|armazenamento|espa[çc]o\s+em\s+disco)\b)/i)
    .map((line) => line.trim())
    .filter(Boolean);

  for (const line of lines) {
    if (!storageLabels.test(line) || nonStorageLabels.test(line)) continue;

    for (const match of line.matchAll(/(\d+(?:[.,]\d+)?)\s*(GB|MB)\b/gi)) {
      const amount = Number(match[1].replace(",", "."));
      if (!Number.isFinite(amount)) continue;
      values.push(match[2].toUpperCase() === "MB" ? amount / 1024 : amount);
    }
  }

  if (values.length === 0) return null;
  return Number(Math.max(...values).toFixed(1));
};

const requireFirebaseUser = async (req, res, next) => {
  if (getApps().length === 0) {
    res.status(500).json({ error: "Firebase Admin não configurado no backend." });
    return;
  }

  const header = String(req.headers.authorization ?? "");
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    res.status(401).json({ error: "Token Firebase ausente." });
    return;
  }

  try {
    req.firebaseUser = await getAuth().verifyIdToken(match[1]);
    next();
  } catch {
    res.status(401).json({ error: "Token Firebase inválido." });
  }
};

app.post("/api/chat/open", steamPrivateLimiter, requireFirebaseUser, async (req, res) => {
  const currentUid = req.firebaseUser.uid;
  const friendUid = String(req.body?.friendUid || "").trim();
  if (!friendUid || friendUid === currentUid) {
    res.status(400).json({ error: "Usuario invalido." });
    return;
  }
  if (!firebaseDatabaseUrl) {
    res.status(503).json({ error: "Realtime Database nao configurado." });
    return;
  }

  try {
    const profileSnap = await getFirestore().doc(`profiles/${currentUid}`).get();
    const isFriend = (Array.isArray(profileSnap.data()?.checkpointFriends)
      ? profileSnap.data().checkpointFriends
      : [])
      .some((friend) => String(friend?.uid || "") === friendUid);
    if (!isFriend) {
      res.status(403).json({ error: "Chat disponivel apenas para amigos." });
      return;
    }

    const chatId = [currentUid, friendUid].sort().join("_");
    await getAdminDatabase().ref(`chats/${chatId}/participants`).set({
      [currentUid]: true,
      [friendUid]: true,
    });
    const expiredMessages = await getAdminDatabase()
      .ref(`chats/${chatId}/messages`)
      .orderByChild("createdAt")
      .endAt(Date.now() - CHAT_RETENTION_MS)
      .limitToFirst(200)
      .get();
    if (expiredMessages.exists()) {
      const removals = {};
      expiredMessages.forEach((message) => {
        removals[message.key] = null;
      });
      await getAdminDatabase()
        .ref(`chats/${chatId}/messages`)
        .update(removals);
    }
    res.json({ chatId });
  } catch (error) {
    console.error("Erro ao abrir chat:", error);
    res.status(500).json({ error: "Erro ao abrir conversa." });
  }
});

export const resolveLinkedSteamId = (linkedValue, requestedValue) => {
  const linkedSteamId = String(linkedValue ?? "").trim();
  const requestedSteamId = String(requestedValue ?? "").trim();
  if (requestedSteamId && !/^\d+$/.test(requestedSteamId)) {
    return { ok: false, status: 400, error: "steamId inválido." };
  }
  if (!/^\d+$/.test(linkedSteamId)) {
    return { ok: false, status: 409, error: "Nenhuma conta Steam está vinculada ao perfil." };
  }
  if (requestedSteamId && requestedSteamId !== linkedSteamId) {
    return {
      ok: false,
      status: 403,
      error: "Steam ID não pertence ao usuário autenticado.",
    };
  }
  return { ok: true, steamId: linkedSteamId };
};

const requireLinkedSteamId = async (req, res, next) => {
  const requestedSteamId = String(req.query.steamId ?? "").trim();
  if (requestedSteamId && !/^\d+$/.test(requestedSteamId)) {
    res.status(400).json({ error: "steamId inválido." });
    return;
  }

  try {
    const uid = req.firebaseUser.uid;
    const profileSnap = await getFirestore().doc(`profiles/${uid}`).get();
    const resolution = resolveLinkedSteamId(
      profileSnap.data()?.steamId,
      requestedSteamId,
    );
    if (!resolution.ok) {
      res.status(resolution.status).json({ error: resolution.error });
      return;
    }
    req.steamId = resolution.steamId;
    next();
  } catch (error) {
    console.error("Erro interno no requireLinkedSteamId:", error);
    res.status(500).json({ error: "Erro ao validar vínculo Steam." });
  }
};

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/gaming/news", steamPublicLimiter, async (_req, res) => {
  try {
    const result = await getGamingNews();
    res.set("Cache-Control", "public, max-age=300, stale-while-revalidate=900");
    res.json({
      items: result.items,
      sources: result.sources,
      cached: result.cached,
      stale: Boolean(result.stale),
    });
  } catch {
    res.status(502).json({ error: "As fontes de notícias estão indisponíveis agora." });
  }
});

const publicProfile = (id, data = {}) => ({
  uid: String(id || data.uid || ""),
  email: data.email || "",
  displayName: data.displayName || data.email?.split("@")[0] || "User",
  photoURL: data.photoURL || data.discordAvatar || data.steamAvatar || "",
  discordAvatar: data.discordAvatar || "",
  discordUsername: data.discordUsername || "",
  status: resolvePresence(data.presence).status,
  playing: resolvePresence(data.presence).playing,
});

const compactFriendProfile = (profile) => ({
  uid: profile.uid,
  displayName: profile.displayName,
  photoURL: profile.photoURL || null,
  status: profile.status || "offline",
  playing: profile.playing || null,
});

const nonNegativeFiniteNumber = (value) => {
  const number = Number(value || 0);
  return Number.isFinite(number) ? Math.max(0, number) : 0;
};

export const projectFriendGame = (id, data = {}) => {
  const steamAppId = /^\d+$/.test(String(data.steamAppId || ""))
    ? String(data.steamAppId)
    : "";
  const steamCover = steamAppId
    ? `https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/${steamAppId}/library_600x900_2x.jpg`
    : "";
  const steamBackground = steamAppId
    ? `https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/${steamAppId}/library_hero.jpg`
    : "";
  const unlocked = nonNegativeFiniteNumber(data.completedAchievements);
  const available = Math.max(unlocked, nonNegativeFiniteNumber(data.totalAchievements));

  return {
    id: String(id || ""),
    title: String(data.title || "Jogo").trim().slice(0, 160) || "Jogo",
    image: steamCover,
    backgroundImage: steamBackground,
    cardImage: steamCover,
    logoImage: "",
    category: String(data.category || "").trim().slice(0, 80),
    isFavorite: Boolean(data.isFavorite),
    hoursPlayed: nonNegativeFiniteNumber(data.hoursPlayed),
    launcherType: ["steam", "epic", "local"].includes(data.launcherType)
      ? data.launcherType
      : "local",
    steamAppId,
    totalAchievements: available,
    completedAchievements: unlocked,
  };
};

export const normalizeFriendAchievementAggregate = (aggregate = {}, gamesWithAchievements = 0) => {
  const unlocked = nonNegativeFiniteNumber(aggregate.unlocked);
  return {
    unlocked,
    available: Math.max(unlocked, nonNegativeFiniteNumber(aggregate.available)),
    gamesWithAchievements: Math.floor(nonNegativeFiniteNumber(gamesWithAchievements)),
    totalGames: Math.floor(nonNegativeFiniteNumber(aggregate.totalGames)),
  };
};

const resolvePresence = (presence = {}) => {
  const updatedAtMs = Date.parse(String(presence.updatedAt || ""));
  const isFresh = Number.isFinite(updatedAtMs) && Date.now() - updatedAtMs < 2 * 60 * 1000;
  if (!isFresh) return { status: "offline", playing: null };
  if (presence.status === "offline") return { status: "offline", playing: null };
  const currentGameTitle = String(presence.currentGameTitle || "").trim();
  if (presence.status === "playing" && currentGameTitle) {
    return { status: "playing", playing: currentGameTitle };
  }
  return { status: "online", playing: null };
};

const withUniqueProfile = (items, profile, extra = {}) => [
  { ...compactFriendProfile(profile), ...extra },
  ...(Array.isArray(items) ? items : []).filter((item) => item?.uid !== profile.uid),
];

const withoutProfileUid = (items, uid) =>
  (Array.isArray(items) ? items : []).filter((item) => item?.uid !== uid);

export const revokeActivityAudience = async (firestore, ownerUid, removedUid) => {
  if (!firestore || !ownerUid || !removedUid || ownerUid === removedUid) return 0;

  let revoked = 0;
  while (true) {
    const snapshot = await firestore
      .collection("activities")
      .where("userId", "==", ownerUid)
      .where("audienceIds", "array-contains", removedUid)
      .limit(ACTIVITY_AUDIENCE_REVOKE_BATCH_SIZE)
      .get();
    if (snapshot.empty) break;

    const batch = firestore.batch();
    snapshot.docs.forEach((activityDoc) => {
      batch.update(activityDoc.ref, {
        audienceIds: FieldValue.arrayRemove(removedUid),
      });
      batch.delete(firestore.doc(`feeds/${removedUid}/activities/${activityDoc.id}`));
    });
    await batch.commit();
    revoked += snapshot.size;
  }

  return revoked;
};

export const writeActivityToFeeds = async (firestore, activityId, audienceIds, payload) => {
  const normalizedActivityId = socialText(activityId, 256);
  const normalizedAudienceIds = Array.from(new Set(
    (Array.isArray(audienceIds) ? audienceIds : [])
      .map((uid) => socialText(uid, 128))
      .filter(Boolean),
  )).slice(0, 200);
  if (!firestore || !normalizedActivityId || normalizedAudienceIds.length === 0) return 0;

  const batch = firestore.batch();
  normalizedAudienceIds.forEach((viewerUid) => {
    batch.set(
      firestore.doc(`feeds/${viewerUid}/activities/${normalizedActivityId}`),
      payload,
    );
  });
  await batch.commit();
  return normalizedAudienceIds.length;
};

const SOCIAL_ACTIVITY_KINDS = new Set(["game-start", "achievement"]);

const socialText = (value, maxLength) =>
  (typeof value === "string" ? value.trim() : "").slice(0, maxLength);

const socialImageUrl = (value) => {
  const raw = socialText(value, 2048);
  if (!raw) return "";
  try {
    const url = new URL(raw);
    return url.protocol === "https:" ? url.toString() : "";
  } catch {
    return "";
  }
};

export const normalizeSocialActivityInput = (value) => {
  const input = value && typeof value === "object" ? value : {};
  const kind = socialText(input.kind, 32);
  if (!SOCIAL_ACTIVITY_KINDS.has(kind)) {
    throw new Error("Tipo de atividade inválido.");
  }

  const normalized = {
    kind,
    gameId: socialText(input.gameId, 160),
    gameTitle: socialText(input.gameTitle, 160),
    gameImage: socialImageUrl(input.gameImage),
    achievementId: socialText(input.achievementId, 160),
    achievementName: socialText(input.achievementName, 160),
    achievementIcon: socialImageUrl(input.achievementIcon),
    caption: socialText(input.caption, 500),
  };

  if (kind === "game-start" && (!normalized.gameId || !normalized.gameTitle)) {
    throw new Error("Jogo inválido para a atividade.");
  }
  if (
    kind === "achievement"
    && (!normalized.gameId || !normalized.gameTitle || !normalized.achievementId)
  ) {
    throw new Error("Conquista inválida para a atividade.");
  }

  return Object.fromEntries(
    Object.entries(normalized).filter(([, fieldValue]) => fieldValue !== ""),
  );
};

const isAlreadyExistsError = (error) =>
  error?.code === 6
  || error?.code === "6"
  || error?.code === "already-exists"
  || /already exists/i.test(String(error?.message || ""));

app.post("/api/social/activity", steamPrivateLimiter, requireFirebaseUser, async (req, res) => {
  let activity;
  try {
    activity = normalizeSocialActivityInput(req.body);
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : "Atividade inválida.",
    });
    return;
  }

  try {
    const uid = req.firebaseUser.uid;
    const firestore = getFirestore();
    const profileSnap = await firestore.doc(`profiles/${uid}`).get();
    const profile = profileSnap.data() || {};
    const friendIds = Array.from(new Set(
      (Array.isArray(profile.checkpointFriends) ? profile.checkpointFriends : [])
        .map((friend) => socialText(friend?.uid, 128))
        .filter((friendUid) => friendUid && friendUid !== uid),
    )).slice(0, 199);
    const friendSnaps = friendIds.length > 0
      ? await firestore.getAll(...friendIds.map((friendUid) => firestore.doc(`profiles/${friendUid}`)))
      : [];
    const confirmedFriendIds = friendSnaps
      .filter((friendSnap) => {
        const friendProfile = friendSnap.data() || {};
        return Array.isArray(friendProfile.checkpointFriends)
          && friendProfile.checkpointFriends.some((friend) => friend?.uid === uid);
      })
      .map((friendSnap) => friendSnap.id);
    const audienceIds = Array.from(new Set([
      uid,
      ...confirmedFriendIds,
    ].filter(Boolean))).slice(0, 200);
    const userName = socialText(
      profile.displayName
        || profile.discordUsername
        || req.firebaseUser.name
        || req.firebaseUser.email?.split("@")[0]
        || "Jogador",
      80,
    ) || "Jogador";
    const userAvatar = socialImageUrl(
      profile.discordAvatar
        || profile.photoURL
        || profile.steamAvatar
        || req.firebaseUser.picture,
    );
    const payload = {
      ...activity,
      userId: uid,
      userName,
      userAvatar: userAvatar || null,
      audienceIds,
      createdAt: new Date().toISOString(),
    };

    let activityRef;
    let duplicate = false;
    if (activity.kind === "achievement") {
      const digest = crypto
        .createHash("sha256")
        .update(`${uid}\0${activity.gameId}\0${activity.achievementId}`)
        .digest("hex");
      activityRef = firestore.doc(`activities/achievement_${digest}`);
      try {
        await activityRef.create(payload);
      } catch (error) {
        if (!isAlreadyExistsError(error)) throw error;
        duplicate = true;
      }
    } else {
      activityRef = await firestore.collection("activities").add(payload);
    }

    await writeActivityToFeeds(firestore, activityRef.id, audienceIds, payload);
    res.status(duplicate ? 200 : 201).json({ ok: true, id: activityRef.id, duplicate });
  } catch (error) {
    console.error("Erro ao publicar atividade social:", error);
    res.status(500).json({ error: "Não foi possível publicar a atividade." });
  }
});

app.get("/api/friends/search", steamPrivateLimiter, requireFirebaseUser, async (req, res) => {
  const term = String(req.query.q ?? "").trim();
  if (term.length < 2) {
    res.status(400).json({ error: "Informe pelo menos 2 caracteres." });
    return;
  }

  try {
    const firestore = getFirestore();
    const found = new Map();
    const normalizedTerm = term.toLowerCase();

    if (term.includes("@")) {
      const emailSnap = await firestore
        .collection("profiles")
        .where("email", "==", term)
        .limit(10)
        .get();
      emailSnap.forEach((doc) => {
        if (doc.id === req.firebaseUser.uid) return;
        found.set(doc.id, publicProfile(doc.id, doc.data()));
      });
    }

    const allProfilesSnap = await firestore.collection("profiles").limit(250).get();
    allProfilesSnap.forEach((doc) => {
      if (doc.id === req.firebaseUser.uid) return;
      const data = doc.data();
      const name = String(data.displayName || data.discordUsername || data.email || "").toLowerCase();
      if (name.includes(normalizedTerm)) {
        found.set(doc.id, publicProfile(doc.id, data));
      }
    });

    const users = Array.from(found.values())
      .filter((profile) => profile.uid && profile.uid !== req.firebaseUser.uid)
      .filter((profile, index, profiles) => profiles.findIndex((item) => item.uid === profile.uid) === index)
      .slice(0, 25);

    res.json({ users });
  } catch {
    res.status(500).json({ error: "Erro ao buscar usuários." });
  }
});

app.post("/api/presence", steamPrivateLimiter, requireFirebaseUser, async (req, res) => {
  const requestedStatus = String(req.body?.status || "online");
  const status =
    requestedStatus === "playing"
      ? "playing"
      : requestedStatus === "offline"
        ? "offline"
        : "online";
  const currentGameTitle = String(req.body?.currentGameTitle || "").trim().slice(0, 120);

  try {
    await getFirestore().doc(`profiles/${req.firebaseUser.uid}`).set(
      {
        presence: {
          status,
          currentGameTitle: status === "playing" ? currentGameTitle : "",
          updatedAt: new Date().toISOString(),
        },
        updatedAt: new Date().toISOString(),
      },
      { merge: true },
    );
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Erro ao atualizar presença." });
  }
});

app.get("/api/friends/status", steamPrivateLimiter, requireFirebaseUser, async (req, res) => {
  try {
    const firestore = getFirestore();
    const profileSnap = await firestore.doc(`profiles/${req.firebaseUser.uid}`).get();
    const friendRefs = (Array.isArray(profileSnap.data()?.checkpointFriends)
      ? profileSnap.data().checkpointFriends
      : [])
      .map((friend) => String(friend?.uid || "").trim())
      .filter(Boolean)
      .slice(0, 250);

    if (friendRefs.length === 0) {
      res.json({ friends: [] });
      return;
    }

    const snaps = await Promise.all(friendRefs.map((uid) => firestore.doc(`profiles/${uid}`).get()));
    res.json({
      friends: snaps
        .filter((snap) => snap.exists)
        .map((snap) => compactFriendProfile(publicProfile(snap.id, snap.data()))),
    });
  } catch {
    res.status(500).json({ error: "Erro ao consultar presença dos amigos." });
  }
});

app.get("/api/friends/:uid/profile", steamPrivateLimiter, requireFirebaseUser, async (req, res) => {
  const friendUid = String(req.params.uid || "").trim();
  if (!friendUid || friendUid === req.firebaseUser.uid) {
    res.status(400).json({ error: "Usuário inválido." });
    return;
  }

  try {
    const firestore = getFirestore();
    const profileSnap = await firestore.doc(`publicProfiles/${friendUid}`).get();
    if (!profileSnap.exists) {
      res.status(404).json({ error: "Perfil não encontrado." });
      return;
    }

    const profileData = profileSnap.data() || {};
    const stats = profileData.stats || {};
    const achievements = profileData.achievements || {};
    const platforms = profileData.platforms || {};
    const favoriteGames = Array.isArray(profileData.favoriteGames)
      ? profileData.favoriteGames
      : [];
    const favoriteIds = new Set(favoriteGames.map((game) => String(game?.id || "")));
    const compactGames = [
      ...(Array.isArray(profileData.topGames) ? profileData.topGames : []),
      ...favoriteGames,
    ];
    const games = compactGames
      .filter((game, index, items) => game?.id
        && items.findIndex((candidate) => candidate?.id === game.id) === index)
      .slice(0, FRIEND_PROFILE_GAME_LIMIT)
      .map((game) => ({
        id: String(game.id),
        title: String(game.title || "Jogo"),
        image: String(game.imageUrl || ""),
        cardImage: String(game.imageUrl || ""),
        hoursPlayed: Math.round((Number(game.minutesPlayed) || 0) / 60),
        isFavorite: favoriteIds.has(String(game.id)),
        source: "manual",
      }));

    res.json({
      profile: {
        uid: friendUid,
        displayName: profileData.displayName || "Usuário",
        photoURL: profileData.photoURL || "",
        bio: profileData.bio || "",
        location: profileData.location || "",
        pronouns: profileData.pronouns || "",
        website: profileData.website || "",
        favoriteGenres: Array.isArray(profileData.favoriteGenres)
          ? profileData.favoriteGenres.slice(0, 6)
          : [],
        steamId: platforms.steamConnected ? "connected" : "",
        discordId: platforms.discordConnected ? "connected" : "",
        achievementSummary: {
          unlocked: Math.max(0, Number(achievements.unlocked) || 0),
          available: Math.max(0, Number(achievements.total) || 0),
          totalGames: Math.max(0, Number(stats.games) || 0),
          updatedAt: profileData.updatedAt || "",
        },
        librarySummary: {
          games: Math.max(0, Number(stats.games) || 0),
          minutesPlayed: Math.max(0, Number(stats.minutesPlayed) || 0),
          favorites: Math.max(0, Number(stats.favorites) || 0),
          steamGames: Math.max(0, Number(platforms.steamGameCount) || 0),
          epicGames: Math.max(0, Number(platforms.epicGameCount) || 0),
          localGames: Math.max(0, Number(platforms.localGameCount) || 0),
        },
      },
      games,
      gamesTruncated: Number(stats.games) > games.length,
    });
  } catch {
    res.status(500).json({ error: "Erro ao carregar perfil do amigo." });
  }
});

app.post("/api/friends/request", steamPrivateLimiter, requireFirebaseUser, async (req, res) => {
  const friendUid = String(req.body?.uid ?? "").trim();
  if (!friendUid || friendUid === req.firebaseUser.uid) {
    res.status(400).json({ error: "Usuário inválido." });
    return;
  }

  try {
    const firestore = getFirestore();
    const profileRef = firestore.doc(`profiles/${req.firebaseUser.uid}`);
    const friendRef = firestore.doc(`profiles/${friendUid}`);
    const [profileSnap, friendSnap] = await Promise.all([profileRef.get(), friendRef.get()]);
    if (!profileSnap.exists || !friendSnap.exists) {
      res.status(404).json({ error: "Usuário não encontrado." });
      return;
    }

    const profileData = profileSnap.data() || {};
    const friendData = friendSnap.data() || {};
    const alreadyFriends = Array.isArray(profileData.checkpointFriends)
      && profileData.checkpointFriends.some((item) => item?.uid === friendUid);
    if (alreadyFriends) {
      res.status(409).json({ error: "Usuário já está na sua lista de amigos." });
      return;
    }

    const hasOutgoingRequest = Array.isArray(profileData.checkpointFriendRequestsOutgoing)
      && profileData.checkpointFriendRequestsOutgoing.some((item) => item?.uid === friendUid);
    if (hasOutgoingRequest) {
      res.status(409).json({ error: "Solicitacao ja enviada para este usuario." });
      return;
    }
    const hasIncomingRequest = Array.isArray(profileData.checkpointFriendRequestsIncoming)
      && profileData.checkpointFriendRequestsIncoming.some((item) => item?.uid === friendUid);
    if (hasIncomingRequest) {
      res.status(409).json({ error: "Este usuario ja enviou uma solicitacao para voce." });
      return;
    }

    const currentProfile = publicProfile(profileSnap.id, profileData);
    const friend = publicProfile(friendSnap.id, friendData);
    const createdAt = new Date().toISOString();
    await profileRef.set(
      {
        checkpointFriendRequestsOutgoing: withUniqueProfile(
          profileData.checkpointFriendRequestsOutgoing,
          friend,
          { createdAt },
        ).slice(0, 250),
        updatedAt: createdAt,
      },
      { merge: true },
    );
    await friendRef.set(
      {
        checkpointFriendRequestsIncoming: withUniqueProfile(
          friendData.checkpointFriendRequestsIncoming,
          currentProfile,
          { createdAt },
        ).slice(0, 250),
        updatedAt: createdAt,
      },
      { merge: true },
    );
    res.json({ request: compactFriendProfile(friend) });
  } catch {
    res.status(500).json({ error: "Erro ao enviar solicitação." });
  }
});

app.post("/api/friends/accept", steamPrivateLimiter, requireFirebaseUser, async (req, res) => {
  const requesterUid = String(req.body?.uid ?? "").trim();
  if (!requesterUid || requesterUid === req.firebaseUser.uid) {
    res.status(400).json({ error: "Usuário inválido." });
    return;
  }

  try {
    const firestore = getFirestore();
    const profileRef = firestore.doc(`profiles/${req.firebaseUser.uid}`);
    const requesterRef = firestore.doc(`profiles/${requesterUid}`);
    const [profileSnap, requesterSnap] = await Promise.all([profileRef.get(), requesterRef.get()]);
    if (!profileSnap.exists || !requesterSnap.exists) {
      res.status(404).json({ error: "Usuário não encontrado." });
      return;
    }

    const profileData = profileSnap.data() || {};
    const requesterData = requesterSnap.data() || {};
    const hasRequest = Array.isArray(profileData.checkpointFriendRequestsIncoming)
      && profileData.checkpointFriendRequestsIncoming.some((item) => item?.uid === requesterUid);
    if (!hasRequest) {
      res.status(404).json({ error: "Solicitação não encontrada." });
      return;
    }

    const now = new Date().toISOString();
    const currentProfile = publicProfile(profileSnap.id, profileData);
    const requesterProfile = publicProfile(requesterSnap.id, requesterData);
    await profileRef.set(
      {
        checkpointFriends: withUniqueProfile(profileData.checkpointFriends, requesterProfile).slice(0, 250),
        checkpointFriendRequestsIncoming: withoutProfileUid(
          profileData.checkpointFriendRequestsIncoming,
          requesterUid,
        ),
        checkpointFriendRequestsOutgoing: withoutProfileUid(
          profileData.checkpointFriendRequestsOutgoing,
          requesterUid,
        ),
        updatedAt: now,
      },
      { merge: true },
    );
    await requesterRef.set(
      {
        checkpointFriends: withUniqueProfile(requesterData.checkpointFriends, currentProfile).slice(0, 250),
        checkpointFriendRequestsIncoming: withoutProfileUid(
          requesterData.checkpointFriendRequestsIncoming,
          req.firebaseUser.uid,
        ),
        checkpointFriendRequestsOutgoing: withoutProfileUid(
          requesterData.checkpointFriendRequestsOutgoing,
          req.firebaseUser.uid,
        ),
        updatedAt: now,
      },
      { merge: true },
    );
    res.json({ friend: compactFriendProfile(requesterProfile) });
  } catch {
    res.status(500).json({ error: "Erro ao aceitar solicitação." });
  }
});

app.post("/api/friends/reject", steamPrivateLimiter, requireFirebaseUser, async (req, res) => {
  const requesterUid = String(req.body?.uid ?? "").trim();
  if (!requesterUid || requesterUid === req.firebaseUser.uid) {
    res.status(400).json({ error: "Usuário inválido." });
    return;
  }

  try {
    const firestore = getFirestore();
    const profileRef = firestore.doc(`profiles/${req.firebaseUser.uid}`);
    const requesterRef = firestore.doc(`profiles/${requesterUid}`);
    const [profileSnap, requesterSnap] = await Promise.all([profileRef.get(), requesterRef.get()]);
    const now = new Date().toISOString();
    if (profileSnap.exists) {
      const profileData = profileSnap.data() || {};
      await profileRef.set(
        {
          checkpointFriendRequestsIncoming: withoutProfileUid(
            profileData.checkpointFriendRequestsIncoming,
            requesterUid,
          ),
          updatedAt: now,
        },
        { merge: true },
      );
    }
    if (requesterSnap.exists) {
      const requesterData = requesterSnap.data() || {};
      await requesterRef.set(
        {
          checkpointFriendRequestsOutgoing: withoutProfileUid(
            requesterData.checkpointFriendRequestsOutgoing,
            req.firebaseUser.uid,
          ),
          updatedAt: now,
        },
        { merge: true },
      );
    }
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Erro ao rejeitar solicitação." });
  }
});

app.post("/api/friends/unfriend", steamPrivateLimiter, requireFirebaseUser, async (req, res) => {
  const friendUid = String(req.body?.uid ?? "").trim();
  const currentUid = req.firebaseUser.uid;
  if (!friendUid || friendUid === currentUid) {
    res.status(400).json({ error: "Usuário inválido." });
    return;
  }

  try {
    const firestore = getFirestore();
    const profileRef = firestore.doc(`profiles/${currentUid}`);
    const friendRef = firestore.doc(`profiles/${friendUid}`);
    const [profileSnap, friendSnap] = await Promise.all([profileRef.get(), friendRef.get()]);
    const now = new Date().toISOString();
    const profileBatch = firestore.batch();
    let hasProfileWrites = false;
    if (profileSnap.exists) {
      const data = profileSnap.data() || {};
      profileBatch.set(
        profileRef,
        {
          checkpointFriends: withoutProfileUid(data.checkpointFriends, friendUid),
          checkpointFriendRequestsIncoming: withoutProfileUid(data.checkpointFriendRequestsIncoming, friendUid),
          checkpointFriendRequestsOutgoing: withoutProfileUid(data.checkpointFriendRequestsOutgoing, friendUid),
          updatedAt: now,
        },
        { merge: true },
      );
      hasProfileWrites = true;
    }
    if (friendSnap.exists) {
      const data = friendSnap.data() || {};
      profileBatch.set(
        friendRef,
        {
          checkpointFriends: withoutProfileUid(data.checkpointFriends, currentUid),
          checkpointFriendRequestsIncoming: withoutProfileUid(data.checkpointFriendRequestsIncoming, currentUid),
          checkpointFriendRequestsOutgoing: withoutProfileUid(data.checkpointFriendRequestsOutgoing, currentUid),
          updatedAt: now,
        },
        { merge: true },
      );
      hasProfileWrites = true;
    }
    if (hasProfileWrites) {
      await profileBatch.commit();
    }

    const [revokedFromCurrent, revokedFromFriend] = await Promise.all([
      revokeActivityAudience(firestore, currentUid, friendUid),
      revokeActivityAudience(firestore, friendUid, currentUid),
    ]);
    res.json({
      ok: true,
      revokedActivities: revokedFromCurrent + revokedFromFriend,
    });
  } catch {
    res.status(500).json({ error: "Erro ao remover amigo." });
  }
});

app.post("/api/friends/add", steamPrivateLimiter, requireFirebaseUser, async (req, res) => {
  const friendUid = String(req.body?.uid ?? "").trim();
  if (!friendUid || friendUid === req.firebaseUser.uid) {
    res.status(400).json({ error: "Usuário inválido." });
    return;
  }

  try {
    const firestore = getFirestore();
    const friendSnap = await firestore.doc(`profiles/${friendUid}`).get();
    if (!friendSnap.exists) {
      res.status(404).json({ error: "Usuário não encontrado." });
      return;
    }

    const friend = publicProfile(friendSnap.id, friendSnap.data());
    const profileRef = firestore.doc(`profiles/${req.firebaseUser.uid}`);
    const profileSnap = await profileRef.get();
    const currentFriends = Array.isArray(profileSnap.data()?.checkpointFriends)
      ? profileSnap.data().checkpointFriends
      : [];
    const nextFriends = [
      {
        uid: friend.uid,
        displayName: friend.displayName,
        photoURL: friend.photoURL || null,
      },
      ...currentFriends.filter((item) => item?.uid !== friend.uid),
    ].slice(0, 250);

    await profileRef.set(
      {
        checkpointFriends: nextFriends,
        updatedAt: new Date().toISOString(),
      },
      { merge: true },
    );
    res.json({ friend });
  } catch {
    res.status(500).json({ error: "Erro ao adicionar amigo." });
  }
});

app.post("/api/friends/remove", steamPrivateLimiter, requireFirebaseUser, async (req, res) => {
  const friendUid = String(req.body?.uid ?? "").trim();
  if (!friendUid) {
    res.status(400).json({ error: "Usuário inválido." });
    return;
  }

  try {
    const profileRef = getFirestore().doc(`profiles/${req.firebaseUser.uid}`);
    const profileSnap = await profileRef.get();
    const currentFriends = Array.isArray(profileSnap.data()?.checkpointFriends)
      ? profileSnap.data().checkpointFriends
      : [];
    await profileRef.set(
      {
        checkpointFriends: currentFriends.filter((item) => item?.uid !== friendUid),
        updatedAt: new Date().toISOString(),
      },
      { merge: true },
    );
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Erro ao remover amigo." });
  }
});

app.post("/auth/steam/start", steamAuthLimiter, requireFirebaseUser, (req, res) => {
  cleanupPendingStates();
  const token = crypto.randomUUID();
  pendingStates.set(token, {
    firebaseUid: req.firebaseUser.uid,
    createdAt: Date.now(),
  });

  res.json({ url: buildSteamOpenIdUrl(token) });
});

app.post("/auth/discord/start", steamAuthLimiter, requireFirebaseUser, (req, res) => {
  cleanupPendingDiscordStates();
  if (!discordClientId || !discordClientSecret) {
    res.status(500).json({ error: "Credenciais Discord nao configuradas no backend." });
    return;
  }

  const state = crypto.randomUUID();
  pendingDiscordStates.set(state, {
    firebaseUid: req.firebaseUser.uid,
    createdAt: Date.now(),
  });

  try {
    res.json({ url: buildDiscordAuthorizeUrl(state) });
  } catch (error) {
    pendingDiscordStates.delete(state);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Falha ao iniciar autenticacao Discord.",
    });
  }
});

app.get("/auth/google/start", steamAuthLimiter, (req, res) => {
  cleanupPendingDesktopGoogleStates();

  const state = String(req.query.state ?? "").trim();
  if (!state) {
    res.status(400).send("state ausente.");
    return;
  }

  if (getApps().length === 0) {
    res.status(500).send("Firebase Admin nao configurado no backend.");
    return;
  }

  pendingDesktopGoogleStates.set(state, {
    createdAt: Date.now(),
  });

  try {
    res.redirect(buildGoogleAuthorizeUrl(state));
  } catch (error) {
    pendingDesktopGoogleStates.delete(state);
    res
      .status(500)
      .send(error instanceof Error ? error.message : "Falha ao iniciar login Google.");
  }
});

app.get("/auth/google/callback", steamAuthLimiter, async (req, res) => {
  cleanupPendingDesktopGoogleStates();

  const state = String(req.query.state ?? "").trim();
  const code = String(req.query.code ?? "").trim();
  const oauthError = String(req.query.error ?? "").trim();
  const pending = pendingDesktopGoogleStates.get(state);

  if (!state || !pending) {
    res.status(400).send("Sessao de login invalida ou expirada. Volte ao app e tente novamente.");
    return;
  }

  if (oauthError) {
    pendingDesktopGoogleStates.delete(state);
    res.status(400).send("Login Google cancelado ou negado.");
    return;
  }

  if (!code) {
    res.status(400).send("Codigo Google ausente.");
    return;
  }

  if (getApps().length === 0) {
    res.status(500).send("Firebase Admin nao configurado no backend.");
    return;
  }

  try {
    const client = createGoogleOauthClient();
    const { tokens } = await client.getToken(code);

    if (!tokens.id_token) {
      throw new Error("Google nao retornou id_token.");
    }

    const ticket = await client.verifyIdToken({
      idToken: tokens.id_token,
      audience: googleClientId,
    });
    const payload = ticket.getPayload();
    const firebaseUser = await resolveFirebaseUserFromGooglePayload(payload);
    const customToken = await getAuth().createCustomToken(firebaseUser.uid);

    pendingDesktopGoogleStates.set(state, {
      customToken,
      uid: firebaseUser.uid,
      createdAt: Date.now(),
    });

    res.type("html").send(`
      <!doctype html>
      <html lang="pt-BR">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>Checkpoint Launcher</title>
          <style>
            body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #05070a; color: white; font-family: Inter, system-ui, sans-serif; }
            main { max-width: 420px; padding: 32px; text-align: center; border: 1px solid rgba(255,255,255,.12); border-radius: 18px; background: rgba(255,255,255,.05); }
            h1 { margin: 0 0 12px; font-size: 24px; }
            p { margin: 0; color: rgba(255,255,255,.66); line-height: 1.5; }
          </style>
        </head>
        <body>
          <main>
            <h1>Login concluido</h1>
            <p>Voce ja pode voltar para o Checkpoint Launcher.</p>
          </main>
          <script>setTimeout(() => window.close(), 1200);</script>
        </body>
      </html>
    `);
  } catch (error) {
    pendingDesktopGoogleStates.delete(state);
    res
      .status(500)
      .send(error instanceof Error ? error.message : "Falha ao concluir login Google.");
  }
});

app.post("/auth/desktop/google/complete", steamAuthLimiter, async (req, res) => {
  cleanupPendingDesktopGoogleStates();

  const state = String(req.body?.state ?? "").trim();
  const idToken = String(req.body?.idToken ?? "").trim();

  if (!state || !idToken) {
    res.status(400).json({ error: "state ou idToken ausente." });
    return;
  }

  if (getApps().length === 0) {
    res.status(500).json({ error: "Firebase Admin nao configurado no backend." });
    return;
  }

  try {
    const decodedToken = await getAuth().verifyIdToken(idToken);
    const customToken = await getAuth().createCustomToken(decodedToken.uid);

    pendingDesktopGoogleStates.set(state, {
      customToken,
      uid: decodedToken.uid,
      createdAt: Date.now(),
    });

    res.json({ ok: true });
  } catch {
    res.status(401).json({ error: "Token Google invalido." });
  }
});

app.get("/auth/desktop/google/status", steamPublicLimiter, (req, res) => {
  cleanupPendingDesktopGoogleStates();

  const state = String(req.query.state ?? "").trim();
  if (!state) {
    res.status(400).json({ error: "state ausente." });
    return;
  }

  const pending = pendingDesktopGoogleStates.get(state);
  if (!pending || !pending.customToken) {
    res.json({ status: "pending" });
    return;
  }

  pendingDesktopGoogleStates.delete(state);
  res.json({
    status: "complete",
    customToken: pending.customToken,
    uid: pending.uid,
  });
});

app.get("/auth/steam/callback", steamAuthLimiter, async (req, res) => {
  cleanupPendingStates();
  const token = String(req.query.token ?? "");
  const pending = pendingStates.get(token);
  if (!pending) {
    res.redirect(`${frontendUrl}/app?steamStatus=invalid_state`);
    return;
  }
  pendingStates.delete(token);

  try {
    const body = normalizeOpenIdBody(req.query);
    const validation = await fetch(steamOpenIdEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    const text = await validation.text();
    const isValid = text.includes("is_valid:true");
    if (!isValid) {
      res.redirect(`${frontendUrl}/app?steamStatus=invalid`);
      return;
    }

    const claimedId = String(req.query["openid.claimed_id"] ?? "");
    const match = claimedId.match(/\/id\/(\d+)$/);
    const steamId = match?.[1];
    if (!steamId) {
      res.redirect(`${frontendUrl}/app?steamStatus=missing_id`);
      return;
    }

    if (getApps().length === 0) {
      res.redirect(`${frontendUrl}/app?steamStatus=server_not_configured`);
      return;
    }

    await getFirestore().doc(`profiles/${pending.firebaseUid}`).set(
      {
        steamId,
        updatedAt: new Date().toISOString(),
      },
      { merge: true },
    );

    res.type("html").send(buildOAuthSuccessPage("Steam"));
  } catch {
    res.redirect(`${frontendUrl}/app?steamStatus=error`);
  }
});

app.get("/auth/discord/callback", steamAuthLimiter, async (req, res) => {
  cleanupPendingDiscordStates();
  const state = String(req.query.state ?? "");
  const pending = pendingDiscordStates.get(state);
  if (!pending) {
    res.redirect(`${frontendUrl}/app?discordStatus=invalid_state`);
    return;
  }
  pendingDiscordStates.delete(state);

  const oauthError = String(req.query.error ?? "").trim();
  if (oauthError) {
    res.redirect(`${frontendUrl}/app?discordStatus=denied`);
    return;
  }

  const code = String(req.query.code ?? "").trim();
  if (!code) {
    res.redirect(`${frontendUrl}/app?discordStatus=missing_code`);
    return;
  }

  if (!discordClientId || !discordClientSecret) {
    res.redirect(`${frontendUrl}/app?discordStatus=client_not_configured`);
    return;
  }

  if (getApps().length === 0) {
    res.redirect(`${frontendUrl}/app?discordStatus=server_not_configured`);
    return;
  }

  try {
    const { response: tokenResponse, payload: tokenPayload } =
      await requestDiscordToken(code);

    if (!tokenResponse.ok) {
      res.redirect(`${frontendUrl}/app?discordStatus=token_error`);
      return;
    }

    const userResponse = await fetch(discordCurrentUserEndpoint, {
      headers: {
        Authorization: `${tokenPayload.token_type ?? "Bearer"} ${tokenPayload.access_token}`,
      },
    });
    const discordUser = await userResponse.json().catch(() => ({}));

    if (!userResponse.ok || !discordUser?.id) {
      res.redirect(`${frontendUrl}/app?discordStatus=missing_id`);
      return;
    }

    const username = discordDisplayName(discordUser);
    const avatar = discordAvatarUrl(discordUser);
    const discordFriends = await fetchDiscordFriends(
      tokenPayload.access_token,
      tokenPayload.token_type ?? "Bearer",
    );

    await getFirestore().doc(`profiles/${pending.firebaseUid}`).set(
      {
        discordId: String(discordUser.id),
        discordUsername: username,
        discordAvatar: avatar,
        discordFriends,
        updatedAt: new Date().toISOString(),
      },
      { merge: true },
    );

    res.type("html").send(buildOAuthSuccessPage("Discord"));
  } catch {
    res.redirect(`${frontendUrl}/app?discordStatus=error`);
  }
});

app.post("/api/steam/disconnect", steamPrivateLimiter, requireFirebaseUser, async (req, res) => {
  try {
    await getFirestore().doc(`profiles/${req.firebaseUser.uid}`).set(
      {
        steamId: "",
        updatedAt: new Date().toISOString(),
      },
      { merge: true },
    );
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Erro ao desconectar Steam." });
  }
});

app.post("/api/discord/disconnect", steamPrivateLimiter, requireFirebaseUser, async (req, res) => {
  try {
    await getFirestore().doc(`profiles/${req.firebaseUser.uid}`).set(
      {
        discordId: "",
        discordUsername: "",
        discordAvatar: "",
        discordFriends: [],
        updatedAt: new Date().toISOString(),
      },
      { merge: true },
    );
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Erro ao desconectar Discord." });
  }
});

app.get("/api/steam/library", steamPrivateLimiter, requireFirebaseUser, requireLinkedSteamId, async (req, res) => {
  if (!steamApiKey) {
    res
      .status(500)
      .json({ error: "STEAM_API_KEY não configurada no backend." });
    return;
  }

  const steamId = req.steamId;

  try {
    const url = new URL(
      "https://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/",
    );
    url.searchParams.set("key", steamApiKey);
    url.searchParams.set("steamid", steamId);
    url.searchParams.set("include_appinfo", "1");
    url.searchParams.set("include_played_free_games", "1");
    url.searchParams.set("format", "json");

    const response = await fetchSteamWithTimeout(url.toString());
    if (!response.ok) {
      res.status(502).json({
        error: `Falha ao consultar Steam API (status ${response.status}).`,
      });
      return;
    }

    const payload = await response.json();
    if (!payload?.response) {
      res.status(502).json({ error: "Resposta inválida da Steam API." });
      return;
    }

    const games = payload.response.games ?? [];
    if (!Array.isArray(games)) {
      res
        .status(502)
        .json({ error: "Biblioteca Steam retornou formato inesperado." });
      return;
    }
    cacheOwnedSteamAppIds(steamId, games);

    res.json({
      steamId,
      gameCount: payload.response.game_count ?? games.length,
      games,
    });
  } catch (error) {
    res.status(isSteamTimeoutError(error) ? 504 : 500).json({
      error: isSteamTimeoutError(error)
        ? "A Steam demorou demais para responder."
        : "Erro interno ao consultar Steam.",
    });
  }
});

app.get("/api/steam/current-game", steamPrivateLimiter, requireFirebaseUser, requireLinkedSteamId, async (req, res) => {
  if (!steamApiKey) {
    res.status(500).json({ error: "STEAM_API_KEY não configurada no backend." });
    return;
  }

  try {
    const cached = steamPresenceCache.get(req.steamId);
    if (cached && Date.now() - cached.timestamp < STEAM_PRESENCE_CACHE_TTL) {
      res.json(cached.data);
      return;
    }

    const url = new URL("https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/");
    url.searchParams.set("key", steamApiKey);
    url.searchParams.set("steamids", req.steamId);
    const response = await fetchSteamWithTimeout(url.toString());
    if (!response.ok) {
      res.status(502).json({ error: `Falha ao consultar presença Steam (status ${response.status}).` });
      return;
    }

    const payload = await response.json();
    const player = Array.isArray(payload?.response?.players)
      ? payload.response.players[0]
      : null;
    if (!player) {
      res.status(502).json({ error: "A Steam não retornou o perfil conectado." });
      return;
    }

    const appId = /^\d+$/.test(String(player.gameid || ""))
      ? String(player.gameid)
      : null;
    const visibilityState = Number(player.communityvisibilitystate || 0);
    const data = {
      observable: visibilityState >= 3 || Boolean(appId),
      appId,
      title: appId ? String(player.gameextrainfo || "").slice(0, 160) : null,
      visibilityState,
    };
    setBoundedCacheEntry(steamPresenceCache, req.steamId, { data, timestamp: Date.now() });
    res.json(data);
  } catch (error) {
    res.status(isSteamTimeoutError(error) ? 504 : 500).json({
      error: isSteamTimeoutError(error)
        ? "A Steam demorou demais para informar o jogo atual."
        : "Erro interno ao consultar presença Steam.",
    });
  }
});

app.post("/api/steam/achievement-summary", steamPrivateLimiter, requireFirebaseUser, steamAchievementSummaryLimiter, requireLinkedSteamId, async (req, res) => {
  if (!steamApiKey) {
    res.status(500).json({ error: "STEAM_API_KEY não configurada no backend." });
    return;
  }

  const appIds = normalizeSteamAppIds(req.body?.appIds);

  if (appIds.length === 0) {
    res.status(400).json({ error: "Lista de appIds inválida." });
    return;
  }

  if (appIds.length > MAX_ACHIEVEMENT_SUMMARY_APP_IDS) {
    res.status(413).json({
      error: `Envie no máximo ${MAX_ACHIEVEMENT_SUMMARY_APP_IDS} appIds por requisição.`,
    });
    return;
  }

  const steamId = req.steamId;
  let allowedAppIds;
  try {
    const ownedAppIds = await fetchOwnedSteamAppIds(steamId);
    ({ allowedAppIds } = partitionOwnedSteamAppIds(appIds, ownedAppIds));
  } catch (error) {
    res.status(isSteamTimeoutError(error) ? 504 : Number(error?.statusCode || 502)).json({
      error: isSteamTimeoutError(error)
        ? "A Steam demorou demais para validar a biblioteca."
        : String(error?.message || "Não foi possível validar a biblioteca Steam."),
    });
    return;
  }

  const stats = {};
  let cursor = 0;
  const requestDeadline = Date.now() + ACHIEVEMENT_SUMMARY_REQUEST_BUDGET_MS;

  const loadNext = async () => {
    while (cursor < allowedAppIds.length && Date.now() < requestDeadline) {
      const appId = allowedAppIds[cursor++];
      const cacheKey = `${steamId}_${appId}`;
      const detailedCached = achievementsCache.get(cacheKey);
      if (detailedCached && Date.now() - detailedCached.timestamp < CACHE_TTL) {
        const unlocked = nonNegativeFiniteNumber(detailedCached.data?.unlocked);
        stats[appId] = {
          total: Math.max(unlocked, nonNegativeFiniteNumber(detailedCached.data?.total)),
          unlocked,
        };
        continue;
      }

      const cached = achievementSummaryCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        stats[appId] = cached.data;
        continue;
      }

      try {
        const url = new URL("https://api.steampowered.com/ISteamUserStats/GetPlayerAchievements/v0001/");
        url.searchParams.set("key", steamApiKey);
        url.searchParams.set("steamid", steamId);
        url.searchParams.set("appid", appId);
        const remainingBudget = requestDeadline - Date.now();
        if (remainingBudget <= 0) return;
        const response = await fetchSteamWithTimeout(url.toString(), {}, remainingBudget);
        if (!response.ok) {
          if (response.status === 400 || response.status === 404) {
            const data = { total: 0, unlocked: 0 };
            setBoundedCacheEntry(achievementSummaryCache, cacheKey, { data, timestamp: Date.now() });
            stats[appId] = data;
          }
          continue;
        }
        const payload = await response.json();
        if (payload?.playerstats?.success === false) continue;
        const achievements = Array.isArray(payload?.playerstats?.achievements)
          ? payload.playerstats.achievements
          : [];
        const data = {
          total: achievements.length,
          unlocked: achievements.filter((achievement) => Number(achievement?.achieved || 0) === 1).length,
        };
        setBoundedCacheEntry(achievementSummaryCache, cacheKey, { data, timestamp: Date.now() });
        stats[appId] = data;
      } catch {
        // Uma falha isolada não deve impedir os totais dos outros jogos.
      }
    }
  };

  await Promise.all(Array.from({ length: Math.min(4, allowedAppIds.length) }, () => loadNext()));
  const failedAppIds = appIds.filter((appId) => !Object.hasOwn(stats, appId));
  res.json({
    stats,
    requested: appIds.length,
    resolved: Object.keys(stats).length,
    failedAppIds,
  });
});

const handleSteamSearch = async (req, res) => {
  const query = String(req.query.query ?? "").trim();
  if (query.length < 2) {
    res.status(400).json({ error: "Query de busca muito curta." });
    return;
  }

  try {
    const url = new URL("https://store.steampowered.com/api/storesearch/");
    url.searchParams.set("term", query);
    url.searchParams.set("l", "brazilian");
    url.searchParams.set("cc", "BR");

    const response = await fetch(url.toString(), {
      headers: steamStoreFetchHeaders,
    });

    if (!response.ok) {
      res.status(502).json({
        error: `Falha na busca Steam Store (status ${response.status}).`,
      });
      return;
    }

    const payload = await response.json();
    res.json({
      items: payload?.items ?? [],
    });
  } catch {
    res
      .status(500)
      .json({ error: "Erro interno ao buscar jogos da Steam Store." });
  }
};

app.get("/api/steam/search", steamPublicLimiter, handleSteamSearch);
app.get("/api/steam/search-games", steamPublicLimiter, handleSteamSearch);

app.get("/api/epic/search", steamPublicLimiter, async (req, res) => {
  const query = String(req.query.query ?? "").trim();
  if (query.length < 2) {
    res.status(400).json({ error: "Query de busca muito curta." });
    return;
  }

  try {
    const result = await postEpicGraphql(EPIC_SEARCH_STORE_QUERY, {
      keywords: query,
      locale: "pt-BR",
      country: "BR",
      count: 12,
      start: 0,
    });

    if (!result.ok) {
      res.status(502).json({
        error: `Falha na busca Epic Games Store (status ${result.status}).`,
      });
      return;
    }

    const payload = result.payload ?? {};
    if (Array.isArray(payload?.errors) && payload.errors.length > 0) {
      res.status(502).json({ error: "GraphQL da Epic retornou erro na busca." });
      return;
    }

    const items = (payload?.data?.Catalog?.searchStore?.elements ?? [])
      .filter((item) => item?.id && item?.title)
      .map((item) => {
        const keyImages = Array.isArray(item?.keyImages) ? item.keyImages : [];
        const namespace = String(item?.namespace ?? "").trim();
        const catalogId = String(item?.id ?? "").trim();
        const image =
          pickEpicImage(keyImages, ["wide", "hero", "vault", "offerimagewide"]) ||
          pickEpicImage(keyImages, ["thumbnail", "dieselgameboxtall"]);
        const cardImage = pickEpicImage(keyImages, ["tall", "thumbnail", "box"]) || image;
        const slug = String(item?.productSlug ?? item?.urlSlug ?? "")
          .replace(/^\/?([a-z]{2}-[A-Z]{2}\/)?p\//, "")
          .replace(/\/home$/, "")
          .replace(/^\/+|\/+$/g, "")
          .trim();
        const productUrl = slug ? `https://store.epicgames.com/p/${slug}` : "";

        return {
          id: catalogId,
          namespace,
          name: String(item.title).trim(),
          title: String(item.title).trim(),
          image,
          backgroundImage: image,
          tiny_image: cardImage,
          cardImage,
          description: String(item?.description ?? "").trim(),
          productSlug: slug,
          productUrl,
        };
      });

    res.json({ items });
  } catch {
    res.status(500).json({ error: "Erro interno ao buscar jogos da Epic Games Store." });
  }
});

app.get("/api/epic/app-details", steamPublicLimiter, async (req, res) => {
  const catalogId = String(req.query.catalogId ?? "").trim();
  const namespace = String(req.query.namespace ?? epicSandboxId ?? "").trim();
  if (!catalogId || !namespace) {
    res.status(400).json({ error: "catalogId ou namespace inválido." });
    return;
  }

  const cacheKey = `epic_${namespace}_${catalogId}`;
  const cached = appDetailsCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    res.json(cached.data);
    return;
  }

  try {
    const catalogItem = await fetchEpicCatalogItem(namespace, catalogId);
    if (!catalogItem) {
      res.status(404).json({ error: "Detalhes não encontrados para este item Epic." });
      return;
    }

    const result = buildEpicDetails(catalogId, namespace, catalogItem);
    appDetailsCache.set(cacheKey, { data: result, timestamp: Date.now() });
    res.json(result);
  } catch {
    res.status(500).json({ error: "Erro interno ao buscar detalhes da Epic Games Store." });
  }
});

app.get("/api/steam/app-size", steamPublicLimiter, async (req, res) => {
  const appId = String(req.query.appId ?? "").trim();
  if (!/^\d+$/.test(appId)) {
    res.status(400).json({ error: "appId inválido." });
    return;
  }

  try {
    const url = new URL("https://store.steampowered.com/api/appdetails");
    url.searchParams.set("appids", appId);
    url.searchParams.set("l", "brazilian");
    url.searchParams.set("cc", "BR");

    const response = await fetch(url.toString(), {
      headers: steamStoreFetchHeaders,
    });
    if (!response.ok) {
      res.status(502).json({
        error: `Falha ao consultar detalhes do app (status ${response.status}).`,
      });
      return;
    }

    const payload = await response.json();
    const appEntry = payload?.[appId];
    if (!appEntry?.success || !appEntry?.data) {
      res.json({ appId, sizeGB: null });
      return;
    }
    const data = appEntry.data;
    const requirements = `${data?.pc_requirements?.minimum ?? ""} ${data?.pc_requirements?.recommended ?? ""}`;
    const sizeGB = parseDiskSizeGb(requirements);
    res.json({ appId, sizeGB: sizeGB ?? null });
  } catch {
    res.status(500).json({ error: "Erro interno ao buscar tamanho do jogo." });
  }
});

app.get("/api/steam/achievements", steamPrivateLimiter, requireFirebaseUser, requireLinkedSteamId, async (req, res) => {
  if (!steamApiKey) {
    res
      .status(500)
      .json({ error: "STEAM_API_KEY não configurada no backend." });
    return;
  }

  const steamId = req.steamId;
  const appId = String(req.query.appId ?? "").trim();

  if (!/^\d+$/.test(appId)) {
    res.status(400).json({ error: "appId inválido." });
    return;
  }

  const cacheKey = `${steamId}_${appId}`;
  const cached = achievementsCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    res.json(cached.data);
    return;
  }

  try {
    const url = new URL("https://api.steampowered.com/ISteamUserStats/GetPlayerAchievements/v0001/");
    url.searchParams.set("key", steamApiKey);
    url.searchParams.set("steamid", steamId);
    url.searchParams.set("appid", appId);
    url.searchParams.set("l", "brazilian");

    const [response, schema] = await Promise.all([
      fetch(url.toString()),
      fetchSteamAchievementSchema(appId).catch(() => []),
    ]);
    if (!response.ok) {
      if (response.status === 400 || response.status === 404) {
        const data = { achievements: [], total: 0, unlocked: 0 };
        setBoundedCacheEntry(achievementsCache, cacheKey, { data, timestamp: Date.now() });
        res.json(data);
        return;
      }
      res
        .status(502)
        .json({
          error: `Falha ao consultar conquistas (status ${response.status}).`,
        });
      return;
    }

    const payload = await response.json();
    const playerAchievements = Array.isArray(payload?.playerstats?.achievements)
      ? payload.playerstats.achievements
      : [];
    const schemaByApiName = new Map(
      schema.map((achievement) => [achievement.apiName, achievement]),
    );
    const achievements = playerAchievements.map((achievement) => {
      const apiName = String(achievement?.apiname ?? "").trim();
      const schemaItem = schemaByApiName.get(apiName);
      return {
        apiName,
        achieved: Number(achievement?.achieved ?? 0) === 1,
        unlockTime: Number(achievement?.unlocktime ?? 0) || 0,
        name: String(
          achievement?.name ??
            schemaItem?.displayName ??
            apiName,
        ).trim(),
        description: String(
          achievement?.description ?? schemaItem?.description ?? "",
        ).trim(),
        icon: String(schemaItem?.icon ?? "").trim(),
        iconGray: String(schemaItem?.iconGray ?? "").trim(),
        hidden: Boolean(schemaItem?.hidden),
      };
    });
    const total = achievements.length;
    const unlocked = achievements.filter((a) => a.achieved).length;

    const data = {
      achievements,
      total,
      unlocked,
    };

    setBoundedCacheEntry(achievementsCache, cacheKey, { data, timestamp: Date.now() });
    res.json(data);
  } catch {
    res.status(500).json({ error: "Erro interno ao buscar conquistas." });
  }
});

app.get("/api/steam/achievement-schema", steamPublicLimiter, async (req, res) => {
  if (!steamApiKey) {
    res
      .status(500)
      .json({ error: "STEAM_API_KEY nao configurada no backend." });
    return;
  }

  const appId = String(req.query.appId ?? "").trim();
  if (!/^\d+$/.test(appId)) {
    res.status(400).json({ error: "appId invalido." });
    return;
  }

  try {
    const schema = await fetchSteamAchievementSchema(appId);
    const achievements = schema.map((achievement) => ({
      apiName: achievement.apiName,
      achieved: false,
      unlockTime: 0,
      name: achievement.displayName || achievement.apiName,
      description: achievement.description || "",
      icon: achievement.icon || "",
      iconGray: achievement.iconGray || "",
      hidden: Boolean(achievement.hidden),
    }));

    res.json({
      achievements,
      total: achievements.length,
      unlocked: 0,
    });
  } catch {
    res.status(500).json({ error: "Erro interno ao buscar schema de conquistas." });
  }
});

app.get("/api/steam/app-details", steamPublicLimiter, async (req, res) => {
  const appId = String(req.query.appId ?? "").trim();
  if (!/^\d+$/.test(appId)) {
    res.status(400).json({ error: "appId inválido." });
    return;
  }

  const cached = appDetailsCache.get(appId);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    res.json(cached.data);
    return;
  }

  try {
    const url = new URL("https://store.steampowered.com/api/appdetails");
    url.searchParams.set("appids", appId);
    url.searchParams.set("l", "brazilian");
    url.searchParams.set("cc", "BR");

    const response = await fetch(url.toString(), {
      headers: steamStoreFetchHeaders,
    });
    if (!response.ok) {
      res
        .status(502)
        .json({
          error: `Falha ao consultar detalhes do app (status ${response.status}).`,
        });
      return;
    }

    const payload = await response.json();
    const appEntry = payload?.[appId];
    if (!appEntry?.success || !appEntry?.data) {
      res
        .status(404)
        .json({ error: "Detalhes não encontrados para este appId." });
      return;
    }
    const data = appEntry.data;

    const requirements = `${data?.pc_requirements?.minimum ?? ""} ${data?.pc_requirements?.recommended ?? ""}`;
    const trailerUrl = pickSteamTrailerUrl(data?.movies);

    const result = {
      appId,
      title: data?.name ?? null,
      cardImage: `https://cdn.akamai.steamstatic.com/steam/apps/${appId}/library_600x900_2x.jpg`,
       headerImage: data?.header_image ?? null,
      backgroundImage: data?.background_raw ?? data?.background ?? null,
      logoImage: data?.capsule_imagev5 ?? data?.capsule_image ?? null,
      description: data?.short_description ?? null,
      aboutTheGame: data?.about_the_game ?? null,
      screenshots: Array.isArray(data?.screenshots)
        ? data.screenshots.map((s) => s.path_full)
        : [],
      releaseDate: data?.release_date?.date ?? null,
      developer: Array.isArray(data?.developers)
        ? data.developers.join(", ")
        : null,
      publisher: Array.isArray(data?.publishers)
        ? data.publishers.join(", ")
        : null,
      tags: [
        ...(Array.isArray(data?.genres)
          ? data.genres.map((g) => g.description)
          : []),
        ...(Array.isArray(data?.categories)
          ? data.categories.map((c) => c.description)
          : []),
      ],
      trailerUrl,
      sizeGB: parseDiskSizeGb(requirements),
    };

    appDetailsCache.set(appId, { data: result, timestamp: Date.now() });
    res.json(result);
  } catch {
    res.status(500).json({ error: "Erro interno ao buscar detalhes do jogo." });
  }
});

app.use(express.static(path.join(__dirname, "../dist")));

app.get("/{*path}", (req, res) => {
  res.sendFile(path.join(__dirname, "../dist/index.html"));
});

export const startServer = () => app.listen(port, () => {
  console.log(`Backend ativo em http://localhost:${port}`);
});

if (process.env.NODE_ENV !== "test") {
  startServer();
}
