import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from "react";
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signOut,
  type User,
} from "firebase/auth";
import { doc, getDoc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db } from "../../Firebase";
import { apiUrl } from "../services/api";
import type { UserProfile } from "../types/domain";

interface AuthContextValue {
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signUpWithEmail: (email: string, pass: string) => Promise<void>;
  signInWithEmail: (email: string, pass: string) => Promise<void>;
  signOutUser: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const sleep = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

const toProfile = (uid: string, data?: Partial<UserProfile>): UserProfile => ({
  uid,
  email: data?.email ?? null,
  displayName: data?.displayName ?? null,
  photoURL: data?.photoURL ?? null,
  steamId: data?.steamId,
  steamAvatar: data?.steamAvatar,
  steamUsername: data?.steamUsername,
  discordId: data?.discordId,
  discordUsername: data?.discordUsername,
  discordAvatar: data?.discordAvatar,
  status: data?.status,
  playing: data?.playing,
  discordFriends: data?.discordFriends,
  checkpointFriends: data?.checkpointFriends,
  checkpointFriendRequestsIncoming: data?.checkpointFriendRequestsIncoming,
  checkpointFriendRequestsOutgoing: data?.checkpointFriendRequestsOutgoing,
  createdAt: data?.createdAt,
  updatedAt: data?.updatedAt,
  lastSteamSyncAt: data?.lastSteamSyncAt,
  gamesMigratedAt: data?.gamesMigratedAt,
  onboardingCompletedAt: data?.onboardingCompletedAt,
  achievementSummary: data?.achievementSummary,
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const syncProfile = useCallback(async (authUser: User) => {
    if (!auth.currentUser || auth.currentUser.uid !== authUser.uid) return;
    const ref = doc(db, "profiles", authUser.uid);
    const snap = await getDoc(ref);
    const fallbackProfile = toProfile(authUser.uid, {
      email: authUser.email,
      displayName: authUser.displayName || authUser.email?.split("@")[0] || "User",
      photoURL: authUser.photoURL,
    });

    if (!snap.exists()) {
      await setDoc(ref, {
        uid: authUser.uid,
        email: authUser.email,
        displayName: authUser.displayName || authUser.email?.split("@")[0] || "User",
        photoURL: authUser.photoURL,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setUserProfile(fallbackProfile);
      return;
    }

    const data = snap.data() as Partial<UserProfile> | undefined;
    setUserProfile(toProfile(authUser.uid, data));

    await setDoc(
      ref,
      {
        email: authUser.email,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!auth.currentUser) return;
    const ref = doc(db, "profiles", auth.currentUser.uid);
    const snap = await getDoc(ref);
    const data = snap.data() as Partial<UserProfile> | undefined;
    setUserProfile(toProfile(auth.currentUser.uid, data));
  }, []);

  const signInWithGoogle = useCallback(async () => {
    if (window.electronAPI?.startGoogleBrowserAuth) {
      const { signInWithCustomToken } = await import("firebase/auth");
      const { state } = await window.electronAPI.startGoogleBrowserAuth();

      for (let attempt = 0; attempt < 180; attempt += 1) {
        await sleep(1000);

        const response = await fetch(
          apiUrl(`/auth/desktop/google/status?state=${encodeURIComponent(state)}`),
        );
        const payload = (await response.json().catch(() => ({}))) as {
          status?: string;
          customToken?: string;
          error?: string;
        };

        if (!response.ok) {
          throw new Error(payload.error || "Falha ao verificar login Google.");
        }

        if (payload.status === "complete" && payload.customToken) {
          await signInWithCustomToken(auth, payload.customToken);
          return;
        }
      }

      throw new Error("Tempo esgotado aguardando login Google no navegador.");
    }

    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    await (await import("firebase/auth")).signInWithPopup(auth, provider);
  }, []);

  const signUpWithEmail = useCallback(async (email: string, pass: string) => {
    const { createUserWithEmailAndPassword } = await import("firebase/auth");
    await createUserWithEmailAndPassword(auth, email, pass);
  }, []);

  const signInWithEmail = useCallback(async (email: string, pass: string) => {
    const { signInWithEmailAndPassword } = await import("firebase/auth");
    await signInWithEmailAndPassword(auth, email, pass);
  }, []);

  const signOutUser = useCallback(async () => {
    await signOut(auth);
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      if (!nextUser) {
        setUserProfile(null);
        setLoading(false);
        return;
      }

      setUserProfile(
        toProfile(nextUser.uid, {
          email: nextUser.email,
          displayName: nextUser.displayName,
          photoURL: nextUser.photoURL,
        }),
      );
      setLoading(false);

      void syncProfile(nextUser).catch((error) => {
        console.error("Falha ao sincronizar perfil no onAuthStateChanged:", error);
      });
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!user?.uid) return;
    return onSnapshot(doc(db, "profiles", user.uid), (snap) => {
      const data = snap.data() as Partial<UserProfile> | undefined;
      if (data) setUserProfile(toProfile(user.uid, data));
    });
  }, [user?.uid]);

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
    [user, userProfile, loading],
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
