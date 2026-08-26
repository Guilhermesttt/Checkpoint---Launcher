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
import { faSteam, faDiscord, faXbox } from "@fortawesome/free-brands-svg-icons";
import {
  PHERIELIUM_LOGO_PATH,
  EPIC_GAMES_ICON_PATH,
  EA_GAMES_ICON_PATH,
  UBISOFT_ICON_PATH,
  GOG_ICON_PATH,
  RIOT_GAMES_ICON_PATH,
  BATTLENET_ICON_PATH,
  ROCKSTAR_ICON_PATH,
} from "../constants/assets";
import type { SoundEffectType } from "../hooks/useSoundEffects";
import { type LauncherLanguage } from "../context/PreferencesContext";
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
        backgroundColor: (color as string) ?? "currentColor",
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
        backgroundColor: (color as string) ?? "currentColor",
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
        backgroundColor: (color as string) ?? "currentColor",
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
        backgroundColor: (color as string) ?? "currentColor",
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
        backgroundColor: (color as string) ?? "currentColor",
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
        backgroundColor: (color as string) ?? "currentColor",
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
        backgroundColor: (color as string) ?? "currentColor",
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
    color: active ? "#ffffff" : "rgba(255,255,255,0.45)",
    filter: active ? "drop-shadow(0 0 6px rgba(255,255,255,0.6))" : "none",
  };

  const buttonContent = (
    <motion.button
      onClick={onClick}
      onMouseEnter={playIconAnimation}
      aria-label={hasNotifications ? `${label}, ${notificationCount} notificacoes` : label}
      aria-current={active ? "page" : undefined}
      data-sidebar-item={id}
      data-notification-count={notificationCount}
      className={`relative group flex cursor-pointer items-center transition-all duration-200 ease-out
        focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/40
        ${isExpanded ? "w-full h-11 px-3.5 gap-3.5 rounded-2xl text-left" : "h-12 w-12 justify-center rounded-2xl"}
        ${!active ? "hover:bg-white/[0.05]" : ""}`}
      style={{
        background: active ? "rgba(255, 255, 255, 0.08)" : "transparent",
        boxShadow: active
          ? "0 4px 20px rgba(0, 0, 0, 0.4), inset 0 0 0 1px rgba(255, 255, 255, 0.15)"
          : "none",
      }}
    >
      {/* Indicador de item ativo */}
      {active && (
        <motion.div
          layoutId="sb-active"
          className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-5 rounded-r-full shadow-[0_0_10px_rgba(255,255,255,0.85)] bg-white"
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
        />
      )}

      {/* Ícone */}
      <motion.div
        whileTap={{ scale: 0.9 }}
        className={`shrink-0 transform transition-transform duration-200 ${
          AnimatedIcon ? "" : "group-hover:scale-105"
        } ${rotateOnHover && !AnimatedIcon ? "group-hover:rotate-45" : ""}`}
      >
        {AnimatedIcon ? (
          <AnimatedIcon
            ref={animatedIconRef}
            size={isExpanded ? 22 : 24}
            duration={1}
            className={`${isExpanded ? "h-6 w-6" : "h-6.5 w-6.5"} transition-colors duration-200`}
            style={iconStyle}
          />
        ) : (
          <Icon
            className={`${isExpanded ? "h-6 w-6" : "h-6.5 w-6.5"} transition-colors duration-200`}
            style={iconStyle}
          />
        )}
      </motion.div>

      {/* Rótulo e Badge quando expandido */}
      {isExpanded && (
        <div className="flex flex-1 items-center justify-between min-w-0">
          <span
            className={`truncate text-[13px] font-body transition-colors duration-200 ${
              active ? "text-white font-semibold" : "text-white/60 group-hover:text-white"
            }`}
          >
            {label}
          </span>
          {hasNotifications && (
            <div className="relative flex items-center justify-center">
              <motion.span
                animate={{ scale: [1, 1.35, 1], opacity: [0.7, 0, 0.7] }}
                transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
                className="absolute inset-0 rounded-full bg-white"
              />
              <motion.span
                key={notificationCount}
                initial={{ scale: 1.5, rotate: -12 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 400, damping: 15 }}
                className="relative z-10 flex h-4.5 min-w-[18px] items-center justify-center rounded-full bg-white px-1 text-[9px] font-bold text-black shadow-[0_0_10px_rgba(255,255,255,0.8)]"
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
            className="absolute inset-0 rounded-full bg-white"
          />
          <motion.span
            key={notificationCount}
            initial={{ scale: 1.5 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 400, damping: 15 }}
            className="relative z-10 flex h-4.5 min-w-[18px] items-center justify-center rounded-full border border-black/50 bg-white px-1 text-[9px] font-bold text-black shadow-[0_0_10px_rgba(255,255,255,0.8)]"
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
          className="border border-white/10 bg-[#0c0d12]/95 px-3 py-1.5 font-medium text-xs text-white shadow-xl backdrop-blur-xl"
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
    mods: { "pt-BR": "FERRAMENTAS", "en-US": "TOOLS", "es-ES": "HERRAMIENTAS", "fr-FR": "OUTILS", "de-DE": "WERKZEUGE", "it-IT": "STRUMENTI" }[language],
  };

  const handleSelect = (id: string) => {
    onCategory(id);
    playSound("showModal");
  };

  return (
    <motion.aside
      initial={{ x: -80, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
      className="fixed left-3.5 top-3.5 bottom-3.5 z-50 flex flex-col pointer-events-none transition-all duration-300 ease-out"
      style={{ width: isExpanded ? 240 : 80 }}
    >
      <div
        className="pointer-events-auto flex-1 flex flex-col py-4 px-2.5 min-h-0 rounded-[32px] border border-white/[0.06]"
        style={{
          background: "rgba(10, 11, 15, 0.45)",
          boxShadow: "0 20px 50px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.06)",
          backdropFilter: "blur(32px)",
          WebkitBackdropFilter: "blur(32px)",
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
          className={`relative mb-2 flex items-center cursor-pointer group rounded-2xl p-1.5 transition-all duration-200 hover:bg-white/[0.05] active:scale-98 ${
            isExpanded ? "justify-start gap-2.5 px-2" : "justify-center"
          }`}
        >
          <div className="relative w-10 h-10 rounded-2xl flex items-center justify-center bg-white/[0.05] border border-white/[0.08] group-hover:border-white/20 transition-all duration-200 group-hover:scale-105 shadow-md shrink-0">
            <img src={PHERIELIUM_LOGO_PATH} alt="Pherielium" className="h-6 w-6 object-contain" />
          </div>
          {isExpanded && (
            <div className="flex flex-1 items-center justify-between min-w-0 pr-1">
              <span className="font-display font-bold text-[15px] text-white tracking-tight group-hover:text-white">
                Pherielium
              </span>
            </div>
          )}
        </div>

        <div className="w-full h-px mb-2 shrink-0 bg-white/[0.06]" />

        {/* Lista de Navegação */}
        <nav
          aria-label="Navegação principal"
          className="flex min-h-0 w-full flex-1 flex-col overflow-y-auto overscroll-contain px-1 no-scrollbar gap-3.5"
        >
          {SIDEBAR_NAVIGATION_GROUPS.map((group) => {
            return (
              <div key={group.key} role="group" aria-label={groupLabels[group.key]} className="flex w-full flex-col gap-1">
                {isExpanded && (
                  <span className="px-3 mb-0.5 text-[9.5px] font-semibold uppercase tracking-[0.22em] text-white/30 font-body">
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

        <div className="w-full h-px mt-auto mb-2 shrink-0 bg-linear-to-r from-transparent via-white/10 to-transparent" />

        {/* Rodapé: Perfil e Ajustes */}
        <div className="w-full flex flex-col gap-1 shrink-0 px-1">
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
