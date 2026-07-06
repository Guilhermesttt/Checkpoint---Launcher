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
      saveLocalAchievementDefinitions: (
        gameId: string,
        definitions: Array<{ id: string; name: string; description: string; icon?: string }>
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
    };
  }
}
