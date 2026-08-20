import express from "express";

const RETROACHIEVEMENTS_API_BASE = "https://retroachievements.org/API/";
const RETROACHIEVEMENTS_MEDIA_BASE = "https://media.retroachievements.org";

const CACHE_TTL = {
  consoles: 24 * 60 * 60 * 1000,
  games: 6 * 60 * 60 * 1000,
  progress: 5 * 60 * 1000,
};

const PLATFORM_ALIASES = {
  ps2: ["ps2", "playstation 2", "sony playstation 2"],
  ps1: ["ps1", "playstation", "playstation 1", "sony playstation"],
  snes: ["snes", "super nintendo", "super nintendo entertainment system", "super famicom"],
  nes: ["nes", "nintendo entertainment system", "nintendinho"],
  n64: ["n64", "nintendo 64"],
  genesis: ["genesis", "mega drive", "genesis mega drive", "sega genesis", "sega mega drive"],
  gba: ["gba", "game boy advance", "gameboy advance"],
  switch: ["switch", "nintendo switch"],
  psp: ["psp", "playstation portable", "sony psp"],
};

class RetroAchievementsError extends Error {
  constructor(code, status, message) {
    super(message);
    this.name = "RetroAchievementsError";
    this.code = code;
    this.status = status;
  }
}

const safeErrors = {
  RA_NOT_CONFIGURED: [503, "RetroAchievements não configurada no servidor."],
  RA_INVALID_USERNAME: [404, "Usuário da RetroAchievements não encontrado."],
  RA_NOT_LINKED: [409, "Conecte sua conta RetroAchievements para continuar."],
  RA_UNSUPPORTED_CONSOLE: [422, "Este console ainda não é suportado pela RetroAchievements."],
  RA_UPSTREAM_UNAVAILABLE: [502, "RetroAchievements indisponível no momento."],
  RA_INVALID_RESPONSE: [502, "A RetroAchievements retornou uma resposta inválida."],
};

const fail = (code) => {
  const [status, message] = safeErrors[code];
  return new RetroAchievementsError(code, status, message);
};

const normalizeText = (value) => String(value ?? "")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, " ")
  .trim();

const safeNumber = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

const read = (value, ...keys) => {
  for (const key of keys) {
    if (value?.[key] !== undefined && value?.[key] !== null) return value[key];
  }
  return undefined;
};

const mediaUrl = (value) => {
  const path = String(value ?? "").trim();
  if (!path) return undefined;
  if (/^https:\/\//i.test(path)) return path;
  return `${RETROACHIEVEMENTS_MEDIA_BASE}${path.startsWith("/") ? path : `/${path}`}`;
};

const badgeUrl = (badgeName, locked = false) => {
  const badge = String(badgeName ?? "").trim();
  if (!badge) return undefined;
  return `${RETROACHIEVEMENTS_MEDIA_BASE}/Badge/${badge}${locked ? "_lock" : ""}.png`;
};

const percentage = (value, fallback = 0) => {
  const parsed = Number.parseFloat(String(value ?? "").replace("%", ""));
  return Number.isFinite(parsed) ? Math.max(0, Math.min(100, parsed)) : fallback;
};

const resolvePlatformKey = (value) => {
  const normalized = normalizeText(value);
  return Object.entries(PLATFORM_ALIASES).find(([, aliases]) =>
    aliases.some((alias) => normalizeText(alias) === normalized),
  )?.[0];
};

const resolveConsole = (systems, consoleName) => {
  const platformKey = resolvePlatformKey(consoleName);
  if (!platformKey) return null;
  const acceptedNames = PLATFORM_ALIASES[platformKey].map(normalizeText);
  return systems.find((system) => {
    const name = normalizeText(read(system, "Name", "name"));
    return acceptedNames.includes(name);
  }) ?? null;
};

const titleScore = (candidateTitle, queryTitle) => {
  const candidate = normalizeText(candidateTitle);
  const query = normalizeText(queryTitle);
  if (candidate === query) return 0;
  if (candidate.startsWith(query)) return 1;
  if (candidate.includes(query)) return 2;
  const queryTokens = new Set(query.split(" ").filter(Boolean));
  const candidateTokens = new Set(candidate.split(" ").filter(Boolean));
  const overlap = [...queryTokens].filter((token) => candidateTokens.has(token)).length;
  if (overlap === 0) return Number.POSITIVE_INFINITY;
  return 3 + (queryTokens.size - overlap) / Math.max(1, queryTokens.size);
};

export const normalizeRetroAchievementsProfile = (payload) => {
  const username = String(read(payload, "User", "user") ?? "").trim();
  const ulid = String(read(payload, "ULID", "ulid") ?? "").trim().toUpperCase();
  if (!username || !/^[0-9A-HJKMNP-TV-Z]{26}$/.test(ulid)) {
    throw fail("RA_INVALID_USERNAME");
  }
  return {
    ulid,
    username,
    avatarUrl: mediaUrl(read(payload, "UserPic", "userPic")),
    totalPoints: Math.max(0, safeNumber(read(payload, "TotalPoints", "totalPoints"))),
  };
};

export const normalizeRetroAchievementsProgress = (payload) => {
  if (!payload || typeof payload !== "object") throw fail("RA_INVALID_RESPONSE");
  const rawAchievements = read(payload, "Achievements", "achievements") ?? {};
  const achievementValues = Array.isArray(rawAchievements)
    ? rawAchievements
    : Object.values(rawAchievements);
  const achievements = achievementValues
    .map((achievement) => {
      const dateEarned = read(achievement, "DateEarned", "dateEarned");
      const dateEarnedHardcore = read(
        achievement,
        "DateEarnedHardcore",
        "dateEarnedHardcore",
      );
      const badgeName = read(achievement, "BadgeName", "badgeName");
      return {
        id: safeNumber(read(achievement, "ID", "id")),
        title: String(read(achievement, "Title", "title") ?? "Conquista").trim(),
        description: String(read(achievement, "Description", "description") ?? "").trim(),
        points: Math.max(0, safeNumber(read(achievement, "Points", "points"))),
        badgeUrl: badgeUrl(badgeName, false),
        badgeLockedUrl: badgeUrl(badgeName, true),
        displayOrder: safeNumber(read(achievement, "DisplayOrder", "displayOrder")),
        unlocked: Boolean(dateEarned),
        unlockedHardcore: Boolean(dateEarnedHardcore),
        dateEarned: dateEarned ? String(dateEarned) : undefined,
        dateEarnedHardcore: dateEarnedHardcore
          ? String(dateEarnedHardcore)
          : undefined,
      };
    })
    .filter((achievement) => achievement.id > 0)
    .sort((left, right) => left.displayOrder - right.displayOrder || left.id - right.id);

  const total = Math.max(
    achievements.length,
    safeNumber(read(payload, "NumAchievements", "numAchievements")),
  );
  const normalUnlocked = Math.min(
    total,
    Math.max(0, safeNumber(read(payload, "NumAwardedToUser", "numAwardedToUser"))),
  );
  const hardcoreUnlocked = Math.min(
    total,
    Math.max(0, safeNumber(
      read(payload, "NumAwardedToUserHardcore", "numAwardedToUserHardcore"),
    )),
  );

  return {
    game: {
      id: safeNumber(read(payload, "ID", "id")),
      title: String(read(payload, "Title", "title") ?? "Jogo retrô").trim(),
      consoleName: String(read(payload, "ConsoleName", "consoleName") ?? "").trim(),
      imageUrl: mediaUrl(read(payload, "ImageIcon", "imageIcon")),
      logoUrl: mediaUrl(read(payload, "ImageTitle", "imageTitle")),
      boxArtUrl: mediaUrl(read(payload, "ImageBoxArt", "imageBoxArt")),
    },
    summary: {
      total,
      normalUnlocked,
      hardcoreUnlocked,
      normalPercent: percentage(
        read(payload, "UserCompletion", "userCompletion"),
        total > 0 ? (normalUnlocked / total) * 100 : 0,
      ),
      hardcorePercent: percentage(
        read(payload, "UserCompletionHardcore", "userCompletionHardcore"),
        total > 0 ? (hardcoreUnlocked / total) * 100 : 0,
      ),
      userTotalPlaytime: Math.max(
        0,
        safeNumber(read(payload, "UserTotalPlaytime", "userTotalPlaytime")),
      ),
      highestAwardKind: read(payload, "HighestAwardKind", "highestAwardKind")
        ? String(read(payload, "HighestAwardKind", "highestAwardKind"))
        : undefined,
      highestAwardDate: read(payload, "HighestAwardDate", "highestAwardDate")
        ? String(read(payload, "HighestAwardDate", "highestAwardDate"))
        : undefined,
    },
    achievements,
  };
};

const normalizeGameMatch = (game) => ({
  id: safeNumber(read(game, "ID", "id")),
  title: String(read(game, "Title", "title") ?? "").trim(),
  consoleId: safeNumber(read(game, "ConsoleID", "consoleId")),
  consoleName: String(read(game, "ConsoleName", "consoleName") ?? "").trim(),
  imageUrl: mediaUrl(read(game, "ImageIcon", "imageIcon")),
  logoUrl: mediaUrl(read(game, "ImageTitle", "imageTitle")),
  achievementCount: Math.max(
    0,
    safeNumber(read(game, "NumAchievements", "numAchievements")),
  ),
  points: Math.max(0, safeNumber(read(game, "Points", "points"))),
});

const cacheRead = (cache, key, now, ttl) => {
  const entry = cache.get(key);
  if (!entry || now - entry.savedAt >= ttl) return null;
  return entry.value;
};

const cacheWrite = (cache, key, value, now) => {
  cache.set(key, { value, savedAt: now });
  return value;
};

export const createRetroAchievementsRouter = ({
  apiKey,
  fetchImpl = globalThis.fetch,
  requireUser,
  loadProfile,
  saveProfile,
  now = Date.now,
}) => {
  const router = express.Router();
  const resolvedApiKey = String(apiKey ?? "").trim();
  const consoleCache = new Map();
  const gamesCache = new Map();
  const progressCache = new Map();

  if (typeof requireUser !== "function") {
    throw new TypeError("requireUser middleware is required");
  }

  const requestJson = async (endpoint, params = {}) => {
    if (!resolvedApiKey) throw fail("RA_NOT_CONFIGURED");
    const url = new URL(endpoint, RETROACHIEVEMENTS_API_BASE);
    url.searchParams.set("y", resolvedApiKey);
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
    });

    try {
      const response = await fetchImpl(url.toString(), {
        headers: { Accept: "application/json" },
      });
      if (!response?.ok) {
        if (response.status === 404) throw fail("RA_INVALID_USERNAME");
        if (response.status === 401 || response.status === 403) {
          throw fail("RA_NOT_CONFIGURED");
        }
        throw fail("RA_UPSTREAM_UNAVAILABLE");
      }
      try {
        return await response.json();
      } catch {
        throw fail("RA_INVALID_RESPONSE");
      }
    } catch (error) {
      if (error instanceof RetroAchievementsError) throw error;
      throw fail("RA_UPSTREAM_UNAVAILABLE");
    }
  };

  const getConsoles = async () => {
    const currentTime = now();
    const cached = cacheRead(consoleCache, "active", currentTime, CACHE_TTL.consoles);
    if (cached) return cached;
    const payload = await requestJson("API_GetConsoleIDs.php", { a: 1, g: 1 });
    if (!Array.isArray(payload)) throw fail("RA_INVALID_RESPONSE");
    return cacheWrite(consoleCache, "active", payload, currentTime);
  };

  const getGames = async (consoleId) => {
    const currentTime = now();
    const cached = cacheRead(gamesCache, consoleId, currentTime, CACHE_TTL.games);
    if (cached) return cached;
    const payload = await requestJson("API_GetGameList.php", { i: consoleId, f: 1 });
    if (!Array.isArray(payload)) throw fail("RA_INVALID_RESPONSE");
    return cacheWrite(gamesCache, consoleId, payload, currentTime);
  };

  const loadLinkedProfile = async (uid) => {
    const profile = await loadProfile(uid);
    const ulid = String(
      profile?.retroachievements_ulid ?? profile?.retroAchievementsUlid ?? "",
    ).trim().toUpperCase();
    const username = String(
      profile?.retroachievements_username ?? profile?.retroAchievementsUsername ?? "",
    ).trim();
    if (!/^[0-9A-HJKMNP-TV-Z]{26}$/.test(ulid)) throw fail("RA_NOT_LINKED");
    return { ...profile, retroachievements_ulid: ulid, retroachievements_username: username };
  };

  const handleError = (error, res) => {
    const safe = error instanceof RetroAchievementsError
      ? error
      : fail("RA_UPSTREAM_UNAVAILABLE");
    res.status(safe.status).json({ error: safe.message, code: safe.code });
  };

  router.use(requireUser);

  router.post("/link", async (req, res) => {
    try {
      const username = String(req.body?.username ?? "").trim();
      if (username.length < 2 || username.length > 32) {
        throw fail("RA_INVALID_USERNAME");
      }
      const payload = await requestJson("API_GetUserProfile.php", { u: username });
      const identity = normalizeRetroAchievementsProfile(payload);
      const uid = req.authUid || req.user?.id || req.firebaseUser?.uid;
      await saveProfile(uid, {
        retroachievements_ulid: identity.ulid,
        retroachievements_username: identity.username,
      });
      res.json({ identity });
    } catch (error) {
      handleError(error, res);
    }
  });

  router.delete("/link", async (req, res) => {
    try {
      const uid = req.authUid || req.user?.id || req.firebaseUser?.uid;
      await saveProfile(uid, {
        retroachievements_ulid: null,
        retroachievements_username: null,
      });
      res.json({ ok: true });
    } catch (error) {
      handleError(error, res);
    }
  });

  router.get("/games/search", async (req, res) => {
    try {
      const title = String(req.query.title ?? "").trim();
      const consoleName = String(req.query.console ?? "").trim();
      if (title.length < 2 || title.length > 160) throw fail("RA_INVALID_RESPONSE");
      const systems = await getConsoles();
      const system = resolveConsole(systems, consoleName);
      if (!system) throw fail("RA_UNSUPPORTED_CONSOLE");
      const consoleId = safeNumber(read(system, "ID", "id"));
      const games = await getGames(consoleId);
      const results = games
        .map((game) => ({ game: normalizeGameMatch(game), score: titleScore(
          read(game, "Title", "title"),
          title,
        ) }))
        .filter(({ game, score }) => game.id > 0 && Number.isFinite(score))
        .sort((left, right) => left.score - right.score || left.game.title.localeCompare(right.game.title))
        .slice(0, 8)
        .map(({ game }) => game);
      res.json({ results });
    } catch (error) {
      handleError(error, res);
    }
  });

  router.get("/games/:gameId/progress", async (req, res) => {
    const gameId = Number(req.params.gameId);
    try {
      if (!Number.isSafeInteger(gameId) || gameId <= 0) throw fail("RA_INVALID_RESPONSE");
      const uid = req.authUid || req.user?.id || req.firebaseUser?.uid;
      const profile = await loadLinkedProfile(uid);
      const cacheKey = `${profile.retroachievements_ulid}:${gameId}`;
      const currentTime = now();
      const cached = cacheRead(progressCache, cacheKey, currentTime, CACHE_TTL.progress);
      if (cached) {
        res.json({ ...cached, source: "cached" });
        return;
      }

      try {
        const userRef =
          profile.retroachievements_username || profile.retroachievements_ulid;
        const payload = await requestJson("API_GetGameInfoAndUserProgress.php", {
          u: userRef,
          g: gameId,
          a: 1,
        });
        const normalized = normalizeRetroAchievementsProgress(payload);
        cacheWrite(progressCache, cacheKey, normalized, currentTime);
        res.json({ ...normalized, source: "fresh" });
      } catch (error) {
        const stale = progressCache.get(cacheKey)?.value;
        if (stale) {
          res.json({ ...stale, source: "stale" });
          return;
        }
        throw error;
      }
    } catch (error) {
      handleError(error, res);
    }
  });

  return router;
};
