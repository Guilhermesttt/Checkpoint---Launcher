import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
import { afterEach, describe, expect, it, vi } from "vitest";

const require = createRequire(import.meta.url);
const {
  downloadNexusFile,
  parseNxmUrl,
  sanitizeDownloadFilename,
} = require("../electron/nexus-download-manager.cjs") as {
  parseNxmUrl: (url: string) => {
    gameDomain: string;
    modId: string;
    fileId: string;
    downloadKey: string;
    expires: string;
    userId: string;
  };
  sanitizeDownloadFilename: (name: string, fallback: string) => string;
  downloadNexusFile: (options: {
    uri: string;
    destinationRoot: string;
    gameDomain: string;
    modId: string;
    fileId: string;
    fetchImpl: typeof fetch;
    onProgress: (progress: { receivedBytes: number; totalBytes: number }) => void;
  }) => Promise<{ filePath: string; filename: string; bytes: number }>;
};

const directories: string[] = [];
afterEach(() => {
  directories.splice(0).forEach((directory) =>
    rmSync(directory, { recursive: true, force: true }));
});

describe("gerenciador de downloads Nexus", () => {
  it("interpreta apenas links NXM de arquivos com autorização temporária", () => {
    expect(parseNxmUrl(
      "nxm://cyberpunk2077/mods/501/files/9001?key=abcDEF123%2B%2F%3D&expires=1900000000&user_id=42",
    )).toEqual({
      gameDomain: "cyberpunk2077",
      modId: "501",
      fileId: "9001",
      downloadKey: "abcDEF123+/=",
      expires: "1900000000",
      userId: "42",
    });

    expect(() => parseNxmUrl("https://example.com/file.zip")).toThrow(/NXM/);
    expect(() => parseNxmUrl(
      "nxm://cyberpunk2077/mods/501/files/9001?key=bad&expires=1900000000",
    )).toThrow(/autorização/);
  });

  it("impede nomes de arquivo de escaparem da pasta de downloads", () => {
    expect(sanitizeDownloadFilename("../../evil.zip", "fallback.zip")).toBe("evil.zip");
    expect(sanitizeDownloadFilename("bad<name>?.7z", "fallback.zip")).toBe("bad_name__.7z");
  });

  it("grava em arquivo parcial e conclui o pacote dentro da pasta do mod", async () => {
    const directory = mkdtempSync(join(tmpdir(), "checkpoint-nxm-"));
    directories.push(directory);
    const progress = vi.fn();
    const payload = new TextEncoder().encode("checkpoint archive");
    const fetchImpl = vi.fn(async () => new Response(payload, {
      status: 200,
      headers: {
        "content-length": String(payload.byteLength),
        "content-disposition": "attachment; filename=\"Example Mod.zip\"",
      },
    })) as unknown as typeof fetch;

    const result = await downloadNexusFile({
      uri: "https://download.nexusmods.com/generated-name",
      destinationRoot: directory,
      gameDomain: "cyberpunk2077",
      modId: "501",
      fileId: "9001",
      fetchImpl,
      onProgress: progress,
    });

    expect(result.filename).toBe("Example Mod.zip");
    expect(result.filePath).toBe(join(directory, "cyberpunk2077", "501", "Example Mod.zip"));
    expect(existsSync(result.filePath)).toBe(true);
    expect(existsSync(`${result.filePath}.part`)).toBe(false);
    expect(readFileSync(result.filePath, "utf8")).toBe("checkpoint archive");
    expect(progress).toHaveBeenLastCalledWith({
      receivedBytes: payload.byteLength,
      totalBytes: payload.byteLength,
    });
  });
});
