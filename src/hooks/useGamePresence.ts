import { useState, useCallback, useEffect } from "react";
import { useInterval } from "./useInterval";
import type { Game, UserProfile } from "../types/domain";
import { getMonitorableExecutablePath } from "../services/launcher";
import { fetchSteamAchievementDetails } from "../services/steam";

interface UseGamePresenceProps {
  userUid?: string;
  userProfile?: UserProfile | null;
  games: Game[];
}

export function useGamePresence({ userUid, userProfile, games }: UseGamePresenceProps) {
  const [currentPresenceGame, setCurrentPresenceGame] = useState<string | null>(null);
  const [currentPresenceExecutablePath, setCurrentPresenceExecutablePath] = useState<string | null>(null);

  const clearCurrentPresence = useCallback(() => {
    setCurrentPresenceGame(null);
    setCurrentPresenceExecutablePath(null);
  }, []);

  const syncDetectedRunningGame = useCallback(async () => {
    if (!window.electronAPI?.detectRunningGames || games.length === 0) {
      return;
    }

    const monitorableGames = games
      .map((game) => ({
        game,
        executablePath: getMonitorableExecutablePath(game),
      }))
      .filter((entry): entry is { game: Game; executablePath: string } => Boolean(entry.executablePath));

    if (monitorableGames.length === 0) return;

    try {
      const runningPaths = await window.electronAPI.detectRunningGames(
        monitorableGames.map((entry) => entry.executablePath),
      );
      const normalizedRunning = new Set(runningPaths.map((value) => value.trim().toLowerCase()));

      const matchedCurrent = currentPresenceExecutablePath
        ? monitorableGames.find(
            (entry) =>
              entry.executablePath.trim().toLowerCase() === currentPresenceExecutablePath.trim().toLowerCase() &&
              normalizedRunning.has(entry.executablePath.trim().toLowerCase()),
          )
        : undefined;

      const matchedGame =
        matchedCurrent ||
        monitorableGames.find((entry) => normalizedRunning.has(entry.executablePath.trim().toLowerCase()));

      if (!matchedGame) {
        if (currentPresenceExecutablePath) {
          clearCurrentPresence();
        }
        return;
      }

      if (
        currentPresenceGame !== matchedGame.game.title ||
        currentPresenceExecutablePath !== matchedGame.executablePath
      ) {
        setCurrentPresenceGame(matchedGame.game.title);
        setCurrentPresenceExecutablePath(matchedGame.executablePath);
      }
    } catch {
      // Presence auto-detection is best-effort.
    }
  }, [clearCurrentPresence, currentPresenceExecutablePath, currentPresenceGame, games]);

  const verifyRunningState = useCallback(async () => {
    if (!currentPresenceExecutablePath || !window.electronAPI?.isExecutableRunning) {
      void syncDetectedRunningGame();
      return;
    }
    try {
      const isRunning = await window.electronAPI.isExecutableRunning(currentPresenceExecutablePath);
      if (!isRunning) {
        clearCurrentPresence();
      }
    } catch {
      // best-effort
    }
  }, [currentPresenceExecutablePath, clearCurrentPresence, syncDetectedRunningGame]);

  useInterval(
    () => {
      if (userUid) {
        void verifyRunningState();
      }
    },
    userUid ? 10000 : null,
    { pauseWhenHidden: true }
  );

  useEffect(() => {
    if (!userUid) return;
    const handleFocus = () => {
      void verifyRunningState();
    };
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [userUid, verifyRunningState]);

  const pollAchievements = useCallback(async (unlockedSet: Set<string>, state: { firstLoadDone: boolean }) => {
    if (!currentPresenceGame || !userProfile?.steamId) return;

    const runningGame = games.find(
      (g) =>
        g.title.toLowerCase().includes(currentPresenceGame.toLowerCase()) ||
        currentPresenceGame.toLowerCase().includes(g.title.toLowerCase())
    );

    const appId = runningGame?.steamAppId;
    if (!appId) return;

    try {
      const details = await fetchSteamAchievementDetails(userProfile.steamId, appId);

      if (!state.firstLoadDone) {
        details.achievements.forEach((ach) => {
          if (ach.achieved) {
            unlockedSet.add(ach.apiName);
          }
        });
        state.firstLoadDone = true;
        return;
      }

      for (const ach of details.achievements) {
        if (ach.achieved && !unlockedSet.has(ach.apiName)) {
          unlockedSet.add(ach.apiName);

          void window.electronAPI?.showAchievementOverlay({
            gameId: runningGame.id,
            achievementId: ach.apiName,
            achievement: {
              id: ach.apiName,
              name: ach.name,
              description: ach.description,
              icon: ach.icon || "",
            },
            unlockedAt: new Date().toISOString(),
            duplicate: false,
          });
        }
      }
    } catch (error) {
      console.error("Erro no polling de conquistas Steam:", error);
    }
  }, [currentPresenceGame, userProfile?.steamId, games]);

  const [achievementsState] = useState(() => ({
    unlockedSet: new Set<string>(),
    state: { firstLoadDone: false }
  }));


  useEffect(() => {
    achievementsState.unlockedSet.clear();
    achievementsState.state.firstLoadDone = false;
  }, [currentPresenceGame, achievementsState]);

  useInterval(
    () => {
      void pollAchievements(achievementsState.unlockedSet, achievementsState.state);
    },
    currentPresenceGame && userProfile?.steamId ? 15000 : null,
    { pauseWhenHidden: true }
  );

  return {
    currentPresenceGame,
    setCurrentPresenceGame,
    currentPresenceExecutablePath,
    setCurrentPresenceExecutablePath,
    clearCurrentPresence,
    syncDetectedRunningGame,
  };
}
