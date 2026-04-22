import React, { useEffect } from "react";
import useEmblaCarousel from "embla-carousel-react";
import { motion } from "framer-motion";
import GameCard from "./GameCard";
import type { Game } from "../types/domain";

interface GameRowProps {
  games: Game[];
  selectedIndex: number;
  onSelect: (index: number, openGame?: Game) => void;
  onContextMenu?: (e: React.MouseEvent, game: Game) => void;
  playSound: (type: "select" | "back" | "navigate") => void;
}

const GameRow: React.FC<GameRowProps> = ({
  games,
  selectedIndex,
  onSelect,
  onContextMenu,
  playSound,
}) => {
  const [emblaRef, emblaApi] = useEmblaCarousel({
    align: "center",
    containScroll: false,
    dragFree: false,
    loop: false,
  });

  const canonicalIndex = Math.min(Math.max(selectedIndex, 0), games.length - 1);

  useEffect(() => {
    if (emblaApi) emblaApi.scrollTo(canonicalIndex);
  }, [emblaApi, canonicalIndex]);

  useEffect(() => {
    if (!emblaApi) return;
    const onSnap = () => {
      const idx = emblaApi.selectedScrollSnap();
      if (idx !== canonicalIndex) {
        onSelect(idx);
        playSound("navigate");
      }
    };
    emblaApi.on("select", onSnap);
    return () => {
      emblaApi.off("select", onSnap);
    };
  }, [emblaApi, canonicalIndex, onSelect, playSound]);

  return (
    <div className="relative w-full flex flex-col" style={{ gap: 0 }}>


      {/* ── Carousel ── */}
      <div className="overflow-visible pb-2" ref={emblaRef}>
        <div
          className="flex"
          style={{
            gap: 8,
            paddingLeft: "calc(50vw - 86px)",
            paddingRight: "calc(50vw - 86px)",
          }}
        >
          {games.map((game, idx) => (
            <div key={game.id} className="shrink-0">
              <GameCard
                title={game.title}
                image={game.cardImage || game.image}
                isActive={idx === canonicalIndex}
                isSteam={game.source === "steam"}
                isFavorite={game.isFavorite}
                onClick={() => {
                  if (idx === canonicalIndex) {
                    onSelect(idx, game);
                    playSound("select");
                  } else {
                    onSelect(idx);
                    playSound("navigate");
                  }
                }}
                onContextMenu={(e) => onContextMenu?.(e, game)}
              />
            </div>
          ))}
        </div>
      </div>

      {/* ── Dot pagination ── */}
      <div className="flex justify-center mt-6 gap-1.5">
        {games.map((_, i) => (
          <motion.div
            key={i}
            animate={{
              width: i === canonicalIndex ? 28 : 6,
              opacity: i === canonicalIndex ? 1 : 0.22,
            }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="h-[3px] rounded-full cursor-pointer"
            style={{
              background:
                i === canonicalIndex
                  ? "rgba(255,255,255,0.9)"
                  : "rgba(255,255,255,1)",
            }}
            onClick={() => {
              onSelect(i);
              playSound("navigate");
            }}
          />
        ))}
      </div>
    </div>
  );
};

export default React.memo(GameRow);
