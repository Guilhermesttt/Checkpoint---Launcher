import React, { createContext, useContext, useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PhoneCall, X } from "lucide-react";
import { useAuth } from "../auth/AuthProvider";
import { useNotification } from "../components/NotificationCenter";
import { useVoiceCall } from "../hooks/useVoiceCall";
import { IncomingCallModal } from "../components/voice/IncomingCallModal";
import { VoiceCallBar } from "../components/voice/VoiceCallBar";
import { VoiceCallWindow } from "../components/voice/VoiceCallWindow";
import { ScreenPickerModal } from "../components/voice/ScreenPickerModal";
import { getCheckpointFriendStatuses } from "../services/checkpointFriends";
import type { SocialFriend } from "../types/domain";

type VoiceCallContextType = ReturnType<typeof useVoiceCall>;

const VoiceCallContext = createContext<VoiceCallContextType | null>(null);

const RemoteAudioElement: React.FC<{
  stream: MediaStream;
  outputDeviceId?: string;
  volume: number;
}> = ({ stream, outputDeviceId, volume }) => {
  const audioElRef = React.useRef<HTMLAudioElement | null>(null);

  React.useEffect(() => {
    const el = audioElRef.current;
    if (!el || !stream) return;

    const syncPlayback = () => {
      if (stream.getAudioTracks().length === 0) return;
      el.srcObject = stream;
      if (outputDeviceId && typeof (el as any).setSinkId === "function") {
        void (el as any).setSinkId(outputDeviceId === "default" ? "" : outputDeviceId).catch(() => {});
      }
      el.volume = Math.max(0, Math.min(1, volume / 100));
      void el.play().catch((err) => {
        console.warn("[RemoteAudioElement] Autoplay policy note:", err);
      });
    };

    syncPlayback();
    stream.addEventListener("addtrack", syncPlayback);
    return () => {
      stream.removeEventListener("addtrack", syncPlayback);
    };
  }, [stream, outputDeviceId, volume]);

  return <audio ref={audioElRef} autoPlay playsInline style={{ display: "none" }} />;
};

export const VoiceCallProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, userProfile } = useAuth();
  let notify: (msg: string, type: "success" | "error" | "info") => void = () => {};
  try {
    const notificationContext = useNotification();
    if (notificationContext?.notify) {
      notify = notificationContext.notify;
    }
  } catch {
    // In unit tests without full notification center
  }

  const voiceCall = useVoiceCall({
    user,
    userProfile,
    notify,
  });

  const [socialFriends, setSocialFriends] = useState<SocialFriend[]>([]);

  useEffect(() => {
    if (!userProfile?.checkpointFriends || userProfile.checkpointFriends.length === 0) {
      setSocialFriends([]);
      return;
    }

    let isMounted = true;
    void getCheckpointFriendStatuses()
      .then((statuses) => {
        if (!isMounted) return;
        const list: SocialFriend[] = (userProfile.checkpointFriends || []).map((f) => {
          const status = statuses.find((s) => s.uid === f.uid);
          return {
            id: f.uid,
            name: status?.displayName || f.displayName || "Amigo",
            avatar: status?.photoURL || f.photoURL || undefined,
            status: status?.status || "offline",
            playing: status?.playing || undefined,
            source: "checkpoint",
          };
        });
        setSocialFriends(list);
      })
      .catch(() => {
        if (!isMounted) return;
        const list: SocialFriend[] = (userProfile.checkpointFriends || []).map((f) => ({
          id: f.uid,
          name: f.displayName || "Amigo",
          avatar: f.photoURL || undefined,
          status: "offline",
          source: "checkpoint",
        }));
        setSocialFriends(list);
      });

    return () => {
      isMounted = false;
    };
  }, [userProfile?.checkpointFriends]);


  // Persistent audio playback for remote participants with Web Audio API Soft-Limiter
  const remoteAudioRef = React.useRef<HTMLAudioElement | null>(null);
  const peerAudioNodesMapRef = React.useRef<Map<string, any>>(new Map());
  const audioContextRef = React.useRef<AudioContext | null>(null);

  // Sync audio output device changes (setSinkId)
  React.useEffect(() => {
    const targetOutput = voiceCall.selectedAudioOutput;
    if (!targetOutput) return;

    if (remoteAudioRef.current && typeof (remoteAudioRef.current as any).setSinkId === "function") {
      void (remoteAudioRef.current as any).setSinkId(targetOutput === "default" ? "" : targetOutput).catch(() => {});
    }
    if (audioContextRef.current && typeof (audioContextRef.current as any).setSinkId === "function") {
      void (audioContextRef.current as any).setSinkId(targetOutput === "default" ? "" : targetOutput).catch(() => {});
    }
    peerAudioNodesMapRef.current.forEach((node) => {
      if (node && typeof node.setSinkId === "function") {
        void node.setSinkId(targetOutput);
      }
    });
  }, [voiceCall.selectedAudioOutput]);

  React.useEffect(() => {
    const isEchoTest = voiceCall.session?.friendUid === "echo-bot";
    const isMutedLocally = voiceCall.isDeafened || isEchoTest;
    const globalVolume = isMutedLocally ? 0 : (voiceCall.remoteVolume ?? 100);

    // Collect all active remote audio streams (support both Map and singular fallback)
    const activeStreams = new Map<string, MediaStream>();
    if (voiceCall.remoteStreams && voiceCall.remoteStreams instanceof Map && voiceCall.remoteStreams.size > 0) {
      voiceCall.remoteStreams.forEach((st: MediaStream, peerId: string) => {
        if (st && st.getAudioTracks().length > 0) {
          activeStreams.set(peerId, st);
        }
      });
    } else if (voiceCall.remoteStream && voiceCall.remoteStream.getAudioTracks().length > 0) {
      activeStreams.set(voiceCall.session?.friendUid || "main-remote", voiceCall.remoteStream);
    }

    if (activeStreams.size > 0) {
      try {
        if (!audioContextRef.current || audioContextRef.current.state === "closed") {
          audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({
            latencyHint: "interactive",
          });
          if (voiceCall.selectedAudioOutput && typeof (audioContextRef.current as any).setSinkId === "function") {
            void (audioContextRef.current as any).setSinkId(voiceCall.selectedAudioOutput === "default" ? "" : voiceCall.selectedAudioOutput).catch(() => {});
          }
        }

        if (audioContextRef.current.state === "suspended") {
          void audioContextRef.current.resume();
        }

        // Clean up nodes for peers that are no longer active
        peerAudioNodesMapRef.current.forEach((node, peerId) => {
          if (!activeStreams.has(peerId)) {
            node.destroy?.();
            peerAudioNodesMapRef.current.delete(peerId);
          }
        });

        // Initialize or update nodes for active streams
        import("../services/audio/PeerAudioNode").then(({ PeerAudioNode }) => {
          if (!audioContextRef.current) return;
          activeStreams.forEach((stream, peerId) => {
            const existing = peerAudioNodesMapRef.current.get(peerId);
            if (!existing) {
              const newNode = new PeerAudioNode(audioContextRef.current!, stream, globalVolume);
              if (voiceCall.selectedAudioOutput) {
                void newNode.setSinkId(voiceCall.selectedAudioOutput);
              }
              peerAudioNodesMapRef.current.set(peerId, newNode);
            } else {
              existing.setVolume(globalVolume);
            }
          });
        }).catch(() => {});
      } catch (err) {
        console.warn("[VoiceCallContext] Web Audio pipeline error:", err);
      }
    } else {
      peerAudioNodesMapRef.current.forEach((node) => node.destroy?.());
      peerAudioNodesMapRef.current.clear();
    }

    return () => {
      // teardown handled on stream change
    };
  }, [
    voiceCall.remoteStream,
    voiceCall.remoteStreams,
    voiceCall.isDeafened,
    voiceCall.session?.friendUid,
    voiceCall.remoteVolume,
    voiceCall.selectedAudioOutput,
  ]);

  // Notify in-game overlay when an incoming call arrives
  React.useEffect(() => {
    if (voiceCall.callState === "ringing-in" && voiceCall.incomingInvite) {
      if (window.electronAPI?.showNotificationOverlay) {
        void window.electronAPI.showNotificationOverlay({
          type: "incoming-call",
          title: "Chamada de Voz",
          message: `${voiceCall.incomingInvite.callerName} está te ligando. Pressione F8 para abrir o overlay e atender.`,
          imageUrl: voiceCall.incomingInvite.callerAvatar || undefined,
        });
      }
    }
  }, [voiceCall.callState, voiceCall.incomingInvite]);

  return (
    <VoiceCallContext.Provider value={voiceCall}>
      {children}

      {/* Global persistent audio element */}
      <audio ref={remoteAudioRef} autoPlay playsInline style={{ display: "none" }} />

      {/* Incoming Call Popup */}
      <IncomingCallModal
        isOpen={voiceCall.callState === "ringing-in"}
        invite={voiceCall.incomingInvite}
        onAccept={voiceCall.answerCall}
        onReject={voiceCall.rejectCall}
      />

      {/* Persistent Bottom Call Bar (visible when in call and main window is closed) */}
      {(voiceCall.callState === "active" || voiceCall.callState === "ringing-out" || voiceCall.callState === "connecting") &&
        !voiceCall.isVoiceWindowOpen && (
          <VoiceCallBar
            session={voiceCall.session}
            userProfile={userProfile}
            duration={voiceCall.callDuration}
            callState={voiceCall.callState}
            isMuted={voiceCall.isMuted}
            isDeafened={voiceCall.isDeafened}
            isSpeakingLocal={voiceCall.isSpeakingLocal}
            isSpeakingRemote={voiceCall.isSpeakingRemote}
            remoteSpeakingStates={voiceCall.remoteSpeakingStates}
            isSharingScreen={voiceCall.isSharingScreen}
            isReconnecting={voiceCall.isReconnecting}
            inputMode={voiceCall.inputMode}
            pushToTalkKey={voiceCall.pushToTalkKey}
            isPttPressed={voiceCall.isPttPressed}
            onToggleMute={voiceCall.toggleMute}
            onToggleDeafen={voiceCall.toggleDeafen}
            onToggleScreenShare={() => {
              if (voiceCall.isSharingScreen) {
                void voiceCall.stopScreenShare();
              } else {
                voiceCall.setIsScreenPickerOpen(true);
              }
            }}
            onOpenWindow={() => voiceCall.setIsVoiceWindowOpen(true)}
            onHangUp={voiceCall.hangUp}
          />
        )}

      {/* Expanded Main Call Window */}
      <VoiceCallWindow
        isOpen={voiceCall.isVoiceWindowOpen && voiceCall.callState !== "idle" && voiceCall.callState !== "ringing-in"}
        onClose={() => voiceCall.setIsVoiceWindowOpen(false)}
        session={voiceCall.session}
        userProfile={userProfile}
        remoteStream={voiceCall.remoteStream}
        localStream={voiceCall.localStream}
        localCameraStream={voiceCall.localCameraStream}
        localScreenStream={voiceCall.localScreenStream}
        duration={voiceCall.callDuration}
        callState={voiceCall.callState}
        isMuted={voiceCall.isMuted}
        isDeafened={voiceCall.isDeafened}
        isSpeakingLocal={voiceCall.isSpeakingLocal}
        isSpeakingRemote={voiceCall.isSpeakingRemote}
        isSharingScreen={voiceCall.isSharingScreen}
        isRemoteSharingScreen={voiceCall.isRemoteSharingScreen}
        remoteVolume={voiceCall.remoteVolume}
        onChangeRemoteVolume={voiceCall.setRemoteVolume}
        isReconnecting={voiceCall.isReconnecting}
        inputMode={voiceCall.inputMode}
        setInputMode={voiceCall.setInputMode}
        pushToTalkKey={voiceCall.pushToTalkKey}
        isRemoteMuted={voiceCall.isRemoteMuted}
        isRemoteDeafened={voiceCall.isRemoteDeafened}
        isCameraOn={voiceCall.isCameraOn}
        isRemoteCameraOn={voiceCall.isRemoteCameraOn}
        audioInputDevices={voiceCall.audioInputDevices}
        audioOutputDevices={voiceCall.audioOutputDevices}
        videoInputDevices={voiceCall.videoInputDevices}
        selectedAudioInput={voiceCall.selectedAudioInput}
        selectedAudioOutput={voiceCall.selectedAudioOutput}
        selectedVideoInput={voiceCall.selectedVideoInput}
        onChangeAudioInputDevice={voiceCall.changeAudioInputDevice}
        onChangeAudioOutputDevice={voiceCall.changeAudioOutputDevice}
        onChangeVideoInputDevice={voiceCall.changeVideoInputDevice}
        voiceSensitivity={voiceCall.voiceSensitivity}
        onChangeVoiceSensitivity={voiceCall.setVoiceSensitivity}
        echoCancellation={voiceCall.echoCancellation}
        onChangeEchoCancellation={voiceCall.setEchoCancellation}
        noiseSuppression={voiceCall.noiseSuppression}
        onChangeNoiseSuppression={voiceCall.setNoiseSuppression}
        advancedNoiseSuppression={voiceCall.advancedNoiseSuppression}
        onChangeAdvancedNoiseSuppression={voiceCall.setAdvancedNoiseSuppression}
        autoGainControl={voiceCall.autoGainControl}
        onChangeAutoGainControl={voiceCall.setAutoGainControl}
        isMicMonitoring={voiceCall.isMicMonitoring}
        onChangeMicMonitoring={voiceCall.setIsMicMonitoring}
        onToggleMute={voiceCall.toggleMute}
        onToggleDeafen={voiceCall.toggleDeafen}
        onToggleCamera={voiceCall.toggleCamera}
        onToggleScreenShare={() => {
          if (voiceCall.isSharingScreen) {
            void voiceCall.stopScreenShare();
          } else {
            voiceCall.setIsScreenPickerOpen(true);
          }
        }}
        onKickParticipant={voiceCall.kickParticipant}
        onHangUp={voiceCall.hangUp}
        socialFriends={socialFriends}
        roomConfig={voiceCall.roomConfig}
        onUpdateRoomPrivacy={voiceCall.updateRoomPrivacy}
        onUpdateRoomAppearance={voiceCall.updateRoomAppearance}
        notify={notify}
        remoteSpeakingStates={voiceCall.remoteSpeakingStates}
        remoteStreams={voiceCall.remoteStreams}
        remoteStatesMap={voiceCall.remoteStatesMap}
        micGain={voiceCall.micGain}
        onChangeMicGain={voiceCall.setMicGain}
        noiseGateEnabled={voiceCall.noiseGateEnabled}
        onChangeNoiseGateEnabled={voiceCall.setNoiseGateEnabled}
        onCalibrateNoise={voiceCall.calibrateNoiseFloor}
        isCalibratingNoise={voiceCall.isCalibratingNoise}
        currentNoiseFloor={voiceCall.currentNoiseFloor}
      />

      {/* Screen / Window Picker Modal */}
      <ScreenPickerModal
        isOpen={voiceCall.isScreenPickerOpen}
        onClose={() => voiceCall.setIsScreenPickerOpen(false)}
        onSelectSource={(options) => {
          void voiceCall.startScreenShare(options);
        }}
      />

      {/* Zero-latency DOM <audio autoPlay> elements for all remote streams */}
      <div style={{ display: "none" }} aria-hidden="true">
        {Array.from(
          new Map([
            ...(voiceCall.remoteStream ? [[voiceCall.session?.friendUid || "main", voiceCall.remoteStream] as const] : []),
            ...Array.from(voiceCall.remoteStreams.entries()),
          ]).entries(),
        ).map(([peerId, st]) => (
          <RemoteAudioElement
            key={`audio-stream-${peerId}-${st.id}`}
            stream={st}
            outputDeviceId={voiceCall.selectedAudioOutput}
            volume={voiceCall.isDeafened ? 0 : voiceCall.remoteVolume}
          />
        ))}
      </div>

      {/* Floating Reconnect Prompt */}
      <AnimatePresence>
        {voiceCall.pendingReconnectSession && voiceCall.callState === "idle" && (
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.95 }}
            className="fixed bottom-6 right-6 z-[9999] flex max-w-md items-center gap-3.5 rounded-2xl border border-emerald-500/30 bg-[#0d1117]/95 p-3.5 pr-4 shadow-[0_12px_40px_rgba(0,0,0,0.8)] backdrop-blur-xl"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400">
              <PhoneCall className="h-5 w-5 animate-pulse" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-white truncate">
                Chamada em andamento
              </p>
              <p className="text-[11px] text-white/60 truncate">
                Você estava em chamada com <span className="font-semibold text-emerald-300">{voiceCall.pendingReconnectSession.friendName}</span>
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void voiceCall.reconnectCall()}
                className="rounded-xl bg-emerald-500 px-3.5 py-1.5 text-xs font-bold text-black shadow-md transition hover:bg-emerald-400 active:scale-95 cursor-pointer"
              >
                Voltar
              </button>
              <button
                type="button"
                onClick={() => voiceCall.dismissReconnect()}
                className="rounded-lg p-1.5 text-white/40 hover:bg-white/10 hover:text-white transition cursor-pointer"
                title="Fechar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </VoiceCallContext.Provider>
  );
};

export const useVoiceCallContext = (): VoiceCallContextType => {
  const context = useContext(VoiceCallContext);
  if (!context) {
    throw new Error("useVoiceCallContext must be used within a VoiceCallProvider");
  }
  return context;
};
