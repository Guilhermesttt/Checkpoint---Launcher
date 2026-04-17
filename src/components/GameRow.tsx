import React, {
  useEffect,
  useCallback,
  useRef,
  useState,
} from "react";
import {
  motion,
  useMotionValue,
  useSpring,
} from "framer-motion";
import GameCard from "./GameCard";
import { Play } from "lucide-react";
import type { Game } from "../types/domain";

interface GameRowProps {
  games: Game[];
  selectedIndex: number;
  onSelect: (index: number, openGame?: Game) => void;
  onFavorite?: (game: Game) => void;
  onEdit?: (game: Game) => void;
  onDelete?: (game: Game) => void;
  onContextMenu?: (e: React.MouseEvent, game: Game) => void;
  onMouseEnter?: () => void;
  playSound: (type: "select" | "back" | "navigate") => void;
}

/* ── Layout Ajustado (Equilibrado) ── */
const ACTIVE_WIDTH = 190;
const ACTIVE_HEIGHT = 270;
const INACTIVE_WIDTH = 150;
const INACTIVE_HEIGHT = 215;
const GAP = 28;

/* ── GameRow Principal ── */
const GameRow: React.FC<GameRowProps> = ({
  games,
  selectedIndex,
  onSelect,
  onContextMenu,
  onMouseEnter,
  playSound,
}) => {
  const n = games.length;
  const canonicalIndex =
    n > 0 ? Math.min(Math.max(selectedIndex, 0), n - 1) : 0;
  const currentGame = games[canonicalIndex];

  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const wheelLockRef = useRef(false);

  useEffect(() => {
    if (containerRef.current)
      setContainerWidth(containerRef.current.offsetWidth);
  }, []);

  const slotWidth = INACTIVE_WIDTH + GAP;
  const rawX = useMotionValue(0);
  const xSpring = useSpring(rawX, { stiffness: 120, damping: 22 });

  /* Lógica de Scroll e Centralização */
  useEffect(() => {
    if (!containerWidth || n === 0) return;
    const center = containerWidth / 2;
    const activeExtra = (ACTIVE_WIDTH - INACTIVE_WIDTH) / 2;
    const pos = canonicalIndex * slotWidth + activeExtra;
    rawX.set(center - pos - ACTIVE_WIDTH / 2);
  }, [canonicalIndex, containerWidth, n, slotWidth]);

  /* Navegação Teclado */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        onSelect(Math.max(0, canonicalIndex - 1));
        playSound("navigate");
      }
      if (e.key === "ArrowRight") {
        onSelect(Math.min(n - 1, canonicalIndex + 1));
        playSound("navigate");
      }
      if (e.key === "Enter" && currentGame) {
        onSelect(canonicalIndex, currentGame);
        playSound("select");
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [canonicalIndex, n, onSelect, playSound, currentGame]);

  const handleWheel = useCallback(
    (event: React.WheelEvent) => {
      if (wheelLockRef.current) return;
      wheelLockRef.current = true;
      const dir = event.deltaY > 0 || event.deltaX > 0 ? 1 : -1;
      onSelect(Math.min(n - 1, Math.max(0, canonicalIndex + dir)));
      playSound("navigate");
      setTimeout(() => {
        wheelLockRef.current = false;
      }, 180);
    },
    [canonicalIndex, n, onSelect, playSound],
  );

  const handleCardClick = (idx: number, game: Game) => {
    if (idx === canonicalIndex) {
      onSelect(idx, game); // Segundo clique: Abre o jogo
      playSound("select");
    } else {
      onSelect(idx); // Primeiro clique: Apenas foca
      playSound("navigate");
    }
  };

  const handleRightClick = (e: React.MouseEvent, game: Game) => {
    e.preventDefault();
    onContextMenu?.(e, game);
    playSound("navigate");
  };

  if (n === 0 || !currentGame) return null;

  return (
    <div
      className="relative w-full overflow-hidden select-none"
      ref={containerRef}
      onContextMenu={(e) => e.preventDefault()}
      onMouseEnter={onMouseEnter}
    >
      {/* Info Panel */}
      <div className="relative z-30 px-14 pt-12 mb-6 text-white">
        <h2 className="text-6xl font-light tracking-tighter leading-none">
          {currentGame.title}
        </h2>
        <div className="flex items-center gap-4 mt-5">
          <motion.button
            onClick={() => onSelect(canonicalIndex, currentGame)}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="flex items-center gap-2.5 px-6 py-2 bg-white/10 backdrop-blur-md border border-white/20 rounded-full hover:bg-white/20 transition-all"
          >
            <Play size={14} className="fill-current" />
            <span className="text-[11px] font-black uppercase tracking-[0.2em]">
              Quick Play
            </span>
          </motion.button>
        </div>
      </div>

      {/* Carrossel de Cards */}
      <div
        className="relative z-20 w-full"
        style={{ height: ACTIVE_HEIGHT + 60 }}
        onWheel={handleWheel}
      >
        <motion.div
          style={{ x: xSpring }}
          className="absolute flex items-center gap-[28px] top-0 left-0 h-full"
        >
          {games.map((game, idx) => {
            const isActive = idx === canonicalIndex;
            return (
              <motion.div
                key={game.id}
                animate={{
                  opacity: isActive ? 1 : 0.45,
                  scale: isActive ? 1 : 0.9,
                }}
                className="shrink-0 cursor-pointer"
                onClick={() => handleCardClick(idx, game)}
                style={{
                  width: isActive ? ACTIVE_WIDTH : INACTIVE_WIDTH,
                  height: isActive ? ACTIVE_HEIGHT : INACTIVE_HEIGHT,
                }}
              >
                <GameCard
                  title={game.title}
                  image={game.cardImage || game.image}
                  isActive={isActive}
                  onContextMenu={(e) => handleRightClick(e, game)}
                  width={isActive ? ACTIVE_WIDTH : INACTIVE_WIDTH}
                  height={isActive ? ACTIVE_HEIGHT : INACTIVE_HEIGHT}
                />
              </motion.div>
            );
          })}
        </motion.div>
      </div>

      {/* Dinâmico Progress Scrollbar para Muitos Jogos */}
      <div className="flex justify-center pb-16 mt-6">
        {n <= 12 ? (
          <div className="flex items-center gap-2.5 px-5 py-2.5 bg-black/40 backdrop-blur-xl rounded-full border border-white/10">
            {games.map((_, i) => (
              <motion.div
                key={i}
                animate={{
                  width: i === canonicalIndex ? 28 : 7,
                  backgroundColor:
                    i === canonicalIndex ? "#fff" : "rgba(255,255,255,0.2)",
                }}
                className="h-1.5 rounded-full"
              />
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-4 px-6 py-2.5 bg-black/40 backdrop-blur-xl rounded-full border border-white/10 w-full max-w-[400px]">
             <span className="text-[10px] font-bold text-white/40 tracking-widest min-w-[30px] text-right">{canonicalIndex + 1}</span>
             <div className="flex-1 h-1.5 bg-white/10 rounded-full relative overflow-hidden">
               <motion.div 
                 className="absolute top-0 bottom-0 bg-white rounded-full shadow-[0_0_8px_rgba(255,255,255,0.5)]"
                 animate={{
                   width: `${Math.max(15, 100 / n)}%`,
                   left: `${n > 1 ? (canonicalIndex / (n - 1)) * (100 - Math.max(15, 100 / n)) : 0}%`
                 }}
                 transition={{ type: "spring", stiffness: 400, damping: 40 }}
               />
             </div>
             <span className="text-[10px] font-bold text-white/40 tracking-widest min-w-[30px]">{n}</span>
          </div>
        )}
      </div>

      {/* Context Menu renderizado no Home.tsx via props */}
    </div>
  );
};

export default GameRow;
