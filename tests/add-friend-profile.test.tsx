// @vitest-environment jsdom
import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const { searchCheckpointFriends } = vi.hoisted(() => ({
  searchCheckpointFriends: vi.fn(),
}));

vi.mock("../src/services/checkpointFriends", () => ({ searchCheckpointFriends }));

import { AddFriendModal } from "../src/pages/FriendsPage";

describe("descoberta de perfis", () => {
  it("permite abrir um perfil publico diretamente pela busca", async () => {
    const profile = {
      uid: "public-user",
      displayName: "Jogador Público",
      photoURL: null,
      profileVisibility: "public" as const,
    };
    searchCheckpointFriends.mockResolvedValueOnce([profile]);
    const onViewProfile = vi.fn();

    render(
      <AddFriendModal
        isOpen
        onClose={vi.fn()}
        onAddFriend={vi.fn()}
        onViewProfile={onViewProfile}
        currentUserUid="current-user"
        friendIds={new Set()}
        outgoingRequestIds={new Set()}
        incomingRequestIds={new Set()}
        playSound={vi.fn()}
        t={(key: string) => ({
          addFriendTitle: "Adicionar amigo",
          addFriendHint: "Busque jogadores",
          addFriendSearchPlaceholder: "Pesquisar",
          addFriendSearchButton: "Buscar",
          addFriendViewProfile: "Ver perfil",
          addFriendSend: "Adicionar",
        }[key] ?? key) as never}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText("Pesquisar"), { target: { value: "Jogador" } });
    fireEvent.click(screen.getByRole("button", { name: "Buscar" }));
    await screen.findByText("Jogador Público");
    fireEvent.click(screen.getByRole("button", { name: "Ver perfil" }));

    await waitFor(() => expect(onViewProfile).toHaveBeenCalledWith(profile));
  });
});
