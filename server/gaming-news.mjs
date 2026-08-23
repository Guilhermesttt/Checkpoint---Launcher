const DEFAULT_FEEDS = [
  { name: "Adrenaline", url: "https://www.adrenaline.com.br/games/feed/" },
  { name: "GameVicio", url: "https://www.gamevicio.com/feed/" },
];

const CACHE_TTL_MS = 15 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 8 * 1000;
let cache = { expiresAt: 0, items: [], sources: [] };

const decodeXml = (value = "") => value
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
  .replace(/&#x([\da-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
  .replace(/&amp;/g, "&")
  .replace(/&lt;/g, "<")
  .replace(/&gt;/g, ">")
  .replace(/&quot;/g, "\"")
  .replace(/&apos;|&#039;/g, "'");

const textFrom = (block, tag) => {
  const match = block.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return decodeXml(match?.[1] || "").trim();
};

const safeHttpsUrl = (value) => {
  try {
    const url = new URL(decodeXml(value).trim());
    return url.protocol === "https:" ? url.toString() : "";
  } catch {
    return "";
  }
};

const stripHtml = (value) => decodeXml(value)
  .replace(/<script[\s\S]*?<\/script>/gi, " ")
  .replace(/<style[\s\S]*?<\/style>/gi, " ")
  .replace(/<[^>]+>/g, " ")
  .replace(/\s+/g, " ")
  .trim();

const thumbnailFrom = (block, description = "", contentEncoded = "") => {
  // 1. media:thumbnail
  const mediaThumb = block.match(/<media:thumbnail\b[^>]*\burl=["']([^"']+)["']/i)?.[1];
  if (mediaThumb) {
    const safe = safeHttpsUrl(mediaThumb);
    if (safe) return safe;
  }

  // 2. enclosure with image type or image extension
  const enclosure = block.match(/<enclosure\b(?=[^>]*\b(?:type=["']image\/|url=["'][^"']+\.(?:jpg|jpeg|png|webp|avif|gif)))[^>]*\burl=["']([^"']+)["']/i)?.[1]
    || block.match(/<enclosure\b[^>]*\burl=["']([^"']+)["'][^>]*\btype=["']image\//i)?.[1];
  if (enclosure) {
    const safe = safeHttpsUrl(enclosure);
    if (safe) return safe;
  }

  // 3. media:content specifically for images (avoid video embeds)
  const mediaImage = block.match(/<media:content\b(?=[^>]*\b(?:medium=["']image["']|type=["']image\/|url=["'][^"']+\.(?:jpg|jpeg|png|webp|avif|gif)))[^>]*\burl=["']([^"']+)["']/i)?.[1];
  if (mediaImage) {
    const safe = safeHttpsUrl(mediaImage);
    if (safe) return safe;
  }

  // 4. inline <img> in description, content:encoded or block
  const inline = description.match(/<img\b[^>]*\bsrc=["']([^"']+)["']/i)?.[1]
    || contentEncoded.match(/<img\b[^>]*\bsrc=["']([^"']+)["']/i)?.[1]
    || block.match(/<img\b[^>]*\bsrc=["']([^"']+)["']/i)?.[1];
  if (inline) {
    const safe = safeHttpsUrl(inline);
    if (safe) return safe;
  }

  // 5. fallback: youtube embed -> youtube thumbnail
  const ytMatch = block.match(/https?:\/\/(?:www\.)?(?:youtube\.com\/(?:embed\/|watch\?v=)|youtu\.be\/)([\w-]{11})/i);
  if (ytMatch?.[1]) {
    return `https://img.youtube.com/vi/${ytMatch[1]}/hqdefault.jpg`;
  }

  return "";
};

export const parseGamingNewsFeed = (xml, source) => {
  const blocks = String(xml).match(/<item\b[\s\S]*?<\/item>/gi) || [];
  return blocks.slice(0, 20).flatMap((block) => {
    const title = stripHtml(textFrom(block, "title")).slice(0, 180);
    const link = safeHttpsUrl(textFrom(block, "link"));
    if (!title || !link) return [];

    const rawDescription = textFrom(block, "description");
    const rawContentEncoded = textFrom(block, "content:encoded");
    const publishedAtRaw = textFrom(block, "pubDate") || textFrom(block, "dc:date");
    const publishedAt = Number.isNaN(Date.parse(publishedAtRaw))
      ? new Date().toISOString()
      : new Date(publishedAtRaw).toISOString();

    return [{
      id: Buffer.from(link).toString("base64url").slice(0, 96),
      title,
      url: link,
      summary: stripHtml(rawDescription).slice(0, 260),
      imageUrl: thumbnailFrom(block, rawDescription, rawContentEncoded),
      publishedAt,
      source,
    }];
  });
};

const configuredFeeds = () => {
  const raw = process.env.GAMING_NEWS_FEEDS?.trim();
  if (!raw) return DEFAULT_FEEDS;
  const feeds = raw.split(",").flatMap((entry) => {
    const [name, url] = entry.split("|").map((value) => value.trim());
    const safeUrl = safeHttpsUrl(url || "");
    return name && safeUrl ? [{ name: name.slice(0, 40), url: safeUrl }] : [];
  });
  return feeds.length ? feeds.slice(0, 5) : DEFAULT_FEEDS;
};

const fetchFeed = async ({ name, url }) => {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    headers: {
      Accept: "application/rss+xml, application/xml;q=0.9, text/xml;q=0.8",
      "User-Agent": "Phelierium/3.0 (+gaming-news)",
    },
  });
  if (!response.ok) throw new Error(`${name}: HTTP ${response.status}`);
  const xml = await response.text();
  if (xml.length > 2_000_000) throw new Error(`${name}: feed muito grande`);
  return parseGamingNewsFeed(xml, name);
};

export const getGamingNews = async ({ force = false } = {}) => {
  const now = Date.now();
  if (!force && cache.items.length && cache.expiresAt > now) {
    return { ...cache, cached: true };
  }

  const feeds = configuredFeeds();
  const results = await Promise.allSettled(feeds.map(fetchFeed));
  const items = results
    .flatMap((result) => result.status === "fulfilled" ? result.value : [])
    .filter((item, index, all) => all.findIndex((candidate) => candidate.url === item.url) === index)
    .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt))
    .slice(0, 40);
  const sources = feeds.map((feed, index) => ({
    name: feed.name,
    available: results[index]?.status === "fulfilled",
  }));

  if (!items.length && cache.items.length) {
    return { ...cache, sources, cached: true, stale: true };
  }
  if (!items.length) throw new Error("Nenhuma fonte de notícias respondeu.");

  cache = { items, sources, expiresAt: now + CACHE_TTL_MS };
  return { ...cache, cached: false };
};

export const resetGamingNewsCache = () => {
  cache = { expiresAt: 0, items: [], sources: [] };
};
