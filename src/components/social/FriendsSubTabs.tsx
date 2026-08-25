import React from "react";
import { Users, MessageSquare, UserPlus, Radio } from "lucide-react";
import type { SoundEffectType } from "../../hooks/useSoundEffects";

export type SocialSubTab = "AMIGOS" | "CHAT" | "SALAS" | "SOLICITAÇÕES";

interface FriendsSubTabsProps {
  activeTab: SocialSubTab;
  onTabChange: (tab: SocialSubTab) => void;
  incomingRequestsCount: number;
  totalFriendsCount: number;
  onlineCount?: number;
  unreadCount?: number;
  activeRoomsCount?: number;
  playSound?: (type: SoundEffectType) => void;
}

export const FriendsSubTabs: React.FC<FriendsSubTabsProps> = ({
  activeTab,
  onTabChange,
  incomingRequestsCount,
  totalFriendsCount: _totalFriendsCount,
  onlineCount = 0,
  unreadCount = 0,
  activeRoomsCount = 0,
  playSound,
}) => {
  const tabs: { id: SocialSubTab; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: "AMIGOS", label: "Amigos", icon: <Users className="h-4 w-4" /> },
    { id: "CHAT", label: "Chats", icon: <MessageSquare className="h-4 w-4" />, badge: unreadCount },
    { id: "SALAS", label: "Canais de Voz", icon: <Radio className="h-4 w-4" />, badge: activeRoomsCount },
    { id: "SOLICITAÇÕES", label: "Solicitações", icon: <UserPlus className="h-4 w-4" />, badge: incomingRequestsCount },
  ];

  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/[0.08] bg-[#090A0D]/90 backdrop-blur-xl p-1.5 shadow-lg">
      <div className="flex items-center gap-1.5 flex-wrap">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onMouseEnter={() => playSound?.("hover")}
              onClick={() => {
                playSound?.("select");
                onTabChange(tab.id);
              }}
              className={`flex cursor-pointer items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold uppercase tracking-wider transition-all duration-200 ${
                isActive
                  ? "bg-white text-black shadow-[0_0_15px_rgba(255,255,255,0.2)]"
                  : "text-white/60 hover:bg-white/[0.06] hover:text-white"
              }`}
            >
              {tab.icon}
              <span className="font-body">{tab.label}</span>
              {typeof tab.badge === "number" && tab.badge > 0 && (
                <span
                  className={`ml-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9.5px] font-bold ${
                    isActive ? "bg-black text-white" : "bg-white text-black"
                  }`}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Online indicator on the right of tabs */}
      <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-white/[0.04] border border-white/[0.06] text-xs font-semibold text-white/70 font-body">
        <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)] animate-pulse" />
        <span>ONLINE</span>
        <span className="text-white font-bold">{onlineCount}</span>
      </div>
    </div>
  );
};

export default FriendsSubTabs;
