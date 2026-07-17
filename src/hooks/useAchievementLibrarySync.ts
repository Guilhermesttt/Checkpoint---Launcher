import { useCallback, useEffect, useRef } from "react";
import type { Game } from "../types/domain";
import { updateLibraryGame } from "../services/localLibrary";
import { fetchSteamAchievementSummary } from "../services/steam";

interface LocalAchievementSummary {
  byGameId: Record<string, { total: number; unlocked: number }>;
  bySteamAppId: Record<string, { total: number; unlocked: number }>;
  updatedAt: string;
}

const localStatsForGame = (game: Game, summary: LocalAchievementSummary) => {
  const steamAppId = String(game.steamAppId || "").trim();
  return (steamAppId ? summary.bySteamAppId[steamAppId] : undefined)
    || summary.byGameId[game.id];
};

export function useAchievementLibrarySync(
  userUid: string | undefined,
  steamId: string | undefined,
  games: Game[],
  gamesLoaded: boolean,
  onLibraryChanged?: () => Promise<void> | void,
) {
  const syncingRef = useRef(false);
  const rerunRef = useRef(false);
  const steamSyncAttemptedRef = useRef(false);
  const steamRetryTimerRef = useRef<number | null>(null);
  const steamRetryAttemptRef = useRef(0);

  const sync = useCallback(async function runSync() {
    if (!userUid || !gamesLoaded) return;
    if (syncingRef.current) {
      rerunRef.current = true;
      return;
    }

    syncingRef.current = true;
    try {
      const summary = window.electronAPI?.getLocalAchievementLibrarySummary
        ? await window.electronAPI.getLocalAchievementLibrarySummary()
        : { byGameId: {}, bySteamAppId: {}, updatedAt: new Date().toISOString() };
      const steamGames = games.filter(
        (game) => game.launcherType === "steam" && String(game.steamAppId || "").trim(),
      );
      const steamSummary = steamId && steamGames.length > 0 && !steamSyncAttemptedRef.current
        ? await fetchSteamAchievementSummary(
          steamGames.map((game) => String(game.steamAppId)),
        )
        : null;
      if (steamSummary) {
        steamSyncAttemptedRef.current = true;
        const syncComplete = steamSummary.failedAppIds.length === 0
          && steamSummary.resolved >= steamSummary.requested;
        if (syncComplete) {
          steamRetryAttemptRef.current = 0;
          if (steamRetryTimerRef.current != null) {
            window.clearTimeout(steamRetryTimerRef.current);
            steamRetryTimerRef.current = null;
          }
        } else if (steamRetryTimerRef.current == null) {
          const retryDelay = Math.min(
            10 * 60 * 1000,
            30_000 * (2 ** steamRetryAttemptRef.current),
          );
          steamRetryAttemptRef.current += 1;
          steamRetryTimerRef.current = window.setTimeout(() => {
            steamRetryTimerRef.current = null;
            steamSyncAttemptedRef.current = false;
            void runSync();
          }, retryDelay);
        }
      }

      const projectedGames = games.map((game) => {
        if (game.launcherType === "local") {
          const local = localStatsForGame(game, summary);
          if (!local) return game;
          return {
            ...game,
            totalAchievements: Math.max(local.total, local.unlocked),
            completedAchievements: local.unlocked,
          };
        }
        if (game.launcherType === "steam" && game.steamAppId && steamSummary?.stats[game.steamAppId]) {
          const steam = steamSummary.stats[game.steamAppId];
          return {
            ...game,
            totalAchievements: Math.max(steam.total, steam.unlocked),
            completedAchievements: steam.unlocked,
          };
        }
        return game;
      });

      const changedGames = projectedGames.filter((game, index) => {
        const current = games[index];
        return game.totalAchievements !== current.totalAchievements
          || game.completedAchievements !== current.completedAchievements;
      });

      if (changedGames.length > 0) {
        await Promise.all(changedGames.map((game) =>
          updateLibraryGame(userUid, game.id, {
            totalAchievements: game.totalAchievements || 0,
            completedAchievements: game.completedAchievements || 0,
            achievementsUpdatedAt: summary.updatedAt,
          })));
        await onLibraryChanged?.();
      }

    } catch (error) {
      console.error("Erro ao reconciliar biblioteca de conquistas:", error);
    } finally {
      syncingRef.current = false;
      if (rerunRef.current) {
        rerunRef.current = false;
        void runSync();
      }
    }
  }, [games, gamesLoaded, onLibraryChanged, steamId, userUid]);

  useEffect(() => {
    if (steamRetryTimerRef.current != null) {
      window.clearTimeout(steamRetryTimerRef.current);
      steamRetryTimerRef.current = null;
    }
    steamRetryAttemptRef.current = 0;
    steamSyncAttemptedRef.current = false;
  }, [steamId, userUid]);

  useEffect(() => () => {
    if (steamRetryTimerRef.current != null) {
      window.clearTimeout(steamRetryTimerRef.current);
    }
  }, []);

  useEffect(() => {
    void sync();
  }, [sync]);

  useEffect(() => {
    if (!window.electronAPI?.onRealtimeAchievementUnlock) return;
    const handler = window.electronAPI.onRealtimeAchievementUnlock(() => {
      window.setTimeout(() => void sync(), 100);
    });
    return () => window.electronAPI?.removeRealtimeAchievementUnlock?.(handler);
  }, [sync]);
}
