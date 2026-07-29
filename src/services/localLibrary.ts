import { supabase } from "./supabase";
import type { Game, UserProfile } from "../types/domain";

const sorted = (games: Game[]) =>
  [...games].sort((a, b) => a.title.localeCompare(b.title));

const toCloudGameRow = (uid: string, game: Game) => ({
  id: game.id,
  user_id: uid,
  title: game.title,
  launcher_type: game.launcherType || "local",
  hours_played: game.hoursPlayed || 0,
  steam_app_id: game.steamAppId || null,
  epic_catalog_id: game.epicCatalogId || null,
  is_favorite: Boolean(game.isFavorite),
  data: game,
  updated_at: new Date().toISOString(),
});

const fromCloudGameRow = (row: Record<string, any>): Game => ({
  ...(row.data || {}),
  id: String(row.id),
  title: String(row.data?.title || row.title || "Jogo"),
  launcherType: row.data?.launcherType || row.launcher_type || "local",
  hoursPlayed: Number(row.data?.hoursPlayed ?? row.hours_played ?? 0),
  steamAppId: row.data?.steamAppId || row.steam_app_id || undefined,
  epicCatalogId: row.data?.epicCatalogId || row.epic_catalog_id || undefined,
  isFavorite: Boolean(row.data?.isFavorite ?? row.is_favorite),
});

export const listLibraryGames = async (uid: string): Promise<Game[]> => {
  if (window.electronAPI?.listLocalGames) {
    return sorted(await window.electronAPI.listLocalGames(uid));
  }
  const { data, error } = await supabase
    .from("user_games")
    .select("*")
    .eq("user_id", uid);

  if (error || !data) return [];
  return sorted(data.map((row) => fromCloudGameRow(row as Record<string, any>)));
};

export const createLibraryGame = async (
  uid: string,
  game: Omit<Game, "id"> & { id?: string },
): Promise<Game> => {
  if (window.electronAPI?.createLocalGame) {
    return window.electronAPI.createLocalGame(uid, game);
  }
  const id = game.id || crypto.randomUUID();
  const newGame = { ...game, id } as Game;
  const { error } = await supabase.from("user_games").insert(toCloudGameRow(uid, newGame));
  if (error) throw error;
  return newGame;
};

export const updateLibraryGame = async (
  uid: string,
  gameId: string,
  patch: Partial<Game>,
): Promise<Game | null> => {
  if (window.electronAPI?.updateLocalGame) {
    return window.electronAPI.updateLocalGame(uid, gameId, patch);
  }
  const { data: current, error: readError } = await supabase
    .from("user_games")
    .select("*")
    .eq("id", gameId)
    .eq("user_id", uid)
    .maybeSingle();
  if (readError) throw readError;
  if (!current) return null;
  const updated = { ...fromCloudGameRow(current), ...patch, id: gameId };
  const { error } = await supabase
    .from("user_games")
    .update(toCloudGameRow(uid, updated))
    .eq("id", gameId)
    .eq("user_id", uid);
  if (error) throw error;
  return updated;
};

export const deleteLibraryGame = async (uid: string, gameId: string) => {
  if (window.electronAPI?.deleteLocalGame) {
    return window.electronAPI.deleteLocalGame(uid, gameId);
  }
  await supabase.from("user_games").delete().eq("id", gameId).eq("user_id", uid);
  return true;
};

export const deleteLibraryGamesByLauncher = async (
  uid: string,
  launcherType: "steam" | "epic" | "local",
) => {
  if (window.electronAPI?.deleteLocalGamesByLauncher) {
    return window.electronAPI.deleteLocalGamesByLauncher(uid, launcherType);
  }
  const { data } = await supabase
    .from("user_games")
    .delete()
    .eq("user_id", uid)
    .eq("launcher_type", launcherType)
    .select();
  return data?.length || 0;
};

export const recordLibrarySession = async (
  uid: string,
  gameId: string,
  session: { startedAt: string; endedAt: string; durationMinutes: number },
) => {
  if (!window.electronAPI?.recordLocalGameSession) return null;
  return window.electronAPI.recordLocalGameSession(uid, gameId, session);
};

export const bulkUpsertLibraryGames = async (uid: string, games: Game[]) => {
  if (window.electronAPI?.bulkUpsertLocalGames) {
    return window.electronAPI.bulkUpsertLocalGames(uid, games);
  }
  const items = games.map((game) => toCloudGameRow(uid, game));
  const { error } = await supabase.from("user_games").upsert(items, {
    onConflict: "user_id,id",
  });
  if (error) throw error;
  return games;
};

export const importFirestoreLibraryIntoLocal = async (uid: string) => {
  if (!window.electronAPI?.importLegacyGames) {
    return { imported: 0, alreadyImported: true };
  }
  if (
    window.electronAPI.needsLegacyGameImport
    && !await window.electronAPI.needsLegacyGameImport(uid)
  ) {
    return { imported: 0, alreadyImported: true };
  }
  const { data } = await supabase
    .from("user_games")
    .select("*")
    .eq("user_id", uid);
  const games = (data || []).map((row) =>
    fromCloudGameRow(row as Record<string, any>),
  );
  return window.electronAPI.importLegacyGames(uid, games);
};

export const syncPublicLibrarySummary = async (
  uid: string,
  profile?: UserProfile | null,
) => {
  if (!window.electronAPI?.getLocalLibrarySummary) return false;
  const summary = await window.electronAPI.getLocalLibrarySummary(uid);
  const photoURL = profile?.photoURL
    || profile?.discordAvatar
    || profile?.steamAvatar
    || "";
  const profileFingerprint = JSON.stringify([
    profile?.displayName || "Jogador",
    photoURL,
    profile?.bio || "",
    profile?.website || "",
    profile?.favoriteGenres || [],
    profile?.steamId || "",
    profile?.steamUsername || "",
    profile?.steamAvatar || "",
    profile?.discordId || "",
    profile?.discordUsername || "",
    profile?.discordAvatar || "",
  ]);
  const fingerprintKey = `checkpoint_public_profile_fingerprint_${uid}`;
  if (
    !summary.dirty
    && localStorage.getItem(fingerprintKey) === profileFingerprint
  ) return false;

  const { error } = await supabase.from("public_profiles").upsert({
    uid,
    display_name: profile?.displayName || "Jogador",
    photo_url: photoURL,
    bio: profile?.bio || "",
    website: profile?.website || "",
    favorite_genres: profile?.favoriteGenres || [],
    stats: summary.stats,
    platforms: {
      ...summary.platforms,
      steamConnected: Boolean(profile?.steamId),
      discordConnected: Boolean(profile?.discordId),
      steamId: profile?.steamId || "",
      steamUsername: profile?.steamUsername || "",
      steamAvatar: profile?.steamAvatar || "",
      discordId: profile?.discordId || "",
      discordUsername: profile?.discordUsername || "",
      discordAvatar: profile?.discordAvatar || "",
    },
    achievements: summary.achievements,
    top_games: summary.topGames,
    favorite_games: summary.favoriteGames,
    revision: summary.revision,
    updated_at: new Date().toISOString(),
  }, { onConflict: "uid" });
  if (error) throw error;

  await window.electronAPI.markLocalLibrarySummarySynced(
    uid,
    summary.revision,
  );
  localStorage.setItem(fingerprintKey, profileFingerprint);
  return true;
};
