import React from "react";
import { Users, MessageSquare, UserPlus } from "lucide-react";

export type SocialSubTab = "AMIGOS" | "CHAT" | "SOLICITAÇÕES";

interface FriendsSubTabsProps {
  activeTab: SocialSubTab;
  onTabChange: (tab: SocialSubTab) => void;
  incomingRequestsCount: number;
  totalFriendsCount: number;
  unreadCount?: number;
}

export const FriendsSubTabs: React.FC<FriendsSubTabsProps> = ({
  activeTab,
  onTabChange,
  incomingRequestsCount,
  totalFriendsCount,
  unreadCount = 0,
}) => {
  const tabs: { id: SocialSubTab; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: "AMIGOS", label: "Amigos", icon: <Users className="h-3.5 w-3.5" /> },
    { id: "CHAT", label: "Chat & Conversas", icon: <MessageSquare className="h-3.5 w-3.5" />, badge: unreadCount },
    { id: "SOLICITAÇÕES", label: "Solicitações", icon: <UserPlus className="h-3.5 w-3.5" />, badge: incomingRequestsCount },
  ];

  return (
    <div className="mb-6 flex items-center gap-1.5 rounded-2xl border border-white/10 bg-black/40 p-1.5 backdrop-blur-2xl">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onTabChange(tab.id)}
            className={`flex cursor-pointer items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-black uppercase tracking-wider transition-all ${
              isActive
                ? "bg-white text-black shadow-lg"
                : "text-white/60 hover:bg-white/5 hover:text-white"
            }`}
          >
            {tab.icon}
            <span>{tab.label}</span>
            {typeof tab.badge === "number" && tab.badge > 0 && (
              <span
                className={`ml-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-black ${
                  isActive ? "bg-black text-white" : "bg-red-500 text-white"
                }`}
              >
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};
