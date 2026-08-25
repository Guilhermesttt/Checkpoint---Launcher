import React from "react";
import { Flame, Users2 } from "lucide-react";
import type { TranslationKey } from "../context/PreferencesContext";
import type { Game } from "../types/domain";
import { motion } from "framer-motion";

interface FriendPresenceSnapshot {
  id: string;
  name: string;
  status: "online" | "playing" | "offline";
  playing?: string;
  avatar?: string;
}

interface ActivityItem {
  id: string;
  title: string;
  detail: string;
}

interface HomeOverviewPanelsProps {
  continuePlaying: Game[];
  favoriteGames: Game[];
  friendsPlaying: FriendPresenceSnapshot[];
  recentActivity: ActivityItem[];
  onOpenGame: (game: Game) => void;
  onOpenFriends: () => void;
  onOpenFriendChat: (friendId: string) => void;
  t: (key: TranslationKey) => string;
}

export const HomeOverviewPanels = React.memo(function HomeOverviewPanels({
  friendsPlaying,
  recentActivity,
  onOpenFriends,
}: HomeOverviewPanelsProps) {
  const topFriends = friendsPlaying.slice(0, 2);
  const topActivities = recentActivity.slice(0, 2);

  return (
    <div className="absolute top-7 right-8 flex flex-col gap-3 z-40 pointer-events-none">
      {topFriends.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          onClick={onOpenFriends}
          className="pointer-events-auto rounded-2xl border border-white/[0.08] bg-[#08090C]/90 backdrop-blur-xl p-3 w-64 shadow-[0_10px_30px_rgba(0,0,0,0.5)] flex items-center gap-3 cursor-pointer hover:border-white/20 transition-colors"
        >
          <div className="w-8 h-8 rounded-xl bg-white/[0.05] border border-white/[0.08] flex items-center justify-center shrink-0">
            <Users2 className="h-4 w-4 text-white/80" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-medium tracking-wider text-white/40 uppercase">Amigos online</p>
            <p className="text-xs font-medium text-white truncate">{topFriends[0].name} e mais</p>
          </div>
        </motion.div>
      )}

      {topActivities.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
          className="pointer-events-auto rounded-2xl border border-white/[0.08] bg-[#08090C]/90 backdrop-blur-xl p-3 w-64 shadow-[0_10px_30px_rgba(0,0,0,0.5)] flex items-center gap-3"
        >
          <div className="w-8 h-8 rounded-xl bg-white/[0.05] border border-white/[0.08] flex items-center justify-center shrink-0">
            <Flame className="h-4 w-4 text-white/80" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-medium tracking-wider text-white/40 uppercase">Atividade recente</p>
            <p className="text-xs font-medium text-white truncate">{topActivities[0].title}</p>
          </div>
        </motion.div>
      )}
    </div>
  );
});
