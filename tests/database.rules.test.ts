import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { get, ref, set } from "firebase/database";
import { afterAll, afterEach, beforeAll, describe, it } from "vitest";

let environment: RulesTestEnvironment;

beforeAll(async () => {
  environment = await initializeTestEnvironment({
    projectId: "checkpoint-rules-test",
    database: {
      rules: readFileSync(resolve("database.rules.json"), "utf8"),
      host: "127.0.0.1",
      port: 9000,
    },
  });
});

afterEach(async () => environment.clearDatabase());
afterAll(async () => environment.cleanup());

describe("regras Realtime Database", () => {
  it("restringe mensagens aos participantes e fixa o remetente autenticado", async () => {
    await environment.withSecurityRulesDisabled(async (context) => {
      await set(ref(context.database(), "chats/alice_bob/participants"), {
        alice: true,
        bob: true,
      });
    });

    const alice = environment.authenticatedContext("alice").database();
    const bob = environment.authenticatedContext("bob").database();
    const mallory = environment.authenticatedContext("mallory").database();
    const message = {
      senderId: "alice",
      receiverId: "bob",
      text: "ola",
      createdAt: 1,
    };

    await assertSucceeds(
      set(ref(alice, "chats/alice_bob/messages/message-1"), message),
    );
    await assertSucceeds(get(ref(bob, "chats/alice_bob/messages")));
    await assertFails(get(ref(mallory, "chats/alice_bob/messages")));
    await assertFails(
      set(ref(bob, "chats/alice_bob/messages/message-2"), message),
    );
    await assertFails(
      set(ref(alice, "chats/alice_bob/participants/mallory"), true),
    );
  });

  it("permite atualizar o indice somente para participantes da conversa", async () => {
    await environment.withSecurityRulesDisabled(async (context) => {
      await set(ref(context.database(), "chats/alice_bob/participants"), {
        alice: true,
        bob: true,
      });
      await set(ref(context.database(), "chats/alice_bob/messages/message-1"), {
        senderId: "alice",
        receiverId: "bob",
        text: "ola",
        createdAt: 1,
      });
    });
    const alice = environment.authenticatedContext("alice").database();
    const mallory = environment.authenticatedContext("mallory").database();
    const inbox = {
      friendUid: "alice",
      lastMessageId: "message-1",
      senderId: "alice",
      receiverId: "bob",
      text: "ola",
      updatedAt: 1,
    };
    await assertSucceeds(set(ref(alice, "userChats/bob/alice_bob"), inbox));
    await assertFails(set(ref(mallory, "userChats/bob/alice_bob"), inbox));
  });
});
