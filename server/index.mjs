import "dotenv/config";
import crypto from "node:crypto";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { Timestamp, getFirestore } from "firebase-admin/firestore";
import { getStorage as getAdminStorage } from "firebase-admin/storage";
import { OAuth2Client } from "google-auth-library";
import path from "path";
import { fileURLToPath } from "url";

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
const achievementSchemaCache = new Map();
const CACHE_TTL = 1000 * 60 * 60; // 1 hora
const STEAM_AUTH_STATE_TTL = 1000 * 60 * 10; // 10 minutos
const DISCORD_AUTH_STATE_TTL = 1000 * 60 * 10; // 10 minutos
const DESKTOP_GOOGLE_AUTH_STATE_TTL = 1000 * 60 * 5; // 5 minutos
const CHAT_RETENTION_MS = 24 * 60 * 60 * 1000; // 24 horas

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

const buildEpicDetails = (catalogId, namespace, catalogItem) => {
  const customAttributes = extractEpicCustomAttributes(catalogItem?.customAttributes);
  const keyImages = Array.isArray(catalogItem?.keyImages) ? catalogItem.keyImages : [];
  
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

const verifyUserToken = async (token) => {
  if (!token) return null;
  try {
    return await getAuth().verifyIdToken(token);
  } catch {
    return null;
  }
};

// ─── Chat Transiente via SSE (Custo Zero e Tempo Real) ──────────────────────
const activeClients = new Map(); // Map<string, Response> (uid -> Express Response)
const chatHistory = new Map(); // Map<string, ChatMessage[]> (chatId -> array de mensagens)

app.get("/api/chat/stream", async (req, res) => {
  const token = String(req.query.token || "").trim();
  if (!token) {
    res.status(401).json({ error: "Token ausente" });
    return;
  }

  const firebaseUser = await verifyUserToken(token);
  if (!firebaseUser) {
    res.status(401).json({ error: "Token inválido ou expirado" });
    return;
  }

  const userId = firebaseUser.uid;

  // Define headers para Server-Sent Events (SSE)
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
    "Access-Control-Allow-Origin": "*",
  });

  // Registra o cliente ativo
  activeClients.set(userId, res);
  console.log(`[ChatServer] Cliente conectado via SSE: ${userId}. Ativos: ${activeClients.size}`);

  // Envia ping periódico para manter a conexão aberta (especialmente no Render/Heroku)
  const pingInterval = setInterval(() => {
    res.write(":\n\n");
  }, 20000);

  req.on("close", () => {
    clearInterval(pingInterval);
    activeClients.delete(userId);
    console.log(`[ChatServer] Cliente desconectado do SSE: ${userId}. Ativos: ${activeClients.size}`);
  });
});

app.post("/api/chat/send", requireFirebaseUser, (req, res) => {
  const senderId = req.firebaseUser.uid;
  const { receiverId, text } = req.body;

  if (!receiverId || !text || !String(text).trim()) {
    res.status(400).json({ error: "Destinatário ou mensagem vazia" });
    return;
  }

  const msgId = crypto.randomUUID();
  const normalizedText = String(text).trim();
  const chatId = [senderId, receiverId].sort().join("_");

  const message = {
    id: msgId,
    chatId,
    senderId,
    receiverId,
    text: normalizedText,
    createdAt: new Date().toISOString(),
    read: false,
  };

  // Mantém histórico das últimas 30 mensagens em memória
  if (!chatHistory.has(chatId)) {
    chatHistory.set(chatId, []);
  }
  const history = chatHistory.get(chatId);
  history.push(message);
  if (history.length > 30) {
    history.shift();
  }

  // Encaminha via SSE ao destinatário se estiver online
  const receiverClient = activeClients.get(receiverId);
  if (receiverClient) {
    console.log(`[ChatServer] Encaminhando mensagem de ${senderId} para ${receiverId}`);
    receiverClient.write(`data: ${JSON.stringify({ type: "message", message })}\n\n`);
  }

  res.json({ success: true, message });
});

app.post("/api/chat/typing", requireFirebaseUser, (req, res) => {
  const senderId = req.firebaseUser.uid;
  const { receiverId, typing } = req.body;

  if (!receiverId) {
    res.status(400).json({ error: "Destinatário ausente" });
    return;
  }

  const receiverClient = activeClients.get(receiverId);
  if (receiverClient) {
    receiverClient.write(`data: ${JSON.stringify({ type: "typing", senderId, typing: Boolean(typing) })}\n\n`);
  }

  res.json({ success: true });
});

app.get("/api/chat/history", requireFirebaseUser, (req, res) => {
  const currentUid = req.firebaseUser.uid;
  const { friendUid } = req.query;

  if (!friendUid) {
    res.status(400).json({ error: "friendUid ausente" });
    return;
  }

  const chatId = [currentUid, friendUid].sort().join("_");
  const history = chatHistory.get(chatId) || [];
  res.json(history);
});


const requireLinkedSteamId = async (req, res, next) => {
  const steamId = String(req.query.steamId ?? "").trim();
  if (!/^\d+$/.test(steamId)) {
    res.status(400).json({ error: "steamId inválido." });
    return;
  }

  try {
    const uid = req.firebaseUser.uid;
    const profileSnap = await getFirestore().doc(`profiles/${uid}`).get();
    const linkedSteamId = String(profileSnap.data()?.steamId ?? "").trim();
    if (linkedSteamId !== steamId) {
      res.status(403).json({ error: "Steam ID não pertence ao usuário autenticado." });
      return;
    }
    req.steamId = steamId;
    next();
  } catch (error) {
    console.error("Erro interno no requireLinkedSteamId:", error);
    res.status(500).json({ error: "Erro ao validar vínculo Steam." });
  }
};

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

const publicProfile = (id, data = {}) => ({
  uid: String(id || data.uid || ""),
  email: data.email || "",
  displayName: data.displayName || data.email?.split("@")[0] || "User",
  photoURL: data.discordAvatar || data.photoURL || "",
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
    const currentSnap = await firestore.doc(`profiles/${req.firebaseUser.uid}`).get();
    const isFriend = (Array.isArray(currentSnap.data()?.checkpointFriends)
      ? currentSnap.data().checkpointFriends
      : [])
      .some((friend) => String(friend?.uid || "") === friendUid);

    if (!isFriend) {
      res.status(403).json({ error: "Perfil disponível apenas para amigos." });
      return;
    }

    const profileSnap = await firestore.doc(`profiles/${friendUid}`).get();
    if (!profileSnap.exists) {
      res.status(404).json({ error: "Perfil não encontrado." });
      return;
    }

    const profileData = profileSnap.data() || {};
    const presence = resolvePresence(profileData.presence);
    const gamesSnap = await firestore.collection(`users/${friendUid}/games`).limit(80).get();
    const games = gamesSnap.docs.map((doc) => {
      const data = doc.data() || {};
      return {
        id: doc.id,
        title: data.title || "Jogo",
        image: data.image || "",
        backgroundImage: data.backgroundImage || "",
        cardImage: data.cardImage || "",
        logoImage: data.logoImage || "",
        category: data.category || "",
        isFavorite: Boolean(data.isFavorite),
        hoursPlayed: Number(data.hoursPlayed || 0),
        launcherType: data.launcherType || "local",
        totalAchievements: Number(data.totalAchievements || 0),
        completedAchievements: Number(data.completedAchievements || 0),
      };
    });

    res.json({
      profile: {
        uid: friendUid,
        displayName: profileData.displayName || profileData.discordUsername || "Usuário",
        photoURL: profileData.discordAvatar || profileData.photoURL || "",
        steamId: profileData.steamId ? "connected" : "",
        discordId: profileData.discordId ? "connected" : "",
        discordUsername: profileData.discordUsername || "",
        discordAvatar: profileData.discordAvatar || "",
        steamAvatar: profileData.steamAvatar || "",
        steamUsername: profileData.steamUsername || "",
        status: presence.status,
        playing: presence.playing,
      },
      games,
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
  if (!friendUid) {
    res.status(400).json({ error: "Usuário inválido." });
    return;
  }

  try {
    const firestore = getFirestore();
    const profileRef = firestore.doc(`profiles/${req.firebaseUser.uid}`);
    const friendRef = firestore.doc(`profiles/${friendUid}`);
    const [profileSnap, friendSnap] = await Promise.all([profileRef.get(), friendRef.get()]);
    const now = new Date().toISOString();
    if (profileSnap.exists) {
      const data = profileSnap.data() || {};
      await profileRef.set(
        {
          checkpointFriends: withoutProfileUid(data.checkpointFriends, friendUid),
          checkpointFriendRequestsIncoming: withoutProfileUid(data.checkpointFriendRequestsIncoming, friendUid),
          checkpointFriendRequestsOutgoing: withoutProfileUid(data.checkpointFriendRequestsOutgoing, friendUid),
          updatedAt: now,
        },
        { merge: true },
      );
    }
    if (friendSnap.exists) {
      const data = friendSnap.data() || {};
      await friendRef.set(
        {
          checkpointFriends: withoutProfileUid(data.checkpointFriends, req.firebaseUser.uid),
          checkpointFriendRequestsIncoming: withoutProfileUid(data.checkpointFriendRequestsIncoming, req.firebaseUser.uid),
          checkpointFriendRequestsOutgoing: withoutProfileUid(data.checkpointFriendRequestsOutgoing, req.firebaseUser.uid),
          updatedAt: now,
        },
        { merge: true },
      );
    }
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Erro ao remover amigo." });
  }
});

app.post("/api/chat/cleanup", steamPrivateLimiter, requireFirebaseUser, async (req, res) => {
  const friendUid = String(req.body?.uid ?? "").trim();
  if (!friendUid || friendUid === req.firebaseUser.uid) {
    res.status(400).json({ error: "Usuário inválido." });
    return;
  }

  try {
    const firestore = getFirestore();
    const chatId = [req.firebaseUser.uid, friendUid].sort().join("_");
    const cutoff = Timestamp.fromMillis(Date.now() - CHAT_RETENTION_MS);
    const expiredMessagesSnap = await firestore
      .collection("messages")
      .where("chatId", "==", chatId)
      .where("createdAt", "<", cutoff)
      .limit(400)
      .get();

    let deletedMessages = 0;
    if (!expiredMessagesSnap.empty) {
      const batch = firestore.batch();
      const attachmentPaths = [];
      expiredMessagesSnap.forEach((doc) => {
        const attachmentPath = String(doc.data()?.attachmentPath || "").trim();
        if (attachmentPath) {
          attachmentPaths.push(attachmentPath);
        }
        batch.delete(doc.ref);
        deletedMessages += 1;
      });
      await batch.commit();

      if (attachmentPaths.length > 0 && firebaseStorageBucket) {
        const bucket = getAdminStorage().bucket(firebaseStorageBucket);
        await Promise.all(
          attachmentPaths.map((attachmentPath) =>
            bucket.file(attachmentPath).delete().catch(() => undefined),
          ),
        );
      }
    }

    let deletedTyping = 0;
    const typingDocs = await Promise.all([
      firestore.doc(`chatTyping/${chatId}_${req.firebaseUser.uid}`).get(),
      firestore.doc(`chatTyping/${chatId}_${friendUid}`).get(),
    ]);
    const expiredTypingDocs = typingDocs.filter((doc) => {
      const updatedAt = doc.data()?.updatedAt;
      return doc.exists && updatedAt?.toMillis && updatedAt.toMillis() < cutoff.toMillis();
    });

    if (expiredTypingDocs.length > 0) {
      const batch = firestore.batch();
      expiredTypingDocs.forEach((doc) => {
        batch.delete(doc.ref);
        deletedTyping += 1;
      });
      await batch.commit();
    }

    res.json({ ok: true, deletedMessages, deletedTyping });
  } catch (error) {
    console.error("Erro ao limpar conversa expirada:", error);
    res.status(500).json({ error: "Erro ao limpar conversa expirada." });
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

    const response = await fetch(url.toString());
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

    res.json({
      steamId,
      gameCount: payload.response.game_count ?? games.length,
      games,
    });
  } catch {
    res.status(500).json({ error: "Erro interno ao consultar Steam." });
  }
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
        achievementsCache.set(cacheKey, { data, timestamp: Date.now() });
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

    achievementsCache.set(cacheKey, { data, timestamp: Date.now() });
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
