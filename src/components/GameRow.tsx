import React, {
  useEffect,
  useCallback,
  useRef,
  useState,
  useMemo,
} from "react";
import {
  motion,
  useMotionValue,
  useSpring,
  useReducedMotion,
} from "framer-motion";
import GameCard from "./GameCard";
import { Play } from "lucide-react";
import type { Game } from "../types/domain";
import SplitText from "./ReactBits/SplitText";

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
  const prefersReducedMotion = useReducedMotion();
  const n = games.length;
  const canonicalIndex =
    n > 0 ? Math.min(Math.max(selectedIndex, 0), n - 1) : 0;
  const currentGame = games[canonicalIndex];

  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const wheelLockRef = useRef(false);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const updateWidth = () => setContainerWidth(element.offsetWidth);
    updateWidth();

    const observer = new ResizeObserver(updateWidth);
    observer.observe(element);

    return () => observer.disconnect();
  }, []);

  const slotWidth = INACTIVE_WIDTH + GAP;
  const rawX = useMotionValue(0);
  const xSpring = useSpring(rawX, {
    stiffness: prefersReducedMotion ? 260 : 120,
    damping: prefersReducedMotion ? 40 : 22,
  });

  // Render window (simple virtualization) — dramatically reduces DOM + motion work.
  const { startIndex, endIndex, leftSpacerPx, rightSpacerPx } = useMemo(() => {
    // Base window: enough cards to cover viewport + buffer.
    const baseVisible =
      containerWidth > 0 ? Math.ceil(containerWidth / slotWidth) + 8 : 20;
    const visible = Math.min(n, Math.max(8, baseVisible));
    const half = Math.floor(visible / 2);

    let start = Math.max(0, canonicalIndex - half);
    let end = Math.min(n, start + visible);
    start = Math.max(0, end - visible);

    return {
      startIndex: start,
      endIndex: end,
      leftSpacerPx: start * slotWidth,
      rightSpacerPx: Math.max(0, n - end) * slotWidth,
    };
  }, [canonicalIndex, containerWidth, n, slotWidth]);

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
      // Ignore if typing in an input or textarea
      const target = e.target as HTMLElement;
      if (
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable
      ) {
        return;
      }

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
      window.setTimeout(() => {
        wheelLockRef.current = false;
      }, prefersReducedMotion ? 120 : 180);
    },
    [canonicalIndex, n, onSelect, playSound, prefersReducedMotion],
  );

  const handleCardClick = useCallback(
    (idx: number, game: Game) => {
      if (idx === canonicalIndex) {
        onSelect(idx, game); // Segundo clique: Abre o jogo
        playSound("select");
      } else {
        onSelect(idx); // Primeiro clique: Apenas foca
        playSound("navigate");
      }
    },
    [canonicalIndex, onSelect, playSound],
  );

  const handleRightClick = useCallback(
    (e: React.MouseEvent, game: Game) => {
      e.preventDefault();
      onContextMenu?.(e, game);
      playSound("navigate");
    },
    [onContextMenu, playSound],
  );

  const indicatorWidth = Math.max(15, 100 / Math.max(n, 1));
  const progressLeft =
    n > 1 ? (canonicalIndex / (n - 1)) * (100 - indicatorWidth) : 0;

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
        {prefersReducedMotion ? (
          <h2 className="text-6xl font-light tracking-tighter leading-none">
            {currentGame.title}
          </h2>
        ) : (
          <SplitText
            text={currentGame.title}
            className="text-6xl font-light tracking-tighter leading-none"
          />
        )}
        <div className="flex items-center gap-4 mt-5">
          <motion.button
            onClick={() => onSelect(canonicalIndex, currentGame)}
            whileHover={prefersReducedMotion ? undefined : { scale: 1.05 }}
            whileTap={prefersReducedMotion ? undefined : { scale: 0.95 }}
            className="flex items-center gap-2.5 px-6 py-2 bg-white/10 backdrop-blur-md border border-white/20 rounded-full hover:bg-white/20 transition-all fluid-glass-accent"
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
          {leftSpacerPx > 0 && (
            <div aria-hidden style={{ width: leftSpacerPx }} />
          )}

          {games.slice(startIndex, endIndex).map((game, localIdx) => {
            const idx = startIndex + localIdx;
            const isActive = idx === canonicalIndex;
            return (
              <motion.div
                key={game.id}
                animate={
                  prefersReducedMotion
                    ? undefined
                    : {
                        opacity: isActive ? 1 : 0.45,
                        scale: isActive ? 1 : 0.9,
                      }
                }
                className="shrink-0 cursor-pointer"
                onClick={() => handleCardClick(idx, game)}
                transition={
                  prefersReducedMotion
                    ? { duration: 0 }
                    : { type: "spring", stiffness: 280, damping: 26 }
                }
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

          {rightSpacerPx > 0 && (
            <div aria-hidden style={{ width: rightSpacerPx }} />
          )}
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
                 key="row-progress"
                 className="absolute top-0 bottom-0 bg-white rounded-full shadow-[0_0_8px_rgba(255,255,255,0.5)]"
                 animate={{
                   width: `${indicatorWidth}%`,
                   left: `${progressLeft}%`
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

export default React.memo(GameRow);
