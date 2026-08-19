// @vitest-environment jsdom
import React from "react";
import { render, screen, fireEvent, waitFor, cleanup, within } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

const mocks = vi.hoisted(() => {
  return {
    listPublicVoiceRooms: vi.fn(),
    getMyVoiceRooms: vi.fn(),
    closeVoiceRoom: vi.fn(),
    createVoiceRoom: vi.fn(),
    joinVoiceRoom: vi.fn(),
    leaveVoiceRoom: vi.fn(),
    subscribeToPublicVoiceRooms: vi.fn(() => () => {}),
    publishPublicVoiceRoom: vi.fn(),
    unpublishPublicVoiceRoom: vi.fn(),
  };
});

vi.mock("../src/services/voiceRooms", () => mocks);

import { VoiceRoomsTab } from "../src/components/voice/VoiceRoomsTab";
import type { VoiceRoom } from "../src/types/voice-governance";

describe("VoiceRoomsTab - Sistema de Salas de Voz", () => {
  const mockPublicRooms: VoiceRoom[] = [
    {
      id: "room-1",
      hostUid: "host-1",
      name: "Resenha da Tarde",
      category: "resenha_games",
      isPrivate: false,
      hasPassword: false,
      maxParticipants: 4,
      status: "active",
      createdAt: new Date().toISOString(),
      participantsCount: 2,
      participants: [
        { uid: "host-1", name: "Host Player", avatar: null },
        { uid: "user-2", name: "Friend Player", avatar: null },
      ],
    },
    {
      id: "room-2",
      hostUid: "host-2",
      name: "Gameplay Foco Comp",
      category: "gameplay_foco",
      isPrivate: false,
      hasPassword: false,
      maxParticipants: 4,
      status: "active",
      createdAt: new Date().toISOString(),
      participantsCount: 4,
      participants: [
        { uid: "u-1", name: "Player 1" },
        { uid: "u-2", name: "Player 2" },
        { uid: "u-3", name: "Player 3" },
        { uid: "u-4", name: "Player 4" },
      ],
    },
  ];

  const mockMyRooms: VoiceRoom[] = [
    {
      id: "my-room-1",
      hostUid: "my-uid",
      name: "Minha Sala Permanente",
      category: "casual_chat",
      isPrivate: true,
      hasPassword: true,
      maxParticipants: 4,
      status: "active",
      createdAt: new Date().toISOString(),
      participantsCount: 0,
      participants: [],
      isHost: true,
    },
  ];

  beforeEach(() => {
    cleanup();
    mocks.listPublicVoiceRooms.mockReset().mockResolvedValue(mockPublicRooms);
    mocks.getMyVoiceRooms.mockReset().mockResolvedValue(mockMyRooms);
  });

  afterEach(() => {
    cleanup();
  });

  it("renderiza a aba com lista de salas públicas e minhas salas salvas", async () => {
    const onJoinRoom = vi.fn().mockResolvedValue(undefined);
    const onCreateRoom = vi.fn().mockResolvedValue(undefined);
    const notify = vi.fn();

    render(
      <VoiceRoomsTab
        userProfile={{ uid: "my-uid", displayName: "Guilherme" }}
        onJoinRoom={onJoinRoom}
        onCreateRoom={onCreateRoom}
        notify={notify}
      />,
    );

    expect(screen.getByText("Canais de Voz")).toBeInTheDocument();
    expect(screen.getByText("P2P Mesh (4 Max)")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("Resenha da Tarde")).toBeInTheDocument();
      expect(screen.getByText("Gameplay Foco Comp")).toBeInTheDocument();
      expect(screen.getByText("Minha Sala Permanente")).toBeInTheDocument();
    });

    expect(screen.getByText("2/4")).toBeInTheDocument();
    expect(screen.getByText("4/4")).toBeInTheDocument();
  });

  it("permite entrar diretamente em sala pública disponível", async () => {
    const onJoinRoom = vi.fn().mockResolvedValue(undefined);

    render(
      <VoiceRoomsTab
        userProfile={{ uid: "my-uid", displayName: "Guilherme" }}
        onJoinRoom={onJoinRoom}
        onCreateRoom={vi.fn()}
        notify={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("Resenha da Tarde")).toBeInTheDocument();
    });

    const enterButton = screen.getByRole("button", { name: "Entrar" });
    fireEvent.click(enterButton);

    await waitFor(() => {
      expect(onJoinRoom).toHaveBeenCalledWith("room-1");
    });
  });

  it("bloqueia entrada quando a sala está cheia (4/4)", async () => {
    const onJoinRoom = vi.fn().mockResolvedValue(undefined);
    const notify = vi.fn();

    render(
      <VoiceRoomsTab
        userProfile={{ uid: "my-uid", displayName: "Guilherme" }}
        onJoinRoom={onJoinRoom}
        onCreateRoom={vi.fn()}
        notify={notify}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("Gameplay Foco Comp")).toBeInTheDocument();
    });

    const fullButton = screen.getByRole("button", { name: /Cheia/i });
    expect(fullButton).toBeDisabled();
    expect(onJoinRoom).not.toHaveBeenCalled();
  });

  it("abre modal de senha ao tentar entrar em sala com senha", async () => {
    const onJoinRoom = vi.fn().mockResolvedValue(undefined);

    render(
      <VoiceRoomsTab
        userProfile={{ uid: "my-uid", displayName: "Guilherme" }}
        onJoinRoom={onJoinRoom}
        onCreateRoom={vi.fn()}
        notify={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("Minha Sala Permanente")).toBeInTheDocument();
    });

    const reopenButton = screen.getByRole("button", { name: /Entrar \/ Reabrir/i });
    fireEvent.click(reopenButton);

    await waitFor(() => {
      expect(screen.getByText("Sala Protegida por Senha")).toBeInTheDocument();
    });

    const passwordInput = screen.getByPlaceholderText("Senha da sala");
    fireEvent.change(passwordInput, { target: { value: "1234" } });

    const modalContainer = screen.getByText("Sala Protegida por Senha").closest(".relative")!;
    const submitBtn = within(modalContainer as HTMLElement).getByRole("button", { name: /Entrar/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(onJoinRoom).toHaveBeenCalledWith("my-room-1", "1234");
    });
  });
});
