import "dotenv/config";
import crypto from "node:crypto";
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

const app = express();
const port = Number(process.env.PORT ?? 8787);
const frontendUrl = process.env.FRONTEND_URL ?? "http://localhost:5173";
let steamApiKey = process.env.STEAM_API_KEY;

app.use(cors({ origin: frontendUrl, credentials: true }));
app.use(express.json());

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const steamOpenIdEndpoint = "https://steamcommunity.com/openid/login";
const pendingStates = new Map();

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

app.use(express.static(path.join(__dirname, "../dist")));

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../dist/index.html"));
});

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/steam/key/status", (_req, res) => {
  res.json({ configured: Boolean(steamApiKey) });
});

app.post("/api/steam/key", (req, res) => {
  const apiKey = String(req.body?.apiKey ?? "").trim();
  if (!apiKey) {
    res.status(400).json({ error: "API key da Steam é obrigatória." });
    return;
  }
  if (apiKey.length < 20) {
    res.status(400).json({ error: "API key da Steam inválida." });
    return;
  }
  steamApiKey = apiKey;
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
    res.redirect(`${frontendUrl}?steamStatus=invalid_state`);
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
      res.redirect(`${frontendUrl}?steamStatus=invalid`);
      return;
    }

    const claimedId = String(req.query["openid.claimed_id"] ?? "");
    const match = claimedId.match(/\/id\/(\d+)$/);
    const steamId = match?.[1];
    if (!steamId) {
      res.redirect(`${frontendUrl}?steamStatus=missing_id`);
      return;
    }

    const params = new URLSearchParams({
      steamStatus: "ok",
      steamId,
      state: pending.firebaseUid,
    });
    res.redirect(`${frontendUrl}?${params.toString()}`);
  } catch {
    res.redirect(`${frontendUrl}?steamStatus=error`);
  }
});

app.get("/api/steam/library", async (req, res) => {
  if (!steamApiKey) {
    res
      .status(500)
      .json({ error: "STEAM_API_KEY não configurada no backend." });
    return;
  }

  const steamId = String(req.query.steamId ?? "");
  if (!steamId) {
    res.status(400).json({ error: "steamId é obrigatório." });
    return;
  }

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
      headers: { Accept: "application/json" },
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
      headers: { Accept: "application/json" },
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
    const data = appEntry?.data;
    const requirements = `${data?.pc_requirements?.minimum ?? ""} ${data?.pc_requirements?.recommended ?? ""}`;
    const sizeGB = parseDiskSizeGb(requirements);
    res.json({ appId, sizeGB: sizeGB ?? null });
  } catch {
    res.status(500).json({ error: "Erro interno ao buscar tamanho do jogo." });
  }
});

app.listen(port, () => {
  console.log(`Steam backend ativo em http://localhost:${port}`);
});
