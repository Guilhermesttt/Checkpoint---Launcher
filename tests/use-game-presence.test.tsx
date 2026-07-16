// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Game, UserProfile } from "../src/types/domain";

const steamMocks = vi.hoisted(() => ({
  fetchSteamAchievementDetails: vi.fn(async () => ({ achievements: [] })),
  fetchSteamCurrentGame: vi.fn(),
}));

vi.mock("../src/services/steam", () => ({
  fetchSteamAchievementDetails: steamMocks.fetchSteamAchievementDetails,
  fetchSteamCurrentGame: steamMocks.fetchSteamCurrentGame,
}));

vi.mock("../src/services/socialActivity", () => ({
  publishSocialActivity: vi.fn(async () => undefined),
}));

import {
  UNVERIFIED_URI_PRESENCE_TTL_MS,
  useGamePresence,
} from "../src/hooks/useGamePresence";

const setElectronApi = (overrides: Partial<NonNullable<Window["electronAPI"]>>) => {
  Object.defineProperty(window, "electronAPI", {
    configurable: true,
    value: overrides as Window["electronAPI"],
  });
};

const advancePresencePoll = async () => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(10_000);
  });
};

afterEach(() => {
  vi.useRealTimers();
  Object.defineProperty(window, "electronAPI", {
    configurable: true,
    value: undefined,
  });
  vi.clearAllMocks();
});

describe("game presence lifecycle", () => {
  it("marca lancamentos URI como provisorios por 12 horas e depois os encerra", async () => {
    vi.useFakeTimers();
    const startedAt = new Date("2026-07-16T12:00:00.000Z");
    vi.setSystemTime(startedAt);
    setElectronApi({ detectRunningGames: vi.fn().mockResolvedValue([]) });

    const { result } = renderHook(() => useGamePresence({
      userUid: "user-1",
      userProfile: null,
      games: [],
    }));

    act(() => result.current.markCurrentPresence("Steam Game", null));

    expect(UNVERIFIED_URI_PRESENCE_TTL_MS).toBe(12 * 60 * 60 * 1000);
    expect(result.current.currentPresenceGame).toBe("Steam Game");
    expect(result.current.presenceVerification).toBe("provisional");
    expect(result.current.provisionalPresenceExpiresAt).toBe(
      new Date(startedAt.getTime() + UNVERIFIED_URI_PRESENCE_TTL_MS).toISOString(),
    );

    vi.setSystemTime(startedAt.getTime() + UNVERIFIED_URI_PRESENCE_TTL_MS + 1);
    await advancePresencePoll();

    expect(result.current.currentPresenceGame).toBeNull();
    expect(result.current.presenceVerification).toBe("none");
    expect(result.current.provisionalPresenceExpiresAt).toBeNull();
  });

  it("mantem uma sessao local enquanto o processo esta ativo e encerra quando ele sai", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-16T12:00:00.000Z"));
    const executablePath = "C:\\Games\\Checkpoint\\Checkpoint.exe";
    const isExecutableRunning = vi.fn().mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    setElectronApi({
      isExecutableRunning,
      detectRunningGames: vi.fn().mockResolvedValue([executablePath]),
    });
    const game: Game = {
      id: "local-1",
      title: "Checkpoint",
      image: "",
      executablePath,
      launcherType: "local",
    };

    const { result } = renderHook(() => useGamePresence({
      userUid: "user-1",
      userProfile: null,
      games: [game],
    }));
    act(() => result.current.markCurrentPresence(game.title, executablePath));

    expect(result.current.presenceVerification).toBe("process");
    expect(result.current.provisionalPresenceExpiresAt).toBeNull();

    await advancePresencePoll();
    expect(result.current.currentPresenceGame).toBe(game.title);

    await advancePresencePoll();
    expect(result.current.currentPresenceGame).toBeNull();
    expect(isExecutableRunning).toHaveBeenCalledTimes(2);
  });

  it("promove uma sessão URI da Steam quando o backend confirma o App ID", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-16T12:00:00.000Z"));
    setElectronApi({ detectRunningGames: vi.fn().mockResolvedValue([]) });
    steamMocks.fetchSteamCurrentGame.mockResolvedValue({
      observable: true,
      appId: "10",
      title: "Counter-Strike",
      visibilityState: 3,
    });
    const game: Game = {
      id: "steam-10",
      title: "Counter-Strike",
      image: "",
      executablePath: "10",
      launcherType: "steam",
      steamAppId: "10",
    };
    const profile = { uid: "user-1", steamId: "76561198000000000" } as UserProfile;
    const { result } = renderHook(() => useGamePresence({
      userUid: profile.uid,
      userProfile: profile,
      games: [game],
    }));

    act(() => result.current.markCurrentPresence(game.title, null));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(15_000);
    });

    expect(result.current.currentPresenceGame).toBe(game.title);
    expect(result.current.presenceVerification).toBe("steam");
    expect(result.current.provisionalPresenceExpiresAt).toBeNull();
  });

  it("encerra uma sessão Steam após duas confirmações de que o jogo saiu", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-16T12:00:00.000Z"));
    setElectronApi({ detectRunningGames: vi.fn().mockResolvedValue([]) });
    steamMocks.fetchSteamCurrentGame.mockResolvedValue({
      observable: true,
      appId: null,
      title: null,
      visibilityState: 3,
    });
    const game: Game = {
      id: "steam-20",
      title: "Team Fortress Classic",
      image: "",
      executablePath: "20",
      launcherType: "steam",
      steamAppId: "20",
    };
    const profile = { uid: "user-1", steamId: "76561198000000000" } as UserProfile;
    const { result } = renderHook(() => useGamePresence({
      userUid: profile.uid,
      userProfile: profile,
      games: [game],
    }));

    act(() => result.current.markCurrentPresence(game.title, null));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(105_000);
    });

    expect(steamMocks.fetchSteamCurrentGame).toHaveBeenCalled();
    expect(result.current.currentPresenceGame).toBeNull();
    expect(result.current.presenceVerification).toBe("none");
  });
});
