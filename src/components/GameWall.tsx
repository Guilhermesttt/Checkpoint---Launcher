import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Grid3X3,
  Layout,
  Layers,
  MousePointer2,
  Search,
  Eye,
  EyeOff,
  X,
} from 'lucide-react';
import type { Game } from '../types/domain';

type ViewMode = 'wall' | 'shelf' | 'grid' | 'carousel';
type SortMode = 'alphabetical' | 'recent' | 'playtime' | 'random' | 'category';

interface GameWallProps {
  games: Game[];
  onGameSelect: (game: Game) => void;
  onGameHover?: (game: Game | null) => void;
  selectedGame?: Game | null;
  className?: string;
}

/* ─── Single card ─────────────────────────────────────────── */
const GameCard: React.FC<{
  game: Game;
  isSelected: boolean;
  isHovered: boolean;
  index: number;
  viewMode: ViewMode;
  onClick: () => void;
  onHover: () => void;
  onLeave: () => void;
}> = ({ game, isSelected, isHovered, index, viewMode, onClick, onHover, onLeave }) => {
  const src = game.cardImage || game.image || '';

  // slight tilt only for wall mode
  const wallRotate =
    viewMode === 'wall'
      ? `rotateY(${Math.sin(index * 0.4) * 6}deg) rotateX(${Math.cos(index * 0.3) * 3}deg)`
      : 'none';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.85 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1], delay: index * 0.015 }}
      whileHover={{ scale: 1.07, zIndex: 50 }}
      onClick={onClick}
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
      className="relative cursor-pointer"
      style={{ transformStyle: 'preserve-3d', transform: isHovered ? 'none' : wallRotate }}
    >
      {/* ── card body ── */}
      <div
        className={`relative overflow-hidden rounded-2xl transition-all duration-300 ${
          viewMode === 'shelf' ? 'w-40 h-56' : 'w-44 h-60'
        } ${isSelected ? 'ring-4 ring-white/60' : ''} ${isHovered ? 'ring-2 ring-white/40' : ''}`}
        style={{
          boxShadow: isHovered
            ? '0 28px 56px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.15)'
            : '0 12px 32px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.06)',
        }}
      >
        {src ? (
          <img
            src={src}
            alt={game.title}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
            style={{ filter: 'brightness(0.88)' }}
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        ) : (
          <div className="w-full h-full bg-white/10 flex items-center justify-center">
            <span className="text-white/30 text-xs uppercase tracking-widest">Sem capa</span>
          </div>
        )}

        {/* gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />

        {/* bottom info */}
        <div className="absolute bottom-0 left-0 right-0 p-3">
          <p className="text-white font-bold text-xs truncate leading-tight mb-0.5">{game.title}</p>
          <p className="text-white/55 text-[10px] uppercase tracking-wide">
            {game.launcherType === 'steam' ? 'Steam' : game.launcherType === 'epic' ? 'Epic' : 'Local'}
          </p>
        </div>

        {/* hover shimmer */}
        <AnimatePresence>
          {isHovered && (
            <motion.div
              key="shimmer"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-gradient-to-t from-blue-600/20 to-purple-600/20"
            />
          )}
        </AnimatePresence>

        {/* favorite badge */}
        {game.isFavorite && (
          <div className="absolute top-2 right-2 w-5 h-5 bg-yellow-500 rounded-full flex items-center justify-center text-[10px]">
            ★
          </div>
        )}
      </div>
    </motion.div>
  );
};

/* ─── Hover info tooltip ──────────────────────────────────── */
const HoverCard: React.FC<{ game: Game; onPlay: () => void }> = ({ game, onPlay }) => (
  <motion.div
    initial={{ opacity: 0, y: 8, scale: 0.95 }}
    animate={{ opacity: 1, y: 0, scale: 1 }}
    exit={{ opacity: 0, y: 8, scale: 0.95 }}
    transition={{ duration: 0.15 }}
    className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[200] w-80 pointer-events-none"
    style={{ filter: 'drop-shadow(0 20px 40px rgba(0,0,0,0.6))' }}
  >
    <div
      className="rounded-2xl border border-white/20 p-5"
      style={{ background: 'rgba(12,12,18,0.96)', backdropFilter: 'blur(24px)' }}
    >
      <div className="flex items-center gap-3 mb-3">
        {(game.cardImage || game.image) && (
          <img
            src={game.cardImage || game.image}
            alt={game.title}
            className="w-12 h-16 rounded-xl object-cover flex-shrink-0"
          />
        )}
        <div className="min-w-0">
          <h3 className="text-white font-bold text-sm leading-tight truncate">{game.title}</h3>
          <p className="text-white/50 text-xs mt-0.5">{game.category || 'Jogo'}</p>
          <p className="text-white/40 text-[10px] uppercase tracking-wide mt-1">
            {game.launcherType === 'steam' ? 'Steam' : game.launcherType === 'epic' ? 'Epic Games' : 'Local'}
          </p>
        </div>
      </div>

      {game.description && (
        <p className="text-white/65 text-xs leading-relaxed line-clamp-2 mb-3">
          {game.description}
        </p>
      )}

      <button
        className="pointer-events-auto w-full py-2 rounded-xl bg-white/15 hover:bg-white/25 text-white text-xs font-bold uppercase tracking-wider transition-colors"
        onClick={onPlay}
      >
        Jogar
      </button>
    </div>
  </motion.div>
);

/* ─── Main component ──────────────────────────────────────── */
const GameWall: React.FC<GameWallProps> = ({
  games,
  onGameSelect,
  onGameHover,
  selectedGame,
  className = '',
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>('wall');
  const [sortMode, setSortMode] = useState<SortMode>('alphabetical');
  const [hoveredGame, setHoveredGame] = useState<Game | null>(null);
  const [searchFilter, setSearchFilter] = useState('');
  const [showControls, setShowControls] = useState(true);

  /* filtered + sorted list */
  const filteredGames = useMemo(() => {
    const q = searchFilter.trim().toLowerCase();
    let list = q ? games.filter((g) => g.title.toLowerCase().includes(q)) : [...games];

    switch (sortMode) {
      case 'alphabetical': list.sort((a, b) => a.title.localeCompare(b.title)); break;
      case 'recent':
        list.sort((a, b) =>
          new Date(b.lastPlayedAt || 0).getTime() - new Date(a.lastPlayedAt || 0).getTime()
        ); break;
      case 'playtime': list.sort((a, b) => (b.hoursPlayed || 0) - (a.hoursPlayed || 0)); break;
      case 'random': list.sort(() => Math.random() - 0.5); break;
      case 'category': list.sort((a, b) => (a.category || '').localeCompare(b.category || '')); break;
    }
    return list;
  }, [games, searchFilter, sortMode]);

  const handleHover = (game: Game | null) => {
    setHoveredGame(game);
    onGameHover?.(game);
  };

  /* grid columns per mode */
  const gridCols: Record<ViewMode, string> = {
    wall: 'repeat(auto-fill, minmax(176px, 1fr))',
    shelf: 'repeat(auto-fill, minmax(160px, 1fr))',
    grid: 'repeat(auto-fill, minmax(176px, 1fr))',
    carousel: 'repeat(auto-fill, minmax(176px, 1fr))',
  };

  return (
    <div className={`relative flex flex-col w-full h-full overflow-hidden ${className}`}>

      {/* ── Controls bar ── */}
      <AnimatePresence>
        {showControls && (
          <motion.div
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            className="shrink-0 flex items-center justify-between gap-3 px-6 pt-4 pb-2 z-40"
          >
            <div className="flex items-center gap-2">
              {/* view mode */}
              <div className="flex items-center gap-1 bg-black/50 backdrop-blur-md rounded-2xl p-1.5 border border-white/10">
                {([
                  { mode: 'wall', icon: Layers, label: '3D Wall' },
                  { mode: 'shelf', icon: Layout, label: 'Estante' },
                  { mode: 'grid', icon: Grid3X3, label: 'Grade' },
                  { mode: 'carousel', icon: MousePointer2, label: 'Carrossel' },
                ] as const).map(({ mode, icon: Icon, label }) => (
                  <button
                    key={mode}
                    onClick={() => setViewMode(mode)}
                    title={label}
                    className={`p-2 rounded-xl transition-all ${
                      viewMode === mode ? 'bg-white/20 text-white' : 'text-white/50 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </button>
                ))}
              </div>

              {/* search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Buscar jogos..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  className="h-10 pl-9 pr-8 bg-black/50 backdrop-blur-md border border-white/10 rounded-xl text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-white/30 w-52"
                />
                {searchFilter && (
                  <button
                    onClick={() => setSearchFilter('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-white/40 hover:text-white"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* sort */}
              <select
                value={sortMode}
                onChange={(e) => setSortMode(e.target.value as SortMode)}
                className="h-10 px-3 bg-black/50 backdrop-blur-md border border-white/10 rounded-xl text-white text-sm focus:outline-none appearance-none pr-8"
                style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'12\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'white\' stroke-width=\'2\'%3E%3Cpath d=\'M6 9l6 6 6-6\'/%3E%3C/svg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center' }}
              >
                <option value="alphabetical">A-Z</option>
                <option value="recent">Recentes</option>
                <option value="playtime">Tempo jogado</option>
                <option value="category">Categoria</option>
                <option value="random">Aleatório</option>
              </select>

              <button
                onClick={() => setShowControls(false)}
                className="h-10 w-10 flex items-center justify-center bg-black/50 backdrop-blur-md border border-white/10 rounded-xl text-white/50 hover:text-white transition-colors"
                title="Ocultar controles"
              >
                <EyeOff className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* show controls button */}
      {!showControls && (
        <button
          onClick={() => setShowControls(true)}
          className="absolute top-4 right-4 z-50 h-10 w-10 flex items-center justify-center bg-black/60 backdrop-blur-md border border-white/20 rounded-full text-white hover:bg-black/80 transition-colors"
          title="Mostrar controles"
        >
          <Eye className="w-4 h-4" />
        </button>
      )}

      {/* ── Cards grid ── */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden px-6 py-4" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.15) transparent' }}>
        {filteredGames.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
            <div className="w-20 h-20 bg-white/8 rounded-2xl flex items-center justify-center">
              <Search className="w-8 h-8 text-white/30" />
            </div>
            <div>
              <p className="text-white/50 font-semibold">
                {searchFilter ? 'Nenhum jogo encontrado' : 'Nenhum jogo disponível'}
              </p>
              <p className="text-white/30 text-sm mt-1">
                {searchFilter ? `Sem resultados para "${searchFilter}"` : 'Adicione jogos para começar'}
              </p>
            </div>
          </div>
        ) : (
          <motion.div
            layout
            className="grid justify-items-center"
            style={{
              gridTemplateColumns: gridCols[viewMode],
              gap: viewMode === 'shelf' ? '12px 20px' : '16px 24px',
            }}
          >
            <AnimatePresence mode="popLayout">
              {filteredGames.map((game, index) => (
                <GameCard
                  key={game.id}
                  game={game}
                  index={index}
                  viewMode={viewMode}
                  isSelected={selectedGame?.id === game.id}
                  isHovered={hoveredGame?.id === game.id}
                  onClick={() => onGameSelect(game)}
                  onHover={() => handleHover(game)}
                  onLeave={() => handleHover(null)}
                />
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </div>

      {/* ── Hover info card ── */}
      <AnimatePresence>
        {hoveredGame && (
          <HoverCard
            key={hoveredGame.id}
            game={hoveredGame}
            onPlay={() => onGameSelect(hoveredGame)}
          />
        )}
      </AnimatePresence>

      {/* ── Stats bar ── */}
      <div className="shrink-0 px-6 pb-4 pt-1">
        <div className="inline-flex items-center gap-3 bg-black/50 backdrop-blur-md border border-white/10 rounded-xl px-4 py-2 text-xs text-white/50">
          <span>{filteredGames.length} jogo{filteredGames.length !== 1 ? 's' : ''}</span>
          <span className="w-px h-3 bg-white/20" />
          <span>
            {viewMode === 'wall' ? '3D Wall' : viewMode === 'shelf' ? 'Estante' : viewMode === 'grid' ? 'Grade' : 'Carrossel'}
          </span>
          {searchFilter && (
            <>
              <span className="w-px h-3 bg-white/20" />
              <span>"{searchFilter}"</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default GameWall;
