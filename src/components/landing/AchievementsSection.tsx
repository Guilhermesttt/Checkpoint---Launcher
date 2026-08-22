import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, Award, Sparkles, Star, Flame, CheckCircle2, ShieldAlert } from "lucide-react";
import { pherieliumAudio } from "../../utils/pherieliumSound";

interface TrophyItem {
  id: string;
  title: string;
  game: string;
  rarity: string;
  percent: string;
  iconBg: string;
  description: string;
  points: number;
}

const TROPHIES: TrophyItem[] = [
  {
    id: "t1",
    title: "Master of the Void",
    game: "Cyberpunk 2077 // Phantom Liberty",
    rarity: "ULTRA RARE",
    percent: "4.2%",
    iconBg: "from-amber-400/30 to-amber-600/10",
    description: "Complete all story endings and unlock max cyberware capacity.",
    points: 100,
  },
  {
    id: "t2",
    title: "Gran Turismo Legend",
    game: "Gran Turismo 4 (PCSX2 RetroAchievements)",
    rarity: "PLATINUM",
    percent: "1.8%",
    iconBg: "from-[#7DFFB2]/30 to-[#7DFFB2]/5",
    description: "Achieve 100% completion in Gran Turismo Mode with all Gold Licenses.",
    points: 250,
  },
  {
    id: "t3",
    title: "S-Rank Professional Agent",
    game: "Resident Evil 4 Remake",
    rarity: "RARE",
    percent: "8.4%",
    iconBg: "from-sky-400/30 to-sky-600/10",
    description: "Complete Professional Mode in under 5 hours and 30 minutes.",
    points: 80,
  },
];

export const AchievementsSection: React.FC = () => {
  const [unlockedToast, setUnlockedToast] = useState<TrophyItem | null>(null);

  const triggerTrophyUnlock = (item: TrophyItem) => {
    pherieliumAudio.playTrophy();
    setUnlockedToast(item);
    setTimeout(() => {
      setUnlockedToast(null);
    }, 4000);
  };

  return (
    <section id="achievements" className="relative py-24 sm:py-32 px-4 sm:px-8 border-t border-white/5 bg-[#05070B]/80">
      <div className="mx-auto max-w-6xl">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="text-[11px] font-mono tracking-widest text-[#7DFFB2] uppercase mb-2">
            // 04. GLOBAL TROPHY SYSTEM
          </div>
          <h2 className="text-3xl sm:text-5xl font-black text-white font-mono uppercase tracking-tight">
            MAKE EVERY <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-white to-[#7DFFB2]">
              GAME COUNT.
            </span>
          </h2>
          <p className="mt-4 text-sm sm:text-base text-[#98A3B3] font-light leading-relaxed">
            Seja em títulos modernos de PC ou clássicos retrô emulados, cada conquista é catalogada
            com raridade, estatísticas e notificações estilo console em tempo real.
          </p>
        </div>

        {/* Big Overall Progress Card */}
        <div className="mb-12 rounded-3xl border border-white/10 bg-gradient-to-r from-[#080B10] via-white/[0.02] to-[#080B10] p-6 sm:p-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-2 text-xs font-mono text-white/50 uppercase mb-1">
                <Trophy className="h-4 w-4 text-[#7DFFB2]" />
                <span>PROGRESSO GLOBAL DE CONQUISTAS</span>
              </div>
              <div className="text-2xl sm:text-3xl font-black text-white font-mono">
                67 / 84 DESBLOQUEADAS <span className="text-[#7DFFB2] text-xl font-bold">(79.7%)</span>
              </div>
            </div>

            <div className="flex items-center gap-4 text-xs font-mono">
              <div className="px-4 py-2 rounded-xl bg-white/[0.04] border border-white/8">
                <span className="block text-[10px] text-white/40">RETRO-ACHIEVEMENTS</span>
                <span className="text-white font-bold">1,420 PTS</span>
              </div>
              <div className="px-4 py-2 rounded-xl bg-white/[0.04] border border-white/8">
                <span className="block text-[10px] text-white/40">RARAS DESBLOQUEADAS</span>
                <span className="text-[#7DFFB2] font-bold">14 PLATINAS</span>
              </div>
            </div>
          </div>

          {/* Futuristic Progress Bar */}
          <div className="mt-6 w-full h-3 rounded-full bg-white/5 overflow-hidden p-0.5 border border-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-[#7DFFB2] shadow-[0_0_15px_rgba(125,255,178,0.7)]"
              style={{ width: "79.7%" }}
            />
          </div>
        </div>

        {/* Trophy Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {TROPHIES.map((trophy) => (
            <div
              key={trophy.id}
              className="group relative rounded-2xl border border-white/10 bg-[#080B10] p-6 hover:border-[#7DFFB2]/50 hover:shadow-[0_0_25px_rgba(125,255,178,0.15)] transition-all duration-300 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-[10px] font-mono font-bold tracking-wider px-2 py-0.5 rounded-md bg-[#7DFFB2]/10 text-[#7DFFB2] border border-[#7DFFB2]/25">
                    {trophy.rarity} // {trophy.percent}
                  </span>
                  <span className="text-xs font-mono font-bold text-amber-400 flex items-center gap-1">
                    <Star className="h-3.5 w-3.5 fill-amber-400" />
                    +{trophy.points} XP
                  </span>
                </div>

                <div className="flex items-center gap-3.5 mb-3">
                  <div
                    className={`h-12 w-12 rounded-xl bg-gradient-to-br ${trophy.iconBg} border border-white/15 flex items-center justify-center text-white shrink-0 group-hover:scale-110 transition-transform`}
                  >
                    <Trophy className="h-6 w-6 text-[#7DFFB2]" />
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-white font-mono group-hover:text-[#7DFFB2] transition-colors">
                      {trophy.title}
                    </h4>
                    <span className="text-[11px] text-white/40 font-mono block truncate">
                      {trophy.game}
                    </span>
                  </div>
                </div>

                <p className="text-xs text-[#98A3B3] font-light leading-relaxed mt-2 font-sans">
                  {trophy.description}
                </p>
              </div>

              {/* Interactive Unlock Simulation Button */}
              <button
                type="button"
                onClick={() => triggerTrophyUnlock(trophy)}
                className="mt-6 w-full py-2.5 rounded-xl bg-white/[0.04] hover:bg-[#7DFFB2] hover:text-black text-white/70 font-mono text-xs font-bold tracking-wider border border-white/10 hover:border-[#7DFFB2] transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
              >
                <Sparkles className="h-3.5 w-3.5" />
                TESTAR SOM DE CONQUISTA
              </button>
            </div>
          ))}
        </div>

        {/* Live Floating Achievement Toast Simulation */}
        <AnimatePresence>
          {unlockedToast && (
            <motion.div
              initial={{ opacity: 0, y: -40, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -30, scale: 0.9 }}
              className="fixed top-24 right-6 z-50 flex items-center gap-4 rounded-2xl border border-[#7DFFB2]/50 bg-[#080B10]/95 p-4 pr-6 shadow-[0_15px_45px_rgba(0,0,0,0.85)] backdrop-blur-2xl"
            >
              <div className="h-12 w-12 rounded-xl bg-[#7DFFB2]/20 border border-[#7DFFB2] flex items-center justify-center text-[#7DFFB2] shadow-[0_0_20px_rgba(125,255,178,0.5)]">
                <Trophy className="h-6 w-6 animate-bounce" />
              </div>
              <div>
                <div className="text-[10px] font-mono font-bold tracking-widest text-[#7DFFB2] uppercase">
                  CONQUISTA DESBLOQUEADA!
                </div>
                <div className="text-sm font-bold text-white font-mono">{unlockedToast.title}</div>
                <div className="text-[11px] text-white/50 font-mono">
                  {unlockedToast.game} • +{unlockedToast.points} XP
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
};
