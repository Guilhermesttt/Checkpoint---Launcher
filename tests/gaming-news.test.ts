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

  it("prioriza media:thumbnail sobre media:content quando este é um vídeo", () => {
    const xml = `<?xml version="1.0"?>
      <rss><channel>
        <item>
          <title>Trailer do Jogo</title>
          <link>https://games.example/trailer</link>
          <pubDate>Fri, 21 Aug 2026 00:43:05 GMT</pubDate>
          <description>Confira o trailer.</description>
          <media:content url="https://www.youtube.com/embed/2xrKoQEvKvI" medium="video">
            <media:thumbnail url="https://games.example/uploads/thumb.png" />
          </media:content>
        </item>
      </channel></rss>`;

    const result = parseGamingNewsFeed(xml, "GameVicio");
    expect(result[0]?.imageUrl).toBe("https://games.example/uploads/thumb.png");
  });

  it("converte embed do YouTube para thumbnail hqdefault quando não há outra imagem", () => {
    const xml = `<?xml version="1.0"?>
      <rss><channel>
        <item>
          <title>Vídeo sem thumbnail dedicada</title>
          <link>https://games.example/video</link>
          <pubDate>Fri, 21 Aug 2026 00:43:05 GMT</pubDate>
          <description><![CDATA[<iframe src="https://www.youtube.com/embed/qw2q02bgZfo"></iframe>]]></description>
        </item>
      </channel></rss>`;

    const result = parseGamingNewsFeed(xml, "YouTubeNews");
    expect(result[0]?.imageUrl).toBe("https://img.youtube.com/vi/qw2q02bgZfo/hqdefault.jpg");
  });
});
