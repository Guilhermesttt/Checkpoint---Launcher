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

// Fallback usado sempre que --game-color não estiver definido no elemento.
// Sem isso, um var() inválido invalida a propriedade box-shadow INTEIRA
// (não só o trecho da cor) — o card perde até o anel branco e a sombra base.
const GAME_COLOR_FALLBACK = "rgba(255,255,255,0.35)";
const gameColor = (extra = "") => `var(--game-color, ${GAME_COLOR_FALLBACK})${extra}`;

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
  const [isHovered, setIsHovered] = React.useState(false);
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const mouseXSpring = useSpring(x, { stiffness: 400, damping: 30 });
  const mouseYSpring = useSpring(y, { stiffness: 400, damping: 30 });

  const rotateX = useTransform(mouseYSpring, [-0.5, 0.5], ["12deg", "-12deg"]);
  const rotateY = useTransform(mouseXSpring, [-0.5, 0.5], ["-12deg", "12deg"]);

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

  const handleMouseEnter = () => setIsHovered(true);

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
    setIsHovered(false);
  };

  // Suporte a acessibilidade e navegação por gamepad/teclado
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick?.();
    }
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
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      onContextMenu={onContextMenu}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className="relative flex items-center justify-center cursor-pointer select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 rounded-2xl"
      style={{ width: 172, height: 260, perspective: 1200 }}
    >
      {/* 1. Ambient Glow Extravasado (Ambilight) */}
      {isActive && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.6 }}
          transition={{ duration: 0.4 }}
          className="absolute inset-0 rounded-2xl pointer-events-none"
          style={{
            background: gameColor(),
            filter: "blur(24px)",
            transform: "translateY(12px) scale(0.9)",
            zIndex: 0,
          }}
        />
      )}

      {/* 1b. Glow de borda pulsante — respiração de luz ao redor do card ativo */}
      {isActive && (
        <motion.div
          className="absolute rounded-[20px] pointer-events-none"
          style={{
            inset: -3,
            border: `2px solid ${gameColor()}`,
            boxShadow: `0 0 24px 2px ${gameColor()}`,
            zIndex: 1,
          }}
          animate={{ opacity: [0.35, 0.85, 0.35] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
        />
      )}

      {/* 1c. Glow sutil no hover para cards inativos — reforça affordance de clique */}
      {!isActive && isHovered && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="absolute inset-0 rounded-2xl pointer-events-none"
          style={{
            boxShadow: `0 0 0 1.5px ${gameColor(", 0 0 20px 0")} `,
            zIndex: 1,
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
          scale: isActive ? 1.05 : isHovered ? 0.9 : 0.87,
          transformStyle: "preserve-3d",
        }}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
      >
        <div
          className={`
            relative w-full h-full overflow-hidden rounded-2xl
            transition-shadow duration-300 bg-gray-900
            ${isActive
              ? "shadow-[0_0_0_2px_rgba(255,255,255,0.18),0_32px_64px_rgba(0,0,0,0.9)]"
              : "shadow-[0_8px_32px_rgba(0,0,0,0.6)]"
            }
          `}
          style={
            isActive
              ? {
                boxShadow: `0 0 0 2px rgba(255,255,255,0.18), 0 32px 64px rgba(0,0,0,0.9), 0 8px 32px ${gameColor()}`,
              }
              : {}
          }
        >
          {/* 2. Zoom Interno Contínuo (Breathe / Ken Burns) */}
          <img
            src={image}
            alt={title}
            className={`absolute inset-0 w-full h-full object-cover transition-transform ease-out ${isActive ? "scale-110 duration-[10000ms]" : "scale-100 duration-500"
              }`}
            loading="lazy"
            decoding="async"
          />

          <div
            className="absolute inset-0 transition-colors duration-500"
            style={{
              background: isActive
                ? "linear-gradient(180deg, rgba(0,0,0,0.02) 0%, rgba(0,0,0,0.12) 40%, rgba(0,0,0,0.85) 85%, rgba(0,0,0,0.95) 100%)"
                : "linear-gradient(180deg, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.25) 45%, rgba(0,0,0,0.7) 100%)",
            }}
          />

          {isActive && (
            <>
              {/* 3. Efeito Shimmer (Varredura de Luz) */}
              <motion.div
                initial={{ x: "-150%" }}
                animate={{ x: "150%" }}
                transition={{ duration: 0.7, ease: "easeInOut" }}
                className="absolute inset-0 z-20 pointer-events-none"
                style={{
                  background: "linear-gradient(115deg, transparent 20%, rgba(255,255,255,0.3) 50%, transparent 80%)",
                  mixBlendMode: "overlay",
                }}
              />

              <div
                className="absolute inset-0 pointer-events-none z-10"
                style={{
                  background: "linear-gradient(135deg, rgba(255,255,255,0.15) 0%, transparent 50%)",
                  boxShadow: `inset 0 0 0 1px ${gameColor()}`,
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
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full"
                style={{
                  background: "rgba(0,0,0,0.4)",
                  border: `1px solid ${platformBadge.border}`,
                  backdropFilter: "blur(8px)",
                }}
              >
                {platformBadge.icon}
                <span
                  className="text-[10px] font-bold tracking-widest uppercase"
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
                  backdropFilter: "blur(8px)",
                }}
              >
                <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
              </div>
            )}
          </div>

          <div
            className={`absolute bottom-0 left-0 right-0 p-4 transition-all duration-400 z-30 ${isActive ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
              }`}
            style={{ transform: "translateZ(30px)" }}
          >
            <p
              className="text-[10px] font-bold uppercase tracking-[0.2em] mb-1.5 text-white/60"
            >
              Iniciar
            </p>
            <h3 className="text-sm font-bold text-white leading-snug line-clamp-2">
              {title}
            </h3>
          </div>

          {/* O Play foi ajustado para ficar sempre visível de forma sutil quando ativo, não precisando de hover para indicar a ação */}
          {isActive && (
            <div className="absolute inset-0 flex items-center justify-center opacity-100 transition-opacity duration-300 z-30" style={{ transform: "translateZ(40px)" }}>
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 400, damping: 25, delay: 0.1 }}
                className="w-14 h-14 rounded-full flex items-center justify-center shadow-2xl"
                style={{
                  background: "rgba(255,255,255,0.15)",
                  border: "1.5px solid rgba(255,255,255,0.4)",
                  backdropFilter: "blur(12px)",
                }}
              >
                <Play
                  className="w-6 h-6 text-white fill-white"
                  style={{ marginLeft: 3 }}
                />
              </motion.div>
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