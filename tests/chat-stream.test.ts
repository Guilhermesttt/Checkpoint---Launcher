// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearUnreadForFriend,
  closeChatConnection,
  subscribeToUnreadMessages,
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
});
