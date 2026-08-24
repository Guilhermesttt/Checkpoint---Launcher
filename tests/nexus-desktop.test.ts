import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
import { afterEach, describe, expect, it, vi } from "vitest";

const require = createRequire(import.meta.url);
const {
  createNexusCredentialStore,
} = require("../electron/nexus-credential-store.cjs") as {
  createNexusCredentialStore: (options: {
    userDataPath: string;
    safeStorage: {
      isEncryptionAvailable: () => boolean;
      encryptString: (value: string) => Buffer;
      decryptString: (value: Buffer) => string;
    };
  }) => {
    clear: () => void;
    getStatus: () => { connected: boolean; encryptionAvailable: boolean };
    read: () => string | null;
    save: (apiKey: string) => void;
    credentialPath: string;
  };
};
const {
  getNexusDownloadLinks,
  getNexusModCatalog,
  getNexusModDetails,
  getNexusModFiles,
  validateNexusApiKey,
} = require("../electron/nexus-api.cjs") as {
  validateNexusApiKey: (options: {
    apiKey: string;
    appVersion: string;
    fetchImpl: typeof fetch;
  }) => Promise<Record<string, unknown>>;
  getNexusModFiles: (options: {
    apiKey: string;
    appVersion: string;
    gameDomain: string;
    modId: string;
    fetchImpl: typeof fetch;
  }) => Promise<{
    files: Array<Record<string, unknown>>;
    rateLimit: Record<string, number | null>;
  }>;
  getNexusDownloadLinks: (options: {
    apiKey: string;
    appVersion: string;
    gameDomain: string;
    modId: string;
    fileId: string;
    downloadKey: string;
    expires: string;
    fetchImpl: typeof fetch;
  }) => Promise<{
    mirrors: Array<{ name: string; shortName: string; uri: string }>;
    rateLimit: Record<string, number | null>;
  }>;
  getNexusModDetails: (options: {
    apiKey: string;
    appVersion: string;
    gameDomain: string;
    modId: string;
    fetchImpl: typeof fetch;
  }) => Promise<{
    mod: Record<string, unknown>;
    rateLimit: Record<string, number | null>;
  }>;
  getNexusModCatalog: (options: {
    apiKey: string;
    appVersion: string;
    gameDomain: string;
    fetchImpl: typeof fetch;
  }) => Promise<{
    mods: Array<Record<string, unknown>>;
    rateLimit: Record<string, number | null>;
  }>;
};

const temporaryDirectories: string[] = [];
afterEach(() => {
  temporaryDirectories.splice(0).forEach((directory) =>
    rmSync(directory, { recursive: true, force: true }));
});

const apiKey = `${"aB3+".repeat(20)}==--${"z9/".repeat(8)}`;

describe("integração Nexus no desktop", () => {
  it("salva a chave somente em formato criptografado e permite removê-la", () => {
    const directory = mkdtempSync(join(tmpdir(), "checkpoint-nexus-"));
    temporaryDirectories.push(directory);
    const safeStorage = {
      isEncryptionAvailable: () => true,
      encryptString: (value: string) =>
        Buffer.from([...Buffer.from(value)].map((byte) => byte ^ 0x5a)),
      decryptString: (value: Buffer) =>
        Buffer.from([...value].map((byte) => byte ^ 0x5a)).toString("utf8"),
    };
    const store = createNexusCredentialStore({
      userDataPath: directory,
      safeStorage,
    });

    store.save(apiKey);

    expect(store.read()).toBe(apiKey);
    expect(store.getStatus()).toEqual({
      connected: true,
      encryptionAvailable: true,
    });
    expect(readFileSync(store.credentialPath, "utf8")).not.toContain(apiKey);

    store.clear();
    expect(store.read()).toBeNull();
  });

  it("valida a conta sem devolver ou registrar a chave", async () => {
    const fetchImpl = vi.fn(async (_url: string, init?: RequestInit) => {
      expect(init?.headers).toMatchObject({
        apikey: apiKey,
        "Application-Name": "Phelierium",
        "Application-Version": "3.0.0",
      });
      return new Response(JSON.stringify({
        user_id: 42,
        name: "Checkpoint Tester",
        profile_url: "https://www.nexusmods.com/users/42",
        is_premium: true,
        is_supporter: false,
      }), {
        status: 200,
        headers: {
          "x-rl-daily-remaining": "19999",
          "x-rl-hourly-remaining": "499",
        },
      });
    }) as unknown as typeof fetch;

    await expect(validateNexusApiKey({
      apiKey,
      appVersion: "3.0.0",
      fetchImpl,
    })).resolves.toEqual({
      userId: 42,
      name: "Checkpoint Tester",
      profileUrl: "https://www.nexusmods.com/users/42",
      isPremium: true,
      isSupporter: false,
      rateLimit: {
        dailyRemaining: 19999,
        hourlyRemaining: 499,
      },
    });
  });

  it("normaliza a lista autenticada de arquivos de um mod", async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      expect(url).toContain("/games/skyrimspecialedition/mods/12604/files.json");
      return new Response(JSON.stringify({
        files: [{
          file_id: 901,
          name: "Main file",
          version: "1.2.0",
          category_name: "MAIN",
          description: "<p>Arquivo principal</p>",
          size_kb: 2048,
          uploaded_timestamp: 1_700_000_000,
          is_primary: true,
        }],
      }), { status: 200 });
    }) as unknown as typeof fetch;

    const result = await getNexusModFiles({
      apiKey,
      appVersion: "3.0.0",
      gameDomain: "skyrimspecialedition",
      modId: "12604",
      fetchImpl,
    });

    expect(result.files).toEqual([{
      id: "901",
      name: "Main file",
      version: "1.2.0",
      category: "MAIN",
      description: "Arquivo principal",
      sizeKb: 2048,
      uploadedAt: 1_700_000_000,
      primary: true,
    }]);
  });

  it("resolve a autorização temporária NXM sem expor a chave na resposta", async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      expect(url).toContain(
        "/games/cyberpunk2077/mods/501/files/9001/download_link.json",
      );
      expect(url).toContain("key=temporary-download-key");
      expect(url).toContain("expires=1900000000");
      return new Response(JSON.stringify([
        {
          name: "Nexus CDN",
          short_name: "cdn",
          URI: "https://download.nexusmods.com/archive.zip",
        },
        {
          name: "Insecure",
          short_name: "bad",
          URI: "http://example.com/archive.zip",
        },
      ]), { status: 200 });
    }) as unknown as typeof fetch;

    const result = await getNexusDownloadLinks({
      apiKey,
      appVersion: "3.0.0",
      gameDomain: "cyberpunk2077",
      modId: "501",
      fileId: "9001",
      downloadKey: "temporary-download-key",
      expires: "1900000000",
      fetchImpl,
    });

    expect(result.mirrors).toEqual([{
      name: "Nexus CDN",
      shortName: "cdn",
      uri: "https://download.nexusmods.com/archive.zip",
    }]);
    expect(JSON.stringify(result)).not.toContain("temporary-download-key");
  });

  it("carrega um mod específico pela URL normalizada", async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      expect(url).toContain("/games/cyberpunk2077/mods/501.json");
      return new Response(JSON.stringify({
        mod_id: 501,
        name: "URL mod",
        author: "Author",
        summary: "<p>Imported safely</p>",
        picture_url: "https://staticdelivery.nexusmods.com/url.jpg",
        version: "2.0",
        available: true,
        contains_adult_content: false,
      }), { status: 200 });
    }) as unknown as typeof fetch;

    const result = await getNexusModDetails({
      apiKey,
      appVersion: "3.0.0",
      gameDomain: "cyberpunk2077",
      modId: "501",
      fetchImpl,
    });

    expect(result.mod).toMatchObject({
      id: "cyberpunk2077:501",
      modId: "501",
      name: "URL mod",
      summary: "Imported safely",
      feed: "Adicionado por URL",
    });
  });

  it("combina os feeds autenticados sem duplicar mods ou exibir conteúdo adulto", async () => {
    const common = {
      available: true,
      contains_adult_content: false,
      version: "1.0",
      author: "Author",
      summary: "Summary",
      picture_url: "https://staticdelivery.nexusmods.com/mod.jpg",
    };
    const fetchImpl = vi.fn(async (url: string) => {
      const files = url.includes("trending")
        ? [{ ...common, mod_id: 1, name: "Trending" }]
        : url.includes("latest_updated")
          ? [
              { ...common, mod_id: 1, name: "Trending duplicate" },
              { ...common, mod_id: 2, name: "Updated" },
            ]
          : [
              { ...common, mod_id: 3, name: "Adult", contains_adult_content: true },
              { ...common, mod_id: 4, name: "New" },
            ];
      return new Response(JSON.stringify(files), {
        status: 200,
        headers: { "x-rl-daily-remaining": "100" },
      });
    }) as unknown as typeof fetch;

    const result = await getNexusModCatalog({
      apiKey,
      appVersion: "3.0.0",
      gameDomain: "cyberpunk2077",
      fetchImpl,
    });

    expect(result.mods).toHaveLength(3);
    expect(result.mods.map((mod) => mod.name)).toEqual([
      "Trending",
      "Updated",
      "New",
    ]);
    expect(result.mods[0]).toMatchObject({
      id: "cyberpunk2077:1",
      modId: "1",
      feed: "Em alta",
      modPageUrl: "https://www.nexusmods.com/cyberpunk2077/mods/1",
    });
  });

  it("amplia o catálogo recente usando lotes v3", async () => {
    const gameId = 42n;
    const compositeId = (gameId << 32n | 501n).toString();
    const adultCompositeId = (gameId << 32n | 502n).toString();
    const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.endsWith("/games/cyberpunk2077.json")) {
        return new Response(JSON.stringify({ id: Number(gameId) }), { status: 200 });
      }
      if (url.includes("/mods/updated.json?period=1m")) {
        return new Response(JSON.stringify([
          { mod_id: 501, latest_mod_activity: 1_800_000_000 },
          { mod_id: 502, latest_file_update: 1_700_000_000 },
        ]), { status: 200 });
      }
      if (url.endsWith("/v3/mods/batch")) {
        expect(init?.method).toBe("POST");
        expect(JSON.parse(String(init?.body))).toEqual({
          mod_ids: [compositeId, adultCompositeId],
        });
        return new Response(JSON.stringify({
          data: {
            mods: [
              {
                id: compositeId,
                name: "Recent mod",
                summary: "Recent summary",
                status: "published",
                adult_content: false,
                thumbnail_url: "https://staticdelivery.nexusmods.com/recent.jpg",
              },
              {
                id: adultCompositeId,
                name: "Adult mod",
                summary: "",
                status: "published",
                adult_content: true,
                thumbnail_url: null,
              },
            ],
          },
        }), { status: 200 });
      }
      return new Response(JSON.stringify([]), { status: 200 });
    }) as unknown as typeof fetch;

    const result = await getNexusModCatalog({
      apiKey,
      appVersion: "3.0.0",
      gameDomain: "cyberpunk2077",
      fetchImpl,
    });

    expect(result).toMatchObject({
      scope: "recent-30-days",
      recentCandidateCount: 2,
    });
    expect(result.mods).toHaveLength(1);
    expect(result.mods[0]).toMatchObject({
      id: "cyberpunk2077:501",
      modId: "501",
      name: "Recent mod",
      updatedAt: 1_800_000_000,
      feed: "Últimos 30 dias",
    });
  });
});
