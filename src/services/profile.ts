import { supabase } from "./supabase";
import type { EditableProfile } from "../types/domain";
import { invalidate } from "../lib/queryCache";

export const PROFILE_LIMITS = {
  displayName: 50,
  bio: 280,
  website: 300,
  location: 80,
  pronouns: 40,
  genres: 6,
  genre: 32,
  avatarBytes: 5 * 1024 * 1024,
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
    location: clean(input.location || "", PROFILE_LIMITS.location),
    pronouns: clean(input.pronouns || "", PROFILE_LIMITS.pronouns),
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
  const session = (await supabase.auth.getSession()).data.session;
  if (!session?.user) throw new Error("Faça login novamente para editar o perfil.");

  const uid = session.user.id;
  const normalized = normalizeEditableProfile(profile);
  const photoURL = profile.photoURL || "";

  const payload = {
    uid,
    display_name: normalized.displayName,
    bio: normalized.bio,
    location: normalized.location,
    pronouns: normalized.pronouns,
    website: normalized.website,
    favorite_genres: normalized.favoriteGenres,
    photo_url: photoURL || null,
  };

  try {
    const { data, error } = await supabase
      .from("profiles")
      .upsert(payload, { onConflict: "uid" })
      .select("uid")
      .single();

    if (error || !data?.uid) {
      throw error || new Error("Upsert profile falhou.");
    }
  } catch (upsertError) {
    // Fallback: tentar update direto caso a linha já exista e upsert tenha tido permissao/conflito
    const updatePayload = {
      display_name: normalized.displayName,
      bio: normalized.bio,
      location: normalized.location,
      pronouns: normalized.pronouns,
      website: normalized.website,
      favorite_genres: normalized.favoriteGenres,
      photo_url: photoURL || null,
    };
    const { data: updateData, error: updateError } = await supabase
      .from("profiles")
      .update(updatePayload)
      .eq("uid", uid)
      .select("uid")
      .single();

    if (updateError || !updateData?.uid) {
      throw upsertError instanceof Error && upsertError.message.includes("salvar o perfil")
        ? upsertError
        : (updateError || new Error("Nao foi possivel salvar o perfil."));
    }
  }

  try {
    invalidate("profile");
    invalidate("trophies");
  } catch {}

  return { ...normalized, photoURL };
};
