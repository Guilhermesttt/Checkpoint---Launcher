import React, { useState } from "react";
import { motion } from "framer-motion";
import {
  Sparkles,
  DownloadCloud,
  CheckCircle,
  ToggleLeft,
  ToggleRight,
  Shield,
  Layers,
  Wrench,
  ExternalLink,
  Cpu,
} from "lucide-react";
import { pherieliumAudio } from "../../utils/pherieliumSound";

interface ModItem {
  id: string;
  name: string;
  category: string;
  version: string;
  size: string;
  enabled: boolean;
  author: string;
  downloads: string;
}

const INITIAL_MODS: ModItem[] = [
  {
    id: "m1",
    name: "Ultra HD 4K Textures Overhaul v3.2",
    category: "TEXTURE PACK",
    version: "v3.2.0",
    size: "4.8 GB",
    enabled: true,
    author: "KreatorX",
    downloads: "2.4M",
  },
  {
    id: "m2",
    name: "Volumetric Path Tracing & Photoreal Lighting",
    category: "VISUAL OVERHAUL",
    version: "v1.4.1",
    size: "120 MB",
    enabled: true,
    author: "RayMaster",
    downloads: "890k",
  },
  {
    id: "m3",
    name: "Modernized Clean Console UI & Font HUD",
    category: "UI REWORK",
    version: "v2.0.0",
    size: "45 MB",
    enabled: true,
    author: "PherieliumDev",
    downloads: "510k",
  },
  {
    id: "m4",
    name: "Fast Travel & Quick Loot Quality of Life",
    category: "QUALITY OF LIFE",
    version: "v1.1.0",
    size: "12 MB",
    enabled: false,
    author: "SpeedRunner99",
    downloads: "1.1M",
  },
];

export const ModsSection: React.FC = () => {
  const [mods, setMods] = useState<ModItem[]>(INITIAL_MODS);

  const toggleMod = (id: string) => {
    setMods((prev) =>
      prev.map((m) => {
        if (m.id === id) {
          const nextState = !m.enabled;
          pherieliumAudio.playToggle(nextState);
          return { ...m, enabled: nextState };
        }
        return m;
      })
    );
  };

  const enabledCount = mods.filter((m) => m.enabled).length;

  return (
    <section id="mods" className="relative py-24 sm:py-32 px-4 sm:px-8 border-t border-white/5">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-16">
          <div>
            <div className="text-[11px] font-mono tracking-widest text-[#7DFFB2] uppercase mb-2">
              // 03. NEXUS & MOD INTEGRATION
            </div>
            <h2 className="text-3xl sm:text-5xl font-black text-white font-mono uppercase tracking-tight">
              YOUR GAMES. <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-white to-[#7DFFB2]">
                YOUR RULES.
              </span>
            </h2>
          </div>
          <p className="max-w-md text-sm sm:text-base text-[#98A3B3] font-light leading-relaxed">
            Descubra, instale e gerencie mods sem sair do seu ambiente de jogos. Compatível com
            ecossistemas como Nexus Mods com downloads e ativação instantânea em 1 clique.
          </p>
        </div>

        {/* Interactive Split Screen Manager Demo */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          {/* Left Column: Visual Game State Preview */}
          <div className="lg:col-span-5 rounded-3xl border border-white/10 bg-[#080B10] p-6 flex flex-col justify-between relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 w-60 h-60 bg-[#7DFFB2]/10 rounded-full blur-3xl pointer-events-none" />

            <div>
              <div className="flex items-center justify-between text-[11px] font-mono text-white/50 mb-4 pb-3 border-b border-white/8">
                <span>PREVIEW DO JOGO COM MODS</span>
                <span className="text-[#7DFFB2] font-semibold">{enabledCount} ATIVOS</span>
              </div>

              <div className="relative aspect-video rounded-2xl overflow-hidden border border-white/15 mb-4 shadow-xl">
                <img
                  src="https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80&w=800&auto=format&fit=crop"
                  alt="Game with mods"
                  className={`w-full h-full object-cover transition-all duration-700 ${
                    enabledCount >= 2 ? "filter saturate-125 contrast-110" : "filter grayscale-30"
                  }`}
                />
                <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between bg-black/70 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/10 text-[10px] font-mono">
                  <span className="text-white font-bold">CYBERPUNK 2077</span>
                  <span className="text-[#7DFFB2]">
                    {enabledCount >= 3 ? "ULTRA RTX ON (4K)" : "BASE GRAPHICS"}
                  </span>
                </div>
              </div>

              <div className="space-y-2 text-xs font-mono text-white/60">
                <div className="flex justify-between py-1.5 border-b border-white/5">
                  <span>Mod Engine</span>
                  <span className="text-white font-semibold">Pherielium Injector v2.4</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-white/5">
                  <span>Nexus Protocol</span>
                  <span className="text-[#7DFFB2] font-semibold">nxm:// Direct Link Ready</span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span>Conflitos de Arquivo</span>
                  <span className="text-emerald-400 font-semibold">0 Detectados (Auto-Fix)</span>
                </div>
              </div>
            </div>

            <div className="mt-6 p-3.5 rounded-2xl bg-white/[0.03] border border-white/8 text-[11px] font-mono text-white/40 flex items-center gap-2">
              <Shield className="h-4 w-4 text-[#7DFFB2] shrink-0" />
              <span>Proteção Sandbox: Seus saves originais nunca são corrompidos.</span>
            </div>
          </div>

          {/* Right Column: Live Interactive Mod Manager */}
          <div className="lg:col-span-7 rounded-3xl border border-white/10 bg-[#080B10]/80 backdrop-blur-xl p-6 sm:p-8 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-6 pb-4 border-b border-white/8">
                <div>
                  <h3 className="text-base font-bold text-white font-mono flex items-center gap-2">
                    <Wrench className="h-4 w-4 text-[#7DFFB2]" />
                    MOD MANAGER // GERENCIADOR ATIVO
                  </h3>
                  <span className="text-[11px] font-mono text-white/40">
                    Clique no interruptor para habilitar ou desabilitar cada mod em tempo real
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => pherieliumAudio.playHover()}
                  className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.05] border border-white/10 text-[11px] font-mono text-[#7DFFB2] hover:bg-white/10 transition cursor-pointer"
                >
                  <ExternalLink className="h-3 w-3" />
                  NEXUS BROWSER
                </button>
              </div>

              {/* Mod List */}
              <div className="space-y-3">
                {mods.map((mod) => (
                  <div
                    key={mod.id}
                    className={`p-4 rounded-2xl border transition-all duration-300 flex items-center justify-between gap-4 ${
                      mod.enabled
                        ? "bg-[#7DFFB2]/[0.04] border-[#7DFFB2]/40 shadow-[0_0_15px_rgba(125,255,178,0.1)]"
                        : "bg-white/[0.02] border-white/5 opacity-60"
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-[#7DFFB2] bg-[#7DFFB2]/10 px-1.5 py-0.5 rounded">
                          {mod.category}
                        </span>
                        <span className="text-[10px] font-mono text-white/40">{mod.size}</span>
                        <span className="text-[10px] font-mono text-white/40">by {mod.author}</span>
                      </div>
                      <h4 className="text-sm font-bold text-white font-mono truncate">{mod.name}</h4>
                    </div>

                    {/* Toggle Switch */}
                    <button
                      type="button"
                      onClick={() => toggleMod(mod.id)}
                      className="cursor-pointer shrink-0 focus:outline-none"
                      title={mod.enabled ? "Desabilitar mod" : "Habilitar mod"}
                    >
                      {mod.enabled ? (
                        <div className="px-3 py-1.5 rounded-xl bg-[#7DFFB2] text-black font-mono font-black text-xs flex items-center gap-1.5 shadow-[0_0_12px_rgba(125,255,178,0.5)]">
                          <CheckCircle className="h-3.5 w-3.5" />
                          <span>ATIVADO</span>
                        </div>
                      ) : (
                        <div className="px-3 py-1.5 rounded-xl bg-white/10 text-white/50 hover:text-white font-mono font-semibold text-xs flex items-center gap-1.5">
                          <span>DESATIVADO</span>
                        </div>
                      )}
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Bottom Status bar */}
            <div className="mt-6 pt-4 border-t border-white/8 flex flex-wrap items-center justify-between gap-4 text-xs font-mono text-white/50">
              <span>Auto-Atualização de Mods Habilitada</span>
              <span className="text-[#7DFFB2] font-semibold">100% COMPATÍVEL COM STEAM & NATIVE</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
