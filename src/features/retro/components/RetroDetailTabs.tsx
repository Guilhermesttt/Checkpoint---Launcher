import { useState } from "react";
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
  onLaunch?: () => void;
  isLaunching?: boolean;
}

const TABS: Array<{
  id: RetroDetailTab;
  label: string;
}> = [
  { id: "play", label: "JOGAR" },
  { id: "about", label: "SOBRE" },
  { id: "achievements", label: "CONQUISTAS" },
];

export function RetroDetailTabs({
  game,
  activeTab,
  onTabChange,
  accountLinked,
  onEditGame,
  onOpenSettingsConnections,
  onLaunch,
  isLaunching,
}: RetroDetailTabsProps) {
  const [isFavorite, setIsFavorite] = useState(false);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Tablist vertical para navegação rápida */}
      <div
        role="tablist"
        aria-label={`Informações de ${game.title}`}
        aria-orientation="vertical"
        className="flex flex-col gap-2 border-b border-white/10 px-8 py-4"
      >
        <div className="flex items-center gap-2">
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
              className={`border-b-2 px-3 py-2 text-[10px] font-bold tracking-[0.18em] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#fcf9f3] ${
                activeTab === tab.id
                  ? "border-[#b52322] text-[#fcf9f3] bg-[#b52322]/15"
                  : "border-transparent text-[#88837a] hover:text-[#fcf9f3]"
              }`}
            >
              {tab.label}
            </button>
          ))}

          <button
            type="button"
            onClick={() => setIsFavorite((prev) => !prev)}
            className={`ml-auto flex items-center gap-1.5 px-3 py-2 text-[10px] font-bold tracking-[0.15em] transition-all ${
              isFavorite
                ? "text-[#fcf9f3] bg-[#b52322]/20 border border-[#b52322]"
                : "text-[#77736c] hover:text-[#fcf9f3]"
            }`}
          >
            <span>⭐</span>
            <span>{isFavorite ? "FAVORITO" : "FAVORITAR"}</span>
          </button>
        </div>
      </div>

      {/* Conteúdo da Aba */}
      <div
        id={`retro-panel-${activeTab}`}
        role="tabpanel"
        aria-labelledby={`retro-tab-${activeTab}`}
        tabIndex={0}
        className="min-h-0 flex-1 overflow-y-auto px-8 py-6 text-[#bcb6ab] scrollbar-thin focus-visible:outline focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-[#b52322]"
      >
        {activeTab === "play" && (
          <div className="space-y-6">
            {/* Grade de Metadados com Ícones */}
            <dl className="grid grid-cols-1 gap-y-3.5 text-xs">
              <div className="flex items-center gap-3">
                <span className="text-[#88837a]" aria-hidden="true">⚔️</span>
                <div>
                  <dt className="text-[9px] font-bold uppercase tracking-[0.18em] text-[#77736c]">GÊNERO</dt>
                  <dd className="text-xs font-bold text-[#eee9dd]">Ação / Aventura</dd>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-[#88837a]" aria-hidden="true">👤</span>
                <div>
                  <dt className="text-[9px] font-bold uppercase tracking-[0.18em] text-[#77736c]">JOGADORES</dt>
                  <dd className="text-xs font-bold text-[#eee9dd]">1</dd>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-[#88837a]" aria-hidden="true">🏭</span>
                <div>
                  <dt className="text-[9px] font-bold uppercase tracking-[0.18em] text-[#77736c]">DESENVOLVEDORA</dt>
                  <dd className="text-xs font-bold text-[#eee9dd]">Santa Monica Studio</dd>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-[#88837a]" aria-hidden="true">🏛️</span>
                <div>
                  <dt className="text-[9px] font-bold uppercase tracking-[0.18em] text-[#77736c]">PUBLICADORA</dt>
                  <dd className="text-xs font-bold text-[#eee9dd]">{game.publisher}</dd>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-[#88837a]" aria-hidden="true">💬</span>
                <div>
                  <dt className="text-[9px] font-bold uppercase tracking-[0.18em] text-[#77736c]">IDIOMA</dt>
                  <dd className="text-xs font-bold text-[#eee9dd]">Inglês</dd>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-[#88837a]" aria-hidden="true">🌐</span>
                <div>
                  <dt className="text-[9px] font-bold uppercase tracking-[0.18em] text-[#77736c]">REGIÃO</dt>
                  <dd className="text-xs font-bold text-[#eee9dd]">NTSC-U</dd>
                </div>
              </div>
            </dl>

            {/* Sinopse da História */}
            <div className="border-t border-white/10 pt-4">
              <h2 className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-[#b52322]">
                SINOPSE
              </h2>
              <p className="text-xs leading-5 text-[#9a9489]">
                {game.description ||
                  "Kratos, um antigo guerreiro espartano, embarca em uma jornada de vingança contra Ares, o deus da guerra. Em sua busca, ele enfrenta criaturas da mitologia grega e resolve quebra-cabeças épicos em sua missão para mudar seu destino."}
              </p>
            </div>
          </div>
        )}

        {activeTab === "about" && (
          <div className="space-y-5">
            <p className="font-['Unbounded'] text-xs uppercase tracking-[0.16em] text-[#eee9dd]">
              {game.subtitle}
            </p>
            <p className="max-w-xl text-sm leading-7">
              {game.description ||
                `${game.title} chegou ao ${game.console} em ${game.year}, publicado por ${game.publisher}.`}
            </p>
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
