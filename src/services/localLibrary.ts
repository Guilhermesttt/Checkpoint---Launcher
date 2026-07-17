import {
  addDoc,
  deleteDoc,
  getDocs,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import type { Game, UserProfile } from "../types/domain";
import {
  publicProfileDocRef,
  userGameDocRef,
  userGamesCollectionRef,
} from "./firestorePaths";

const sorted = (games: Game[]) =>
  [...games].sort((a, b) => a.title.localeCompare(b.title));

export const listLibraryGames = async (uid: string): Promise<Game[]> => {
  if (window.electronAPI?.listLocalGames) {
    return sorted(await window.electronAPI.listLocalGames(uid));
  }
  const snapshot = await getDocs(userGamesCollectionRef(uid));
  return sorted(snapshot.docs.map((item) => ({
    id: item.id,
    ...item.data(),
  }) as Game));
};

export const createLibraryGame = async (
  uid: string,
  game: Omit<Game, "id"> & { id?: string },
): Promise<Game> => {
  if (window.electronAPI?.createLocalGame) {
    return window.electronAPI.createLocalGame(uid, game);
  }
  const ref = await addDoc(userGamesCollectionRef(uid), game);
  return { ...game, id: ref.id } as Game;
};

export const updateLibraryGame = async (
  uid: string,
  gameId: string,
  patch: Partial<Game>,
): Promise<Game | null> => {
  if (window.electronAPI?.updateLocalGame) {
    return window.electronAPI.updateLocalGame(uid, gameId, patch);
  }
  await updateDoc(userGameDocRef(uid, gameId), patch);
  return null;
};

export const deleteLibraryGame = async (uid: string, gameId: string) => {
  if (window.electronAPI?.deleteLocalGame) {
    return window.electronAPI.deleteLocalGame(uid, gameId);
  }
  await deleteDoc(userGameDocRef(uid, gameId));
  return true;
};

export const deleteLibraryGamesByLauncher = async (
  uid: string,
  launcherType: "steam" | "epic" | "local",
) => {
  if (window.electronAPI?.deleteLocalGamesByLauncher) {
    return window.electronAPI.deleteLocalGamesByLauncher(uid, launcherType);
  }
  const snapshot = await getDocs(userGamesCollectionRef(uid));
  const matches = snapshot.docs.filter(
    (item) => item.data().launcherType === launcherType,
  );
  await Promise.all(matches.map((item) => deleteDoc(item.ref)));
  return matches.length;
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
  await Promise.all(games.map((game) =>
    setDoc(userGameDocRef(uid, game.id), game, { merge: true })));
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
  const snapshot = await getDocs(userGamesCollectionRef(uid));
  const games = snapshot.docs.map((item) => ({
    id: item.id,
    ...item.data(),
  }) as Game);
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
    Boolean(profile?.steamId),
    Boolean(profile?.discordId),
  ]);
  const fingerprintKey = `checkpoint_public_profile_fingerprint_${uid}`;
  if (
    !summary.dirty
    && localStorage.getItem(fingerprintKey) === profileFingerprint
  ) return false;

  await setDoc(publicProfileDocRef(uid), {
    schemaVersion: summary.schemaVersion,
    uid,
    displayName: profile?.displayName || "Jogador",
    photoURL,
    bio: profile?.bio || "",
    website: profile?.website || "",
    favoriteGenres: profile?.favoriteGenres || [],
    stats: summary.stats,
    platforms: {
      ...summary.platforms,
      steamConnected: Boolean(profile?.steamId),
      discordConnected: Boolean(profile?.discordId),
    },
    achievements: summary.achievements,
    topGames: summary.topGames,
    favoriteGames: summary.favoriteGames,
    revision: summary.revision,
    updatedAt: new Date().toISOString(),
  }, { merge: true });

  await window.electronAPI.markLocalLibrarySummarySynced(
    uid,
    summary.revision,
  );
  localStorage.setItem(fingerprintKey, profileFingerprint);
  return true;
};
