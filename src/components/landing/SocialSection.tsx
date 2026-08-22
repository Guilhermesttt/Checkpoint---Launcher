import React, { useState } from "react";
import { motion } from "framer-motion";
import {
  Users,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Radio,
  Tv,
  PhoneCall,
  Sparkles,
  Shield,
  MessageSquare,
} from "lucide-react";
import { pherieliumAudio } from "../../utils/pherieliumSound";

interface Friend {
  id: string;
  name: string;
  avatar: string;
  activity: string;
  isSpeaking?: boolean;
  isSharingScreen?: boolean;
}

const CALL_PARTICIPANTS: Friend[] = [
  {
    id: "f1",
    name: "Arthur",
    avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=200&auto=format&fit=crop",
    activity: "Jogando Resident Evil 4",
    isSpeaking: true,
  },
  {
    id: "f2",
    name: "Lucas",
    avatar: "https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?q=80&w=200&auto=format&fit=crop",
    activity: "Jogando Gran Turismo 4",
    isSpeaking: false,
  },
  {
    id: "f3",
    name: "Marina",
    avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=200&auto=format&fit=crop",
    activity: "Transmitindo Elden Ring",
    isSpeaking: true,
    isSharingScreen: true,
  },
  {
    id: "f4",
    name: "Você",
    avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=200&auto=format&fit=crop",
    activity: "Pherielium Hub Ativo",
    isSpeaking: false,
  },
];

export const SocialSection: React.FC = () => {
  const [isMuted, setIsMuted] = useState(false);
  const [isDeafened, setIsDeafened] = useState(false);

  const toggleMute = () => {
    pherieliumAudio.playToggle(!isMuted);
    setIsMuted(!isMuted);
  };

  const toggleDeafen = () => {
    pherieliumAudio.playToggle(!isDeafened);
    setIsDeafened(!isDeafened);
  };

  return (
    <section id="social" className="relative py-24 sm:py-32 px-4 sm:px-8 border-t border-white/5">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-16">
          <div>
            <div className="text-[11px] font-mono tracking-widest text-[#7DFFB2] uppercase mb-2">
              // 05. INTEGRATED SOCIAL & VOICE
            </div>
            <h2 className="text-3xl sm:text-5xl font-black text-white font-mono uppercase tracking-tight">
              DON&apos;T JUST PLAY. <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-white to-[#7DFFB2]">
                CONNECT.
              </span>
            </h2>
          </div>
          <p className="max-w-md text-sm sm:text-base text-[#98A3B3] font-light leading-relaxed">
            Comunicação de voz em alta fidelidade e compartilhamento de tela com baixa latência,
            construídos diretamente dentro do ecossistema sem necessitar de apps paralelos.
          </p>
        </div>

        {/* Discord-like Integrated Call Showcase */}
        <div className="rounded-3xl border border-white/10 bg-[#080B10]/90 backdrop-blur-2xl p-6 sm:p-10 shadow-[0_0_50px_rgba(0,0,0,0.8)]">
          {/* Call Bar Header */}
          <div className="flex flex-wrap items-center justify-between gap-4 pb-6 mb-8 border-b border-white/8">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#23a55a]/15 text-[#23a55a] border border-[#23a55a]/30">
                <Radio className="h-5 w-5 animate-pulse" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white font-mono flex items-center gap-2">
                  PARTY // VOZ & TELA ATIVA (SALA 04)
                </h3>
                <span className="text-[11px] font-mono text-emerald-400">
                  ● WebRTC P2P Mesh HD • Latência 8ms • Noise Gate Ativo
                </span>
              </div>
            </div>

            {/* Quick Call Controls */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={toggleMute}
                className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
                  isMuted
                    ? "bg-rose-500 text-white border-rose-400 shadow-[0_0_12px_rgba(244,63,94,0.4)]"
                    : "bg-white/[0.04] text-white/70 hover:text-white border-white/10 hover:bg-white/[0.08]"
                }`}
                title={isMuted ? "Desmutar microfone" : "Mutar microfone"}
              >
                {isMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </button>

              <button
                type="button"
                onClick={toggleDeafen}
                className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
                  isDeafened
                    ? "bg-rose-500 text-white border-rose-400 shadow-[0_0_12px_rgba(244,63,94,0.4)]"
                    : "bg-white/[0.04] text-white/70 hover:text-white border-white/10 hover:bg-white/[0.08]"
                }`}
                title={isDeafened ? "Desativar silêncio total" : "Silenciar chamada (Deafen)"}
              >
                {isDeafened ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* 4 Cards Grid - Discord Voice Layout */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {CALL_PARTICIPANTS.map((friend) => (
              <div
                key={friend.id}
                className={`relative rounded-2xl border p-6 flex flex-col items-center justify-center text-center transition-all duration-300 min-h-[220px] ${
                  friend.isSpeaking
                    ? "bg-[#23a55a]/[0.06] border-[#23a55a] shadow-[0_0_25px_rgba(35,165,90,0.25)]"
                    : "bg-white/[0.02] border-white/8"
                }`}
              >
                {/* Avatar with Animated Speaking Glow */}
                <div className="relative mb-4">
                  <img
                    src={friend.avatar}
                    alt={friend.name}
                    className={`h-20 w-20 rounded-full object-cover transition-all ${
                      friend.isSpeaking
                        ? "ring-4 ring-[#23a55a] ring-offset-4 ring-offset-[#080B10] scale-105"
                        : "ring-1 ring-white/15"
                    }`}
                  />
                  {friend.isSpeaking && (
                    <span className="absolute bottom-0 right-0 flex h-4 w-4 items-center justify-center rounded-full bg-[#23a55a] text-black">
                      <Mic className="h-2.5 w-2.5 fill-black" />
                    </span>
                  )}
                  {friend.isSharingScreen && (
                    <span className="absolute top-0 right-0 px-1.5 py-0.5 rounded-md bg-white text-black text-[9px] font-mono font-bold shadow-md">
                      AO VIVO
                    </span>
                  )}
                </div>

                {/* Friend Information */}
                <h4 className="text-sm font-bold text-white font-mono">{friend.name}</h4>
                <p className="text-[11px] text-[#98A3B3] font-mono mt-1 truncate max-w-[180px]">
                  {friend.activity}
                </p>

                {/* Speaking Waveform Indicator */}
                {friend.isSpeaking && (
                  <div className="mt-3 flex items-center gap-1">
                    <span className="h-2.5 w-1 rounded-full bg-[#23a55a] animate-pulse" />
                    <span className="h-4 w-1 rounded-full bg-[#23a55a] animate-bounce" />
                    <span className="h-3 w-1 rounded-full bg-[#23a55a] animate-pulse" />
                    <span className="h-5 w-1 rounded-full bg-[#23a55a] animate-bounce" />
                    <span className="h-2.5 w-1 rounded-full bg-[#23a55a] animate-pulse" />
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Social Bottom Telemetry Bar */}
          <div className="mt-8 pt-4 border-t border-white/8 flex flex-wrap items-center justify-between gap-4 text-xs font-mono text-white/40">
            <span>Presence Sync: Jogando Resident Evil 4, Gran Turismo 4 e Elden Ring</span>
            <span className="text-[#7DFFB2]">CONVIDAR AMIGO COM 1 CLIQUE</span>
          </div>
        </div>
      </div>
    </section>
  );
};
