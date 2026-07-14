import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { deleteDoc, doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
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

  it("mensagens so podem ser criadas pelo remetente e lidas pelos participantes", async () => {
    const alice = environment.authenticatedContext("alice").firestore();
    const bob = environment.authenticatedContext("bob").firestore();
    const mallory = environment.authenticatedContext("mallory").firestore();
    const message = {
      chatId: "alice_bob",
      senderId: "alice",
      receiverId: "bob",
      text: "ola",
      createdAt: 1,
      read: false,
      attachmentName: "",
      attachmentUrl: "",
      attachmentType: "",
      attachmentSize: 0,
      attachmentPath: "",
    };
    await assertSucceeds(setDoc(doc(alice, "messages/message-1"), message));
    await assertFails(setDoc(doc(mallory, "messages/message-2"), message));
    await assertFails(getDoc(doc(mallory, "messages/message-1")));
    await assertSucceeds(getDoc(doc(bob, "messages/message-1")));
    await assertSucceeds(updateDoc(doc(bob, "messages/message-1"), { read: true }));
    await assertFails(updateDoc(doc(bob, "messages/message-1"), { text: "alterado" }));
  });
});
