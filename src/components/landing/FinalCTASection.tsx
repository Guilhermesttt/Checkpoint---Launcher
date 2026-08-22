import React, { useState } from "react";
import { motion } from "framer-motion";
import { Download, Sparkles, Terminal, Github, CheckCircle2, ArrowRight } from "lucide-react";
import { pherieliumAudio } from "../../utils/pherieliumSound";

export const FinalCTASection: React.FC = () => {
  const [isBooting, setIsBooting] = useState(false);

  const handleBoot = () => {
    pherieliumAudio.playBootSequence();
    setIsBooting(true);
    setTimeout(() => {
      window.location.href = "/download";
    }, 1800);
  };

  return (
    <section className="relative py-32 sm:py-48 px-4 sm:px-8 border-t border-white/5 overflow-hidden bg-[#030408]">
      {/* Background Volumetric Beam */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] sm:w-[900px] h-[400px] bg-[#7DFFB2]/15 rounded-full blur-[160px] pointer-events-none" />

      <div className="mx-auto max-w-4xl text-center relative z-10">
        {/* System Pill */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/[0.04] border border-[#7DFFB2]/40 shadow-[0_0_20px_rgba(125,255,178,0.2)] mb-8">
          <span className="h-2 w-2 rounded-full bg-[#7DFFB2] animate-ping" />
          <span className="text-xs font-mono font-bold tracking-widest text-[#7DFFB2] uppercase">
            EXPERIMENTE NO WINDOWS 10 / 11
          </span>
        </div>

        {/* Monumental Headline */}
        <h2 className="text-4xl sm:text-6xl md:text-7xl font-black text-white font-mono uppercase tracking-tight leading-[1.05]">
          YOUR GAMES. <br />
          YOUR SPACE. <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-[#E8EDF3] to-[#7DFFB2]">
            YOUR PHERIELIUM.
          </span>
        </h2>

        <p className="mt-6 text-base sm:text-xl text-[#98A3B3] font-light max-w-xl mx-auto font-sans leading-relaxed">
          One environment for everything you play. Centralize sua biblioteca, eleve seus gráficos com mods
          e jogue com a liberdade definitiva.
        </p>

        {/* CTAs */}
        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <button
            type="button"
            onClick={handleBoot}
            onMouseEnter={() => pherieliumAudio.playHover()}
            className={`group relative inline-flex items-center gap-3 px-8 sm:px-10 py-4 sm:py-5 rounded-2xl font-mono font-black text-sm tracking-wider transition-all duration-300 cursor-pointer ${
              isBooting
                ? "bg-amber-400 text-black scale-95 shadow-[0_0_40px_rgba(251,191,36,0.8)]"
                : "bg-[#7DFFB2] hover:bg-[#8CFF5A] text-black shadow-[0_0_35px_rgba(125,255,178,0.5)] hover:shadow-[0_0_55px_rgba(125,255,178,0.8)] hover:scale-105 active:scale-95"
            }`}
          >
            <Download className="h-5 w-5 fill-black" />
            <span>{isBooting ? "INITIALIZING BOOT SEQUENCE..." : "ENTER PHERIELIUM // BAIXAR"}</span>
          </button>

          <a
            href="https://github.com/Guilhermesttt/Checkpoint---Launcher"
            target="_blank"
            rel="noreferrer"
            onMouseEnter={() => pherieliumAudio.playHover()}
            onClick={() => pherieliumAudio.playClick(750)}
            className="inline-flex items-center gap-2.5 px-6 py-4 sm:py-5 rounded-2xl bg-white/[0.04] border border-white/15 hover:border-white/30 text-white font-mono text-sm tracking-wider backdrop-blur-md transition-all hover:bg-white/[0.08] cursor-pointer"
          >
            <Github className="h-4 w-4" />
            <span>CÓDIGO NO GITHUB</span>
          </a>
        </div>

        {/* System Specs Requirements */}
        <div className="mt-12 flex flex-wrap items-center justify-center gap-6 text-xs font-mono text-white/40">
          <span className="flex items-center gap-1.5 text-emerald-400">
            <CheckCircle2 className="h-3.5 w-3.5" /> 100% Gratuito & Aberto
          </span>
          <span>•</span>
          <span>Windows 10 / 11 (64-bit)</span>
          <span>•</span>
          <span>Instalador Leve (Sem Telemetria Invasiva)</span>
        </div>
      </div>
    </section>
  );
};
