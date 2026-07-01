import React from "react";
import { Play, Star, Zap } from "lucide-react";

interface GameCardProps {
  title: string;
  image: string;
  isActive?: boolean;
  onClick?: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  isFavorite?: boolean;
  isSteam?: boolean;
}

const GameCard: React.FC<GameCardProps> = ({
  title,
  image,
  isActive = false,
  onClick,
  onContextMenu,
  isFavorite = false,
  isSteam = false,
}) => {
  return (
    <div
      onClick={onClick}
      onContextMenu={onContextMenu}
      className="relative flex items-center justify-center cursor-pointer select-none"
      style={{ width: 172, height: 260 }}
    >
      {/* Glow aura behind active card */}
      {isActive && (
        <div
          className="absolute inset-0 rounded-2xl pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse at 50% 110%, var(--game-color) 0%, transparent 70%)",
            opacity: 0.45,
            transform: "translateY(12px) scaleX(0.82)",
            zIndex: 0,
          }}
        />
      )}

      <div
        className="relative z-10"
        style={{
          width: 156,
          height: 236,
          transform: isActive ? "translateY(-6px) scale(1)" : "scale(0.87)",
          transition: "transform 220ms ease, opacity 220ms ease",
          willChange: isActive ? "transform" : "auto",
        }}
      >
        {/* Card shell */}
        <div
          className={`
            relative w-full h-full overflow-hidden rounded-2xl
            transition-shadow duration-300
            ${
              isActive
                ? "shadow-[0_0_0_2px_rgba(255,255,255,0.18),0_32px_64px_rgba(0,0,0,0.9)]"
                : "shadow-[0_8px_32px_rgba(0,0,0,0.6)]"
            }
          `}
          style={isActive ? { boxShadow: "0 0 0 2px rgba(255,255,255,0.18), 0 32px 64px rgba(0,0,0,0.9), 0 8px 32px var(--game-color)" } : {}}
        >
          {/* Cover image */}
          <img
            src={image}
            alt={title}
            className="absolute inset-0 w-full h-full object-cover"
            style={{
            }}
            loading={isActive ? "eager" : "lazy"}
            decoding="async"
          />

          {/* Cinematic gradient overlay */}
          <div
            className="absolute inset-0"
            style={{
              background: isActive
                ? "linear-gradient(180deg, rgba(0,0,0,0.05) 0%, rgba(0,0,0,0.12) 40%, rgba(0,0,0,0.75) 75%, rgba(0,0,0,0.96) 100%)"
                : "linear-gradient(180deg, rgba(0,0,0,0.24) 0%, rgba(0,0,0,0.36) 45%, rgba(0,0,0,0.82) 100%)",
            }}
          />

          {/* Subtle specular sheen on active */}
          {isActive && (
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background:
                  "linear-gradient(135deg, rgba(255,255,255,0.15) 0%, transparent 50%)",
                boxShadow: "inset 0 0 0 1px var(--game-color)",
              }}
            />
          )}

          {/* Top badges */}
          <div className="absolute top-2.5 left-2.5 right-2.5 flex items-start justify-between">
            {isSteam && (
              <div
                className="flex items-center gap-1 px-2 py-0.5 rounded-full"
                style={{
                  background: "rgba(0,0,0,0.55)",
                  border: "1px solid rgba(103,182,118,0.35)",
                }}
              >
                <Zap className="w-2.5 h-2.5" style={{ color: "#67b676" }} />
                <span
                  className="text-[8px] font-black tracking-wider uppercase"
                  style={{ color: "#67b676" }}
                >
                  Steam
                </span>
              </div>
            )}
            {!isSteam && <div />}
            {isFavorite && (
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center"
                style={{
                  background: "rgba(251,191,36,0.15)",
                  border: "1px solid rgba(251,191,36,0.5)",
                }}
              >
                <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
              </div>
            )}
          </div>

          {/* Bottom info */}
          <div
            className={`absolute bottom-0 left-0 right-0 p-3 transition-all duration-400 ${
              isActive ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
            }`}
          >
            <p
              className="text-[8px] font-black uppercase tracking-[0.22em] mb-1"
              style={{ color: "rgba(255,255,255,0.38)" }}
            >
              Iniciar
            </p>
            <h3 className="text-[13px] font-bold text-white leading-tight line-clamp-2">
              {title}
            </h3>
          </div>

          {/* Play overlay on hover */}
          {isActive && (
            <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity duration-200">
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center"
                style={{
                  background: "rgba(255,255,255,0.12)",
                  border: "1.5px solid rgba(255,255,255,0.3)",
                }}
              >
                <Play
                  className="w-6 h-6 text-white fill-white"
                  style={{ marginLeft: 2 }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Active indicator bar at bottom */}
        {isActive && (
          <div
            className="absolute -bottom-3 left-1/2 -translate-x-1/2 h-0.5 rounded-full"
            style={{
              width: 32,
              background:
                "linear-gradient(90deg, transparent, rgba(255,255,255,0.8), transparent)",
            }}
          />
        )}
      </div>
    </div>
  );
};

export default React.memo(GameCard);
