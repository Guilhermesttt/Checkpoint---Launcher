import { describe, expect, it } from "vitest";
import { parseGamingNewsFeed } from "../server/gaming-news.mjs";

describe("Radar Gamer", () => {
  it("normaliza RSS, remove HTML e aceita somente links HTTPS", () => {
    const xml = `<?xml version="1.0"?>
      <rss><channel>
        <item>
          <title><![CDATA[Novo &amp; grande jogo]]></title>
          <link>https://games.example/noticia</link>
          <pubDate>Fri, 17 Jul 2026 12:00:00 GMT</pubDate>
          <description><![CDATA[<img src="https://cdn.example/capa.jpg"><b>Resumo</b> da notícia.]]></description>
        </item>
        <item>
          <title>Link inseguro</title>
          <link>http://games.example/inseguro</link>
        </item>
      </channel></rss>`;

    expect(parseGamingNewsFeed(xml, "Fonte")).toEqual([expect.objectContaining({
      title: "Novo & grande jogo",
      url: "https://games.example/noticia",
      summary: "Resumo da notícia.",
      imageUrl: "https://cdn.example/capa.jpg",
      source: "Fonte",
    })]);
  });
});
