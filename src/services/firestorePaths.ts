import { collection, doc, type CollectionReference, type DocumentReference } from "firebase/firestore";
import { db } from "../../Firebase";

export const profilesCollection = () => collection(db, "profiles");

export const profileDocRef = (uid: string): DocumentReference =>
  doc(db, "profiles", uid);

export const publicProfileDocRef = (uid: string): DocumentReference =>
  doc(db, "publicProfiles", uid);

export const userDocRef = (uid: string): DocumentReference => doc(db, "users", uid);

export const userGamesCollectionRef = (uid: string): CollectionReference =>
  collection(db, "users", uid, "games");

export const userGameDocRef = (uid: string, gameId: string): DocumentReference =>
  doc(db, "users", uid, "games", gameId);
