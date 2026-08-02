// @vitest-environment jsdom

import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { ChatModal } from "../src/components/home/ChatModal";
import UserProfilePage from "../src/components/UserProfilePage";

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
  subscribeToChatMessages: (_uid: string, callback: (messages: unknown[]) => void) => { callback([]); return () => undefined; },
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
    expect(dialog).toHaveTextContent("Vocês já são amigos");
    expect(dialog).toHaveTextContent("Comece a conversar agora");
    expect(screen.getByPlaceholderText("Digite sua mensagem...")).toBeInTheDocument();
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
