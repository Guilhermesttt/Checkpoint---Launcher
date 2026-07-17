// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

const databaseMocks = vi.hoisted(() => ({
  onValue: vi.fn(),
  off: vi.fn(),
  ref: vi.fn((_db: unknown, path = "") => ({ path })),
}));

vi.mock("firebase/database", () => ({
  get: vi.fn(),
  limitToLast: vi.fn((value) => value),
  off: databaseMocks.off,
  onChildAdded: vi.fn(),
  onValue: databaseMocks.onValue,
  orderByChild: vi.fn((value) => value),
  push: vi.fn(),
  query: vi.fn((value) => value),
  ref: databaseMocks.ref,
  remove: vi.fn(),
  serverTimestamp: vi.fn(() => 123),
  set: vi.fn(),
  update: vi.fn(),
}));

vi.mock("../Firebase", () => ({
  auth: { currentUser: { uid: "user-1" } },
  realtimeDb: {},
}));

import {
  compareChatMessages,
  closeChatConnection,
  establishChatConnection,
  subscribeToUnreadMessages,
} from "../src/services/chat";

afterEach(() => {
  closeChatConnection();
  vi.clearAllMocks();
});

describe("chat no Realtime Database", () => {
  it("ordena por horario e usa o id como desempate deterministico", () => {
    const base = {
      chatId: "chat",
      senderId: "user-1",
      receiverId: "friend-1",
      text: "Mensagem",
      read: false,
      createdAt: "2026-07-17T12:00:00.000Z",
    };
    const messages = [
      { ...base, id: "b" },
      { ...base, id: "c", createdAt: "2026-07-17T12:01:00.000Z" },
      { ...base, id: "a" },
    ].sort(compareChatMessages);

    expect(messages.map((message) => message.id)).toEqual(["a", "b", "c"]);
  });

  it("escuta somente a caixa do usuario e deduplica mensagens recebidas", async () => {
    let inboxCallback: ((snapshot: { val: () => unknown }) => void) | undefined;
    databaseMocks.onValue.mockImplementation((_reference, callback) => {
      inboxCallback = callback;
      return vi.fn();
    });
    const unreadSnapshots: string[][] = [];
    const unsubscribe = subscribeToUnreadMessages((messages) => {
      unreadSnapshots.push(messages.flatMap((message) => message.id ? [message.id] : []));
    });

    await establishChatConnection();
    expect(databaseMocks.ref).toHaveBeenCalledWith({}, "userChats/user-1");

    inboxCallback?.({ val: () => null });
    inboxCallback?.({
      val: () => ({
        "friend-1_user-1": {
          lastMessageId: "message-1",
          senderId: "friend-1",
          receiverId: "user-1",
          text: "Ola",
          updatedAt: Date.parse("2026-07-16T12:00:00.000Z"),
        },
      }),
    });
    inboxCallback?.({
      val: () => ({
        "friend-1_user-1": {
          lastMessageId: "message-1",
          senderId: "friend-1",
          receiverId: "user-1",
          text: "Ola",
          updatedAt: Date.parse("2026-07-16T12:00:00.000Z"),
        },
      }),
    });

    expect(unreadSnapshots).toContainEqual(["message-1"]);
    expect(unreadSnapshots.filter((items) => items.includes("message-1"))).toHaveLength(1);
    unsubscribe();
  });
});
