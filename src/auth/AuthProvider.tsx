import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db } from "../../Firebase";
import type { UserProfile } from "../types/domain";

interface AuthContextValue {
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOutUser: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const toProfile = (uid: string, data?: Partial<UserProfile>): UserProfile => ({
  uid,
  email: data?.email ?? null,
  displayName: data?.displayName ?? null,
  photoURL: data?.photoURL ?? null,
  steamId: data?.steamId,
  createdAt: data?.createdAt,
  updatedAt: data?.updatedAt,
  lastSteamSyncAt: data?.lastSteamSyncAt,
  gamesMigratedAt: data?.gamesMigratedAt,
  onboardingCompletedAt: data?.onboardingCompletedAt,
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const syncProfile = async (authUser: User) => {
    if (!auth.currentUser || auth.currentUser.uid !== authUser.uid) return;
    const ref = doc(db, "profiles", authUser.uid);
    const snap = await getDoc(ref);

    if (!snap.exists()) {
      await setDoc(ref, {
        uid: authUser.uid,
        email: authUser.email,
        displayName: authUser.displayName,
        photoURL: authUser.photoURL,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(
        ref,
        {
          email: authUser.email,
          displayName: authUser.displayName,
          photoURL: authUser.photoURL,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
    }

    const profileSnap = await getDoc(ref);
    const data = profileSnap.data() as Partial<UserProfile> | undefined;
    setUserProfile(toProfile(authUser.uid, data));
  };

  const refreshProfile = async () => {
    if (!auth.currentUser) return;
    const ref = doc(db, "profiles", auth.currentUser.uid);
    const snap = await getDoc(ref);
    const data = snap.data() as Partial<UserProfile> | undefined;
    setUserProfile(toProfile(auth.currentUser.uid, data));
  };

  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    const result = await signInWithPopup(auth, provider);
    try {
      await syncProfile(result.user);
    } catch (error) {
      console.error("Falha ao sincronizar perfil após login Google:", error);
      setUserProfile(
        toProfile(result.user.uid, {
          email: result.user.email,
          displayName: result.user.displayName,
          photoURL: result.user.photoURL,
        }),
      );
    }
  };

  const signOutUser = async () => {
    await signOut(auth);
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser);
      if (!nextUser) {
        setUserProfile(null);
        setLoading(false);
        return;
      }

      try {
        await syncProfile(nextUser);
      } catch (error) {
        console.error("Falha ao sincronizar perfil no onAuthStateChanged:", error);
        setUserProfile(
          toProfile(nextUser.uid, {
            email: nextUser.email,
            displayName: nextUser.displayName,
            photoURL: nextUser.photoURL,
          }),
        );
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      userProfile,
      loading,
      signInWithGoogle,
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
