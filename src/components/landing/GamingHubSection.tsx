import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Gamepad2, Layers, Sparkles, Filter, Play, CheckCircle2, Flame, FolderGit2 } from "lucide-react";
import { pherieliumAudio } from "../../utils/pherieliumSound";

const PLATFORMS = [
  { id: "all", label: "ALL GAMES", count: 142 },
  { id: "steam", label: "STEAM", count: 78 },
  { id: "epic", label: "EPIC GAMES", count: 24 },
  { id: "retro", label: "RETRO & EMULATORS", count: 31 },
  { id: "modded", label: "NEXUS / MODDED", count: 9 },
];

const HUB_GAMES = [
  {
    id: "g1",
    title: "God of War Ragnarök",
    platform: "STEAM",
    platformType: "steam",
    cover: "https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80&w=600&auto=format&fit=crop",
    playtime: "64h",
    progress: "84%",
    isInstalled: true,
    badge: "PS5 PC PORT",
  },
  {
    id: "g2",
    title: "Shadow of the Colossus",
    platform: "PCSX2 // PS2 EMULATION",
    platformType: "retro",
    cover: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=600&auto=format&fit=crop",
    playtime: "32h",
    progress: "100%",
    isInstalled: true,
    badge: "HD WIDESCREEN",
  },
  {
    id: "g3",
    title: "Grand Theft Auto V: Enhanced",
    platform: "EPIC GAMES",
    platformType: "epic",
    cover: "https://images.unsplash.com/photo-1511919884226-fd3cad34687c?q=80&w=600&auto=format&fit=crop",
    playtime: "190h",
    progress: "60%",
    isInstalled: true,
    badge: "ONLINE READY",
  },
  {
    id: "g4",
    title: "The Legend of Zelda: Twilight Princess",
    platform: "DOLPHIN // GC",
    platformType: "retro",
    cover: "https://images.unsplash.com/photo-1579373903781-fd5c0c30c4cd?q=80&w=600&auto=format&fit=crop",
    playtime: "48h",
    progress: "75%",
    isInstalled: true,
    badge: "4K TEXTURES",
  },
  {
    id: "g5",
    title: "Skyrim: Special Edition",
    platform: "NEXUS MODDED",
    platformType: "modded",
    cover: "https://images.unsplash.com/photo-1538481199705-c710c4e965fc?q=80&w=600&auto=format&fit=crop",
    playtime: "410h",
    progress: "92%",
    isInstalled: true,
    badge: "128 MODS ENABLED",
  },
  {
    id: "g6",
    title: "Metal Gear Solid 3: Snake Eater",
    platform: "PCSX2 // 60 FPS",
    platformType: "retro",
    cover: "https://images.unsplash.com/photo-1550745165-9bc0b252726f?q=80&w=600&auto=format&fit=crop",
    playtime: "28h",
    progress: "100%",
    isInstalled: true,
    badge: "RETRO TROPHIES",
  },
  {
    id: "g7",
    title: "Cyberpunk 2077: Phantom Liberty",
    platform: "STEAM",
    platformType: "steam",
    cover: "https://images.unsplash.com/photo-1563089145-599997674d42?q=80&w=600&auto=format&fit=crop",
    playtime: "142h",
    progress: "81%",
    isInstalled: true,
    badge: "PATH TRACING",
  },
  {
    id: "g8",
    title: "Gran Turismo 4",
    platform: "PCSX2 // PS2",
    platformType: "retro",
    cover: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=600&auto=format&fit=crop",
    playtime: "210h",
    progress: "95%",
    isInstalled: true,
    badge: "60 FPS 1440P",
  },
];

export const GamingHubSection: React.FC = () => {
  const [activePlatform, setActivePlatform] = useState("all");

  const filteredGames = HUB_GAMES.filter((g) => {
    if (activePlatform === "all") return true;
    return g.platformType === activePlatform;
  });

  return (
    <section id="hub" className="relative py-24 sm:py-32 px-4 sm:px-8 border-t border-white/5">
      <div className="mx-auto max-w-6xl">
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
          <div>
            <div className="text-[11px] font-mono tracking-widest text-[#7DFFB2] uppercase mb-2">
              // 01. UNIFIED ECOSYSTEM
            </div>
            <h2 className="text-3xl sm:text-5xl font-black text-white font-mono uppercase tracking-tight">
              ONE HUB. <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-white to-[#7DFFB2]">
                EVERY GAME.
              </span>
            </h2>
          </div>
          <p className="max-w-md text-sm sm:text-base text-[#98A3B3] font-light leading-relaxed">
            Reúna seus jogos de PC nativos, lojas digitais e emuladores em uma biblioteca centralizada
            com metadados automáticos, capas em alta definição e estatísticas em tempo real.
          </p>
        </div>

        {/* Interactive Platform Tabs */}
        <div className="flex flex-wrap items-center gap-2 mb-8 p-1.5 rounded-2xl bg-white/[0.03] border border-white/8 backdrop-blur-md w-fit">
          {PLATFORMS.map((tab) => {
            const isActive = tab.id === activePlatform;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  pherieliumAudio.playClick(700);
                  setActivePlatform(tab.id);
                }}
                onMouseEnter={() => pherieliumAudio.playHover()}
                className={`px-4 py-2 rounded-xl text-xs font-mono font-bold tracking-wider transition-all duration-300 flex items-center gap-2 cursor-pointer ${
                  isActive
                    ? "bg-[#7DFFB2] text-black shadow-[0_0_18px_rgba(125,255,178,0.4)]"
                    : "text-white/60 hover:text-white hover:bg-white/[0.06]"
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-md font-mono ${
                    isActive ? "bg-black/20 text-black font-extrabold" : "bg-white/10 text-white/50"
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Dynamic Responsive Game Cards Grid */}
        <motion.div layout className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <AnimatePresence mode="popLayout">
            {filteredGames.map((game) => (
              <motion.div
                key={game.id}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.3 }}
                className="group relative rounded-2xl border border-white/10 bg-[#080B10]/80 p-3.5 hover:border-[#7DFFB2]/60 hover:shadow-[0_0_25px_rgba(125,255,178,0.2)] transition-all duration-300 flex flex-col justify-between"
              >
                {/* Game Box Art */}
                <div className="relative aspect-[3/4] w-full rounded-xl overflow-hidden mb-3.5 bg-black/50">
                  <img
                    src={game.cover}
                    alt={game.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 filter brightness-90 group-hover:brightness-100"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20" />

                  {/* Top Badge */}
                  <div className="absolute top-2.5 left-2.5">
                    <span className="px-2 py-0.5 rounded-md text-[9px] font-mono font-bold tracking-wider bg-black/70 text-[#7DFFB2] border border-[#7DFFB2]/30 backdrop-blur-md">
                      {game.badge}
                    </span>
                  </div>

                  {/* Play Simulation Overlay */}
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40 backdrop-blur-[2px]">
                    <div className="h-12 w-12 rounded-full bg-[#7DFFB2] text-black flex items-center justify-center shadow-lg transform translate-y-2 group-hover:translate-y-0 transition-transform">
                      <Play className="h-5 w-5 fill-black ml-0.5" />
                    </div>
                  </div>
                </div>

                {/* Info & Telemetry */}
                <div>
                  <div className="text-[10px] font-mono text-white/40 uppercase mb-1 flex items-center justify-between">
                    <span>{game.platform}</span>
                    <span className="text-[#7DFFB2] font-semibold">{game.progress}</span>
                  </div>
                  <h4 className="text-sm font-bold text-white font-mono truncate group-hover:text-[#7DFFB2] transition-colors">
                    {game.title}
                  </h4>
                  <div className="mt-2.5 flex items-center justify-between text-[11px] font-mono text-white/50 border-t border-white/5 pt-2">
                    <span>{game.playtime} jogadas</span>
                    <span className="flex items-center gap-1 text-emerald-400">
                      <CheckCircle2 className="h-3 w-3" />
                      Pronto
                    </span>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      </div>
    </section>
  );
};
