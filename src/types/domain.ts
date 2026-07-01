export type LauncherType = "steam" | "local";

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
  steamPlaytimeMinutes?: number;
  source?: "manual" | "steam";
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
  img_icon_url?: string;
  img_logo_url?: string;
  has_community_visible_stats?: boolean;
}
