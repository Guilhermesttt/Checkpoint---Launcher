import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "../services/supabase";
import { apiUrl } from "../services/api";
import type { UserProfile } from "../types/domain";

export interface AuthUser {
  uid: string;
  email?: string | null;
  displayName?: string | null;
  photoURL?: string | null;
}

interface AuthContextValue {
  user: AuthUser | null;
  userProfile: UserProfile | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signUpWithEmail: (email: string, pass: string) => Promise<void>;
  signInWithEmail: (email: string, pass: string) => Promise<void>;
  signOutUser: () => Promise<void>;
  refreshProfile: () => Promise<any>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const toProfile = (uid: string, data?: Record<string, any>): UserProfile => ({
  uid,
  email: data?.email ?? null,
  displayName: data?.displayName ?? data?.display_name ?? null,
  photoURL: data?.photoURL ?? data?.photo_url ?? null,
  profileVisibility:
    data?.profileVisibility === "private" || data?.profile_visibility === "private"
      ? "private"
      : "public",
  bio: data?.bio,
  location: data?.location,
  pronouns: data?.pronouns,
  website: data?.website,
  favoriteGenres: data?.favoriteGenres ?? data?.favorite_genres,
  steamId: data?.steamId ?? data?.steam_id,
  steamAvatar: data?.steamAvatar ?? data?.steam_avatar,
  steamUsername: data?.steamUsername ?? data?.steam_username,
  discordId: data?.discordId ?? data?.discord_id,
  discordUsername: data?.discordUsername ?? data?.discord_username,
  discordAvatar: data?.discordAvatar ?? data?.discord_avatar,
  status: data?.status,
  playing: data?.playing,
  discordFriends: data?.discordFriends ?? data?.discord_friends,
  checkpointFriends: data?.checkpointFriends ?? data?.checkpoint_friends,
  checkpointFriendRequestsIncoming: data?.checkpointFriendRequestsIncoming ?? data?.checkpoint_friend_requests_incoming,
  checkpointFriendRequestsOutgoing: data?.checkpointFriendRequestsOutgoing ?? data?.checkpoint_friend_requests_outgoing,
  createdAt: data?.createdAt ?? data?.created_at,
  updatedAt: data?.updatedAt ?? data?.updated_at,
  lastSteamSyncAt: data?.lastSteamSyncAt ?? data?.last_steam_sync_at,
  gamesMigratedAt: data?.gamesMigratedAt ?? data?.games_migrated_at,
  onboardingCompletedAt: data?.onboardingCompletedAt ?? data?.onboarding_completed_at,
  achievementSummary: data?.achievementSummary ?? data?.achievement_summary,
  librarySummary: data?.librarySummary ?? data?.library_summary,
});

const loadSocialGraph = async (uid: string) => {
  const { data: relationships, error } = await supabase
    .from("friendships")
    .select("requester_id,addressee_id,status,created_at")
    .or(`requester_id.eq.${uid},addressee_id.eq.${uid}`);
  if (error || !relationships) {
    return {
      checkpointFriends: [],
      checkpointFriendRequestsIncoming: [],
      checkpointFriendRequestsOutgoing: [],
    };
  }

  const relatedIds = [...new Set(relationships.map((relationship) =>
    relationship.requester_id === uid
      ? relationship.addressee_id
      : relationship.requester_id,
  ))];
  const { data: publicProfiles } = relatedIds.length > 0
    ? await supabase
      .from("public_profiles")
      .select("uid,display_name,photo_url")
      .in("uid", relatedIds)
    : { data: [] as Array<Record<string, any>> };
  const profileById = new Map((publicProfiles || []).map((profile) => [profile.uid, profile]));
  const compact = (relatedUid: string, createdAt?: string) => {
    const profile = profileById.get(relatedUid);
    return {
      uid: relatedUid,
      displayName: String(profile?.display_name || "Jogador"),
      photoURL: profile?.photo_url || null,
      ...(createdAt ? { createdAt } : {}),
    };
  };

  return {
    checkpointFriends: relationships
      .filter((relationship) => relationship.status === "accepted")
      .map((relationship) => compact(
        relationship.requester_id === uid
          ? relationship.addressee_id
          : relationship.requester_id,
      )),
    checkpointFriendRequestsIncoming: relationships
      .filter((relationship) =>
        relationship.status === "pending" && relationship.addressee_id === uid,
      )
      .map((relationship) => compact(relationship.requester_id, relationship.created_at)),
    checkpointFriendRequestsOutgoing: relationships
      .filter((relationship) =>
        relationship.status === "pending" && relationship.requester_id === uid,
      )
      .map((relationship) => compact(relationship.addressee_id, relationship.created_at)),
  };
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async (uid: string, fallbackUser?: AuthUser): Promise<UserProfile | null> => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("uid", uid)
        .maybeSingle();

      if (error || !data) {
        const fallback = toProfile(uid, {
          email: fallbackUser?.email,
          displayName: fallbackUser?.displayName || fallbackUser?.email?.split("@")[0] || "User",
          photoURL: fallbackUser?.photoURL,
        });
        setUserProfile(fallback);
        return fallback;
      }

      const socialGraph = await loadSocialGraph(uid);
      const prof = {
        ...toProfile(uid, data),
        ...socialGraph,
      };
      setUserProfile(prof);
      return prof;
    } catch (err) {
      console.error("[Auth] Falha ao carregar perfil do Supabase Postgres:", err);
      return null;
    }
  }, []);

  const refreshProfile = useCallback(async (): Promise<UserProfile | null> => {
    if (!user?.uid) return null;
    return await fetchProfile(user.uid, user);
  }, [user, fetchProfile]);

  const signInWithGoogle = useCallback(async () => {
    if (window.electronAPI) {
      const res = await (window.electronAPI as any).startGoogleBrowserAuth();
      const state = res?.state;
      if (!state) throw new Error("Falha ao iniciar autenticação Google.");

      const deadline = Date.now() + 120_000;
      while (Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        const statusRes = await fetch(apiUrl(`/auth/desktop/google/status?state=${encodeURIComponent(state)}`));
        if (statusRes.ok) {
          const data = await statusRes.json();
          if (data.status === "complete" && data.email && data.emailOtp) {
            const { error } = await supabase.auth.verifyOtp({
              email: data.email,
              token: data.emailOtp,
              type: "magiclink",
            });
            if (error) throw error;
            return;
          }
        }
      }
      throw new Error("Tempo limite excedido aguardando login do Google.");
    } else {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: window.location.origin,
        },
      });
      if (error) throw error;
    }
  }, []);

  const signUpWithEmail = useCallback(async (email: string, pass: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password: pass,
    });
    if (error) throw error;
  }, []);

  const signInWithEmail = useCallback(async (email: string, pass: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: pass,
    });
    if (error) throw error;
  }, []);

  const signOutUser = useCallback(async () => {
    try {
      if (user?.uid) {
        if (window.electronAPI && typeof (window.electronAPI as any).clearLocalSteamId === "function") {
          await (window.electronAPI as any).clearLocalSteamId(user.uid).catch(() => {});
        }
      }
    } catch (e) {
      console.warn("Erro ao limpar cache de logout:", e);
    }
    await supabase.auth.signOut().catch(() => {});
    setUser(null);
    setUserProfile(null);
  }, [user]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        const authUser: AuthUser = {
          uid: session.user.id,
          email: session.user.email,
          displayName: session.user.user_metadata?.full_name || session.user.user_metadata?.name || session.user.email?.split("@")[0] || "User",
          photoURL: session.user.user_metadata?.avatar_url || session.user.user_metadata?.picture || null,
        };
        setUser(authUser);
        await fetchProfile(session.user.id, authUser);
      } else {
        setUser(null);
        setUserProfile(null);
      }
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [fetchProfile]);



  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      userProfile,
      loading,
      signInWithGoogle,
      signUpWithEmail,
      signInWithEmail,
      signOutUser,
      refreshProfile,
    }),
    [user, userProfile, loading, signInWithGoogle, signUpWithEmail, signInWithEmail, signOutUser, refreshProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth deve ser usado dentro de AuthProvider");
  }
  return ctx;
};
