import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, Sparkles, ArrowRight, ShieldCheck } from "lucide-react";
import type { PlayerLevelInfo, PSNTierInfo } from "../utils/trophyTiers";

interface LevelUpDetail {
  oldLevel: number;
  newLevel: number;
  levelInfo: PlayerLevelInfo;
  tierInfo?: PSNTierInfo;
}

export const LevelUpModal: React.FC = () => {
  const [currentEvent, setCurrentEvent] = useState<LevelUpDetail | null>(null);

  useEffect(() => {
    const handleLevelUp = (e: Event) => {
      const customEvent = e as CustomEvent<LevelUpDetail>;
      if (customEvent.detail) {
        setCurrentEvent(customEvent.detail);
        try {
          const audio = new Audio("./sounds/achievement.mp3");
          audio.volume = 0.65;
          void audio.play().catch(() => {});
        } catch {}
      }
    };

    window.addEventListener("checkpoint:level-up", handleLevelUp);
    return () => window.removeEventListener("checkpoint:level-up", handleLevelUp);
  }, []);

  const handleClose = () => {
    setCurrentEvent(null);
  };

  useEffect(() => {
    if (!currentEvent) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "Enter" || e.key === " ") {
        handleClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentEvent]);

  const { oldLevel, newLevel, levelInfo, tierInfo } = currentEvent || ({} as Partial<LevelUpDetail>);
  const rankColor = tierInfo?.color || levelInfo?.rankColor || "#EAB308";
  const rankName = tierInfo?.name || levelInfo?.tierName || `Nível ${newLevel || 1}`;

  return (
    <AnimatePresence>
      {currentEvent && (
        <div key="level-up-modal" className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
        {/* Backdrop escuro com blur */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={handleClose}
          className="absolute inset-0 bg-black/80 backdrop-blur-xl"
        />

        {/* Efeito de brilho radial de fundo */}
        <div
          className="pointer-events-none absolute -inset-[100px] opacity-40 blur-3xl"
          style={{
            background: `radial-gradient(circle at 50% 50%, ${rankColor}40 0%, transparent 65%)`,
          }}
        />

        {/* Modal Card */}
        <motion.div
          initial={{ scale: 0.8, y: 30, opacity: 0 }}
          animate={{ scale: 1, y: 0, opacity: 1 }}
          exit={{ scale: 0.8, y: 20, opacity: 0 }}
          transition={{ type: "spring", stiffness: 350, damping: 25 }}
          className="relative w-full max-w-md overflow-hidden rounded-[28px] border border-white/20 bg-gradient-to-b from-[#181926]/95 via-[#10111a]/98 to-[#090a0f] p-8 shadow-[0_30px_90px_rgba(0,0,0,0.95)] text-center select-none"
        >
          {/* Luz sutil no topo do card */}
          <div
            className="absolute -top-12 left-1/2 h-28 w-48 -translate-x-1/2 rounded-full blur-2xl pointer-events-none"
            style={{ backgroundColor: rankColor, opacity: 0.35 }}
          />

          {/* Badge Eyebrow */}
          <motion.div
            initial={{ y: -10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/15 bg-white/[0.06] text-xs font-bold uppercase tracking-widest text-amber-300"
          >
            <Sparkles className="w-3.5 h-3.5 animate-pulse" />
            <span>Subiu de Nível!</span>
            <Sparkles className="w-3.5 h-3.5 animate-pulse" />
          </motion.div>

          {/* Ícone de Troféu com pulso */}
          <div className="relative my-6 flex justify-center">
            <motion.div
              initial={{ rotate: -15, scale: 0 }}
              animate={{ rotate: 0, scale: 1 }}
              transition={{ type: "spring", stiffness: 400, damping: 18, delay: 0.15 }}
              className="relative flex h-24 w-24 items-center justify-center rounded-3xl border shadow-2xl"
              style={{
                borderColor: `${rankColor}60`,
                background: `radial-gradient(circle at 30% 30%, ${rankColor}30, #141522)`,
              }}
            >
              <Trophy className="h-12 w-12 drop-shadow-[0_0_20px_rgba(234,179,8,0.6)]" style={{ color: rankColor }} />
            </motion.div>
          </div>

          {/* Transição de Nível: Old -> New */}
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.25 }}
            className="flex items-center justify-center gap-4 text-3xl font-black text-white"
          >
            <span className="text-white/40">Nv. {oldLevel}</span>
            <ArrowRight className="w-6 h-6 text-white/50" />
            <span
              className="text-4xl font-extrabold drop-shadow-[0_0_25px_rgba(255,255,255,0.4)]"
              style={{ color: rankColor }}
            >
              Nv. {newLevel}
            </span>
          </motion.div>

          {/* Nome da Patente / Tier */}
          <motion.div
            initial={{ y: 5, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.35 }}
            className="mt-2 flex items-center justify-center gap-1.5 text-sm font-semibold tracking-wide"
            style={{ color: rankColor }}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>{rankName}</span>
          </motion.div>

          {/* Barra de Progresso do Próximo Nível */}
          <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-left">
            <div className="flex justify-between text-xs font-medium text-white/70 mb-2">
              <span>Progresso para Nível {newLevel + 1}</span>
              <span>
                {levelInfo.currentLevelXp} / {levelInfo.xpForNextLevel} XP ({levelInfo.progress}%)
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
              <motion.div
                initial={{ width: "0%" }}
                animate={{ width: `${levelInfo.progress}%` }}
                transition={{ duration: 1, ease: "easeOut", delay: 0.4 }}
                className="h-full rounded-full"
                style={{ backgroundColor: rankColor }}
              />
            </div>
          </div>

          {/* Botão de Continuar */}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleClose}
            className="mt-6 w-full rounded-2xl py-3.5 font-bold text-sm text-black transition shadow-lg cursor-pointer flex items-center justify-center gap-2"
            style={{
              background: `linear-gradient(135deg, #ffffff 0%, ${rankColor} 100%)`,
            }}
          >
            <span>Continuar Jogando</span>
            <span className="text-[11px] opacity-70 px-1.5 py-0.5 rounded bg-black/20 font-mono">
              Enter / [A]
            </span>
          </motion.button>
        </motion.div>
      </div>
      )}
    </AnimatePresence>
  );
};
