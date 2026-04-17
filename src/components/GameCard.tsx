import React from "react";
import { motion } from "framer-motion";
import { Play, Star } from "lucide-react";

interface GameCardProps {
  title: string;
  image: string;
  isActive?: boolean;
  onClick?: () => void;
  onHover?: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  width?: number;
  height?: number;
  isFavorite?: boolean;
  playtimeHoursLabel?: string;
}

const GameCard: React.FC<GameCardProps> = ({
  title,
  image,
  isActive = false,
  onClick,
  onHover,
  onContextMenu,
  width = 180,
  height = 260,
  isFavorite = false,
  playtimeHoursLabel,
}) => {
  return (
    <motion.div
      onClick={onClick}
      onMouseEnter={onHover}
      onContextMenu={(e) => {
        e.preventDefault();
        onContextMenu?.(e);
      }}
      animate={{
        opacity: isActive ? 1 : 0.5,
        y: isActive ? 0 : 16,
        scale: isActive ? 1.1 : 0.95,
        filter: isActive
          ? "blur(0px) grayscale(0) brightness(1)"
          : "blur(1px) grayscale(0.2) brightness(0.75)",
      }}
      transition={{
        type: "spring",
        stiffness: 300,
        damping: 28,
        mass: 0.7,
      }}
      whileHover={
        !isActive
          ? {
              opacity: 0.75,
              filter: "blur(0px) grayscale(0) brightness(0.9)",
              y: 8,
              scale: 0.98,
            }
          : undefined
      }
      whileTap={{ scale: 0.96 }}
      className="relative shrink-0 cursor-pointer group"
      style={{
        width,
        height,
        transition:
          "width 0.25s cubic-bezier(0.16, 1, 0.3, 1), height 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
      }}
    >
      {/* Card Body */}
      <div
        className={`
          relative h-full w-full overflow-hidden rounded-2xl
          transition-all duration-500 ease-out
          ${isActive 
            ? "ring-[3px] ring-white/90 shadow-[0_0_60px_rgba(255,255,255,0.15)]" 
            : "ring-1 ring-white/10 shadow-lg"
          }
        `}
      >
        {isActive && (
          <div className="absolute -inset-3 rounded-3xl bg-blue-400/20 blur-2xl pointer-events-none -z-10" />
        )}

        {/* Cover Image */}
        <img
          src={image}
          alt={title}
          className="h-full w-full object-cover"
          loading={isActive ? "eager" : "lazy"}
          decoding="async"
          draggable={false}
        />

        {/* Discrete status badges */}
        <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none">
          {playtimeHoursLabel ? (
            <span className="px-2 py-1 rounded-full bg-black/55 text-[10px] font-semibold text-white/85">
              {playtimeHoursLabel}
            </span>
          ) : (
            <span />
          )}
          {isFavorite && (
            <span className="w-7 h-7 rounded-full bg-amber-400/85 flex items-center justify-center shadow-[0_0_12px_rgba(251,191,36,0.55)]">
              <Star className="w-4 h-4 text-black fill-black" />
            </span>
          )}
        </div>

        {/* Liquid Glass Overlay (active only) */}
        {isActive && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
            className="absolute inset-0 pointer-events-none"
            style={{
              background: `
                linear-gradient(135deg, rgba(255,255,255,0.2) 0%, transparent 40%),
                linear-gradient(315deg, rgba(255,255,255,0.1) 0%, transparent 40%)
              `,
            }}
          />
        )}

        {/* Play Button Overlay (on hover when active) */}
        {isActive && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300"
          >
            <motion.div
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              className="w-16 h-16 rounded-full liquid-glass flex items-center justify-center"
            >
              <Play className="w-7 h-7 text-white fill-white ml-1" />
            </motion.div>
          </motion.div>
        )}

        {/* Bottom vignette */}
        <div
          className="absolute inset-x-0 bottom-0 h-1/2 pointer-events-none"
          style={{
            background:
              "linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 100%)",
          }}
        />

        {/* Title (visible on active) */}
        {isActive && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="absolute bottom-0 left-0 right-0 p-4"
          >
            <h3 className="text-sm font-semibold text-white truncate drop-shadow-lg">
              {title}
            </h3>
          </motion.div>
        )}
      </div>

      {!isActive && (
        <p className="mt-2 text-xs text-white/45 truncate px-1">{title}</p>
      )}

      {/* Active indicator dot */}
      {isActive && (
        <motion.div
          layoutId="game-active-dot"
          className="absolute -bottom-5 left-1/2 -translate-x-1/2 w-2 h-2 bg-white rounded-full"
          style={{ 
            boxShadow: "0 0 15px rgba(255,255,255,0.8), 0 0 30px rgba(255,255,255,0.4)" 
          }}
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
        />
      )}

      {/* Reflection effect (active only) */}
      {isActive && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.1 }}
          className="absolute -bottom-20 left-0 right-0 h-20 pointer-events-none overflow-hidden rounded-b-2xl"
          style={{
            background: `url(${image})`,
            backgroundSize: "cover",
            backgroundPosition: "bottom",
            transform: "scaleY(-1)",
            maskImage: "linear-gradient(to top, black, transparent)",
            WebkitMaskImage: "linear-gradient(to top, black, transparent)",
            filter: "blur(4px)",
          }}
        />
      )}
    </motion.div>
  );
};

export default React.memo(GameCard);
