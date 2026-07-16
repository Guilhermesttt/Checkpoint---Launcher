import { useCallback, useEffect, useRef } from "react";
import { writeBatch } from "firebase/firestore";
import type { Game } from "../types/domain";
import { db } from "../../Firebase";
import { profileDocRef, userGameDocRef } from "../services/firestorePaths";
import { calculateAchievementTotals } from "../utils/achievementTotals";
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
) {
  const syncingRef = useRef(false);
  const rerunRef = useRef(false);
  const lastProfileFingerprintRef = useRef("");
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

      for (let index = 0; index < changedGames.length; index += 400) {
        const batch = writeBatch(db);
        changedGames.slice(index, index + 400).forEach((game) => {
          batch.update(userGameDocRef(userUid, game.id), {
            totalAchievements: game.totalAchievements || 0,
            completedAchievements: game.completedAchievements || 0,
            achievementsUpdatedAt: summary.updatedAt,
          });
        });
        await batch.commit();
      }

      const totals = calculateAchievementTotals(projectedGames);
      const profileFingerprint = [
        totals.unlocked,
        totals.available,
        totals.gamesWithAchievements,
        projectedGames.length,
        steamSummary?.requested ?? "",
        steamSummary?.resolved ?? "",
      ].join(":");
      if (profileFingerprint !== lastProfileFingerprintRef.current) {
        const profileBatch = writeBatch(db);
        profileBatch.set(profileDocRef(userUid), {
          achievementSummary: {
            ...totals,
            totalGames: projectedGames.length,
            updatedAt: new Date().toISOString(),
          },
          ...(steamSummary ? {
            steamAchievementSync: {
              requested: steamSummary.requested,
              resolved: steamSummary.resolved,
              failed: steamSummary.failedAppIds.length,
              failedAppIds: steamSummary.failedAppIds.slice(0, 100),
              updatedAt: new Date().toISOString(),
            },
          } : {}),
        }, { merge: true });
        await profileBatch.commit();
        lastProfileFingerprintRef.current = profileFingerprint;
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
  }, [games, gamesLoaded, steamId, userUid]);

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
