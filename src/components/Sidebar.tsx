import React, { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  User,
  Star,
  Gamepad2,
  Zap,
  Car,
  Swords,
  Trophy,
  Globe,
  Crosshair,
  Settings,
  Users,
  Newspaper,
  Laptop,
  Puzzle,
} from "lucide-react";
import {
  GamepadIcon as AnimatedGamepadIcon,
  LaptopIcon as AnimatedLaptopIcon,
  RadioIcon as AnimatedRadioIcon,
  SettingsIcon as AnimatedSettingsIcon,
  StarIcon as AnimatedStarIcon,
  UserIcon as AnimatedUserIcon,
  UsersIcon as AnimatedUsersIcon,
  type AnimatedIconHandle,
  type AnimatedIconProps,
} from "./animated/SidebarIcons";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSteam, faDiscord, faSpotify, faXbox } from "@fortawesome/free-brands-svg-icons";
import {
  EPIC_GAMES_ICON_PATH,
  EA_GAMES_ICON_PATH,
  UBISOFT_ICON_PATH,
  GOG_ICON_PATH,
  RIOT_GAMES_ICON_PATH,
  BATTLENET_ICON_PATH,
  ROCKSTAR_ICON_PATH,
} from "../constants/assets";
import type { SoundEffectType } from "../hooks/useSoundEffects";
import { usePreferences, type LauncherLanguage } from "../context/PreferencesContext";
import {
  SIDEBAR_NAVIGATION_GROUPS,
  SIDEBAR_NAVIGATION_ORDER,
} from "../services/launcherNavigation";

export const SteamBrandIcon: React.FC<{ className?: string; style?: React.CSSProperties }> = ({
  className,
  style,
}) => (
  <FontAwesomeIcon
    icon={faSteam}
    className={className}
    style={style as React.ComponentProps<typeof FontAwesomeIcon>["style"]}
  />
);

export const SpotifyBrandIcon: React.FC<{ className?: string; style?: React.CSSProperties }> = ({
  className,
  style,
}) => (
  <FontAwesomeIcon
    icon={faSpotify}
    className={className}
    style={style as React.ComponentProps<typeof FontAwesomeIcon>["style"]}
  />
);

export const DiscordBrandIcon: React.FC<{ className?: string; style?: React.CSSProperties }> = ({
  className,
  style,
}) => (
  <FontAwesomeIcon
    icon={faDiscord}
    className={className}
    style={style as React.ComponentProps<typeof FontAwesomeIcon>["style"]}
  />
);

export const EpicBrandIcon: React.FC<{ className?: string; style?: React.CSSProperties }> = ({
  className,
  style,
}) => {
  const { color, filter, ...restStyle } = style ?? {};

  return (
    <span
      role="img"
      aria-hidden="true"
      className={className}
      style={{
        ...restStyle,
        display: "inline-block",
        backgroundColor: (color as string) ?? "rgba(255,255,255,0.4)",
        WebkitMaskImage: `url(${EPIC_GAMES_ICON_PATH})`,
        maskImage: `url(${EPIC_GAMES_ICON_PATH})`,
        WebkitMaskSize: "contain",
        maskSize: "contain",
        WebkitMaskRepeat: "no-repeat",
        maskRepeat: "no-repeat",
        WebkitMaskPosition: "center",
        maskPosition: "center",
        filter: filter && filter !== "none" ? (filter as string) : undefined,
      }}
    />
  );
};

export const EaBrandIcon: React.FC<{ className?: string; style?: React.CSSProperties }> = ({
  className,
  style,
}) => {
  const { color, filter, ...restStyle } = style ?? {};

  return (
    <span
      role="img"
      aria-hidden="true"
      className={className}
      style={{
        ...restStyle,
        display: "inline-block",
        backgroundColor: (color as string) ?? "rgba(255,255,255,0.4)",
        WebkitMaskImage: `url(${EA_GAMES_ICON_PATH})`,
        maskImage: `url(${EA_GAMES_ICON_PATH})`,
        WebkitMaskSize: "contain",
        maskSize: "contain",
        WebkitMaskRepeat: "no-repeat",
        maskRepeat: "no-repeat",
        WebkitMaskPosition: "center",
        maskPosition: "center",
        filter: filter && filter !== "none" ? (filter as string) : undefined,
      }}
    />
  );
};

export const UbisoftBrandIcon: React.FC<{ className?: string; style?: React.CSSProperties }> = ({
  className,
  style,
}) => {
  const { color, filter, ...restStyle } = style ?? {};

  return (
    <span
      role="img"
      aria-hidden="true"
      className={className}
      style={{
        ...restStyle,
        display: "inline-block",
        backgroundColor: (color as string) ?? "rgba(255,255,255,0.4)",
        WebkitMaskImage: `url(${UBISOFT_ICON_PATH})`,
        maskImage: `url(${UBISOFT_ICON_PATH})`,
        WebkitMaskSize: "contain",
        maskSize: "contain",
        WebkitMaskRepeat: "no-repeat",
        maskRepeat: "no-repeat",
        WebkitMaskPosition: "center",
        maskPosition: "center",
        filter: filter && filter !== "none" ? (filter as string) : undefined,
      }}
    />
  );
};

export const GogBrandIcon: React.FC<{ className?: string; style?: React.CSSProperties }> = ({
  className,
  style,
}) => {
  const { color, filter, ...restStyle } = style ?? {};

  return (
    <span
      role="img"
      aria-hidden="true"
      className={className}
      style={{
        ...restStyle,
        display: "inline-block",
        backgroundColor: (color as string) ?? "rgba(255,255,255,0.4)",
        WebkitMaskImage: `url(${GOG_ICON_PATH})`,
        maskImage: `url(${GOG_ICON_PATH})`,
        WebkitMaskSize: "contain",
        maskSize: "contain",
        WebkitMaskRepeat: "no-repeat",
        maskRepeat: "no-repeat",
        WebkitMaskPosition: "center",
        maskPosition: "center",
        filter: filter && filter !== "none" ? (filter as string) : undefined,
      }}
    />
  );
};

export const XboxBrandIcon: React.FC<{ className?: string; style?: React.CSSProperties }> = ({
  className,
  style,
}) => (
  <FontAwesomeIcon
    icon={faXbox}
    className={className}
    style={style as React.ComponentProps<typeof FontAwesomeIcon>["style"]}
  />
);

export const RiotBrandIcon: React.FC<{ className?: string; style?: React.CSSProperties }> = ({
  className,
  style,
}) => {
  const { color, filter, ...restStyle } = style ?? {};

  return (
    <span
      role="img"
      aria-hidden="true"
      className={className}
      style={{
        ...restStyle,
        display: "inline-block",
        backgroundColor: (color as string) ?? "rgba(255,255,255,0.4)",
        WebkitMaskImage: `url(${RIOT_GAMES_ICON_PATH})`,
        maskImage: `url(${RIOT_GAMES_ICON_PATH})`,
        WebkitMaskSize: "contain",
        maskSize: "contain",
        WebkitMaskRepeat: "no-repeat",
        maskRepeat: "no-repeat",
        WebkitMaskPosition: "center",
        maskPosition: "center",
        filter: filter && filter !== "none" ? (filter as string) : undefined,
      }}
    />
  );
};

export const BattlenetBrandIcon: React.FC<{ className?: string; style?: React.CSSProperties }> = ({
  className,
  style,
}) => {
  const { color, filter, ...restStyle } = style ?? {};

  return (
    <span
      role="img"
      aria-hidden="true"
      className={className}
      style={{
        ...restStyle,
        display: "inline-block",
        backgroundColor: (color as string) ?? "rgba(255,255,255,0.4)",
        WebkitMaskImage: `url(${BATTLENET_ICON_PATH})`,
        maskImage: `url(${BATTLENET_ICON_PATH})`,
        WebkitMaskSize: "contain",
        maskSize: "contain",
        WebkitMaskRepeat: "no-repeat",
        maskRepeat: "no-repeat",
        WebkitMaskPosition: "center",
        maskPosition: "center",
        filter: filter && filter !== "none" ? (filter as string) : undefined,
      }}
    />
  );
};

export const RockstarBrandIcon: React.FC<{ className?: string; style?: React.CSSProperties }> = ({
  className,
  style,
}) => {
  const { color, filter, ...restStyle } = style ?? {};

  return (
    <span
      role="img"
      aria-hidden="true"
      className={className}
      style={{
        ...restStyle,
        display: "inline-block",
        backgroundColor: (color as string) ?? "rgba(255,255,255,0.4)",
        WebkitMaskImage: `url(${ROCKSTAR_ICON_PATH})`,
        maskImage: `url(${ROCKSTAR_ICON_PATH})`,
        WebkitMaskSize: "contain",
        maskSize: "contain",
        WebkitMaskRepeat: "no-repeat",
        maskRepeat: "no-repeat",
        WebkitMaskPosition: "center",
        maskPosition: "center",
        filter: filter && filter !== "none" ? (filter as string) : undefined,
      }}
    />
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const CATEGORIES = [
  { id: "ALL", label: "Todos", Icon: Gamepad2, AnimatedIcon: AnimatedGamepadIcon },
  { id: "FAVORITES", label: "Favoritos", Icon: Star, AnimatedIcon: AnimatedStarIcon },
  { id: "FRIENDS", label: "Amigos", Icon: Users, AnimatedIcon: AnimatedUsersIcon },
  { id: "FEED", label: "Radar", Icon: Newspaper, AnimatedIcon: AnimatedRadioIcon },
  { id: "SPOTIFY", label: "Spotify", Icon: SpotifyBrandIcon },
  { id: "MODS", label: "Mods", Icon: Puzzle },
  { id: "STEAM", label: "Steam", Icon: SteamBrandIcon },
  { id: "EPIC", label: "Epic", Icon: EpicBrandIcon },
  { id: "EA", label: "EA App", Icon: EaBrandIcon },
  { id: "UBISOFT", label: "Ubisoft", Icon: UbisoftBrandIcon },
  { id: "GOG", label: "GOG", Icon: GogBrandIcon },
  { id: "XBOX", label: "Xbox", Icon: XboxBrandIcon },
  { id: "RIOT", label: "Riot Games", Icon: RiotBrandIcon },
  { id: "BATTLENET", label: "Battle.net", Icon: BattlenetBrandIcon },
  { id: "ROCKSTAR", label: "Rockstar", Icon: RockstarBrandIcon },
  { id: "LOCAL", label: "Local", Icon: Laptop, AnimatedIcon: AnimatedLaptopIcon },
  { id: "PROFILE", label: "Perfil", Icon: User, AnimatedIcon: AnimatedUserIcon },
  { id: "RACING", label: "Corrida", Icon: Car },
  { id: "ROLEPLAYING", label: "RPG", Icon: Swords },
  { id: "SPORTS", label: "Esportes", Icon: Trophy },
  { id: "ONLINE", label: "Online", Icon: Globe },
  { id: "SHOOTER", label: "Tiro", Icon: Crosshair },
  { id: "ACTION", label: "Ação", Icon: Gamepad2 },
  { id: "ADVENTURE", label: "Aventura", Icon: Gamepad2 },
  { id: "HORROR", label: "Terror", Icon: Zap },
  { id: "STRATEGY", label: "Estratégia", Icon: Trophy },
  { id: "FIGHTING", label: "Luta", Icon: Swords },
];

// eslint-disable-next-line react-refresh/only-export-components
export const SIDEBAR_CATEGORIES = CATEGORIES.filter(({ id }) =>
  SIDEBAR_NAVIGATION_ORDER.includes(id as (typeof SIDEBAR_NAVIGATION_ORDER)[number]),
).sort(
  (left, right) => SIDEBAR_NAVIGATION_ORDER.indexOf(left.id as (typeof SIDEBAR_NAVIGATION_ORDER)[number])
    - SIDEBAR_NAVIGATION_ORDER.indexOf(right.id as (typeof SIDEBAR_NAVIGATION_ORDER)[number]),
);

interface SidebarProps {
  activeCategory: string;
  onCategory: (id: string) => void;
  settingsLabel: string;
  playSound: (t: SoundEffectType) => void;
  notificationCount?: number;
  language?: LauncherLanguage;
  userDisplay?: string;
  userAvatar?: string;
}

interface SidebarButtonProps {
  id: string;
  label: string;
  Icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  AnimatedIcon?: AnimatedSidebarIcon;
  active: boolean;
  onClick: () => void;
  notificationCount?: number;
  reducedMotion?: boolean;
  rotateOnHover?: boolean;
  isExpanded?: boolean;
}

type AnimatedSidebarIcon = React.ForwardRefExoticComponent<
  AnimatedIconProps & React.RefAttributes<AnimatedIconHandle>
>;

const SidebarButton: React.FC<SidebarButtonProps> = ({
  id,
  label,
  Icon,
  AnimatedIcon,
  active,
  onClick,
  notificationCount = 0,
  reducedMotion = false,
  rotateOnHover = false,
  isExpanded = true,
}) => {
  const hasNotifications = notificationCount > 0;
  const animatedIconRef = React.useRef<AnimatedIconHandle>(null);
  const animationTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => () => {
    if (animationTimerRef.current) {
      clearTimeout(animationTimerRef.current);
    }
  }, []);

  const playIconAnimation = () => {
    if (!AnimatedIcon || reducedMotion || animationTimerRef.current) return;

    animatedIconRef.current?.startAnimation();
    animationTimerRef.current = setTimeout(() => {
      animatedIconRef.current?.stopAnimation();
      animationTimerRef.current = null;
    }, 1_300);
  };

  const iconStyle = {
    color: active ? "rgb(var(--launcher-accent))" : "rgba(255,255,255,0.45)",
    filter: active ? "drop-shadow(0 0 6px rgb(var(--launcher-accent) / 0.5))" : "none",
  };

  const buttonContent = (
    <motion.button
      onClick={onClick}
      onMouseEnter={playIconAnimation}
      aria-label={hasNotifications ? `${label}, ${notificationCount} notificacoes` : label}
      aria-current={active ? "page" : undefined}
      data-sidebar-item={id}
      data-notification-count={notificationCount}
      className={`relative group flex cursor-pointer items-center transition-all duration-300 ease-out
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--launcher-accent))] focus-visible:ring-offset-2 focus-visible:ring-offset-black
        ${isExpanded ? "w-full h-11 px-3.5 gap-3.5 rounded-xl text-left" : "h-12 w-12 justify-center rounded-2xl"}
        ${!active ? "hover:bg-white/[0.07]" : ""}`}
      style={{
        background: active ? "var(--launcher-accent-soft)" : "transparent",
        boxShadow: active
          ? "0 4px 24px -2px rgb(var(--launcher-accent) / 0.25), inset 0 0 0 1px rgb(var(--launcher-accent) / 0.2)"
          : "none",
      }}
    >
      {/* Indicador de item ativo */}
      {active && (
        <motion.div
          layoutId="sb-active"
          className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 rounded-r-full shadow-[0_0_10px_rgb(var(--launcher-accent))]"
          style={{ background: "rgb(var(--launcher-accent))" }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
        />
      )}

      {/* Ícone */}
      <motion.div
        whileTap={{ scale: 0.88 }}
        className={`shrink-0 transform transition-transform duration-300 ${
          AnimatedIcon ? "" : "group-hover:scale-110"
        } ${rotateOnHover && !AnimatedIcon ? "group-hover:rotate-45" : ""}`}
      >
        {AnimatedIcon ? (
          <AnimatedIcon
            ref={animatedIconRef}
            size={isExpanded ? 20 : 24}
            duration={1}
            className={`${isExpanded ? "h-5 w-5" : "h-6 w-6"} transition-colors duration-300`}
            style={iconStyle}
          />
        ) : (
          <Icon
            className={`${isExpanded ? "h-5 w-5" : "h-6 w-6"} transition-colors duration-300`}
            style={iconStyle}
          />
        )}
      </motion.div>

      {/* Rótulo e Badge quando expandido */}
      {isExpanded && (
        <div className="flex flex-1 items-center justify-between min-w-0">
          <span
            className={`truncate text-sm font-semibold transition-colors duration-300 ${
              active ? "text-white font-bold" : "text-white/70 group-hover:text-white"
            }`}
          >
            {label}
          </span>
          {hasNotifications && (
            <div className="relative flex items-center justify-center">
              <motion.span
                animate={{ scale: [1, 1.35, 1], opacity: [0.7, 0, 0.7] }}
                transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
                className="absolute inset-0 rounded-full bg-[rgb(var(--launcher-accent))]"
              />
              <motion.span
                key={notificationCount}
                initial={{ scale: 1.5, rotate: -12 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 400, damping: 15 }}
                className="relative z-10 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[rgb(var(--launcher-accent))] px-1.5 text-[10px] font-black text-black shadow-[0_0_12px_rgb(var(--launcher-accent)/0.8)]"
              >
                {notificationCount > 99 ? "99+" : notificationCount}
              </motion.span>
            </div>
          )}
        </div>
      )}

      {/* Badge quando colapsado */}
      {!isExpanded && hasNotifications && (
        <div className="absolute -right-1 -top-1 z-20 flex items-center justify-center">
          <motion.span
            animate={{ scale: [1, 1.4, 1], opacity: [0.8, 0, 0.8] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
            className="absolute inset-0 rounded-full bg-[rgb(var(--launcher-accent))]"
          />
          <motion.span
            key={notificationCount}
            initial={{ scale: 1.5 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 400, damping: 15 }}
            className="relative z-10 flex h-5 min-w-[20px] items-center justify-center rounded-full border border-black/50 bg-[rgb(var(--launcher-accent))] px-1 text-[10px] font-black text-black shadow-[0_0_12px_rgb(var(--launcher-accent)/0.9)]"
          >
            {notificationCount > 99 ? "99+" : notificationCount}
          </motion.span>
        </div>
      )}
    </motion.button>
  );

  if (!isExpanded) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex w-full justify-center">
            {buttonContent}
          </span>
        </TooltipTrigger>
        <TooltipContent
          side="right"
          align="center"
          sideOffset={14}
          className="border border-white/10 bg-[rgba(14,14,22,0.96)] px-3.5 py-1.5 font-semibold text-xs text-white shadow-[0_10px_40px_-10px_rgba(0,0,0,0.8)] backdrop-blur-xl [&>svg]:bg-[rgba(14,14,22,0.96)] [&>svg]:fill-[rgba(14,14,22,0.96)]"
        >
          {label}
        </TooltipContent>
      </Tooltip>
    );
  }

  return buttonContent;
};

const Sidebar: React.FC<SidebarProps> = ({
  activeCategory,
  onCategory,
  settingsLabel,
  playSound,
  notificationCount = 0,
  language = "pt-BR",
}) => {
  const prefersReducedMotion = useReducedMotion();
  const [isExpanded, setIsExpanded] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem("checkpoint_sidebar_expanded");
      return stored !== null ? stored === "true" : true;
    } catch {
      return true;
    }
  });

  const toggleExpand = () => {
    const next = !isExpanded;
    setIsExpanded(next);
    try {
      localStorage.setItem("checkpoint_sidebar_expanded", String(next));
    } catch { void 0; }
    playSound("navigate");
    window.dispatchEvent(
      new CustomEvent("checkpoint:sidebar-toggle", { detail: { expanded: next } }),
    );
  };

  const sidebarLabels: Record<string, string> = {
    ALL: { "pt-BR": "Todos os Jogos", "en-US": "All Games", "es-ES": "Todos los juegos", "fr-FR": "Tous les jeux", "de-DE": "Alle Spiele", "it-IT": "Tutti i giochi" }[language],
    FAVORITES: { "pt-BR": "Favoritos", "en-US": "Favorites", "es-ES": "Favoritos", "fr-FR": "Favoris", "de-DE": "Favoriten", "it-IT": "Preferiti" }[language],
    FRIENDS: { "pt-BR": "Amigos", "en-US": "Friends", "es-ES": "Amigos", "fr-FR": "Amis", "de-DE": "Freunde", "it-IT": "Amici" }[language],
    FEED: { "pt-BR": "Radar Gamer", "en-US": "Gaming Radar", "es-ES": "Radar Gamer", "fr-FR": "Radar Gamer", "de-DE": "Gaming Radar", "it-IT": "Radar Gamer" }[language],
    SPOTIFY: "Spotify",
    MODS: "Gerenciador de Mods",
    STEAM: "Steam",
    EPIC: "Epic Games",
    LOCAL: { "pt-BR": "Jogos Locais", "en-US": "Local Games", "es-ES": "Juegos Locales", "fr-FR": "Jeux Locaux", "de-DE": "Lokale Spiele", "it-IT": "Giochi Locali" }[language],
    PROFILE: { "pt-BR": "Perfil", "en-US": "Profile", "es-ES": "Perfil", "fr-FR": "Profil", "de-DE": "Profil", "it-IT": "Profilo" }[language],
  };

  const groupLabels: Record<string, string> = {
    filters: { "pt-BR": "MENU", "en-US": "MENU", "es-ES": "MENÚ", "fr-FR": "MENU", "de-DE": "MENÜ", "it-IT": "MENU" }[language],
    platforms: { "pt-BR": "PLATAFORMAS", "en-US": "PLATFORMS", "es-ES": "PLATAFORMAS", "fr-FR": "PLATEFORMES", "de-DE": "PLATTFORMEN", "it-IT": "PIATTAFORME" }[language],
    community: { "pt-BR": "SOCIAL", "en-US": "SOCIAL", "es-ES": "SOCIAL", "fr-FR": "SOCIAL", "de-DE": "SOZIAL", "it-IT": "SOCIAL" }[language],
    music: { "pt-BR": "MÚSICA", "en-US": "MUSIC", "es-ES": "MÚSICA", "fr-FR": "MUSIQUE", "de-DE": "MUSIK", "it-IT": "MUSICA" }[language],
    mods: { "pt-BR": "FERRAMENTAS", "en-US": "TOOLS", "es-ES": "HERRAMIENTAS", "fr-FR": "OUTILS", "de-DE": "WERKZEUGE", "it-IT": "STRUMENTI" }[language],
  };

  const handleSelect = (id: string) => {
    onCategory(id);
    playSound("navigate");
  };

  return (
    <motion.aside
      initial={{ x: -80, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
      className="fixed left-3.5 top-3.5 bottom-3.5 z-50 flex flex-col pointer-events-none transition-all duration-300 ease-out"
      style={{ width: isExpanded ? 256 : 84 }}
    >
      <div
        className="pointer-events-auto flex-1 flex flex-col py-5 px-3 min-h-0 rounded-[28px] border border-white/10"
        style={{
          background: "rgba(6, 6, 8, 0.88)",
          boxShadow: "0 20px 50px rgba(0,0,0,0.65), inset 0 1px 0 rgba(255,255,255,0.08)",
          backdropFilter: "blur(48px)",
          WebkitBackdropFilter: "blur(48px)",
        }}
      >
        {/* Cabeçalho Topo - Clicar no Logo abre/fecha a sidebar */}
        <div
          onClick={toggleExpand}
          role="button"
          tabIndex={0}
          title={isExpanded ? "Recolher sidebar" : "Expandir sidebar"}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") toggleExpand();
          }}
          className={`relative mb-3 flex items-center cursor-pointer group rounded-2xl p-1.5 transition-all duration-300 hover:bg-white/[0.06] active:scale-98 ${
            isExpanded ? "justify-start gap-3 px-2" : "justify-center"
          }`}
        >
          <div className="relative w-10 h-10 rounded-xl flex items-center justify-center bg-white/5 ring-1 ring-white/10 group-hover:ring-white/30 transition-all duration-300 group-hover:scale-105 shadow-lg shrink-0">
            <img src="/Checkpoint_Logo.png" alt="Checkpoint" className="h-6 w-6 object-contain" />
          </div>
          {isExpanded && (
            <div className="flex flex-1 items-center justify-between min-w-0 pr-1">
              <span className="font-display font-black text-lg text-white tracking-tight uppercase group-hover:text-white/90">
                Checkpoint
              </span>
            </div>
          )}
        </div>

        <div className="w-full h-px mb-3 shrink-0 bg-linear-to-r from-transparent via-white/10 to-transparent" />

        {/* Lista de Navegação com Espaçamento Generoso */}
        <nav
          aria-label="Navegação principal"
          className="flex min-h-0 w-full flex-1 flex-col overflow-y-auto overscroll-contain px-1 no-scrollbar gap-5"
        >
          {SIDEBAR_NAVIGATION_GROUPS.map((group) => {
            return (
              <div key={group.key} role="group" aria-label={groupLabels[group.key]} className="flex w-full flex-col gap-2">
                {isExpanded && (
                  <span className="px-3.5 mb-1 text-[10px] font-black uppercase tracking-[0.28em] text-white/30 font-body">
                    {groupLabels[group.key]}
                  </span>
                )}
                {group.ids.map((id) => {
                  const category = SIDEBAR_CATEGORIES.find((item) => item.id === id);
                  if (!category) return null;
                  return (
                    <SidebarButton
                      key={category.id === "FRIENDS"
                        ? `${category.id}-${notificationCount}`
                        : category.id}
                      id={category.id}
                      label={sidebarLabels[category.id] || category.label}
                      Icon={category.Icon}
                      AnimatedIcon={category.AnimatedIcon}
                      active={activeCategory === category.id}
                      onClick={() => handleSelect(category.id)}
                      notificationCount={category.id === "FRIENDS" ? notificationCount : 0}
                      reducedMotion={Boolean(prefersReducedMotion)}
                      isExpanded={isExpanded}
                    />
                  );
                })}
              </div>
            );
          })}
        </nav>

        <div className="w-full h-px mt-auto mb-3 shrink-0 bg-linear-to-r from-transparent via-white/10 to-transparent" />

        {/* Rodapé: Perfil e Ajustes */}
        <div className="w-full flex flex-col gap-1.5 shrink-0 px-1">
          <SidebarButton
            id="PROFILE"
            label={sidebarLabels.PROFILE || "Perfil"}
            Icon={User}
            AnimatedIcon={AnimatedUserIcon}
            active={activeCategory === "PROFILE"}
            onClick={() => handleSelect("PROFILE")}
            reducedMotion={Boolean(prefersReducedMotion)}
            isExpanded={isExpanded}
          />
          <SidebarButton
            id="SETTINGS"
            label={settingsLabel}
            Icon={Settings}
            AnimatedIcon={AnimatedSettingsIcon}
            active={activeCategory === "SETTINGS"}
            onClick={() => handleSelect("SETTINGS")}
            reducedMotion={Boolean(prefersReducedMotion)}
            rotateOnHover
            isExpanded={isExpanded}
          />
        </div>
      </div>
    </motion.aside>
  );
};

export default Sidebar;
