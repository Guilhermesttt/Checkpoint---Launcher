import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Gamepad2, Play, Star } from "lucide-react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSteam } from "@fortawesome/free-brands-svg-icons";
import { EPIC_GAMES_ICON_PATH } from "../constants/assets";
import {
  EaBrandIcon,
  UbisoftBrandIcon,
  GogBrandIcon,
  XboxBrandIcon,
  RiotBrandIcon,
  BattlenetBrandIcon,
  RockstarBrandIcon,
} from "./Sidebar";

interface GameCardProps {
  title: string;
  image: string;
  isActive?: boolean;
  onClick?: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  isFavorite?: boolean;
  isSteam?: boolean;
  isEpic?: boolean;
  launcherType?: string;
  steamAppId?: string;
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
  launcherType,
  steamAppId,
}) => {
  const [currentImageSrc, setCurrentImageSrc] = useState<string>("");
  const [hasAllFailed, setHasAllFailed] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    const initial =
      image ||
      (steamAppId
        ? `https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/${steamAppId}/library_600x900_2x.jpg`
        : "");
    setCurrentImageSrc(initial);
    setHasAllFailed(!initial);
  }, [image, steamAppId]);

  const handleImageError = useCallback(() => {
    if (steamAppId) {
      if (currentImageSrc.includes("library_600x900_2x.jpg")) {
        setCurrentImageSrc(`https://cdn.akamai.steamstatic.com/steam/apps/${steamAppId}/header.jpg`);
        return;
      }
      if (currentImageSrc.includes("header.jpg")) {
        setCurrentImageSrc(
          `https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/${steamAppId}/library_600x900.jpg`,
        );
        return;
      }
    }
    setHasAllFailed(true);
  }, [currentImageSrc, steamAppId]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLButtonElement>) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onClick?.();
      }
    },
    [onClick],
  );

  const visuallyActive = isActive || isFocused;

  const platformBadge = useMemo(() => {
    const type = (launcherType || "").toLowerCase() || (isSteam ? "steam" : isEpic ? "epic" : "local");
    if (type === "steam") {
      return {
        label: "Steam",
        color: "#66C0F4",
        border: "rgba(102,192,244,0.3)",
        background: "rgba(20,30,45,0.75)",
        icon: <FontAwesomeIcon icon={faSteam} className="h-2.5 w-2.5 text-[#66C0F4]" />,
      };
    }

    if (type === "epic") {
      return {
        label: "Epic",
        color: "#f5f5f5",
        border: "rgba(255,255,255,0.2)",
        background: "rgba(15, 15, 15, 0.7)",
        icon: (
          <img
            src={EPIC_GAMES_ICON_PATH}
            alt=""
            className="h-2.5 w-2.5 object-contain invert"
            referrerPolicy="no-referrer"
            draggable={false}
          />
        ),
      };
    }

    if (type === "ea") {
      return {
        label: "EA",
        color: "#f87171",
        border: "rgba(239,68,68,0.35)",
        background: "rgba(127,29,29,0.7)",
        icon: <EaBrandIcon className="h-2.5 w-2.5 text-red-400" />,
      };
    }

    if (type === "ubisoft") {
      return {
        label: "Ubisoft",
        color: "#22d3ee",
        border: "rgba(6,182,212,0.35)",
        background: "rgba(22,78,99,0.7)",
        icon: <UbisoftBrandIcon className="h-2.5 w-2.5 text-cyan-400" />,
      };
    }

    if (type === "gog") {
      return {
        label: "GOG",
        color: "#c084fc",
        border: "rgba(168,85,247,0.35)",
        background: "rgba(88,28,135,0.7)",
        icon: <GogBrandIcon className="h-2.5 w-2.5 text-purple-400" />,
      };
    }

    if (type === "xbox") {
      return {
        label: "Xbox",
        color: "#34d399",
        border: "rgba(16,185,129,0.35)",
        background: "rgba(6,78,59,0.7)",
        icon: <XboxBrandIcon className="h-2.5 w-2.5 text-emerald-400" />,
      };
    }

    if (type === "riot") {
      return {
        label: "Riot",
        color: "#fb7185",
        border: "rgba(244,63,94,0.35)",
        background: "rgba(136,19,55,0.7)",
        icon: <RiotBrandIcon className="h-2.5 w-2.5 text-rose-400" />,
      };
    }

    if (type === "battlenet") {
      return {
        label: "B.net",
        color: "#38bdf8",
        border: "rgba(14,165,233,0.35)",
        background: "rgba(12,74,110,0.7)",
        icon: <BattlenetBrandIcon className="h-2.5 w-2.5 text-sky-400" />,
      };
    }

    if (type === "rockstar") {
      return {
        label: "Rockstar",
        color: "#fbbf24",
        border: "rgba(245,158,11,0.35)",
        background: "rgba(120,53,15,0.7)",
        icon: <RockstarBrandIcon className="h-2.5 w-2.5 text-amber-400" />,
      };
    }

    return {
      label: "Local",
      color: "#a7f3d0",
      border: "rgba(52,211,153,0.3)",
      background: "rgba(6,78,59,0.6)",
      icon: <Gamepad2 className="h-2.5 w-2.5 text-emerald-400" />,
    };
  }, [isEpic, isSteam, launcherType]);

  return (
    <button
      type="button"
      onClick={onClick}
      onKeyDown={handleKeyDown}
      onContextMenu={onContextMenu}
      aria-label={title}
      aria-pressed={visuallyActive}
      tabIndex={0}
      data-game-card={true}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      className="group relative flex items-center justify-center rounded-2xl border-0 bg-transparent p-0 text-left select-none focus:outline-none cursor-pointer"
      style={{
        width: CARD_FRAME_WIDTH,
        height: CARD_FRAME_HEIGHT,
      }}
    >
      <div
        className={`relative overflow-hidden rounded-2xl bg-[#0a0a0f] transition-all duration-200 ease-out will-change-transform ${visuallyActive
            ? "scale-[1.05] -translate-y-2 z-20"
            : "scale-95 opacity-80 hover:opacity-100 hover:scale-[1.01] hover:-translate-y-1 hover:shadow-[0_10px_28px_rgba(0,0,0,0.6)] ring-1 ring-white/10 hover:ring-white/25 z-10"
          }`}
        style={{
          width: CARD_WIDTH,
          height: CARD_HEIGHT,
          boxShadow: visuallyActive
            ? "0 0 0 2.5px var(--game-color, rgba(255, 255, 255, 0.95)), 0 16px 44px rgba(0, 0, 0, 0.9), 0 0 32px var(--game-color, rgba(255, 255, 255, 0.45))"
            : undefined,
        }}
      >
        {/* Cover image or fallback */}
        {hasAllFailed ? (
          <div
            className="absolute inset-0 flex items-end p-3.5"
            style={{ background: FALLBACK_CARD_BACKGROUND }}
          >
            <span className="line-clamp-3 text-xs font-semibold leading-snug text-white/80">
              {title}
            </span>
          </div>
        ) : (
          <img
            src={currentImageSrc}
            alt={title}
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 ease-out group-hover:scale-105"
            loading="lazy"
            decoding="async"
            draggable={false}
            onError={handleImageError}
          />
        )}

        {/* Dark Vignette & gradient for contrast */}
        <div
          className={`absolute inset-0 transition-opacity duration-200 ${visuallyActive
              ? "bg-gradient-to-t from-black/95 via-black/40 to-transparent opacity-100"
              : "bg-gradient-to-t from-black/85 via-black/20 to-transparent opacity-80 group-hover:opacity-95"
            }`}
        />

        {/* Top Badges (Platform + Favorite) */}
        <div className="absolute left-2.5 right-2.5 top-2.5 z-20 flex items-center justify-between pointer-events-none">
          {platformBadge ? (
            <div
              className="flex items-center gap-1.5 rounded-md px-2 py-0.5 shadow-sm backdrop-blur-md"
              style={{
                background: platformBadge.background,
                border: `1px solid ${platformBadge.border}`,
              }}
            >
              {platformBadge.icon}
              <span
                className="text-[10px] font-bold uppercase tracking-wider"
                style={{ color: platformBadge.color }}
              >
                {platformBadge.label}
              </span>
            </div>
          ) : (
            <div />
          )}

          {isFavorite && (
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-amber-500/20 border border-amber-400/40 backdrop-blur-md shadow-sm">
              <Star className="h-3 w-3 fill-amber-400 text-amber-400 drop-shadow-[0_0_4px_rgba(251,191,36,0.6)]" />
            </div>
          )}
        </div>

        {/* Bottom Title & Play action */}
        <div
          className={`absolute bottom-0 left-0 right-0 z-20 p-3 transition-all duration-200 ease-out ${visuallyActive ? "translate-y-0 opacity-100" : "translate-y-1 opacity-90 group-hover:translate-y-0 group-hover:opacity-100"
            }`}
        >
          {visuallyActive && (
            <div
              className="mb-1 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest drop-shadow-sm"
              style={{ color: "var(--game-color, #10b981)" }}
            >
              <span className="relative flex h-1.5 w-1.5">
                <span
                  className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
                  style={{ background: "var(--game-color, #10b981)" }}
                />
                <span
                  className="relative inline-flex rounded-full h-1.5 w-1.5"
                  style={{ background: "var(--game-color, #10b981)" }}
                />
              </span>
              Jogar
            </div>
          )}
          <h3 className="line-clamp-2 text-xs font-bold leading-snug text-white tracking-wide drop-shadow-md">
            {title}
          </h3>
        </div>

        {/* Refined clean Play Button on active */}
        {visuallyActive && (
          <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
            <div
              className="flex h-11 w-11 items-center justify-center rounded-full backdrop-blur-md shadow-[0_6px_20px_rgba(0,0,0,0.6)] transition-transform duration-200 group-hover:scale-110"
              style={{
                background: "rgba(0, 0, 0, 0.4)",
                border: "1.5px solid var(--game-color, rgba(255, 255, 255, 0.7))",
                boxShadow: "0 0 24px var(--game-color, rgba(255, 255, 255, 0.35))",
              }}
            >
              <Play className="h-4 w-4 fill-white text-white ml-0.5" />
            </div>
          </div>
        )}
      </div>
    </button>
  );
};

export default React.memo(GameCard);
