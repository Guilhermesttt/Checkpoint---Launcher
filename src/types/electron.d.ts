export {};

declare global {
  interface Window {
    electronAPI?: {
      launchExecutable: (
        executablePath: string,
        launchProfile?: import("./domain").GameLaunchProfile,
      ) => Promise<void>;
      selectExecutable: () => Promise<string | null>;
      searchEpicStore: (query: string) => Promise<Array<{
        id: string;
        catalogId: string;
        namespace: string;
        name: string;
        title: string;
        appName: string;
        epicLaunchId: string;
        executablePath: string;
        image: string;
        tiny_image: string;
        cardImage: string;
        backgroundImage: string;
        productSlug: string;
        productUrl: string;
        source: "epic-store";
        installed: boolean;
      }>>;
      fetchEpicStoreDetails: (request: {
        catalogId: string;
        namespace: string;
        productSlug: string;
      }) => Promise<{
        catalogId: string;
        namespace: string;
        appName: string;
        title: string;
        image: string;
        cardImage: string;
        backgroundImage: string;
        logoImage: string;
        description: string;
        aboutTheGame: string;
        screenshots: string[];
        releaseDate: string;
        developer: string;
        publisher: string;
        tags: string[];
        trailerUrl: string;
        productSlug: string;
        productUrl: string;
        epicLaunchId: string;
        executablePath: string;
        source: "epic-store";
      }>;
      getDisplays: () => Promise<Array<{
        id: number;
        label: string;
        primary: boolean;
        width: number;
        height: number;
      }>>;
      isExecutableRunning: (executablePath: string) => Promise<boolean>;
      detectRunningGames: (executablePaths: string[]) => Promise<string[]>;
      startGoogleBrowserAuth: () => Promise<{ state: string }>;
      openExternalUrl: (url: string) => Promise<void>;
      scanLocalGames: () => Promise<Array<{ name: string; path: string }>>;
      listLocalGames: (uid: string) => Promise<import("./domain").Game[]>;
      createLocalGame: (
        uid: string,
        game: Omit<import("./domain").Game, "id"> & { id?: string },
      ) => Promise<import("./domain").Game>;
      updateLocalGame: (
        uid: string,
        gameId: string,
        patch: Partial<import("./domain").Game>,
      ) => Promise<import("./domain").Game>;
      deleteLocalGame: (uid: string, gameId: string) => Promise<boolean>;
      deleteLocalGamesByLauncher: (
        uid: string,
        launcherType: import("./domain").LauncherType,
      ) => Promise<number>;
      recordLocalGameSession: (
        uid: string,
        gameId: string,
        session: {
          startedAt: string;
          endedAt: string;
          durationMinutes: number;
        },
      ) => Promise<string>;
      bulkUpsertLocalGames: (
        uid: string,
        games: import("./domain").Game[],
      ) => Promise<import("./domain").Game[]>;
      importLegacyGames: (
        uid: string,
        games: import("./domain").Game[],
      ) => Promise<{ imported: number; alreadyImported: boolean }>;
      needsLegacyGameImport: (uid: string) => Promise<boolean>;
      getLocalLibrarySummary: (uid: string) => Promise<{
        schemaVersion: number;
        stats: { games: number; minutesPlayed: number; favorites: number };
        platforms: {
          steamGameCount: number;
          epicGameCount: number;
          localGameCount: number;
        };
        achievements: { unlocked: number; total: number };
        topGames: Array<{
          id: string;
          title: string;
          minutesPlayed: number;
          imageUrl: string;
        }>;
        favoriteGames: Array<{
          id: string;
          title: string;
          minutesPlayed: number;
          imageUrl: string;
        }>;
        revision: number;
        deviceId: string;
        dirty: boolean;
      }>;
      markLocalLibrarySummarySynced: (uid: string, revision: number) => Promise<void>;
      testOverlayWelcome: () => Promise<void>;
      testOverlayAchievement: () => Promise<void>;
      toggleOverlayPanel: () => Promise<{ open: boolean }>;
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
      getEpicLocalAchievements: (request: {
        gameId: string;
        title: string;
        epicCatalogId?: string;
        epicLaunchId?: string;
        executablePath?: string;
      }) => Promise<{
        source: "epic-local";
        status: "ok" | "not-installed" | "binary-save" | "no-readable-files";
        installed: boolean;
        installLocation: string;
        achievements: Array<{
          apiName: string;
          achieved: boolean;
          unlockTime: number;
          name: string;
          description: string;
          icon: string;
          iconGray: string;
          hidden: boolean;
        }>;
        total: number;
        unlocked: number;
        readableFileCount: number;
        binarySaveDetected: boolean;
        scanTruncated: boolean;
      }>;
      getLocalAchievementLibrarySummary: () => Promise<{
        byGameId: Record<string, { total: number; unlocked: number }>;
        bySteamAppId: Record<string, { total: number; unlocked: number }>;
        updatedAt: string;
      }>;
      getAchievementDiagnostics: () => Promise<{
        bridgePort: number;
        watcherKeys: string[];
        monitoredGameKeys: string[];
        pendingRescanKeys: string[];
        overlayReady: boolean;
        overlayDisplayId: number | null;
        overlayVisible: boolean;
      }>;
      saveLocalAchievementDefinitions: (
        gameId: string,
        definitions: Array<{ id: string; name: string; description: string; icon?: string }>,
        steamAppId?: string
      ) => Promise<boolean>;
      unlockAchievement: (
        gameId: string,
        achievementId: string
      ) => Promise<{ duplicate: boolean }>;
      showFriendMessageOverlay: (payload: {
        senderName: string;
        messageText: string;
        avatarUrl?: string;
      }) => Promise<void>;
      updateOverlayPanel: (payload: {
        friends: Array<{ id: string; name: string; status: string; playing?: string; avatar?: string; unread?: number; canChat?: boolean }>;
        achievements: {
          unlocked: number;
          available: number;
          loading?: boolean;
          items?: Array<{ id: string; name: string; description?: string; icon?: string; achieved: boolean; unlockedAt?: string }>;
        };
        currentGame?: {
          id: string;
          title: string;
          image?: string;
          platform?: string;
          category?: string;
          developer?: string;
          releaseDate?: string;
          executableName?: string;
          totalPlaytimeMinutes?: number;
          sessionStartedAt?: string;
          windowMode?: string;
          resolution?: string;
          monitoring?: "verified" | "unverified";
        } | null;
        chat?: {
          friendId: string;
          friendName: string;
          friendAvatar?: string;
          typing?: boolean;
          sending?: boolean;
          error?: string;
          messages: Array<{
            id: string;
            text: string;
            attachmentUrl?: string;
            attachmentName?: string;
            createdAt: string;
            mine: boolean;
            pending?: boolean;
          }>;
        } | null;
        profile?: {
          name: string;
          avatar?: string;
          discordConnected?: boolean;
          discordUsername?: string;
          achievements?: number;
        };
      }) => Promise<void>;
      onOverlayPanelAction: (callback: (payload:
        | { kind: "select-chat"; friendId: string }
        | { kind: "close-chat" }
        | { kind: "send-message"; text: string }
        | { kind: "send-image"; name: string; type: string; data: Uint8Array }
        | { kind: "set-typing"; typing: boolean }
      ) => void) => () => void;

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
    achievement?: {
      id?: string;
      name?: string;
      description?: string;
      icon?: string;
    };
  }

  /** Opaque handle returned by onRealtimeAchievementUnlock — used for cleanup. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type RealtimeAchievementHandler = (...args: any[]) => void;
}
