// @vitest-environment jsdom

import React from "react";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { ChatModal } from "../src/components/home/ChatModal";
import UserProfilePage from "../src/components/UserProfilePage";

vi.mock("../src/auth/AuthProvider", () => ({
  useAuth: () => ({ user: { uid: "user-1", displayName: "Test User" }, loading: false }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock("../src/components/NotificationCenter", () => ({
  useNotification: () => ({ notify: vi.fn() }),
}));

vi.mock("../src/hooks/useGamepadNavigation", () => ({
  useGamepadNavigation: () => undefined,
}));

vi.mock("../src/services/chat", () => ({
  cleanupExpiredChatMessages: vi.fn().mockResolvedValue(undefined),
  compareChatMessages: (a: { createdAt: string }, b: { createdAt: string }) => a.createdAt.localeCompare(b.createdAt),
  markMessagesAsRead: vi.fn().mockResolvedValue(undefined),
  sendChatImage: vi.fn(),
  sendChatMessage: vi.fn(),
  setChatTyping: vi.fn().mockResolvedValue(undefined),
  subscribeToChatMessages: vi.fn((_uid: string, callback: (messages: unknown[]) => void) => { callback([]); return () => undefined; }),
  subscribeToFriendTyping: (_uid: string, callback: (typing: boolean) => void) => { callback(false); return () => undefined; },
  validateChatImage: vi.fn(),
}));

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(cleanup);

describe("hierarquia social ampliada", () => {
  it("apresenta a identidade da amizade antes do historico do chat", () => {
    render(
      <ChatModal
        isOpen
        onClose={vi.fn()}
        friend={{ id: "cp-friend:friend-1", name: "JUUUDAS", status: "online", avatar: "avatar.png" }}
        playSound={vi.fn()}
      />,
    );

    const dialog = screen.getByRole("dialog", { name: "Conversa com JUUUDAS" });
    expect(dialog).toHaveTextContent("JUUUDAS");
    expect(dialog).toHaveTextContent("Nenhuma mensagem ainda");
    expect(screen.getByPlaceholderText("Digite sua mensagem...")).toBeInTheDocument();
  });

  it("exibe o componente de carregamento enquanto as mensagens estão sendo carregadas", async () => {
    const { subscribeToChatMessages } = await import("../src/services/chat");
    let resolveMessages: ((msgs: unknown[]) => void) | null = null;
    vi.mocked(subscribeToChatMessages).mockImplementationOnce((_uid: string, callback: (messages: unknown[]) => void) => {
      resolveMessages = callback;
      return () => undefined;
    });

    render(
      <ChatModal
        isOpen
        onClose={vi.fn()}
        friend={{ id: "cp-friend:friend-2", name: "CyberGamer", status: "online", avatar: "" }}
        playSound={vi.fn()}
      />,
    );

    expect(screen.getByText("Carregando conversa...")).toBeInTheDocument();

    // Quando o servidor responder com mensagens
    act(() => {
      resolveMessages?.([]);
    });
    expect(screen.queryByText("Carregando conversa...")).not.toBeInTheDocument();
    expect(screen.getByText("Nenhuma mensagem ainda")).toBeInTheDocument();
  });

  it("marca mensagens como lidas em tempo real se a modal já estiver aberta e uma mensagem não lida chegar", async () => {
    const { subscribeToChatMessages, markMessagesAsRead } = await import("../src/services/chat");
    let resolveMessages: ((msgs: unknown[]) => void) | null = null;
    vi.mocked(subscribeToChatMessages).mockImplementationOnce((_uid: string, callback: (messages: unknown[]) => void) => {
      resolveMessages = callback;
      return () => undefined;
    });

    render(
      <ChatModal
        isOpen
        onClose={vi.fn()}
        friend={{ id: "cp-friend:friend-99", name: "Gamer99", status: "online", avatar: "" }}
        playSound={vi.fn()}
      />,
    );

    // Initial load: 0 messages
    act(() => {
      resolveMessages?.([]);
    });

    vi.mocked(markMessagesAsRead).mockClear();

    // Uma nova mensagem não lida do amigo chega com o chat já aberto
    act(() => {
      resolveMessages?.([
        {
          id: "msg-123",
          senderId: "friend-99",
          receiverId: "user-1",
          text: "E aí mano",
          createdAt: new Date().toISOString(),
          read: false,
        },
      ]);
    });

    // Deve chamar markMessagesAsRead imediatamente em tempo real
    expect(markMessagesAsRead).toHaveBeenCalledWith("friend-99");
  });

  it("deduplica mensagens temporárias fast/local quando a mensagem persistida do banco chega", async () => {
    const { deduplicateChatMessages } = await import("../src/components/home/ChatModal");
    const nowIso = new Date().toISOString();

    const fastMessage = {
      id: "fast_12345",
      senderId: "friend-1",
      receiverId: "user-1",
      text: "Mensagem de teste",
      createdAt: nowIso,
      read: false,
    };

    const confirmedMessage = {
      id: "db-uuid-67890",
      senderId: "friend-1",
      receiverId: "user-1",
      text: "Mensagem de teste",
      createdAt: nowIso,
      read: false,
    };

    // Cenário: ambos presentes na lista
    const deduplicated = deduplicateChatMessages([fastMessage, confirmedMessage]);
    expect(deduplicated).toHaveLength(1);
    expect(deduplicated[0].id).toBe("db-uuid-67890");
  });

  it("prioriza atividade antes dos detalhes secundarios no perfil do amigo", () => {
    render(
      <UserProfilePage
        userProfile={{ uid: "friend-1", displayName: "JUUUDAS" }}
        user={null}
        games={[]}
        editable={false}
      />,
    );

    const activity = screen.getByRole("region", { name: "Atividade do jogador" });
    const summary = screen.getByRole("complementary", { name: "Resumo do perfil" });
    expect(activity.closest('[data-profile-density="compact"]')).not.toBeNull();
    expect(activity.compareDocumentPosition(summary) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByText("Perfil do jogador")).toBeInTheDocument();
  });
});
