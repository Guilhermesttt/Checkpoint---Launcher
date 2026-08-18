import "dotenv/config";
import crypto from "node:crypto";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { OAuth2Client } from "google-auth-library";
import path from "path";
import os from "node:os";
import fs from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { createClient } from "@supabase/supabase-js";
import { createRetroAchievementsRouter } from "./retroachievements.mjs";
import { createTheGamesDbRouter } from "./thegamesdb.mjs";
import { fileURLToPath } from "url";
import { getGamingNews } from "./gaming-news.mjs";

export const app = express();

const supabaseUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").trim();
const supabaseServiceRoleKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
const isValidUrl = (url) => typeof url === "string" && (url.startsWith("http://") || url.startsWith("https://"));

export const supabaseAdmin = (isValidUrl(supabaseUrl) && supabaseServiceRoleKey)
  ? createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
  : null;

const updateLinkedAccountProfile = async (uid, patch) => {
  if (!supabaseAdmin) {
    throw new Error("Supabase Admin nao configurado.");
  }

  const updatedAt = new Date().toISOString();
  const { data: updatedProfile, error: updateError } = await supabaseAdmin
    .from("profiles")
    .update({ ...patch, updated_at: updatedAt })
    .eq("uid", uid)
    .select("uid")
    .maybeSingle();

  if (updateError) throw updateError;
  if (updatedProfile) return;

  const { data: authData, error: authError } =
    await supabaseAdmin.auth.admin.getUserById(uid);
  if (authError) throw authError;

  const authUser = authData?.user;
  const displayName = String(
    authUser?.user_metadata?.full_name
    || authUser?.user_metadata?.name
    || authUser?.email?.split("@")[0]
    || "Jogador",
  ).trim();

  const { error: insertError } = await supabaseAdmin.from("profiles").insert({
    uid,
    email: authUser?.email || null,
    display_name: displayName,
    ...patch,
    updated_at: updatedAt,
  });
  if (insertError) throw insertError;
};

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
export const resolveChatRetentionDays = (value) => {
  const parsed = Math.floor(Number(value));
  return Number.isFinite(parsed) && parsed >= 1 && parsed <= 365 ? parsed : 7;
};
const CHAT_RETENTION_DAYS = resolveChatRetentionDays(process.env.CHAT_RETENTION_DAYS);
const CHAT_RETENTION_MS = CHAT_RETENTION_DAYS * 24 * 60 * 60 * 1000;
const CHAT_CLEANUP_BATCH_SIZE = 200;
const CHAT_CLEANUP_MAX_BATCHES = 10;
const CHAT_CLEANUP_INTERVAL_MS = 6 * 60 * 60 * 1000;
let chatCleanupTail = Promise.resolve();

const runChatRetentionCleanup = async ({
  chatId = "",
  now = Date.now(),
} = {}) => {
  if (!supabaseAdmin) return { deletedMessages: 0, deletedAttachments: 0 };

  const cutoff = new Date(now - CHAT_RETENTION_MS).toISOString();
  let deletedMessages = 0;
  let deletedAttachments = 0;

  for (let batch = 0; batch < CHAT_CLEANUP_MAX_BATCHES; batch += 1) {
    let query = supabaseAdmin
      .from("chat_messages")
      .select("id,attachment_path")
      .lt("created_at", cutoff)
      .order("created_at", { ascending: true })
      .limit(CHAT_CLEANUP_BATCH_SIZE);
    if (chatId) query = query.eq("chat_id", chatId);

    const { data: expiredMessages, error: selectError } = await query;
    if (selectError) throw selectError;
    if (!expiredMessages?.length) break;

    const attachmentPaths = [...new Set(expiredMessages
      .map((message) => String(message.attachment_path || "").trim())
      .filter(Boolean))];
    let attachmentsRemoved = true;
    if (attachmentPaths.length > 0) {
      const { error: storageError } = await supabaseAdmin.storage
        .from("attachments")
        .remove(attachmentPaths);
      if (storageError) {
        attachmentsRemoved = false;
        console.error("Falha ao limpar anexos expirados do chat:", storageError.message);
      } else {
        deletedAttachments += attachmentPaths.length;
      }
    }

    const deletableIds = expiredMessages
      .filter((message) => attachmentsRemoved || !message.attachment_path)
      .map((message) => message.id);
    if (deletableIds.length > 0) {
      const { error: deleteError } = await supabaseAdmin
        .from("chat_messages")
        .delete()
        .in("id", deletableIds);
      if (deleteError) throw deleteError;
      deletedMessages += deletableIds.length;
    }

    if (!attachmentsRemoved || expiredMessages.length < CHAT_CLEANUP_BATCH_SIZE) break;
  }

  return { deletedMessages, deletedAttachments };
};

export const cleanupExpiredChatData = (options = {}) => {
  const queuedCleanup = chatCleanupTail.then(() => runChatRetentionCleanup(options));
  chatCleanupTail = queuedCleanup.catch(() => undefined);
  return queuedCleanup;
};

app.set("trust proxy", 1);
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://sdk.scdn.co"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
        imgSrc: ["'self'", "data:", "blob:", "https:", "http:"],
        mediaSrc: ["'self'", "data:", "blob:", "https:", "http:"],
        connectSrc: ["'self'", "https://*.supabase.co", "https://api.nexusmods.com", "https://api.spotify.com", "https://steamcommunity.com"],
        frameSrc: ["'self'", "https://sdk.scdn.co"],
        objectSrc: ["'none'"],
      },
    },
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

export const normalizeSteamPlayerProfile = (steamId, payload) => {
  const normalizedSteamId = String(steamId || "").trim();
  const player = Array.isArray(payload?.response?.players)
    ? payload.response.players.find(
      (candidate) => String(candidate?.steamid || "").trim() === normalizedSteamId,
    )
    : null;
  if (!player) return null;

  const username = String(player.personaname || "").trim().slice(0, 80);
  const rawAvatar = String(
    player.avatarfull || player.avatarmedium || player.avatar || "",
  ).trim();
  const avatar = rawAvatar.replace(/^http:\/\//i, "https://");

  return {
    steam_id: normalizedSteamId,
    steam_username: username || null,
    steam_avatar: /^https:\/\//i.test(avatar) ? avatar : null,
  };
};

const fetchSteamPlayerProfile = async (steamId) => {
  if (!steamApiKey) return null;

  const url = new URL("https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/");
  url.searchParams.set("key", steamApiKey);
  url.searchParams.set("steamids", steamId);
  url.searchParams.set("format", "json");

  const response = await fetchSteamWithTimeout(url.toString());
  if (!response.ok) {
    throw new Error(`Falha ao consultar perfil Steam (status ${response.status}).`);
  }
  return normalizeSteamPlayerProfile(steamId, await response.json());
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

const buildLauncherAuthCallback = (provider, status) => {
  const callbackUrl = new URL("checkpoint://auth/callback");
  callbackUrl.searchParams.set(`${provider}Status`, status);
  return callbackUrl.toString();
};

const buildDiscordRedirectUri = () => {
  const redirectUri = (
    process.env.DISCORD_REDIRECT_URI?.trim() ||
    `${backendPublicUrl}/auth/discord/callback`
  ).replace(/\/$/, "");

  if (/\.supabase\.co\/auth\/v1\/callback$/i.test(redirectUri)) {
    throw new Error(
      "DISCORD_REDIRECT_URI deve apontar para /auth/discord/callback do backend, nao para o callback do Supabase.",
    );
  }

  return redirectUri;
};

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

const buildOAuthSuccessPage = (platform, launcherCallbackUrl = "") => {
  const platformColors = {
    discord: "#5865F2",
    steam: "#66c0f4",
    xbox: "#107C10",
    playstation: "#0070D1",
    google: "#4285F4",
    github: "#8b8b8b",
  };
  const color = platformColors[String(platform).toLowerCase()] || "#22c55e";

  return `<!doctype html>
  <html lang="pt-BR">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>Checkpoint Launcher</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
          min-height: 100vh;
          display: grid;
          place-items: center;
          background: #000;
          color: #fff;
          font-family: Inter, system-ui, sans-serif;
        }
        main { width: 100%; max-width: 360px; padding: 24px; text-align: center; }
        .brand {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          margin-bottom: 40px;
        }
        .brand-logo {
          width: 22px;
          height: 22px;
          object-fit: contain;
          filter: drop-shadow(0 0 8px rgba(255,255,255,.12));
        }
        .brand-name {
          font-size: 13px;
          font-weight: 500;
          color: rgba(255,255,255,.55);
          letter-spacing: .02em;
        }
        h1 {
          font-size: 24px;
          font-weight: 500;
          letter-spacing: -0.01em;
          margin-bottom: 10px;
        }
        p.sub {
          font-size: 14px;
          color: rgba(255,255,255,.5);
          line-height: 1.6;
          margin-bottom: 28px;
        }
        .divider { height: 1px; background: rgba(255,255,255,.08); margin-bottom: 20px; }
        .footer { font-size: 12px; color: rgba(255,255,255,.35); }
        .footer .dot { color: rgba(255,255,255,.15); margin: 0 6px; }
        .footer a { color: ${color}; text-decoration: none; cursor: pointer; }
        .check-path {
          stroke-dasharray: 40;
          stroke-dashoffset: 40;
          animation: draw 0.6s ease forwards 0.15s;
        }
        @keyframes draw { to { stroke-dashoffset: 0; } }
        @media (prefers-reduced-motion: reduce) {
          .check-path { animation: none; stroke-dashoffset: 0; }
        }
      </style>
    </head>
    <body>
      <main>
        <div class="brand">
          <img
            class="brand-logo"
            src="${backendPublicUrl}/Checkpoint_Logo.png"
            alt="Checkpoint"
          />
          <span class="brand-name">Checkpoint Launcher</span>
        </div>

        <svg width="52" height="52" viewBox="0 0 52 52" style="margin-bottom:28px;">
          <circle cx="26" cy="26" r="23" fill="none" stroke="${color}" stroke-width="2" stroke-opacity="0.25"/>
          <path class="check-path" d="M15 27 L22 34 L37 18" fill="none" stroke="${color}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>

        <h1>${platform} conectado.</h1>
        <p class="sub">Sua conta foi vinculada com sucesso.<br/>Pode voltar pro launcher.</p>

        <div class="divider"></div>

        <p class="footer">
          Fechando em instantes<span class="dot">·</span><a id="close-now">fechar agora</a>
        </p>
      </main>
      <script>
        const launcherCallbackUrl = ${JSON.stringify(launcherCallbackUrl)};
        document.getElementById('close-now').addEventListener('click', () => {
          try { window.close(); } catch (e) {}
        });
        if (launcherCallbackUrl) {
          setTimeout(() => {
            try { window.location.assign(launcherCallbackUrl); } catch (e) {}
          }, 350);
        }
        setTimeout(() => { try { window.close(); } catch (e) {} }, 1800);
      </script>
    </body>
  </html>
  `;
};

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

const STORE_LOCALES = {
  "pt-BR": { locale: "pt-BR", steam: "brazilian", country: "BR" },
  "en-US": { locale: "en-US", steam: "english", country: "US" },
  "es-ES": { locale: "es-ES", steam: "spanish", country: "ES" },
  "fr-FR": { locale: "fr-FR", steam: "french", country: "FR" },
  "de-DE": { locale: "de-DE", steam: "german", country: "DE" },
  "it-IT": { locale: "it-IT", steam: "italian", country: "IT" },
};

const resolveStoreLocale = (value) =>
  STORE_LOCALES[String(value || "").trim()] || STORE_LOCALES["pt-BR"];

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

const fetchSteamAchievementSchema = async (appId, language = "pt-BR") => {
  const storeLocale = resolveStoreLocale(language);
  const cacheKey = `${appId}:${storeLocale.locale}`;
  const cached = achievementSchemaCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  const url = new URL(
    "https://api.steampowered.com/ISteamUserStats/GetSchemaForGame/v2/",
  );
  url.searchParams.set("key", steamApiKey);
  url.searchParams.set("appid", appId);
  url.searchParams.set("l", storeLocale.steam);

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

  achievementSchemaCache.set(cacheKey, {
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

const requireAuth = async (req, res, next) => {
  const header = String(req.headers.authorization ?? "");
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    res.status(401).json({ error: "Token de autenticacao ausente." });
    return;
  }

  if (!supabaseAdmin) {
    res.status(500).json({ error: "Servico de autenticacao Supabase nao configurado no servidor." });
    return;
  }

  try {
    const { data, error } = await supabaseAdmin.auth.getUser(match[1]);
    if (error || !data?.user) {
      res.status(401).json({ error: "Token de autenticacao invalido." });
      return;
    }

    const user = data.user;
    req.user = user;
    req.supabaseUser = user;
    req.firebaseUser = {
      uid: user.id,
      email: user.email || "",
      name: user.user_metadata?.full_name || user.user_metadata?.name || null,
      picture: user.user_metadata?.avatar_url || user.user_metadata?.picture || null,
    };
    next();
  } catch {
    res.status(401).json({ error: "Erro ao verificar autenticacao." });
  }
};

const requireFirebaseUser = requireAuth;

app.use(
  "/api/retroachievements",
  steamPrivateLimiter,
  createRetroAchievementsRouter({
    apiKey: process.env.RETROACHIEVEMENTS_API_KEY,
    fetchImpl: fetch,
    requireUser: requireFirebaseUser,
    loadProfile: async (uid) => {
      if (!supabaseAdmin) return null;
      const { data, error } = await supabaseAdmin
        .from("profiles")
        .select("retroachievements_ulid, retroachievements_username")
        .eq("uid", uid)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    saveProfile: updateLinkedAccountProfile,
  }),
);

app.use(
  "/api/thegamesdb",
  steamPrivateLimiter,
  createTheGamesDbRouter({
    apiKey: process.env.THEGAMESDB_API_KEY,
    fetchImpl: fetch,
  }),
);

app.post("/api/chat/open", steamPrivateLimiter, requireFirebaseUser, async (req, res) => {
  const currentUid = req.firebaseUser.uid;
  const friendUid = String(req.body?.friendUid || "").trim();
  if (!/^[0-9a-f-]{36}$/i.test(friendUid) || friendUid === currentUid) {
    res.status(400).json({ error: "Usuario invalido." });
    return;
  }

  try {
    const { data: friendship, error: friendshipError } = await supabaseAdmin
      .from("friendships")
      .select("requester_id")
      .eq("status", "accepted")
      .or(
        `and(requester_id.eq.${currentUid},addressee_id.eq.${friendUid}),`
        + `and(requester_id.eq.${friendUid},addressee_id.eq.${currentUid})`,
      )
      .maybeSingle();
    if (friendshipError) throw friendshipError;
    if (!friendship) {
      res.status(403).json({ error: "Chat disponivel apenas para amigos." });
      return;
    }

    const directKey = [currentUid, friendUid].sort().join(":");
    const { data: chat, error: chatError } = await supabaseAdmin
      .from("chats")
      .upsert({ direct_key: directKey }, { onConflict: "direct_key" })
      .select("id")
      .single();
    if (chatError || !chat?.id) throw chatError || new Error("Chat nao criado.");

    const { error: participantsError } = await supabaseAdmin
      .from("chat_participants")
      .upsert(
        [
          { chat_id: chat.id, user_id: currentUid },
          { chat_id: chat.id, user_id: friendUid },
        ],
        { onConflict: "chat_id,user_id" },
      );
    if (participantsError) throw participantsError;

    await cleanupExpiredChatData({ chatId: chat.id });

    res.json({ chatId: chat.id });
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

const steamIdCache = new Map();

const getLocalDatabasePath = () => {
  const home = os.homedir();
  if (process.platform === "win32") {
    return path.join(process.env.APPDATA || path.join(home, "AppData", "Roaming"), "checkpoint", "checkpoint-library.sqlite");
  } else if (process.platform === "darwin") {
    return path.join(home, "Library", "Application Support", "checkpoint", "checkpoint-library.sqlite");
  } else {
    return path.join(home, ".config", "checkpoint", "checkpoint-library.sqlite");
  }
};

const getLocalSteamId = (uid) => {
  const dbPath = getLocalDatabasePath();
  if (!fs.existsSync(dbPath)) return null;

  let db = null;
  try {
    db = new DatabaseSync(dbPath);
    const columns = db.prepare("PRAGMA table_info(library_state)").all();
    const hasSteamIdCol = columns.some((col) => col.name === "steam_id");
    if (!hasSteamIdCol) {
      db.close();
      return null;
    }

    const row = db.prepare("SELECT steam_id FROM library_state WHERE owner_uid = ?").get(uid);
    db.close();
    return row?.steam_id || null;
  } catch (error) {
    console.error("Erro ao ler SteamID do SQLite local:", error);
    if (db) {
      try { db.close(); } catch { }
    }
    return null;
  }
};

const saveLocalSteamId = (uid, steamId) => {
  const dbPath = getLocalDatabasePath();
  if (!fs.existsSync(dbPath)) return;

  let db = null;
  try {
    db = new DatabaseSync(dbPath);
    try {
      db.exec("ALTER TABLE library_state ADD COLUMN steam_id TEXT;");
    } catch {
      // Ignora se a coluna já existir
    }

    db.prepare(`
      INSERT INTO library_state (owner_uid, device_id, steam_id)
      VALUES (?, ?, ?)
      ON CONFLICT(owner_uid) DO UPDATE SET steam_id = excluded.steam_id
    `).run(uid, crypto.randomUUID(), steamId);
    db.close();
  } catch (error) {
    console.error("Erro ao salvar SteamID no SQLite local:", error);
    if (db) {
      try { db.close(); } catch { }
    }
  }
};

const clearLocalSteamId = (uid) => {
  const dbPath = getLocalDatabasePath();
  if (!fs.existsSync(dbPath)) return;

  let db = null;
  try {
    db = new DatabaseSync(dbPath);
    try {
      db.exec("ALTER TABLE library_state ADD COLUMN steam_id TEXT;");
    } catch {
      // Ignora se a coluna já existir
    }
    db.prepare(`
      UPDATE library_state SET steam_id = NULL WHERE owner_uid = ?
    `).run(uid);
    db.close();
  } catch (error) {
    console.error("Erro ao limpar SteamID no SQLite local:", error);
    if (db) {
      try { db.close(); } catch { }
    }
  }
};

const requireLinkedSteamId = async (req, res, next) => {
  const requestedSteamId = String(req.query.steamId ?? "").trim();
  if (requestedSteamId && !/^\d+$/.test(requestedSteamId)) {
    res.status(400).json({ error: "steamId inválido." });
    return;
  }

  const uid = req.firebaseUser.uid;

  // 🔥 PASSO 1: Verifica se este usuário já foi validado e está no cache de memória
  const cacheKey = `${uid}_${requestedSteamId}`;
  if (steamIdCache.has(cacheKey)) {
    req.steamId = steamIdCache.get(cacheKey);
    return next();
  }

  // 🔥 PASSO 1.5: Verifica se o SteamID já existe no SQLite local
  const cachedLocalSteamId = getLocalSteamId(uid);
  if (cachedLocalSteamId) {
    const resolution = resolveLinkedSteamId(cachedLocalSteamId, requestedSteamId);
    if (resolution.ok) {
      steamIdCache.set(cacheKey, resolution.steamId);
      req.steamId = resolution.steamId;
      return next();
    }
  }

  try {
    let steamIdFromDb = null;
    if (supabaseAdmin) {
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("steam_id")
        .eq("uid", uid)
        .maybeSingle();
      steamIdFromDb = profile?.steam_id;
    }

    const resolution = resolveLinkedSteamId(
      steamIdFromDb,
      requestedSteamId,
    );

    if (!resolution.ok) {
      res.status(resolution.status).json({ error: resolution.error });
      return;
    }

    steamIdCache.set(cacheKey, resolution.steamId);
    saveLocalSteamId(uid, resolution.steamId);

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

let cachedTurnCredentials = null;
let turnCacheExpiry = 0;
const TURN_CACHE_TTL_MS = 10 * 60 * 1000;

const FALLBACK_STUN_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun2.l.google.com:19302" },
];

app.get("/api/voice/turn-credentials", steamPrivateLimiter, requireFirebaseUser, async (_req, res) => {
  const meteredApiKey = (process.env.METERED_API_KEY || "").trim();
  const meteredAppName = (process.env.METERED_APP_NAME || "").trim();

  if (!meteredApiKey || !meteredAppName) {
    return res.json({ iceServers: FALLBACK_STUN_SERVERS });
  }

  const now = Date.now();
  if (cachedTurnCredentials && now < turnCacheExpiry) {
    return res.json({ iceServers: cachedTurnCredentials });
  }

  try {
    const url = `https://${meteredAppName}.metered.live/api/v1/turn/credentials?apiKey=${meteredApiKey}`;
    const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) {
      throw new Error(`Metered API retornou status ${response.status}`);
    }
    const servers = await response.json();
    if (Array.isArray(servers) && servers.length > 0) {
      cachedTurnCredentials = servers;
      turnCacheExpiry = now + TURN_CACHE_TTL_MS;
      return res.json({ iceServers: servers });
    }
    return res.json({ iceServers: FALLBACK_STUN_SERVERS });
  } catch (error) {
    console.warn("[TURN] Falha ao obter credenciais Metered no backend, usando STUN fallback:", error?.message);
    return res.json({ iceServers: FALLBACK_STUN_SERVERS });
  }
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

// Image proxy — bypasses hotlinking/referer restrictions on news sources
const ALLOWED_IMAGE_HOSTS = [
  "gamevicio.com",
  "adrenaline.com.br",
  "i.imgur.com",
  "cdn.gamevicio.com",
  "sm.ign.com",
  "assets.gamevicio.com",
];
app.get("/api/proxy/image", steamPublicLimiter, async (req, res) => {
  const raw = String(req.query.url || "").trim();
  if (!raw) return res.status(400).end();
  let target;
  try {
    target = new URL(raw);
    if (target.protocol !== "https:") return res.status(400).end();
    const hostOk = ALLOWED_IMAGE_HOSTS.some(
      (h) => target.hostname === h || target.hostname.endsWith("." + h),
    );
    if (!hostOk) return res.status(403).end();
  } catch {
    return res.status(400).end();
  }
  try {
    const upstream = await fetch(target.toString(), {
      signal: AbortSignal.timeout(8_000),
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        Referer: `https://${target.hostname}/`,
        Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
      },
    });
    if (!upstream.ok) return res.status(502).end();
    const ct = upstream.headers.get("content-type") || "image/jpeg";
    if (!ct.startsWith("image/")) return res.status(502).end();
    res.set("Content-Type", ct);
    res.set("Cache-Control", "public, max-age=86400");
    res.set("Access-Control-Allow-Origin", "*");
    const buf = await upstream.arrayBuffer();
    return res.send(Buffer.from(buf));
  } catch {
    return res.status(502).end();
  }
});

export const normalizeNexusTrendingMods = (payload) => {
  const mods = Array.isArray(payload?.data?.mods) ? payload.data.mods : [];
  return mods.slice(0, 12).map((mod, index) => {
    const modPageUrl = String(mod?.mod_page_url || "").trim();
    const pictureUrl = String(mod?.picture_url || "").trim();
    return {
      id: modPageUrl || `nexus-trending-${index}`,
      name: String(mod?.name || "Mod sem nome").trim().slice(0, 160),
      author: String(mod?.author || "").trim().slice(0, 100),
      summary: String(mod?.summary || "").trim().slice(0, 800),
      pictureUrl: /^https:\/\//i.test(pictureUrl) ? pictureUrl : "",
      modPageUrl: /^https:\/\/(?:www\.)?nexusmods\.com\//i.test(modPageUrl)
        ? modPageUrl
        : "",
    };
  }).filter((mod) => mod.name && mod.modPageUrl);
};

app.get("/api/nexus/games/:gameDomain/trending-mods", steamPublicLimiter, async (req, res) => {
  const gameDomain = String(req.params.gameDomain || "").trim().toLowerCase();
  if (!/^[a-z0-9-]{2,80}$/.test(gameDomain)) {
    res.status(400).json({ error: "Dominio Nexus invalido." });
    return;
  }

  try {
    const response = await fetch(
      `https://api.nexusmods.com/v3/games/${encodeURIComponent(gameDomain)}/trending-mods`,
      {
        headers: {
          Accept: "application/json",
          "Application-Name": "Checkpoint Launcher",
          "Application-Version": "3.0.0",
        },
        signal: AbortSignal.timeout(12_000),
      },
    );
    if (response.status === 404) {
      res.status(404).json({ error: "Jogo nao encontrado no Nexus Mods." });
      return;
    }
    if (!response.ok) {
      res.status(502).json({ error: `Nexus Mods respondeu com status ${response.status}.` });
      return;
    }
    res.json({ mods: normalizeNexusTrendingMods(await response.json()) });
  } catch (error) {
    res.status(error?.name === "TimeoutError" ? 504 : 502).json({
      error: error?.name === "TimeoutError"
        ? "A Nexus Mods demorou demais para responder."
        : "Nao foi possivel consultar a Nexus Mods.",
    });
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

const profileRowToPublic = (row = {}) => {
  const presenceUpdatedAt = Date.parse(String(row.presence_updated_at || ""));
  const presenceIsFresh =
    Number.isFinite(presenceUpdatedAt) && Date.now() - presenceUpdatedAt < 2 * 60 * 1000;
  const status = presenceIsFresh && ["online", "playing"].includes(row.status)
    ? row.status
    : "offline";

  return {
    uid: String(row.uid || ""),
    displayName: String(
      row.display_name || row.discord_username || row.steam_username || "Jogador",
    ),
    photoURL: row.photo_url || row.discord_avatar || row.steam_avatar || "",
    discordAvatar: row.discord_avatar || "",
    discordUsername: row.discord_username || "",
    steamAvatar: row.steam_avatar || "",
    steamUsername: row.steam_username || "",
    status,
    playing: status === "playing" ? row.playing || null : null,
  };
};

export const canViewDetailedProfile = ({
  visibility,
  isSelf,
  isAcceptedFriend,
}) => visibility !== "private" || Boolean(isSelf) || Boolean(isAcceptedFriend);

export const projectSearchProfile = (row = {}) => {
  const profileVisibility = row.profile_visibility === "private" ? "private" : "public";
  const identity = {
    uid: String(row.uid || ""),
    displayName: String(row.display_name || "Jogador"),
    photoURL: row.photo_url || row.discord_avatar || row.steam_avatar || "",
    profileVisibility,
  };
  if (profileVisibility === "private") return identity;
  return { ...profileRowToPublic(row), profileVisibility };
};

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
  if (!ownerUid || !removedUid || ownerUid === removedUid) return 0;
  if (firestore && typeof firestore.collection === "function") {
    let revoked = 0;
    while (true) {
      const snapshot = await firestore
        .collection("activities")
        .where("userId", "==", ownerUid)
        .where("audienceIds", "array-contains", removedUid)
        .limit(ACTIVITY_AUDIENCE_REVOKE_BATCH_SIZE)
        .get();
      if (!snapshot || snapshot.empty) break;

      const batch = firestore.batch();
      snapshot.docs.forEach((activityDoc) => {
        batch.update(activityDoc.ref, {
          audienceIds: Array.isArray(activityDoc.data?.()?.audienceIds)
            ? activityDoc.data().audienceIds.filter((id) => id !== removedUid)
            : [],
        });
        batch.delete(firestore.doc(`feeds/${removedUid}/activities/${activityDoc.id}`));
      });
      await batch.commit();
      revoked += snapshot.size;
    }
    return revoked;
  }

  if (supabaseAdmin) {
    const { data: activities } = await supabaseAdmin
      .from("activities")
      .select("id, audience_ids")
      .eq("user_id", ownerUid);

    if (activities) {
      for (const item of activities) {
        const currentAudience = Array.isArray(item.audience_ids) ? item.audience_ids : [];
        if (currentAudience.includes(removedUid)) {
          const updated = currentAudience.filter((id) => id !== removedUid);
          await supabaseAdmin
            .from("activities")
            .update({ audience_ids: updated })
            .eq("id", item.id);
        }
      }
    }
  }
  return 0;
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
    const [{ data: profile, error: profileError }, { data: friendships, error: friendsError }] =
      await Promise.all([
        supabaseAdmin.from("profiles").select("*").eq("uid", uid).single(),
        supabaseAdmin
          .from("friendships")
          .select("requester_id,addressee_id")
          .eq("status", "accepted")
          .or(`requester_id.eq.${uid},addressee_id.eq.${uid}`),
      ]);
    if (profileError) throw profileError;
    if (friendsError) throw friendsError;

    const friendIds = (friendships || []).map((friendship) =>
      friendship.requester_id === uid
        ? friendship.addressee_id
        : friendship.requester_id,
    );
    const audienceIds = [uid, ...friendIds].slice(0, 200);
    const userName = socialText(
      profile.display_name
      || profile.discord_username
      || req.firebaseUser.name
      || req.firebaseUser.email?.split("@")[0]
      || "Jogador",
      80,
    ) || "Jogador";
    const userAvatar = socialImageUrl(
      profile.discord_avatar
      || profile.photo_url
      || profile.steam_avatar
      || req.firebaseUser.picture,
    );
    const payload = {
      user_id: uid,
      user_name: userName,
      user_avatar: userAvatar || null,
      audience_ids: audienceIds,
      kind: activity.kind,
      game_id: activity.gameId || null,
      game_title: activity.gameTitle || null,
      game_image: activity.gameImage || null,
      achievement_id: activity.achievementId || null,
      achievement_name: activity.achievementName || null,
      achievement_icon: activity.achievementIcon || null,
      caption: activity.caption || null,
    };

    const { data: created, error: insertError } = await supabaseAdmin
      .from("activities")
      .insert(payload)
      .select("id")
      .single();
    if (insertError?.code === "23505" && activity.kind === "achievement") {
      res.status(200).json({ ok: true, duplicate: true });
      return;
    }
    if (insertError) throw insertError;

    res.status(201).json({ ok: true, id: created.id, duplicate: false });
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
    const safeTerm = term.replace(/[%_,()]/g, " ").trim();
    const found = new Map();
    const columns = "uid,display_name,photo_url,discord_username,discord_avatar,steam_username,steam_avatar,status,playing,presence_updated_at,profile_visibility";
    const nameQuery = supabaseAdmin
      .from("profiles")
      .select(columns)
      .neq("uid", req.firebaseUser.uid)
      .or(`display_name.ilike.%${safeTerm}%,discord_username.ilike.%${safeTerm}%,steam_username.ilike.%${safeTerm}%`)
      .limit(25);
    const emailQuery = term.includes("@")
      ? supabaseAdmin
        .from("profiles")
        .select(columns)
        .neq("uid", req.firebaseUser.uid)
        .eq("email", term)
        .limit(1)
      : Promise.resolve({ data: [], error: null });
    const [nameResult, emailResult] = await Promise.all([nameQuery, emailQuery]);
    if (nameResult.error) throw nameResult.error;
    if (emailResult.error) throw emailResult.error;
    [...(emailResult.data || []), ...(nameResult.data || [])].forEach((row) => {
      found.set(row.uid, projectSearchProfile(row));
    });
    const users = Array.from(found.values()).slice(0, 25);

    res.json({ users });
  } catch (error) {
    console.error("Erro ao buscar usuarios:", error);
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
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({
        status,
        playing: status === "playing" ? currentGameTitle : null,
        presence_updated_at: new Date().toISOString(),
      })
      .eq("uid", req.firebaseUser.uid);
    if (error) throw error;
    res.json({ ok: true });
  } catch (error) {
    console.error("Erro ao atualizar presenca:", error);
    res.status(500).json({ error: "Erro ao atualizar presença." });
  }
});

app.get("/api/friends/status", steamPrivateLimiter, requireFirebaseUser, async (req, res) => {
  try {
    const uid = req.firebaseUser.uid;
    const { data: friendships, error: friendshipsError } = await supabaseAdmin
      .from("friendships")
      .select("requester_id,addressee_id")
      .eq("status", "accepted")
      .or(`requester_id.eq.${uid},addressee_id.eq.${uid}`);
    if (friendshipsError) throw friendshipsError;
    const friendRefs = (friendships || []).map((friendship) =>
      friendship.requester_id === uid
        ? friendship.addressee_id
        : friendship.requester_id,
    );

    if (friendRefs.length === 0) {
      res.json({ friends: [] });
      return;
    }

    const { data: profiles, error: profilesError } = await supabaseAdmin
      .from("profiles")
      .select("uid,display_name,photo_url,discord_username,discord_avatar,steam_username,steam_avatar,status,playing,presence_updated_at")
      .in("uid", friendRefs);
    if (profilesError) throw profilesError;
    res.json({
      friends: (profiles || []).map((profile) =>
        compactFriendProfile(profileRowToPublic(profile)),
      ),
    });
  } catch (error) {
    console.error("Erro ao consultar presenca:", error);
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
    const currentUid = req.firebaseUser.uid;
    const [friendshipResult, visibilityResult] = await Promise.all([
      supabaseAdmin
        .from("friendships")
        .select("requester_id")
        .eq("status", "accepted")
        .or(
          `and(requester_id.eq.${currentUid},addressee_id.eq.${friendUid}),`
          + `and(requester_id.eq.${friendUid},addressee_id.eq.${currentUid})`,
        )
        .maybeSingle(),
      supabaseAdmin
        .from("profiles")
        .select("profile_visibility")
        .eq("uid", friendUid)
        .maybeSingle(),
    ]);
    const { data: friendship, error: friendshipError } = friendshipResult;
    const { data: visibilityRow, error: visibilityError } = visibilityResult;
    if (friendshipError) throw friendshipError;
    if (visibilityError) throw visibilityError;
    if (!visibilityRow) {
      res.status(404).json({ error: "Perfil não encontrado." });
      return;
    }
    if (!canViewDetailedProfile({
      visibility: visibilityRow.profile_visibility,
      isSelf: currentUid === friendUid,
      isAcceptedFriend: Boolean(friendship),
    })) {
      res.status(403).json({ error: "Perfil privado disponível apenas para amigos." });
      return;
    }

    const [{ data: publicRow, error: publicError }, { data: privateRow, error: privateError }] =
      await Promise.all([
        supabaseAdmin.from("public_profiles").select("*").eq("uid", friendUid).maybeSingle(),
        supabaseAdmin
          .from("profiles")
          .select("uid,steam_id,steam_username,steam_avatar,discord_id,discord_username,discord_avatar,status,playing,presence_updated_at")
          .eq("uid", friendUid)
          .maybeSingle(),
      ]);
    if (publicError) throw publicError;
    if (privateError) throw privateError;
    if (!publicRow) {
      res.status(404).json({ error: "Perfil não encontrado." });
      return;
    }

    const visibleProfile = profileRowToPublic({
      ...privateRow,
      display_name: publicRow.display_name,
      photo_url: publicRow.photo_url,
    });
    const sqlTopGames = Array.isArray(publicRow.top_games) ? publicRow.top_games : [];
    const sqlFavoriteGames = Array.isArray(publicRow.favorite_games)
      ? publicRow.favorite_games
      : [];
    const sqlGames = Array.from(
      new Map(
        [
          ...sqlTopGames.map((game) => ({ ...game, isFavorite: Boolean(game?.isFavorite) })),
          ...sqlFavoriteGames.map((game) => ({ ...game, isFavorite: true })),
        ].map((game) => [String(game?.id || ""), game]),
      ).values(),
    ).filter((game) => game?.id).slice(0, FRIEND_PROFILE_GAME_LIMIT);

    res.json({
      profile: {
        ...visibleProfile,
        profileVisibility: visibilityRow.profile_visibility === "private" ? "private" : "public",
        bio: publicRow.bio || "",
        website: publicRow.website || "",
        favoriteGenres: publicRow.favorite_genres || [],
        steamId: privateRow?.steam_id || "",
        steamUsername: privateRow?.steam_username || "",
        steamAvatar: privateRow?.steam_avatar || "",
        discordId: privateRow?.discord_id || "",
        discordUsername: privateRow?.discord_username || "",
        discordAvatar: privateRow?.discord_avatar || "",
        achievementSummary: publicRow.achievements || {},
        librarySummary: {
          ...(publicRow.stats || {}),
          ...(publicRow.platforms || {}),
          steamGames: publicRow.platforms?.steamGameCount ?? publicRow.stats?.steamGames ?? 0,
          epicGames: publicRow.platforms?.epicGameCount ?? publicRow.stats?.epicGames ?? 0,
          localGames: publicRow.platforms?.localGameCount ?? publicRow.stats?.localGames ?? 0,
        },
      },
      games: sqlGames,
      gamesTruncated: false,
    });
    return;

    const firestore = getFirestore();
    const [profileSnap, linkedProfileSnap] = await Promise.all([
      firestore.doc(`publicProfiles/${friendUid}`).get(),
      firestore.doc(`profiles/${friendUid}`).get(),
    ]);
    if (!profileSnap.exists) {
      res.status(404).json({ error: "Perfil não encontrado." });
      return;
    }

    const profileData = profileSnap.data() || {};
    const stats = profileData.stats || {};
    const achievements = profileData.achievements || {};
    const platforms = profileData.platforms || {};
    const linkedProfile = linkedProfileSnap.exists ? linkedProfileSnap.data() || {} : {};
    const steamId = String(platforms.steamId || linkedProfile.steamId || "").trim();
    const discordId = String(platforms.discordId || linkedProfile.discordId || "").trim();
    const steamUsername = String(platforms.steamUsername || linkedProfile.steamUsername || "").trim();
    const discordUsername = String(platforms.discordUsername || linkedProfile.discordUsername || "").trim();
    const steamAvatar = String(platforms.steamAvatar || linkedProfile.steamAvatar || "").trim();
    const discordAvatar = String(platforms.discordAvatar || linkedProfile.discordAvatar || "").trim();
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
        steamId: /^\d{10,20}$/.test(steamId) ? steamId : "",
        discordId: /^\d{10,24}$/.test(discordId) ? discordId : "",
        steamUsername: steamUsername.slice(0, 80),
        discordUsername: discordUsername.slice(0, 80),
        steamAvatar: /^https:\/\//i.test(steamAvatar) ? steamAvatar : "",
        discordAvatar: /^https:\/\//i.test(discordAvatar) ? discordAvatar : "",
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
    const currentUid = req.firebaseUser.uid;
    const { data: target, error: targetError } = await supabaseAdmin
      .from("profiles")
      .select("uid,display_name,photo_url,discord_username,discord_avatar,steam_username,steam_avatar,status,playing,presence_updated_at")
      .eq("uid", friendUid)
      .maybeSingle();
    if (targetError) throw targetError;
    if (!target) {
      res.status(404).json({ error: "Usuário não encontrado." });
      return;
    }

    const { data: existing, error: existingError } = await supabaseAdmin
      .from("friendships")
      .select("requester_id,addressee_id,status")
      .or(
        `and(requester_id.eq.${currentUid},addressee_id.eq.${friendUid}),`
        + `and(requester_id.eq.${friendUid},addressee_id.eq.${currentUid})`,
      )
      .maybeSingle();
    if (existingError) throw existingError;
    if (existing?.status === "accepted") {
      res.status(409).json({ error: "Usuário já está na sua lista de amigos." });
      return;
    }
    if (existing) {
      res.status(409).json({ error: "Já existe uma solicitação entre estes usuários." });
      return;
    }

    const { error: insertError } = await supabaseAdmin.from("friendships").insert({
      requester_id: currentUid,
      addressee_id: friendUid,
      status: "pending",
    });
    if (insertError) throw insertError;
    res.status(201).json({
      request: {
        ...compactFriendProfile(profileRowToPublic(target)),
        createdAt: new Date().toISOString(),
      },
    });
    return;

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
    const currentUid = req.firebaseUser.uid;
    const { data: accepted, error: acceptError } = await supabaseAdmin
      .from("friendships")
      .update({ status: "accepted" })
      .eq("requester_id", requesterUid)
      .eq("addressee_id", currentUid)
      .eq("status", "pending")
      .select("requester_id")
      .maybeSingle();
    if (acceptError) throw acceptError;
    if (!accepted) {
      res.status(404).json({ error: "Solicitação não encontrada." });
      return;
    }
    const { data: requester, error: requesterError } = await supabaseAdmin
      .from("profiles")
      .select("uid,display_name,photo_url,discord_username,discord_avatar,steam_username,steam_avatar,status,playing,presence_updated_at")
      .eq("uid", requesterUid)
      .single();
    if (requesterError) throw requesterError;
    res.json({ friend: compactFriendProfile(profileRowToPublic(requester)) });
    return;

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
    const { data: rejected, error: rejectError } = await supabaseAdmin
      .from("friendships")
      .delete()
      .eq("requester_id", requesterUid)
      .eq("addressee_id", req.firebaseUser.uid)
      .eq("status", "pending")
      .select("requester_id")
      .maybeSingle();
    if (rejectError) throw rejectError;
    if (!rejected) {
      res.status(404).json({ error: "Solicitação não encontrada." });
      return;
    }
    res.json({ ok: true });
    return;

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
    const { data: removed, error: removeError } = await supabaseAdmin
      .from("friendships")
      .delete()
      .eq("status", "accepted")
      .or(
        `and(requester_id.eq.${currentUid},addressee_id.eq.${friendUid}),`
        + `and(requester_id.eq.${friendUid},addressee_id.eq.${currentUid})`,
      )
      .select("requester_id");
    if (removeError) throw removeError;
    if (!removed?.length) {
      res.status(404).json({ error: "Amizade não encontrada." });
      return;
    }
    const [sqlRevokedFromCurrent, sqlRevokedFromFriend] = await Promise.all([
      revokeActivityAudience(null, currentUid, friendUid),
      revokeActivityAudience(null, friendUid, currentUid),
    ]);
    res.json({
      ok: true,
      revokedActivities: sqlRevokedFromCurrent + sqlRevokedFromFriend,
    });
    return;

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
    const currentUid = req.firebaseUser.uid;
    const { data: target, error: targetError } = await supabaseAdmin
      .from("profiles")
      .select("uid,display_name,photo_url,discord_username,discord_avatar,steam_username,steam_avatar,status,playing,presence_updated_at")
      .eq("uid", friendUid)
      .maybeSingle();
    if (targetError) throw targetError;
    if (!target) {
      res.status(404).json({ error: "Usuário não encontrado." });
      return;
    }
    const { error: friendshipError } = await supabaseAdmin.from("friendships").upsert(
      {
        requester_id: currentUid,
        addressee_id: friendUid,
        status: "accepted",
      },
      { onConflict: "requester_id,addressee_id" },
    );
    if (friendshipError) throw friendshipError;
    res.json({ friend: compactFriendProfile(profileRowToPublic(target)) });
    return;

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
    const currentUid = req.firebaseUser.uid;
    const { error } = await supabaseAdmin
      .from("friendships")
      .delete()
      .or(
        `and(requester_id.eq.${currentUid},addressee_id.eq.${friendUid}),`
        + `and(requester_id.eq.${friendUid},addressee_id.eq.${currentUid})`,
      );
    if (error) throw error;
    res.json({ ok: true });
    return;

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

app.post("/api/auth/logout", requireFirebaseUser, (req, res) => {
  const uid = req.firebaseUser.uid;

  for (const key of steamIdCache.keys()) {
    if (key.startsWith(`${uid}_`)) {
      steamIdCache.delete(key);
    }
  }

  clearLocalSteamId(uid);
  res.json({ ok: true });
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

const renderAuthSuccessScreen = (serviceName = "Conta", launcherCallbackUrl = "") =>
  buildOAuthSuccessPage(serviceName, launcherCallbackUrl);

app.get("/auth/google/start", steamAuthLimiter, (req, res) => {
  cleanupPendingDesktopGoogleStates();

  const state = String(req.query.state ?? "").trim();
  if (!state) {
    res.status(400).send("state ausente.");
    return;
  }

  if (!supabaseAdmin) {
    res.status(500).send("Supabase Admin nao configurado no backend.");
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

  if (!supabaseAdmin) {
    res.status(500).send("Supabase Admin nao configurado no backend.");
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
    const userEmail = payload?.email;

    if (!userEmail) {
      throw new Error("Google nao retornou email.");
    }

    let emailOtp = null;
    let supaUid = null;

    if (supabaseAdmin) {
      let linkData;
      let linkErr;
      ({ data: linkData, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
        type: "magiclink",
        email: userEmail,
      }));

      if (linkErr) {
        console.warn("[google-oauth] generateLink falhou, criando novo usuário no Supabase Auth:", linkErr.message);
        const { data: createdUserData, error: createErr } = await supabaseAdmin.auth.admin.createUser({
          email: userEmail,
          email_confirm: true,
          user_metadata: {
            full_name: payload.name || payload.given_name || userEmail.split("@")[0],
            name: payload.name || userEmail.split("@")[0],
            avatar_url: payload.picture || null,
          },
        });

        if (createErr && !createErr.message?.includes("already been registered")) {
          console.error("[google-oauth] Erro ao criar usuário:", createErr);
          throw linkErr;
        }

        ({ data: linkData, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
          type: "magiclink",
          email: userEmail,
        }));
        if (linkErr) throw linkErr;
      }

      emailOtp = linkData?.properties?.email_otp || null;
      supaUid = linkData?.user?.id || null;

      try {
        const updatedAt = new Date().toISOString();
        const { data: existingProfile, error: updateError } = await supabaseAdmin
          .from("profiles")
          .update({
            email: userEmail,
            updated_at: updatedAt,
          })
          .eq("uid", supaUid)
          .select("uid")
          .maybeSingle();
        if (updateError) throw updateError;

        if (!existingProfile) {
          const { error: insertError } = await supabaseAdmin.from("profiles").upsert(
            {
              uid: supaUid,
              email: userEmail,
              display_name: payload.name || userEmail.split("@")[0],
              photo_url: payload.picture || null,
              updated_at: updatedAt,
            },
            {
              onConflict: "uid",
              ignoreDuplicates: true,
            },
          );
          if (insertError) throw insertError;
        }
      } catch (err) {
        console.warn("[google-oauth] Aviso ao atualizar perfil:", err?.message || err);
      }
    }

    pendingDesktopGoogleStates.set(state, {
      email: userEmail,
      emailOtp,
      uid: supaUid,
      createdAt: Date.now(),
    });

    res.type("html").send(renderAuthSuccessScreen("Google"));
  } catch (error) {
    pendingDesktopGoogleStates.delete(state);
    res
      .status(500)
      .send(error instanceof Error ? error.message : "Falha ao concluir login Google.");
  }
});

app.post("/auth/desktop/google/complete", steamAuthLimiter, async (req, res) => {
  res.json({ ok: true });
});

app.get("/auth/desktop/google/status", steamPublicLimiter, (req, res) => {
  cleanupPendingDesktopGoogleStates();

  const state = String(req.query.state ?? "").trim();
  if (!state) {
    res.status(400).json({ error: "state ausente." });
    return;
  }

  const pending = pendingDesktopGoogleStates.get(state);
  if (!pending || (!pending.emailOtp && !pending.email)) {
    res.json({ status: "pending" });
    return;
  }

  pendingDesktopGoogleStates.delete(state);
  res.json({
    status: "complete",
    email: pending.email,
    emailOtp: pending.emailOtp,
    uid: pending.uid,
  });
});

app.get("/auth/steam/callback", steamAuthLimiter, async (req, res) => {
  cleanupPendingStates();
  const token = String(req.query.token ?? "");
  const pending = pendingStates.get(token);
  if (!pending) {
    res.redirect(buildLauncherAuthCallback("steam", "invalid_state"));
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
      res.redirect(buildLauncherAuthCallback("steam", "invalid"));
      return;
    }

    const claimedId = String(req.query["openid.claimed_id"] ?? "");
    const match = claimedId.match(/\/id\/(\d+)$/);
    const steamId = match?.[1];
    if (!steamId) {
      res.redirect(buildLauncherAuthCallback("steam", "missing_id"));
      return;
    }

    if (!supabaseAdmin) {
      res.redirect(buildLauncherAuthCallback("steam", "server_not_configured"));
      return;
    }

    const steamProfile = await fetchSteamPlayerProfile(steamId).catch((error) => {
      console.warn("[steam] Perfil publico indisponivel durante a vinculacao:", error?.message || error);
      return null;
    });
    await updateLinkedAccountProfile(
      pending.firebaseUid,
      steamProfile || { steam_id: steamId },
    );

    res.type("html").send(
      renderAuthSuccessScreen("Steam", buildLauncherAuthCallback("steam", "ok")),
    );
  } catch (error) {
    console.error("[steam] Falha ao concluir vinculacao:", error);
    res.redirect(buildLauncherAuthCallback("steam", "error"));
  }
});

app.get("/auth/discord/callback", steamAuthLimiter, async (req, res) => {
  cleanupPendingDiscordStates();
  const state = String(req.query.state ?? "");
  const pending = pendingDiscordStates.get(state);
  if (!pending) {
    res.redirect(buildLauncherAuthCallback("discord", "invalid_state"));
    return;
  }
  pendingDiscordStates.delete(state);

  const oauthError = String(req.query.error ?? "").trim();
  if (oauthError) {
    res.redirect(buildLauncherAuthCallback("discord", "denied"));
    return;
  }

  const code = String(req.query.code ?? "").trim();
  if (!code) {
    res.redirect(buildLauncherAuthCallback("discord", "missing_code"));
    return;
  }

  if (!discordClientId || !discordClientSecret) {
    res.redirect(buildLauncherAuthCallback("discord", "client_not_configured"));
    return;
  }

  if (!supabaseAdmin) {
    res.redirect(buildLauncherAuthCallback("discord", "server_not_configured"));
    return;
  }

  try {
    const { response: tokenResponse, payload: tokenPayload } =
      await requestDiscordToken(code);

    if (!tokenResponse.ok) {
      res.redirect(buildLauncherAuthCallback("discord", "token_error"));
      return;
    }

    const userResponse = await fetch(discordCurrentUserEndpoint, {
      headers: {
        Authorization: `${tokenPayload.token_type ?? "Bearer"} ${tokenPayload.access_token}`,
      },
    });
    const discordUser = await userResponse.json().catch(() => ({}));

    if (!userResponse.ok || !discordUser?.id) {
      res.redirect(buildLauncherAuthCallback("discord", "missing_id"));
      return;
    }

    const username = discordDisplayName(discordUser);
    const avatar = discordAvatarUrl(discordUser);
    const discordFriends = await fetchDiscordFriends(
      tokenPayload.access_token,
      tokenPayload.token_type ?? "Bearer",
    );

    await updateLinkedAccountProfile(pending.firebaseUid, {
      discord_id: String(discordUser.id),
      discord_username: username,
      discord_avatar: avatar,
      discord_friends: discordFriends,
    });

    res.type("html").send(
      renderAuthSuccessScreen("Discord", buildLauncherAuthCallback("discord", "ok")),
    );
  } catch (error) {
    console.error("[discord] Falha ao concluir vinculacao:", error);
    res.redirect(buildLauncherAuthCallback("discord", "error"));
  }
});

app.post("/api/steam/disconnect", steamPrivateLimiter, requireFirebaseUser, async (req, res) => {
  try {
    await updateLinkedAccountProfile(req.firebaseUser.uid, {
      steam_id: null,
      steam_username: null,
      steam_avatar: null,
    });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Erro ao desconectar Steam." });
  }
});

app.post("/api/discord/disconnect", steamPrivateLimiter, requireFirebaseUser, async (req, res) => {
  try {
    await updateLinkedAccountProfile(req.firebaseUser.uid, {
      discord_id: null,
      discord_username: null,
      discord_avatar: null,
      discord_friends: [],
    });
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

    const steamProfile = await fetchSteamPlayerProfile(steamId).catch((error) => {
      console.warn("[steam] Nao foi possivel atualizar nome/avatar:", error?.message || error);
      return null;
    });
    if (steamProfile) {
      await updateLinkedAccountProfile(req.firebaseUser.uid, steamProfile);
    }

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

const fetchSteamSearchItems = async (query, language = "pt-BR") => {
  const storeLocale = resolveStoreLocale(language);
  const url = new URL("https://store.steampowered.com/api/storesearch/");
  url.searchParams.set("term", query);
  url.searchParams.set("l", storeLocale.steam);
  url.searchParams.set("cc", storeLocale.country);
  const response = await fetch(url.toString(), { headers: steamStoreFetchHeaders });
  if (!response.ok) {
    throw new Error(`Falha na busca Steam Store (status ${response.status}).`);
  }
  const payload = await response.json();
  return Array.isArray(payload?.items) ? payload.items : [];
};

const handleSteamSearch = async (req, res) => {
  const query = String(req.query.query ?? "").trim();
  if (query.length < 2) {
    res.status(400).json({ error: "Query de busca muito curta." });
    return;
  }

  try {
    res.json({ items: await fetchSteamSearchItems(query, req.query.language) });
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
    }).catch(() => ({ ok: false, status: 0, payload: null }));

    const payload = result.payload ?? {};
    if (!result.ok || (Array.isArray(payload?.errors) && payload.errors.length > 0)) {
      res.status(502).json({
        error: `Falha na busca da Epic Games Store (status ${result.status}).`,
      });
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
          catalogId,
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
  const storeLocale = resolveStoreLocale(req.query.language);
  if (!catalogId || !namespace) {
    res.status(400).json({ error: "catalogId ou namespace inválido." });
    return;
  }

  const cacheKey = `epic_${namespace}_${catalogId}_${storeLocale.locale}`;
  const cached = appDetailsCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    res.json(cached.data);
    return;
  }

  try {
    const catalogItem = await fetchEpicCatalogItem(
      namespace,
      catalogId,
      storeLocale.locale,
    );
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
  const storeLocale = resolveStoreLocale(req.query.language);

  if (!/^\d+$/.test(appId)) {
    res.status(400).json({ error: "appId inválido." });
    return;
  }

  const cacheKey = `${steamId}_${appId}_${storeLocale.locale}`;
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
    url.searchParams.set("l", storeLocale.steam);

    const [response, schema] = await Promise.all([
      fetch(url.toString()),
      fetchSteamAchievementSchema(appId, storeLocale.locale).catch(() => []),
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
  const storeLocale = resolveStoreLocale(req.query.language);
  if (!/^\d+$/.test(appId)) {
    res.status(400).json({ error: "appId invalido." });
    return;
  }

  try {
    const schema = await fetchSteamAchievementSchema(appId, storeLocale.locale);
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
  const storeLocale = resolveStoreLocale(req.query.language);
  if (!/^\d+$/.test(appId)) {
    res.status(400).json({ error: "appId inválido." });
    return;
  }

  const cacheKey = `steam:${appId}:${storeLocale.locale}`;
  const cached = appDetailsCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    res.json(cached.data);
    return;
  }

  try {
    const url = new URL("https://store.steampowered.com/api/appdetails");
    url.searchParams.set("appids", appId);
    url.searchParams.set("l", storeLocale.steam);
    url.searchParams.set("cc", storeLocale.country);

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

    appDetailsCache.set(cacheKey, { data: result, timestamp: Date.now() });
    res.json(result);
  } catch {
    res.status(500).json({ error: "Erro interno ao buscar detalhes do jogo." });
  }
});

app.use(express.static(path.join(__dirname, "../dist")));

app.get("/{*path}", (req, res) => {
  res.sendFile(path.join(__dirname, "../dist/index.html"));
});

export const startServer = () => {
  const server = app.listen(port, () => {
    console.log(`Backend ativo em http://localhost:${port}`);
    void cleanupExpiredChatData()
      .then(({ deletedMessages, deletedAttachments }) => {
        if (deletedMessages > 0 || deletedAttachments > 0) {
          console.log(
            `[chat-retention] Removidas ${deletedMessages} mensagens e ${deletedAttachments} imagens expiradas.`,
          );
        }
      })
      .catch((error) => {
        console.error("[chat-retention] Falha na limpeza inicial:", error);
      });
  });

  const cleanupTimer = setInterval(() => {
    void cleanupExpiredChatData().catch((error) => {
      console.error("[chat-retention] Falha na limpeza periodica:", error);
    });
  }, CHAT_CLEANUP_INTERVAL_MS);
  cleanupTimer.unref();

  return server;
};

if (process.env.NODE_ENV !== "test") {
  startServer();
}
