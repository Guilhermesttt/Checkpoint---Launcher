import "dotenv/config";
import crypto from "node:crypto";
import express from "express";
import cors from "cors";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import path from "path";
import { fileURLToPath } from "url";

const app = express();
const port = Number(process.env.PORT ?? 8787);
const frontendUrl = process.env.FRONTEND_URL ?? "http://localhost:5173";
const steamApiKey = process.env.STEAM_API_KEY?.trim();

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

app.use(cors({ origin: frontendUrl, credentials: true }));
app.use(express.json());

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const steamOpenIdEndpoint = "https://steamcommunity.com/openid/login";
const pendingStates = new Map();

const appDetailsCache = new Map();
const achievementsCache = new Map();
const CACHE_TTL = 1000 * 60 * 60; // 1 hora

const buildReturnTo = (token) =>
  `${process.env.BACKEND_PUBLIC_URL ?? `http://localhost:${port}`}/auth/steam/callback?token=${encodeURIComponent(token)}`;

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
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ");
  const gbMatch = plain.match(/(\d+(?:[.,]\d+)?)\s*GB/i);
  if (gbMatch?.[1]) {
    return Number(gbMatch[1].replace(",", "."));
  }
  const mbMatch = plain.match(/(\d+(?:[.,]\d+)?)\s*MB/i);
  if (mbMatch?.[1]) {
    const mb = Number(mbMatch[1].replace(",", "."));
    return Number((mb / 1024).toFixed(1));
  }
  return null;
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

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/auth/steam/start", (req, res) => {
  const state = String(req.query.state ?? "");
  if (!state) {
    res.status(400).json({ error: "State ausente." });
    return;
  }

  const token = crypto.randomUUID();
  pendingStates.set(token, {
    firebaseUid: state,
    createdAt: Date.now(),
  });

  const returnTo = buildReturnTo(token);
  const realm = process.env.BACKEND_PUBLIC_URL ?? `http://localhost:${port}`;
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

  res.redirect(openIdUrl.toString());
});

app.get("/auth/steam/callback", async (req, res) => {
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

    const params = new URLSearchParams({
      steamStatus: "ok",
      steamId,
      state: pending.firebaseUid,
    });
    res.redirect(`${frontendUrl}/app?${params.toString()}`);
  } catch {
    res.redirect(`${frontendUrl}/app?steamStatus=error`);
  }
});

app.get("/api/steam/library", requireFirebaseUser, requireLinkedSteamId, async (req, res) => {
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

app.get("/api/steam/search", handleSteamSearch);
app.get("/api/steam/search-games", handleSteamSearch);

app.get("/api/steam/app-size", async (req, res) => {
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

app.get("/api/steam/achievements", requireFirebaseUser, requireLinkedSteamId, async (req, res) => {
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

app.get("/api/steam/app-details", async (req, res) => {
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
  console.log(`Steam backend ativo em http://localhost:${port}`);
});
