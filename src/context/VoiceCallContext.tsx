import React, { createContext, useContext, useState, useEffect } from "react";
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


  // Persistent audio playback for remote participant with Web Audio API Soft-Limiter
  const remoteAudioRef = React.useRef<HTMLAudioElement | null>(null);
  const peerAudioNodeRef = React.useRef<any>(null);
  const audioContextRef = React.useRef<AudioContext | null>(null);

  React.useEffect(() => {
    if (voiceCall.remoteStream && voiceCall.remoteStream.getAudioTracks().length > 0) {
      const isEchoTest = voiceCall.session?.friendUid === "echo-bot";
      const isMutedLocally = voiceCall.isDeafened || isEchoTest;
      const targetVolume = isMutedLocally ? 0 : (voiceCall.remoteVolume ?? 100);

      // Keep standard audio element muted if we manage it through Web Audio API
      if (remoteAudioRef.current) {
        if (remoteAudioRef.current.srcObject !== voiceCall.remoteStream) {
          remoteAudioRef.current.srcObject = voiceCall.remoteStream;
        }
        remoteAudioRef.current.muted = true; // prevent double playback
      }

      try {
        if (!audioContextRef.current || audioContextRef.current.state === "closed") {
          audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({
            latencyHint: "interactive",
          });
        }

        if (audioContextRef.current.state === "suspended") {
          void audioContextRef.current.resume();
        }

        // Lazy load / instantiate PeerAudioNode
        if (!peerAudioNodeRef.current) {
          import("../services/audio/PeerAudioNode").then(({ PeerAudioNode }) => {
            if (audioContextRef.current && voiceCall.remoteStream) {
              peerAudioNodeRef.current = new PeerAudioNode(
                audioContextRef.current,
                voiceCall.remoteStream,
                targetVolume
              );
            }
          }).catch(() => {});
        } else {
          peerAudioNodeRef.current.setVolume(targetVolume);
        }
      } catch (err) {
        console.warn("[VoiceCallContext] Web Audio pipeline error:", err);
      }
    } else {
      if (peerAudioNodeRef.current) {
        peerAudioNodeRef.current.destroy?.();
        peerAudioNodeRef.current = null;
      }
    }

    return () => {
      // teardown handled on stream change
    };
  }, [
    voiceCall.remoteStream,
    voiceCall.isDeafened,
    voiceCall.session?.friendUid,
    voiceCall.remoteVolume,
  ]);

  // Notify in-game overlay when an incoming call arrives
  React.useEffect(() => {
    if (voiceCall.callState === "ringing-in" && voiceCall.incomingInvite) {
      if ((window as any).electronAPI?.sendOverlaySocial) {
        (window as any).electronAPI.sendOverlaySocial({
          kind: "incoming-call",
          title: "Chamada de Voz",
          subtitle: `${voiceCall.incomingInvite.callerName} está te ligando...`,
          avatar: voiceCall.incomingInvite.callerAvatar,
          message: "Abra o overlay (F8) para atender ou recusar",
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

      {/* Persistent Bottom Call Bar (visible when call is active and main window is closed) */}
      {voiceCall.callState === "active" && !voiceCall.isVoiceWindowOpen && (
        <VoiceCallBar
          session={voiceCall.session}
          duration={voiceCall.callDuration}
          isMuted={voiceCall.isMuted}
          isDeafened={voiceCall.isDeafened}
          isSpeaking={voiceCall.isSpeakingLocal || voiceCall.isSpeakingRemote}
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
        isOpen={voiceCall.isVoiceWindowOpen && (voiceCall.callState === "active" || voiceCall.callState === "connecting")}
        onClose={() => voiceCall.setIsVoiceWindowOpen(false)}
        session={voiceCall.session}
        userProfile={userProfile}
        remoteStream={voiceCall.remoteStream}
        localStream={voiceCall.localStream}
        localCameraStream={voiceCall.localCameraStream}
        localScreenStream={voiceCall.localScreenStream}
        duration={voiceCall.callDuration}
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
        notify={notify}
      />

      {/* Screen / Window Picker Modal */}
      <ScreenPickerModal
        isOpen={voiceCall.isScreenPickerOpen}
        onClose={() => voiceCall.setIsScreenPickerOpen(false)}
        onSelectSource={(options) => {
          void voiceCall.startScreenShare(options);
        }}
      />
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
