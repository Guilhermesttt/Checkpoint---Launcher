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
}: HomeOverviewPanelsProps) {
  const topFriends = friendsPlaying.slice(0, 2);
  const topActivities = recentActivity.slice(0, 2);

  return (
    <div className="absolute top-8 right-10 flex flex-col gap-4 z-50 pointer-events-none">
      {topFriends.length > 0 && (
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="pointer-events-auto rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md p-3 w-64 shadow-2xl flex items-center gap-3"
        >
          <Users2 className="h-4 w-4 text-white/50 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-white/40">Amigos online</p>
            <p className="text-xs font-semibold text-white/80 truncate">{topFriends[0].name} e mais</p>
          </div>
        </motion.div>
      )}

      {topActivities.length > 0 && (
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="pointer-events-auto rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md p-3 w-64 shadow-2xl flex items-center gap-3"
        >
          <Flame className="h-4 w-4 text-white/50 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-white/40">Pulso</p>
            <p className="text-xs font-semibold text-white/80 truncate">{topActivities[0].title}</p>
          </div>
        </motion.div>
      )}
    </div>
  );
});
