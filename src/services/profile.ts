import { updateProfile } from "firebase/auth";
import { serverTimestamp, setDoc } from "firebase/firestore";
import { auth } from "../../Firebase";
import type { EditableProfile } from "../types/domain";
import { profileDocRef, publicProfileDocRef } from "./firestorePaths";

export const PROFILE_LIMITS = {
  displayName: 50,
  bio: 280,
  website: 300,
  genres: 6,
  genre: 32,
} as const;

const clean = (value: string, limit: number) =>
  value.trim().replace(/\s+/g, " ").slice(0, limit);

export const normalizeEditableProfile = (
  input: EditableProfile,
): EditableProfile => {
  const website = input.website.trim();
  if (website && !/^https:\/\/[^\s]+$/i.test(website)) {
    throw new Error("O site precisa começar com https://.");
  }

  const displayName = clean(input.displayName, PROFILE_LIMITS.displayName);
  if (displayName.length < 2) {
    throw new Error("Informe um nome com pelo menos 2 caracteres.");
  }

  return {
    displayName,
    bio: input.bio.trim().slice(0, PROFILE_LIMITS.bio),
    website: website.slice(0, PROFILE_LIMITS.website),
    favoriteGenres: [...new Set(input.favoriteGenres
      .map((genre) => clean(genre, PROFILE_LIMITS.genre))
      .filter(Boolean))]
      .slice(0, PROFILE_LIMITS.genres),
  };
};

export const saveCurrentUserProfile = async ({
  profile,
}: {
  profile: EditableProfile;
}) => {
  const user = auth.currentUser;
  if (!user) throw new Error("Faça login novamente para editar o perfil.");

  const normalized = normalizeEditableProfile(profile);
  const photoURL = profile.photoURL || "";

  await Promise.all([
    updateProfile(user, {
      displayName: normalized.displayName,
    }),
    setDoc(profileDocRef(user.uid), {
      ...normalized,
      photoURL: photoURL || null,
      updatedAt: serverTimestamp(),
    }, { merge: true }),
    setDoc(publicProfileDocRef(user.uid), {
      uid: user.uid,
      ...normalized,
      photoURL: photoURL || null,
      updatedAt: new Date().toISOString(),
    }, { merge: true }),
  ]);

  return { ...normalized, photoURL };
};
