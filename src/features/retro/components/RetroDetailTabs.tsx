import type { RetroGame } from "../shelf/retroCollection";
import { RetroAchievementsPanel } from "./RetroAchievementsPanel";

export type RetroDetailTab = "play" | "about" | "achievements";

interface RetroDetailTabsProps {
  game: RetroGame;
  activeTab: RetroDetailTab;
  onTabChange: (tab: RetroDetailTab) => void;
  accountLinked: boolean;
  onEditGame: (game: RetroGame) => void;
  onOpenSettingsConnections?: () => void;
}

const TABS: Array<{ id: RetroDetailTab; label: string }> = [
  { id: "play", label: "JOGAR" },
  { id: "about", label: "SOBRE" },
  { id: "achievements", label: "CONQUISTAS" },
];

export function RetroDetailTabs({ game, activeTab, onTabChange, accountLinked, onEditGame, onOpenSettingsConnections }: RetroDetailTabsProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div
        role="tablist"
        aria-label={`Informações de ${game.title}`}
        aria-orientation="vertical"
        className="flex flex-col items-start gap-1 border-b border-white/10 px-8 py-7"
      >
        {TABS.map((tab) => (
          <button
            key={tab.id}
            id={`retro-tab-${tab.id}`}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            aria-controls={`retro-panel-${tab.id}`}
            tabIndex={activeTab === tab.id ? 0 : -1}
            onClick={() => onTabChange(tab.id)}
            className={`w-full border-l-2 py-2 pl-4 text-left text-[10px] font-bold tracking-[0.2em] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#fcf9f3] ${activeTab === tab.id ? "border-[#fcf9f3] text-[#fcf9f3]" : "border-transparent text-[#969087] hover:text-[#fcf9f3]"}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div id={`retro-panel-${activeTab}`} role="tabpanel" aria-labelledby={`retro-tab-${activeTab}`} tabIndex={0} className="min-h-0 flex-1 overflow-y-auto px-8 py-7 text-[#bcb6ab] focus-visible:outline focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-[#b52322]">
        {activeTab === "play" && (
          <div className="space-y-5">
            <p className="font-['Unbounded'] text-[11px] uppercase tracking-[0.18em] text-[#77736c]">{game.console} / {game.year}</p>
            <dl className="space-y-5">
              <div>
                <dt className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#77736c]">Plataforma</dt>
                <dd className="mt-1 text-sm font-bold text-[#eee9dd]">{game.console}</dd>
              </div>
              <div>
                <dt className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#77736c]">Publicadora</dt>
                <dd className="mt-1 text-sm font-bold text-[#eee9dd]">{game.publisher}</dd>
              </div>
            </dl>
          </div>
        )}

        {activeTab === "about" && (
          <div className="space-y-5">
            <p className="font-['Unbounded'] text-xs uppercase tracking-[0.16em] text-[#eee9dd]">{game.subtitle}</p>
            <p className="max-w-xl text-sm leading-7">{game.description || `${game.title} chegou ao ${game.console} em ${game.year}, publicado por ${game.publisher}.`}</p>
          </div>
        )}

        {activeTab === "achievements" && (
          <RetroAchievementsPanel
            game={game}
            accountLinked={accountLinked}
            onEditGame={onEditGame}
            onOpenSettingsConnections={onOpenSettingsConnections}
          />
        )}
      </div>
    </div>
  );
}
