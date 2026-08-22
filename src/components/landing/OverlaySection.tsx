import React, { useState } from "react";
import { motion } from "framer-motion";
import {
  Tv,
  Cpu,
  MessageSquare,
  Trophy,
  Volume2,
  Camera,
  Layers,
  Radio,
  Sparkles,
  Zap,
} from "lucide-react";
import { pherieliumAudio } from "../../utils/pherieliumSound";

export const OverlaySection: React.FC = () => {
  const [activeTab, setActiveTab] = useState<"telemetry" | "chat" | "trophies">("telemetry");

  return (
    <section id="overlay" className="relative py-24 sm:py-32 px-4 sm:px-8 border-t border-white/5 bg-[#05070B]/90">
      <div className="mx-auto max-w-6xl">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="text-[11px] font-mono tracking-widest text-[#7DFFB2] uppercase mb-2">
            // 06. IN-GAME HUD OVERLAY
          </div>
          <h2 className="text-3xl sm:text-5xl font-black text-white font-mono uppercase tracking-tight">
            NEVER LEAVE <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-white to-[#7DFFB2]">
              THE GAME.
            </span>
          </h2>
          <p className="mt-4 text-sm sm:text-base text-[#98A3B3] font-light leading-relaxed">
            Aperte <kbd className="px-2 py-0.5 rounded bg-white/10 text-white font-mono border border-white/20">Shift</kbd> + <kbd className="px-2 py-0.5 rounded bg-white/10 text-white font-mono border border-white/20">Tab</kbd> para
            abrir o HUD translúcido do Pherielium sem interromper seu jogo. Ajuste mods, responda amigos,
            monitore hardware e gerencie chamadas de voz.
          </p>
        </div>

        {/* Big Translucent HUD Overlay Mockup */}
        <div className="relative rounded-3xl overflow-hidden border border-white/15 shadow-[0_20px_70px_rgba(0,0,0,0.9)] bg-black">
          {/* Game Background Layer */}
          <div
            className="absolute inset-0 bg-cover bg-center filter brightness-40 blur-[1px]"
            style={{
              backgroundImage:
                "url(https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80&w=1400&auto=format&fit=crop)",
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-black/80 backdrop-blur-[6px]" />

          {/* Overlay UI Layer */}
          <div className="relative z-10 p-6 sm:p-10">
            {/* Top Overlay Bar */}
            <div className="flex flex-wrap items-center justify-between gap-4 pb-6 mb-6 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#7DFFB2]/20 border border-[#7DFFB2]/40 text-[#7DFFB2]">
                  <Tv className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-sm font-bold text-white font-mono flex items-center gap-2">
                    <span>PHERIELIUM IN-GAME HUD</span>
                    <span className="text-[10px] text-[#7DFFB2] bg-[#7DFFB2]/15 px-2 py-0.5 rounded border border-[#7DFFB2]/30">
                      PAUSED: CYBERPUNK 2077
                    </span>
                  </div>
                  <span className="text-[11px] font-mono text-white/50">
                    ESC ou SHIFT+TAB para retornar ao jogo
                  </span>
                </div>
              </div>

              {/* Hardware Telemetry Live Pills */}
              <div className="flex items-center gap-3 text-xs font-mono">
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.06] border border-white/10 text-white">
                  <span className="text-[#7DFFB2] font-bold">165</span> FPS
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.06] border border-white/10 text-white">
                  <Cpu className="h-3.5 w-3.5 text-emerald-400" />
                  GPU 62°C • 98%
                </div>
                <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.06] border border-white/10 text-white">
                  RAM 11.4 GB / 32 GB
                </div>
              </div>
            </div>

            {/* Overlay Interactive Widgets */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Widget 1: Live Voice Call Panel */}
              <div className="rounded-2xl border border-white/10 bg-black/50 backdrop-blur-xl p-5">
                <div className="flex items-center justify-between text-xs font-mono text-white/60 mb-4 pb-2 border-b border-white/8">
                  <span className="flex items-center gap-1.5 text-[#23a55a] font-bold">
                    <Radio className="h-3.5 w-3.5 animate-pulse" />
                    PARTY DE VOZ
                  </span>
                  <span>4 MEMBROS</span>
                </div>
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-[#23a55a] ring-2 ring-[#23a55a]/40 animate-ping" />
                      <span className="text-white font-bold">Arthur</span>
                    </div>
                    <span className="text-[10px] text-white/40">Falando</span>
                  </div>
                  <div className="flex items-center justify-between text-xs font-mono">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-white/30" />
                      <span className="text-white/80">Lucas</span>
                    </div>
                    <span className="text-[10px] text-white/40">Ouvindo</span>
                  </div>
                  <div className="flex items-center justify-between text-xs font-mono">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-white/30" />
                      <span className="text-white/80">Marina</span>
                    </div>
                    <span className="text-[10px] text-[#7DFFB2]">Compartilhando Tela</span>
                  </div>
                </div>
              </div>

              {/* Widget 2: Recent Achievements */}
              <div className="rounded-2xl border border-white/10 bg-black/50 backdrop-blur-xl p-5">
                <div className="flex items-center justify-between text-xs font-mono text-white/60 mb-4 pb-2 border-b border-white/8">
                  <span className="flex items-center gap-1.5 text-amber-400 font-bold">
                    <Trophy className="h-3.5 w-3.5" />
                    CONQUISTAS DO JOGO
                  </span>
                  <span>68/84</span>
                </div>
                <div className="space-y-2">
                  <div className="p-2 rounded-xl bg-white/[0.04] border border-white/5 text-xs font-mono">
                    <div className="text-white font-bold">Never Fade Away</div>
                    <div className="text-[10px] text-white/40">Complete o prólogo de Dogtown</div>
                  </div>
                  <div className="p-2 rounded-xl bg-white/[0.04] border border-white/5 text-xs font-mono">
                    <div className="text-white font-bold">Direct Hit</div>
                    <div className="text-[10px] text-white/40">Elimine 3 inimigos com Rayfield</div>
                  </div>
                </div>
              </div>

              {/* Widget 3: Quick Capture & Music */}
              <div className="rounded-2xl border border-white/10 bg-black/50 backdrop-blur-xl p-5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between text-xs font-mono text-white/60 mb-4 pb-2 border-b border-white/8">
                    <span className="flex items-center gap-1.5 text-sky-400 font-bold">
                      <Camera className="h-3.5 w-3.5" />
                      CAPTURA RÁPIDA
                    </span>
                    <span>F12</span>
                  </div>
                  <p className="text-xs text-white/60 font-mono">
                    Grave os últimos 60 segundos ou tire um screenshot em 4K HDR sem perda de frames.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => pherieliumAudio.playClick(900)}
                  className="mt-4 w-full py-2 rounded-xl bg-white/[0.06] hover:bg-white/15 text-white font-mono text-xs font-bold border border-white/10 transition cursor-pointer"
                >
                  📸 CAPTURAR SCREENSHOT
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
