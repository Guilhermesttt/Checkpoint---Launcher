import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Grid3X3, 
  Layout, 
  Layers, 
  MousePointer2, 
  Search,
  Filter,
  Shuffle,
  Eye,
  EyeOff
} from 'lucide-react';
import type { Game } from '../types/domain';
import { useGameColor } from '../hooks/useGameColor';

type ViewMode = 'wall' | 'shelf' | 'grid' | 'carousel';
type SortMode = 'alphabetical' | 'recent' | 'playtime' | 'random' | 'category';

interface GameWallProps {
  games: Game[];
  onGameSelect: (game: Game) => void;
  onGameHover?: (game: Game | null) => void;
  selectedGame?: Game | null;
  className?: string;
}

interface GameCard3DProps {
  game: Game;
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
  scale: number;
  isSelected: boolean;
  isHovered: boolean;
  onClick: () => void;
  onHover: () => void;
  onLeave: () => void;
}

const GameCard3D: React.FC<GameCard3DProps> = ({
  game,
  position,
  rotation,
  scale,
  isSelected,
  isHovered,
  onClick,
  onHover,
  onLeave
}) => {
  const cardImage = game.cardImage || game.image || '/placeholder-game.png';
  
  return (
    <motion.div
      className="absolute cursor-pointer group"
      style={{
        transform: `translate3d(${position.x}px, ${position.y}px, ${position.z}px) 
                   rotateX(${rotation.x}deg) rotateY(${rotation.y}deg) rotateZ(${rotation.z}deg) 
                   scale(${scale})`,
        transformStyle: 'preserve-3d',
        zIndex: isHovered ? 1000 : Math.floor(position.z + 100),
      }}
      initial={{ opacity: 0, scale: 0 }}
      animate={{ 
        opacity: 1, 
        scale: scale,
        rotateX: rotation.x,
        rotateY: rotation.y,
        rotateZ: rotation.z
      }}
      transition={{ 
        duration: 0.6, 
        ease: [0.16, 1, 0.3, 1],
        delay: Math.random() * 0.2
      }}
      whileHover={{ 
        scale: scale * 1.1, 
        z: position.z + 50,
        transition: { duration: 0.2 }
      }}
      onClick={onClick}
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
    >
      {/* Card Container */}
      <div 
        className={`relative w-48 h-64 rounded-2xl overflow-hidden transition-all duration-300 ${
          isSelected ? 'ring-4 ring-white/50' : ''
        } ${isHovered ? 'ring-2 ring-white/30' : ''}`}
        style={{
          background: 'linear-gradient(145deg, rgba(255,255,255,0.1), rgba(255,255,255,0.05))',
          backdropFilter: 'blur(10px)',
          boxShadow: isHovered 
            ? '0 25px 50px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.1)' 
            : '0 15px 35px rgba(0,0,0,0.2), 0 0 0 1px rgba(255,255,255,0.05)'
        }}
      >
        {/* Game Image */}
        <div className="relative w-full h-full overflow-hidden">
          <img
            src={cardImage}
            alt={game.title}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
            style={{
              filter: isSelected ? 'brightness(1.1) saturate(1.2)' : 'brightness(0.9)'
            }}
            onError={(e) => {
              (e.target as HTMLImageElement).src = '/placeholder-game.png';
            }}
          />
          
          {/* Overlay Gradient */}
          <div 
            className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent"
            style={{ opacity: isHovered ? 0.7 : 0.9 }}
          />
          
          {/* Game Info */}
          <div className="absolute bottom-0 left-0 right-0 p-4">
            <h3 className="text-white font-bold text-sm truncate mb-1">
              {game.title}
            </h3>
            <div className="flex items-center justify-between">
              <span className="text-xs text-white/70">
                {game.launcherType === 'steam' ? 'Steam' : 
                 game.launcherType === 'epic' ? 'Epic' : 'Local'}
              </span>
              {game.isFavorite && (
                <div className="w-4 h-4 bg-yellow-500 rounded-full flex items-center justify-center">
                  <span className="text-xs">⭐</span>
                </div>
              )}
            </div>
          </div>
          
          {/* Hover Effects */}
          <AnimatePresence>
            {isHovered && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-gradient-to-t from-blue-500/20 to-purple-500/20"
              />
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
};

const GameWall: React.FC<GameWallProps> = ({
  games,
  onGameSelect,
  onGameHover,
  selectedGame,
  className = ''
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>('wall');
  const [sortMode, setSortMode] = useState<SortMode>('alphabetical');
  const [hoveredGame, setHoveredGame] = useState<Game | null>(null);
  const [searchFilter, setSearchFilter] = useState('');
  const [showControls, setShowControls] = useState(true);
  const [rotationSpeed, setRotationSpeed] = useState(0.5);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const mousePosition = useRef({ x: 0, y: 0 });
  const autoRotation = useRef(0);

  // Filter and sort games
  const filteredGames = useMemo(() => {
    let filtered = games.filter(game => 
      game.title.toLowerCase().includes(searchFilter.toLowerCase())
    );

    switch (sortMode) {
      case 'alphabetical':
        return filtered.sort((a, b) => a.title.localeCompare(b.title));
      case 'recent':
        return filtered.sort((a, b) => 
          new Date(b.lastPlayedAt || 0).getTime() - new Date(a.lastPlayedAt || 0).getTime()
        );
      case 'playtime':
        return filtered.sort((a, b) => (b.playtimeHours || 0) - (a.playtimeHours || 0));
      case 'random':
        return filtered.sort(() => Math.random() - 0.5);
      case 'category':
        return filtered.sort((a, b) => (a.category || '').localeCompare(b.category || ''));
      default:
        return filtered;
    }
  }, [games, searchFilter, sortMode]);

  // Calculate 3D positions for games
  const gamePositions = useMemo(() => {
    const positions: Array<{
      game: Game;
      position: { x: number; y: number; z: number };
      rotation: { x: number; y: number; z: number };
      scale: number;
    }> = [];

    const containerWidth = 1200;
    const containerHeight = 800;
    
    filteredGames.forEach((game, index) => {
      let pos, rot, scale;
      
      switch (viewMode) {
        case 'wall':
          // 3D Wall layout
          const cols = Math.ceil(Math.sqrt(filteredGames.length));
          const rows = Math.ceil(filteredGames.length / cols);
          const col = index % cols;
          const row = Math.floor(index / cols);
          
          pos = {
            x: (col - cols / 2) * 200 + (containerWidth / 2),
            y: (row - rows / 2) * 280 + (containerHeight / 2),
            z: Math.sin(col * 0.5) * 100 + Math.cos(row * 0.5) * 50
          };
          rot = {
            x: Math.sin(index * 0.1) * 5,
            y: Math.cos(index * 0.15) * 10,
            z: 0
          };
          scale = 1 - Math.abs(pos.z) / 1000;
          break;
          
        case 'shelf':
          // Bookshelf layout
          pos = {
            x: (index % 6) * 200 + 100,
            y: Math.floor(index / 6) * 280 + 150,
            z: (Math.floor(index / 6) % 2) * 50
          };
          rot = { x: 0, y: 0, z: 0 };
          scale = 0.9;
          break;
          
        case 'carousel':
          // Circular carousel
          const angle = (index / filteredGames.length) * Math.PI * 2;
          const radius = 400;
          pos = {
            x: Math.cos(angle + autoRotation.current) * radius + containerWidth / 2,
            y: Math.sin(angle + autoRotation.current) * radius + containerHeight / 2,
            z: Math.sin(angle + autoRotation.current) * 100
          };
          rot = {
            x: 0,
            y: (angle + autoRotation.current) * (180 / Math.PI) + 90,
            z: 0
          };
          scale = 0.8 + Math.cos(angle + autoRotation.current) * 0.2;
          break;
          
        default:
          // Grid layout
          const gridCols = Math.ceil(Math.sqrt(filteredGames.length));
          const gridCol = index % gridCols;
          const gridRow = Math.floor(index / gridCols);
          
          pos = {
            x: gridCol * 220 + 110,
            y: gridRow * 300 + 150,
            z: 0
          };
          rot = { x: 0, y: 0, z: 0 };
          scale = 1;
      }
      
      positions.push({ game, position: pos, rotation: rot, scale });
    });
    
    return positions;
  }, [filteredGames, viewMode, autoRotation.current]);

  // Auto-rotation for carousel mode
  useEffect(() => {
    if (viewMode !== 'carousel') return;
    
    const interval = setInterval(() => {
      autoRotation.current += 0.01 * rotationSpeed;
    }, 16);
    
    return () => clearInterval(interval);
  }, [viewMode, rotationSpeed]);

  // Mouse tracking for parallax effects
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      
      const rect = containerRef.current.getBoundingClientRect();
      mousePosition.current = {
        x: (e.clientX - rect.left) / rect.width - 0.5,
        y: (e.clientY - rect.top) / rect.height - 0.5
      };
    };
    
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  const handleGameHover = (game: Game | null) => {
    setHoveredGame(game);
    onGameHover?.(game);
  };

  return (
    <div className={`relative w-full h-full overflow-hidden ${className}`}>
      {/* Controls */}
      <AnimatePresence>
        {showControls && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute top-4 left-4 right-4 z-50 flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              {/* View Mode Controls */}
              <div className="flex items-center gap-2 bg-black/40 backdrop-blur-md rounded-2xl p-2 border border-white/10">
                {[
                  { mode: 'wall' as ViewMode, icon: Layers, label: '3D Wall' },
                  { mode: 'shelf' as ViewMode, icon: Layout, label: 'Shelf' },
                  { mode: 'grid' as ViewMode, icon: Grid3X3, label: 'Grid' },
                  { mode: 'carousel' as ViewMode, icon: MousePointer2, label: 'Carousel' }
                ].map(({ mode, icon: Icon, label }) => (
                  <button
                    key={mode}
                    onClick={() => setViewMode(mode)}
                    className={`p-2 rounded-xl transition-all ${
                      viewMode === mode 
                        ? 'bg-white/20 text-white' 
                        : 'text-white/60 hover:text-white hover:bg-white/10'
                    }`}
                    title={label}
                  >
                    <Icon className="w-4 h-4" />
                  </button>
                ))}
              </div>

              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-white/40" />
                <input
                  type="text"
                  placeholder="Buscar jogos..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  className="pl-10 pr-4 py-2 bg-black/40 backdrop-blur-md border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-white/30"
                />
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Sort Controls */}
              <select
                value={sortMode}
                onChange={(e) => setSortMode(e.target.value as SortMode)}
                className="bg-black/40 backdrop-blur-md border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none"
              >
                <option value="alphabetical">A-Z</option>
                <option value="recent">Recentes</option>
                <option value="playtime">Tempo jogado</option>
                <option value="category">Categoria</option>
                <option value="random">Aleatório</option>
              </select>

              {/* Hide Controls */}
              <button
                onClick={() => setShowControls(false)}
                className="p-2 bg-black/40 backdrop-blur-md border border-white/10 rounded-xl text-white/60 hover:text-white transition-colors"
                title="Ocultar controles"
              >
                <EyeOff className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Show Controls Button (when hidden) */}
      {!showControls && (
        <button
          onClick={() => setShowControls(true)}
          className="absolute top-4 right-4 z-50 p-3 bg-black/60 backdrop-blur-md border border-white/20 rounded-full text-white hover:bg-black/80 transition-colors"
          title="Mostrar controles"
        >
          <Eye className="w-5 h-5" />
        </button>
      )}

      {/* Game Wall Container */}
      <div 
        ref={containerRef}
        className="relative w-full h-full"
        style={{ 
          perspective: '1000px',
          perspectiveOrigin: '50% 50%'
        }}
      >
        {gamePositions.map(({ game, position, rotation, scale }, index) => (
          <GameCard3D
            key={game.id}
            game={game}
            position={position}
            rotation={rotation}
            scale={scale}
            isSelected={selectedGame?.id === game.id}
            isHovered={hoveredGame?.id === game.id}
            onClick={() => onGameSelect(game)}
            onHover={() => handleGameHover(game)}
            onLeave={() => handleGameHover(null)}
          />
        ))}
      </div>

      {/* Game Info Panel */}
      <AnimatePresence>
        {hoveredGame && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="absolute top-4 right-4 w-80 bg-black/80 backdrop-blur-xl border border-white/20 rounded-2xl p-6 z-40"
          >
            <div className="flex items-center gap-4 mb-4">
              <div className="w-16 h-16 rounded-xl overflow-hidden">
                <img 
                  src={hoveredGame.cardImage || hoveredGame.image} 
                  alt={hoveredGame.title}
                  className="w-full h-full object-cover"
                />
              </div>
              <div>
                <h3 className="text-white font-bold text-lg">{hoveredGame.title}</h3>
                <p className="text-white/60 text-sm">{hoveredGame.category || 'Jogo'}</p>
              </div>
            </div>
            
            {hoveredGame.description && (
              <p className="text-white/80 text-sm leading-relaxed">
                {hoveredGame.description.slice(0, 150)}...
              </p>
            )}
            
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-white/10">
              <span className="text-white/60 text-xs">
                {hoveredGame.launcherType === 'steam' ? 'Steam' : 
                 hoveredGame.launcherType === 'epic' ? 'Epic Games' : 'Local'}
              </span>
              {hoveredGame.playtimeHours && (
                <span className="text-white/60 text-xs">
                  {Math.floor(hoveredGame.playtimeHours)}h jogado
                </span>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stats */}
      <div className="absolute bottom-4 left-4 bg-black/40 backdrop-blur-md border border-white/10 rounded-xl px-4 py-2">
        <span className="text-white/60 text-sm">
          {filteredGames.length} de {games.length} jogos
        </span>
      </div>
    </div>
  );
};

export default GameWall;