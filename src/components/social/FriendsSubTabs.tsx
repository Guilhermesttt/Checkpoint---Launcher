import { Users, MessageSquare, UserPlus, Radio } from "lucide-react";
import type { SoundEffectType } from "../../hooks/useSoundEffects";

export type SocialSubTab = "AMIGOS" | "CHAT" | "SALAS" | "SOLICITAÇÕES";

interface FriendsSubTabsProps {
  activeTab: SocialSubTab;
  onTabChange: (tab: SocialSubTab) => void;
  incomingRequestsCount: number;
  totalFriendsCount: number;
  unreadCount?: number;
  activeRoomsCount?: number;
  playSound?: (type: SoundEffectType) => void;
}

export const FriendsSubTabs: React.FC<FriendsSubTabsProps> = ({
  activeTab,
  onTabChange,
  incomingRequestsCount,
  totalFriendsCount,
  unreadCount = 0,
  activeRoomsCount = 0,
  playSound,
}) => {
  const tabs: { id: SocialSubTab; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: "AMIGOS", label: "Amigos", icon: <Users className="h-3.5 w-3.5" /> },
    { id: "CHAT", label: "Chat & Conversas", icon: <MessageSquare className="h-3.5 w-3.5" />, badge: unreadCount },
    { id: "SALAS", label: "Canais de Voz", icon: <Radio className="h-3.5 w-3.5" />, badge: activeRoomsCount },
    { id: "SOLICITAÇÕES", label: "Solicitações", icon: <UserPlus className="h-3.5 w-3.5" />, badge: incomingRequestsCount },
  ];

  return (
    <div className="mb-5 flex items-center gap-1.5 rounded-xl border border-white/10 bg-[#080808] p-1.5 shadow-md">
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
