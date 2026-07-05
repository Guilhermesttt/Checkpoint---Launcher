export {};

declare global {
  interface Window {
    electronAPI?: {
      launchExecutable: (executablePath: string) => Promise<void>;
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
    };
  }
}
