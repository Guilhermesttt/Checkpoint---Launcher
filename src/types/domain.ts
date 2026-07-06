export type LauncherType = "steam" | "local" | "epic";

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
}

export interface UserProfile {
  uid: string;
  email?: string | null;
  displayName?: string | null;
  photoURL?: string | null;
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
