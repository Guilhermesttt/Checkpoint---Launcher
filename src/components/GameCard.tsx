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
  "radial-gradient(circle at top, rgba(255,255,255,0.08), rgba(255,255,255,0.02) 40%, rgba(5,5,7,0.98) 100%)";

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
  const [isFocused, setIsFocused] = React.useState(false);
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const visuallyActive = isActive || isFocused;

  const mouseXSpring = useSpring(x, { stiffness: 400, damping: 30 });
  const mouseYSpring = useSpring(y, { stiffness: 400, damping: 30 });

  const rotateX = useTransform(mouseYSpring, [-0.5, 0.5], ["10deg", "-10deg"]);
  const rotateY = useTransform(mouseXSpring, [-0.5, 0.5], ["-10deg", "10deg"]);

  const glareX = useTransform(mouseXSpring, [-0.5, 0.5], ["100%", "0%"]);
  const glareY = useTransform(mouseYSpring, [-0.5, 0.5], ["100%", "0%"]);
  const glareOpacity = useTransform(
    mouseXSpring,
    [-0.5, 0, 0.5],
    [0.4, 0, 0.4],
  );

  const handleMouseMove = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!visuallyActive || reduceMotion) return;

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
        background: "rgba(20, 24, 20, 0.6)",
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
        border: "rgba(255,255,255,0.2)",
        background: "rgba(15, 15, 15, 0.6)",
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
      aria-pressed={visuallyActive}
      tabIndex={0}
      data-game-card={true}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      className="group relative flex items-center justify-center rounded-2xl border-0 bg-transparent p-0 text-left select-none focus:outline-none"
      style={{
        width: CARD_FRAME_WIDTH,
        height: CARD_FRAME_HEIGHT,
        perspective: reduceMotion ? undefined : 1200,
      }}
    >
      {/* Glow externo quando ativo */}
      {visuallyActive && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.8 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="pointer-events-none absolute inset-0 rounded-2xl"
          style={{
            background: "var(--launcher-accent-soft, rgba(255,255,255,0.15))",
            filter: "blur(28px)",
            transform: "translateY(8px) scale(0.95)",
            zIndex: 0,
          }}
        />
      )}

      <motion.div
        className="relative z-10 origin-center"
        style={{
          width: CARD_WIDTH,
          height: CARD_HEIGHT,
          rotateX: visuallyActive && !reduceMotion ? rotateX : 0,
          rotateY: visuallyActive && !reduceMotion ? rotateY : 0,
          scale: visuallyActive ? 1.03 : 0.92,
          transformStyle: "preserve-3d",
        }}
        transition={
          reduceMotion
            ? { duration: 0.2 }
            : { type: "spring", stiffness: 350, damping: 25 }
        }
      >
        <div
          className={`relative h-full w-full overflow-hidden rounded-2xl bg-[#08080c] transition-all duration-400 ease-out transform group-hover:scale-[1.02] ${visuallyActive
              ? "shadow-[0_24px_56px_rgba(0,0,0,0.85),0_0_32px_rgba(255,255,255,0.15)] ring-2 ring-white/30"
              : "shadow-[0_8px_32px_rgba(0,0,0,0.5)] ring-1 ring-white/10 group-hover:shadow-[0_16px_48px_rgba(0,0,0,0.7),0_0_24px_var(--launcher-accent-soft,rgba(255,255,255,0.15))] group-hover:ring-white/20"
            }`}
          style={
            visuallyActive
              ? {
                boxShadow:
                  "0 24px 56px rgba(0,0,0,0.85), 0 0 0 1px rgba(255,255,255,0.25), 0 0 32px var(--launcher-accent-soft, rgba(255,255,255,0.2))",
              }
              : undefined
          }
        >
          {/* Borda interna premium */}
          <div
            className="pointer-events-none absolute inset-0 z-[1] rounded-2xl"
            style={{
              padding: 1,
              background: visuallyActive
                ? "linear-gradient(180deg, rgba(255,255,255,0.6) 0%, rgba(255,255,255,0.15) 30%, rgba(255,255,255,0.05) 100%)"
                : "linear-gradient(180deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.02) 100%)",
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
              <span className="line-clamp-3 text-sm font-semibold leading-snug text-white/80">
                {title}
              </span>
            </div>
          ) : (
            <img
              src={image}
              alt={title}
              className={`absolute inset-0 h-full w-full object-cover transition-transform ease-out ${visuallyActive && !reduceMotion
                  ? "scale-110 duration-[12000ms]"
                  : "scale-100 duration-500"
                }`}
              loading="lazy"
              decoding="async"
              draggable={false}
              referrerPolicy="no-referrer"
              onError={() => setFailedImageSrc(image)}
            />
          )}

          {/* Vinheta escura no fundo */}
          <div
            className="absolute inset-0 transition-colors duration-500"
            style={{
              background: visuallyActive
                ? "linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.05) 40%, rgba(0,0,0,0.85) 85%, rgba(0,0,0,0.98) 100%)"
                : "linear-gradient(180deg, rgba(0,0,0,0.05) 0%, rgba(0,0,0,0.3) 50%, rgba(0,0,0,0.8) 100%)",
            }}
          />

          {visuallyActive && (
            <>
              {/* Brilho varrendo o card */}
              {!reduceMotion && (
                <motion.div
                  initial={{ x: "-150%" }}
                  animate={{ x: "150%" }}
                  transition={{ duration: 0.9, ease: "easeInOut" }}
                  className="pointer-events-none absolute inset-0 z-20"
                  style={{
                    background:
                      "linear-gradient(115deg, transparent 20%, rgba(255,255,255,0.25) 50%, transparent 80%)",
                    mixBlendMode: "overlay",
                  }}
                />
              )}

              {/* Reflexo estático superior */}
              <div
                className="pointer-events-none absolute inset-0 z-10"
                style={{
                  background:
                    "linear-gradient(135deg, rgba(255,255,255,0.15) 0%, transparent 45%)",
                }}
              />

              {/* Brilho dinâmico do mouse */}
              {!reduceMotion && (
                <motion.div
                  className="pointer-events-none absolute inset-0 z-20 mix-blend-overlay"
                  style={{
                    background:
                      "radial-gradient(circle at 50% 50%, rgba(255,255,255,0.9) 0%, transparent 55%)",
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
            className="absolute left-3 right-3 top-3 z-30 flex items-start justify-between"
            style={{ transform: "translateZ(20px)" }}
          >
            {platformBadge ? (
              <div
                className="flex items-center gap-1.5 rounded-full px-2.5 py-1 shadow-md"
                style={{
                  background: platformBadge.background,
                  border: `1px solid ${platformBadge.border}`,
                  backdropFilter: "blur(12px)",
                }}
              >
                {platformBadge.icon}
                <span
                  className="text-[9px] font-bold uppercase tracking-widest drop-shadow-sm"
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
                className="flex h-[26px] w-[26px] items-center justify-center rounded-full shadow-md"
                style={{
                  background: "rgba(251,191,36,0.15)",
                  border: "1px solid rgba(251,191,36,0.4)",
                  backdropFilter: "blur(12px)",
                }}
              >
                <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400 drop-shadow-[0_0_4px_rgba(251,191,36,0.6)]" />
              </div>
            )}
          </div>

          <div
            className={`absolute bottom-0 left-0 right-0 z-30 px-4 pb-4 pt-12 transition-all duration-500 ease-out bg-gradient-to-t from-[#050507] via-black/60 to-transparent ${visuallyActive ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0 group-hover:translate-y-0 group-hover:opacity-100"
              }`}
            style={{ transform: "translateZ(30px)" }}
          >
            <p className="mb-1 text-[8.5px] font-bold uppercase tracking-[0.25em] text-white/50 flex items-center gap-1.5">
              Iniciar
              {visuallyActive && (
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.8)]"></span>
                </span>
              )}
            </p>
            <h3 className="line-clamp-2 text-[13px] font-black leading-snug text-white tracking-wide drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]">
              {title}
            </h3>
          </div>

          {/* Botão Play central refinado */}
          <div
            className={`absolute inset-0 z-30 flex items-center justify-center transition-all duration-400 ease-out ${visuallyActive ? "opacity-100" : "opacity-0 group-hover:opacity-100"
              }`}
            style={{ transform: "translateZ(40px)" }}
          >
            <motion.div
              initial={reduceMotion ? false : { scale: visuallyActive ? 1 : 0.8, opacity: visuallyActive ? 1 : 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={
                reduceMotion
                  ? { duration: 0.2 }
                  : { type: "spring", stiffness: 400, damping: 25, delay: 0.05 }
              }
              className="group/play flex h-[52px] w-[52px] items-center justify-center rounded-full shadow-[0_8px_32px_rgba(0,0,0,0.5)] backdrop-blur-md bg-white/10 border border-white/20 transition-all duration-300 hover:scale-110 hover:bg-white/25 hover:border-white/40 cursor-pointer"
            >
              <Play
                className="h-5 w-5 fill-white text-white drop-shadow-md transition-transform duration-300 group-hover/play:scale-105"
                style={{ marginLeft: 3 }}
              />
            </motion.div>
          </div>
        </div>

        {visuallyActive && (
          <div
            className="absolute -bottom-4 left-1/2 h-1 -translate-x-1/2 rounded-full opacity-60"
            style={{
              width: 40,
              background:
                "linear-gradient(90deg, transparent, var(--launcher-accent-soft, rgba(255,255,255,0.8)), transparent)",
              filter: "blur(2px)",
            }}
          />
        )}
      </motion.div>
    </button>
  );
};

export default React.memo(GameCard);