import React, { useCallback, useEffect, useMemo } from "react";
import useEmblaCarousel from "embla-carousel-react";
import GameCard from "./GameCard";
import type { Game } from "../types/domain";

interface GameRowProps {
  games: Game[];
  selectedIndex: number;
  onSelect: (index: number, openGame?: Game) => void;
  onContextMenu?: (e: React.MouseEvent, game: Game) => void;
  playSound: (type: "select" | "back" | "navigate") => void;
}

const MAX_VISIBLE_DOTS = 15;

const GameCardSlot = React.memo(
  ({
    game,
    index,
    isActive,
    onSelect,
    onContextMenu,
    playSound,
  }: {
    game: Game;
    index: number;
    isActive: boolean;
    onSelect: (index: number, openGame?: Game) => void;
    onContextMenu?: (e: React.MouseEvent, game: Game) => void;
    playSound: (type: "select" | "back" | "navigate") => void;
  }) => {
    const handleClick = useCallback(() => {
      if (isActive) {
        onSelect(index, game);
      } else {
        onSelect(index);
        playSound("navigate");
      }
    }, [game, index, isActive, onSelect, playSound]);

    const handleContextMenu = useCallback(
      (e: React.MouseEvent) => onContextMenu?.(e, game),
      [game, onContextMenu],
    );

    return (
      <div className="shrink-0">
        <GameCard
          title={game.title}
          image={game.cardImage || game.image}
          isActive={isActive}
          isSteam={game.source === "steam"}
          isFavorite={game.isFavorite}
          onClick={handleClick}
          onContextMenu={handleContextMenu}
        />
      </div>
    );
  },
  (prev, next) =>
    prev.game.id === next.game.id &&
    prev.game.title === next.game.title &&
    prev.game.cardImage === next.game.cardImage &&
    prev.game.image === next.game.image &&
    prev.game.source === next.game.source &&
    prev.game.isFavorite === next.game.isFavorite &&
    prev.index === next.index &&
    prev.isActive === next.isActive,
);

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
  const visibleDots = useMemo(() => {
    if (games.length <= MAX_VISIBLE_DOTS) {
      return games.map((_, index) => index);
    }

    const half = Math.floor(MAX_VISIBLE_DOTS / 2);
    const start = Math.max(
      0,
      Math.min(canonicalIndex - half, games.length - MAX_VISIBLE_DOTS),
    );
    return Array.from({ length: MAX_VISIBLE_DOTS }, (_, offset) => start + offset);
  }, [canonicalIndex, games]);

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
            <GameCardSlot
              key={game.id}
              game={game}
              index={idx}
              isActive={idx === canonicalIndex}
              onSelect={onSelect}
              onContextMenu={onContextMenu}
              playSound={playSound}
            />
          ))}
        </div>
      </div>

      <div className="flex justify-center mt-6 gap-1.5">
        {visibleDots.map((i) => (
          <div
            key={i}
            className="h-[3px] rounded-full cursor-pointer"
            style={{
              width: i === canonicalIndex ? 28 : 6,
              opacity: i === canonicalIndex ? 1 : 0.22,
              transition: "width 180ms ease, opacity 180ms ease",
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
