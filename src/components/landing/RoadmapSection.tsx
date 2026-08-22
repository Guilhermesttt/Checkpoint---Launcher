import React from "react";
import { CheckCircle2, Clock, Sparkles, Orbit } from "lucide-react";

export const RoadmapSection: React.FC = () => {
  const phases = [
    {
      phase: "NOW",
      status: "DISPONÍVEL HOJE",
      badgeColor: "text-[#7DFFB2] border-[#7DFFB2]/30 bg-[#7DFFB2]/10",
      items: [
        "Gaming Hub com biblioteca universal (Steam, Epic, Local)",
        "Gerenciador de Emulação integrado (PCSX2, RPCS3, Dolphin)",
        "Nexus Mods Direct Download & 1-Click Injection",
        "Suporte completo a controles (DualSense & Xbox)",
        "Temas customizáveis (Cosmic, Retro PS2, Y2K, Minimal)",
      ],
    },
    {
      phase: "NEXT",
      status: "EM DESENVOLVIMENTO",
      badgeColor: "text-sky-400 border-sky-400/30 bg-sky-400/10",
      items: [
        "Chamadas de voz P2P e streaming de tela em tempo real",
        "HUD In-Game Overlay translúcido (Shift + Tab)",
        "Sincronização global RetroAchievements em tempo real",
        "Sistema de amigos e presença cross-platform",
      ],
    },
    {
      phase: "FUTURE",
      status: "VISÃO EXPANDIDA",
      badgeColor: "text-amber-400 border-amber-400/30 bg-amber-400/10",
      items: [
        "Sincronização de saves e configurações em nuvem segura",
        "Pherielium Remote Play & game streaming local",
        "Repositório comunitário de shaders e mods",
        "Descoberta de jogos orientada a IA e radar de lançamentos",
      ],
    },
  ];

  return (
    <section id="vision" className="relative py-24 sm:py-32 px-4 sm:px-8 border-t border-white/5 bg-[#05070B]/80">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="text-[11px] font-mono tracking-widest text-[#7DFFB2] uppercase mb-2">
            // 09. SYSTEM EVOLUTION & ROADMAP
          </div>
          <h2 className="text-3xl sm:text-5xl font-black text-white font-mono uppercase tracking-tight">
            THIS IS JUST <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-white to-[#7DFFB2]">
              THE BEGINNING.
            </span>
          </h2>
          <p className="mt-4 text-sm sm:text-base text-[#98A3B3] font-light leading-relaxed">
            Uma plataforma viva em constante expansão, construída com feedback contínuo da comunidade
            de jogadores e entusiastas de PC.
          </p>
        </div>

        {/* 3 Phases Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {phases.map((p) => (
            <div
              key={p.phase}
              className="rounded-3xl border border-white/10 bg-[#080B10] p-8 flex flex-col justify-between hover:border-[#7DFFB2]/40 transition-all"
            >
              <div>
                <div className="flex items-center justify-between mb-6 pb-4 border-b border-white/8">
                  <span className="text-2xl font-black text-white font-mono">{p.phase}</span>
                  <span
                    className={`text-[10px] font-mono font-bold tracking-wider px-2.5 py-1 rounded-full border ${p.badgeColor}`}
                  >
                    {p.status}
                  </span>
                </div>

                <ul className="space-y-3.5">
                  {p.items.map((item) => (
                    <li key={item} className="flex items-start gap-2.5 text-xs text-white/80 font-mono">
                      <span className="h-1.5 w-1.5 rounded-full bg-[#7DFFB2] mt-1.5 shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-8 pt-4 border-t border-white/5 text-[10px] font-mono text-white/30 uppercase">
                // PHERIELIUM RELEASE CYCLE
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
