import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Palette, Sparkles, Sliders, Check, Monitor, Layout, Eye } from "lucide-react";
import { pherieliumAudio } from "../../utils/pherieliumSound";

interface ThemeOption {
  id: string;
  name: string;
  category: string;
  primaryColor: string;
  bgGradient: string;
  borderGlow: string;
  description: string;
  previewBanner: string;
}

const THEMES: ThemeOption[] = [
  {
    id: "cosmic",
    name: "COSMIC VOID",
    category: "SIGNATURE SPACE",
    primaryColor: "#7DFFB2",
    bgGradient: "from-[#080B10] via-[#050e09] to-[#030408]",
    borderGlow: "border-[#7DFFB2]/50 shadow-[0_0_35px_rgba(125,255,178,0.25)]",
    description: "Preto espacial profundo com toques de verde cósmico e partículas estelares.",
    previewBanner: "https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80&w=800&auto=format&fit=crop",
  },
  {
    id: "retro-ps2",
    name: "RETRO CYBER PS2",
    category: "NOSTALGIA",
    primaryColor: "#38bdf8",
    bgGradient: "from-[#050b14] via-[#071329] to-[#03070f]",
    borderGlow: "border-sky-400/50 shadow-[0_0_35px_rgba(56,189,248,0.25)]",
    description: "Inspirado na interface clássica e menus icônicos de console dos anos 2000.",
    previewBanner: "https://images.unsplash.com/photo-1511919884226-fd3cad34687c?q=80&w=800&auto=format&fit=crop",
  },
  {
    id: "cyber-y2k",
    name: "CYBER Y2K AMBER",
    category: "FUTURISM",
    primaryColor: "#fbbf24",
    bgGradient: "from-[#100b03] via-[#1c1205] to-[#050301]",
    borderGlow: "border-amber-400/50 shadow-[0_0_35px_rgba(251,191,36,0.25)]",
    description: "Estética industrial futurista com acentos em âmbar brilhante e telemetria militar.",
    previewBanner: "https://images.unsplash.com/photo-1538481199705-c710c4e965fc?q=80&w=800&auto=format&fit=crop",
  },
  {
    id: "minimal-void",
    name: "MINIMAL OBSIDIAN",
    category: "PURE MONOCHROME",
    primaryColor: "#ffffff",
    bgGradient: "from-[#0c0d0e] via-[#08090a] to-[#000000]",
    borderGlow: "border-white/40 shadow-[0_0_35px_rgba(255,255,255,0.15)]",
    description: "Minimalismo extremo sem distrações, apenas foco absoluto nos jogos e tipografia.",
    previewBanner: "https://images.unsplash.com/photo-1550745165-9bc0b252726f?q=80&w=800&auto=format&fit=crop",
  },
];

export const CustomizationSection: React.FC = () => {
  const [selectedThemeId, setSelectedThemeId] = useState("cosmic");

  const activeTheme = THEMES.find((t) => t.id === selectedThemeId) || THEMES[0];

  return (
    <section id="themes" className="relative py-24 sm:py-32 px-4 sm:px-8 border-t border-white/5">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-16">
          <div>
            <div className="text-[11px] font-mono tracking-widest text-[#7DFFB2] uppercase mb-2">
              // 07. PERSONALIZATION ENGINE
            </div>
            <h2 className="text-3xl sm:text-5xl font-black text-white font-mono uppercase tracking-tight">
              MAKE IT <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-white to-[#7DFFB2]">
                YOURS.
              </span>
            </h2>
          </div>
          <p className="max-w-md text-sm sm:text-base text-[#98A3B3] font-light leading-relaxed">
            Seu Gaming Hub reflete sua identidade. Escolha entre temas espaciais, retrô dos anos 2000,
            visuais cyberpunk ou minimalismo absoluto.
          </p>
        </div>

        {/* Theme Selector + Live Interactive Preview */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          {/* Left: Theme Selection Grid */}
          <div className="lg:col-span-5 space-y-3">
            <div className="text-xs font-mono text-white/50 uppercase mb-3 flex items-center gap-2">
              <Palette className="h-4 w-4 text-[#7DFFB2]" />
              <span>SELECIONE UM TEMA PARA TESTAR AO VIVO:</span>
            </div>

            {THEMES.map((theme) => {
              const isSelected = theme.id === selectedThemeId;
              return (
                <button
                  key={theme.id}
                  type="button"
                  onClick={() => {
                    pherieliumAudio.playClick(800);
                    setSelectedThemeId(theme.id);
                  }}
                  onMouseEnter={() => pherieliumAudio.playHover()}
                  className={`w-full text-left p-4 rounded-2xl border transition-all duration-300 flex items-center justify-between cursor-pointer ${
                    isSelected
                      ? "bg-white/[0.08] border-white/30 shadow-lg translate-x-2"
                      : "bg-white/[0.02] border-white/5 hover:bg-white/[0.05] hover:border-white/15"
                  }`}
                >
                  <div className="flex items-center gap-3.5">
                    <div
                      className="h-9 w-9 rounded-xl border flex items-center justify-center font-bold text-xs"
                      style={{
                        backgroundColor: `${theme.primaryColor}20`,
                        borderColor: theme.primaryColor,
                        color: theme.primaryColor,
                      }}
                    >
                      {theme.name.slice(0, 2)}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white font-mono">{theme.name}</div>
                      <div className="text-[10px] text-white/40 font-mono">{theme.category}</div>
                    </div>
                  </div>

                  {isSelected && (
                    <div
                      className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold"
                      style={{ backgroundColor: theme.primaryColor, color: "#000000" }}
                    >
                      ATIVO
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Right: Interactive Mockup Transformed By Active Theme */}
          <div className="lg:col-span-7">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTheme.id}
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.3 }}
                className={`rounded-3xl border bg-gradient-to-b ${activeTheme.bgGradient} ${activeTheme.borderGlow} p-6 sm:p-8 flex flex-col justify-between min-h-[380px] transition-all`}
              >
                <div>
                  <div className="flex items-center justify-between pb-4 mb-6 border-b border-white/10">
                    <div className="flex items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 rounded-full animate-pulse"
                        style={{ backgroundColor: activeTheme.primaryColor }}
                      />
                      <span
                        className="text-xs font-mono font-bold tracking-widest uppercase"
                        style={{ color: activeTheme.primaryColor }}
                      >
                        {activeTheme.name}
                      </span>
                    </div>
                    <span className="text-[10px] font-mono text-white/40">
                      LIVE THEME PREVIEW
                    </span>
                  </div>

                  <h3 className="text-xl sm:text-2xl font-bold text-white font-mono">
                    {activeTheme.description}
                  </h3>

                  {/* Sample Theme UI Elements */}
                  <div className="mt-8 grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <div className="p-3 rounded-xl bg-white/[0.04] border border-white/10 text-xs font-mono">
                      <span className="text-white/40 block text-[9px]">COR DE DESTAQUE</span>
                      <span style={{ color: activeTheme.primaryColor }} className="font-bold">
                        {activeTheme.primaryColor}
                      </span>
                    </div>
                    <div className="p-3 rounded-xl bg-white/[0.04] border border-white/10 text-xs font-mono">
                      <span className="text-white/40 block text-[9px]">BACKGROUND</span>
                      <span className="text-white font-bold">Deep Space Shader</span>
                    </div>
                    <div className="p-3 rounded-xl bg-white/[0.04] border border-white/10 text-xs font-mono col-span-2 sm:col-span-1">
                      <span className="text-white/40 block text-[9px]">TIPOGRAFIA</span>
                      <span className="text-white font-bold">Futuristic Mono</span>
                    </div>
                  </div>
                </div>

                <div className="mt-8 pt-4 border-t border-white/10 flex items-center justify-between text-xs font-mono text-white/50">
                  <span>Customização de Cores Hex e Wallpapers Personalizados</span>
                  <span style={{ color: activeTheme.primaryColor }}>100% MODULAR</span>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  );
};
