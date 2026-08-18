// @vitest-environment jsdom
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { IncomingCallModal } from "../src/components/voice/IncomingCallModal";
import { VoiceCallBar } from "../src/components/voice/VoiceCallBar";
import { VoiceCallWindow } from "../src/components/voice/VoiceCallWindow";
import { ScreenPickerModal } from "../src/components/voice/ScreenPickerModal";

describe("Voice & Screen Share Call System", () => {
  it("renderiza IncomingCallModal com dados do chamador e dispara ações", () => {
    const onAccept = vi.fn();
    const onReject = vi.fn();

    render(
      <IncomingCallModal
        isOpen={true}
        invite={{
          callerId: "user-123",
          callerName: "Gabriel",
          callerAvatar: "https://example.com/avatar.png",
          chatId: "chat-1",
          hasVideo: false,
          timestamp: Date.now(),
        }}
        onAccept={onAccept}
        onReject={onReject}
      />,
    );

    expect(screen.getByText("Gabriel")).toBeInTheDocument();
    expect(screen.getByText("Chamada de Voz")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Atender/i }));
    expect(onAccept).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: /Recusar/i }));
    expect(onReject).toHaveBeenCalledTimes(1);
  });

  it("renderiza VoiceCallBar quando a chamada está ativa", () => {
    const onToggleMute = vi.fn();
    const onToggleDeafen = vi.fn();
    const onToggleScreenShare = vi.fn();
    const onOpenWindow = vi.fn();
    const onHangUp = vi.fn();

    render(
      <VoiceCallBar
        session={{
          chatId: "chat-1",
          friendUid: "user-456",
          friendName: "Matheus",
          isInitiator: true,
          startedAt: Date.now(),
        }}
        duration={125}
        isMuted={false}
        isDeafened={false}
        isSpeaking={true}
        isSharingScreen={false}
        onToggleMute={onToggleMute}
        onToggleDeafen={onToggleDeafen}
        onToggleScreenShare={onToggleScreenShare}
        onOpenWindow={onOpenWindow}
        onHangUp={onHangUp}
      />,
    );

    expect(screen.getByText("Voz Conectada")).toBeInTheDocument();
    expect(screen.getByText("Matheus")).toBeInTheDocument();
    expect(screen.getByText("• 02:05")).toBeInTheDocument();

    fireEvent.click(screen.getByTitle("Mutar microfone"));
    expect(onToggleMute).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTitle("Desconectar"));
    expect(onHangUp).toHaveBeenCalledTimes(1);
  });

  it("renderiza VoiceCallWindow com visualização dos participantes e controles", () => {
    const onClose = vi.fn();
    const onHangUp = vi.fn();

    render(
      <VoiceCallWindow
        isOpen={true}
        onClose={onClose}
        session={{
          chatId: "chat-1",
          friendUid: "user-456",
          friendName: "Matheus",
          isInitiator: true,
          startedAt: Date.now(),
        }}
        userProfile={{
          uid: "user-me",
          displayName: "Guilherme",
        }}
        remoteStream={null}
        localStream={null}
        duration={45}
        isMuted={false}
        isDeafened={false}
        isSpeakingLocal={false}
        isSpeakingRemote={false}
        isSharingScreen={false}
        isRemoteSharingScreen={false}
        onToggleMute={vi.fn()}
        onToggleDeafen={vi.fn()}
        onToggleScreenShare={vi.fn()}
        onHangUp={onHangUp}
      />,
    );

    expect(screen.getAllByText("Matheus").length).toBeGreaterThan(0);
    expect(screen.getByText("Guilherme")).toBeInTheDocument();
    expect(screen.getByText("00:45")).toBeInTheDocument();
    expect(screen.getByText("Desconectar")).toBeInTheDocument();
  });

  it("renderiza ScreenPickerModal e permite fechar e selecionar", () => {
    const onClose = vi.fn();
    const onSelectSource = vi.fn();

    render(
      <ScreenPickerModal
        isOpen={true}
        onClose={onClose}
        onSelectSource={onSelectSource}
      />,
    );

    expect(screen.getByText("Compartilhar Tela")).toBeInTheDocument();
    expect(screen.getByText(/Telas Inteiras/i)).toBeInTheDocument();
    expect(screen.getByText(/Janelas & Jogos/i)).toBeInTheDocument();
  });
});
