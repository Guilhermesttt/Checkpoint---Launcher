import React, { useEffect, useRef, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Volume1,
  Video,
  VideoOff,
  MonitorUp,
  MonitorOff,
  PhoneOff,
  Minimize2,
  Maximize,
  Maximize2,
  Radio,
  Settings,
  X,
  Keyboard,
  Sliders,
  Check,
  Activity,
  Headphones,
  Camera,
  Pin,
  PinOff,
  LayoutGrid,
  PictureInPicture2,
  Scaling,
  Scan,
  Tv,
  Link2,
  UserPlus,
  Gamepad2,
  Swords,
  BookOpen,
  MessageSquare,
  Lock,
  Unlock,
} from "lucide-react";
import type { SocialFriend, UserProfile, VoiceCallSession } from "../../types/domain";
import type { CallRoomConfig } from "../../types/voice-governance";
import { ParticipantContextMenu } from "./ParticipantContextMenu";
import { ChannelInviteModal } from "./ChannelInviteModal";
import { CallPrivacyPanel } from "./CallPrivacyPanel";

interface VoiceCallWindowProps {
  isOpen: boolean;
  onClose: () => void;
  session: VoiceCallSession | null;
  userProfile: UserProfile | null;
  remoteStream: MediaStream | null;
  localStream: MediaStream | null;
  localCameraStream?: MediaStream | null;
  localScreenStream?: MediaStream | null;
  duration: number;
  isMuted: boolean;
  isDeafened: boolean;
  isSpeakingLocal: boolean;
  isSpeakingRemote: boolean;
  isRemoteMuted?: boolean;
  isRemoteDeafened?: boolean;
  isCameraOn?: boolean;
  isRemoteCameraOn?: boolean;
  isSharingScreen: boolean;
  isRemoteSharingScreen: boolean;
  remoteVolume?: number;
  onChangeRemoteVolume?: (val: number) => void;
  isReconnecting?: boolean;
  inputMode?: "voice-activity" | "push-to-talk";
  setInputMode?: (mode: "voice-activity" | "push-to-talk") => void;
  pushToTalkKey?: string;
  setPushToTalkKey?: (key: string) => void;
  isPttPressed?: boolean;
  isMicMonitoring?: boolean;
  onChangeMicMonitoring?: (val: boolean) => void;
  audioInputDevices?: MediaDeviceInfo[];
  audioOutputDevices?: MediaDeviceInfo[];
  videoInputDevices?: MediaDeviceInfo[];
  selectedAudioInput?: string;
  selectedAudioOutput?: string;
  selectedVideoInput?: string;
  onChangeAudioInputDevice?: (deviceId: string) => void;
  onChangeAudioOutputDevice?: (deviceId: string) => void;
  onChangeVideoInputDevice?: (deviceId: string) => void;
  voiceSensitivity?: number;
  onChangeVoiceSensitivity?: (val: number) => void;
  echoCancellation?: boolean;
  onChangeEchoCancellation?: (val: boolean) => void;
  noiseSuppression?: boolean;
  onChangeNoiseSuppression?: (val: boolean) => void;
  autoGainControl?: boolean;
  onChangeAutoGainControl?: (val: boolean) => void;
  onToggleMute: () => void;
  onToggleDeafen: () => void;
  onToggleCamera?: () => void;
  onToggleScreenShare: () => void;
  onKickParticipant?: (targetUserId: string) => void;
  onHangUp: () => void;
  socialFriends?: SocialFriend[];
  roomConfig?: CallRoomConfig | null;
  onUpdateRoomPrivacy?: (isPrivate: boolean, password?: string) => Promise<void> | void;
  notify?: (msg: string, type: "success" | "error" | "info") => void;
}

export type CallFeedId =
  | "remote-screen"
  | "remote-camera"
  | "remote-user"
  | "local-screen"
  | "local-camera"
  | "local-user";

export interface CallFeed {
  id: CallFeedId;
  type: "video" | "voice";
  stream?: MediaStream | null;
  /** Camera stream rendered inside the avatar circle on voice cards */
  cameraStream?: MediaStream | null;
  title: string;
  subtitle?: string;
  tag?: string;
  avatar?: string | null;
  isLocal: boolean;
  isSpeaking: boolean;
  isMuted: boolean;
  isDeafened: boolean;
  isScreen?: boolean;
  isCamera?: boolean;
}

const formatDuration = (secs: number) => {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
};

/**
 * Reusable video element for WebRTC / MediaStream rendering
 */
const VideoRenderer: React.FC<{
  stream: MediaStream | null;
  fitMode?: "contain" | "cover";
  muted?: boolean;
  className?: string;
  onVideoElement?: (el: HTMLVideoElement | null) => void;
}> = ({ stream, fitMode = "contain", muted = true, className = "", onVideoElement }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (stream) {
      if (video.srcObject !== stream) {
        video.srcObject = stream;
      }
      video.play().catch(() => {});
    } else {
      video.srcObject = null;
    }
  }, [stream]);

  return (
    <video
      ref={(el) => {
        videoRef.current = el;
        onVideoElement?.(el);
      }}
      autoPlay
      playsInline
      muted={muted}
      className={`h-full w-full ${fitMode === "cover" ? "object-cover" : "object-contain"} ${className}`}
    />
  );
};

export const VoiceCallWindow: React.FC<VoiceCallWindowProps> = ({
  isOpen,
  onClose,
  session,
  userProfile,
  remoteStream,
  localStream,
  localCameraStream,
  localScreenStream,
  duration,
  isMuted,
  isDeafened,
  isSpeakingLocal,
  isSpeakingRemote,
  isRemoteMuted = false,
  isRemoteDeafened = false,
  isCameraOn = false,
  isRemoteCameraOn = false,
  isSharingScreen,
  isRemoteSharingScreen,
  remoteVolume = 100,
  onChangeRemoteVolume,
  isReconnecting = false,
  inputMode = "voice-activity",
  setInputMode,
  pushToTalkKey = "F8",
  setPushToTalkKey,
  isPttPressed = false,
  isMicMonitoring = false,
  onChangeMicMonitoring,
  audioInputDevices = [],
  audioOutputDevices = [],
  videoInputDevices = [],
  selectedAudioInput = "default",
  selectedAudioOutput = "default",
  selectedVideoInput = "default",
  onChangeAudioInputDevice,
  onChangeAudioOutputDevice,
  onChangeVideoInputDevice,
  voiceSensitivity = 35,
  onChangeVoiceSensitivity,
  echoCancellation = true,
  onChangeEchoCancellation,
  noiseSuppression = true,
  onChangeNoiseSuppression,
  autoGainControl = true,
  onChangeAutoGainControl,
  onToggleMute,
  onToggleDeafen,
  onToggleCamera,
  onToggleScreenShare,
  onKickParticipant,
  onHangUp,
  socialFriends = [],
  roomConfig,
  onUpdateRoomPrivacy,
  notify = () => {},
}) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const activeVideoElRef = useRef<HTMLVideoElement | null>(null);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isRecordingKey, setIsRecordingKey] = useState(false);
  const [isVolumeSliderOpen, setIsVolumeSliderOpen] = useState(false);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isPrivacyModalOpen, setIsPrivacyModalOpen] = useState(false);

  // Focus & Display Controls (Discord style Spotlight / Grid)
  const [focusedFeedId, setFocusedFeedId] = useState<CallFeedId | null>(null);
  const [videoFitMode, setVideoFitMode] = useState<"contain" | "cover">("contain");

  // Live test meter level (RMS) for Settings popover with strict AudioContext cleanup
  const [micVolumeLevel, setMicVolumeLevel] = useState(0);

  // Right-click context menu state
  const [contextMenu, setContextMenu] = useState<{
    isOpen: boolean;
    x: number;
    y: number;
    feed: CallFeed;
  } | null>(null);
  const [userVolumes, setUserVolumes] = useState<Record<string, number>>({});
  const [locallyMutedFeeds, setLocallyMutedFeeds] = useState<Record<string, boolean>>({});

  // On-Demand Stream Watching state (Requirement 3)
  const [watchedStreams, setWatchedStreams] = useState<Record<string, boolean>>({
    "local-screen": true,
    "local-camera": true,
  });

  // Invite Link Copy state (Requirement 4)
  const [isCopiedInvite, setIsCopiedInvite] = useState(false);

  // Sync native Electron fullscreen state on mount
  useEffect(() => {
    if (window.electronAPI?.isFullScreen) {
      void window.electronAPI.isFullScreen().then((full) => {
        setIsFullscreen(Boolean(full));
      });
    }
  }, [isOpen]);

  // Discord-style Auto-Focus Logic
  // When a remote user starts sharing screen, auto-spotlight their stream
  const prevRemoteSharingRef = useRef(isRemoteSharingScreen);
  useEffect(() => {
    if (!prevRemoteSharingRef.current && isRemoteSharingScreen) {
      setFocusedFeedId("remote-screen");
    } else if (prevRemoteSharingRef.current && !isRemoteSharingScreen) {
      if (focusedFeedId === "remote-screen") {
        // Camera is now embedded in remote-user card, return to grid
        setFocusedFeedId(null);
      }
    }
    prevRemoteSharingRef.current = isRemoteSharingScreen;
  }, [isRemoteSharingScreen, focusedFeedId]);

  // Clean up focus if the focused feed is turned off
  useEffect(() => {
    if (focusedFeedId === "local-screen" && !isSharingScreen) {
      setFocusedFeedId(null);
    }
    if (focusedFeedId === "remote-screen" && !isRemoteSharingScreen) {
      setFocusedFeedId(null);
    }
  }, [focusedFeedId, isRemoteSharingScreen, isSharingScreen]);

  // Live Microphone Test Level inside Settings with thorough AudioContext cleanup
  useEffect(() => {
    if (!isSettingsOpen || !localStream) {
      setMicVolumeLevel(0);
      return;
    }

    let ctx: AudioContext | null = null;
    let source: MediaStreamAudioSourceNode | null = null;
    let analyser: AnalyserNode | null = null;
    let animId: number | null = null;
    let isCancelled = false;

    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        ctx = new AudioCtx();
        source = ctx.createMediaStreamSource(localStream);
        analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.3;
        source.connect(analyser);

        const data = new Float32Array(analyser.fftSize);

        const tick = () => {
          if (isCancelled || !analyser) return;
          analyser.getFloatTimeDomainData(data);
          let sumSquares = 0;
          for (let i = 0; i < data.length; i += 1) {
            sumSquares += data[i] * data[i];
          }
          const rms = Math.sqrt(sumSquares / data.length);
          const level = Math.min(100, Math.round(rms * 700));
          setMicVolumeLevel(level);
          animId = requestAnimationFrame(tick);
        };

        animId = requestAnimationFrame(tick);
      }
    } catch (e) {
      console.warn("[VoiceCallWindow] Mic test analyser error:", e);
    }

    return () => {
      isCancelled = true;
      if (animId) cancelAnimationFrame(animId);
      if (source) {
        try {
          source.disconnect();
        } catch {}
      }
      if (analyser) {
        try {
          analyser.disconnect();
        } catch {}
      }
      if (ctx && ctx.state !== "closed") {
        void ctx.close().catch(() => {});
      }
      setMicVolumeLevel(0);
    };
  }, [isSettingsOpen, localStream]);

  // Attach remote stream to persistent audio receiver
  useEffect(() => {
    if (audioRef.current && remoteStream) {
      if (audioRef.current.srcObject !== remoteStream) {
        audioRef.current.srcObject = remoteStream;
      }
      if (selectedAudioOutput && selectedAudioOutput !== "default" && typeof (audioRef.current as any).setSinkId === "function") {
        void (audioRef.current as any).setSinkId(selectedAudioOutput).catch(() => {});
      }
      const isEchoTest = session?.friendUid === "echo-bot";
      audioRef.current.muted = isDeafened || isEchoTest;
      audioRef.current.volume = Math.max(0, Math.min(1, remoteVolume / 100));
      audioRef.current.play().catch(() => {});
    }
  }, [remoteStream, selectedAudioOutput, isDeafened, session?.friendUid, remoteVolume]);

  const defaultInputLabel =
    audioInputDevices.find((d) => d.deviceId === "default" && d.label)?.label ||
    audioInputDevices[0]?.label ||
    "";

  const defaultOutputLabel =
    audioOutputDevices.find((d) => d.deviceId === "default" && d.label)?.label ||
    audioOutputDevices[0]?.label ||
    "";

  const defaultVideoLabel =
    videoInputDevices.find((d) => d.deviceId === "default" && d.label)?.label ||
    videoInputDevices[0]?.label ||
    "";

  // Build the list of active feeds for Grid & Focus mode
  const activeFeeds: CallFeed[] = useMemo(() => {
    if (!session) return [];
    const feeds: CallFeed[] = [];

    // 2. Remote Camera: embedded in remote-user voice card (not a separate tile)
    // 3. Remote Participant Voice Card — camera stream injected directly
    feeds.push({
      id: "remote-user",
      type: "voice",
      title: session.friendName,
      subtitle: isSpeakingRemote ? "Falando..." : "Conectado",
      avatar: session.friendAvatar,
      // Embed camera stream so it shows inside the avatar circle
      cameraStream: isRemoteCameraOn && !isRemoteSharingScreen ? remoteStream : null,
      isLocal: false,
      isSpeaking: isSpeakingRemote,
      isMuted: isRemoteMuted,
      isDeafened: isRemoteDeafened,
      isCamera: isRemoteCameraOn && !isRemoteSharingScreen,
    });

    // 4. Remote Screen Share Feed (kept as separate full tile)
    if (isRemoteSharingScreen && remoteStream) {
      feeds.push({
        id: "remote-screen",
        type: "video",
        stream: remoteStream,
        title: `Tela de ${session.friendName}`,
        subtitle: "Transmissão de Tela",
        tag: "AO VIVO",
        isLocal: false,
        isSpeaking: isSpeakingRemote,
        isMuted: isRemoteMuted,
        isDeafened: isRemoteDeafened,
        isScreen: true,
      });
    }

    // 5. Local Screen Share Feed
    if (isSharingScreen && localScreenStream) {
      feeds.push({
        id: "local-screen",
        type: "video",
        stream: localScreenStream,
        title: "Sua Transmissão",
        subtitle: "Visualização da sua tela",
        tag: "AO VIVO • VOCÊ",
        isLocal: true,
        isSpeaking: isSpeakingLocal,
        isMuted: isMuted,
        isDeafened: isDeafened,
        isScreen: true,
      });
    }

    // 6. Local Participant Voice Card — camera stream injected directly
    feeds.push({
      id: "local-user",
      type: "voice",
      title: userProfile?.displayName || "Você",
      subtitle: isSpeakingLocal ? "Falando..." : "Conectado",
      avatar: userProfile?.photoURL,
      // Embed camera stream so it shows inside the avatar circle
      cameraStream: isCameraOn ? localCameraStream : null,
      isLocal: true,
      isSpeaking: isSpeakingLocal,
      isMuted: isMuted,
      isDeafened: isDeafened,
      isCamera: isCameraOn,
    });

    return feeds;
  }, [
    session,
    isRemoteSharingScreen,
    remoteStream,
    isSpeakingRemote,
    isRemoteMuted,
    isRemoteDeafened,
    isRemoteCameraOn,
    isSharingScreen,
    localScreenStream,
    isSpeakingLocal,
    isMuted,
    isDeafened,
    isCameraOn,
    localCameraStream,
    userProfile?.displayName,
    userProfile?.photoURL,
  ]);

  // Remap focused feed cleanup: local-camera and remote-camera no longer exist as separate feeds
  // Use local-user / remote-user instead if focused feed was on a removed camera feed

  // Identify currently focused feed
  const focusedFeed = activeFeeds.find((f) => f.id === focusedFeedId) || null;
  const isFocusedMode = Boolean(focusedFeed);

  const handleCopyInviteLink = () => {
    if (!session?.chatId) return;
    const inviteUrl = `https://checkpointlauncher.com/call?id=${session.chatId}`;
    void navigator.clipboard.writeText(inviteUrl);
    setIsCopiedInvite(true);
    setTimeout(() => setIsCopiedInvite(false), 2500);
  };

  const categoryPresets: Record<string, { label: string; icon: React.ReactNode }> = {
    resenha_games: { label: "Resenha & Games", icon: <Gamepad2 className="h-3 w-3 text-white" /> },
    gameplay_foco: { label: "Só Gameplay", icon: <Swords className="h-3 w-3 text-white" /> },
    estudos_foco: { label: "Foco & Estudos", icon: <BookOpen className="h-3 w-3 text-white" /> },
    casual_chat: { label: "Conversa Livre", icon: <MessageSquare className="h-3 w-3 text-white" /> },
  };

  const currentCategory = categoryPresets[session?.category || "resenha_games"] || categoryPresets.resenha_games;

  const handleFeedContextMenu = (e: React.MouseEvent, feed: CallFeed) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      isOpen: true,
      x: e.clientX,
      y: e.clientY,
      feed,
    });
  };

  // Toggle focus on click / double click
  const handleToggleFocus = (feedId: CallFeedId) => {
    if (focusedFeedId === feedId) {
      setFocusedFeedId(null);
    } else {
      setFocusedFeedId(feedId);
      // Auto-watch stream when focused
      setWatchedStreams((prev) => ({ ...prev, [feedId]: true }));
    }
  };

  // Picture-in-Picture helper
  const handleTogglePip = async () => {
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else if (activeVideoElRef.current && document.pictureInPictureEnabled) {
        await activeVideoElRef.current.requestPictureInPicture();
      }
    } catch (err) {
      console.warn("[VoiceCallWindow] PiP failed:", err);
    }
  };

  const toggleFullscreen = async () => {
    if (window.electronAPI?.toggleFullScreen) {
      const isFull = await window.electronAPI.toggleFullScreen();
      setIsFullscreen(Boolean(isFull));
      return;
    }
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      void containerRef.current.requestFullscreen();
      setIsFullscreen(true);
    } else {
      void document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  if (!isOpen || !session) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[9995] flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-xl select-none">
        <motion.div
          ref={containerRef}
          initial={{ scale: 0.94, opacity: 0, y: 15 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 10 }}
          transition={{ type: "spring", stiffness: 380, damping: 28 }}
          className="relative flex flex-col w-full max-w-6xl h-[88vh] overflow-hidden rounded-3xl border border-white/10 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-[#1c1d28]/98 via-[#111218]/99 to-[#08090c] shadow-[0_30px_90px_rgba(0,0,0,0.9)]"
        >
          {/* Invisible Remote Audio Receiver */}
          <audio ref={audioRef} autoPlay playsInline />

          {/* Top Bar Header */}
          <div className="flex items-center justify-between px-6 py-3.5 border-b border-white/8 bg-black/35 backdrop-blur-md z-20">
            {/* Left Info: Friend & Duration & Focus Indicator & Category */}
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-white shadow-[0_0_15px_rgba(255,255,255,0.1)] border border-white/15">
                <Radio className="h-4.5 w-4.5 animate-pulse" />
              </div>
              <div>
                <h2 className="text-sm font-black text-white tracking-tight flex items-center gap-2">
                  <span>{session.friendName}</span>
                  <span className="text-xs font-mono font-normal text-white/90 bg-white/10 px-2 py-0.5 rounded-md border border-white/15">
                    {formatDuration(duration)}
                  </span>
                  {isFocusedMode && focusedFeed && (
                    <span className="hidden sm:inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded-md bg-white/10 text-white/90 border border-white/15">
                      <Pin className="h-3 w-3 text-white fill-white" />
                      <span>Focado: {focusedFeed.title}</span>
                    </span>
                  )}
                  {/* Category Pill */}
                  <span className="hidden lg:inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded-md bg-white/5 text-white/70 border border-white/8">
                    {currentCategory.icon}
                    <span>{currentCategory.label}</span>
                  </span>

                  {/* Room Privacy Button */}
                  <button
                    type="button"
                    onClick={() => setIsPrivacyModalOpen(true)}
                    className={`hidden sm:inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded-md border transition cursor-pointer ${
                      session?.isPrivate || roomConfig?.isPrivate
                        ? "bg-amber-500/15 border-amber-500/30 text-amber-300 hover:bg-amber-500/25"
                        : "bg-white/5 border-white/8 text-white/70 hover:bg-white/10 hover:text-white"
                    }`}
                    title={
                      session?.isPrivate || roomConfig?.isPrivate
                        ? "Chamada Privada (requer senha) - Clique para gerenciar"
                        : "Chamada Aberta - Clique para privar com senha"
                    }
                  >
                    {session?.isPrivate || roomConfig?.isPrivate ? (
                      <>
                        <Lock className="h-3 w-3 text-amber-400" />
                        <span>Privada</span>
                      </>
                    ) : (
                      <>
                        <Unlock className="h-3 w-3 text-white/60" />
                        <span>Pública</span>
                      </>
                    )}
                  </button>
                </h2>
                <p className="text-[11px] text-white/40">Chamada Direta Checkpoint</p>
              </div>
            </div>

            {/* Right Actions: Invite Friends Button, View Mode Switcher, Fullscreen, Minimize */}
            <div className="flex items-center gap-2">
              {/* Invite Friends Modal Button */}
              <button
                type="button"
                onClick={() => setIsInviteModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/6 hover:bg-white/12 border border-white/8 text-xs font-bold text-white transition cursor-pointer"
                title="Convidar amigos para a chamada"
              >
                <UserPlus className="h-3.5 w-3.5 text-white/80" />
                <span className="hidden sm:inline">Convidar</span>
              </button>

              {/* View Switcher: Grid Mode vs Focus Mode */}
              <div className="flex items-center gap-1 bg-white/6 p-1 rounded-xl border border-white/8">
                <button
                  type="button"
                  onClick={() => setFocusedFeedId(null)}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    !isFocusedMode
                      ? "bg-white text-black shadow-sm"
                      : "text-white/60 hover:text-white hover:bg-white/10"
                  }`}
                  title="Visualização em Grade (Todos os participantes)"
                >
                  <LayoutGrid className="h-3.5 w-3.5" />
                  <span className="hidden md:inline">Grade</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!isFocusedMode) {
                      const firstVideo = activeFeeds.find((f) => f.type === "video") || activeFeeds[0];
                      if (firstVideo) setFocusedFeedId(firstVideo.id);
                    }
                  }}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    isFocusedMode
                      ? "bg-white text-black shadow-sm"
                      : "text-white/60 hover:text-white hover:bg-white/10"
                  }`}
                  title="Modo Foco / Destaque"
                >
                  <Pin className="h-3.5 w-3.5" />
                  <span className="hidden md:inline">Foco</span>
                </button>
              </div>

              {/* Fullscreen Button */}
              <button
                type="button"
                onClick={() => void toggleFullscreen()}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/6 text-white/60 hover:text-white hover:bg-white/12 transition cursor-pointer"
                title={isFullscreen ? "Sair da tela cheia" : "Tela cheia"}
              >
                <Maximize className="h-4 w-4" />
              </button>

              {/* Minimize Call Button */}
              <button
                type="button"
                onClick={onClose}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/6 text-white/60 hover:text-white hover:bg-white/12 transition cursor-pointer"
                title="Minimizar chamada"
              >
                <Minimize2 className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Reconnection Alert Banner */}
          {isReconnecting && (
            <div className="flex items-center justify-center gap-2 bg-amber-500/20 border-b border-amber-500/30 px-4 py-2 text-amber-300 text-xs font-bold animate-pulse z-10">
              <span className="h-2 w-2 rounded-full bg-amber-400 animate-ping" />
              <span>Conexão de voz instável. Reconectando via ICE restart...</span>
            </div>
          )}

          {/* Main Stage & Content Area */}
          <div className="relative flex-1 overflow-hidden p-4 sm:p-5 flex flex-col items-center justify-center">
            {isFocusedMode && focusedFeed ? (
              /* ========================================================================= */
              /* FOCUS / STAGE VIEW MODE (Discord Style Spotlight + Top Thumbnail Gallery) */
              /* ========================================================================= */
              <div className="flex flex-col h-full w-full gap-3 overflow-hidden">
                {/* Top Thumbnail Gallery Strip of Other Feeds */}
                <div className="flex items-center gap-3 overflow-x-auto pb-1 px-1 scrollbar-thin scrollbar-thumb-white/10 shrink-0 min-h-[90px] max-h-[110px]">
                  {activeFeeds.map((feed) => {
                    const isCurrent = feed.id === focusedFeed.id;
                    return (
                      <motion.div
                        key={feed.id}
                        layout
                        onClick={() => handleToggleFocus(feed.id)}
                        onContextMenu={(e) => handleFeedContextMenu(e, feed)}
                        className={`group relative flex items-center justify-center rounded-2xl overflow-hidden cursor-pointer transition-all duration-200 shrink-0 w-36 sm:w-44 h-20 sm:h-24 bg-black/60 border ${
                          isCurrent
                            ? "border-white ring-2 ring-white/40 shadow-[0_0_20px_rgba(255,255,255,0.25)]"
                            : feed.isSpeaking
                            ? "border-white/80 ring-2 ring-white/30 hover:border-white"
                            : "border-white/10 hover:border-white/30 hover:bg-white/5"
                        }`}
                        title={`Clique para focar em ${feed.title}`}
                      >
                        {feed.type === "video" && feed.stream ? (
                          <div className="h-full w-full bg-black/80">
                            <VideoRenderer stream={feed.stream} fitMode="cover" />
                          </div>
                        ) : (
                          <div className="flex flex-col items-center justify-center p-2 gap-1.5 text-center">
                            <div
                              className={`h-9 w-9 rounded-full overflow-hidden border transition-all duration-150 ${
                                feed.isSpeaking
                                  ? "border-white ring-2 ring-white/60 scale-105"
                                  : "border-white/15"
                              }`}
                            >
                              {feed.avatar ? (
                                <img src={feed.avatar} alt="" className="h-full w-full object-cover" />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center bg-white/10 text-xs font-bold text-white">
                                  {feed.title.slice(0, 2).toUpperCase()}
                                </div>
                              )}
                            </div>
                            <span className="text-[11px] font-bold text-white/90 truncate max-w-[120px]">
                              {feed.title}
                            </span>
                          </div>
                        )}

                        {/* Top Badge on Thumbnail */}
                        <div className="absolute top-1.5 left-1.5 flex items-center gap-1">
                          {feed.tag && (
                            <span className="text-[8px] font-black uppercase px-1.5 py-0.5 rounded bg-black/80 text-white border border-white/15 backdrop-blur-md">
                              {feed.tag}
                            </span>
                          )}
                          {isCurrent && (
                            <span className="flex items-center gap-0.5 text-[8px] font-black uppercase px-1.5 py-0.5 rounded bg-white text-black shadow-sm">
                              <Pin className="h-2.5 w-2.5 fill-black" />
                              <span>Focado</span>
                            </span>
                          )}
                        </div>

                        {/* Bottom Status / Name on Thumbnail */}
                        <div className="absolute bottom-1.5 left-1.5 right-1.5 flex items-center justify-between px-1.5 py-0.5 rounded-lg bg-black/75 backdrop-blur-md text-[10px] text-white">
                          <span className="truncate font-semibold text-[10px]">{feed.title}</span>
                          <div className="flex items-center gap-1 shrink-0">
                            {feed.isDeafened ? (
                              <VolumeX className="h-3 w-3 text-rose-400" />
                            ) : feed.isMuted ? (
                              <MicOff className="h-3 w-3 text-rose-400" />
                            ) : null}
                          </div>
                        </div>

                        {/* Hover Overlay Spotlight Action */}
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                          <div className="flex items-center gap-1 px-2 py-1 rounded-xl bg-white text-black font-black text-[10px] shadow-lg">
                            <Pin className="h-3 w-3" />
                            <span>{isCurrent ? "Desafixar" : "Focar"}</span>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>

                {/* Big Main Spotlight Stage */}
                <div
                  onDoubleClick={() => handleToggleFocus(focusedFeed.id)}
                  onContextMenu={(e) => handleFeedContextMenu(e, focusedFeed)}
                  className="group relative flex-1 w-full rounded-2xl overflow-hidden bg-black/90 border border-white/10 shadow-2xl flex items-center justify-center"
                >
                  {focusedFeed.type === "video" && focusedFeed.stream ? (
                    // Video Feed Stage (Screen Share or Camera)
                    <div className="relative h-full w-full flex items-center justify-center">
                      <VideoRenderer
                        stream={focusedFeed.stream}
                        fitMode={videoFitMode}
                        onVideoElement={(el) => {
                          activeVideoElRef.current = el;
                        }}
                      />

                      {/* Top Overlay Controls Bar (Visible on hover) */}
                      <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none">
                        {/* Title & Live Badge */}
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-black/75 border border-white/10 backdrop-blur-md pointer-events-auto">
                          <span className="h-2 w-2 rounded-full bg-white animate-pulse" />
                          <span className="text-xs font-bold text-white">{focusedFeed.title}</span>
                          {focusedFeed.tag && (
                            <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-white/15 text-white/90">
                              {focusedFeed.tag}
                            </span>
                          )}
                        </div>

                        {/* Stream Action Toolbar */}
                        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-black/75 border border-white/10 backdrop-blur-md opacity-90 group-hover:opacity-100 transition-opacity pointer-events-auto">
                          {/* Remote Participant Volume Control */}
                          {!focusedFeed.isLocal && onChangeRemoteVolume && (
                            <div className="relative">
                              <button
                                type="button"
                                onClick={() => setIsVolumeSliderOpen((prev) => !prev)}
                                className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors cursor-pointer ${
                                  isVolumeSliderOpen
                                    ? "bg-white text-black"
                                    : "text-white/70 hover:text-white hover:bg-white/10"
                                }`}
                                title={`Ajustar volume de ${focusedFeed.title} (${remoteVolume}%)`}
                              >
                                {remoteVolume === 0 ? (
                                  <VolumeX className="h-4 w-4" />
                                ) : remoteVolume < 60 ? (
                                  <Volume1 className="h-4 w-4" />
                                ) : (
                                  <Volume2 className="h-4 w-4" />
                                )}
                              </button>

                              {/* Volume Slider Popover */}
                              <AnimatePresence>
                                {isVolumeSliderOpen && (
                                  <motion.div
                                    initial={{ opacity: 0, scale: 0.9, y: 5 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.9, y: 5 }}
                                    className="absolute top-10 right-0 p-3 w-48 rounded-2xl bg-[#14151e]/98 border border-white/15 shadow-2xl backdrop-blur-xl z-50 space-y-2"
                                  >
                                    <div className="flex items-center justify-between text-[11px] font-bold text-white">
                                      <span>Volume do Usuário</span>
                                      <span className="font-mono text-white/90">{remoteVolume}%</span>
                                    </div>
                                    <input
                                      type="range"
                                      min={0}
                                      max={200}
                                      value={remoteVolume}
                                      onChange={(e) => onChangeRemoteVolume(Number(e.target.value))}
                                      className="w-full accent-white cursor-pointer"
                                    />
                                    <div className="flex justify-between text-[9px] font-bold text-white/40">
                                      <span onClick={() => onChangeRemoteVolume(0)} className="cursor-pointer hover:text-white">
                                        Mudo
                                      </span>
                                      <span onClick={() => onChangeRemoteVolume(100)} className="cursor-pointer hover:text-white">
                                        100%
                                      </span>
                                      <span onClick={() => onChangeRemoteVolume(200)} className="cursor-pointer hover:text-white">
                                        200%
                                      </span>
                                    </div>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          )}

                          {/* Aspect Ratio Mode (Contain vs Cover) */}
                          <button
                            type="button"
                            onClick={() => setVideoFitMode((prev) => (prev === "contain" ? "cover" : "contain"))}
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                            title={videoFitMode === "contain" ? "Preencher janela (Zoom)" : "Ajustar à janela"}
                          >
                            {videoFitMode === "contain" ? <Scan className="h-4 w-4" /> : <Scaling className="h-4 w-4" />}
                          </button>

                          {/* Picture-in-Picture (PiP) */}
                          <button
                            type="button"
                            onClick={() => void handleTogglePip()}
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                            title="Mini-player flutuante (PiP)"
                          >
                            <PictureInPicture2 className="h-4 w-4" />
                          </button>

                          {/* Fullscreen Button */}
                          <button
                            type="button"
                            onClick={() => void toggleFullscreen()}
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                            title="Tela cheia"
                          >
                            <Maximize2 className="h-4 w-4" />
                          </button>

                          {/* Unpin / Return to Grid */}
                          <button
                            type="button"
                            onClick={() => setFocusedFeedId(null)}
                            className="flex items-center gap-1 px-2.5 h-8 rounded-lg bg-white/10 text-white font-bold text-xs hover:bg-white/20 transition-colors cursor-pointer ml-1"
                            title="Desafixar e voltar para a Grade"
                          >
                            <PinOff className="h-3.5 w-3.5" />
                            <span>Desafixar</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    // Voice Card Stage (Focused on User's Voice Profile)
                    <div className="flex flex-col items-center justify-center p-8 text-center space-y-6">
                      <div className="relative">
                        {/* Big Glowing Speaking Ring */}
                        <div
                          className={`relative h-36 w-36 rounded-full overflow-hidden border-4 transition-all duration-150 ${
                            focusedFeed.isSpeaking
                              ? "border-white ring-8 ring-white/30 shadow-[0_0_35px_rgba(255,255,255,0.35)] scale-[1.04]"
                              : "border-white/15"
                          }`}
                        >
                          {focusedFeed.avatar ? (
                            <img src={focusedFeed.avatar} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center bg-white/10 text-4xl font-black text-white">
                              {focusedFeed.title.slice(0, 2).toUpperCase()}
                            </div>
                          )}
                        </div>

                        {/* Mute/Deafen Badge */}
                        {focusedFeed.isDeafened ? (
                          <div className="absolute bottom-1 right-1 flex h-9 w-9 items-center justify-center rounded-full bg-rose-600 text-white border-2 border-[#12131a] shadow-lg">
                            <VolumeX className="h-4.5 w-4.5" />
                          </div>
                        ) : focusedFeed.isMuted ? (
                          <div className="absolute bottom-1 right-1 flex h-9 w-9 items-center justify-center rounded-full bg-rose-600 text-white border-2 border-[#12131a] shadow-lg">
                            <MicOff className="h-4.5 w-4.5" />
                          </div>
                        ) : null}
                      </div>

                      <div className="space-y-1.5">
                        <h3 className="text-xl font-black text-white tracking-tight">{focusedFeed.title}</h3>
                        <p className="text-xs text-white/50 flex items-center justify-center gap-1.5">
                          {focusedFeed.isSpeaking ? (
                            <span className="text-white font-bold flex items-center gap-1">
                              <Activity className="h-3.5 w-3.5 animate-pulse" />
                              Falando ao vivo
                            </span>
                          ) : (
                            <span>Em chamada</span>
                          )}
                        </p>
                      </div>

                      {/* Discord-style User Volume Slider for Remote Participant in Stage */}
                      {!focusedFeed.isLocal && onChangeRemoteVolume && (
                        <div className="w-64 p-3 rounded-2xl bg-white/5 border border-white/8 space-y-2">
                          <div className="flex items-center justify-between text-xs font-bold text-white">
                            <span>Volume de {focusedFeed.title}</span>
                            <span className="font-mono text-white/90">{remoteVolume}%</span>
                          </div>
                          <input
                            type="range"
                            min={0}
                            max={200}
                            value={remoteVolume}
                            onChange={(e) => onChangeRemoteVolume(Number(e.target.value))}
                            className="w-full accent-white cursor-pointer"
                          />
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={() => setFocusedFeedId(null)}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 text-white text-xs font-bold hover:bg-white/20 transition cursor-pointer"
                      >
                        <LayoutGrid className="h-4 w-4" />
                        <span>Voltar para Modo Grade</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* ========================================================================= */
              /* GRID VIEW MODE (Discord Style Balanced Equal Tiles)                      */
              /* ========================================================================= */
              <div
                className={`grid gap-5 w-full h-full max-w-5xl items-center justify-center ${
                  activeFeeds.length <= 2
                    ? "grid-cols-1 sm:grid-cols-2 max-w-3xl"
                    : activeFeeds.length === 3
                    ? "grid-cols-1 sm:grid-cols-2 md:grid-cols-3"
                    : "grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3"
                }`}
              >
                {activeFeeds.map((feed) => {
                  const hasCameraFill = feed.type === "voice" && Boolean(feed.cameraStream);
                  return (
                    <motion.div
                      key={feed.id}
                      layout
                      onDoubleClick={() => handleToggleFocus(feed.id)}
                      onContextMenu={(e) => handleFeedContextMenu(e, feed)}
                      className={`group relative flex flex-col items-center justify-center rounded-3xl border transition-all duration-300 w-full h-full min-h-[220px] max-h-[360px] overflow-hidden ${
                        feed.type === "video" || hasCameraFill
                          ? "bg-black/90 border-white/10 shadow-xl p-0"
                          : "bg-white/[0.025] hover:bg-white/[0.045] border-white/8 hover:border-white/15 backdrop-blur-md p-6"
                      } ${
                        hasCameraFill && feed.isSpeaking
                          ? "border-white ring-2 ring-white/40 shadow-[0_0_25px_rgba(255,255,255,0.3)]"
                          : !hasCameraFill && feed.isSpeaking
                          ? "border-white/30 bg-white/[0.04]"
                          : ""
                      }`}
                    >
                      {hasCameraFill ? (
                        // ── Camera ON: fills entire card rectangle (Discord-style video tile) ──
                        <div className="relative h-full w-full">
                          <VideoRenderer
                            stream={feed.cameraStream!}
                            fitMode="cover"
                            muted={feed.isLocal}
                          />

                          {/* Bottom gradient overlay: name + status */}
                          <div className="absolute bottom-0 inset-x-0 flex items-end justify-between px-3 py-2.5 bg-gradient-to-t from-black/80 via-black/20 to-transparent pointer-events-none">
                            <div className="flex items-center gap-1.5">
                              {feed.isSpeaking && (
                                <span className="h-2 w-2 rounded-full bg-white animate-pulse shrink-0" />
                              )}
                              <span className="text-xs font-bold text-white drop-shadow truncate max-w-[130px]">
                                {feed.title}
                              </span>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              {feed.isDeafened ? (
                                <VolumeX className="h-3.5 w-3.5 text-rose-400" />
                              ) : feed.isMuted ? (
                                <MicOff className="h-3.5 w-3.5 text-rose-400" />
                              ) : (
                                <Camera className="h-3 w-3 text-white/50" />
                              )}
                            </div>
                          </div>

                          {/* PTT badge top-right */}
                          {feed.isLocal && inputMode === "push-to-talk" && (
                            <div className="absolute top-2 right-2 pointer-events-none">
                              <span
                                className={`text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wider ${
                                  isPttPressed
                                    ? "bg-white/20 text-white border-white/40 animate-pulse"
                                    : "bg-black/60 text-white/50 border-white/10"
                                }`}
                              >
                                PTT [{pushToTalkKey}]
                              </span>
                            </div>
                          )}

                          {/* Hover overlay: Focus button */}
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                            <button
                              type="button"
                              onClick={() => handleToggleFocus(feed.id)}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white text-black font-black text-xs shadow-lg hover:scale-105 transition cursor-pointer"
                            >
                              <Pin className="h-3.5 w-3.5" />
                              <span>Focar no Palco</span>
                            </button>
                          </div>
                        </div>

                      ) : feed.type === "video" && feed.stream ? (
                        feed.id === "remote-screen" && !watchedStreams["remote-screen"] ? (
                          // On-Demand Screen Share Placeholder
                          <div className="relative h-full w-full flex flex-col items-center justify-center p-6 text-center space-y-3 bg-black/85">
                            <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/10 border border-white/15 text-[10px] font-black uppercase text-white">
                              <span className="h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
                              <span>Transmissão Ao Vivo</span>
                            </div>
                            <div className="space-y-1">
                              <p className="text-sm font-black text-white">{feed.title}</p>
                              <p className="text-[11px] text-white/40 max-w-[200px]">Economizando banda e GPU em segundo plano.</p>
                            </div>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setWatchedStreams((prev) => ({ ...prev, [feed.id]: true }));
                              }}
                              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white text-black font-black text-xs hover:scale-105 active:scale-95 shadow-lg transition cursor-pointer"
                            >
                              <Tv className="h-4 w-4" />
                              <span>Assistir Transmissão</span>
                            </button>
                          </div>
                        ) : (
                          // Live Video Tile (screen share)
                          <div className="relative h-full w-full flex items-center justify-center">
                            <VideoRenderer stream={feed.stream} fitMode="contain" />
                            <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-black/80 border border-white/10 backdrop-blur-md">
                              <span className="h-2 w-2 rounded-full bg-white animate-pulse" />
                              <span className="text-xs font-bold text-white truncate max-w-[130px]">{feed.title}</span>
                            </div>
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-2 transition-opacity">
                              <button
                                type="button"
                                onClick={() => handleToggleFocus(feed.id)}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white text-black font-black text-xs shadow-lg hover:scale-105 transition cursor-pointer"
                              >
                                <Pin className="h-3.5 w-3.5" />
                                <span>Focar no Palco</span>
                              </button>
                              {feed.id === "remote-screen" && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setWatchedStreams((prev) => ({ ...prev, [feed.id]: false }));
                                  }}
                                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-black/80 hover:bg-black text-white/80 hover:text-white font-bold text-xs border border-white/15 transition cursor-pointer"
                                >
                                  <Tv className="h-3.5 w-3.5" />
                                  <span>Pausar</span>
                                </button>
                              )}
                            </div>
                          </div>
                        )
                      ) : (
                        // ── Voice-only card: avatar circle (camera OFF) ──
                        <div className="flex flex-col items-center justify-center text-center">
                          <div className="relative mb-3">
                            <div
                              className={`relative h-24 w-24 sm:h-28 sm:w-28 rounded-full overflow-hidden border-[3px] transition-all duration-150 ${
                                feed.isSpeaking
                                  ? "border-white ring-4 ring-white/40 shadow-[0_0_30px_rgba(255,255,255,0.35)] scale-[1.05]"
                                  : "border-white/10"
                              }`}
                            >
                              {feed.avatar ? (
                                <img src={feed.avatar} alt="" className="h-full w-full object-cover" />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center bg-white/10 text-2xl sm:text-3xl font-black text-white border border-white/10">
                                  {feed.title.slice(0, 2).toUpperCase()}
                                </div>
                              )}
                            </div>
                            {feed.isDeafened ? (
                              <div className="absolute bottom-0 right-0 flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-full bg-rose-600 text-white border-2 border-[#12131a] shadow-lg">
                                <VolumeX className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                              </div>
                            ) : feed.isMuted ? (
                              <div className="absolute bottom-0 right-0 flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-full bg-rose-600 text-white border-2 border-[#12131a] shadow-lg">
                                <MicOff className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                              </div>
                            ) : null}
                          </div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm sm:text-base font-black text-white tracking-tight">{feed.title}</h4>
                            {feed.isLocal && inputMode === "push-to-talk" && (
                              <span
                                className={`text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wider ${
                                  isPttPressed
                                    ? "bg-white/20 text-white border-white/40 animate-pulse"
                                    : "bg-white/5 text-white/50 border-white/10"
                                }`}
                              >
                                PTT [{pushToTalkKey}]
                              </span>
                            )}
                          </div>
                          <div className="mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              type="button"
                              onClick={() => handleToggleFocus(feed.id)}
                              className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-white/10 hover:bg-white text-white hover:text-black font-bold text-xs transition cursor-pointer"
                            >
                              <Pin className="h-3 w-3" />
                              <span>Focar</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Voice & Devices Settings Modal */}
          <AnimatePresence>
            {isSettingsOpen && (
              <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl">
                {/* Backdrop Click Dismiss */}
                <div
                  className="absolute inset-0"
                  onClick={() => setIsSettingsOpen(false)}
                />

                <motion.div
                  initial={{ opacity: 0, y: 15, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  transition={{ type: "spring", stiffness: 380, damping: 28 }}
                  className="relative flex flex-col w-full max-w-xl max-h-[85vh] overflow-hidden rounded-3xl border border-white/10 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#1c1d28]/98 via-[#111218]/99 to-[#08090c] shadow-[0_30px_90px_rgba(0,0,0,0.95)] backdrop-blur-2xl z-10"
                >
                  {/* Modal Header */}
                  <div className="flex items-center justify-between px-6 py-4.5 border-b border-white/8 bg-black/30 backdrop-blur-md">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-white border border-white/10 shadow-sm">
                        <Sliders className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="text-sm font-black text-white tracking-tight uppercase">
                          Configurações de Voz & Dispositivos
                        </h3>
                        <p className="text-[11px] text-white/40">
                          Ajuste dispositivos, sensibilidade e filtros de áudio
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsSettingsOpen(false)}
                      className="h-8 w-8 flex items-center justify-center rounded-xl bg-white/5 text-white/60 hover:text-white hover:bg-white/15 transition cursor-pointer"
                      title="Fechar configurações"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Modal Body Scroll Area */}
                  <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar pr-3">
                    {/* 1. Device Selectors Card */}
                    <div className="p-4 rounded-2xl border border-white/8 bg-white/[0.025] space-y-3.5">
                      <h4 className="text-[11px] font-black uppercase tracking-wider text-white/50 flex items-center gap-1.5">
                        <Headphones className="h-3.5 w-3.5 text-white/70" />
                        <span>Dispositivos de Entrada & Saída</span>
                      </h4>

                      {/* Microfone */}
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-white/70 flex items-center gap-1.5">
                          <Mic className="h-3.5 w-3.5 text-white/70" />
                          <span>Dispositivo de Microfone</span>
                        </label>
                        <select
                          value={selectedAudioInput}
                          onChange={(e) => onChangeAudioInputDevice?.(e.target.value)}
                          className="w-full rounded-xl border border-white/10 bg-[#161722] px-3.5 py-2.5 text-xs font-medium text-white focus:outline-none focus:ring-1 focus:ring-white/30 cursor-pointer"
                        >
                          <option value="default" className="bg-[#181922] text-white">
                            {defaultInputLabel && defaultInputLabel !== "default"
                              ? `Padrão do Sistema (${defaultInputLabel.replace(/^Padrão - /i, "")})`
                              : "Padrão do Sistema (Detectado)"}
                          </option>
                          {audioInputDevices.map((dev) => (
                            <option key={dev.deviceId} value={dev.deviceId} className="bg-[#181922] text-white">
                              {dev.label || `Microfone (${dev.deviceId.slice(0, 8)}...)`}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Teste de Microfone em Tempo Real com RMS */}
                      <div className="space-y-1.5 bg-black/30 p-3 rounded-xl border border-white/6">
                        <div className="flex items-center justify-between text-[11px] font-bold">
                          <span className="text-white/60 flex items-center gap-1">
                            <Activity className="h-3 w-3 text-white/70" />
                            Teste de Volume ao Vivo
                          </span>
                          <span className="font-mono text-white/80">{micVolumeLevel}%</span>
                        </div>
                        <div className="relative h-2 w-full overflow-hidden rounded-full bg-white/10">
                          <div
                            className="h-full bg-white shadow-[0_0_10px_rgba(255,255,255,0.4)] transition-all duration-75"
                            style={{ width: `${micVolumeLevel}%` }}
                          />
                        </div>
                      </div>

                      {/* Retorno de Microfone / Ouvir Própria Voz (Sidetone) */}
                      <label className="flex items-center justify-between p-3 rounded-xl border border-white/6 bg-black/20 cursor-pointer hover:bg-black/30 transition">
                        <div className="flex items-center gap-2.5">
                          <Headphones className="h-4 w-4 text-white/70" />
                          <div>
                            <p className="text-xs font-bold text-white">Ouvir minha própria voz (Retorno)</p>
                            <p className="text-[10px] text-white/40">Reproduz seu microfone nos fones para você se escutar</p>
                          </div>
                        </div>
                        <input
                          type="checkbox"
                          checked={Boolean(isMicMonitoring)}
                          onChange={(e) => onChangeMicMonitoring?.(e.target.checked)}
                          className="h-4 w-4 rounded accent-white cursor-pointer"
                        />
                      </label>

                      {/* Alto-Falante */}
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-white/70 flex items-center gap-1.5">
                          <Headphones className="h-3.5 w-3.5 text-white/70" />
                          <span>Dispositivo de Saída (Alto-Falante)</span>
                        </label>
                        <select
                          value={selectedAudioOutput}
                          onChange={(e) => onChangeAudioOutputDevice?.(e.target.value)}
                          className="w-full rounded-xl border border-white/10 bg-[#161722] px-3.5 py-2.5 text-xs font-medium text-white focus:outline-none focus:ring-1 focus:ring-white/30 cursor-pointer"
                        >
                          <option value="default" className="bg-[#181922] text-white">
                            {defaultOutputLabel && defaultOutputLabel !== "default"
                              ? `Padrão do Sistema (${defaultOutputLabel.replace(/^Padrão - /i, "")})`
                              : "Padrão do Sistema (Detectado)"}
                          </option>
                          {audioOutputDevices.map((dev) => (
                            <option key={dev.deviceId} value={dev.deviceId} className="bg-[#181922] text-white">
                              {dev.label || `Alto-Falante (${dev.deviceId.slice(0, 8)}...)`}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Câmera */}
                      {videoInputDevices.length > 0 && (
                        <div className="space-y-1">
                          <label className="text-[11px] font-bold text-white/70 flex items-center gap-1.5">
                            <Camera className="h-3.5 w-3.5 text-white/70" />
                            <span>Câmera de Vídeo</span>
                          </label>
                          <select
                            value={selectedVideoInput}
                            onChange={(e) => onChangeVideoInputDevice?.(e.target.value)}
                            className="w-full rounded-xl border border-white/10 bg-[#161722] px-3.5 py-2.5 text-xs font-medium text-white focus:outline-none focus:ring-1 focus:ring-white/30 cursor-pointer"
                          >
                            <option value="default" className="bg-[#181922] text-white">
                              {defaultVideoLabel && defaultVideoLabel !== "default"
                                ? `Padrão do Sistema (${defaultVideoLabel.replace(/^Padrão - /i, "")})`
                                : "Padrão do Sistema (Detectado)"}
                            </option>
                            {videoInputDevices.map((dev) => (
                              <option key={dev.deviceId} value={dev.deviceId} className="bg-[#181922] text-white">
                                {dev.label || `Câmera (${dev.deviceId.slice(0, 8)}...)`}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>

                    {/* 2. Sensibilidade de Atividade de Voz Card */}
                    <div className="p-4 rounded-2xl border border-white/8 bg-white/[0.025] space-y-2">
                      <div className="flex items-center justify-between text-[11px] font-bold">
                        <span className="text-white/70">Sensibilidade de Voz (VAD)</span>
                        <span className="font-mono text-white/90 bg-white/10 px-2 py-0.5 rounded-md border border-white/10">
                          {voiceSensitivity}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={voiceSensitivity}
                        onChange={(e) => onChangeVoiceSensitivity?.(Number(e.target.value))}
                        className="w-full accent-white cursor-pointer"
                      />
                      <div className="flex justify-between text-[9px] font-bold uppercase tracking-wider text-white/30">
                        <span>Menos Sensível (0%)</span>
                        <span>Mais Sensível (100%)</span>
                      </div>
                    </div>

                    {/* 3. Toggles de Processamento de Áudio Card */}
                    <div className="p-4 rounded-2xl border border-white/8 bg-white/[0.025] space-y-2.5">
                      <h4 className="text-[11px] font-black uppercase tracking-wider text-white/50">
                        Processamento de Áudio
                      </h4>
                      <div className="grid grid-cols-3 gap-2">
                        <button
                          type="button"
                          onClick={() => onChangeEchoCancellation?.(!echoCancellation)}
                          className={`p-2.5 rounded-xl border text-[11px] font-bold flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
                            echoCancellation
                              ? "bg-white text-black font-black shadow-sm border-white"
                              : "bg-white/5 text-white/40 border-white/10 hover:bg-white/10 hover:text-white"
                          }`}
                        >
                          <span>Anti-Eco</span>
                          {echoCancellation && <Check className="h-3.5 w-3.5" />}
                        </button>

                        <button
                          type="button"
                          onClick={() => onChangeNoiseSuppression?.(!noiseSuppression)}
                          className={`p-2.5 rounded-xl border text-[11px] font-bold flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
                            noiseSuppression
                              ? "bg-white text-black font-black shadow-sm border-white"
                              : "bg-white/5 text-white/40 border-white/10 hover:bg-white/10 hover:text-white"
                          }`}
                        >
                          <span>Supressão Ruído</span>
                          {noiseSuppression && <Check className="h-3.5 w-3.5" />}
                        </button>

                        <button
                          type="button"
                          onClick={() => onChangeAutoGainControl?.(!autoGainControl)}
                          className={`p-2.5 rounded-xl border text-[11px] font-bold flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
                            autoGainControl
                              ? "bg-white text-black font-black shadow-sm border-white"
                              : "bg-white/5 text-white/40 border-white/10 hover:bg-white/10 hover:text-white"
                          }`}
                        >
                          <span>Ganho Auto</span>
                          {autoGainControl && <Check className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                    </div>

                    {/* 4. Modo de Entrada Card */}
                    <div className="p-4 rounded-2xl border border-white/8 bg-white/[0.025] space-y-3">
                      <h4 className="text-[11px] font-black uppercase tracking-wider text-white/50">
                        Modo de Transmissão
                      </h4>
                      <div className="grid grid-cols-2 gap-1.5 bg-black/30 p-1 rounded-xl border border-white/8">
                        <button
                          type="button"
                          onClick={() => setInputMode?.("voice-activity")}
                          className={`py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            inputMode === "voice-activity"
                              ? "bg-white text-black font-black shadow-sm"
                              : "text-white/50 hover:text-white hover:bg-white/5"
                          }`}
                        >
                          Atividade de Voz
                        </button>
                        <button
                          type="button"
                          onClick={() => setInputMode?.("push-to-talk")}
                          className={`py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            inputMode === "push-to-talk"
                              ? "bg-white text-black font-black shadow-sm"
                              : "text-white/50 hover:text-white hover:bg-white/5"
                          }`}
                        >
                          Push-to-Talk
                        </button>
                      </div>

                      {inputMode === "push-to-talk" && setPushToTalkKey && (
                        <div className="flex items-center justify-between gap-3 p-3 rounded-xl border border-white/8 bg-black/20">
                          <div>
                            <p className="text-xs font-bold text-white flex items-center gap-1.5">
                              <Keyboard className="h-3.5 w-3.5 text-white/70" />
                              Atalho Push-to-Talk
                            </p>
                            <p className="text-[10px] text-white/40">Segure a tecla para falar no jogo ou aplicativo</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setIsRecordingKey(true);
                              const onKey = (e: KeyboardEvent) => {
                                e.preventDefault();
                                e.stopPropagation();
                                const key = e.key === " " ? "Space" : e.key.length === 1 ? e.key.toUpperCase() : e.key;
                                setPushToTalkKey(key);
                                setIsRecordingKey(false);
                                window.removeEventListener("keydown", onKey, true);
                              };
                              window.addEventListener("keydown", onKey, true);
                            }}
                            className={`px-3 py-1.5 rounded-lg border text-xs font-mono font-bold transition-all cursor-pointer ${
                              isRecordingKey
                                ? "bg-white/20 text-white border-white/40 animate-pulse"
                                : "bg-white/10 text-white border-white/20 hover:bg-white/20"
                            }`}
                          >
                            {isRecordingKey ? "Pressione tecla..." : pushToTalkKey}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Modal Footer */}
                  <div className="flex items-center justify-end px-6 py-3.5 border-t border-white/8 bg-black/30 backdrop-blur-md">
                    <button
                      type="button"
                      onClick={() => setIsSettingsOpen(false)}
                      className="px-5 py-2 rounded-xl bg-white text-black font-black text-xs hover:bg-white/90 active:scale-95 transition cursor-pointer shadow-sm"
                    >
                      Concluído
                    </button>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          {/* Bottom Call Controls Dock (Discord 6-Button Grid) */}
          <div className="flex items-center justify-center gap-3 p-4 border-t border-white/8 bg-black/40 backdrop-blur-xl z-20">
            {/* 1. Mute Button */}
            <button
              type="button"
              onClick={onToggleMute}
              className={`flex h-12 w-12 items-center justify-center rounded-2xl transition-all duration-200 cursor-pointer ${
                isMuted
                  ? "bg-rose-500 text-white shadow-[0_0_18px_rgba(244,63,94,0.45)] scale-105"
                  : "bg-white/8 text-white hover:bg-white/15 hover:scale-105"
              }`}
              title={isMuted ? "Desmutar microfone" : "Mutar microfone"}
            >
              {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
            </button>

            {/* 2. Video / Camera Button */}
            {onToggleCamera && (
              <button
                type="button"
                onClick={onToggleCamera}
                className={`flex h-12 w-12 items-center justify-center rounded-2xl transition-all duration-200 cursor-pointer ${
                  isCameraOn
                    ? "bg-white text-black shadow-md scale-105"
                    : "bg-white/8 text-white hover:bg-white/15 hover:scale-105"
                }`}
                title={isCameraOn ? "Desligar câmera" : "Ligar câmera"}
              >
                {isCameraOn ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
              </button>
            )}

            {/* 3. Share Screen Button */}
            <button
              type="button"
              onClick={onToggleScreenShare}
              className={`flex h-12 w-12 items-center justify-center rounded-2xl transition-all duration-200 cursor-pointer ${
                isSharingScreen
                  ? "bg-white text-black shadow-md scale-105"
                  : "bg-white/8 text-white hover:bg-white/15 hover:scale-105"
              }`}
              title={isSharingScreen ? "Parar transmissão" : "Transmitir tela ou jogo"}
            >
              {isSharingScreen ? <MonitorOff className="h-5 w-5" /> : <MonitorUp className="h-5 w-5" />}
            </button>

            {/* 4. Deafen Button */}
            <button
              type="button"
              onClick={onToggleDeafen}
              className={`flex h-12 w-12 items-center justify-center rounded-2xl transition-all duration-200 cursor-pointer ${
                isDeafened
                  ? "bg-rose-500 text-white shadow-[0_0_18px_rgba(244,63,94,0.45)] scale-105"
                  : "bg-white/8 text-white hover:bg-white/15 hover:scale-105"
              }`}
              title={isDeafened ? "Desativar silêncio total" : "Silenciar tudo (Deafen)"}
            >
              {isDeafened ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
            </button>

            {/* 5. Voice Settings Button (Gear) */}
            <button
              type="button"
              onClick={() => setIsSettingsOpen((prev) => !prev)}
              className={`flex h-12 w-12 items-center justify-center rounded-2xl transition-all duration-200 cursor-pointer ${
                isSettingsOpen
                  ? "bg-white text-black shadow-md"
                  : "bg-white/8 text-white hover:bg-white/15 hover:scale-105"
              }`}
              title="Ajustes de voz & entrada"
            >
              <Settings className="h-5 w-5" />
            </button>

            {/* 6. Disconnect Button */}
            <button
              type="button"
              onClick={onHangUp}
              className="flex h-12 px-6 items-center justify-center gap-2 rounded-2xl bg-rose-600 text-white font-black text-xs uppercase tracking-wider hover:bg-rose-500 hover:scale-105 active:scale-95 transition-all duration-200 shadow-lg shadow-rose-600/35 cursor-pointer ml-2"
              title="Desconectar"
            >
              <PhoneOff className="h-4.5 w-4.5" />
              <span>Desconectar</span>
            </button>
          </div>

          {/* Right-Click Participant Context Menu */}
          {contextMenu && contextMenu.isOpen && (
            <ParticipantContextMenu
              feed={{
                ...contextMenu.feed,
                isScreenLiveAvailable: contextMenu.feed.id === "remote-screen",
                isCurrentlyWatched: Boolean(watchedStreams[contextMenu.feed.id]),
              }}
              x={contextMenu.x}
              y={contextMenu.y}
              volume={userVolumes[contextMenu.feed.id] ?? (contextMenu.feed.isLocal ? 100 : (remoteVolume ?? 100))}
              isLocallyMuted={locallyMutedFeeds[contextMenu.feed.id]}
              isLocalAdmin={true}
              onVolumeChange={(newVol) => {
                setUserVolumes((prev) => ({
                  ...prev,
                  [contextMenu.feed.id]: newVol,
                }));
                if (!contextMenu.feed.isLocal && onChangeRemoteVolume) {
                  onChangeRemoteVolume(newVol);
                }
              }}
              onToggleLocalMute={() => {
                setLocallyMutedFeeds((prev) => ({
                  ...prev,
                  [contextMenu.feed.id]: !prev[contextMenu.feed.id],
                }));
              }}
              onToggleWatchStream={() => {
                const nextState = !watchedStreams[contextMenu.feed.id];
                setWatchedStreams((prev) => ({
                  ...prev,
                  [contextMenu.feed.id]: nextState,
                }));
                if (nextState) {
                  handleToggleFocus(contextMenu.feed.id as CallFeedId);
                }
              }}
              onKickParticipant={(targetUserId) => {
                if (onKickParticipant) {
                  onKickParticipant(targetUserId);
                }
              }}
              onClose={() => setContextMenu(null)}
            />
          )}

          {/* Channel Friends Invite Modal */}
          <ChannelInviteModal
            isOpen={isInviteModalOpen}
            onClose={() => setIsInviteModalOpen(false)}
            session={session}
            userProfile={userProfile}
            friends={socialFriends}
            notify={notify}
          />

          {/* Call Privacy & Password Panel */}
          <CallPrivacyPanel
            isOpen={isPrivacyModalOpen}
            onClose={() => setIsPrivacyModalOpen(false)}
            isPrivate={Boolean(session?.isPrivate || roomConfig?.isPrivate)}
            currentPassword={session?.password || roomConfig?.password || ""}
            currentCategory={session?.category || roomConfig?.category}
            onSavePrivacy={(isPriv, pwd) => {
              if (onUpdateRoomPrivacy) {
                return onUpdateRoomPrivacy(isPriv, pwd);
              }
            }}
          />
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
