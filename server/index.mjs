import "dotenv/config";
import crypto from "node:crypto";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import path from "path";
import { fileURLToPath } from "url";

const app = express();
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
const epicClientId = process.env.EPIC_CLIENT_ID?.trim();
const epicClientSecret = process.env.EPIC_CLIENT_SECRET?.trim();
const epicOauthScope = process.env.EPIC_OAUTH_SCOPE?.trim() || "basic_profile";
const epicSandboxId = process.env.EPIC_SANDBOX_ID?.trim();
const epicDeploymentId = process.env.EPIC_DEPLOYMENT_ID?.trim();
const discordClientId = process.env.DISCORD_CLIENT_ID?.trim();
const discordClientSecret = process.env.DISCORD_CLIENT_SECRET?.trim();
const discordOauthScope = process.env.DISCORD_OAUTH_SCOPE?.trim() || "identify";

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
const epicAuthorizeEndpoint = "https://www.epicgames.com/id/authorize";
const epicTokenEndpoint = "https://api.epicgames.dev/epic/oauth/v2/token";
const epicOwnershipEndpointBase = "https://api.epicgames.dev/epic/ecom/v3/platforms/EPIC/identities";
const epicStoreGraphqlEndpoint = "https://store.epicgames.com/graphql";
const discordAuthorizeEndpoint = "https://discord.com/oauth2/authorize";
const discordTokenEndpoint = "https://discord.com/api/oauth2/token";
const discordCurrentUserEndpoint = "https://discord.com/api/users/@me";
const discordRelationshipsEndpoint = "https://discord.com/api/users/@me/relationships";
const pendingStates = new Map();
const pendingEpicStates = new Map();
const pendingDiscordStates = new Map();

const appDetailsCache = new Map();
const achievementsCache = new Map();
const CACHE_TTL = 1000 * 60 * 60; // 1 hora
const STEAM_AUTH_STATE_TTL = 1000 * 60 * 10; // 10 minutos
const EPIC_AUTH_STATE_TTL = 1000 * 60 * 10; // 10 minutos
const DISCORD_AUTH_STATE_TTL = 1000 * 60 * 10; // 10 minutos

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

const buildEpicRedirectUri = () =>
  (process.env.EPIC_REDIRECT_URI?.trim() || `${backendPublicUrl}/auth/epic/callback`).replace(
    /\/$/,
    "",
  );

const buildDiscordRedirectUri = () =>
  (
    process.env.DISCORD_REDIRECT_URI?.trim() ||
    `${backendPublicUrl}/auth/discord/callback`
  ).replace(/\/$/, "");

const cleanupPendingStates = () => {
  const now = Date.now();
  for (const [token, pending] of pendingStates.entries()) {
    if (now - pending.createdAt > STEAM_AUTH_STATE_TTL) {
      pendingStates.delete(token);
    }
  }
};

const cleanupPendingEpicStates = () => {
  const now = Date.now();
  for (const [state, pending] of pendingEpicStates.entries()) {
    if (now - pending.createdAt > EPIC_AUTH_STATE_TTL) {
      pendingEpicStates.delete(state);
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

const buildEpicAuthorizeUrl = (state) => {
  if (!epicClientId) {
    throw new Error("EPIC_CLIENT_ID não configurado no backend.");
  }
  const authorizeUrl = new URL(epicAuthorizeEndpoint);
  authorizeUrl.searchParams.set("client_id", epicClientId);
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("scope", epicOauthScope);
  authorizeUrl.searchParams.set("redirect_uri", buildEpicRedirectUri());
  authorizeUrl.searchParams.set("state", state);
  return authorizeUrl.toString();
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

const getEpicBasicAuthHeader = () => {
  if (!epicClientId || !epicClientSecret) {
    throw new Error("Credenciais Epic Games não configuradas no backend.");
  }
  return `Basic ${Buffer.from(`${epicClientId}:${epicClientSecret}`).toString("base64")}`;
};

const buildEpicTokenBody = (grantType, fields = {}) => {
  const body = new URLSearchParams();
  body.set("grant_type", grantType);
  if (epicDeploymentId) {
    body.set("deployment_id", epicDeploymentId);
  }
  Object.entries(fields).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      body.set(key, String(value));
    }
  });
  return body;
};

const privateProfileDoc = (uid) => getFirestore().doc(`privateProfiles/${uid}`);

const persistEpicSession = async (uid, tokenPayload) => {
  const expiresIn = Number(tokenPayload?.expires_in ?? 0);
  const accessToken = String(tokenPayload?.access_token ?? "").trim();
  const refreshToken = String(tokenPayload?.refresh_token ?? "").trim();

  await privateProfileDoc(uid).set(
    {
      epicAccessToken: accessToken,
      epicAccessTokenExpiresAt:
        Number.isFinite(expiresIn) && expiresIn > 0
          ? new Date(Date.now() + expiresIn * 1000).toISOString()
          : "",
      epicRefreshToken: refreshToken,
      epicTokenUpdatedAt: new Date().toISOString(),
    },
    { merge: true },
  );
};

const requestEpicToken = async (grantType, fields = {}) => {
  const response = await fetch(epicTokenEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: getEpicBasicAuthHeader(),
    },
    body: buildEpicTokenBody(grantType, fields),
  });
  const payload = await response.json().catch(() => ({}));
  return { response, payload };
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

const buildEpicLibraryGame = (ownedEntry, catalogItem) => {
  const customAttributes = extractEpicCustomAttributes(catalogItem?.customAttributes);
  const keyImages = Array.isArray(catalogItem?.keyImages) ? catalogItem.keyImages : [];
  const screenshots = keyImages
    .filter(
      (image) =>
        typeof image?.url === "string" &&
        typeof image?.type === "string" &&
        image.type.toLowerCase().includes("screenshot"),
    )
    .map((image) => image.url);

  return {
    namespace: String(ownedEntry?.namespace ?? catalogItem?.namespace ?? epicSandboxId ?? ""),
    catalogId: String(ownedEntry?.itemId ?? catalogItem?.id ?? ""),
    title:
      String(catalogItem?.title ?? "").trim() ||
      String(customAttributes?.productName ?? "").trim() ||
      `Epic Item ${String(ownedEntry?.itemId ?? "").trim()}`,
    image:
      pickEpicImage(keyImages, ["wide", "hero", "vault", "offerimagewide"]) ||
      pickEpicImage(keyImages, ["thumbnail", "dieselgameboxtall"]),
    backgroundImage: pickEpicImage(keyImages, ["wide", "hero", "vault", "offerimagewide"]),
    cardImage: pickEpicImage(keyImages, ["tall", "thumbnail", "box"]),
    logoImage: pickEpicImage(keyImages, ["logo"]),
    description:
      String(customAttributes?.shortDescription ?? "").trim() ||
      `Importado da Epic Games. Catalog ID ${String(ownedEntry?.itemId ?? "").trim()}.`,
    aboutTheGame: String(customAttributes?.aboutThisGame ?? "").trim(),
    releaseDate: String(customAttributes?.releaseDate ?? "").trim(),
    developer:
      String(customAttributes?.developerName ?? "").trim() ||
      String(customAttributes?.developerDisplayName ?? "").trim(),
    publisher:
      String(customAttributes?.publisherName ?? "").trim() ||
      String(customAttributes?.publisherDisplayName ?? "").trim(),
    tags: Array.isArray(catalogItem?.categories)
      ? catalogItem.categories
          .map((category) => String(category?.path ?? "").split("/").pop())
          .filter(Boolean)
      : [],
    screenshots,
    offerSlug: String(catalogItem?.offers?.[0]?.urlSlug ?? "").trim(),
    executablePath: String(ownedEntry?.itemId ?? "").trim(),
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
  } catch {
    res.status(500).json({ error: "Erro ao validar vínculo Steam." });
  }
};

const requireLinkedEpicAccountId = async (req, res, next) => {
  const epicAccountId = String(req.query.epicAccountId ?? "").trim();
  if (!epicAccountId) {
    res.status(400).json({ error: "epicAccountId inválido." });
    return;
  }

  try {
    const uid = req.firebaseUser.uid;
    const profileSnap = await getFirestore().doc(`profiles/${uid}`).get();
    const linkedEpicAccountId = String(profileSnap.data()?.epicAccountId ?? "").trim();
    if (linkedEpicAccountId !== epicAccountId) {
      res.status(403).json({ error: "Epic Account ID não pertence ao usuário autenticado." });
      return;
    }
    req.epicAccountId = epicAccountId;
    next();
  } catch {
    res.status(500).json({ error: "Erro ao validar vínculo Epic Games." });
  }
};

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

const publicProfile = (id, data = {}) => ({
  uid: String(data.uid || id),
  email: data.email || "",
  displayName: data.displayName || data.email?.split("@")[0] || "User",
  photoURL: data.discordAvatar || data.photoURL || "",
  discordAvatar: data.discordAvatar || "",
  discordUsername: data.discordUsername || "",
});

const compactFriendProfile = (profile) => ({
  uid: profile.uid,
  displayName: profile.displayName,
  photoURL: profile.photoURL || null,
});

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
      emailSnap.forEach((doc) => found.set(doc.id, publicProfile(doc.id, doc.data())));
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

    res.json({ users: Array.from(found.values()).slice(0, 25) });
  } catch {
    res.status(500).json({ error: "Erro ao buscar usuários." });
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

app.post("/auth/epic/start", steamAuthLimiter, requireFirebaseUser, (req, res) => {
  cleanupPendingEpicStates();
  if (!epicClientId || !epicClientSecret) {
    res.status(500).json({ error: "Credenciais Epic Games não configuradas no backend." });
    return;
  }

  const state = crypto.randomUUID();
  pendingEpicStates.set(state, {
    firebaseUid: req.firebaseUser.uid,
    createdAt: Date.now(),
  });

  try {
    res.json({ url: buildEpicAuthorizeUrl(state) });
  } catch (error) {
    pendingEpicStates.delete(state);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Falha ao iniciar autenticação Epic.",
    });
  }
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

    const params = new URLSearchParams({ steamStatus: "ok" });
    res.redirect(`${frontendUrl}/app?${params.toString()}`);
  } catch {
    res.redirect(`${frontendUrl}/app?steamStatus=error`);
  }
});

app.get("/auth/epic/callback", steamAuthLimiter, async (req, res) => {
  cleanupPendingEpicStates();
  const state = String(req.query.state ?? "");
  const pending = pendingEpicStates.get(state);
  if (!pending) {
    res.redirect(`${frontendUrl}/app?epicStatus=invalid_state`);
    return;
  }
  pendingEpicStates.delete(state);

  const oauthError = String(req.query.error ?? "").trim();
  if (oauthError) {
    res.redirect(`${frontendUrl}/app?epicStatus=denied`);
    return;
  }

  const code = String(req.query.code ?? "").trim();
  if (!code) {
    res.redirect(`${frontendUrl}/app?epicStatus=missing_code`);
    return;
  }

  if (!epicClientId || !epicClientSecret) {
    res.redirect(`${frontendUrl}/app?epicStatus=client_not_configured`);
    return;
  }

  if (getApps().length === 0) {
    res.redirect(`${frontendUrl}/app?epicStatus=server_not_configured`);
    return;
  }

  try {
    const { response: tokenResponse, payload: tokenPayload } = await requestEpicToken(
      "authorization_code",
      {
        code,
        redirect_uri: buildEpicRedirectUri(),
      },
    );

    if (!tokenResponse.ok) {
      res.redirect(`${frontendUrl}/app?epicStatus=token_error`);
      return;
    }

    const epicAccountId = String(
      tokenPayload?.account_id ??
        tokenPayload?.accountId ??
        tokenPayload?.sub ??
        "",
    ).trim();

    if (!epicAccountId) {
      res.redirect(`${frontendUrl}/app?epicStatus=missing_id`);
      return;
    }

    await persistEpicSession(pending.firebaseUid, tokenPayload);
    await getFirestore().doc(`profiles/${pending.firebaseUid}`).set(
      {
        epicAccountId,
        updatedAt: new Date().toISOString(),
      },
      { merge: true },
    );

    res.redirect(`${frontendUrl}/app?epicStatus=ok`);
  } catch {
    res.redirect(`${frontendUrl}/app?epicStatus=error`);
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

    res.redirect(`${frontendUrl}/app?discordStatus=ok`);
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

app.post("/api/epic/disconnect", steamPrivateLimiter, requireFirebaseUser, async (req, res) => {
  try {
    await getFirestore().doc(`profiles/${req.firebaseUser.uid}`).set(
      {
        epicAccountId: "",
        updatedAt: new Date().toISOString(),
      },
      { merge: true },
    );
    await privateProfileDoc(req.firebaseUser.uid).delete().catch(() => {});
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Erro ao desconectar Epic Games." });
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

app.get(
  "/api/epic/library",
  steamPrivateLimiter,
  requireFirebaseUser,
  requireLinkedEpicAccountId,
  async (req, res) => {
    if (!epicSandboxId) {
      res.status(500).json({ error: "EPIC_SANDBOX_ID não configurado no backend." });
      return;
    }

    try {
      const privateSnap = await privateProfileDoc(req.firebaseUser.uid).get();
      const session = privateSnap.data() ?? {};
      const accessToken = String(session?.epicAccessToken ?? "").trim();
      const accessTokenExpiresAt = String(session?.epicAccessTokenExpiresAt ?? "").trim();
      const refreshToken = String(session?.epicRefreshToken ?? "").trim();

      let resolvedAccessToken = accessToken;
      const tokenStillValid =
        resolvedAccessToken &&
        accessTokenExpiresAt &&
        Date.parse(accessTokenExpiresAt) > Date.now() + 60 * 1000;

      if (!tokenStillValid) {
        if (!refreshToken) {
          res
            .status(401)
            .json({ error: "Sessão Epic Games expirada. Conecte a conta novamente." });
          return;
        }

        const { response: refreshResponse, payload: refreshPayload } = await requestEpicToken(
          "refresh_token",
          {
            refresh_token: refreshToken,
          },
        );

        if (!refreshResponse.ok) {
          res
            .status(401)
            .json({ error: "Sessão Epic Games expirada. Conecte a conta novamente." });
          return;
        }

        await persistEpicSession(req.firebaseUser.uid, refreshPayload);
        resolvedAccessToken = String(refreshPayload?.access_token ?? "").trim();
      }

      if (!resolvedAccessToken) {
        res
          .status(401)
          .json({ error: "Não foi possível obter token de acesso da Epic Games." });
        return;
      }

      const ownershipUrl = new URL(
        `${epicOwnershipEndpointBase}/${encodeURIComponent(req.epicAccountId)}/ownership`,
      );
      ownershipUrl.searchParams.set("sandboxId", epicSandboxId);

      const ownershipResponse = await fetch(ownershipUrl.toString(), {
        headers: {
          Authorization: `Bearer ${resolvedAccessToken}`,
          Accept: "application/json",
        },
      });

      const ownershipPayload = await ownershipResponse.json().catch(() => []);
      if (!ownershipResponse.ok) {
        res.status(502).json({
          error: `Falha ao consultar ownership da Epic Games (status ${ownershipResponse.status}).`,
        });
        return;
      }

      if (!Array.isArray(ownershipPayload)) {
        res.status(502).json({ error: "Resposta inválida da Epic Games." });
        return;
      }

      const ownedEntries = ownershipPayload.filter(
        (entry) => entry?.owned && String(entry?.itemId ?? "").trim(),
      );

      const enrichedGames = [];
      const CHUNK_SIZE = 8;
      for (let i = 0; i < ownedEntries.length; i += CHUNK_SIZE) {
        const chunk = ownedEntries.slice(i, i + CHUNK_SIZE);
        const chunkResults = await Promise.all(
          chunk.map(async (entry) => {
            try {
              const catalogItem = await fetchEpicCatalogItem(
                String(entry.namespace ?? epicSandboxId),
                String(entry.itemId),
              );
              return buildEpicLibraryGame(entry, catalogItem);
            } catch {
              return buildEpicLibraryGame(entry, null);
            }
          }),
        );
        enrichedGames.push(...chunkResults);
      }

      res.json({
        epicAccountId: req.epicAccountId,
        gameCount: enrichedGames.length,
        games: enrichedGames,
      });
    } catch {
      res.status(500).json({ error: "Erro interno ao consultar biblioteca Epic Games." });
    }
  },
);

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
    const url = new URL(
      "https://api.steampowered.com/ISteamUserStats/GetPlayerAchievements/v0001/",
    );
    url.searchParams.set("key", steamApiKey);
    url.searchParams.set("steamid", steamId);
    url.searchParams.set("appid", appId);
    url.searchParams.set("l", "brazilian");

    const response = await fetch(url.toString());
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
    const achievements = payload?.playerstats?.achievements ?? [];
    const total = achievements.length;
    const unlocked = achievements.filter((a) => a.achieved === 1).length;

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
      cardImage: data?.header_image ?? null,
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

app.listen(port, () => {
  console.log(`Backend ativo em http://localhost:${port}`);
});
