import React from "react";
import { Play, Star } from "lucide-react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSteam } from "@fortawesome/free-brands-svg-icons";
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from "framer-motion";
import { EPIC_GAMES_ICON_PATH } from "../constants/assets";

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

const CARD_FRAME_WIDTH = 172;
const CARD_FRAME_HEIGHT = 260;
const CARD_WIDTH = 156;
const CARD_HEIGHT = 236;
const FALLBACK_CARD_BACKGROUND =
  "radial-gradient(circle at top, rgba(255,255,255,0.12), rgba(255,255,255,0.04) 35%, rgba(5,5,7,0.96) 100%)";

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
  const reduceMotion = useReducedMotion();
  const [failedImageSrc, setFailedImageSrc] = React.useState<string | null>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const mouseXSpring = useSpring(x, { stiffness: 400, damping: 30 });
  const mouseYSpring = useSpring(y, { stiffness: 400, damping: 30 });

  const rotateX = useTransform(mouseYSpring, [-0.5, 0.5], ["12deg", "-12deg"]);
  const rotateY = useTransform(mouseXSpring, [-0.5, 0.5], ["-12deg", "12deg"]);

  const glareX = useTransform(mouseXSpring, [-0.5, 0.5], ["100%", "0%"]);
  const glareY = useTransform(mouseYSpring, [-0.5, 0.5], ["100%", "0%"]);
  const glareOpacity = useTransform(
    mouseXSpring,
    [-0.5, 0, 0.5],
    [0.3, 0, 0.3],
  );

  const handleMouseMove = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!isActive || reduceMotion) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    x.set(mouseX / rect.width - 0.5);
    y.set(mouseY / rect.height - 0.5);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === "Enter" || e.key === " ") {
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
        icon: (
          <FontAwesomeIcon
            icon={faSteam}
            className="h-2.5 w-2.5"
            style={{ color: "#67b676" }}
          />
        ),
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
            className="h-2.5 w-2.5 object-contain"
            style={{ filter: "invert(1)" }}
            referrerPolicy="no-referrer"
            draggable={false}
          />
        ),
      };
    }

    return null;
  }, [isEpic, isSteam]);

  const hasImageError = failedImageSrc === image;

  return (
    <button
      type="button"
      onClick={onClick}
      onKeyDown={handleKeyDown}
      onContextMenu={onContextMenu}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      aria-label={title}
      aria-pressed={isActive}
      className="group relative flex items-center justify-center rounded-2xl border-0 bg-transparent p-0 text-left select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
      style={{
        width: CARD_FRAME_WIDTH,
        height: CARD_FRAME_HEIGHT,
        perspective: reduceMotion ? undefined : 1200,
      }}
    >
      {isActive && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.6 }}
          transition={{ duration: 0.4 }}
          className="pointer-events-none absolute inset-0 rounded-2xl"
          style={{
            background: "var(--launcher-accent-soft, rgba(255,255,255,0.18))",
            filter: "blur(24px)",
            transform: "translateY(12px) scale(0.9)",
            zIndex: 0,
          }}
        />
      )}

      <motion.div
        className="relative z-10 origin-center"
        style={{
          width: CARD_WIDTH,
          height: CARD_HEIGHT,
          rotateX: isActive && !reduceMotion ? rotateX : 0,
          rotateY: isActive && !reduceMotion ? rotateY : 0,
          scale: isActive ? 1.02 : 0.9,
          transformStyle: "preserve-3d",
        }}
        transition={
          reduceMotion
            ? { duration: 0.18 }
            : { type: "spring", stiffness: 300, damping: 20 }
        }
      >
        <div
          className={`relative h-full w-full overflow-hidden rounded-2xl bg-gray-900 transition-all duration-300 ease-out transform group-hover:scale-105 group-hover:ring-2 group-hover:ring-orange-500/50 ${isActive
              ? "shadow-[0_20px_48px_rgba(0,0,0,0.78),0_0_20px_rgba(255,255,255,0.15)] ring-2 ring-white/20"
              : "shadow-[0_8px_32px_rgba(0,0,0,0.6)] group-hover:shadow-[0_12px_40px_rgba(0,0,0,0.8),0_0_15px_rgba(255,165,0,0.15)]"
            }`}
          style={
            isActive
              ? {
                boxShadow:
                  "0 20px 48px rgba(0,0,0,0.78), 0 0 0 1px rgba(255,255,255,0.22), 0 0 28px var(--launcher-accent-soft, rgba(255,255,255,0.2))",
              }
              : undefined
          }
        >
          <div
            className="pointer-events-none absolute inset-0 z-[1] rounded-2xl"
            style={{
              padding: 1,
              background: isActive
                ? "linear-gradient(180deg, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0.12) 30%, rgba(255,255,255,0.08) 100%)"
                : "linear-gradient(180deg, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0.02) 100%)",
              WebkitMask:
                "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
              WebkitMaskComposite: "xor",
              maskComposite: "exclude",
            }}
          />

          {hasImageError ? (
            <div
              className="absolute inset-0 flex items-end p-4"
              style={{ background: FALLBACK_CARD_BACKGROUND }}
            >
              <span className="line-clamp-3 text-sm font-semibold leading-snug text-white/90">
                {title}
              </span>
            </div>
          ) : (
            <img
              src={image}
              alt={title}
              className={`absolute inset-0 h-full w-full object-cover transition-transform ease-out ${isActive && !reduceMotion
                  ? "scale-110 duration-[10000ms]"
                  : "scale-100 duration-500"
                }`}
              loading="lazy"
              decoding="async"
              draggable={false}
              referrerPolicy="no-referrer"
              onError={() => setFailedImageSrc(image)}
            />
          )}

          <div
            className="absolute inset-0 transition-colors duration-500"
            style={{
              background: isActive
                ? "linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.1) 35%, rgba(0,0,0,0.75) 75%, rgba(0,0,0,0.95) 100%)"
                : "linear-gradient(180deg, rgba(0,0,0,0.05) 0%, rgba(0,0,0,0.2) 45%, rgba(0,0,0,0.75) 100%)",
            }}
          />

          {isActive && (
            <>
              {!reduceMotion && (
                <motion.div
                  initial={{ x: "-150%" }}
                  animate={{ x: "150%" }}
                  transition={{ duration: 0.7, ease: "easeInOut" }}
                  className="pointer-events-none absolute inset-0 z-20"
                  style={{
                    background:
                      "linear-gradient(115deg, transparent 20%, rgba(255,255,255,0.3) 50%, transparent 80%)",
                    mixBlendMode: "overlay",
                  }}
                />
              )}

              <div
                className="pointer-events-none absolute inset-0 z-10"
                style={{
                  background:
                    "linear-gradient(135deg, rgba(255,255,255,0.12) 0%, transparent 48%)",
                  boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.12)",
                }}
              />

              {!reduceMotion && (
                <motion.div
                  className="pointer-events-none absolute inset-0 z-20 mix-blend-overlay"
                  style={{
                    background:
                      "radial-gradient(circle at 50% 50%, rgba(255,255,255,0.8) 0%, transparent 60%)",
                    left: glareX,
                    top: glareY,
                    opacity: glareOpacity,
                    width: "200%",
                    height: "200%",
                    transform: "translate(-50%, -50%)",
                  }}
                />
              )}
            </>
          )}

          <div
            className="absolute left-2.5 right-2.5 top-2.5 z-30 flex items-start justify-between"
            style={{ transform: "translateZ(20px)" }}
          >
            {platformBadge ? (
              <div
                className="flex items-center gap-1.5 rounded-full px-2.5 py-1"
                style={{
                  background: "rgba(0,0,0,0.4)",
                  border: `1px solid ${platformBadge.border}`,
                  backdropFilter: "blur(8px)",
                }}
              >
                {platformBadge.icon}
                <span
                  className="text-[10px] font-bold uppercase tracking-widest"
                  style={{ color: platformBadge.color }}
                >
                  {platformBadge.label}
                </span>
              </div>
            ) : (
              <div />
            )}

            {isFavorite && (
              <div
                className="flex h-6 w-6 items-center justify-center rounded-full"
                style={{
                  background: "rgba(251,191,36,0.15)",
                  border: "1px solid rgba(251,191,36,0.5)",
                  backdropFilter: "blur(8px)",
                }}
              >
                <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
              </div>
            )}
          </div>

          {/* NOVO: Layout cinematográfico integrado de texto sem caixa sólida de fundo */}
          <div
            className={`absolute bottom-0 left-0 right-0 z-30 px-3.5 pb-4 pt-10 transition-all duration-400 bg-gradient-to-t from-black/95 via-black/50 to-transparent backdrop-blur-2xs ${isActive ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100"
              }`}
            style={{ transform: "translateZ(30px)" }}
          >
            <p className="mb-1 text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-400 flex items-center gap-1.5">
              Iniciar
              {isActive && (
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                </span>
              )}
            </p>
            <h3 className="line-clamp-2 text-xs font-bold leading-snug text-white tracking-wide drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)]">
              {title}
            </h3>
          </div>

          <div
            className={`absolute inset-0 z-30 flex items-center justify-center transition-opacity duration-300 ${isActive ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
            style={{ transform: "translateZ(40px)" }}
          >
            <motion.div
              initial={reduceMotion ? false : { scale: isActive ? 1 : 0.8, opacity: isActive ? 1 : 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={
                reduceMotion
                  ? { duration: 0.18 }
                  : { type: "spring", stiffness: 400, damping: 25, delay: 0.1 }
              }
              className="flex h-14 w-14 items-center justify-center rounded-full shadow-2xl backdrop-blur-xl bg-white/10 border border-white/20"
            >
              <div
                className="absolute inset-0 rounded-full bg-white opacity-0 transition-opacity duration-300 group-hover:opacity-10"
              />
              <Play
                className="h-6 w-6 fill-white text-white"
                style={{ marginLeft: 3 }}
              />
            </motion.div>
          </div>
        </div>

        {isActive && (
          <div
            className="absolute -bottom-3 left-1/2 h-0.5 -translate-x-1/2 rounded-full"
            style={{
              width: 32,
              background:
                "linear-gradient(90deg, transparent, rgba(255,255,255,0.8), transparent)",
            }}
          />
        )}
      </motion.div>
    </button>
  );
};

export default React.memo(GameCard);