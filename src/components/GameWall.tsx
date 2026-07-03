import React, { useState, useMemo, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Grid3X3,
  Layout,
  Layers,
  Search,
  Eye,
  EyeOff,
  X,
  Play,
  Star,
  Clock,
  Trophy,
} from 'lucide-react';
import type { Game } from '../types/domain';
import type { SoundEffectType } from '../hooks/useSoundEffects';

type ViewMode = 'wall' | 'grid' | 'shelf';
type SortMode = 'alphabetical' | 'recent' | 'playtime' | 'random' | 'category';

interface GameWallProps {
  games: Game[];
  onGameSelect: (game: Game) => void;
  onGameHover?: (game: Game | null) => void;
  selectedGame?: Game | null;
  className?: string;
  playSound?: (type: SoundEffectType) => void;
}

/* ─── Card individual estilo "poster" ────────────────────────── */
const PosterCard: React.FC<{
  game: Game;
  index: number;
  viewMode: ViewMode;
  isSelected: boolean;
  onClick: () => void;
  onHover: () => void;
  onLeave: () => void;
  playSound?: (t: SoundEffectType) => void;
}> = ({ game, index, viewMode, isSelected, onClick, onHover, onLeave, playSound }) => {
  const src = game.cardImage || game.image || '';
  const isWall = viewMode === 'wall';

  // Dimensões por modo
  const dims = {
    wall:  'w-[170px] h-[240px]',
    grid:  'w-[156px] h-[220px]',
    shelf: 'w-[140px] h-[200px]',
  }[viewMode];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20, scale: 0.92 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.88 }}
      transition={{
        duration: 0.4,
        ease: [0.16, 1, 0.3, 1],
        delay: Math.min(index * 0.012, 0.3),
      }}
      whileHover={{ scale: 1.06, zIndex: 30, transition: { duration: 0.18 } }}
      onClick={() => { playSound?.('select'); onClick(); }}
      onMouseEnter={() => { playSound?.('hover'); onHover(); }}
      onMouseLeave={onLeave}
      className="relative cursor-pointer group flex-shrink-0"
      style={{ transformStyle: 'preserve-3d' }}
    >
      <div
        className={`relative ${dims} rounded-xl overflow-hidden`}
        style={{
          boxShadow: isSelected
            ? '0 0 0 2px rgba(255,255,255,0.7), 0 20px 50px rgba(0,0,0,0.7)'
            : '0 8px 28px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.06)',
          transition: 'box-shadow 0.25s ease',
        }}
      >
        {/* Imagem do jogo */}
        {src ? (
          <img
            src={src}
            alt={game.title}
            loading="lazy"
            draggable={false}
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.08]"
            style={{ filter: 'brightness(0.85)' }}
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-white/5 flex items-center justify-center">
            <span className="text-white/20 text-[10px] uppercase tracking-widest">Sem capa</span>
          </div>
        )}

        {/* Overlay gradiente base */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />

        {/* Hover overlay com brilho */}
        <motion.div
          className="absolute inset-0 bg-gradient-to-t from-blue-900/30 via-transparent to-white/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        />

        {/* Badge favorito */}
        {game.isFavorite && (
          <div className="absolute top-2 right-2 z-10">
            <div className="w-6 h-6 bg-amber-400/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-lg">
              <Star className="w-3 h-3 fill-current text-amber-900" />
            </div>
          </div>
        )}

        {/* Info launcher badge */}
        <div className="absolute top-2 left-2 z-10">
          <span
            className="px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wide"
            style={{
              background: game.launcherType === 'steam'
                ? 'rgba(103,182,118,0.25)'
                : game.launcherType === 'epic'
                  ? 'rgba(99,102,241,0.25)'
                  : 'rgba(255,255,255,0.12)',
              color: game.launcherType === 'steam'
                ? '#67b676'
                : game.launcherType === 'epic'
                  ? '#818cf8'
                  : 'rgba(255,255,255,0.6)',
              backdropFilter: 'blur(4px)',
              border: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            {game.launcherType === 'steam' ? 'Steam' : game.launcherType === 'epic' ? 'Epic' : 'Local'}
          </span>
        </div>

        {/* Achievements badge */}
        {(game.totalAchievements ?? 0) > 0 && (
          <div className="absolute top-8 left-2 z-10 mt-1">
            <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-black/40 backdrop-blur-sm border border-white/10 text-white/60">
              <Trophy className="w-2.5 h-2.5" />
              {game.completedAchievements ?? 0}/{game.totalAchievements}
            </span>
          </div>
        )}

        {/* Info inferior */}
        <div className="absolute bottom-0 left-0 right-0 p-3 z-10">
          <p className="text-white font-bold text-[11px] leading-tight truncate mb-0.5">
            {game.title}
          </p>
          {(game.hoursPlayed ?? 0) > 0 && (
            <p className="flex items-center gap-1 text-white/45 text-[9px]">
              <Clock className="w-2.5 h-2.5" />
              {game.hoursPlayed}h
            </p>
          )}
        </div>

        {/* Botão play no hover */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-20">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center"
            style={{ background: 'rgba(255,255,255,0.18)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.3)' }}
          >
            <Play className="w-4 h-4 text-white fill-white ml-0.5" />
          </div>
        </div>

        {/* Ring de seleção */}
        {isSelected && (
          <div className="absolute inset-0 rounded-xl ring-2 ring-white/70 pointer-events-none z-30" />
        )}
      </div>
    </motion.div>
  );
};

/* ─── Painel de detalhes ao hover — aparece na lateral direita ─ */
const DetailSidebar: React.FC<{ game: Game; onPlay: () => void; playSound?: (t: SoundEffectType) => void }> = ({
  game, onPlay, playSound,
}) => (
  <motion.div
    key={game.id}
    initial={{ opacity: 0, x: 24 }}
    animate={{ opacity: 1, x: 0 }}
    exit={{ opacity: 0, x: 24 }}
    transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
    className="absolute right-4 top-1/2 -translate-y-1/2 w-64 z-50 pointer-events-none"
    style={{ filter: 'drop-shadow(0 24px 48px rgba(0,0,0,0.7))' }}
  >
    <div
      className="rounded-2xl overflow-hidden border border-white/15"
      style={{ background: 'rgba(8,8,14,0.95)', backdropFilter: 'blur(28px)' }}
    >
      {/* Capa grande */}
      {(game.backgroundImage || game.image) && (
        <div className="relative h-36 overflow-hidden">
          <img
            src={game.backgroundImage || game.image}
            alt={game.title}
            className="w-full h-full object-cover"
            style={{ filter: 'brightness(0.7)' }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[rgba(8,8,14,0.95)] to-transparent" />
        </div>
      )}

      <div className="p-4">
        <h3 className="text-white font-black text-sm leading-tight mb-0.5">{game.title}</h3>
        <p className="text-white/45 text-[10px] uppercase tracking-wide mb-3">
          {game.category || (game.launcherType === 'steam' ? 'Steam' : game.launcherType === 'epic' ? 'Epic Games' : 'Local')}
        </p>

        {/* Stats */}
        <div className="flex items-center gap-3 mb-3">
          {(game.hoursPlayed ?? 0) > 0 && (
            <div className="flex items-center gap-1 text-white/50 text-[10px]">
              <Clock className="w-3 h-3" />
              <span>{game.hoursPlayed}h jogadas</span>
            </div>
          )}
          {(game.totalAchievements ?? 0) > 0 && (
            <div className="flex items-center gap-1 text-white/50 text-[10px]">
              <Trophy className="w-3 h-3" />
              <span>{game.completedAchievements}/{game.totalAchievements}</span>
            </div>
          )}
        </div>

        {game.description && (
          <p className="text-white/55 text-[10px] leading-relaxed line-clamp-3 mb-3">
            {game.description}
          </p>
        )}

        <button
          className="pointer-events-auto w-full py-2 rounded-xl text-white text-[11px] font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all duration-200 hover:brightness-110"
          style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.2)' }}
          onClick={() => { playSound?.('select'); onPlay(); }}
        >
          <Play className="w-3.5 h-3.5 fill-white" />
          Jogar agora
        </button>
      </div>
    </div>
  </motion.div>
);

/* ─── Componente principal ─────────────────────────────────── */
const GameWall: React.FC<GameWallProps> = ({
  games,
  onGameSelect,
  onGameHover,
  selectedGame,
  className = '',
  playSound,
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>('wall');
  const [sortMode, setSortMode] = useState<SortMode>('alphabetical');
  const [hoveredGame, setHoveredGame] = useState<Game | null>(null);
  const [searchFilter, setSearchFilter] = useState('');
  const [showControls, setShowControls] = useState(true);
  const searchRef = useRef<HTMLInputElement>(null);

  /* lista filtrada e ordenada */
  const filteredGames = useMemo(() => {
    const q = searchFilter.trim().toLowerCase();
    let list = q ? games.filter((g) => g.title.toLowerCase().includes(q)) : [...games];
    switch (sortMode) {
      case 'alphabetical': list.sort((a, b) => a.title.localeCompare(b.title)); break;
      case 'recent':
        list.sort((a, b) => new Date(b.lastPlayedAt || 0).getTime() - new Date(a.lastPlayedAt || 0).getTime()); break;
      case 'playtime': list.sort((a, b) => (b.hoursPlayed || 0) - (a.hoursPlayed || 0)); break;
      case 'random': list.sort(() => Math.random() - 0.5); break;
      case 'category': list.sort((a, b) => (a.category || '').localeCompare(b.category || '')); break;
    }
    return list;
  }, [games, searchFilter, sortMode]);

  const handleHover = useCallback((game: Game | null) => {
    setHoveredGame(game);
    onGameHover?.(game);
  }, [onGameHover]);

  /* gap e minmax por modo */
  const gridConfig: Record<ViewMode, { cols: string; gap: string }> = {
    wall:  { cols: 'repeat(auto-fill, minmax(170px, 1fr))', gap: '14px 12px' },
    grid:  { cols: 'repeat(auto-fill, minmax(156px, 1fr))', gap: '12px 10px' },
    shelf: { cols: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '10px 8px' },
  };

  const { cols, gap } = gridConfig[viewMode];

  return (
    <div className={`relative flex flex-col w-full h-full ${className}`} style={{ overflow: 'hidden' }}>

      {/* ── Barra de controles ── */}
      <AnimatePresence>
        {showControls && (
          <motion.div
            initial={{ opacity: 0, y: -14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -14 }}
            transition={{ duration: 0.2 }}
            className="shrink-0 flex items-center justify-between gap-3 px-5 pt-3 pb-2 z-40"
          >
            <div className="flex items-center gap-2">
              {/* Modos de visualização */}
              <div
                className="flex items-center gap-0.5 p-1 rounded-xl border border-white/10"
                style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(12px)' }}
              >
                {([
                  { mode: 'wall'  as ViewMode, icon: Layers,   label: '3D Wall' },
                  { mode: 'grid'  as ViewMode, icon: Grid3X3,  label: 'Grade' },
                  { mode: 'shelf' as ViewMode, icon: Layout,   label: 'Estante' },
                ] as const).map(({ mode, icon: Icon, label }) => (
                  <button
                    key={mode}
                    onClick={() => { setViewMode(mode); playSound?.('navigate'); }}
                    title={label}
                    className={`p-2 rounded-lg transition-all ${
                      viewMode === mode ? 'bg-white/20 text-white' : 'text-white/45 hover:text-white hover:bg-white/8'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                  </button>
                ))}
              </div>

              {/* Busca */}
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/35 pointer-events-none" />
                <input
                  ref={searchRef}
                  type="text"
                  placeholder="Buscar jogos..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  className="h-9 pl-8 pr-7 text-sm text-white placeholder:text-white/30 rounded-xl border border-white/10 focus:outline-none focus:border-white/25 w-48"
                  style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(12px)' }}
                />
                {searchFilter && (
                  <button
                    onClick={() => { setSearchFilter(''); searchRef.current?.focus(); }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-white/35 hover:text-white transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Ordenação */}
              <select
                value={sortMode}
                onChange={(e) => { setSortMode(e.target.value as SortMode); playSound?.('navigate'); }}
                className="h-9 px-3 text-white text-sm rounded-xl border border-white/10 focus:outline-none"
                style={{
                  background: 'rgba(0,0,0,0.5)',
                  backdropFilter: 'blur(12px)',
                  appearance: 'none',
                  paddingRight: '28px',
                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='rgba(255,255,255,0.4)' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'right 10px center',
                }}
              >
                <option value="alphabetical">A–Z</option>
                <option value="recent">Recentes</option>
                <option value="playtime">Tempo jogado</option>
                <option value="category">Categoria</option>
                <option value="random">Aleatório</option>
              </select>

              <button
                onClick={() => setShowControls(false)}
                className="h-9 w-9 flex items-center justify-center rounded-xl border border-white/10 text-white/40 hover:text-white transition-colors"
                style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(12px)' }}
                title="Ocultar controles"
              >
                <EyeOff className="w-3.5 h-3.5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Botão reabrir controles */}
      {!showControls && (
        <button
          onClick={() => setShowControls(true)}
          className="absolute top-3 right-3 z-50 h-9 w-9 flex items-center justify-center rounded-full border border-white/15 text-white hover:bg-white/10 transition-colors"
          style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(12px)' }}
          title="Mostrar controles"
        >
          <Eye className="w-3.5 h-3.5" />
        </button>
      )}

      {/* ── Grid de cards ── */}
      <div
        className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-5 py-3 pr-72"
        style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.1) transparent' }}
      >
        {filteredGames.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.06)' }}>
              <Search className="w-7 h-7 text-white/25" />
            </div>
            <div>
              <p className="text-white/45 font-semibold text-sm">
                {searchFilter ? 'Nenhum jogo encontrado' : 'Nenhum jogo disponível'}
              </p>
              <p className="text-white/25 text-xs mt-1">
                {searchFilter ? `Sem resultados para "${searchFilter}"` : 'Adicione jogos para começar'}
              </p>
            </div>
          </div>
        ) : (
          <motion.div
            layout
            style={{ display: 'grid', gridTemplateColumns: cols, gap }}
          >
            <AnimatePresence mode="popLayout">
              {filteredGames.map((game, index) => (
                <PosterCard
                  key={game.id}
                  game={game}
                  index={index}
                  viewMode={viewMode}
                  isSelected={selectedGame?.id === game.id}
                  onClick={() => onGameSelect(game)}
                  onHover={() => handleHover(game)}
                  onLeave={() => handleHover(null)}
                  playSound={playSound}
                />
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </div>

      {/* ── Painel lateral de detalhe ── */}
      <AnimatePresence>
        {hoveredGame && (
          <DetailSidebar
            game={hoveredGame}
            onPlay={() => onGameSelect(hoveredGame)}
            playSound={playSound}
          />
        )}
      </AnimatePresence>

      {/* ── Stats bar ── */}
      <div className="shrink-0 px-5 py-2 flex items-center gap-3">
        <div
          className="inline-flex items-center gap-2.5 px-3 py-1.5 rounded-xl border border-white/8 text-[10px] text-white/40"
          style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(12px)' }}
        >
          <span className="font-bold">{filteredGames.length}</span>
          <span>jogo{filteredGames.length !== 1 ? 's' : ''}</span>
          <span className="w-px h-3 bg-white/15" />
          <span>{viewMode === 'wall' ? '3D Wall' : viewMode === 'grid' ? 'Grade' : 'Estante'}</span>
          {searchFilter && (
            <>
              <span className="w-px h-3 bg-white/15" />
              <span className="text-white/60">"{searchFilter}"</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default GameWall;
