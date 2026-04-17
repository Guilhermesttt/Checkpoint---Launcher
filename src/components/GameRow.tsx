import React, { useEffect, useCallback, useRef, useState } from "react";
import {
  motion,
  useMotionValue,
  useSpring,
  AnimatePresence,
} from "framer-motion";
import GameCard from "./GameCard";
import { ChevronLeft, ChevronRight, Play, Clock, Trophy } from "lucide-react";
import type { Game } from "../types/domain";

interface GameRowProps {
  games: Game[];
  selectedIndex: number;
  onSelect: (index: number, openGame?: Game) => void;
  onHover?: (index: number) => void;
  onContextMenu?: (e: React.MouseEvent, game: Game) => void;
  playSound: (type: "select" | "back" | "navigate") => void;
}

/* ── Layout Constants ── */
const ACTIVE_WIDTH = 180;
const ACTIVE_HEIGHT = 260;
const INACTIVE_WIDTH = 150;
const INACTIVE_HEIGHT = 220;
const GAP = 24;
const formatPlaytime = (game: Game) => {
  const hours = game.steamPlaytimeMinutes
    ? game.steamPlaytimeMinutes / 60
    : game.hoursPlayed ?? 0;
  if (!hours || Number.isNaN(hours)) return null;
  return `${hours.toFixed(1)}h`;
};

const GameRow: React.FC<GameRowProps> = ({
  games,
  selectedIndex,
  onSelect,
  onHover,
  onContextMenu,
  playSound,
}) => {
  const n = games.length;
  if (n === 0) return null;

  // Índice canônico (garante positivo)
  const canonicalIndex = ((selectedIndex % n) + n) % n;
  const currentGame = games[canonicalIndex];

  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const wheelLockRef = useRef(false);

  useEffect(() => {
    if (containerRef.current) {
      setContainerWidth(containerRef.current.offsetWidth);
    }
    const handleResize = () => {
      if (containerRef.current)
        setContainerWidth(containerRef.current.offsetWidth);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Calcula o espaço total que o carrossel ocupa
  const totalWidth = ACTIVE_WIDTH + (n - 1) * (INACTIVE_WIDTH + GAP);

  // MotionValue e Spring para animação suave
  const rawX = useMotionValue(0);
  const x = useSpring(rawX, {
    stiffness: 180,
    damping: 28,
    mass: 0.8,
  });

  // Atualiza posição do carrossel para centralizar o item ativo
  useEffect(() => {
    // Se não há container, não faz nada
    if (!containerWidth) return;

    // Posição ideal para centralizar o item ativo
    let leftOfActive = 0;
    for (let i = 0; i < canonicalIndex; i++) {
      leftOfActive += INACTIVE_WIDTH + GAP;
    }
    // Centraliza o ativo no centro EXATO do container
    const centerOffset = (containerWidth - ACTIVE_WIDTH) / 2;
    const targetX = -leftOfActive + centerOffset;

    rawX.set(targetX);
  }, [canonicalIndex, n, containerWidth, rawX]);

  // Navegação manual
  const handlePrev = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onSelect((canonicalIndex - 1 + n) % n);
    },
    [canonicalIndex, n, onSelect],
  );

  const handleNext = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onSelect((canonicalIndex + 1) % n);
    },
    [canonicalIndex, n, onSelect],
  );

  // Drag circular: ao arrastar para fora, pula para o próximo/antigo
  const handleDragEnd = useCallback(
    (_: unknown, info: { offset: { x: number }; velocity: { x: number } }) => {
      const swipeThreshold = 60;
      const swipe = info.offset.x + info.velocity.x * 15;

      if (swipe < -swipeThreshold) {
        // Arrastou para esquerda → próximo
        onSelect((canonicalIndex + 1) % n);
      } else if (swipe > swipeThreshold) {
        // Arrastou para direita → anterior
        onSelect((canonicalIndex - 1 + n) % n);
      }
      // Caso contrário, mantém o mesmo índice (animado volta)
    },
    [canonicalIndex, n, onSelect],
  );

  // Renderiza os cartões (apenas os reais, sem cópias)
  const renderCards = () => {
    return games.map((game, idx) => {
      const isActive = idx === canonicalIndex;

      // Posição visual do cartão (calcula offset por índice)
      let leftOffset = 0;
      for (let i = 0; i < idx; i++) {
        leftOffset += i === canonicalIndex ? ACTIVE_WIDTH : INACTIVE_WIDTH;
        if (i !== idx - 1) leftOffset += GAP;
      }

      // O layout é feito com flex e position: relative + transform para evitar "pulos"
      return (
        <motion.div
          key={game.id}
          layout
          initial={{ opacity: 0, scale: 0.8, x: 20 }}
          animate={{
            opacity: isActive ? 1 : 0.65,
            scale: isActive ? 1 : 0.9,
            x: 0,
            left: `${leftOffset}px`,
          }}
          exit={{ opacity: 0, scale: 0.5 }}
          className="absolute pointer-events-auto"
          style={{
            width: isActive ? ACTIVE_WIDTH : INACTIVE_WIDTH,
            height: isActive ? ACTIVE_HEIGHT : INACTIVE_HEIGHT,
            transition: "width 0.5s cubic-bezier(0.16,1,0.3,1), height 0.5s",
          }}
        >
          <GameCard
            title={game.title}
            image={game.cardImage || game.image}
            isActive={isActive}
            isFavorite={Boolean(game.isFavorite)}
            playtimeHoursLabel={formatPlaytime(game) ?? undefined}
            width={isActive ? ACTIVE_WIDTH : INACTIVE_WIDTH}
            height={isActive ? ACTIVE_HEIGHT : INACTIVE_HEIGHT}
            onClick={() => onSelect(idx, game)}
            onContextMenu={(e) => onContextMenu?.(e, game)}
            onHover={() => {
              onHover?.(idx);
              if (idx !== canonicalIndex) {
                playSound("navigate");
              }
            }}
          />
        </motion.div>
      );
    });
  };

  const handleWheel = useCallback(
    (event: React.WheelEvent<HTMLDivElement>) => {
      if (Math.abs(event.deltaY) < 8 && Math.abs(event.deltaX) < 8) return;
      event.preventDefault();
      if (wheelLockRef.current) return;
      wheelLockRef.current = true;
      const direction = event.deltaY > 0 || event.deltaX > 0 ? 1 : -1;
      onSelect((canonicalIndex + direction + n) % n);
      window.setTimeout(() => {
        wheelLockRef.current = false;
      }, 130);
    },
    [canonicalIndex, n, onSelect],
  );

  return (
    <div 
      className="relative w-full group" 
      ref={containerRef}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Info Panel acima */}
      <div className="relative z-30 px-8 md:px-12 mt-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentGame.id}
            initial={{ opacity: 0, y: 20, filter: "blur(8px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -15, filter: "blur(8px)" }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-col gap-4"
          >
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-bold tracking-[0.3em] text-white/30 uppercase">
                PC
              </span>
              <div className="w-1 h-1 rounded-full bg-white/20" />
              <span className="text-[10px] font-bold tracking-[0.2em] text-blue-400/80 uppercase">
                {currentGame?.category || "GAME"}
              </span>
            </div>
            <h2 className="text-4xl md:text-5xl lg:text-6xl font-light text-white tracking-tight">
              {currentGame?.title}
            </h2>
            <div className="flex items-center gap-6 mt-2">
              <QuickStat icon={<Clock className="w-4 h-4" />} label="24h" />
              <QuickStat icon={<Trophy className="w-4 h-4" />} label="47%" />
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="flex items-center gap-2 px-4 py-2 liquid-glass-subtle rounded-full text-white/70 hover:text-white transition-colors"
              >
                <Play className="w-3 h-3 fill-current" />
                <span className="text-[10px] font-bold tracking-[0.15em] uppercase">
                  Quick Play
                </span>
              </motion.button>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Navegação */}
      <button
        onClick={handlePrev}
        onMouseEnter={() => playSound("navigate")}
        className="absolute left-6 top-1/2 -translate-y-1/2 z-40 w-14 h-14 rounded-full liquid-glass flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 hover:bg-white/15 hover:scale-110 active:scale-90 shadow-[0_0_30px_rgba(0,0,0,0.3)]"
        aria-label="Anterior"
      >
        <ChevronLeft className="w-8 h-8 text-white/80" />
      </button>
      <button
        onClick={handleNext}
        onMouseEnter={() => playSound("navigate")}
        className="absolute right-6 top-1/2 -translate-y-1/2 z-40 w-14 h-14 rounded-full liquid-glass flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 hover:bg-white/15 hover:scale-110 active:scale-90 shadow-[0_0_30px_rgba(0,0,0,0.3)]"
        aria-label="Próximo"
      >
        <ChevronRight className="w-8 h-8 text-white/80" />
      </button>

      {/* Container do carrossel */}
      <div
        className="w-full overflow-hidden relative pb-10"
        onWheel={handleWheel}
        style={{
          height: Math.max(ACTIVE_HEIGHT, INACTIVE_HEIGHT) + 24,
        }}
      >
        <motion.div
          drag="x"
          dragConstraints={{ left: -totalWidth, right: containerWidth }}
          dragElastic={0.15}
          dragMomentum={true}
          onDragEnd={handleDragEnd}
          style={{ x }}
          className="relative h-full cursor-grab active:cursor-grabbing"
        >
          <AnimatePresence>{renderCards()}</AnimatePresence>
        </motion.div>
      </div>

      {/* Indicadores circulares */}
      <div className="flex justify-center mt-4">
        <div className="flex items-center gap-2">
          {games.map((_, i) => (
            <motion.button
              key={i}
              onClick={() => onSelect(i)}
              onMouseEnter={() => playSound("navigate")}
              animate={{
                width: i === canonicalIndex ? 32 : 8,
                opacity: i === canonicalIndex ? 1 : 0.3,
              }}
              transition={{ type: "spring", stiffness: 400, damping: 28 }}
              className={`
                h-2 rounded-full transition-colors
                ${i === canonicalIndex ? "bg-white" : "bg-white/40 hover:bg-white/60"}
              `}
              style={{
                boxShadow:
                  i === canonicalIndex
                    ? "0 0 10px rgba(255,255,255,0.5)"
                    : "none",
              }}
              aria-label={`Ir para jogo ${i + 1}`}
            />
          ))}
        </div>
      </div>

      <div className="px-8 md:px-12 mt-3">
        <div className="liquid-glass-subtle rounded-full px-3 py-2">
          <input
            type="range"
            min={0}
            max={Math.max(0, n - 1)}
            value={canonicalIndex}
            onChange={(e) => onSelect(Number(e.target.value))}
            className="game-row-scrubber"
            aria-label="Barra de navegação dos jogos"
          />
        </div>
      </div>
    </div>
  );
};

const QuickStat: React.FC<{ icon: React.ReactNode; label: string }> = ({
  icon,
  label,
}) => (
  <div className="flex items-center gap-2 text-white/40">
    {icon}
    <span className="text-sm font-medium">{label}</span>
  </div>
);

export default GameRow;
