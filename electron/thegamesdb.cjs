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

function createTheGamesDbClient({ apiKey, fetchImpl = globalThis.fetch } = {}) {
  return {
    async searchGamesByName({ name }) {
      const key = String(apiKey || "").trim();
      if (!key) throw new Error("Configure THEGAMESDB_API_KEY no arquivo .env e reinicie o launcher.");
      const query = String(name || "").trim();
      if (query.length < 2) throw new Error("Digite pelo menos 2 caracteres do título.");

      const url = new URL("/v1.1/Games/ByGameName", API_ROOT);
      url.searchParams.set("apikey", key);
      url.searchParams.set("name", query);
      url.searchParams.set("mode", "natural");
      url.searchParams.set("fields", "players,publishers,genres,overview,platform,rating");
      url.searchParams.set("include", "boxart,platform");
      const response = await fetchImpl(url.toString(), { headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error(`TheGamesDB respondeu com erro ${response.status}.`);
      const payload = await response.json();
      const games = Array.isArray(payload?.data?.games) ? payload.data.games : [];
      return games.map((game) => normalizeGame(game, payload.include || {})).filter((game) => game.id && game.title);
    },
  };
}

module.exports = { createTheGamesDbClient, normalizeGame };
