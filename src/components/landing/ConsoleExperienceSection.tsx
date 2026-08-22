import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Gamepad2,
  Monitor,
  Check,
  X,
  Sparkles,
  Layers,
  ArrowRight,
  ShieldCheck,
  Cpu,
  Tv,
  Zap,
} from "lucide-react";
import { pherieliumAudio } from "../../utils/pherieliumSound";

export const ConsoleExperienceSection: React.FC = () => {
  const [activeTab, setActiveTab] = useState<"before" | "after">("after");

  const beforeItems = [
    { name: "Steam Client", desc: "Janela aberta em segundo plano com anúncios e atualizações" },
    { name: "Epic Games Launcher", desc: "Outro inicializador pesado rodando separadamente" },
    { name: "Discord", desc: "App de voz com janelas flutuantes consumindo memória" },
    { name: "Emuladores (PCSX2 / RPCS3)", desc: "Pastas manuais de BIOS, ISOs e plugins espalhados" },
    { name: "Nexus Mod Manager / Vortex", desc: "Outro software aberto para aplicar mods e texturas" },
    { name: "Navegador com 12 abas", desc: "Guias de conquistas, notícias de games e fóruns" },
  ];

  const afterPherieliumFeatures = [
    { title: "Dashboard Unificado", desc: "Todos os seus jogos de PC, Steam, Epic e Emuladores em 1 único lugar.", icon: Layers },
    { title: "Voz & Amigos Integrados", desc: "Chamadas de voz e tela compartilhada sem precisar sair da experiência.", icon: Zap },
    { title: "Navegação por Controle", desc: "Interface otimizada para DualSense, Xbox e navegação no sofá ou monitor.", icon: Gamepad2 },
    { title: "Mod Manager Nativo", desc: "Instale texturas 4K, mods e shaders em 1 clique diretamente no jogo.", icon: Sparkles },
    { title: "Conquistas Globais", desc: "Suporte unificado para conquistas de PC e RetroAchievements.", icon: ShieldCheck },
    { title: "In-Game HUD Overlay", desc: "Aperte Shift + Tab para acessar chat, voz e performance em tempo real.", icon: Tv },
  ];

  return (
    <section id="console" className="relative py-24 sm:py-32 px-4 sm:px-8 border-t border-white/5 bg-[#05070B]/60">
      <div className="mx-auto max-w-6xl">
        {/* Section Title */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="text-[11px] font-mono tracking-widest text-[#7DFFB2] uppercase mb-2">
            // 02. ARCHITECTURAL PARADIGM
          </div>
          <h2 className="text-3xl sm:text-5xl font-black text-white font-mono uppercase tracking-tight">
            PC POWER. <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-[#E8EDF3] to-[#7DFFB2]">
              CONSOLE SOUL.
            </span>
          </h2>
          <p className="mt-4 text-sm sm:text-base text-[#98A3B3] font-light leading-relaxed">
            O PC tem a maior potência e liberdade gráfica do mundo, mas historicamente sofreu com
            a fragmentação de dezenas de launchers e janelas. O Pherielium resolve isso de ponta a ponta.
          </p>

          {/* Interactive Mode Switcher */}
          <div className="mt-8 inline-flex p-1.5 rounded-2xl bg-white/[0.04] border border-white/10 backdrop-blur-md">
            <button
              type="button"
              onClick={() => {
                pherieliumAudio.playToggle(false);
                setActiveTab("before");
              }}
              className={`px-5 py-2.5 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer ${
                activeTab === "before"
                  ? "bg-rose-500/20 text-rose-300 border border-rose-500/40 shadow-[0_0_15px_rgba(244,63,94,0.3)]"
                  : "text-white/50 hover:text-white"
              }`}
            >
              ANTES // O CAOS NO PC
            </button>
            <button
              type="button"
              onClick={() => {
                pherieliumAudio.playToggle(true);
                setActiveTab("after");
              }}
              className={`px-5 py-2.5 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer ${
                activeTab === "after"
                  ? "bg-[#7DFFB2] text-black shadow-[0_0_20px_rgba(125,255,178,0.4)]"
                  : "text-white/50 hover:text-white"
              }`}
            >
              DEPOIS // PHERIELIUM HUB
            </button>
          </div>
        </div>

        {/* Dynamic State Display */}
        <AnimatePresence mode="wait">
          {activeTab === "before" ? (
            <motion.div
              key="before"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="rounded-3xl border border-rose-500/20 bg-gradient-to-b from-rose-950/20 to-[#080B10] p-6 sm:p-10"
            >
              <div className="flex items-center gap-3 text-rose-400 font-mono text-xs font-bold uppercase mb-6 tracking-wider">
                <X className="h-4 w-4" />
                <span>FRAGMENTAÇÃO CONVENCIONAL DE DESKTOP (6+ PROCESSOS SEPARADOS)</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {beforeItems.map((item, idx) => (
                  <div
                    key={item.name}
                    className="p-4 rounded-2xl border border-rose-500/15 bg-black/40 text-left"
                  >
                    <div className="text-[10px] font-mono text-rose-400/60 uppercase mb-1">
                      JANELA ISOLADA 0{idx + 1}
                    </div>
                    <div className="text-sm font-bold text-white font-mono">{item.name}</div>
                    <p className="text-xs text-white/50 mt-1 font-sans">{item.desc}</p>
                  </div>
                ))}
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="after"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="rounded-3xl border border-[#7DFFB2]/30 bg-gradient-to-b from-[#7DFFB2]/5 via-[#080B10] to-[#080B10] p-6 sm:p-10 shadow-[0_0_50px_rgba(125,255,178,0.1)]"
            >
              <div className="flex items-center gap-3 text-[#7DFFB2] font-mono text-xs font-bold uppercase mb-6 tracking-wider">
                <Check className="h-4 w-4" />
                <span>PHERIELIUM // 1 SISTEMA CENTRALIZADO DE EXPERIÊNCIA DE CONSOLE</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {afterPherieliumFeatures.map((feat) => {
                  const Icon = feat.icon;
                  return (
                    <div
                      key={feat.title}
                      className="p-5 rounded-2xl border border-white/10 bg-white/[0.02] hover:border-[#7DFFB2]/50 hover:bg-white/[0.04] transition-all group"
                    >
                      <div className="h-10 w-10 rounded-xl bg-[#7DFFB2]/10 border border-[#7DFFB2]/20 flex items-center justify-center text-[#7DFFB2] mb-3 group-hover:scale-110 transition-transform">
                        <Icon className="h-5 w-5" />
                      </div>
                      <h4 className="text-sm font-bold text-white font-mono">{feat.title}</h4>
                      <p className="text-xs text-[#98A3B3] mt-1.5 leading-relaxed font-sans font-light">
                        {feat.desc}
                      </p>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
};
