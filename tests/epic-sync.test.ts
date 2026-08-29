// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { fetchEpicLibrary, fetchEpicStatus, syncEpicLibraryToLocal } from "../src/services/epic";

vi.mock("../src/services/localLibrary", () => ({
  listLibraryGames: vi.fn().mockResolvedValue([]),
  createLibraryGame: vi.fn().mockResolvedValue({ id: "created-game-1" }),
  updateLibraryGame: vi.fn().mockResolvedValue({ id: "updated-game-1" }),
  deleteLibraryGame: vi.fn().mockResolvedValue(true),
}));

describe("epic-sync service", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("throws error when electronAPI is not present", async () => {
    // @ts-ignore
    delete window.electronAPI;
    await expect(fetchEpicLibrary()).rejects.toThrow("Epic Games requer o aplicativo desktop.");
    await expect(fetchEpicStatus()).rejects.toThrow("Epic Games requer o aplicativo desktop.");
  });

  it("calls getEpicLibrary on electronAPI without calling remote HTTP", async () => {
    const epicGame = {
      appName: "Fortnite",
      title: "Fortnite",
      catalogId: "fn-id",
      namespace: "fn-ns",
      description: "Battle Royale",
      keyImages: [],
    };

    const mockGetEpicLibrary = vi.fn().mockResolvedValue([epicGame]);
    const mockGetEpicAchievements = vi.fn().mockResolvedValue({ total: 0, completed: 0, list: [] });
    const mockGetEpicStatus = vi.fn().mockResolvedValue({ authenticated: true });

    Object.defineProperty(window, "electronAPI", {
      value: {
        getEpicStatus: mockGetEpicStatus,
        getEpicLibrary: mockGetEpicLibrary,
        getEpicAchievements: mockGetEpicAchievements,
      },
      configurable: true,
      writable: true,
    });

    const globalFetch = vi.fn();
    globalThis.fetch = globalFetch as any;

    const count = await syncEpicLibraryToLocal("user-1");
    expect(mockGetEpicLibrary).toHaveBeenCalledOnce();
    expect(globalFetch).not.toHaveBeenCalledWith(
      expect.stringContaining("/api/epic/library"),
      expect.anything(),
    );
    expect(count).toBe(1);
  });
});
