import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { afterAll, afterEach, beforeAll, describe, it } from "vitest";

let environment: RulesTestEnvironment;

beforeAll(async () => {
  environment = await initializeTestEnvironment({
    projectId: "checkpoint-rules-test",
    firestore: {
      rules: readFileSync(resolve("firestore.rules"), "utf8"),
      host: "127.0.0.1",
      port: 8080,
    },
  });
});

afterEach(async () => environment.clearFirestore());
afterAll(async () => environment.cleanup());

describe("regras Firestore", () => {
  it("permite criar apenas o proprio perfil sem campos inesperados", async () => {
    const alice = environment.authenticatedContext("alice").firestore();
    await assertSucceeds(setDoc(doc(alice, "profiles/alice"), {
      uid: "alice",
      email: "alice@example.com",
      displayName: "Alice",
      photoURL: null,
      createdAt: 1,
      updatedAt: 1,
    }));
    await assertFails(setDoc(doc(alice, "profiles/bob"), {
      uid: "bob",
      email: "bob@example.com",
      displayName: "Bob",
      photoURL: null,
      createdAt: 1,
      updatedAt: 1,
    }));
    await assertFails(updateDoc(doc(alice, "profiles/alice"), { admin: true }));
    await assertFails(updateDoc(doc(alice, "profiles/alice"), {
      checkpointFriends: [{ uid: "victim", displayName: "Victim" }],
    }));
    await assertSucceeds(updateDoc(doc(alice, "profiles/alice"), {
      achievementSummary: {
        unlocked: 12,
        available: 100,
        gamesWithAchievements: 3,
        totalGames: 8,
        updatedAt: "2026-07-16T12:00:00.000Z",
      },
      steamAchievementSync: {
        requested: 8,
        resolved: 7,
        failed: 1,
        failedAppIds: ["123"],
        updatedAt: "2026-07-16T12:00:00.000Z",
      },
    }));
  });

  it("isola bibliotecas por usuario e impede exclusao do perfil", async () => {
    const alice = environment.authenticatedContext("alice").firestore();
    const bob = environment.authenticatedContext("bob").firestore();
    await assertSucceeds(setDoc(doc(alice, "users/alice/games/game-1"), { title: "Portal" }));
    await assertFails(getDoc(doc(bob, "users/alice/games/game-1")));

    await environment.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), "profiles/alice"), { uid: "alice" });
    });
    await assertFails(deleteDoc(doc(alice, "profiles/alice")));
  });

  it("mantem o resumo publico em um documento seguro e tira o chat do Firestore", async () => {
    const alice = environment.authenticatedContext("alice").firestore();
    const bob = environment.authenticatedContext("bob").firestore();
    const summary = {
      schemaVersion: 1,
      uid: "alice",
      displayName: "Alice",
      photoURL: "",
      stats: { games: 54, minutesPlayed: 1200, favorites: 3 },
      platforms: { steamGameCount: 50, epicGameCount: 2, localGameCount: 2 },
      achievements: { unlocked: 10, total: 20 },
      topGames: [],
      favoriteGames: [],
      revision: 1,
      updatedAt: "2026-07-16T12:00:00.000Z",
    };
    await assertSucceeds(setDoc(doc(alice, "publicProfiles/alice"), summary));
    await assertSucceeds(getDoc(doc(bob, "publicProfiles/alice")));
    await assertFails(setDoc(doc(bob, "publicProfiles/alice"), summary));
    await assertFails(setDoc(doc(alice, "publicProfiles/alice"), {
      ...summary,
      email: "private@example.com",
    }));
    await assertFails(setDoc(doc(alice, "messages/message-1"), {
      senderId: "alice",
      receiverId: "bob",
      text: "ola",
    }));
  });

  it("permite ler atividades da audiencia, mas bloqueia toda escrita direta do cliente", async () => {
    const alice = environment.authenticatedContext("alice").firestore();
    const bob = environment.authenticatedContext("bob").firestore();
    const activity = {
      userId: "alice",
      userName: "Alice",
      userAvatar: null,
      audienceIds: ["alice", "bob"],
      kind: "achievement",
      gameId: "portal",
      gameTitle: "Portal",
      achievementId: "FIRST",
      achievementName: "Primeiro portal",
      createdAt: "2026-07-16T12:00:00.000Z",
    };
    await environment.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), "activities/activity-1"), activity);
      await setDoc(doc(context.firestore(), "feeds/bob/activities/activity-1"), activity);
    });
    await assertFails(setDoc(doc(alice, "activities/activity-2"), activity));
    await assertFails(getDoc(doc(bob, "activities/activity-1")));
    await assertSucceeds(getDoc(doc(bob, "feeds/bob/activities/activity-1")));
    const mallory = environment.authenticatedContext("mallory").firestore();
    await assertFails(getDoc(doc(mallory, "feeds/bob/activities/activity-1")));
    await assertSucceeds(getDocs(query(
      collection(bob, "feeds", "bob", "activities"),
      orderBy("createdAt", "desc"),
      limit(60),
    )));
    await assertFails(getDocs(query(
      collection(mallory, "feeds", "bob", "activities"),
      orderBy("createdAt", "desc"),
      limit(60),
    )));
    await assertFails(setDoc(doc(bob, "activities/activity-2"), activity));
    await assertFails(updateDoc(doc(alice, "activities/activity-1"), { caption: "alterado" }));
    await assertFails(deleteDoc(doc(alice, "activities/activity-1")));
  });
});
