const API_ROOT = "https://api.thegamesdb.net";

const asText = (value) => {
  if (typeof value === "string") return value.trim();
  if (value && typeof value === "object") return String(value.name || value.publisher_name || value.developer_name || "").trim();
  return "";
};

const firstText = (value) => {
  const values = Array.isArray(value) ? value : [value];
  return values.map(asText).find(Boolean) || "";
};

const absoluteImageUrl = (base, filename) => {
  if (!filename) return undefined;
  if (/^https?:\/\//i.test(filename)) return filename;
  return `${String(base || "https://cdn.thegamesdb.net/images/original/").replace(/\/?$/, "/")}${String(filename).replace(/^\//, "")}`;
};

const normalizeGame = (game, include = {}) => {
  const id = Number(game.id);
  const boxart = include.boxart?.data?.[id] || include.boxart?.data?.[String(id)] || [];
  const originalBase = include.boxart?.base_url?.original;
  const images = boxart
    .filter((image) => image && image.filename)
    .map((image) => ({
      type: String(image.type || ""),
      side: String(image.side || (/\/back\//i.test(image.filename) ? "back" : /\/front\//i.test(image.filename) ? "front" : "")),
      url: absoluteImageUrl(originalBase, image.filename),
    }));
  const frontImage = images.find((image) => image.type === "boxart" && image.side === "front")?.url;
  const backImage = images.find((image) => image.type === "boxart" && image.side === "back")?.url;
  const platformEntry = include.platform?.data?.[game.platform] || include.platform?.data?.[String(game.platform)];
  const releaseDate = String(game.release_date || "");
  const yearMatch = releaseDate.match(/^\d{4}/);

  return {
    id,
    title: String(game.game_title || game.title || "").trim(),
    releaseDate: releaseDate || undefined,
    year: yearMatch ? Number(yearMatch[0]) : undefined,
    description: String(game.overview || "").trim(),
    publisher: firstText(game.publishers),
    developer: firstText(game.developers),
    platform: asText(platformEntry) || asText(game.platform),
    frontImage,
    backImage,
    images: images.map((image) => image.url).filter(Boolean),
  };
};

const normalizeGameScreenshots = (payload, gameId) => {
  const id = Number(gameId);
  const base = payload?.data?.base_url?.original;
  const imagesByGame = payload?.data?.images || {};
  const entries = imagesByGame[id] || imagesByGame[String(id)] || [];

  const screenshots = (Array.isArray(entries) ? entries : [])
    .filter((image) => String(image?.type || "").toLowerCase() === "screenshot")
    .map((image) => absoluteImageUrl(base, image.filename))
    .filter(Boolean);

  return { screenshots };
};

function createTheGamesDbClient({ apiKey, fetchImpl = globalThis.fetch } = {}) {
  const requestJson = async (pathname, params = {}) => {
    const key = String(apiKey || "").trim();
    if (!key) throw new Error("Configure THEGAMESDB_API_KEY no arquivo .env e reinicie o launcher.");

    const url = new URL(pathname, API_ROOT);
    url.searchParams.set("apikey", key);
    Object.entries(params).forEach(([paramKey, value]) => {
      if (value !== undefined && value !== null) url.searchParams.set(paramKey, String(value));
    });

    const response = await fetchImpl(url.toString(), { headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error(`TheGamesDB respondeu com erro ${response.status}.`);
    return response.json();
  };

  return {
    async searchGamesByName({ name }) {
      const query = String(name || "").trim();
      if (query.length < 2) throw new Error("Digite pelo menos 2 caracteres do título.");

      const payload = await requestJson("/v1.1/Games/ByGameName", {
        name: query,
        mode: "natural",
        fields: "players,publishers,genres,overview,platform,rating",
        include: "boxart,platform",
      });
      const games = Array.isArray(payload?.data?.games) ? payload.data.games : [];
      return games.map((game) => normalizeGame(game, payload.include || {})).filter((game) => game.id && game.title);
    },

    async getGameScreenshots({ gameId }) {
      const id = Number(gameId);
      if (!Number.isFinite(id) || id <= 0) throw new Error("ID de jogo TheGamesDB inválido.");
      const payload = await requestJson("/v1/Games/Images", { games_id: id });
      return normalizeGameScreenshots(payload, id);
    },
  };
}

module.exports = { createTheGamesDbClient, normalizeGame, normalizeGameScreenshots };
