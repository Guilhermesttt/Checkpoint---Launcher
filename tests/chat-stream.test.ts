// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  getIdToken: vi.fn(async () => "firebase-chat-token"),
  user: { uid: "user-1" },
}));

vi.mock("../Firebase", () => ({
  auth: {
    get currentUser() {
      return { ...authMocks.user, getIdToken: authMocks.getIdToken };
    },
  },
}));

import {
  closeChatConnection,
  establishChatConnection,
  subscribeToUnreadMessages,
} from "../src/services/chat";

afterEach(() => {
  closeChatConnection();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("chat SSE", () => {
  it("autentica pelo header sem expor o token na URL", async () => {
    const message = {
      id: "message-1",
      chatId: "friend-1_user-1",
      senderId: "friend-1",
      receiverId: "user-1",
      text: "Olá",
      createdAt: "2026-07-16T12:00:00.000Z",
      read: false,
    };
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(
          `data: ${JSON.stringify({ type: "message", message })}\n\n`,
        ));
        controller.close();
      },
    });
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      void input;
      void init;
      return new Response(stream, {
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const unreadSnapshots: string[][] = [];
    const unsubscribe = subscribeToUnreadMessages((messages) => {
      unreadSnapshots.push(
        messages.map((item) => item.id).filter((id): id is string => Boolean(id)),
      );
    });

    await establishChatConnection();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toMatch(/\/api\/chat\/stream$/);
    expect(String(url)).not.toContain("firebase-chat-token");
    expect((init?.headers as Record<string, string>).Authorization).toBe(
      "Bearer firebase-chat-token",
    );
    expect(unreadSnapshots).toContainEqual(["message-1"]);

    unsubscribe();
  });
});
