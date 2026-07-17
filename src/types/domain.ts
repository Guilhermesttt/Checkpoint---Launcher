export type LauncherType = "steam" | "local" | "epic";

export interface GameLaunchProfile {
  arguments?: string;
  workingDirectory?: string;
  monitorId?: number | null;
  windowMode?: "default" | "borderless" | "windowed";
  resolutionWidth?: number | null;
  resolutionHeight?: number | null;
  processPriority?: "normal" | "above-normal" | "high";
}

export interface Game {
  id: string;
  title: string;
  image: string;
  backgroundImage?: string;
  cardImage?: string;
  logoImage?: string;
  trailerUrl?: string;
  category?: string;
  description?: string;
  isFavorite?: boolean;
  executablePath?: string;
  hoursPlayed?: number;
  sizeGB?: number;
  launcherType?: LauncherType;
  steamAppId?: string;
  epicCatalogId?: string;
  epicLaunchId?: string;
  epicStoreUrl?: string;
  steamPlaytimeMinutes?: number;
  locallyTrackedMinutes?: number;
  steamLastPlayedAt?: string;
  source?: "manual" | "steam" | "epic";
  lastSyncedAt?: string;
  lastPlayedAt?: string;
  createdAt?: string;
  updatedAt?: string;
  screenshots?: string[];
  aboutTheGame?: string;
  releaseDate?: string;
  developer?: string;
  publisher?: string;
  tags?: string[];
  totalAchievements?: number;
  completedAchievements?: number;
  achievementsUpdatedAt?: string;
  launchProfile?: GameLaunchProfile;
}

export interface SocialActivity {
  id: string;
  userId: string;
  userName: string;
  userAvatar?: string | null;
  audienceIds: string[];
  kind: "game-start" | "achievement" | "capture";
  gameId?: string;
  gameTitle?: string;
  gameImage?: string;
  achievementId?: string;
  achievementName?: string;
  achievementIcon?: string;
  caption?: string;
  createdAt: string;
}

export interface UserProfile {
  uid: string;
  email?: string | null;
  displayName?: string | null;
  photoURL?: string | null;
  bio?: string;
  website?: string;
  favoriteGenres?: string[];
  steamId?: string;
  discordId?: string;
  discordUsername?: string;
  discordAvatar?: string;
  steamAvatar?: string;
  steamUsername?: string;
  status?: "online" | "playing" | "offline";
  playing?: string | null;
  discordFriends?: Array<{
    id: string;
    username: string;
    avatar?: string;
    relationshipType?: number | null;
  }>;
  checkpointFriends?: Array<{
    uid: string;
    displayName: string;
    photoURL?: string | null;
    status?: "online" | "playing" | "offline";
    playing?: string | null;
  }>;
  checkpointFriendRequestsIncoming?: Array<{
    uid: string;
    displayName: string;
    photoURL?: string | null;
    createdAt?: string;
  }>;
  checkpointFriendRequestsOutgoing?: Array<{
    uid: string;
    displayName: string;
    photoURL?: string | null;
    createdAt?: string;
  }>;
  createdAt?: string;
  updatedAt?: string;
  lastSteamSyncAt?: string;
  gamesMigratedAt?: string;
  onboardingCompletedAt?: string;
  achievementSummary?: {
    unlocked: number;
    available: number;
    gamesWithAchievements?: number;
    totalGames?: number;
    updatedAt?: string;
  };
  librarySummary?: {
    games: number;
    minutesPlayed: number;
    favorites: number;
    steamGames: number;
    epicGames: number;
    localGames: number;
  };
}

export interface EditableProfile {
  displayName: string;
  photoURL?: string;
  bio: string;
  website: string;
  favoriteGenres: string[];
}

export interface SteamOwnedGame {
  appid: number;
  name?: string;
  playtime_forever: number;
  playtime_windows_forever?: number;
  rtime_last_played?: number;
  img_icon_url?: string;
  img_logo_url?: string;
  has_community_visible_stats?: boolean;
}
export interface ChatMessage {
  id?: string;
  chatId?: string;
  senderId: string;
  receiverId?: string;
  text: string;
  createdAt: string;
  read?: boolean;
  attachmentName?: string;
  attachmentUrl?: string;
  attachmentType?: string;
  attachmentSize?: number;
  attachmentPath?: string;
}

export interface Chat {
  id: string;
  participants: string[];
  lastMessage?: string;
  lastMessageAt?: string;
}

export interface SocialFriend {
  id: string;
  name: string;
  status: "online" | "playing" | "offline";
  playing?: string;
  avatar?: string;
  source?: "discord" | "discord_friend" | "local" | "checkpoint";
}

export type CheckpointFriendRequest = NonNullable<
  UserProfile["checkpointFriendRequestsIncoming"]
>[number];

export interface PriceAlert {
  id: string;
  gameId: string;
  title: string;
  source: "Steam" | "Epic" | "Manual";
}
