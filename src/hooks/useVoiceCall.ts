import { useCallback, useEffect, useRef, useState } from "react";
import type { AuthUser } from "../auth/AuthProvider";
import type {
  CallState,
  SocialFriend,
  UserProfile,
  VoiceCallSession,
} from "../types/domain";
import {
  type CallAnswerPayload,
  type CallEndPayload,
  type CallInvitePayload,
  type CallSignalPayload,
  type CallStatePayload,
  type CallKickPayload,
  type CallPrivacyPayload,
  sendCallAnswer,
  sendCallEnd,
  sendCallInvite,
  sendCallSignal,
  sendCallState,
  sendCallKick,
  sendCallPrivacyUpdate,
  subscribeToCallSession,
  subscribeToUserIncomingCalls,
} from "../services/voiceCall";
import type { CallRoomConfig, RoomCategory } from "../types/voice-governance";
import { getChatId } from "../services/chat";
import { getTurnServers } from "../services/turnCredentials";
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
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [localCameraStream, setLocalCameraStream] = useState<MediaStream | null>(null);
  const [localScreenStream, setLocalScreenStream] = useState<MediaStream | null>(null);
  const [roomConfig, setRoomConfig] = useState<CallRoomConfig | null>(null);

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
  const [isSpeakingRemote, setIsSpeakingRemote] = useState(false);

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

  // Microphone monitoring / sidetone ("Ouvir a própria voz")
  const [isMicMonitoring, setIsMicMonitoringState] = useState<boolean>(() => {
    try {
      return localStorage.getItem("checkpoint_voice_mic_monitoring") === "true";
    } catch {
      return false;
    }
  });

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
      gain.gain.value = 0.85; // Natural monitoring volume
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

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const sessionRef = useRef<VoiceCallSession | null>(null);
  sessionRef.current = session;
  const callStateRef = useRef<CallState>(callState);
  callStateRef.current = callState;

  // Dedicated Audio Pipelines for local and remote streams (ensuring full cleanup)
  const localPipelineRef = useRef<AudioPipeline>(createEmptyPipeline());
  const remotePipelineRef = useRef<AudioPipeline>(createEmptyPipeline());

  const unsubscribeSessionRef = useRef<(() => void) | null>(null);
  const callDurationTimerRef = useRef<number | null>(null);
  const ringoutTimerRef = useRef<number | null>(null);
  const audioRingIntervalRef = useRef<number | null>(null);
  const pttReleaseTimeoutRef = useRef<number | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimerRef = useRef<number | null>(null);

  // Keep mic monitoring in sync with local stream availability
  useEffect(() => {
    if (isMicMonitoring && localStream) {
      startMicMonitoring(localStream);
    } else {
      stopMicMonitoring();
    }
  }, [isMicMonitoring, localStream, startMicMonitoring, stopMicMonitoring]);

  // VAD Engine Setup with RMS and 200ms Hold Timer + Strict AudioContext Cleanup
  const setupVoiceAnalyzer = useCallback(
    (stream: MediaStream, isLocal: boolean) => {
      const targetPipelineRef = isLocal ? localPipelineRef : remotePipelineRef;
      // Clean up any existing pipeline first
      destroyAudioPipeline(targetPipelineRef.current);

      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioCtx) return;

        const ctx = new AudioCtx();
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 512;
        analyser.smoothingTimeConstant = 0.15;
        source.connect(analyser);

        const pipeline: AudioPipeline = {
          ctx,
          source,
          analyser,
          animFrameId: null,
          holdTimer: null,
        };
        targetPipelineRef.current = pipeline;

        const timeData = new Float32Array(analyser.fftSize);
        let currentlySpeaking = false;

        const checkVolume = () => {
          if (!targetPipelineRef.current.analyser || !targetPipelineRef.current.ctx) return;
          if (targetPipelineRef.current.ctx.state === "suspended") {
            void targetPipelineRef.current.ctx.resume().catch(() => {});
          }

          analyser.getFloatTimeDomainData(timeData);

          // Calculate Root Mean Square (RMS)
          let sumSquares = 0;
          for (let i = 0; i < timeData.length; i += 1) {
            sumSquares += timeData[i] * timeData[i];
          }
          const rms = Math.sqrt(sumSquares / timeData.length);
          const rawVolume = Math.min(100, Math.round(rms * 700));

          // Calibrated sensitivity threshold (smooth exponential curve from 1 to 30)
          const sens = Math.max(0, Math.min(100, voiceSensitivityRef.current));
          const sensitivityThreshold = Math.max(1, Math.round(1 + 29 * Math.pow((100 - sens) / 100, 1.8)));

          const isPtt = inputModeRef.current === "push-to-talk";
          const isPttActive = isPttPressedRef.current;

          const isAboveThreshold = isLocal && isPtt
            ? isPttActive && rawVolume >= 1
            : rawVolume >= sensitivityThreshold;

          if (isAboveThreshold) {
            // Voice detected: clear hold timer and activate speaking
            if (pipeline.holdTimer) {
              window.clearTimeout(pipeline.holdTimer);
              pipeline.holdTimer = null;
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
                setIsSpeakingRemote(true);
              }
            }
          } else if (currentlySpeaking && !pipeline.holdTimer) {
            // Below threshold: hold speaking state for 250ms to eliminate syllable flickering
            pipeline.holdTimer = window.setTimeout(() => {
              currentlySpeaking = false;
              pipeline.holdTimer = null;
              if (isLocal) {
                setIsSpeakingLocal(false);
                if (inputModeRef.current === "voice-activity" || inputModeRef.current === "push-to-talk") {
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
                setIsSpeakingRemote(false);
              }
            }, 250);
          }

          pipeline.animFrameId = requestAnimationFrame(checkVolume);
        };

        pipeline.animFrameId = requestAnimationFrame(checkVolume);
      } catch (err) {
        console.warn("[useVoiceCall] setupVoiceAnalyzer failed:", err);
      }
    },
    [user?.uid],
  );

  // Auto-sync analyzers when localStream or remoteStream change
  useEffect(() => {
    if (localStream) {
      setupVoiceAnalyzer(localStream, true);
    } else {
      destroyAudioPipeline(localPipelineRef.current);
      setIsSpeakingLocal(false);
    }
  }, [localStream, setupVoiceAnalyzer]);

  useEffect(() => {
    if (remoteStream && remoteStream.getAudioTracks().length > 0) {
      setupVoiceAnalyzer(remoteStream, false);
    } else {
      destroyAudioPipeline(remotePipelineRef.current);
      setIsSpeakingRemote(false);
    }
  }, [remoteStream, setupVoiceAnalyzer]);

  // Dynamic Audio Constraints Applier (hot-swapping live track constraints)
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
        console.warn("[useVoiceCall] track.applyConstraints fallback to stream re-acquisition:", err);
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
            },
            video: false,
          });

          const newTrack = newStream.getAudioTracks()[0];
          if (newTrack) {
            newTrack.enabled = !isMutedRef.current && !isDeafenedRef.current;
            if (peerConnectionRef.current) {
              const sender = peerConnectionRef.current.getSenders().find((s) => s.track?.kind === "audio");
              if (sender) {
                await sender.replaceTrack(newTrack);
              }
            }
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

  // Settings setters with localStorage persistence & dynamic live track updates
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

  // Enumerate connected devices & auto-detect default devices
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

      // Auto-validate device selection against available devices
      setSelectedAudioInputState((prev) => {
        if (prev === "default") return "default";
        const exists = inputs.some((d) => d.deviceId === prev);
        return exists ? prev : "default";
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

  // Professional Audio acquisition helper with high quality constraints
  const acquireAudioStream = useCallback(
    async (deviceId?: string): Promise<MediaStream | null> => {
      if (!navigator?.mediaDevices?.getUserMedia) return null;
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
        return await navigator.mediaDevices.getUserMedia(constraints);
      } catch (err) {
        console.warn("[useVoiceCall] getUserMedia with constraints failed, trying fallback:", err);
        try {
          return await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        } catch {
          return null;
        }
      }
    },
    [autoGainControl, echoCancellation, noiseSuppression, selectedAudioInput],
  );

  // Dynamic Device Switchers
  const changeAudioInputDevice = useCallback(
    async (deviceId: string) => {
      setSelectedAudioInputState(deviceId);
      try {
        localStorage.setItem("checkpoint_voice_input_device", deviceId);
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

        // Replace track in active WebRTC peer connection
        if (peerConnectionRef.current) {
          const sender = peerConnectionRef.current.getSenders().find((s) => s.track?.kind === "audio");
          if (sender) {
            await sender.replaceTrack(newTrack);
          }
        }

        // Stop old track
        if (localStreamRef.current) {
          localStreamRef.current.getAudioTracks().forEach((t) => t.stop());
        }

        localStreamRef.current = newStream;
        setLocalStream(newStream);

        // Reconnect audio pipeline
        setupVoiceAnalyzer(newStream, true);
        notify("Dispositivo de microfone alterado.", "info");
      } catch (err) {
        console.error("[useVoiceCall] changeAudioInputDevice error:", err);
        notify("Erro ao trocar de microfone.", "error");
      }
    },
    [acquireAudioStream, callState, inputMode, isDeafened, isMuted, isPttPressed, notify, setupVoiceAnalyzer],
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

        if (peerConnectionRef.current) {
          const sender = peerConnectionRef.current.getSenders().find((s) => s.track?.kind === "video");
          if (sender) {
            await sender.replaceTrack(newVideoTrack);
          }
        }
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

  // Register global PTT shortcut with Electron
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

  // Global IPC PTT events from Electron
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

  // Local window PTT keyboard events
  useEffect(() => {
    if (inputMode !== "push-to-talk") return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (
        e.key.toUpperCase() === pushToTalkKey.toUpperCase() ||
        e.code.toUpperCase() === pushToTalkKey.toUpperCase()
      ) {
        handlePttDown();
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
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

  // Play Stoat SFX sounds
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

  // Complete Cleanup Helper (Media, AudioContexts, AnalyserNodes, Timers, WebRTC)
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

    // Destroy audio analysis pipelines cleanly
    destroyAudioPipeline(localPipelineRef.current);
    destroyAudioPipeline(remotePipelineRef.current);

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
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    if (unsubscribeSessionRef.current) {
      unsubscribeSessionRef.current();
      unsubscribeSessionRef.current = null;
    }

    setLocalStream(null);
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
    setIsSpeakingRemote(false);
    setCallState("idle");
    setSession(null);
    setRoomConfig(null);
    setIncomingInvite(null);
    setCallDuration(0);
  }, []);

  // Cleanup on unmount of the hook
  useEffect(() => {
    return () => {
      cleanUpCall();
    };
  }, [cleanUpCall]);

  // Create & setup PeerConnection with dynamic TURN and auto-reconnection
  const createPeerConnection = useCallback(
    async (chatId: string, isInitiator: boolean) => {
      const iceServers = await getTurnServers();
      const pc = new RTCPeerConnection({
        iceServers,
        iceCandidatePoolSize: 2,
        bundlePolicy: "max-bundle",
      });
      peerConnectionRef.current = pc;

      pc.onicecandidate = (event) => {
        if (event.candidate && user?.uid) {
          void sendCallSignal(chatId, {
            senderId: user.uid,
            chatId,
            signal: { candidate: event.candidate.toJSON() },
          });
        }
      };

      pc.ontrack = (event) => {
        if (event.streams && event.streams[0]) {
          const stream = event.streams[0];
          setRemoteStream(stream);
          setupVoiceAnalyzer(stream, false);

          const hasVideo = stream.getVideoTracks().some((t) => t.enabled);
          setIsRemoteSharingScreen(hasVideo);

          stream.onaddtrack = () => {
            setIsRemoteSharingScreen(stream.getVideoTracks().length > 0);
          };
          stream.onremovetrack = () => {
            setIsRemoteSharingScreen(stream.getVideoTracks().length > 0);
          };
        }
      };

      // Reconnection helper with backoff & ICE restart
      const attemptReconnect = async () => {
        if (!pc || pc.signalingState === "closed") return;
        if (reconnectAttemptsRef.current >= 3) {
          notify("Conexão de voz perdida.", "error");
          cleanUpCall();
          playRingtone("disconnect");
          return;
        }
        reconnectAttemptsRef.current += 1;
        setIsReconnecting(true);
        notify(`Reconectando chamada de voz... (tentativa ${reconnectAttemptsRef.current}/3)`, "info");

        try {
          if (isInitiator) {
            const offer = await pc.createOffer({ iceRestart: true });
            await pc.setLocalDescription(offer);
            if (user?.uid) {
              await sendCallSignal(chatId, {
                senderId: user.uid,
                chatId,
                signal: offer,
              });
            }
          }
        } catch (err) {
          console.error("[useVoiceCall] ICE restart error:", err);
        }
      };

      pc.oniceconnectionstatechange = () => {
        if (pc.iceConnectionState === "disconnected") {
          if (reconnectTimerRef.current) window.clearTimeout(reconnectTimerRef.current);
          reconnectTimerRef.current = window.setTimeout(() => {
            if (pc.iceConnectionState === "disconnected" || pc.iceConnectionState === "failed") {
              void attemptReconnect();
            }
          }, 3500);
        } else if (pc.iceConnectionState === "failed") {
          void attemptReconnect();
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
          void attemptReconnect();
        }
      };

      return pc;
    },
    [cleanUpCall, notify, playRingtone, setupVoiceAnalyzer, user?.uid],
  );

  // Handle incoming call listener on user_calls_${myUid}
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

  // INITIATE CALL (Caller)
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

        const pc = await createPeerConnection(chatId, true);
        if (audioStream) {
          audioStream.getTracks().forEach((track) => pc.addTrack(track, audioStream));
        }

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        if (unsubscribeSessionRef.current) unsubscribeSessionRef.current();
        unsubscribeSessionRef.current = subscribeToCallSession(chatId, user.uid, {
          onAnswer: async (answerPayload) => {
            if (answerPayload.accepted) {
              setCallState("connecting");
              if (audioRingIntervalRef.current) {
                clearInterval(audioRingIntervalRef.current);
                audioRingIntervalRef.current = null;
              }
            } else {
              notify(`${friend.name} recusou a chamada.`, "info");
              playRingtone("disconnect");
              cleanUpCall();
            }
          },
          onSignal: async ({ signal }) => {
            if ("sdp" in signal && pc.signalingState !== "closed") {
              await pc.setRemoteDescription(new RTCSessionDescription(signal as RTCSessionDescriptionInit));
            } else if ("candidate" in signal && pc.remoteDescription) {
              await pc.addIceCandidate(new RTCIceCandidate((signal as any).candidate));
            }
          },
          onState: (remoteState) => {
            if (typeof remoteState.isSpeaking === "boolean") {
              setIsSpeakingRemote(remoteState.isSpeaking);
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
          onKicked: () => {
            notify("Você foi expulso da chamada pelo administrador.", "error");
            playRingtone("disconnect");
            cleanUpCall();
          },
          onPrivacy: (privacy) => {
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
              privacy.isPrivate
                ? "🔒 A sala agora é privada."
                : "🔓 A sala agora é pública.",
              "info",
            );
          },
          onEnd: (endPayload) => {
            notify(
              endPayload.reason === "busy"
                ? `${friend.name} está em outra chamada.`
                : "Chamada encerrada.",
              "info",
            );
            playRingtone("disconnect");
            cleanUpCall();
          },
        });

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
    [acquireAudioStream, callState, cleanUpCall, createPeerConnection, inputMode, notify, playRingtone, setupVoiceAnalyzer, user, userProfile],
  );

  // ANSWER CALL (Callee)
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

      const pc = await createPeerConnection(chatId, false);
      if (audioStream) {
        audioStream.getTracks().forEach((track) => pc.addTrack(track, audioStream));
      }

      const pendingCandidates: RTCIceCandidateInit[] = [];

      if (unsubscribeSessionRef.current) unsubscribeSessionRef.current();
      unsubscribeSessionRef.current = subscribeToCallSession(chatId, user.uid, {
        onSignal: async ({ signal }) => {
          if ("sdp" in signal && signal.type === "offer") {
            await pc.setRemoteDescription(new RTCSessionDescription(signal as RTCSessionDescriptionInit));
            for (const cand of pendingCandidates) {
              await pc.addIceCandidate(new RTCIceCandidate(cand));
            }
            pendingCandidates.length = 0;

            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);

            await sendCallSignal(chatId, {
              senderId: user.uid,
              chatId,
              signal: answer,
            });
          } else if ("candidate" in signal) {
            if (pc.remoteDescription) {
              await pc.addIceCandidate(new RTCIceCandidate((signal as any).candidate));
            } else {
              pendingCandidates.push((signal as any).candidate);
            }
          }
        },
        onState: (remoteState) => {
          if (typeof remoteState.isSpeaking === "boolean") {
            setIsSpeakingRemote(remoteState.isSpeaking);
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
        onKicked: () => {
          notify("Você foi expulso da chamada pelo administrador.", "error");
          playRingtone("disconnect");
          cleanUpCall();
        },
        onPrivacy: (privacy) => {
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
            privacy.isPrivate
              ? "🔒 A sala agora é privada."
              : "🔓 A sala agora é pública.",
            "info",
          );
        },
        onEnd: () => {
          notify("Chamada encerrada.", "info");
          playRingtone("disconnect");
          cleanUpCall();
        },
      });

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
  }, [acquireAudioStream, callState, cleanUpCall, createPeerConnection, incomingInvite, inputMode, notify, playRingtone, setupVoiceAnalyzer, user]);

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
      await sendCallEnd(session.chatId, session.friendUid, {
        senderId: user.uid,
        chatId: session.chatId,
        reason: "hangup",
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
      if (peerConnectionRef.current && session.friendUid !== "echo-bot") {
        const sender = peerConnectionRef.current.getSenders().find((s) => s.track?.kind === "video");
        if (sender && !isSharingScreen) {
          peerConnectionRef.current.removeTrack(sender);
        }
      }
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

        if (peerConnectionRef.current && user?.uid) {
          const pc = peerConnectionRef.current;
          const sender = pc.getSenders().find((s) => s.track?.kind === "video");
          if (sender) {
            await sender.replaceTrack(videoTrack);
          } else {
            pc.addTrack(videoTrack, stream);
          }
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          await sendCallSignal(session.chatId, {
            senderId: user.uid,
            chatId: session.chatId,
            signal: offer,
          });
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

  // START SCREEN SHARE
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

        if (session.friendUid === "echo-bot") {
          // Desativa faixa de áudio de tela no loopback para evitar eco/feedback acústico
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

        if (!peerConnectionRef.current || !user?.uid) return;
        const pc = peerConnectionRef.current;

        const sender = pc.getSenders().find((s) => s.track?.kind === "video");
        if (sender) {
          await sender.replaceTrack(videoTrack);
        } else {
          pc.addTrack(videoTrack, screenStream);
        }

        // Se houver áudio do sistema, envia para a conexão WebRTC sem reproduzir localmente
        if (screenAudioTrack) {
          const audioSender = pc.getSenders().find((s) => s.track === screenAudioTrack);
          if (!audioSender) {
            pc.addTrack(screenAudioTrack, screenStream);
          }
        }

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        await sendCallSignal(session.chatId, {
          senderId: user.uid,
          chatId: session.chatId,
          signal: offer,
        });

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

    if (peerConnectionRef.current && session?.chatId && user?.uid) {
      const senders = peerConnectionRef.current.getSenders();
      const videoSender = senders.find((s) => s.track?.kind === "video");
      if (videoSender) {
        peerConnectionRef.current.removeTrack(videoSender);
      }

      const offer = await peerConnectionRef.current.createOffer();
      await peerConnectionRef.current.setLocalDescription(offer);
      await sendCallSignal(session.chatId, {
        senderId: user.uid,
        chatId: session.chatId,
        signal: offer,
      });

      void sendCallState(session.chatId, {
        senderId: user.uid,
        chatId: session.chatId,
        isSharingScreen: false,
      });
    }

    playSfx(sfxStreamEnd);
    setIsSharingScreen(false);
  }, [session?.chatId, session?.friendUid, user?.uid]);

  // START TEST CALL (Loopback / Echo Bot)
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
        isPrivate
          ? "Privacidade atualizada: Sala Privada 🔒"
          : "Privacidade atualizada: Sala Pública 🔓",
        "success",
      );
    },
    [notify, roomConfig, session, user?.uid],
  );

  return {
    callState,
    session,
    roomConfig,
    incomingInvite,
    localStream,
    remoteStream,
    localCameraStream,
    localScreenStream,
    remoteVolume,
    setRemoteVolume,
    isMuted,
    isDeafened,
    isSpeakingLocal,
    isSpeakingRemote,
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
    // Audio processing controls
    voiceSensitivity,
    setVoiceSensitivity,
    echoCancellation,
    setEchoCancellation,
    noiseSuppression,
    setNoiseSuppression,
    autoGainControl,
    setAutoGainControl,
    // Actions
    startCall,
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
