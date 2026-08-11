import { describe, expect, it, vi } from "vitest";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { createRetroArtworkImporter } = require("../electron/retro-artwork-importer.cjs");

describe("retro remote artwork importer", () => {
  it("rejects private network destinations before downloading", async () => {
    const fetchImpl = vi.fn();
    const importer = createRetroArtworkImporter({
      fetchImpl,
      lookupImpl: vi.fn().mockResolvedValue([{ address: "127.0.0.1", family: 4 }]),
    });
    await expect(importer("http://example.test/cover.jpg")).rejects.toThrow("rede privada");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("converts a public image URL to a local data URL", async () => {
    const importer = createRetroArtworkImporter({
      lookupImpl: vi.fn().mockResolvedValue([{ address: "93.184.216.34", family: 4 }]),
      fetchImpl: vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "image/jpeg", "content-length": "3" }),
        arrayBuffer: async () => Uint8Array.from([1, 2, 3]).buffer,
      }),
    });
    await expect(importer("https://example.com/cover.jpg")).resolves.toBe("data:image/jpeg;base64,AQID");
  });
});
