export {};

declare global {
  interface Window {
    electronAPI?: {
      launchExecutable: (executablePath: string) => Promise<void>;
      isExecutableRunning: (executablePath: string) => Promise<boolean>;
      detectRunningGames: (executablePaths: string[]) => Promise<string[]>;
      startGoogleBrowserAuth: () => Promise<{ state: string }>;
      openExternalUrl: (url: string) => Promise<void>;
      scanLocalGames: () => Promise<Array<{ name: string; path: string }>>;
      testOverlayWelcome: () => Promise<void>;
      testOverlayAchievement: () => Promise<void>;
      showGameStartOverlay: (payload: { gameTitle: string }) => Promise<void>;
      showFriendPlayingOverlay: (payload: {
        playerName: string;
        gameTitle: string;
        avatarUrl?: string | null;
      }) => Promise<void>;
      showFriendRequestOverlay: (payload: {
        playerName: string;
        avatarUrl?: string | null;
      }) => Promise<void>;
      showFriendAcceptedOverlay: (payload: {
        playerName: string;
        avatarUrl?: string | null;
      }) => Promise<void>;

      // Local achievements
      getLocalAchievementDefinitions: (
        gameId: string,
      ) => Promise<Record<string, unknown> | null>;
      getLocalAchievementProgress: (
        gameId: string,
      ) => Promise<{
        gameId: string;
        unlockedAchievements: Record<
          string,
          { id: string; name: string; description: string; icon: string; unlockedAt: string }
        >;
        updatedAt: string;
      } | null>;
      getLocalAchievementState: (
        appId: string
      ) => Promise<{ [id: string]: { earned: boolean; earnedTime: number } }>;
      saveLocalAchievementDefinitions: (
        gameId: string,
        definitions: Array<{ id: string; name: string; description: string; icon?: string }>,
        steamAppId?: string
      ) => Promise<boolean>;
      unlockLocalAchievement: (
        gameId: string,
        achievementId: string
      ) => Promise<{ duplicate: boolean }>;
      showAchievementOverlay: (payload: {
        gameId: string;
        achievementId: string;
        achievement: { id: string; name: string; description: string; icon: string };
        unlockedAt: string;
        duplicate: boolean;
      }) => Promise<void>;
      showFriendMessageOverlay: (payload: {
        senderName: string;
        messageText: string;
        avatarUrl?: string;
      }) => Promise<void>;

      // ─ Real-time achievement push events (main → renderer) ─────────────────
      /**
       * Registers a listener that fires every time the main process detects a
       * newly unlocked achievement from the local emulator's save file.
       * Returns the internal handler reference — keep it to call
       * `removeRealtimeAchievementUnlock` later and avoid memory leaks.
       */
      onRealtimeAchievementUnlock: (
        callback: (payload: RealtimeAchievementPayload) => void
      ) => RealtimeAchievementHandler;
      /** Removes a previously registered real-time achievement listener. */
      removeRealtimeAchievementUnlock: (
        handler: RealtimeAchievementHandler
      ) => void;
    };
  }

  /** Payload pushed by the main process when an achievement is detected as newly unlocked. */
  interface RealtimeAchievementPayload {
    /** Watcher key used internally (e.g. "steam_3764200"). */
    gameId: string;
    /** Raw achievement ID as stored by the emulator (e.g. "ACH_WIN_GAME"). */
    achievementId: string;
    /** Unix timestamp in seconds from the emulator (0 if unknown). */
    earnedTime: number;
    /** ISO 8601 date string derived from earnedTime (or Date.now() as fallback). */
    unlockedAt: string;
  }

  /** Opaque handle returned by onRealtimeAchievementUnlock — used for cleanup. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type RealtimeAchievementHandler = (...args: any[]) => void;
}
