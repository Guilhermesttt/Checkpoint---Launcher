import React from "react";
import { Play, Star } from "lucide-react";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSteam } from '@fortawesome/free-brands-svg-icons';
import { EPIC_GAMES_ICON_PATH } from "../constants/assets";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";

interface GameCardProps {
  title: string;
  image: string;
  isActive?: boolean;
  onClick?: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  isFavorite?: boolean;
  isSteam?: boolean;
  isEpic?: boolean;
}

const GameCard: React.FC<GameCardProps> = ({
  title,
  image,
  isActive = false,
  onClick,
  onContextMenu,
  isFavorite = false,
  isSteam = false,
  isEpic = false,
}) => {
  // Motion values para o efeito 3D (não causam re-render)
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  // Springs para suavizar o movimento
  const mouseXSpring = useSpring(x, { stiffness: 400, damping: 30 });
  const mouseYSpring = useSpring(y, { stiffness: 400, damping: 30 });

  // Transforma os valores de [-0.5, 0.5] para graus de rotação
  const rotateX = useTransform(mouseYSpring, [-0.5, 0.5], ["12deg", "-12deg"]);
  const rotateY = useTransform(mouseXSpring, [-0.5, 0.5], ["-12deg", "12deg"]);
  
  // Transformações para o brilho (glare)
  const glareX = useTransform(mouseXSpring, [-0.5, 0.5], ["100%", "0%"]);
  const glareY = useTransform(mouseYSpring, [-0.5, 0.5], ["100%", "0%"]);
  const glareOpacity = useTransform(mouseXSpring, [-0.5, 0, 0.5], [0.3, 0, 0.3]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isActive) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    x.set(mouseX / width - 0.5);
    y.set(mouseY / height - 0.5);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };

  const platformBadge = React.useMemo(() => {
    if (isSteam) {
      return {
        label: "Steam",
        color: "#67b676",
        border: "rgba(103,182,118,0.35)",
        icon: <FontAwesomeIcon icon={faSteam} className="w-2.5 h-2.5" style={{ color: "#67b676" }} />,
      };
    }
    if (isEpic) {
      return {
        label: "Epic",
        color: "#f5f5f5",
        border: "rgba(255,255,255,0.3)",
        icon: (
          <img
            src={EPIC_GAMES_ICON_PATH}
            alt=""
            className="w-2.5 h-2.5 object-contain"
            style={{ filter: "invert(1)" }}
          />
        ),
      };
    }
    return null;
  }, [isSteam, isEpic]);

  return (
    <div
      onClick={onClick}
      onContextMenu={onContextMenu}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="relative flex items-center justify-center cursor-pointer select-none"
      style={{ width: 172, height: 260, perspective: 1200 }}
    >
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

      <motion.div
        className="relative z-10 origin-center"
        style={{
          width: 156,
          height: 236,
          rotateX: isActive ? rotateX : 0,
          rotateY: isActive ? rotateY : 0,
          scale: isActive ? 1.05 : 0.87,
          transformStyle: "preserve-3d",
        }}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
      >
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
          <img
            src={image}
            alt={title}
            className="absolute inset-0 w-full h-full object-cover"
            loading="lazy"
            decoding="async"
          />

          <div
            className="absolute inset-0"
            style={{
              background: isActive
                ? "linear-gradient(180deg, rgba(0,0,0,0.05) 0%, rgba(0,0,0,0.12) 40%, rgba(0,0,0,0.75) 75%, rgba(0,0,0,0.96) 100%)"
                : "linear-gradient(180deg, rgba(0,0,0,0.24) 0%, rgba(0,0,0,0.36) 45%, rgba(0,0,0,0.82) 100%)",
            }}
          />

          {isActive && (
            <>
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  background:
                    "linear-gradient(135deg, rgba(255,255,255,0.15) 0%, transparent 50%)",
                  boxShadow: "inset 0 0 0 1px var(--game-color)",
                }}
              />
              <motion.div
                className="absolute inset-0 pointer-events-none z-20 mix-blend-overlay"
                style={{
                  background: "radial-gradient(circle at 50% 50%, rgba(255,255,255,0.8) 0%, transparent 60%)",
                  left: glareX,
                  top: glareY,
                  opacity: glareOpacity,
                  width: "200%",
                  height: "200%",
                  transform: "translate(-50%, -50%)",
                }}
              />
            </>
          )}

          <div className="absolute top-2.5 left-2.5 right-2.5 flex items-start justify-between z-30" style={{ transform: "translateZ(20px)" }}>
            {platformBadge && (
              <div
                className="flex items-center gap-1 px-2 py-0.5 rounded-full"
                style={{
                  background: "rgba(0,0,0,0.55)",
                  border: `1px solid ${platformBadge.border}`,
                  backdropFilter: "blur(4px)",
                }}
              >
                {platformBadge.icon}
                <span
                  className="text-[8px] font-black tracking-wider uppercase"
                  style={{ color: platformBadge.color }}
                >
                  {platformBadge.label}
                </span>
              </div>
            )}
            {!platformBadge && <div />}
            {isFavorite && (
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center"
                style={{
                  background: "rgba(251,191,36,0.15)",
                  border: "1px solid rgba(251,191,36,0.5)",
                  backdropFilter: "blur(4px)",
                }}
              >
                <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
              </div>
            )}
          </div>

          <div
            className={`absolute bottom-0 left-0 right-0 p-3 transition-all duration-400 z-30 ${
              isActive ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
            }`}
            style={{ transform: "translateZ(30px)" }}
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

          {isActive && (
            <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity duration-200 z-30" style={{ transform: "translateZ(40px)" }}>
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center"
                style={{
                  background: "rgba(255,255,255,0.12)",
                  border: "1.5px solid rgba(255,255,255,0.3)",
                  backdropFilter: "blur(8px)",
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
      </motion.div>
    </div>
  );
};

export default React.memo(GameCard);
