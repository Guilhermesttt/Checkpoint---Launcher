import React, { useState, useRef } from "react";
import { motion } from "framer-motion";
import {
  Play,
  Layers,
  Sparkles,
  Gamepad2,
  Trophy,
  Volume2,
  Tv,
  Disc,
  Flame,
  Radio,
  Share2,
  Cpu,
  Zap,
} from "lucide-react";
import { pherieliumAudio } from "../../utils/pherieliumSound";

const HERO_GAMES = [
  {
    id: "cyberpunk",
    title: "Cyberpunk 2077: Phantom Liberty",
    platform: "PC // STEAM",
    category: "RAY TRACING // 4K MODS",
    playtime: "142h",
    achievements: "68/84 (81%)",
    status: "READY TO LAUNCH",
    banner: "https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80&w=1200&auto=format&fit=crop",
    accent: "#7DFFB2",
    rating: "98%",
    modsCount: "14 Ativos",
  },
  {
    id: "re4",
    title: "Resident Evil 4 Remake",
    platform: "PC // NATIVE",
    category: "SURVIVAL HORROR",
    playtime: "89h",
    achievements: "39/40 (97%)",
    status: "SAVED AT CHAPTER 14",
    banner: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=1200&auto=format&fit=crop",
    accent: "#ef4444",
    rating: "96%",
    modsCount: "6 Ativos",
  },
  {
    id: "gt4",
    title: "Gran Turismo 4",
    platform: "EMULATION // PCSX2 HD",
    category: "RETRO RACING // 60 FPS",
    playtime: "210h",
    achievements: "RETRO-ACHIEVEMENTS ENABLED",
    status: "MEMORY CARD SYNCED",
    banner: "https://images.unsplash.com/photo-1511919884226-fd3cad34687c?q=80&w=1200&auto=format&fit=crop",
    accent: "#38bdf8",
    rating: "100%",
    modsCount: "HD Texture Pack",
  },
  {
    id: "eldenring",
    title: "Elden Ring: Shadow of the Erdtree",
    platform: "PC // STEAM",
    category: "ACTION RPG",
    playtime: "320h",
    achievements: "42/42 (100%)",
    status: "SEAMLESS COOP READY",
    banner: "https://images.unsplash.com/photo-1538481199705-c710c4e965fc?q=80&w=1200&auto=format&fit=crop",
    accent: "#fbbf24",
    rating: "99%",
    modsCount: "Seamless Co-op v1.8",
  },
];

export const PherieliumHero: React.FC = () => {
  const [selectedGameIndex, setSelectedGameIndex] = useState(0);
  const [isLaunching, setIsLaunching] = useState(false);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [mouseTilt, setMouseTilt] = useState({ rotateX: 0, rotateY: 0 });

  const activeGame = HERO_GAMES[selectedGameIndex];

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const rotX = -((y - centerY) / centerY) * 7;
    const rotY = ((x - centerX) / centerX) * 7;
    setMouseTilt({ rotateX: rotX, rotateY: rotY });
  };

  const handleMouseLeave = () => {
    setMouseTilt({ rotateX: 0, rotateY: 0 });
  };

  const handleLaunchSimulation = () => {
    pherieliumAudio.playBootSequence();
    setIsLaunching(true);
    setTimeout(() => {
      setIsLaunching(false);
    }, 2800);
  };

  return (
    <section className="relative pt-32 sm:pt-40 pb-20 sm:pb-32 px-4 sm:px-8 overflow-hidden">
      {/* Top Background Cosmic Glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] sm:w-[900px] h-[350px] bg-[#7DFFB2]/10 rounded-full blur-[140px] pointer-events-none" />

      <div className="mx-auto max-w-6xl text-center relative z-10">
        {/* Microtext System Label */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-white/[0.04] border border-[#7DFFB2]/30 shadow-[0_0_20px_rgba(125,255,178,0.15)] mb-6 sm:mb-8"
        >
          <span className="flex h-2 w-2 rounded-full bg-[#7DFFB2] animate-pulse" />
          <span className="text-[10px] sm:text-xs font-mono font-bold tracking-[0.2em] text-[#7DFFB2] uppercase">
            PHERIELIUM // PERSONAL GAMING HUB
          </span>
          <span className="text-[10px] text-white/30 font-mono">|</span>
          <span className="text-[10px] font-mono tracking-wider text-white/60">
            SYSTEM ONLINE
          </span>
        </motion.div>

        {/* Monumental Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.1 }}
          className="text-4xl sm:text-6xl md:text-7xl lg:text-8xl font-black tracking-tight text-white font-mono leading-[1.05] uppercase"
        >
          YOUR ENTIRE <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-[#E8EDF3] to-[#7DFFB2]">
            GAMING WORLD.
          </span>
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="mt-6 sm:mt-8 mx-auto max-w-2xl text-base sm:text-xl text-[#98A3B3] font-sans font-light leading-relaxed"
        >
          A unified gaming hub designed to bring the seamless console experience to PC.
          Centralize Steam, emulators, mods, achievements, and friends into one majestic OS.
        </motion.p>

        {/* CTA Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.3 }}
          className="mt-8 sm:mt-10 flex flex-wrap items-center justify-center gap-4"
        >
          <a
            href="#hub"
            onMouseEnter={() => pherieliumAudio.playHover()}
            onClick={() => pherieliumAudio.playClick(900)}
            className="group relative inline-flex items-center gap-3 px-8 py-4 rounded-xl bg-[#7DFFB2] text-black font-mono font-black text-sm tracking-wider shadow-[0_0_30px_rgba(125,255,178,0.4)] hover:shadow-[0_0_45px_rgba(125,255,178,0.7)] transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer"
          >
            <Sparkles className="h-4 w-4 fill-black transition-transform group-hover:rotate-12" />
            <span>EXPLORE PHERIELIUM</span>
          </a>

          <a
            href="#console"
            onMouseEnter={() => pherieliumAudio.playHover()}
            onClick={() => pherieliumAudio.playClick(750)}
            className="inline-flex items-center gap-2.5 px-7 py-4 rounded-xl bg-white/[0.04] border border-white/15 hover:border-[#7DFFB2]/50 text-white hover:text-[#7DFFB2] font-mono text-sm tracking-wider backdrop-blur-md transition-all duration-300 hover:bg-white/[0.08] cursor-pointer"
          >
            <Layers className="h-4 w-4" />
            <span>VIEW THE SYSTEM</span>
          </a>
        </motion.div>
      </div>

      {/* Monumental 3D Interactive Console Mockup */}
      <motion.div
        initial={{ opacity: 0, y: 50, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 1.1, delay: 0.4 }}
        className="mt-14 sm:mt-20 mx-auto max-w-6xl relative perspective-[1200px]"
        ref={cardRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        {/* Subtle Outer Frame Halo */}
        <div className="absolute -inset-1.5 bg-gradient-to-b from-[#7DFFB2]/30 via-transparent to-[#7DFFB2]/10 rounded-[32px] blur-xl opacity-60 pointer-events-none" />

        <div
          style={{
            transform: `rotateX(${mouseTilt.rotateX}deg) rotateY(${mouseTilt.rotateY}deg)`,
            transition: "transform 0.15s ease-out",
          }}
          className="relative rounded-[28px] border border-white/15 bg-[#080B10]/95 shadow-[0_25px_70px_rgba(0,0,0,0.9)] backdrop-blur-3xl overflow-hidden"
        >
          {/* Top Mockup Header Bar */}
          <div className="flex items-center justify-between border-b border-white/8 bg-black/40 px-6 py-3.5">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-full bg-rose-500/80" />
                <span className="h-3 w-3 rounded-full bg-amber-500/80" />
                <span className="h-3 w-3 rounded-full bg-emerald-500/80" />
              </div>
              <div className="h-3.5 w-px bg-white/10 mx-1" />
              <div className="flex items-center gap-2 text-[11px] font-mono text-white/50">
                <span className="text-[#7DFFB2] font-semibold">PHERIELIUM OS</span>
                <span>//</span>
                <span>SECTOR 01: UNIFIED DASHBOARD</span>
              </div>
            </div>

            {/* Top Right Live Call Simulation Badge */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 bg-[#23a55a]/15 border border-[#23a55a]/40 px-3 py-1 rounded-full text-[10px] font-mono text-[#23a55a]">
                <span className="h-2 w-2 rounded-full bg-[#23a55a] animate-pulse" />
                <span>VOICE CONNECTED (4 IN PARTY)</span>
              </div>
              <div className="hidden sm:flex items-center gap-1.5 text-[11px] font-mono text-white/40">
                <Cpu className="h-3.5 w-3.5 text-[#7DFFB2]" />
                <span>GPU 62°C // 165 FPS</span>
              </div>
            </div>
          </div>

          {/* Main Console Interface Preview */}
          <div className="p-5 sm:p-8 grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column: Active Game Big Hero Display */}
            <div className="lg:col-span-8 relative rounded-2xl overflow-hidden border border-white/10 bg-gradient-to-b from-[#121820] to-[#080B10] min-h-[380px] sm:min-h-[440px] flex flex-col justify-end p-6 sm:p-8">
              {/* Background Art */}
              <div
                className="absolute inset-0 bg-cover bg-center transition-all duration-700 filter brightness-[0.45] scale-105"
                style={{ backgroundImage: `url(${activeGame.banner})` }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#080B10] via-[#080B10]/60 to-transparent" />

              {/* Game Content Overlay */}
              <div className="relative z-10">
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  <span className="px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold uppercase tracking-wider bg-white/10 text-white border border-white/15 backdrop-blur-md">
                    {activeGame.platform}
                  </span>
                  <span className="px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold uppercase tracking-wider bg-[#7DFFB2]/20 text-[#7DFFB2] border border-[#7DFFB2]/30">
                    {activeGame.category}
                  </span>
                  <span className="px-2.5 py-1 rounded-lg text-[10px] font-mono text-white/70 bg-black/40 border border-white/10">
                    {activeGame.modsCount}
                  </span>
                </div>

                <h3 className="text-2xl sm:text-4xl font-extrabold text-white font-mono tracking-tight leading-tight">
                  {activeGame.title}
                </h3>

                {/* Telemetry Stats Bar */}
                <div className="mt-4 flex flex-wrap items-center gap-6 text-xs font-mono text-white/70 border-t border-white/10 pt-4">
                  <div>
                    <span className="block text-[10px] text-white/40 uppercase">TEMPO DE JOGO</span>
                    <span className="text-white font-bold">{activeGame.playtime}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] text-white/40 uppercase">CONQUISTAS</span>
                    <span className="text-[#7DFFB2] font-bold">{activeGame.achievements}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] text-white/40 uppercase">STATUS</span>
                    <span className="text-white font-semibold">{activeGame.status}</span>
                  </div>
                </div>

                {/* Launch Action Bar */}
                <div className="mt-6 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={handleLaunchSimulation}
                    className={`relative inline-flex items-center gap-2.5 px-6 py-3 rounded-xl font-mono font-black text-xs uppercase tracking-wider transition-all duration-300 ${
                      isLaunching
                        ? "bg-amber-400 text-black scale-95 shadow-[0_0_30px_rgba(251,191,36,0.6)]"
                        : "bg-[#7DFFB2] hover:bg-[#8CFF5A] text-black shadow-[0_0_25px_rgba(125,255,178,0.4)] hover:scale-105 active:scale-95"
                    } cursor-pointer`}
                  >
                    <Play className={`h-4 w-4 fill-black ${isLaunching ? "animate-spin" : ""}`} />
                    <span>{isLaunching ? "INICIALIZANDO..." : "JOGAR AGORA"}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => pherieliumAudio.playTrophy()}
                    className="inline-flex items-center gap-2 px-4 py-3 rounded-xl bg-white/[0.06] border border-white/15 text-white hover:text-[#7DFFB2] hover:border-[#7DFFB2]/50 font-mono text-xs transition cursor-pointer"
                  >
                    <Trophy className="h-3.5 w-3.5" />
                    <span>CONQUISTAS</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => pherieliumAudio.playToggle(true)}
                    className="inline-flex items-center gap-2 px-4 py-3 rounded-xl bg-white/[0.06] border border-white/15 text-white hover:text-[#7DFFB2] hover:border-[#7DFFB2]/50 font-mono text-xs transition cursor-pointer"
                  >
                    <Zap className="h-3.5 w-3.5 text-[#7DFFB2]" />
                    <span>MODS & OVERLAY</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Right Column: Game Selector Carousel */}
            <div className="lg:col-span-4 flex flex-col justify-between gap-3">
              <div className="text-[11px] font-mono tracking-widest text-[#7DFFB2] uppercase flex items-center justify-between pb-1 border-b border-white/8">
                <span>SELEÇÃO RÁPIDA (CONSOLE SWITCH)</span>
                <span>{selectedGameIndex + 1} / {HERO_GAMES.length}</span>
              </div>

              <div className="flex flex-col gap-2.5">
                {HERO_GAMES.map((game, index) => {
                  const isSelected = index === selectedGameIndex;
                  return (
                    <button
                      key={game.id}
                      type="button"
                      onClick={() => {
                        pherieliumAudio.playClick(600 + index * 100);
                        setSelectedGameIndex(index);
                      }}
                      onMouseEnter={() => pherieliumAudio.playHover()}
                      className={`text-left p-3 rounded-xl border transition-all duration-300 flex items-center gap-3.5 cursor-pointer ${
                        isSelected
                          ? "bg-white/[0.08] border-[#7DFFB2] shadow-[0_0_20px_rgba(125,255,178,0.2)] translate-x-1"
                          : "bg-white/[0.02] border-white/8 hover:bg-white/[0.05] hover:border-white/20"
                      }`}
                    >
                      <img
                        src={game.banner}
                        alt={game.title}
                        className="h-12 w-12 rounded-lg object-cover ring-1 ring-white/15 shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-[10px] font-mono text-[#7DFFB2] font-semibold truncate">
                          {game.platform}
                        </div>
                        <div className="text-xs font-bold text-white truncate font-mono">
                          {game.title}
                        </div>
                        <div className="text-[10px] text-white/40 font-mono">
                          {game.playtime} jogadas
                        </div>
                      </div>
                      {isSelected && (
                        <div className="h-2 w-2 rounded-full bg-[#7DFFB2] animate-ping shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Bottom Quick Feature Summary Tag */}
              <div className="rounded-xl border border-white/8 bg-white/[0.02] p-3 text-[11px] font-mono text-white/50 flex items-center justify-between">
                <span>NAVEGAÇÃO COM CONTROLE</span>
                <span className="text-[#7DFFB2] font-bold">XINPUT & DUALSENSE</span>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </section>
  );
};
