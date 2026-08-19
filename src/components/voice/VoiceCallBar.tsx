import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  MonitorUp,
  MonitorOff,
  Maximize2,
  PhoneOff,
  Phone,
} from "lucide-react";
import type { UserProfile, VoiceCallSession, CallState } from "../../types/domain";

interface VoiceCallBarProps {
  session: VoiceCallSession | null;
  userProfile?: UserProfile | null;
  duration: number;
  isMuted: boolean;
  isDeafened: boolean;
  isSpeakingLocal?: boolean;
  isSpeakingRemote?: boolean;
  remoteSpeakingStates?: Map<string, boolean>;
  isSharingScreen: boolean;
  isReconnecting?: boolean;
  inputMode?: "voice-activity" | "push-to-talk";
  pushToTalkKey?: string;
  isPttPressed?: boolean;
  callState?: CallState;
  onToggleMute: () => void;
  onToggleDeafen: () => void;
  onToggleScreenShare: () => void;
  onOpenWindow: () => void;
  onHangUp: () => void;
}

const formatDuration = (secs: number) => {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
};

export const VoiceCallBar: React.FC<VoiceCallBarProps> = ({
  session,
  userProfile,
  duration,
  isMuted,
  isDeafened,
  isSpeakingLocal = false,
  isSpeakingRemote = false,
  remoteSpeakingStates,
  isSharingScreen,
  isReconnecting = false,
  inputMode = "voice-activity",
  pushToTalkKey = "F8",
  isPttPressed = false,
  callState = "active",
  onToggleMute,
  onToggleDeafen,
  onToggleScreenShare,
  onOpenWindow,
  onHangUp,
}) => {
  if (!session) return null;

  const isRingingOut = callState === "ringing-out";
  const isConnecting = callState === "connecting";

  // Determine active speaker info and avatar
  let displayAvatar: string | null | undefined = session.friendAvatar;
  let displayName = session.friendName || "Voz";
  let isCurrentlySpeaking = false;

  if (isSpeakingRemote) {
    isCurrentlySpeaking = true;
    if (session.participants && remoteSpeakingStates) {
      const activeRemote = session.participants.find((p) => remoteSpeakingStates.get(p.uid));
      if (activeRemote) {
        displayAvatar = activeRemote.avatar;
        displayName = activeRemote.name;
      }
    }
  } else if (isSpeakingLocal) {
    isCurrentlySpeaking = true;
    if (userProfile?.photoURL) {
      displayAvatar = userProfile.photoURL;
    }
    if (userProfile?.displayName) {
      displayName = `${userProfile.displayName} (Você)`;
    } else {
      displayName = "Você";
    }
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 50, opacity: 0 }}
        transition={{ type: "spring", stiffness: 400, damping: 30 }}
        className={`fixed bottom-4 left-1/2 -translate-x-1/2 z-[9990] flex items-center gap-4 rounded-2xl border px-4 py-2.5 shadow-[0_15px_40px_rgba(0,0,0,0.7)] backdrop-blur-2xl transition-colors duration-300 ${
          isReconnecting
            ? "border-amber-500/50 bg-[#15130d]/95"
            : "border-white/10 bg-[#121215]/95"
        }`}
      >
        {/* Connection Status & Friend / Speaker */}
        <div
          onClick={onOpenWindow}
          className="flex items-center gap-3 cursor-pointer group"
          title="Abrir tela de chamada"
        >
          <div className="relative">
            <div
              className={`h-9 w-9 rounded-xl overflow-hidden border-2 transition-all duration-300 ${
                isReconnecting
                  ? "border-amber-400"
                  : isRingingOut
                  ? "border-amber-400/40 opacity-50"
                  : isCurrentlySpeaking
                  ? "border-white ring-2 ring-white/40 shadow-[0_0_15px_rgba(255,255,255,0.4)] scale-105"
                  : "border-white/10"
              }`}
            >
              {displayAvatar ? (
                <img
                  src={displayAvatar}
                  alt={displayName}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-white/10 text-xs font-bold text-white border border-white/10">
                  {displayName.slice(0, 2).toUpperCase()}
                </div>
              )}
            </div>
            <div
              className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[#121215] ${
                isReconnecting
                  ? "bg-amber-400 animate-ping"
                  : isRingingOut
                  ? "bg-amber-400"
                  : isCurrentlySpeaking
                  ? "bg-white"
                  : "bg-white/60"
              }`}
            />
          </div>

          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  isReconnecting
                    ? "bg-amber-400 animate-bounce"
                    : isRingingOut
                    ? "bg-amber-400 animate-ping"
                    : isCurrentlySpeaking
                    ? "bg-white animate-pulse"
                    : "bg-white/60"
                }`}
              />
              <span
                className={`text-[10px] font-black uppercase tracking-wider ${
                  isReconnecting
                    ? "text-amber-400"
                    : isRingingOut
                    ? "text-amber-300"
                    : isCurrentlySpeaking
                    ? "text-white"
                    : "text-white/70"
                }`}
              >
                {isReconnecting
                  ? "Reconectando..."
                  : isRingingOut
                  ? "Chamando..."
                  : isConnecting
                  ? "Conectando..."
                  : isCurrentlySpeaking
                  ? "Voz Ativa"
                  : "Voz Conectada"}
              </span>
              {inputMode === "push-to-talk" && (
                <span
                  className={`text-[9px] font-bold px-1.5 py-0.2 rounded border uppercase tracking-wider ${
                    isPttPressed
                      ? "bg-white/20 text-white border-white/40 animate-pulse"
                      : "bg-white/5 text-white/50 border-white/10"
                  }`}
                >
                  PTT [{pushToTalkKey}]
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-white group-hover:text-white/80 transition-colors truncate max-w-[140px]">
                {displayName}
              </span>
              <span className="text-[10px] font-mono text-white/40 shrink-0">
                • {formatDuration(duration)}
              </span>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="h-7 w-[1px] bg-white/10" />

        {/* Call Controls */}
        <div className="flex items-center gap-1.5">
          {/* Mute Mic */}
          <button
            type="button"
            onClick={onToggleMute}
            className={`flex h-8.5 w-8.5 items-center justify-center rounded-xl transition-all duration-200 cursor-pointer ${
              isMuted
                ? "bg-rose-500 text-white shadow-[0_0_12px_rgba(244,63,94,0.4)]"
                : "bg-white/8 text-white hover:bg-white/15 hover:scale-105"
            }`}
            title={isMuted ? "Desmutar microfone" : "Mutar microfone"}
          >
            {isMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </button>

          {/* Deafen Sound */}
          <button
            type="button"
            onClick={onToggleDeafen}
            className={`flex h-8.5 w-8.5 items-center justify-center rounded-xl transition-all duration-200 cursor-pointer ${
              isDeafened
                ? "bg-rose-500 text-white shadow-[0_0_12px_rgba(244,63,94,0.4)]"
                : "bg-white/8 text-white hover:bg-white/15 hover:scale-105"
            }`}
            title={isDeafened ? "Desmutar áudio" : "Silenciar áudio"}
          >
            {isDeafened ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>

          {/* Share Screen */}
          <button
            type="button"
            onClick={onToggleScreenShare}
            className={`flex h-8.5 w-8.5 items-center justify-center rounded-xl transition-all duration-200 cursor-pointer ${
              isSharingScreen
                ? "bg-white text-black shadow-md scale-105"
                : "bg-white/8 text-white hover:bg-white/15 hover:scale-105"
            }`}
            title={isSharingScreen ? "Parar compartilhamento" : "Compartilhar tela"}
          >
            {isSharingScreen ? <MonitorOff className="h-4 w-4" /> : <MonitorUp className="h-4 w-4" />}
          </button>

          {/* Expand Window */}
          <button
            type="button"
            onClick={onOpenWindow}
            className="flex h-8.5 w-8.5 items-center justify-center rounded-xl bg-white/6 text-white hover:bg-white/12 hover:scale-105 transition-all duration-200"
            title="Expandir chamada"
          >
            <Maximize2 className="h-4 w-4" />
          </button>

          {/* Disconnect */}
          <button
            type="button"
            onClick={onHangUp}
            className="flex h-8.5 w-8.5 items-center justify-center rounded-xl bg-rose-500 text-white hover:bg-rose-600 hover:scale-105 active:scale-95 transition-all duration-200 shadow-md shadow-rose-500/30"
            title="Desconectar"
          >
            <PhoneOff className="h-4 w-4" />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

