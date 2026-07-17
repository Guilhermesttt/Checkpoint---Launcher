import React from "react";
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
} from "lucide-react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSteam, faDiscord } from "@fortawesome/free-brands-svg-icons";
import { EPIC_GAMES_ICON_PATH } from "../constants/assets";
import type { SoundEffectType } from "../hooks/useSoundEffects";

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
  // <img> não respeita a propriedade CSS `color`, então quando o item fica ativo
  // e o Sidebar tenta pintar o ícone com a cor de destaque, uma <img> normal ignora isso.
  // Solução: usar o PNG como CSS mask (um "molde") e pintar o fundo com currentColor/style.color —
  // assim o ícone responde à cor ativa igual aos ícones SVG (Lucide/FontAwesome).
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

// eslint-disable-next-line react-refresh/only-export-components
export const CATEGORIES = [
  { id: "ALL", label: "Todos", Icon: Gamepad2 },
  { id: "FAVORITES", label: "Favoritos", Icon: Star },
  { id: "FRIENDS", label: "Amigos", Icon: Users },
  { id: "FEED", label: "Feed", Icon: Newspaper },
  { id: "PROFILE", label: "Perfil", Icon: User },
  { id: "STEAM", label: "Steam", Icon: SteamBrandIcon },
  { id: "EPIC", label: "Epic", Icon: EpicBrandIcon },
  { id: "LOCAL", label: "Local", Icon: Gamepad2 },
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
  ["ALL", "FAVORITES", "FRIENDS", "FEED", "STEAM", "EPIC", "LOCAL", "PROFILE"].includes(id),
);

// A navegação da sidebar não é uma lista plana — são três grupos com naturezas
// diferentes (filtros de biblioteca, plataformas de origem, conta). Antes isso
// não aparecia visualmente: os 8 itens ficavam soltos em sequência. Agora cada
// grupo tem seu próprio cluster + divisor curto entre eles, e um rótulo lido só
// por leitor de tela (a régua tem 96px, não cabe texto visível sem apertar os
// ícones).
const NAV_GROUPS: { key: string; ariaLabel: string; ids: string[] }[] = [
  { key: "library", ariaLabel: "Biblioteca", ids: ["ALL", "FAVORITES", "FRIENDS", "FEED"] },
  { key: "platforms", ariaLabel: "Plataformas", ids: ["STEAM", "EPIC", "LOCAL"] },
  { key: "account", ariaLabel: "Conta", ids: ["PROFILE"] },
];

interface SidebarProps {
  activeCategory: string;
  onCategory: (id: string) => void;
  settingsLabel: string;
  playSound: (t: SoundEffectType) => void;
}

interface SidebarButtonProps {
  id: string;
  label: string;
  Icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  active: boolean;
  onClick: () => void;
  /** Ícone com leve rotação no hover (usado no Settings) */
  rotateOnHover?: boolean;
}

// Um único componente cuida do visual de qualquer item (categoria ou settings).
// Isso elimina a duplicação entre o .map() e o botão de Settings de fora dele,
// então qualquer ajuste de estilo/animação passa a valer para os dois automaticamente.
const SidebarButton: React.FC<SidebarButtonProps> = ({
  label,
  Icon,
  active,
  onClick,
  rotateOnHover = false,
}) => {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      className={`relative group flex flex-col items-center justify-center gap-1.5 w-full py-2.5 rounded-xl
        transition-all duration-300 ease-out
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--launcher-accent))] focus-visible:ring-offset-2 focus-visible:ring-offset-black
        ${!active ? "hover:bg-white/5" : ""}`}
      style={{
        background: active ? "var(--launcher-accent-soft)" : "transparent",
        boxShadow: active
          ? "0 4px 20px -2px rgb(var(--launcher-accent) / 0.25), inset 0 0 0 1px rgb(var(--launcher-accent) / 0.2)"
          : "none",
      }}
    >
      {/* Indicador de item ativo */}
      {active && (
        <motion.div
          layoutId="sb-active"
          className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 rounded-r-full shadow-[0_0_8px_rgb(var(--launcher-accent))]"
          style={{ background: "rgb(var(--launcher-accent))" }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
        />
      )}

      {/* Ícone com feedback de hover + clique */}
      <motion.div
        whileTap={{ scale: 0.88 }}
        className={`transform transition-transform duration-300 group-hover:scale-110 ${rotateOnHover ? "group-hover:rotate-45" : ""
          }`}
      >
        <Icon
          className="w-[18px] h-[18px] transition-colors duration-300"
          style={{
            color: active ? "rgb(var(--launcher-accent))" : "rgba(255,255,255,0.4)",
            filter: active ? "drop-shadow(0 0 4px rgb(var(--launcher-accent) / 0.5))" : "none",
          }}
        />
      </motion.div>

      {/* Rótulo */}
      <span
        className="text-[9px] font-bold uppercase tracking-[0.08em] leading-none transition-colors duration-300"
        style={{
          color: active ? "rgb(var(--launcher-accent))" : "rgba(255,255,255,0.3)",
        }}
      >
        {label}
      </span>

      {/* Tooltip flutuante — aparece no hover E no foco (teclado).
          Ganhou identidade própria: borda de destaque na cor do tema ativo
          e uma seta apontando pro botão, em vez do balão genérico cinza. */}
      <div
        role="tooltip"
        className="absolute left-full ml-4 top-1/2 -translate-y-1/2 flex items-center opacity-0 pointer-events-none
          transition-all duration-300 ease-out z-50 translate-x-2 scale-95 origin-left
          group-hover:opacity-100 group-hover:translate-x-0 group-hover:scale-100
          group-focus-visible:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:scale-100"
      >
        <span
          className="w-2 h-2 rotate-45 -mr-1 shrink-0"
          style={{
            background: "rgba(14,14,22,0.95)",
            borderLeft: "1px solid rgb(var(--launcher-accent) / 0.35)",
            borderBottom: "1px solid rgb(var(--launcher-accent) / 0.35)",
          }}
        />
        <span
          className="px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap"
          style={{
            background: "rgba(14,14,22,0.95)",
            borderTop: "1px solid rgb(var(--launcher-accent) / 0.35)",
            borderRight: "1px solid rgb(var(--launcher-accent) / 0.35)",
            borderBottom: "1px solid rgb(var(--launcher-accent) / 0.35)",
            color: "rgba(255,255,255,0.92)",
            backdropFilter: "blur(12px)",
            boxShadow: "0 10px 40px -10px rgba(0,0,0,0.8)",
          }}
        >
          {label}
        </span>
      </div>
    </button>
  );
};

// Divisor curto entre clusters de navegação — mais discreto que os traços
// estruturais (logo↔nav, nav↔settings), então os grupos se distinguem sem
// competir com a hierarquia principal da régua.
const GroupDivider: React.FC = () => (
  <div
    aria-hidden="true"
    className="w-6 h-px my-1.5 self-center shrink-0 bg-white/[0.06]"
  />
);

const Sidebar: React.FC<SidebarProps> = ({ activeCategory, onCategory, settingsLabel, playSound }) => {
  const prefersReducedMotion = useReducedMotion();

  const handleSelect = (id: string) => {
    onCategory(id);
    playSound("navigate");
  };

  return (
    <motion.aside
      initial={{ x: -80, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
      className="fixed left-0 top-0 bottom-0 z-50 flex flex-col"
      style={{ width: 96 }}
    >
      <div
        className="flex-1 flex flex-col items-center py-6 gap-2 min-h-0"
        style={{
          background: "rgba(6, 6, 10, 0.65)",
          boxShadow: "12px 0 40px rgba(0,0,0,0.4), inset -1px 0 rgba(255,255,255,0.03)",
          backdropFilter: "blur(48px)",
          WebkitBackdropFilter: "blur(48px)",
          borderRight: "1px solid rgba(255,255,255,0.04)",
        }}
      >
        {/* Logo — assinatura visual da régua. Um halo cônico na cor de
            destaque gira devagar atrás da marca, amarrando o ícone ao
            sistema de tema dinâmico do launcher (a mesma --launcher-accent
            que colore os itens ativos). Ambiente, não chamativo, e some
            se o usuário pedir menos movimento no sistema. */}
        <div className="relative mb-4 flex flex-col items-center shrink-0 group cursor-pointer">
          <div className="relative w-10 h-10 flex items-center justify-center">
            {!prefersReducedMotion && (
              <motion.div
                aria-hidden="true"
                className="absolute inset-[-6px] rounded-full opacity-40 group-hover:opacity-70 transition-opacity duration-500"
                style={{
                  background:
                    "conic-gradient(from 0deg, rgb(var(--launcher-accent) / 0.5), transparent 30%, transparent 70%, rgb(var(--launcher-accent) / 0.5))",
                  filter: "blur(6px)",
                }}
                animate={{ rotate: 360 }}
                transition={{ duration: 16, repeat: Infinity, ease: "linear" }}
              />
            )}
            <div className="relative w-10 h-10 rounded-2xl flex items-center justify-center bg-white/5 ring-1 ring-white/10 group-hover:ring-white/20 transition-all duration-300 group-hover:scale-105 shadow-lg">
              <img src="/Checkpoint_Logo.png" alt="Checkpoint" className="h-6 w-6 object-contain" />
            </div>
          </div>
        </div>

        <div className="w-10 h-px mb-2 shrink-0 bg-gradient-to-r from-transparent via-white/10 to-transparent" />

        {/* Navegação — agora em 3 clusters (biblioteca / plataformas / conta)
            em vez de uma lista única de 8 itens sem hierarquia. */}
        <nav
          aria-label="Navegação principal"
          className="flex min-h-0 w-full flex-1 flex-col items-center overflow-y-auto overscroll-contain px-3 no-scrollbar"
        >
          {NAV_GROUPS.map((group, groupIndex) => (
            <React.Fragment key={group.key}>
              {groupIndex > 0 && <GroupDivider />}
              <div role="group" aria-label={group.ariaLabel} className="flex w-full flex-col gap-1.5">
                {group.ids.map((id) => {
                  const category = SIDEBAR_CATEGORIES.find((item) => item.id === id);
                  if (!category) return null;
                  return (
                    <SidebarButton
                      key={category.id}
                      id={category.id}
                      label={category.label}
                      Icon={category.Icon}
                      active={activeCategory === category.id}
                      onClick={() => handleSelect(category.id)}
                    />
                  );
                })}
              </div>
            </React.Fragment>
          ))}
        </nav>

        <div className="w-10 h-px mt-auto mb-3 shrink-0 bg-gradient-to-r from-transparent via-white/10 to-transparent" />

        {/* Settings — mesmo componente, sem duplicar estilos */}
        <div className="w-full px-3 shrink-0">
          <SidebarButton
            id="SETTINGS"
            label={settingsLabel}
            Icon={Settings}
            active={activeCategory === "SETTINGS"}
            onClick={() => handleSelect("SETTINGS")}
            rotateOnHover
          />
        </div>
      </div>
    </motion.aside>
  );
};

export default Sidebar;