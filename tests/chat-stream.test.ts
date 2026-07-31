// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearUnreadForFriend,
  closeChatConnection,
  compareChatMessages,
  normalizeMessage,
  subscribeToUnreadMessages,
  validateChatImage,
} from "../src/services/chat";

afterEach(() => {
  closeChatConnection();
  vi.clearAllMocks();
});

describe("chat com Supabase", () => {
  it("gerencia assinaturas de mensagens nao lidas corretamente", () => {
    const fn = vi.fn();
    const unsubscribe = subscribeToUnreadMessages(fn);
    expect(fn).toHaveBeenCalledWith([]);
    unsubscribe();
  });

  it("limpa nao lidas por amigo sem lancar excecao", () => {
    expect(() => clearUnreadForFriend("friend-1")).not.toThrow();
  });

  it("ordena mensagens confirmadas pela sequencia FIFO do banco", () => {
    const messages = [
      normalizeMessage("third", {
        sender_id: "friend",
        text: "terceira",
        sequence_id: 103,
        created_at: "2026-07-30T00:00:01.000Z",
      }),
      normalizeMessage("first", {
        sender_id: "me",
        text: "primeira",
        sequence_id: 101,
        created_at: "2026-07-30T00:00:03.000Z",
      }),
      normalizeMessage("second", {
        sender_id: "friend",
        text: "segunda",
        sequence_id: 102,
        created_at: "2026-07-29T23:59:59.000Z",
      }),
    ];

    expect(messages.sort(compareChatMessages).map((message) => message.text))
      .toEqual(["primeira", "segunda", "terceira"]);
  });

  it("mantem mensagens otimistas depois das confirmadas", () => {
    const confirmed = normalizeMessage("confirmed", {
      sender_id: "me",
      text: "confirmada",
      sequence_id: 10,
      created_at: "2026-07-30T00:00:02.000Z",
    });
    const pending = normalizeMessage("local-pending", {
      sender_id: "me",
      text: "pendente",
      created_at: "2026-07-30T00:00:01.000Z",
    });

    expect([pending, confirmed].sort(compareChatMessages).map((message) => message.text))
      .toEqual(["confirmada", "pendente"]);
  });

  it("valida a imagem antes de anexar ao rascunho", () => {
    const validImage = new File(["preview"], "preview.png", { type: "image/png" });
    const invalidFile = new File(["texto"], "arquivo.txt", { type: "text/plain" });

    expect(() => validateChatImage(validImage)).not.toThrow();
    expect(() => validateChatImage(invalidFile)).toThrow(
      "Use uma imagem JPG, PNG, WEBP ou GIF de ate 8 MB.",
    );
  });
});
