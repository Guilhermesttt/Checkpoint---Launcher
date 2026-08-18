import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Video,
  VideoOff,
  MonitorUp,
  MonitorOff,
  PhoneOff,
  Minimize2,
  Maximize,
  Radio,
  Settings,
  X,
  Keyboard,
  Sliders,
  Check,
  Activity,
  Headphones,
  Camera,
} from "lucide-react";
import type { UserProfile, VoiceCallSession } from "../../types/domain";

interface VoiceCallWindowProps {
  isOpen: boolean;
  onClose: () => void;
  session: VoiceCallSession | null;
  userProfile: UserProfile | null;
  remoteStream: MediaStream | null;
  localStream: MediaStream | null;
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
  onHangUp: () => void;
}

const formatDuration = (secs: number) => {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
};

export const VoiceCallWindow: React.FC<VoiceCallWindowProps> = ({
  isOpen,
  onClose,
  session,
  userProfile,
  remoteStream,
  localStream,
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
  onHangUp,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isRecordingKey, setIsRecordingKey] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Live test meter level (RMS) for Settings popover with strict AudioContext cleanup
  const [micVolumeLevel, setMicVolumeLevel] = useState(0);

  // Sync native Electron fullscreen state on mount
  useEffect(() => {
    if (window.electronAPI?.isFullScreen) {
      void window.electronAPI.isFullScreen().then((full) => {
        setIsFullscreen(Boolean(full));
      });
    }
  }, [isOpen]);

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

  // Attach remote stream to audio/video elements with resilience to minimize/visibilitychange
  useEffect(() => {
    const syncStream = () => {
      if (remoteStream) {
        if (videoRef.current) {
          if (videoRef.current.srcObject !== remoteStream) {
            videoRef.current.srcObject = remoteStream;
          }
          videoRef.current.play().catch(() => {});
        }
        if (audioRef.current) {
          if (audioRef.current.srcObject !== remoteStream) {
            audioRef.current.srcObject = remoteStream;
          }
          if (selectedAudioOutput && selectedAudioOutput !== "default" && typeof (audioRef.current as any).setSinkId === "function") {
            void (audioRef.current as any).setSinkId(selectedAudioOutput).catch(() => {});
          }
          audioRef.current.play().catch(() => {});
        }
      }
    };

    syncStream();

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        syncStream();
      }
    };

    const handleFocus = () => {
      syncStream();
    };

    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("focus", handleFocus);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("focus", handleFocus);
    };
  }, [remoteStream, isRemoteSharingScreen, isRemoteCameraOn, selectedAudioOutput]);

  // Handle deafen and echo prevention on audio/video elements
  useEffect(() => {
    const isEchoTest = session?.friendUid === "echo-bot";
    if (audioRef.current) {
      audioRef.current.muted = isDeafened || isEchoTest;
    }
    if (videoRef.current) {
      videoRef.current.muted = true;
    }
  }, [isDeafened, session?.friendUid]);

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

  if (!isOpen || !session) return null;

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

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[9995] flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl">
        <motion.div
          ref={containerRef}
          initial={{ scale: 0.94, opacity: 0, y: 15 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 10 }}
          transition={{ type: "spring", stiffness: 380, damping: 28 }}
          className="relative flex flex-col w-full max-w-5xl h-[86vh] overflow-hidden rounded-3xl border border-white/10 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-[#1c1d28]/98 via-[#111218]/99 to-[#08090c] shadow-[0_30px_90px_rgba(0,0,0,0.9)]"
        >
          {/* Invisible Remote Audio Receiver */}
          <audio ref={audioRef} autoPlay playsInline />

          {/* Top Bar */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/8 bg-black/30 backdrop-blur-md">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.3)]">
                <Radio className="h-4.5 w-4.5 animate-pulse" />
              </div>
              <div>
                <h2 className="text-sm font-black text-white tracking-tight flex items-center gap-2">
                  <span>{session.friendName}</span>
                  <span className="text-xs font-mono font-normal text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                    {formatDuration(duration)}
                  </span>
                </h2>
                <p className="text-[11px] text-white/40">Chamada Direta Checkpoint</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void toggleFullscreen()}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/6 text-white/60 hover:text-white hover:bg-white/12 transition cursor-pointer"
                title={isFullscreen ? "Sair da tela cheia" : "Tela cheia nativa"}
              >
                <Maximize className="h-4 w-4" />
              </button>
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
            <div className="flex items-center justify-center gap-2 bg-amber-500/20 border-b border-amber-500/30 px-4 py-2 text-amber-300 text-xs font-bold animate-pulse">
              <span className="h-2 w-2 rounded-full bg-amber-400 animate-ping" />
              <span>Conexão de voz instável. Reconectando via ICE restart...</span>
            </div>
          )}

          {/* Main Stage */}
          <div className="relative flex-1 overflow-hidden p-6 flex flex-col items-center justify-center">
            {isRemoteSharingScreen ? (
              // Remote Screen Share Video Feed
              <div className="relative h-full w-full flex items-center justify-center rounded-2xl overflow-hidden bg-black/90 border border-white/10 shadow-2xl">
                <video
                  ref={(el) => {
                    videoRef.current = el;
                    if (el && remoteStream) {
                      if (el.srcObject !== remoteStream) {
                        el.srcObject = remoteStream;
                      }
                      el.play().catch(() => {});
                    }
                  }}
                  autoPlay
                  playsInline
                  muted
                  className="h-full w-full object-contain"
                />
                <div className="absolute top-4 left-4 flex items-center gap-2 px-3 py-1.5 rounded-xl bg-black/75 border border-white/10 backdrop-blur-md">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-xs font-bold text-white">
                    Tela de {session.friendName}
                  </span>
                </div>
              </div>
            ) : (
              // Voice Cards Grid (Discord style: clean avatar with green speaking ring)
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 w-full max-w-2xl">
                {/* Me (Local Participant) */}
                <div className="group relative flex flex-col items-center justify-center p-8 rounded-3xl border border-white/8 bg-white/[0.025] hover:border-white/15 hover:bg-white/[0.045] backdrop-blur-md text-center transition-all duration-300">
                  <div className="relative mb-4">
                    {/* Glowing Speaking Ring (Synced with VAD RMS) */}
                    <div
                      className={`relative h-28 w-28 rounded-full overflow-hidden border-[3px] transition-all duration-150 ${
                        isSpeakingLocal
                          ? "border-emerald-400 ring-4 ring-emerald-500/50 shadow-[0_0_35px_rgba(34,197,94,0.75)] scale-[1.05]"
                          : "border-white/10"
                      }`}
                    >
                      {userProfile?.photoURL ? (
                        <img
                          src={userProfile.photoURL}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-white/10 text-3xl font-black text-white border border-white/10">
                          {(userProfile?.displayName || "EU").slice(0, 2).toUpperCase()}
                        </div>
                      )}
                    </div>

                    {/* Mute / Deafen Badge */}
                    {isDeafened ? (
                      <div className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full bg-rose-600 text-white border-2 border-[#12131a] shadow-lg" title="Você está ensurdecido">
                        <VolumeX className="h-4 w-4" />
                      </div>
                    ) : isMuted ? (
                      <div className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full bg-rose-600 text-white border-2 border-[#12131a] shadow-lg" title="Você está mutado">
                        <MicOff className="h-4 w-4" />
                      </div>
                    ) : null}
                  </div>

                  <div className="flex items-center gap-2">
                    <h4 className="text-base font-black text-white tracking-tight">
                      {userProfile?.displayName || "Você"}
                    </h4>
                    {inputMode === "push-to-talk" && (
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
                </div>

                {/* Friend (Remote Participant) */}
                <div className="group relative flex flex-col items-center justify-center p-8 rounded-3xl border border-white/8 bg-white/[0.025] hover:border-white/15 hover:bg-white/[0.045] backdrop-blur-md text-center transition-all duration-300">
                  <div className="relative mb-4">
                    {/* Glowing Speaking Ring */}
                    <div
                      className={`relative h-28 w-28 rounded-full overflow-hidden border-[3px] transition-all duration-150 ${
                        isSpeakingRemote
                          ? "border-emerald-400 ring-4 ring-emerald-500/50 shadow-[0_0_35px_rgba(34,197,94,0.75)] scale-[1.05]"
                          : "border-white/10"
                      }`}
                    >
                      {session.friendAvatar ? (
                        <img
                          src={session.friendAvatar}
                          alt={session.friendName}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-white/10 text-3xl font-black text-white border border-white/10">
                          {session.friendName.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                    </div>

                    {/* Remote Mute / Deafen Badge */}
                    {isRemoteDeafened ? (
                      <div className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full bg-rose-600 text-white border-2 border-[#12131a] shadow-lg" title={`${session.friendName} está silenciado`}>
                        <VolumeX className="h-4 w-4" />
                      </div>
                    ) : isRemoteMuted ? (
                      <div className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full bg-rose-600 text-white border-2 border-[#12131a] shadow-lg" title={`${session.friendName} está mutado`}>
                        <MicOff className="h-4 w-4" />
                      </div>
                    ) : null}
                  </div>

                  <div className="flex items-center gap-2">
                    <h4 className="text-base font-black text-white tracking-tight">
                      {session.friendName}
                    </h4>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Floating Settings Popover Modal */}
          <AnimatePresence>
            {isSettingsOpen && (
              <motion.div
                initial={{ opacity: 0, y: 15, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                className="absolute bottom-24 left-1/2 -translate-x-1/2 w-full max-w-lg max-h-[70vh] overflow-y-auto p-5 rounded-3xl border border-white/10 bg-[#161720]/98 shadow-[0_20px_60px_rgba(0,0,0,0.85)] backdrop-blur-2xl z-50 space-y-4"
              >
                <div className="flex items-center justify-between pb-3 border-b border-white/8">
                  <div className="flex items-center gap-2">
                    <Sliders className="h-4 w-4 text-white/70" />
                    <h3 className="text-xs font-black text-white uppercase tracking-wider">
                      Configurações de Voz & Dispositivos
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsSettingsOpen(false)}
                    className="h-6 w-6 flex items-center justify-center rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition cursor-pointer"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>

                {/* 1. Device Selectors */}
                <div className="space-y-3">
                  {/* Microfone */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-white/70 flex items-center gap-1.5">
                      <Mic className="h-3.5 w-3.5 text-white/70" />
                      <span>Dispositivo de Microfone</span>
                    </label>
                    <select
                      value={selectedAudioInput}
                      onChange={(e) => onChangeAudioInputDevice?.(e.target.value)}
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-white focus:outline-none focus:ring-1 focus:ring-white/30 cursor-pointer"
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
                  <div className="space-y-1.5 bg-white/5 p-3 rounded-2xl border border-white/8">
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
                  <label className="flex items-center justify-between p-3 rounded-2xl border border-white/8 bg-white/5 cursor-pointer hover:bg-white/[0.08] transition">
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
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-white focus:outline-none focus:ring-1 focus:ring-white/30 cursor-pointer"
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
                        className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-white focus:outline-none focus:ring-1 focus:ring-white/30 cursor-pointer"
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

                {/* 2. Sensibilidade de Atividade de Voz */}
                <div className="space-y-1.5 pt-2 border-t border-white/8">
                  <div className="flex items-center justify-between text-[11px] font-bold">
                    <span className="text-white/70">Sensibilidade de Voz (VAD)</span>
                    <span className="font-mono text-white/50">{voiceSensitivity}%</span>
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
                    <span>Menos Sensível</span>
                    <span>Mais Sensível</span>
                  </div>
                </div>

                {/* 3. Toggles de Processamento de Áudio */}
                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-white/8">
                  <button
                    type="button"
                    onClick={() => onChangeEchoCancellation?.(!echoCancellation)}
                    className={`p-2 rounded-xl border text-[10px] font-bold flex flex-col items-center gap-1 transition-all cursor-pointer ${
                      echoCancellation
                        ? "bg-white text-black font-black shadow-sm border-white"
                        : "bg-white/5 text-white/40 border-white/10"
                    }`}
                  >
                    <span>Anti-Eco</span>
                    {echoCancellation && <Check className="h-3 w-3" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => onChangeNoiseSuppression?.(!noiseSuppression)}
                    className={`p-2 rounded-xl border text-[10px] font-bold flex flex-col items-center gap-1 transition-all cursor-pointer ${
                      noiseSuppression
                        ? "bg-white text-black font-black shadow-sm border-white"
                        : "bg-white/5 text-white/40 border-white/10"
                    }`}
                  >
                    <span>Supressão Ruído</span>
                    {noiseSuppression && <Check className="h-3 w-3" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => onChangeAutoGainControl?.(!autoGainControl)}
                    className={`p-2 rounded-xl border text-[10px] font-bold flex flex-col items-center gap-1 transition-all cursor-pointer ${
                      autoGainControl
                        ? "bg-white text-black font-black shadow-sm border-white"
                        : "bg-white/5 text-white/40 border-white/10"
                    }`}
                  >
                    <span>Ganho Automático</span>
                    {autoGainControl && <Check className="h-3 w-3" />}
                  </button>
                </div>

                {/* 4. Modo de Entrada */}
                <div className="space-y-2 pt-2 border-t border-white/8">
                  <span className="text-[11px] font-bold text-white/60 uppercase tracking-wider">
                    Modo de Transmissão
                  </span>
                  <div className="grid grid-cols-2 gap-1.5 bg-white/5 p-1 rounded-xl border border-white/8">
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
                    <div className="flex items-center justify-between gap-3 p-3 rounded-xl border border-white/8 bg-white/5">
                      <div>
                        <p className="text-xs font-bold text-white flex items-center gap-1.5">
                          <Keyboard className="h-3.5 w-3.5 text-white/70" />
                          Atalho Push-to-Talk
                        </p>
                        <p className="text-[10px] text-white/40">Segure a tecla para falar</p>
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
              </motion.div>
            )}
          </AnimatePresence>

          {/* Bottom Call Controls Dock (Discord 6-Button Grid) */}
          <div className="flex items-center justify-center gap-3 p-4 border-t border-white/8 bg-black/40 backdrop-blur-xl">
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
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
