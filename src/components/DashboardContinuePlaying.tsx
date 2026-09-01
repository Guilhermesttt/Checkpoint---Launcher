import React from "react";
import { motion } from "framer-motion";
import { Clock, Play, Star, Trophy, Zap } from "lucide-react";
import type { Game } from "../types/domain";
import { formatPlayedHours, getGamePlayedHours } from "../utils/playtime";

interface DashboardContinuePlayingProps {
  continuePlayingGames: Game[];
  onPlayGame: (game: Game) => void;
  playSound?: (sound: any) => void;
}

const platformBadge = (launcherType?: string) => {
  switch (launcherType) {
    case "steam": return { label: "Steam", color: "bg-[#1a9fff]/20 text-[#1a9fff] border-[#1a9fff]/30" };
    case "epic": return { label: "Epic", color: "bg-white/10 text-white/80 border-white/15" };
    case "ea": return { label: "EA", color: "bg-[#f0951e]/20 text-[#f0951e] border-[#f0951e]/30" };
    case "ubisoft": return { label: "Ubisoft", color: "bg-[#00a4ef]/20 text-[#00a4ef] border-[#00a4ef]/30" };
    case "gog": return { label: "GOG", color: "bg-[#a1359c]/20 text-[#a1359c] border-[#a1359c]/30" };
    case "xbox": return { label: "Xbox", color: "bg-[#107c10]/20 text-[#107c10] border-[#107c10]/30" };
    case "riot": return { label: "Riot", color: "bg-[#d32936]/20 text-[#d32936] border-[#d32936]/30" };
    case "battlenet": return { label: "Battle.net", color: "bg-[#00aeef]/20 text-[#00aeef] border-[#00aeef]/30" };
    case "rockstar": return { label: "Rockstar", color: "bg-[#f5a623]/20 text-[#f5a623] border-[#f5a623]/30" };
    default: return { label: "Local", color: "bg-white/8 text-white/50 border-white/10" };
  }
};

const ContinueCard: React.FC<{
  game: Game;
  index: number;
  onPlay: () => void;
  playSound?: (sound: any) => void;
  featured?: boolean;
}> = ({ game, index, onPlay, playSound, featured = false }) => {
  const hours = getGamePlayedHours(game);
  const badge = platformBadge(game.launcherType);
  const totalAch = game.totalAchievements || 0;
  const achievementPct = totalAch > 0
    ? Math.round(((game.completedAchievements || 0) / totalAch) * 100)
    : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.35, delay: index * 0.06, ease: [0.16, 1, 0.3, 1] }}
      className={`group relative shrink-0 overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-sm transition-all duration-300 hover:border-white/20 hover:bg-white/[0.06] hover:shadow-[0_8px_40px_rgba(0,0,0,0.5)] ${
        featured ? "w-[340px] h-[190px]" : "w-[220px] h-[140px]"
      }`}
      onMouseEnter={() => playSound?.("hover")}
    >
      {/* Background Image */}
      <div className="absolute inset-0 z-0">
        {(game.backgroundImage || game.image || game.cardImage) && (
          <img
            src={game.backgroundImage || game.cardImage || game.image}
            alt=""
            className="h-full w-full object-cover opacity-30 transition-opacity duration-500 group-hover:opacity-50"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent" />
      </div>

      {/* Platform Badge */}
      <div className="absolute top-3 left-3 z-10">
        <span className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${badge.color}`}>
          {badge.label}
        </span>
      </div>

      {/* Favorite Star */}
      {game.isFavorite && (
        <div className="absolute top-3 right-3 z-10">
          <Star className="h-3.5 w-3.5 fill-white/80 text-white/80" />
        </div>
      )}

      {/* Achievement Badge */}
      {achievementPct > 0 && (
        <div className="absolute top-3 right-3 z-10">
          <span className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-black/40 px-1.5 py-0.5 text-[9px] font-bold text-white/70 backdrop-blur-sm">
            <Trophy className="h-2.5 w-2.5" /> {achievementPct}%
          </span>
        </div>
      )}

      {/* Content */}
      <div className="absolute inset-0 z-10 flex flex-col justify-end p-4">
        <h3 className={`font-display font-bold text-white leading-tight line-clamp-2 ${featured ? "text-lg" : "text-sm"}`}>
          {game.title}
        </h3>
        <div className="mt-1.5 flex items-center gap-2">
          {hours > 0 && (
            <span className="flex items-center gap-1 text-[10px] text-white/50">
              <Clock className="h-2.5 w-2.5" /> {formatPlayedHours(hours)}h
            </span>
          )}
          {game.category && (
            <span className="text-[10px] text-white/35">{game.category}</span>
          )}
        </div>

        {/* Play Button (appears on hover) */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-0 transition-all duration-300 group-hover:opacity-100 group-hover:scale-100 scale-75">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onPlay();
            }}
            className="flex h-12 w-12 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white backdrop-blur-md transition-all hover:bg-white/20 hover:scale-110 hover:shadow-[0_0_20px_rgba(255,255,255,0.15)]"
          >
            <Play className="h-5 w-5 fill-white" />
          </button>
        </div>
      </div>
    </motion.div>
  );
};

const DashboardContinuePlaying: React.FC<DashboardContinuePlayingProps> = ({
  continuePlayingGames,
  onPlayGame,
  playSound,
}) => {
  if (continuePlayingGames.length === 0) {
    return null;
  }

  return (
    <div className="px-10 pb-6">
      {/* Continue Playing Section */}
      {continuePlayingGames.length > 0 && (
        <div>
          <div className="mb-3 flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-white/[0.06]">
              <Zap className="h-3.5 w-3.5 text-white/70" />
            </div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-white/50">Continuar Jogando</h2>
          </div>
          <div className="flex gap-4 overflow-x-auto pb-2 no-scrollbar">
            {continuePlayingGames.map((game, index) => (
              <ContinueCard
                key={game.id}
                game={game}
                index={index}
                onPlay={() => onPlayGame(game)}
                playSound={playSound}
                featured={index === 0}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardContinuePlaying;
