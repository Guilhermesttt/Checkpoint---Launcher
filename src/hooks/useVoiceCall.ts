import { useCallback, useEffect, useRef, useState } from "react";
import type { AuthUser } from "../auth/AuthProvider";
import type {
  CallState,
  SocialFriend,
  UserProfile,
  VoiceCallSession,
  VoiceCallParticipant,
} from "../types/domain";
import {
  type CallAnswerPayload,
  type CallEndPayload,
  type CallInvitePayload,
  type CallSignalPayload,
  type CallStatePayload,
  type CallKickPayload,
  type CallPrivacyPayload,
  type CallMemberJoinedPayload,
  type CallMemberLeftPayload,
  sendCallAnswer,
  sendCallEnd,
  sendCallInvite,
  sendCallSignal,
  sendCallState,
  sendCallKick,
  sendCallPrivacyUpdate,
  sendCallMemberJoined,
  sendCallMemberLeft,
  subscribeToCallSession,
  subscribeToUserIncomingCalls,
} from "../services/voiceCall";
import type { CallRoomConfig, RoomCategory, VoiceRoomParticipant } from "../types/voice-governance";
import { getChatId } from "../services/chat";
import { getTurnServers } from "../services/turnCredentials";
import { createVoiceRoom, joinVoiceRoom, leaveVoiceRoom } from "../services/voiceRooms";
import sfxJoin from "../sounds/Stoat_SFX/user_join_voice-DbrgaLbl.ogg";
import sfxLeave from "../sounds/Stoat_SFX/user_leave_voice-CBZjEE14.ogg";
import sfxMute from "../sounds/Stoat_SFX/mute-CuCJ24EB.ogg";
import sfxUnmute from "../sounds/Stoat_SFX/unmute-CxrIl-lz.ogg";
import sfxDeafen from "../sounds/Stoat_SFX/deafen-CCoO7jJ3.ogg";
import sfxUndeafen from "../sounds/Stoat_SFX/undeafen-HBVfWE8u.ogg";
import sfxStreamStart from "../sounds/Stoat_SFX/stream_start-C5XqRk1f.ogg";
import sfxStreamEnd from "../sounds/Stoat_SFX/stream_end-CBLpDPZy.ogg";
import sfxIncomingCall from "../sounds/Stoat_SFX/incoming_call.ogg";
import sfxFullMute from "../sounds/Stoat_SFX/full_mute.ogg";

const playSfx = (src: string, volume = 1.0) => {
  try {
    const audio = new Audio(src);
    audio.volume = volume;
    void audio.play().catch(() => {});
  } catch {
    // ignore
  }
};

export type VoiceInputMode = "voice-activity" | "push-to-talk";

export interface ScreenShareOptions {
  sourceId?: string;
  resolution?: "720p" | "1080p" | "source";
  fps?: 30 | 60;
  withAudio?: boolean;
}

interface AudioPipeline {
  ctx: AudioContext | null;
  source: MediaStreamAudioSourceNode | null;
  analyser: AnalyserNode | null;
  animFrameId: number | null;
  holdTimer: number | null;
}

const createEmptyPipeline = (): AudioPipeline => ({
  ctx: null,
  source: null,
  analyser: null,
  animFrameId: null,
  holdTimer: null,
});

const destroyAudioPipeline = (pipeline: AudioPipeline) => {
  if (pipeline.animFrameId) {
    cancelAnimationFrame(pipeline.animFrameId);
    pipeline.animFrameId = null;
  }
  if (pipeline.holdTimer) {
    window.clearTimeout(pipeline.holdTimer);
    pipeline.holdTimer = null;
  }
  if (pipeline.source) {
    try {
      pipeline.source.disconnect();
    } catch {}
    pipeline.source = null;
  }
  if (pipeline.analyser) {
    try {
      pipeline.analyser.disconnect();
    } catch {}
    pipeline.analyser = null;
  }
  if (pipeline.ctx) {
    try {
      if (pipeline.ctx.state !== "closed") {
        void pipeline.ctx.close().catch(() => {});
      }
    } catch {}
    pipeline.ctx = null;
  }
};

interface UseVoiceCallProps {
  user: AuthUser | null;
  userProfile: UserProfile | null;
  notify: (msg: string, type: "success" | "error" | "info") => void;
}

export const useVoiceCall = ({ user, userProfile, notify }: UseVoiceCallProps) => {
  const [callState, setCallState] = useState<CallState>("idle");
  const [session, setSession] = useState<VoiceCallSession | null>(null);
  const [incomingInvite, setIncomingInvite] = useState<CallInvitePayload | null>(null);

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [localCameraStream, setLocalCameraStream] = useState<MediaStream | null>(null);
  const [localScreenStream, setLocalScreenStream] = useState<MediaStream | null>(null);
  const [roomConfig, setRoomConfig] = useState<CallRoomConfig | null>(null);

  // Multi-peer Mesh streams & remote state maps
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map());
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [remoteSpeakingStates, setRemoteSpeakingStates] = useState<Map<string, boolean>>(new Map());
  const [remoteStatesMap, setRemoteStatesMap] = useState<Map<string, CallStatePayload>>(new Map());

  const [remoteVolume, setRemoteVolumeState] = useState<number>(() => {
    try {
      const saved = localStorage.getItem("checkpoint_voice_remote_volume");
      return saved !== null ? Math.max(0, Math.min(200, Number(saved))) : 100;
    } catch {
      return 100;
    }
  });

  const setRemoteVolume = useCallback((val: number) => {
    const clamped = Math.max(0, Math.min(200, Math.round(val)));
    setRemoteVolumeState(clamped);
    try {
      localStorage.setItem("checkpoint_voice_remote_volume", String(clamped));
    } catch {}
  }, []);

  const [isMuted, setIsMuted] = useState(false);
  const [isDeafened, setIsDeafened] = useState(false);
  const [isSpeakingLocal, setIsSpeakingLocal] = useState(false);
  const isSpeakingRemote = Array.from(remoteSpeakingStates.values()).some(Boolean);

  const [isRemoteMuted, setIsRemoteMuted] = useState(false);
  const [isRemoteDeafened, setIsRemoteDeafened] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [isRemoteCameraOn, setIsRemoteCameraOn] = useState(false);

  const [isSharingScreen, setIsSharingScreen] = useState(false);
  const [isRemoteSharingScreen, setIsRemoteSharingScreen] = useState(false);

  const [isScreenPickerOpen, setIsScreenPickerOpen] = useState(false);
  const [isVoiceWindowOpen, setIsVoiceWindowOpen] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [isReconnecting, setIsReconnecting] = useState(false);

  // Device lists and selection
  const [audioInputDevices, setAudioInputDevices] = useState<MediaDeviceInfo[]>([]);
  const [audioOutputDevices, setAudioOutputDevices] = useState<MediaDeviceInfo[]>([]);
  const [videoInputDevices, setVideoInputDevices] = useState<MediaDeviceInfo[]>([]);

  const [selectedAudioInput, setSelectedAudioInputState] = useState<string>(() => {
    try {
      return localStorage.getItem("checkpoint_voice_input_device") || "default";
    } catch {
      return "default";
    }
  });

  const [selectedAudioOutput, setSelectedAudioOutputState] = useState<string>(() => {
    try {
      return localStorage.getItem("checkpoint_voice_output_device") || "default";
    } catch {
      return "default";
    }
  });

  const [selectedVideoInput, setSelectedVideoInputState] = useState<string>(() => {
    try {
      return localStorage.getItem("checkpoint_voice_video_device") || "default";
    } catch {
      return "default";
    }
  });

  // Audio processing constraints & sensitivity
  const [voiceSensitivity, setVoiceSensitivityState] = useState<number>(() => {
    try {
      const saved = localStorage.getItem("checkpoint_voice_sensitivity");
      return saved ? Math.max(0, Math.min(100, Number(saved))) : 35;
    } catch {
      return 35;
    }
  });

  const [echoCancellation, setEchoCancellationState] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem("checkpoint_voice_echo_cancellation");
      return saved !== "false";
    } catch {
      return true;
    }
  });

  const [noiseSuppression, setNoiseSuppressionState] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem("checkpoint_voice_noise_suppression");
      return saved !== "false";
    } catch {
      return true;
    }
  });

  const [autoGainControl, setAutoGainControlState] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem("checkpoint_voice_auto_gain");
      return saved !== "false";
    } catch {
      return true;
    }
  });

  // Push-to-Talk settings
  const [inputMode, setInputModeState] = useState<VoiceInputMode>(() => {
    try {
      return (localStorage.getItem("checkpoint_voice_input_mode") as VoiceInputMode) || "voice-activity";
    } catch {
      return "voice-activity";
    }
  });

  const [pushToTalkKey, setPushToTalkKeyState] = useState<string>(() => {
    try {
      return localStorage.getItem("checkpoint_ptt_key") || "F8";
    } catch {
      return "F8";
    }
  });

  const [isPttPressed, setIsPttPressed] = useState(false);

  const voiceSensitivityRef = useRef(voiceSensitivity);
  voiceSensitivityRef.current = voiceSensitivity;

  const isPttPressedRef = useRef(isPttPressed);
  isPttPressedRef.current = isPttPressed;

  const inputModeRef = useRef(inputMode);
  inputModeRef.current = inputMode;

  const isMutedRef = useRef(isMuted);
  isMutedRef.current = isMuted;

  const isDeafenedRef = useRef(isDeafened);
  isDeafenedRef.current = isDeafened;

  // Microphone monitoring / sidetone
  const [isMicMonitoring, setIsMicMonitoringState] = useState<boolean>(() => {
    try {
      return localStorage.getItem("checkpoint_voice_mic_monitoring") === "true";
    } catch {
      return false;
    }
  });

  // Microphone Gain (0 - 200%, default 100%)
  const [micGain, setMicGainState] = useState<number>(() => {
    try {
      const saved = localStorage.getItem("checkpoint_voice_mic_gain");
      return saved ? Math.max(0, Math.min(200, Number(saved))) : 100;
    } catch {
      return 100;
    }
  });

  const micGainRef = useRef(micGain);
  micGainRef.current = micGain;

  const setMicGain = useCallback((val: number) => {
    const clamped = Math.max(0, Math.min(200, val));
    setMicGainState(clamped);
    micGainRef.current = clamped;
    try {
      localStorage.setItem("checkpoint_voice_mic_gain", String(clamped));
    } catch {}
  }, []);

  // Noise Gate (silencia ruído de fundo automaticamente no VAD)
  const [noiseGateEnabled, setNoiseGateEnabledState] = useState<boolean>(() => {
    try {
      return localStorage.getItem("checkpoint_voice_noise_gate") !== "false";
    } catch {
      return true;
    }
  });

  const noiseGateEnabledRef = useRef(noiseGateEnabled);
  noiseGateEnabledRef.current = noiseGateEnabled;

  const setNoiseGateEnabled = useCallback((val: boolean) => {
    setNoiseGateEnabledState(val);
    noiseGateEnabledRef.current = val;
    try {
      localStorage.setItem("checkpoint_voice_noise_gate", String(val));
    } catch {}
  }, []);

  // Calibração de Ruído Ambiente
  const [isCalibratingNoise, setIsCalibratingNoise] = useState(false);
  const [currentNoiseFloor, setCurrentNoiseFloor] = useState<number>(() => {
    try {
      const saved = localStorage.getItem("checkpoint_voice_noise_floor");
      return saved ? Number(saved) : 5;
    } catch {
      return 5;
    }
  });

  // Diagnóstico de erro de dispositivo
  const [deviceError, setDeviceError] = useState<string | null>(null);
  const clearDeviceError = useCallback(() => setDeviceError(null), []);

  const micMonitoringPipelineRef = useRef<{
    ctx: AudioContext | null;
    source: MediaStreamAudioSourceNode | null;
    gain: GainNode | null;
  }>({ ctx: null, source: null, gain: null });

  const stopMicMonitoring = useCallback(() => {
    if (micMonitoringPipelineRef.current.source) {
      try {
        micMonitoringPipelineRef.current.source.disconnect();
      } catch {}
      micMonitoringPipelineRef.current.source = null;
    }
    if (micMonitoringPipelineRef.current.gain) {
      try {
        micMonitoringPipelineRef.current.gain.disconnect();
      } catch {}
      micMonitoringPipelineRef.current.gain = null;
    }
    if (micMonitoringPipelineRef.current.ctx) {
      try {
        if (micMonitoringPipelineRef.current.ctx.state !== "closed") {
          void micMonitoringPipelineRef.current.ctx.close().catch(() => {});
        }
      } catch {}
      micMonitoringPipelineRef.current.ctx = null;
    }
  }, []);

  const startMicMonitoring = useCallback((stream: MediaStream) => {
    stopMicMonitoring();
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const source = ctx.createMediaStreamSource(stream);
      const gain = ctx.createGain();
      gain.gain.value = 0.85;
      source.connect(gain);
      gain.connect(ctx.destination);
      micMonitoringPipelineRef.current = { ctx, source, gain };
    } catch (err) {
      console.warn("[useVoiceCall] startMicMonitoring failed:", err);
    }
  }, [stopMicMonitoring]);

  const setIsMicMonitoring = useCallback(
    (val: boolean) => {
      setIsMicMonitoringState(val);
      try {
        localStorage.setItem("checkpoint_voice_mic_monitoring", String(val));
      } catch {}
      if (!val) {
        stopMicMonitoring();
      } else if (localStreamRef.current) {
        startMicMonitoring(localStreamRef.current);
      }
    },
    [startMicMonitoring, stopMicMonitoring],
  );

  // Multi-peer Mesh Refs
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const remoteStreamsRef = useRef<Map<string, MediaStream>>(new Map());
  const remotePipelinesRef = useRef<Map<string, AudioPipeline>>(new Map());
  const pendingCandidatesRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());

  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const sessionRef = useRef<VoiceCallSession | null>(null);
  sessionRef.current = session;
  const callStateRef = useRef<CallState>(callState);
  callStateRef.current = callState;

  // Local audio analyzer pipeline
  const localPipelineRef = useRef<AudioPipeline>(createEmptyPipeline());

  const unsubscribeSessionRef = useRef<(() => void) | null>(null);
  const callDurationTimerRef = useRef<number | null>(null);
  const ringoutTimerRef = useRef<number | null>(null);
  const audioRingIntervalRef = useRef<number | null>(null);
  const pttReleaseTimeoutRef = useRef<number | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimerRef = useRef<number | null>(null);
  const isAcquiringMediaRef = useRef(false);

  // Sync mic monitoring with local stream
  useEffect(() => {
    if (isMicMonitoring && localStream) {
      startMicMonitoring(localStream);
    } else {
      stopMicMonitoring();
    }
  }, [isMicMonitoring, localStream, startMicMonitoring, stopMicMonitoring]);

  // VAD Engine Setup with RMS and 250ms Hold Timer per peer/stream
  const setupVoiceAnalyzer = useCallback(
    (stream: MediaStream, isLocal: boolean, peerId = "local") => {
      let targetPipeline: AudioPipeline;
      if (isLocal) {
        destroyAudioPipeline(localPipelineRef.current);
        localPipelineRef.current = createEmptyPipeline();
        targetPipeline = localPipelineRef.current;
      } else {
        const existing = remotePipelinesRef.current.get(peerId);
        if (existing) {
          destroyAudioPipeline(existing);
        }
        targetPipeline = createEmptyPipeline();
        remotePipelinesRef.current.set(peerId, targetPipeline);
      }

      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioCtx) return;

        const ctx = new AudioCtx();
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 512;
        analyser.smoothingTimeConstant = 0.15;
        source.connect(analyser);

        targetPipeline.ctx = ctx;
        targetPipeline.source = source;
        targetPipeline.analyser = analyser;

        const timeData = new Float32Array(analyser.fftSize);
        let currentlySpeaking = false;

        const checkVolume = () => {
          if (!targetPipeline.analyser || !targetPipeline.ctx) return;
          if (targetPipeline.ctx.state === "suspended") {
            void targetPipeline.ctx.resume().catch(() => {});
          }

          analyser.getFloatTimeDomainData(timeData);

          let sumSquares = 0;
          for (let i = 0; i < timeData.length; i += 1) {
            sumSquares += timeData[i] * timeData[i];
          }
          const rms = Math.sqrt(sumSquares / timeData.length);
          const gainMultiplier = (isLocal ? micGainRef.current : 100) / 100;
          const rawVolume = Math.min(100, Math.round(rms * 700 * gainMultiplier));

          const sens = Math.max(0, Math.min(100, voiceSensitivityRef.current));
          const sensitivityThreshold = Math.max(1, Math.round(1 + 29 * Math.pow((100 - sens) / 100, 1.8)));

          const isPtt = inputModeRef.current === "push-to-talk";
          const isPttActive = isPttPressedRef.current;

          const isAboveThreshold = isLocal && isPtt
            ? isPttActive && rawVolume >= 1
            : rawVolume >= sensitivityThreshold;

          if (isAboveThreshold) {
            if (targetPipeline.holdTimer) {
              window.clearTimeout(targetPipeline.holdTimer);
              targetPipeline.holdTimer = null;
            }
            if (isLocal && !isMutedRef.current && !isDeafenedRef.current) {
              const track = localStreamRef.current?.getAudioTracks()[0];
              if (track && !track.enabled) {
                track.enabled = true;
              }
            }
            if (!currentlySpeaking) {
              currentlySpeaking = true;
              if (isLocal) {
                setIsSpeakingLocal(true);
                if (sessionRef.current?.chatId && user?.uid) {
                  void sendCallState(sessionRef.current.chatId, {
                    senderId: user.uid,
                    chatId: sessionRef.current.chatId,
                    isSpeaking: true,
                  });
                }
              } else {
                setRemoteSpeakingStates((prev) => {
                  const updated = new Map(prev);
                  updated.set(peerId, true);
                  return updated;
                });
              }
            }
          } else if (currentlySpeaking && !targetPipeline.holdTimer) {
            targetPipeline.holdTimer = window.setTimeout(() => {
              currentlySpeaking = false;
              targetPipeline.holdTimer = null;
              if (isLocal) {
                setIsSpeakingLocal(false);
                // Se o Noise Gate estiver ativo ou em PTT, corta o áudio durante o silêncio
                if (noiseGateEnabledRef.current || inputModeRef.current === "voice-activity" || inputModeRef.current === "push-to-talk") {
                  const track = localStreamRef.current?.getAudioTracks()[0];
                  if (track) {
                    track.enabled = false;
                  }
                }
                if (sessionRef.current?.chatId && user?.uid) {
                  void sendCallState(sessionRef.current.chatId, {
                    senderId: user.uid,
                    chatId: sessionRef.current.chatId,
                    isSpeaking: false,
                  });
                }
              } else {
                setRemoteSpeakingStates((prev) => {
                  const updated = new Map(prev);
                  updated.set(peerId, false);
                  return updated;
                });
              }
            }, 250);
          }

          targetPipeline.animFrameId = requestAnimationFrame(checkVolume);
        };

        targetPipeline.animFrameId = requestAnimationFrame(checkVolume);
      } catch (err) {
        console.warn("[useVoiceCall] setupVoiceAnalyzer failed:", err);
      }
    },
    [user?.uid],
  );

  // Auto-sync analyzers when localStream changes
  useEffect(() => {
    if (localStream) {
      setupVoiceAnalyzer(localStream, true);
    } else {
      destroyAudioPipeline(localPipelineRef.current);
      setIsSpeakingLocal(false);
    }
  }, [localStream, setupVoiceAnalyzer]);

  // Dynamic Audio Constraints Applier
  const applyAudioProcessingConstraints = useCallback(
    async (newEcho: boolean, newNoise: boolean, newAutoGain: boolean) => {
      if (!localStreamRef.current) return;
      const track = localStreamRef.current.getAudioTracks()[0];
      if (!track) return;

      try {
        await track.applyConstraints({
          echoCancellation: newEcho ? { ideal: true } : false,
          noiseSuppression: newNoise ? { ideal: true } : false,
          autoGainControl: newAutoGain ? { ideal: true } : false,
        });
      } catch (err) {
        console.warn("[useVoiceCall] track.applyConstraints fallback:", err);
        try {
          const currentDeviceId = selectedAudioInput !== "default" ? selectedAudioInput : undefined;
          const newStream = await navigator.mediaDevices.getUserMedia({
            audio: {
              deviceId: currentDeviceId ? { exact: currentDeviceId } : undefined,
              echoCancellation: newEcho ? { ideal: true } : false,
              noiseSuppression: newNoise ? { ideal: true } : false,
              autoGainControl: newAutoGain ? { ideal: true } : false,
              channelCount: { ideal: 1 },
              sampleRate: { ideal: 48000 },
              sampleSize: { ideal: 16 },
            },
            video: false,
          });

          const newTrack = newStream.getAudioTracks()[0];
          if (newTrack) {
            newTrack.enabled = !isMutedRef.current && !isDeafenedRef.current;
            // Replace track across all active peers in Mesh
            peerConnectionsRef.current.forEach((pc) => {
              const sender = pc.getSenders().find((s) => s.track?.kind === "audio");
              if (sender) {
                void sender.replaceTrack(newTrack);
              }
            });
            track.stop();
            localStreamRef.current = newStream;
            setLocalStream(newStream);
            setupVoiceAnalyzer(newStream, true);
          }
        } catch (fallbackErr) {
          console.error("[useVoiceCall] Audio stream re-acquisition failed:", fallbackErr);
        }
      }
    },
    [selectedAudioInput, setupVoiceAnalyzer],
  );

  // Settings setters
  const setVoiceSensitivity = useCallback((val: number) => {
    const clamped = Math.max(0, Math.min(100, val));
    setVoiceSensitivityState(clamped);
    voiceSensitivityRef.current = clamped;
    try {
      localStorage.setItem("checkpoint_voice_sensitivity", String(clamped));
    } catch {}
  }, []);

  const setEchoCancellation = useCallback((val: boolean) => {
    setEchoCancellationState(val);
    try {
      localStorage.setItem("checkpoint_voice_echo_cancellation", String(val));
    } catch {}
    void applyAudioProcessingConstraints(val, noiseSuppression, autoGainControl);
  }, [applyAudioProcessingConstraints, autoGainControl, noiseSuppression]);

  const setNoiseSuppression = useCallback((val: boolean) => {
    setNoiseSuppressionState(val);
    try {
      localStorage.setItem("checkpoint_voice_noise_suppression", String(val));
    } catch {}
    void applyAudioProcessingConstraints(echoCancellation, val, autoGainControl);
  }, [applyAudioProcessingConstraints, autoGainControl, echoCancellation]);

  const setAutoGainControl = useCallback((val: boolean) => {
    setAutoGainControlState(val);
    try {
      localStorage.setItem("checkpoint_voice_auto_gain", String(val));
    } catch {}
    void applyAudioProcessingConstraints(echoCancellation, noiseSuppression, val);
  }, [applyAudioProcessingConstraints, echoCancellation, noiseSuppression]);

  // Audio acquisition helper com diagnóstico de erros específicos
  const acquireAudioStream = useCallback(
    async (deviceId?: string): Promise<MediaStream | null> => {
      if (!navigator?.mediaDevices?.getUserMedia) return null;
      isAcquiringMediaRef.current = true;
      const targetDeviceId = deviceId || (selectedAudioInput !== "default" ? selectedAudioInput : undefined);

      const constraints: MediaStreamConstraints = {
        audio: {
          deviceId: targetDeviceId ? { exact: targetDeviceId } : undefined,
          echoCancellation: echoCancellation ? { ideal: true } : false,
          noiseSuppression: noiseSuppression ? { ideal: true } : false,
          autoGainControl: autoGainControl ? { ideal: true } : false,
          channelCount: { ideal: 1 },
          sampleRate: { ideal: 48000 },
          sampleSize: { ideal: 16 },
        },
        video: false,
      };

      try {
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        setDeviceError(null);
        isAcquiringMediaRef.current = false;
        return stream;
      } catch (err: any) {
        console.warn("[useVoiceCall] getUserMedia primary failed:", err);
        let errorMsg = "Erro ao acessar o microfone.";
        if (err?.name === "NotAllowedError" || err?.name === "PermissionDeniedError") {
          errorMsg = "Permissão de microfone negada. Verifique as configurações de privacidade do Windows.";
        } else if (err?.name === "NotFoundError" || err?.name === "DevicesNotFoundError") {
          errorMsg = "Nenhum microfone encontrado. Conecte um microfone e tente novamente.";
        } else if (err?.name === "NotReadableError" || err?.name === "TrackStartError") {
          errorMsg = "O microfone está em uso exclusivo por outro aplicativo (ex: Discord, OBS) ou o driver travou.";
        } else if (err?.name === "OverconstrainedError") {
          errorMsg = "As configurações de áudio solicitadas não são suportadas pelo driver.";
        }
        setDeviceError(errorMsg);
        notify(errorMsg, "error");

        // Fallback genérico com constraints relaxadas
        try {
          const fallbackStream = await navigator.mediaDevices.getUserMedia({
            audio: targetDeviceId ? { deviceId: { ideal: targetDeviceId } } : true,
            video: false,
          });
          setDeviceError(null);
          isAcquiringMediaRef.current = false;
          notify("Microfone iniciado em modo de compatibilidade básica.", "info");
          return fallbackStream;
        } catch {
          isAcquiringMediaRef.current = false;
          return null;
        }
      }
    },
    [autoGainControl, echoCancellation, noiseSuppression, notify, selectedAudioInput],
  );

  // Device Switchers com salvamento de label
  const changeAudioInputDevice = useCallback(
    async (deviceId: string) => {
      setSelectedAudioInputState(deviceId);
      try {
        localStorage.setItem("checkpoint_voice_input_device", deviceId);
        const deviceObj = audioInputDevices.find((d) => d.deviceId === deviceId);
        if (deviceObj?.label) {
          localStorage.setItem("checkpoint_voice_input_device_label", deviceObj.label);
        }
      } catch {}

      if (callState === "idle") return;

      try {
        const newStream = await acquireAudioStream(deviceId);
        if (!newStream) return;

        const newTrack = newStream.getAudioTracks()[0];
        if (!newTrack) return;

        if (inputMode === "push-to-talk" && !isPttPressed) {
          newTrack.enabled = false;
        } else if (isMuted || isDeafened) {
          newTrack.enabled = false;
        }

        // Replace track across all peers in Mesh
        peerConnectionsRef.current.forEach((pc) => {
          const sender = pc.getSenders().find((s) => s.track?.kind === "audio");
          if (sender) {
            void sender.replaceTrack(newTrack);
          }
        });

        if (localStreamRef.current) {
          localStreamRef.current.getAudioTracks().forEach((t) => t.stop());
        }

        localStreamRef.current = newStream;
        setLocalStream(newStream);
        setupVoiceAnalyzer(newStream, true);
        notify("Dispositivo de microfone alterado.", "info");
      } catch (err) {
        console.error("[useVoiceCall] changeAudioInputDevice error:", err);
        notify("Erro ao trocar de microfone.", "error");
      }
    },
    [acquireAudioStream, audioInputDevices, callState, inputMode, isDeafened, isMuted, isPttPressed, notify, setupVoiceAnalyzer],
  );

  const changeAudioOutputDevice = useCallback(
    async (deviceId: string) => {
      setSelectedAudioOutputState(deviceId);
      try {
        localStorage.setItem("checkpoint_voice_output_device", deviceId);
      } catch {}
      notify("Dispositivo de saída alterado.", "info");
    },
    [notify],
  );

  // Enumerate connected devices with Label persistence
  const refreshDevices = useCallback(async () => {
    if (!navigator?.mediaDevices?.enumerateDevices) return;
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const inputs = devices.filter((d) => d.kind === "audioinput");
      const outputs = devices.filter((d) => d.kind === "audiooutput");
      const videos = devices.filter((d) => d.kind === "videoinput");

      setAudioInputDevices(inputs);
      setAudioOutputDevices(outputs);
      setVideoInputDevices(videos);

      setSelectedAudioInputState((prev) => {
        if (prev === "default") return "default";
        const exists = inputs.some((d) => d.deviceId === prev);
        if (!exists) {
          // Tenta encontrar o microfone pelo label salvo se mudou de porta USB
          try {
            const savedLabel = localStorage.getItem("checkpoint_voice_input_device_label");
            if (savedLabel) {
              const matched = inputs.find((d) => d.label === savedLabel);
              if (matched) return matched.deviceId;
            }
          } catch {}
          return "default";
        }
        return prev;
      });

      setSelectedAudioOutputState((prev) => {
        if (prev === "default") return "default";
        const exists = outputs.some((d) => d.deviceId === prev);
        return exists ? prev : "default";
      });

      setSelectedVideoInputState((prev) => {
        if (prev === "default") return "default";
        const exists = videos.some((d) => d.deviceId === prev);
        return exists ? prev : "default";
      });
    } catch (err) {
      console.warn("[useVoiceCall] enumerateDevices failed:", err);
    }
  }, []);

  useEffect(() => {
    void refreshDevices();
    if (navigator?.mediaDevices?.addEventListener) {
      navigator.mediaDevices.addEventListener("devicechange", refreshDevices);
      return () => {
        navigator.mediaDevices.removeEventListener("devicechange", refreshDevices);
      };
    }
  }, [refreshDevices]);

  // Hot-Swap e Auto-Fallback quando o microfone é desconectado no meio de uma chamada
  useEffect(() => {
    if (callState === "idle" || !localStreamRef.current) return;
    const currentTrack = localStreamRef.current.getAudioTracks()[0];
    if (!currentTrack) return;

    const handleTrackEnded = () => {
      console.warn("[useVoiceCall] Audio track ended unexpectedly! Falling back to default device...");
      notify("Microfone desconectado. Alternando automaticamente para o dispositivo padrão...", "info");
      setSelectedAudioInputState("default");
      try {
        localStorage.setItem("checkpoint_voice_input_device", "default");
      } catch {}
      void changeAudioInputDevice("default");
    };

    currentTrack.addEventListener("ended", handleTrackEnded);
    return () => {
      currentTrack.removeEventListener("ended", handleTrackEnded);
    };
  }, [callState, changeAudioInputDevice, notify]);

  const changeVideoInputDevice = useCallback(
    async (deviceId: string) => {
      setSelectedVideoInputState(deviceId);
      try {
        localStorage.setItem("checkpoint_voice_video_device", deviceId);
      } catch {}

      if (!isCameraOn || callState === "idle") return;

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            deviceId: deviceId !== "default" ? { exact: deviceId } : undefined,
            width: { ideal: 640 },
            height: { ideal: 480 },
            frameRate: { ideal: 30 },
          },
          audio: false,
        });

        const newVideoTrack = stream.getVideoTracks()[0];
        if (!newVideoTrack) return;

        if (cameraStreamRef.current) {
          cameraStreamRef.current.getVideoTracks().forEach((t) => t.stop());
        }
        cameraStreamRef.current = stream;
        setLocalCameraStream(stream);

        if (sessionRef.current?.friendUid === "echo-bot") {
          setRemoteStream(stream);
          return;
        }

        peerConnectionsRef.current.forEach((pc) => {
          const sender = pc.getSenders().find((s) => s.track?.kind === "video");
          if (sender) {
            void sender.replaceTrack(newVideoTrack);
          }
        });

        notify("Câmera alterada.", "info");
      } catch (err) {
        console.error("[useVoiceCall] changeVideoInputDevice error:", err);
        notify("Erro ao trocar de câmera.", "error");
      }
    },
    [callState, isCameraOn, notify],
  );

  const setInputMode = useCallback(
    (mode: VoiceInputMode) => {
      setInputModeState(mode);
      try {
        localStorage.setItem("checkpoint_voice_input_mode", mode);
      } catch {}
      if (localStreamRef.current) {
        const track = localStreamRef.current.getAudioTracks()[0];
        if (track) {
          track.enabled = mode === "voice-activity" && !isMuted && !isDeafened;
        }
      }
    },
    [isDeafened, isMuted],
  );

  const setPushToTalkKey = useCallback((key: string) => {
    setPushToTalkKeyState(key);
    try {
      localStorage.setItem("checkpoint_ptt_key", key);
    } catch {}
  }, []);

  // Global PTT shortcut registration with Electron
  useEffect(() => {
    if (inputMode === "push-to-talk" && pushToTalkKey) {
      window.electronAPI?.registerPushToTalk?.(pushToTalkKey).catch(console.error);
    } else {
      window.electronAPI?.unregisterPushToTalk?.().catch(console.error);
    }
    return () => {
      window.electronAPI?.unregisterPushToTalk?.().catch(console.error);
    };
  }, [inputMode, pushToTalkKey]);

  // PTT handlers
  const handlePttDown = useCallback(() => {
    if (pttReleaseTimeoutRef.current) {
      window.clearTimeout(pttReleaseTimeoutRef.current);
      pttReleaseTimeoutRef.current = null;
    }
    setIsPttPressed(true);
    if (localStreamRef.current && !isMuted && !isDeafened) {
      const track = localStreamRef.current.getAudioTracks()[0];
      if (track) track.enabled = true;
    }
  }, [isDeafened, isMuted]);

  const handlePttUp = useCallback(() => {
    setIsPttPressed(false);
    if (pttReleaseTimeoutRef.current) window.clearTimeout(pttReleaseTimeoutRef.current);
    pttReleaseTimeoutRef.current = window.setTimeout(() => {
      if (inputMode === "push-to-talk" && localStreamRef.current) {
        const track = localStreamRef.current.getAudioTracks()[0];
        if (track) track.enabled = false;
      }
    }, 150);
  }, [inputMode]);

  // Global IPC PTT events
  useEffect(() => {
    if (inputMode !== "push-to-talk") return;
    const unsubPress = window.electronAPI?.onPttPress?.(() => {
      handlePttDown();
    });
    const unsubRelease = window.electronAPI?.onPttRelease?.(() => {
      handlePttUp();
    });
    return () => {
      unsubPress?.();
      unsubRelease?.();
    };
  }, [handlePttDown, handlePttUp, inputMode]);

  // Local window PTT keyboard events (com proteção de foco para inputs/textareas)
  useEffect(() => {
    if (inputMode !== "push-to-talk") return;

    const isInputField = (el: EventTarget | null) => {
      if (!el || !(el instanceof HTMLElement)) return false;
      return (
        el.tagName === "INPUT" ||
        el.tagName === "TEXTAREA" ||
        el.isContentEditable ||
        el.getAttribute("role") === "textbox"
      );
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (isInputField(e.target)) return; // Ignora se o usuário estiver digitando

      if (
        e.key.toUpperCase() === pushToTalkKey.toUpperCase() ||
        e.code.toUpperCase() === pushToTalkKey.toUpperCase()
      ) {
        handlePttDown();
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (isInputField(e.target)) return;

      if (
        e.key.toUpperCase() === pushToTalkKey.toUpperCase() ||
        e.code.toUpperCase() === pushToTalkKey.toUpperCase()
      ) {
        handlePttUp();
        window.electronAPI?.sendPttRelease?.();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [handlePttDown, handlePttUp, inputMode, pushToTalkKey]);

  // SFX sounds
  const playRingtone = useCallback((type: "call" | "ringout" | "connect" | "disconnect") => {
    switch (type) {
      case "connect":
        playSfx(sfxJoin);
        break;
      case "disconnect":
        playSfx(sfxLeave);
        break;
      case "call":
        playSfx(sfxIncomingCall);
        break;
      case "ringout":
        playSfx(sfxJoin, 0.5);
        break;
    }
  }, []);

  // Complete Cleanup Helper (Full Mesh P2P, AudioPipelines, Timers, Media Streams)
  const cleanUpCall = useCallback(() => {
    if (callDurationTimerRef.current) {
      window.clearInterval(callDurationTimerRef.current);
      callDurationTimerRef.current = null;
    }
    if (ringoutTimerRef.current) {
      window.clearTimeout(ringoutTimerRef.current);
      ringoutTimerRef.current = null;
    }
    if (audioRingIntervalRef.current) {
      window.clearInterval(audioRingIntervalRef.current);
      audioRingIntervalRef.current = null;
    }
    if (reconnectTimerRef.current) {
      window.clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    reconnectAttemptsRef.current = 0;
    setIsReconnecting(false);

    // Destroy local audio pipeline
    destroyAudioPipeline(localPipelineRef.current);

    // Destroy all remote audio pipelines
    remotePipelinesRef.current.forEach((pipeline) => destroyAudioPipeline(pipeline));
    remotePipelinesRef.current.clear();
    setRemoteSpeakingStates(new Map());
    setRemoteStatesMap(new Map());

    // Stop local media tracks
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((track) => track.stop());
      screenStreamRef.current = null;
    }
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach((track) => track.stop());
      cameraStreamRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }

    // Close all WebRTC PeerConnections in Mesh
    peerConnectionsRef.current.forEach((pc) => {
      try {
        pc.close();
      } catch {}
    });
    peerConnectionsRef.current.clear();
    remoteStreamsRef.current.clear();
    pendingCandidatesRef.current.clear();

    if (unsubscribeSessionRef.current) {
      unsubscribeSessionRef.current();
      unsubscribeSessionRef.current = null;
    }

    // Se estiver em uma sala persistente, registra a saída no backend
    if (sessionRef.current?.chatId && /^[0-9a-f-]{36}$/i.test(sessionRef.current.chatId)) {
      void leaveVoiceRoom(sessionRef.current.chatId);
    }

    setLocalStream(null);
    setRemoteStreams(new Map());
    setRemoteStream(null);
    setLocalCameraStream(null);
    setLocalScreenStream(null);
    setIsSharingScreen(false);
    setIsRemoteSharingScreen(false);
    setIsCameraOn(false);
    setIsRemoteCameraOn(false);
    setIsRemoteMuted(false);
    setIsRemoteDeafened(false);
    setIsMuted(false);
    setIsDeafened(false);
    setIsSpeakingLocal(false);
    setCallState("idle");
    setSession(null);
    setRoomConfig(null);
    setIncomingInvite(null);
    setCallDuration(0);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanUpCall();
    };
  }, [cleanUpCall]);

  // Create & setup a PeerConnection for a specific peer in the Full Mesh
  const createPeerConnectionForPeer = useCallback(
    async (chatId: string, targetPeerUid: string, isInitiator: boolean) => {
      const existing = peerConnectionsRef.current.get(targetPeerUid);
      if (existing && existing.signalingState !== "closed") {
        return existing;
      }

      const iceServers = await getTurnServers();
      const pc = new RTCPeerConnection({
        iceServers,
        iceCandidatePoolSize: 2,
        bundlePolicy: "max-bundle",
      });

      peerConnectionsRef.current.set(targetPeerUid, pc);

      // Attach local tracks
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => pc.addTrack(track, localStreamRef.current!));
      }
      if (cameraStreamRef.current) {
        cameraStreamRef.current.getTracks().forEach((track) => pc.addTrack(track, cameraStreamRef.current!));
      }
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach((track) => pc.addTrack(track, screenStreamRef.current!));
      }

      pc.onicecandidate = (event) => {
        if (event.candidate && user?.uid) {
          void sendCallSignal(chatId, {
            senderId: user.uid,
            chatId,
            targetUid: targetPeerUid,
            signal: { candidate: event.candidate.toJSON() },
          });
        }
      };

      pc.ontrack = (event) => {
        if (event.streams && event.streams[0]) {
          const stream = event.streams[0];
          remoteStreamsRef.current.set(targetPeerUid, stream);
          setRemoteStreams(new Map(remoteStreamsRef.current));
          setRemoteStream(stream); // Fallback for 1:1

          setupVoiceAnalyzer(stream, false, targetPeerUid);

          const hasVideo = stream.getVideoTracks().some((t) => t.enabled);
          setIsRemoteSharingScreen(hasVideo);

          stream.onaddtrack = () => {
            setRemoteStreams(new Map(remoteStreamsRef.current));
            setIsRemoteSharingScreen(stream.getVideoTracks().length > 0);
          };
          stream.onremovetrack = () => {
            setRemoteStreams(new Map(remoteStreamsRef.current));
            setIsRemoteSharingScreen(stream.getVideoTracks().length > 0);
          };
        }
      };

      // Reconnection helper for this peer
      const attemptPeerReconnect = async () => {
        if (!pc || pc.signalingState === "closed") return;
        if (reconnectAttemptsRef.current >= 3) {
          notify("Conexão perdida com participante.", "error");
          return;
        }
        reconnectAttemptsRef.current += 1;
        setIsReconnecting(true);

        try {
          if (isInitiator) {
            const offer = await pc.createOffer({ iceRestart: true });
            await pc.setLocalDescription(offer);
            if (user?.uid) {
              await sendCallSignal(chatId, {
                senderId: user.uid,
                chatId,
                targetUid: targetPeerUid,
                signal: offer,
              });
            }
          }
        } catch (err) {
          console.error("[useVoiceCall] ICE restart error for peer:", targetPeerUid, err);
        }
      };

      pc.oniceconnectionstatechange = () => {
        if (pc.iceConnectionState === "disconnected") {
          if (reconnectTimerRef.current) window.clearTimeout(reconnectTimerRef.current);
          reconnectTimerRef.current = window.setTimeout(() => {
            if (pc.iceConnectionState === "disconnected" || pc.iceConnectionState === "failed") {
              void attemptPeerReconnect();
            }
          }, 3500);
        } else if (pc.iceConnectionState === "failed") {
          void attemptPeerReconnect();
        } else if (pc.iceConnectionState === "connected" || pc.iceConnectionState === "completed") {
          if (reconnectTimerRef.current) {
            window.clearTimeout(reconnectTimerRef.current);
            reconnectTimerRef.current = null;
          }
          reconnectAttemptsRef.current = 0;
          setIsReconnecting(false);
        }
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "connected") {
          setCallState("active");
          setIsVoiceWindowOpen(true);
          setIsReconnecting(false);
          reconnectAttemptsRef.current = 0;
          playRingtone("connect");
          if (!callDurationTimerRef.current) {
            callDurationTimerRef.current = window.setInterval(() => {
              setCallDuration((prev) => prev + 1);
            }, 1000);
          }
        } else if (pc.connectionState === "failed") {
          void attemptPeerReconnect();
        }
      };

      return pc;
    },
    [notify, playRingtone, setupVoiceAnalyzer, user?.uid],
  );

  // Unified Session Handlers Builder (Elimina duplicação e aplica autorização estrita)
  const createUnifiedSessionHandlers = useCallback(
    (chatId: string) => ({
      onAnswer: async (answerPayload: CallAnswerPayload) => {
        if (answerPayload.accepted) {
          setCallState("connecting");
          if (audioRingIntervalRef.current) {
            clearInterval(audioRingIntervalRef.current);
            audioRingIntervalRef.current = null;
          }
        } else {
          notify("O usuário recusou a chamada.", "info");
          playRingtone("disconnect");
          cleanUpCall();
        }
      },
      onSignal: async ({ senderId, signal }: CallSignalPayload) => {
        if (!senderId || !signal) return;
        const pc = peerConnectionsRef.current.get(senderId) || (await createPeerConnectionForPeer(chatId, senderId, false));

        if ("sdp" in signal && signal.type) {
          const sdpInit = signal as RTCSessionDescriptionInit;
          if (["offer", "answer", "pranswer", "rollback"].includes(sdpInit.type) && pc.signalingState !== "closed") {
            await pc.setRemoteDescription(new RTCSessionDescription(sdpInit));

            // Flush pending ICE candidates for this peer
            const pending = pendingCandidatesRef.current.get(senderId) || [];
            for (const cand of pending) {
              try {
                await pc.addIceCandidate(new RTCIceCandidate(cand));
              } catch {}
            }
            pendingCandidatesRef.current.delete(senderId);

            if (sdpInit.type === "offer") {
              const answer = await pc.createAnswer();
              await pc.setLocalDescription(answer);
              if (user?.uid) {
                await sendCallSignal(chatId, {
                  senderId: user.uid,
                  chatId,
                  targetUid: senderId,
                  signal: answer,
                });
              }
            }
          }
        } else if ("candidate" in signal && (signal as any).candidate) {
          const cand = (signal as any).candidate;
          if (pc.remoteDescription) {
            try {
              await pc.addIceCandidate(new RTCIceCandidate(cand));
            } catch {}
          } else {
            const list = pendingCandidatesRef.current.get(senderId) || [];
            list.push(cand);
            pendingCandidatesRef.current.set(senderId, list);
          }
        }
      },
      onState: (remoteState: CallStatePayload) => {
        setRemoteStatesMap((prev) => {
          const updated = new Map(prev);
          updated.set(remoteState.senderId, remoteState);
          return updated;
        });

        if (typeof remoteState.isSpeaking === "boolean") {
          setRemoteSpeakingStates((prev) => {
            const updated = new Map(prev);
            updated.set(remoteState.senderId, remoteState.isSpeaking!);
            return updated;
          });
        }
        if (typeof remoteState.isMuted === "boolean") {
          setIsRemoteMuted(remoteState.isMuted);
        }
        if (typeof remoteState.isDeafened === "boolean") {
          setIsRemoteDeafened(remoteState.isDeafened);
        }
        if (typeof remoteState.isCameraOn === "boolean") {
          setIsRemoteCameraOn(remoteState.isCameraOn);
        }
        if (typeof remoteState.isSharingScreen === "boolean") {
          setIsRemoteSharingScreen((prev) => {
            if (prev !== remoteState.isSharingScreen) {
              playSfx(remoteState.isSharingScreen ? sfxStreamStart : sfxStreamEnd);
            }
            return Boolean(remoteState.isSharingScreen);
          });
        }
      },
      onMemberJoined: async (joined: CallMemberJoinedPayload) => {
        notify(`${joined.name} entrou na sala.`, "info");
        playRingtone("connect");

        // Se já estivermos na chamada, iniciamos a conexão Mesh para o novo participante
        if (user?.uid && joined.uid !== user.uid) {
          const pc = await createPeerConnectionForPeer(chatId, joined.uid, true);
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          await sendCallSignal(chatId, {
            senderId: user.uid,
            chatId,
            targetUid: joined.uid,
            signal: offer,
          });
        }
      },
      onMemberLeft: (left: CallMemberLeftPayload) => {
        const pc = peerConnectionsRef.current.get(left.uid);
        if (pc) {
          try {
            pc.close();
          } catch {}
          peerConnectionsRef.current.delete(left.uid);
        }
        remoteStreamsRef.current.delete(left.uid);
        setRemoteStreams(new Map(remoteStreamsRef.current));

        const pipeline = remotePipelinesRef.current.get(left.uid);
        if (pipeline) {
          destroyAudioPipeline(pipeline);
          remotePipelinesRef.current.delete(left.uid);
        }

        setRemoteSpeakingStates((prev) => {
          const updated = new Map(prev);
          updated.delete(left.uid);
          return updated;
        });

        notify("Um participante saiu da sala.", "info");
        playRingtone("disconnect");
      },
      onKicked: (kick: CallKickPayload) => {
        // Validação de autorização: apenas aceita kick se vier do host registrado
        const currentHost = sessionRef.current?.hostUid || (sessionRef.current?.isInitiator ? user?.uid : sessionRef.current?.friendUid);
        if (kick.adminId === currentHost || !currentHost) {
          notify(kick.reason || "Você foi expulso da sala pelo administrador.", "error");
          playRingtone("disconnect");
          cleanUpCall();
        }
      },
      onPrivacy: (privacy: CallPrivacyPayload) => {
        setRoomConfig((prev) => ({
          roomName: privacy.roomName || prev?.roomName || "Canal de Voz",
          category: privacy.category || prev?.category || "resenha_games",
          isPrivate: privacy.isPrivate,
          password: privacy.password,
        }));
        setSession((prev) =>
          prev
            ? {
                ...prev,
                isPrivate: privacy.isPrivate,
                password: privacy.password,
                category: privacy.category || prev.category,
                roomName: privacy.roomName || prev.roomName,
              }
            : null,
        );
        notify(
          privacy.isPrivate ? "🔒 A sala agora é privada." : "🔓 A sala agora é pública.",
          "info",
        );
      },
      onEnd: (endPayload: CallEndPayload) => {
        notify(
          endPayload.reason === "busy"
            ? "O usuário está em outra chamada."
            : "Chamada encerrada.",
          "info",
        );
        playRingtone("disconnect");
        cleanUpCall();
      },
    }),
    [cleanUpCall, createPeerConnectionForPeer, notify, playRingtone, user?.uid],
  );

  // Incoming call listener on user_calls_${myUid}
  useEffect(() => {
    if (!user?.uid) return;

    const unsubscribe = subscribeToUserIncomingCalls(user.uid, {
      onInvite: (invite) => {
        if (callState === "idle") {
          setIncomingInvite(invite);
          setCallState("ringing-in");
          playRingtone("call");

          if (audioRingIntervalRef.current) clearInterval(audioRingIntervalRef.current);
          audioRingIntervalRef.current = window.setInterval(() => {
            playRingtone("call");
          }, 3000);
        } else {
          void sendCallEnd(invite.chatId, invite.callerId, {
            senderId: user.uid,
            chatId: invite.chatId,
            reason: "busy",
          });
        }
      },
      onEnd: () => {
        if (callState !== "idle") {
          notify("Chamada finalizada.", "info");
          playRingtone("disconnect");
          cleanUpCall();
        }
      },
    });

    return () => {
      unsubscribe();
    };
  }, [callState, cleanUpCall, notify, playRingtone, user?.uid]);

  // INITIATE CALL (1:1 Friend Call)
  const startCall = useCallback(
    async (friend: SocialFriend, withVideo = false) => {
      if (!user?.uid || callState !== "idle") return;
      const friendUid = friend.id.split(":")[1] || friend.id;
      const chatId = getChatId(user.uid, friendUid);

      try {
        setCallState("ringing-out");
        setSession({
          chatId,
          friendUid,
          friendName: friend.name,
          friendAvatar: friend.avatar,
          hostUid: user.uid,
          isInitiator: true,
          startedAt: Date.now(),
        });

        const audioStream = await acquireAudioStream();
        if (audioStream) {
          localStreamRef.current = audioStream;
          setLocalStream(audioStream);
          setupVoiceAnalyzer(audioStream, true);
          if (inputMode === "push-to-talk") {
            const track = audioStream.getAudioTracks()[0];
            if (track) track.enabled = false;
          }
        } else {
          setIsMuted(true);
        }

        const pc = await createPeerConnectionForPeer(chatId, friendUid, true);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        if (unsubscribeSessionRef.current) unsubscribeSessionRef.current();
        unsubscribeSessionRef.current = subscribeToCallSession(
          chatId,
          user.uid,
          createUnifiedSessionHandlers(chatId),
        );

        await sendCallInvite(friendUid, {
          callerId: user.uid,
          callerName: userProfile?.displayName || user.displayName || "Jogador",
          callerAvatar: userProfile?.photoURL || user.photoURL || null,
          chatId,
          hasVideo: withVideo,
          timestamp: Date.now(),
        });

        await sendCallSignal(chatId, {
          senderId: user.uid,
          chatId,
          targetUid: friendUid,
          signal: offer,
        });

        playRingtone("ringout");
        audioRingIntervalRef.current = window.setInterval(() => {
          playRingtone("ringout");
        }, 3000);

        ringoutTimerRef.current = window.setTimeout(() => {
          if (callStateRef.current === "ringing-out") {
            notify(`${friend.name} não atendeu.`, "info");
            playRingtone("disconnect");
            void sendCallEnd(chatId, friendUid, {
              senderId: user.uid,
              chatId,
              reason: "timeout",
            });
            cleanUpCall();
          }
        }, 35000);
      } catch (err: any) {
        console.error("[useVoiceCall] startCall failed", err);
        notify(err?.message || "Não foi possível iniciar a chamada.", "error");
        cleanUpCall();
      }
    },
    [acquireAudioStream, callState, cleanUpCall, createPeerConnectionForPeer, createUnifiedSessionHandlers, inputMode, notify, playRingtone, setupVoiceAnalyzer, user, userProfile],
  );

  // ANSWER CALL (Callee 1:1)
  const answerCall = useCallback(async () => {
    if (!user?.uid || !incomingInvite || callState !== "ringing-in") return;
    const { callerId, callerName, callerAvatar, chatId } = incomingInvite;

    try {
      if (audioRingIntervalRef.current) {
        clearInterval(audioRingIntervalRef.current);
        audioRingIntervalRef.current = null;
      }

      setCallState("connecting");
      setSession({
        chatId,
        friendUid: callerId,
        friendName: callerName,
        friendAvatar: callerAvatar || undefined,
        hostUid: callerId,
        isInitiator: false,
        startedAt: Date.now(),
      });

      const audioStream = await acquireAudioStream();
      if (audioStream) {
        localStreamRef.current = audioStream;
        setLocalStream(audioStream);
        setupVoiceAnalyzer(audioStream, true);
        if (inputMode === "push-to-talk") {
          const track = audioStream.getAudioTracks()[0];
          if (track) track.enabled = false;
        }
      } else {
        setIsMuted(true);
      }

      await createPeerConnectionForPeer(chatId, callerId, false);

      if (unsubscribeSessionRef.current) unsubscribeSessionRef.current();
      unsubscribeSessionRef.current = subscribeToCallSession(
        chatId,
        user.uid,
        createUnifiedSessionHandlers(chatId),
      );

      await sendCallAnswer(chatId, callerId, {
        responderId: user.uid,
        accepted: true,
        chatId,
      });

      setIncomingInvite(null);
    } catch (err: any) {
      console.error("[useVoiceCall] answerCall failed", err);
      notify("Erro ao atender chamada.", "error");
      cleanUpCall();
    }
  }, [acquireAudioStream, callState, cleanUpCall, createPeerConnectionForPeer, createUnifiedSessionHandlers, incomingInvite, inputMode, notify, setupVoiceAnalyzer, user]);

  // JOIN ROOM (Persistente / Multi-Participante)
  const joinRoom = useCallback(
    async (roomId: string, password?: string, fromInvite = false) => {
      if (!user?.uid || callState !== "idle") return;

      try {
        setCallState("connecting");
        const displayName = userProfile?.displayName || user.displayName || "Jogador";
        const avatarUrl = userProfile?.photoURL || user.photoURL || undefined;

        const joinResult = await joinVoiceRoom(roomId, {
          password,
          fromInvite,
          displayName,
          avatarUrl,
        });

        const room = joinResult.room;
        const otherParticipants = joinResult.participants.filter((p) => p.uid !== user.uid);

        setSession({
          chatId: room.id,
          friendUid: room.hostUid,
          friendName: room.name,
          hostUid: room.hostUid,
          isInitiator: room.hostUid === user.uid,
          startedAt: Date.now(),
          category: room.category,
          roomName: room.name,
          isPrivate: room.isPrivate,
          participants: joinResult.participants.map((p) => ({
            uid: p.uid,
            name: p.name,
            avatar: p.avatar || undefined,
          })),
        });

        setRoomConfig({
          roomName: room.name,
          category: room.category,
          isPrivate: room.isPrivate,
        });

        const audioStream = await acquireAudioStream();
        if (audioStream) {
          localStreamRef.current = audioStream;
          setLocalStream(audioStream);
          setupVoiceAnalyzer(audioStream, true);
          if (inputMode === "push-to-talk") {
            const track = audioStream.getAudioTracks()[0];
            if (track) track.enabled = false;
          }
        } else {
          setIsMuted(true);
        }

        if (unsubscribeSessionRef.current) unsubscribeSessionRef.current();
        unsubscribeSessionRef.current = subscribeToCallSession(
          room.id,
          user.uid,
          createUnifiedSessionHandlers(room.id),
        );

        // Notifica a sala que entramos
        await sendCallMemberJoined(room.id, {
          uid: user.uid,
          name: displayName,
          avatar: avatarUrl || null,
          chatId: room.id,
        });

        // Inicia conexões WebRTC Mesh com todos os membros já presentes
        for (const peer of otherParticipants) {
          const pc = await createPeerConnectionForPeer(room.id, peer.uid, true);
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          await sendCallSignal(room.id, {
            senderId: user.uid,
            chatId: room.id,
            targetUid: peer.uid,
            signal: offer,
          });
        }

        setCallState("active");
        setIsVoiceWindowOpen(true);
        playRingtone("connect");

        if (!callDurationTimerRef.current) {
          callDurationTimerRef.current = window.setInterval(() => {
            setCallDuration((prev) => prev + 1);
          }, 1000);
        }

        notify(`Conectado à sala "${room.name}"!`, "success");
      } catch (err: any) {
        console.error("[useVoiceCall] joinRoom failed:", err);
        notify(err?.message || "Não foi possível entrar na sala de voz.", "error");
        cleanUpCall();
      }
    },
    [acquireAudioStream, callState, cleanUpCall, createPeerConnectionForPeer, createUnifiedSessionHandlers, inputMode, notify, playRingtone, setupVoiceAnalyzer, user, userProfile],
  );

  // CREATE AND JOIN ROOM (Criação de Sala Persistente)
  const createAndJoinRoom = useCallback(
    async (config: CallRoomConfig | { name?: string; roomName?: string; category?: RoomCategory; isPrivate?: boolean; password?: string; icon?: string; avatarUrl?: string; themeColor?: string }) => {
      try {
        const newRoom = await createVoiceRoom(config);
        await joinRoom(newRoom.id, config.password, true);
      } catch (err: any) {
        console.error("[useVoiceCall] createAndJoinRoom failed:", err);
        notify(err?.message || "Erro ao criar canal de voz.", "error");
      }
    },
    [joinRoom, notify],
  );

  // REJECT CALL
  const rejectCall = useCallback(async () => {
    if (!user?.uid || !incomingInvite) return;
    const { callerId, chatId } = incomingInvite;

    await sendCallAnswer(chatId, callerId, {
      responderId: user.uid,
      accepted: false,
      chatId,
    });

    playRingtone("disconnect");
    cleanUpCall();
  }, [cleanUpCall, incomingInvite, playRingtone, user?.uid]);

  // HANGUP / DISCONNECT
  const hangUp = useCallback(async () => {
    if (session && user?.uid) {
      await sendCallEnd(session.chatId, session.friendUid || "room-all", {
        senderId: user.uid,
        chatId: session.chatId,
        reason: "hangup",
      });
      await sendCallMemberLeft(session.chatId, {
        uid: user.uid,
        chatId: session.chatId,
      });
    }
    playRingtone("disconnect");
    cleanUpCall();
  }, [cleanUpCall, playRingtone, session, user?.uid]);

  // MUTE / UNMUTE
  const toggleMute = useCallback(() => {
    if (!localStreamRef.current) return;
    const audioTrack = localStreamRef.current.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      const nextMuted = !audioTrack.enabled;
      setIsMuted(nextMuted);
      playSfx(nextMuted ? sfxMute : sfxUnmute);

      if (session?.chatId && user?.uid) {
        void sendCallState(session.chatId, {
          senderId: user.uid,
          chatId: session.chatId,
          isMuted: nextMuted,
        });
      }
    }
  }, [session?.chatId, user?.uid]);

  // DEAFEN / UNDEAFEN
  const toggleDeafen = useCallback(() => {
    setIsDeafened((prev) => {
      const nextDeafened = !prev;
      playSfx(nextDeafened ? sfxFullMute : sfxUndeafen);
      if (nextDeafened) {
        setIsMuted(true);
        if (localStreamRef.current) {
          const audioTrack = localStreamRef.current.getAudioTracks()[0];
          if (audioTrack) audioTrack.enabled = false;
        }
      }
      return nextDeafened;
    });
  }, []);

  // TOGGLE CAMERA
  const toggleCamera = useCallback(async () => {
    if (!session?.chatId) return;

    if (isCameraOn) {
      if (cameraStreamRef.current) {
        cameraStreamRef.current.getTracks().forEach((track) => track.stop());
        cameraStreamRef.current = null;
      }
      setLocalCameraStream(null);

      // Remove video track from all peers
      peerConnectionsRef.current.forEach((pc) => {
        const sender = pc.getSenders().find((s) => s.track?.kind === "video");
        if (sender && !isSharingScreen) {
          try {
            pc.removeTrack(sender);
          } catch {}
        }
      });

      setIsCameraOn(false);
      if (session.chatId && user?.uid) {
        void sendCallState(session.chatId, {
          senderId: user.uid,
          chatId: session.chatId,
          isCameraOn: false,
        });
      }
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            deviceId: selectedVideoInput !== "default" ? { exact: selectedVideoInput } : undefined,
            width: { ideal: 640 },
            height: { ideal: 480 },
            frameRate: { ideal: 30 },
          },
          audio: false,
        });
        cameraStreamRef.current = stream;
        setLocalCameraStream(stream);
        const videoTrack = stream.getVideoTracks()[0];

        if (session.friendUid === "echo-bot") {
          setRemoteStream(stream);
          setIsCameraOn(true);
          return;
        }

        // Add track to all peers and renegotiate
        for (const [peerId, pc] of peerConnectionsRef.current.entries()) {
          const sender = pc.getSenders().find((s) => s.track?.kind === "video");
          if (sender) {
            await sender.replaceTrack(videoTrack);
          } else {
            pc.addTrack(videoTrack, stream);
          }
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          if (user?.uid) {
            await sendCallSignal(session.chatId, {
              senderId: user.uid,
              chatId: session.chatId,
              targetUid: peerId,
              signal: offer,
            });
          }
        }

        setIsCameraOn(true);
        if (session.chatId && user?.uid) {
          void sendCallState(session.chatId, {
            senderId: user.uid,
            chatId: session.chatId,
            isCameraOn: true,
          });
        }
      } catch (err) {
        console.error("[useVoiceCall] toggleCamera error", err);
        notify("Não foi possível acessar a câmera.", "error");
      }
    }
  }, [isCameraOn, isSharingScreen, notify, selectedVideoInput, session?.chatId, session?.friendUid, user?.uid]);

  // START SCREEN SHARE (Com contentHint detail e bitrate otimizado)
  const startScreenShare = useCallback(
    async (opts?: string | ScreenShareOptions) => {
      if (!session?.chatId) return;

      const options: ScreenShareOptions = typeof opts === "string" ? { sourceId: opts } : opts || {};
      const sourceId = options.sourceId;
      const fps = options.fps || 30;
      const res = options.resolution || "1080p";
      const maxW = res === "720p" ? 1280 : res === "1080p" ? 1920 : 3840;
      const maxH = res === "720p" ? 720 : res === "1080p" ? 1080 : 2160;

      try {
        let screenStream: MediaStream;

        if (sourceId && typeof navigator !== "undefined") {
          screenStream = await (navigator.mediaDevices as any).getUserMedia({
            audio: options.withAudio
              ? {
                  mandatory: {
                    chromeMediaSource: "desktop",
                  },
                }
              : false,
            video: {
              mandatory: {
                chromeMediaSource: "desktop",
                chromeMediaSourceId: sourceId,
                maxWidth: maxW,
                maxHeight: maxH,
                maxFrameRate: fps,
              },
            },
          });
        } else {
          screenStream = await navigator.mediaDevices.getDisplayMedia({
            video: {
              width: { ideal: maxW },
              height: { ideal: maxH },
              frameRate: { ideal: fps, max: fps },
            },
            audio: Boolean(options.withAudio),
          });
        }

        screenStreamRef.current = screenStream;
        setLocalScreenStream(screenStream);
        const videoTrack = screenStream.getVideoTracks()[0];
        const screenAudioTrack = screenStream.getAudioTracks()[0];

        // Otimização de nitidez: prioriza texto/UI legível
        if (videoTrack && "contentHint" in videoTrack) {
          (videoTrack as any).contentHint = "detail";
        }

        if (session.friendUid === "echo-bot") {
          if (screenAudioTrack) {
            screenAudioTrack.enabled = false;
          }
          setRemoteStream(screenStream);
          setIsRemoteSharingScreen(true);
          setIsSharingScreen(true);
          setIsScreenPickerOpen(false);
          playSfx(sfxStreamStart);
          videoTrack.onended = () => {
            void stopScreenShare();
          };
          return;
        }

        // Add track and set explicit bitrates on all peers
        const targetBitrate = res === "720p" ? 2_500_000 : fps === 60 ? 6_000_000 : 4_500_000;

        for (const [peerId, pc] of peerConnectionsRef.current.entries()) {
          const sender = pc.getSenders().find((s) => s.track?.kind === "video");
          if (sender) {
            await sender.replaceTrack(videoTrack);
          } else {
            pc.addTrack(videoTrack, screenStream);
          }

          if (screenAudioTrack) {
            const audioSender = pc.getSenders().find((s) => s.track === screenAudioTrack);
            if (!audioSender) {
              pc.addTrack(screenAudioTrack, screenStream);
            }
          }

          // Apply bitrate and degradation preferences
          try {
            const videoSender = pc.getSenders().find((s) => s.track === videoTrack);
            if (videoSender && videoSender.getParameters) {
              const params = videoSender.getParameters();
              if (params.encodings && params.encodings.length > 0) {
                params.encodings[0].maxBitrate = targetBitrate;
                (params as any).degradationPreference = "maintain-resolution";
                await videoSender.setParameters(params);
              }
            }
          } catch (e) {
            console.warn("[useVoiceCall] setParameters on screen sender warning:", e);
          }

          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          if (user?.uid) {
            await sendCallSignal(session.chatId, {
              senderId: user.uid,
              chatId: session.chatId,
              targetUid: peerId,
              signal: offer,
            });
          }
        }

        setIsSharingScreen(true);
        setIsScreenPickerOpen(false);
        playSfx(sfxStreamStart);

        void sendCallState(session.chatId, {
          senderId: user.uid,
          chatId: session.chatId,
          isSharingScreen: true,
        });

        videoTrack.onended = () => {
          void stopScreenShare();
        };
      } catch (err: any) {
        console.error("[useVoiceCall] startScreenShare failed", err);
        notify("Não foi possível iniciar o compartilhamento de tela.", "error");
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [notify, session?.chatId, session?.friendUid, user?.uid],
  );

  // STOP SCREEN SHARE
  const stopScreenShare = useCallback(async () => {
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((track) => track.stop());
      screenStreamRef.current = null;
    }
    setLocalScreenStream(null);

    if (session?.friendUid === "echo-bot") {
      setRemoteStream(null);
      setIsRemoteSharingScreen(false);
      setIsSharingScreen(false);
      playSfx(sfxStreamEnd);
      return;
    }

    if (session?.chatId && user?.uid) {
      for (const [peerId, pc] of peerConnectionsRef.current.entries()) {
        const senders = pc.getSenders();
        const videoSender = senders.find((s) => s.track?.kind === "video");
        if (videoSender) {
          try {
            pc.removeTrack(videoSender);
          } catch {}
        }

        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          await sendCallSignal(session.chatId, {
            senderId: user.uid,
            chatId: session.chatId,
            targetUid: peerId,
            signal: offer,
          });
        } catch {}
      }

      void sendCallState(session.chatId, {
        senderId: user.uid,
        chatId: session.chatId,
        isSharingScreen: false,
      });
    }

    playSfx(sfxStreamEnd);
    setIsSharingScreen(false);
  }, [session?.chatId, session?.friendUid, user?.uid]);

  // START TEST CALL (Loopback Echo Bot)
  const startTestCall = useCallback(async () => {
    try {
      cleanUpCall();
      setCallState("active");
      setIsVoiceWindowOpen(true);
      setSession({
        chatId: "test-echo-session",
        friendUid: "echo-bot",
        friendName: "Auto-Teste (Echo)",
        isInitiator: true,
        startedAt: Date.now(),
      });

      const audioStream = await acquireAudioStream();
      if (audioStream) {
        localStreamRef.current = audioStream;
        setLocalStream(audioStream);
        setupVoiceAnalyzer(audioStream, true);
        if (inputMode === "push-to-talk") {
          const track = audioStream.getAudioTracks()[0];
          if (track) track.enabled = false;
        }
      } else {
        setIsMuted(true);
        notify("Microfone não detectado ou sem permissão.", "info");
      }

      playRingtone("connect");
      if (!callDurationTimerRef.current) {
        callDurationTimerRef.current = window.setInterval(() => {
          setCallDuration((prev) => prev + 1);
        }, 1000);
      }
      notify("Auto-teste iniciado! Fale no microfone ou compartilhe sua tela.", "success");
    } catch (err: any) {
      console.error("[useVoiceCall] startTestCall failed", err);
      notify("Erro ao acessar microfone para o teste.", "error");
      cleanUpCall();
    }
  }, [acquireAudioStream, cleanUpCall, inputMode, notify, playRingtone, setupVoiceAnalyzer]);

  // KICK PARTICIPANT (Admin Action)
  const kickParticipant = useCallback(
    async (targetUserId: string) => {
      if (!sessionRef.current?.chatId || !user?.uid) return;
      try {
        await sendCallKick(sessionRef.current.chatId, targetUserId, {
          adminId: user.uid,
          targetUserId,
          chatId: sessionRef.current.chatId,
          reason: "Expulso pelo administrador da sala",
        });
        notify("Participante expulso da chamada.", "info");
      } catch (err) {
        console.error("[useVoiceCall] Failed to kick participant:", err);
      }
    },
    [notify, user?.uid],
  );

  // UPDATE ROOM PRIVACY / PASSWORD
  const updateRoomPrivacy = useCallback(
    async (isPrivate: boolean, password?: string) => {
      if (!session?.chatId || !user?.uid) return;
      const currentCategory = session.category || roomConfig?.category || "resenha_games";
      const currentRoomName = session.roomName || roomConfig?.roomName || `Call com ${session.friendName}`;
      const newConfig: CallRoomConfig = {
        roomName: currentRoomName,
        category: currentCategory,
        isPrivate,
        password: password || undefined,
      };
      setRoomConfig(newConfig);
      setSession((prev) =>
        prev
          ? {
              ...prev,
              isPrivate,
              password: password || undefined,
              roomName: currentRoomName,
              category: currentCategory,
            }
          : null,
      );
      await sendCallPrivacyUpdate(session.chatId, {
        adminId: user.uid,
        chatId: session.chatId,
        isPrivate,
        password: password || undefined,
        category: currentCategory,
        roomName: currentRoomName,
      });
      notify(
        isPrivate ? "Privacidade atualizada: Sala Privada 🔒" : "Privacidade atualizada: Sala Pública 🔓",
        "success",
      );
    },
    [notify, roomConfig, session, user?.uid],
  );

  // Calibração de Ruído Ambiente (Mede o ruído por 2s e sugere sensibilidade)
  const calibrateNoiseFloor = useCallback(async (): Promise<{ noiseFloor: number; recommendedSensitivity: number }> => {
    setIsCalibratingNoise(true);
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) throw new Error("AudioContext não suportado");

      let tempStream = localStreamRef.current;
      let shouldStopTemp = false;

      if (!tempStream || !tempStream.getAudioTracks().some((t) => t.readyState === "live")) {
        tempStream = await acquireAudioStream();
        shouldStopTemp = true;
      }

      if (!tempStream) throw new Error("Microfone inacessível para calibração");

      const ctx = new AudioCtx();
      const source = ctx.createMediaStreamSource(tempStream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.3;
      source.connect(analyser);

      const timeData = new Float32Array(analyser.fftSize);
      let samplesCount = 0;
      let totalRms = 0;

      const startTime = performance.now();
      const durationMs = 2000;

      await new Promise<void>((resolve) => {
        const sampleInterval = setInterval(() => {
          if (performance.now() - startTime >= durationMs) {
            clearInterval(sampleInterval);
            resolve();
            return;
          }

          analyser.getFloatTimeDomainData(timeData);
          let sumSquares = 0;
          for (let i = 0; i < timeData.length; i += 1) {
            sumSquares += timeData[i] * timeData[i];
          }
          const rms = Math.sqrt(sumSquares / timeData.length);
          const rawVol = Math.min(100, Math.round(rms * 700));
          totalRms += rawVol;
          samplesCount += 1;
        }, 50);
      });

      try {
        source.disconnect();
        analyser.disconnect();
        if (ctx.state !== "closed") await ctx.close();
      } catch {}

      if (shouldStopTemp && tempStream) {
        tempStream.getTracks().forEach((t) => t.stop());
      }

      const avgNoiseFloor = samplesCount > 0 ? Math.round(totalRms / samplesCount) : 5;
      const noiseFloor = Math.max(1, Math.min(50, avgNoiseFloor));

      // Calcula sensibilidade recomendada: se o ruído for 15, sensibilidade = 76%
      const recommendedSensitivity = Math.max(10, Math.min(90, Math.round(100 - (noiseFloor * 1.6))));

      setCurrentNoiseFloor(noiseFloor);
      setVoiceSensitivity(recommendedSensitivity);

      try {
        localStorage.setItem("checkpoint_voice_noise_floor", String(noiseFloor));
      } catch {}

      notify(`Microfone calibrado! Ruído medido: ${noiseFloor}%. Sensibilidade ajustada para ${recommendedSensitivity}%.`, "success");
      return { noiseFloor, recommendedSensitivity };
    } catch (err: any) {
      console.warn("[useVoiceCall] calibrateNoiseFloor error:", err);
      notify("Não foi possível calibrar o ruído ambiente.", "error");
      throw err;
    } finally {
      setIsCalibratingNoise(false);
    }
  }, [acquireAudioStream, notify, setVoiceSensitivity]);

  return {
    callState,
    session,
    roomConfig,
    incomingInvite,
    localStream,
    remoteStream,
    remoteStreams,
    localCameraStream,
    localScreenStream,
    remoteVolume,
    setRemoteVolume,
    isMuted,
    isDeafened,
    isSpeakingLocal,
    isSpeakingRemote,
    remoteSpeakingStates,
    remoteStatesMap,
    isRemoteMuted,
    isRemoteDeafened,
    isCameraOn,
    isRemoteCameraOn,
    isSharingScreen,
    isRemoteSharingScreen,
    isScreenPickerOpen,
    setIsScreenPickerOpen,
    isVoiceWindowOpen,
    setIsVoiceWindowOpen,
    callDuration,
    isReconnecting,
    inputMode,
    setInputMode,
    pushToTalkKey,
    setPushToTalkKey,
    isPttPressed,
    isMicMonitoring,
    setIsMicMonitoring,
    // Device selections and controls
    audioInputDevices,
    audioOutputDevices,
    videoInputDevices,
    selectedAudioInput,
    selectedAudioOutput,
    selectedVideoInput,
    changeAudioInputDevice,
    changeAudioOutputDevice,
    changeVideoInputDevice,
    refreshDevices,
    deviceError,
    clearDeviceError,
    // Audio processing and calibration controls
    micGain,
    setMicGain,
    noiseGateEnabled,
    setNoiseGateEnabled,
    voiceSensitivity,
    setVoiceSensitivity,
    echoCancellation,
    setEchoCancellation,
    noiseSuppression,
    setNoiseSuppression,
    autoGainControl,
    setAutoGainControl,
    calibrateNoiseFloor,
    isCalibratingNoise,
    currentNoiseFloor,
    // Actions
    startCall,
    joinRoom,
    createAndJoinRoom,
    startTestCall,
    answerCall,
    rejectCall,
    hangUp,
    kickParticipant,
    updateRoomPrivacy,
    toggleMute,
    toggleDeafen,
    toggleCamera,
    startScreenShare,
    stopScreenShare,
  };
};
