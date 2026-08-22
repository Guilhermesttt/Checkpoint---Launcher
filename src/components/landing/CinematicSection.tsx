import React from "react";
import { motion } from "framer-motion";
import { Sparkles, Disc, Radio } from "lucide-react";

export const CinematicSection: React.FC = () => {
  return (
    <section className="relative py-36 sm:py-48 px-4 sm:px-8 border-t border-white/5 overflow-hidden bg-black flex items-center justify-center text-center">
      {/* Background Volumetric Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] sm:w-[800px] h-[500px] sm:h-[800px] bg-gradient-to-tr from-[#7DFFB2]/15 to-sky-500/10 rounded-full blur-[180px] pointer-events-none" />

      {/* Floating Monolith Hologram */}
      <div className="relative z-10 max-w-4xl mx-auto flex flex-col items-center">
        {/* Orbital Geometric Centerpiece */}
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
          className="relative mb-8 flex h-28 w-28 sm:h-36 sm:w-36 items-center justify-center rounded-full border border-[#7DFFB2]/30 bg-gradient-to-b from-[#7DFFB2]/10 via-black to-black shadow-[0_0_60px_rgba(125,255,178,0.25)]"
        >
          <div className="absolute -inset-2 rounded-full border border-dashed border-[#7DFFB2]/20 animate-spin" />
          <img
            src="/Checkpoint_Logo.png"
            alt="Pherielium Symbol"
            className="h-12 w-12 sm:h-16 sm:w-16 object-contain filter drop-shadow-[0_0_15px_rgba(125,255,178,0.8)]"
          />
        </motion.div>

        {/* Telemetry Coordinates */}
        <div className="text-xs font-mono tracking-[0.3em] text-[#7DFFB2] uppercase mb-4">
          // COORD: 45.298 // SECTOR 07 // SYSTEM READY
        </div>

        {/* Monumental Cinematic Headline */}
        <h2 className="text-4xl sm:text-6xl md:text-7xl font-black text-white font-mono uppercase tracking-tight leading-[1.1]">
          ENTER YOUR <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#7DFFB2] via-white to-sky-300">
            GAMING UNIVERSE.
          </span>
        </h2>

        <p className="mt-6 text-sm sm:text-base text-[#98A3B3] font-light max-w-lg mx-auto font-sans leading-relaxed">
          O Pherielium não quer substituir seu computador. Ele quer transformar a maneira
          como você usa seu PC para jogar.
        </p>
      </div>
    </section>
  );
};
