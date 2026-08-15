import React, { useState, useEffect, useCallback } from "react";
import { Search, X, Plus, Gamepad2, Sparkles, Loader2, Image as ImageIcon, Calendar, Building2 } from "lucide-react";
import { searchTheGamesDbGames, type TheGamesDbGameMatch } from "../../services/theGamesDb";
import { useSoundEffects } from "../../hooks/useSoundEffects";
import type { RetroGame } from "../../types/domain";

export interface RetroAddGameModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddGame: (game: RetroGame) => void;
  accentColor?: string;
}

const CONSOLES = [
  { id: "PS2", name: "PlayStation 2", alias: "Sony PlayStation 2" },
  { id: "PS1", name: "PlayStation 1", alias: "Sony PlayStation" },
  { id: "SNES", name: "Super Nintendo", alias: "Super Nintendo (SNES)" },
  { id: "N64", name: "Nintendo 64", alias: "Nintendo 64" },
  { id: "GBA", name: "Game Boy Advance", alias: "Nintendo Game Boy Advance" },
  { id: "GENESIS", name: "Mega Drive / Genesis", alias: "Sega Genesis" },
];

export const RetroAddGameModal: React.FC<RetroAddGameModalProps> = ({
  isOpen,
  onClose,
  onAddGame,
  accentColor = "#10b981",
}) => {
  const { playSound } = useSoundEffects();
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [selectedConsole, setSelectedConsole] = useState<string>("PS2");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [results, setResults] = useState<TheGamesDbGameMatch[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSearch = useCallback(async () => {
    if (!searchTerm.trim()) return;
    playSound("search");
    setIsLoading(true);
    setErrorMsg(null);

    try {
      const matches = await searchTheGamesDbGames(searchTerm.trim());
      // Filter or prioritize selected console if available
      const filtered = matches.filter((m) => {
        if (!selectedConsole) return true;
        const p = m.platform.toLowerCase();
        const c = selectedConsole.toLowerCase();
        if (c === "ps2") return p.includes("playstation 2") || p.includes("ps2");
        if (c === "ps1") return p.includes("playstation") && !p.includes("2") && !p.includes("3") && !p.includes("4");
        if (c === "snes") return p.includes("super nintendo") || p.includes("snes");
        if (c === "n64") return p.includes("nintendo 64") || p.includes("n64");
        if (c === "gba") return p.includes("advance") || p.includes("gba");
        return true;
      });

      setResults(filtered.length > 0 ? filtered : matches);
    } catch (err: any) {
      console.warn("Falha na busca TheGamesDB:", err);
      setErrorMsg("Não foi possível conectar à base TheGamesDB no momento. Tente novamente.");
    } finally {
      setIsLoading(false);
    }
  }, [searchTerm, selectedConsole, playSound]);

  // Handle enter key in input
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  const handleSelectGame = (match: TheGamesDbGameMatch) => {
    playSound("select");
    const newGame: RetroGame = {
      id: `retro_${match.id}_${Date.now()}`,
      title: match.title,
      console: selectedConsole,
      year: match.year || (match.releaseDate ? parseInt(match.releaseDate.substring(0, 4)) : 2004),
      publisher: match.publisher,
      description: match.description,
      coverImage: match.frontImage || match.images?.[0],
      backImage: match.backImage,
      wrapImage: match.frontImage,
      artworkImages: match.images || [],
      theGamesDbId: match.id,
    };
    onAddGame(newGame);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl bg-[#060a10] border-2 border-emerald-500/40 rounded-3xl p-6 shadow-[0_0_60px_rgba(16,185,129,0.25)] flex flex-col max-h-[88vh] overflow-hidden font-mono">
        {/* Header Terminal HUD */}
        <div className="flex items-center justify-between pb-4 border-b border-emerald-500/30">
          <div className="flex items-center gap-2.5">
            <Gamepad2 className="w-5 h-5 text-emerald-400 animate-pulse" />
            <div>
              <h2 className="text-sm font-bold text-emerald-300 uppercase tracking-wider">
                &gt; DATABASE_SEARCH // THEGAMESDB.API
              </h2>
              <span className="text-[10px] text-gray-500 tracking-widest">
                BUSCADOR DE CAPAS E METADADOS RETRÔ
              </span>
            </div>
          </div>
          <button
            onClick={() => {
              playSound("modalClose");
              onClose();
            }}
            className="p-1.5 rounded-xl hover:bg-emerald-500/10 text-gray-400 hover:text-emerald-300 transition-colors border border-transparent hover:border-emerald-500/30"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search & Platform Filter Bar */}
        <div className="flex flex-col sm:flex-row gap-3 my-4">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Digite o nome do jogo (ex: Silent Hill, God of War, GTA)..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-black/60 border border-emerald-500/30 focus:border-emerald-400 text-sm text-emerald-200 placeholder:text-gray-600 focus:outline-none focus:ring-1 focus:ring-emerald-400"
              autoFocus
            />
          </div>

          <div className="flex items-center gap-2">
            <select
              value={selectedConsole}
              onChange={(e) => setSelectedConsole(e.target.value)}
              className="bg-black/60 border border-emerald-500/30 text-emerald-300 text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:border-emerald-400"
            >
              {CONSOLES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>

            <button
              onClick={handleSearch}
              disabled={isLoading || !searchTerm.trim()}
              className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs flex items-center gap-2 disabled:opacity-50 transition-all active:scale-95 shadow-[0_0_15px_rgba(16,185,129,0.4)]"
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              <span>BUSCAR</span>
            </button>
          </div>
        </div>

        {/* Results List View */}
        <div className="flex-1 overflow-y-auto pr-1 space-y-3 min-h-[260px] custom-scrollbar">
          {isLoading && (
            <div className="flex flex-col items-center justify-center h-48 gap-3 text-emerald-400">
              <Loader2 className="w-8 h-8 animate-spin" />
              <span className="text-xs">CONSULTANDO THEGAMESDB ONLINE...</span>
            </div>
          )}

          {errorMsg && (
            <div className="p-4 rounded-xl bg-red-950/40 border border-red-500/30 text-red-300 text-xs text-center">
              {errorMsg}
            </div>
          )}

          {!isLoading && results.length === 0 && !errorMsg && (
            <div className="flex flex-col items-center justify-center h-48 gap-2 text-gray-500 text-xs text-center">
              <Gamepad2 className="w-10 h-10 opacity-30 text-emerald-400" />
              <span>Digite o título acima e clique em Buscar para encontrar capas 3D e informações.</span>
            </div>
          )}

          {!isLoading &&
            results.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between gap-4 p-3.5 rounded-2xl bg-black/40 border border-emerald-500/20 hover:border-emerald-400/60 hover:bg-emerald-950/20 transition-all group"
              >
                <div className="flex items-center gap-3.5 overflow-hidden">
                  <div className="w-12 h-16 rounded-lg bg-black border border-emerald-500/30 overflow-hidden flex-shrink-0 flex items-center justify-center">
                    {item.frontImage ? (
                      <img
                        src={item.frontImage}
                        alt={item.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <ImageIcon className="w-5 h-5 text-gray-600" />
                    )}
                  </div>

                  <div className="min-w-0">
                    <h4 className="text-sm font-bold text-white group-hover:text-emerald-300 truncate transition-colors">
                      {item.title}
                    </h4>
                    <div className="flex flex-wrap items-center gap-2 mt-1 text-[11px] text-gray-400">
                      <span className="px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 font-semibold">
                        {item.platform}
                      </span>
                      {item.year && (
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-emerald-400" />
                          {item.year}
                        </span>
                      )}
                      {item.publisher && (
                        <span className="flex items-center gap-1 truncate max-w-[150px]">
                          <Building2 className="w-3 h-3 text-emerald-400" />
                          {item.publisher}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => handleSelectGame(item)}
                  className="px-4 py-2 rounded-xl bg-emerald-500/15 hover:bg-emerald-500 border border-emerald-500/40 text-emerald-300 hover:text-black text-xs font-bold transition-all flex items-center gap-1.5 flex-shrink-0 active:scale-95 shadow-[0_0_12px_rgba(16,185,129,0.25)]"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Adicionar</span>
                </button>
              </div>
            ))}
        </div>

        {/* Footer info */}
        <div className="mt-4 pt-3 border-t border-emerald-500/20 flex items-center justify-between text-[10px] text-gray-500">
          <span>THEGAMESDB INTEGRATION ACTIVE • APERTURE GRILLE CERTIFIED</span>
          <span>ESTANTE 3D CAPA DINÂMICA (MAP: ART.001)</span>
        </div>
      </div>
    </div>
  );
};

export default RetroAddGameModal;
