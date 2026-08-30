import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  createEpicAchievementsCache,
  CACHE_TTL_MS,
} from "../electron/epic-achievements-cache.cjs";

function createMockFs(initialFiles: Record<string, string> = {}) {
  const files = new Map(Object.entries(initialFiles));
  const normalize = (p: string) => p.replace(/\\/g, "/");
  return {
    existsSync: vi.fn((p: string) => files.has(normalize(p))),
    promises: {
      mkdir: vi.fn().mockResolvedValue(undefined),
      readFile: vi.fn((p: string) => {
        const key = normalize(p);
        if (!files.has(key)) {
          const err = new Error("ENOENT") as any;
          err.code = "ENOENT";
          throw err;
        }
        return Promise.resolve(files.get(key)!);
      }),
      writeFile: vi.fn((p: string, content: string) => {
        files.set(normalize(p), content);
        return Promise.resolve();
      }),
      rename: vi.fn((from: string, to: string) => {
        const key = normalize(from);
        const toKey = normalize(to);
        files.set(toKey, files.get(key) || "");
        files.delete(key);
        return Promise.resolve();
      }),
      unlink: vi.fn((p: string) => {
        files.delete(normalize(p));
        return Promise.resolve();
      }),
      readdir: vi.fn(() => {
        const names = new Set<string>();
        for (const key of files.keys()) {
          const parts = key.split("/");
          names.add(parts[parts.length - 1]);
        }
        return Promise.resolve([...names]);
      }),
    },
    _files: files,
  };
}

describe("epic-achievements-cache", () => {
  const fakeUserData = "/fake/userData";

  it("throws when userDataPath is missing", () => {
    expect(() => createEpicAchievementsCache({ userDataPath: "" })).toThrow(
      "userDataPath e obrigatorio",
    );
  });

  it("returns null when no cache exists", async () => {
    const mockFs = createMockFs();
    const cache = createEpicAchievementsCache({
      userDataPath: fakeUserData,
      fsImpl: mockFs as any,
    });
    const result = await cache.readCache("Fortnite");
    expect(result).toBeNull();
  });

  it("returns cached data when valid", async () => {
    const cachedData = {
      total: 5,
      completed: 2,
      list: [{ apiName: "ACH_1", name: "Test", achieved: true }],
    };
    const cacheKey = `${fakeUserData}/achievements/epic-cache/Fortnite.json`;
    const mockFs = createMockFs({
      [cacheKey]: JSON.stringify({
        data: cachedData,
        cachedAt: new Date().toISOString(),
        expiresAt: Date.now() + 10000,
      }),
    });

    const cache = createEpicAchievementsCache({
      userDataPath: fakeUserData,
      fsImpl: mockFs as any,
    });
    const result = await cache.readCache("Fortnite");
    expect(result).toEqual(cachedData);
  });

  it("returns null when cache is expired", async () => {
    const cachedData = { total: 5, completed: 2, list: [] };
    const cacheKey = `${fakeUserData}/achievements/epic-cache/Fortnite.json`;
    const mockFs = createMockFs({
      [cacheKey]: JSON.stringify({
        data: cachedData,
        cachedAt: new Date(Date.now() - 200000).toISOString(),
        expiresAt: Date.now() - 10000,
      }),
    });

    const cache = createEpicAchievementsCache({
      userDataPath: fakeUserData,
      fsImpl: mockFs as any,
    });
    const result = await cache.readCache("Fortnite");
    expect(result).toBeNull();
  });

  it("writes cache atomically", async () => {
    const mockFs = createMockFs();
    const cache = createEpicAchievementsCache({
      userDataPath: fakeUserData,
      fsImpl: mockFs as any,
    });
    const data = { total: 3, completed: 1, list: [] as any[] };
    await cache.writeCache("Fortnite", data);

    expect(mockFs.promises.mkdir).toHaveBeenCalled();
    expect(mockFs.promises.writeFile).toHaveBeenCalledWith(
      expect.stringContaining("Fortnite.json"),
      expect.stringContaining('"total": 3'),
      "utf8",
    );
    expect(mockFs.promises.rename).toHaveBeenCalled();
  });

  it("invalidates cache for a specific game", async () => {
    const cacheKey = `${fakeUserData}/achievements/epic-cache/Fortnite.json`;
    const mockFs = createMockFs({ [cacheKey]: "{}" });

    const cache = createEpicAchievementsCache({
      userDataPath: fakeUserData,
      fsImpl: mockFs as any,
    });
    await cache.invalidateCache("Fortnite");
    expect(mockFs.promises.unlink).toHaveBeenCalled();
  });

  it("clears all cache files", async () => {
    const dirKey = `${fakeUserData}/achievements/epic-cache`;
    const mockFs = createMockFs({
      [`${dirKey}/a.json`]: "{}",
      [`${dirKey}/b.json`]: "{}",
    });
    mockFs.existsSync = vi.fn((p: string) => {
      const n = p.replace(/\\/g, "/");
      return n === dirKey || n.startsWith(dirKey + "/");
    });

    const cache = createEpicAchievementsCache({
      userDataPath: fakeUserData,
      fsImpl: mockFs as any,
    });
    await cache.clearAll();
    expect(mockFs.promises.unlink).toHaveBeenCalledTimes(2);
  });

  it("sanitizes cache keys to prevent path traversal", async () => {
    const mockFs = createMockFs();
    const cache = createEpicAchievementsCache({
      userDataPath: fakeUserData,
      fsImpl: mockFs as any,
    });
    await cache.writeCache("Fortnite/../../etc/passwd", {
      total: 0,
      completed: 0,
      list: [],
    });

    const writtenPath = mockFs.promises.writeFile.mock.calls[0][0] as string;
    const normalizedPath = writtenPath.replace(/\\/g, "/");
    expect(normalizedPath).toContain("epic-cache");
    const fileName = writtenPath.split(/[\\/]/).pop() || "";
    expect(fileName).not.toMatch(/^\.\./);
    expect(fileName).toMatch(/Fortnite.*etc.*passwd/);
  });

  it("returns correct cache TTL", () => {
    expect(CACHE_TTL_MS).toBe(60 * 60 * 1000);
  });
});
