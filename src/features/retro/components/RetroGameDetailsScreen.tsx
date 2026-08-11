import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

import { usePreferences } from "../../../context/PreferencesContext";
import { useAuth } from "../../../auth/AuthProvider";
import { useGamepadButton } from "../../../context/GamepadContext";
import type { SoundEffectType } from "../../../hooks/useSoundEffects";
import { launchGame } from "../../../services/launcher";
import type { Game } from "../../../types/domain";
import { RetroDetailTabs, type RetroDetailTab } from "./RetroDetailTabs";
import type { RetroGame } from "../shelf/retroCollection";

interface RetroGameDetailsScreenProps {
  game: RetroGame;
  isOpen: boolean;
  onClose: () => void;
  onEditGame: (game: RetroGame) => void;
  playSound: (type: SoundEffectType) => void;
  restoreFocusRef?: RefObject<HTMLElement | null>;
  onOpenSettingsConnections?: () => void;
}

const getFocusableElements = (container: HTMLElement) =>
  Array.from(container.querySelectorAll<HTMLElement>("button, [href], [tabindex]"))
    .filter((element) => element.tabIndex >= 0 && !element.matches("[disabled]"));

function toLauncherGame(game: RetroGame): Game {
  return {
    id: game.id,
    title: game.title,
    image: game.coverImage ?? game.wrapImage ?? "",
    publisher: game.publisher,
    executablePath: game.executablePath,
    launcherType: "local",
    source: "manual",
  };
}

export function RetroGameDetailsScreen({ game, isOpen, onClose, onEditGame, playSound, restoreFocusRef, onOpenSettingsConnections }: RetroGameDetailsScreenProps) {
  const { closeOnLaunch } = usePreferences();
  const { userProfile } = useAuth();
  const reducedMotion = Boolean(useReducedMotion());
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const playActionRef = useRef<HTMLButtonElement>(null);
  const [activeTab, setActiveTab] = useState<RetroDetailTab>("play");
  const [isLaunching, setIsLaunching] = useState(false);
  const [launchError, setLaunchError] = useState<string | null>(null);
  const launcherGame = useMemo(() => toLauncherGame(game), [game]);

  const handleClose = useCallback(() => {
    playSound("back");
    onClose();
  }, [onClose, playSound]);

  const moveTab = useCallback((direction: -1 | 1) => {
    setActiveTab((current) => {
      const tabs: RetroDetailTab[] = ["play", "about", "achievements"];
      const next = tabs[(tabs.indexOf(current) + direction + tabs.length) % tabs.length];
      playSound("select");
      requestAnimationFrame(() => dialogRef.current?.querySelector<HTMLElement>(`#retro-tab-${next}`)?.focus());
      return next;
    });
  }, [playSound]);

  useEffect(() => {
    if (!isOpen) return;
    const focusTarget = restoreFocusRef?.current;
    const focusFrame = requestAnimationFrame(() => {
      setActiveTab("play");
      setLaunchError(null);
      dialogRef.current?.querySelector<HTMLElement>("#retro-tab-play")?.focus();
    });
    return () => {
      cancelAnimationFrame(focusFrame);
      requestAnimationFrame(() => focusTarget?.focus());
    };
  }, [game.id, isOpen, restoreFocusRef]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      const isEditing = target instanceof Element && target.matches("input, textarea, select, [contenteditable='true']");
      if (!isEditing && (event.key === "ArrowUp" || event.key === "ArrowDown")) {
        event.preventDefault();
        moveTab(event.key === "ArrowUp" ? -1 : 1);
        return;
      }
      if (!isEditing && (event.key === "ArrowLeft" || event.key === "ArrowRight")) {
        const tablist = dialogRef.current?.querySelector<HTMLElement>('[role="tablist"]');
        const focusedElement = target instanceof Element ? target : document.activeElement;
        if (focusedElement instanceof Element && tablist?.contains(focusedElement)) {
          event.preventDefault();
          moveTab(event.key === "ArrowLeft" ? -1 : 1);
          return;
        }
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = getFocusableElements(dialogRef.current);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, moveTab]);

  useGamepadButton("L1", () => {
    if (isOpen) moveTab(-1);
  }, isOpen, 90);
  useGamepadButton("R1", () => {
    if (isOpen) moveTab(1);
  }, isOpen, 90);
  useGamepadButton("DPAD_UP", () => {
    if (isOpen) moveTab(-1);
  }, isOpen, 90);
  useGamepadButton("DPAD_DOWN", () => {
    if (isOpen) moveTab(1);
  }, isOpen, 90);
  useGamepadButton("X", () => {
    if (!isOpen) return;
    const focused = document.activeElement;
    if (focused instanceof HTMLButtonElement && dialogRef.current?.contains(focused)) focused.click();
    else playActionRef.current?.click();
  }, isOpen, 90);
  useGamepadButton("O", () => {
    if (isOpen) handleClose();
  }, isOpen, 90);

  const handleLaunch = async () => {
    if (!game.executablePath || isLaunching) return;
    setLaunchError(null);
    setIsLaunching(true);
    playSound("select");
    try {
      await launchGame(launcherGame, { hideLauncher: closeOnLaunch });
    } catch (error) {
      setLaunchError(error instanceof Error ? error.message : "Não foi possível iniciar o jogo.");
    } finally {
      setIsLaunching(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-label={`Detalhes de ${game.title}`}
          initial={reducedMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={reducedMotion ? undefined : { opacity: 0 }}
          className="retro-detail-editorial retro-mode absolute inset-0 z-30 overflow-hidden text-[#fcf9f3]"
        >
          <div
            data-testid="retro-detail-backlight"
            aria-hidden="true"
            className="retro-detail-backlight pointer-events-none absolute inset-0"
          />
          <div className="pointer-events-none absolute inset-0 bg-linear-to-r from-black/70 via-black/18 to-transparent" />
          <motion.section
            initial={reducedMotion ? false : { opacity: 0, x: -42 }}
            animate={{ opacity: 1, x: 0 }}
            className="absolute inset-y-4 left-4 flex w-[clamp(280px,34vw,460px)] min-w-0 flex-col overflow-hidden border border-white/15 bg-[#09090a]/92 xl:inset-y-6 xl:left-6 2xl:inset-y-8 2xl:left-8"
          >
            <header className="flex items-center gap-5 px-8 pt-7">
              <span className="font-['Unbounded'] text-[10px] uppercase tracking-[0.2em] text-[#77736c]">{game.console} / {game.year}</span>
              <span className="h-px flex-1 bg-white/10" />
            </header>
            <div className="px-8 pt-7">
              <h1 className="font-['Unbounded'] text-2xl font-bold leading-tight">{game.title}</h1>
              <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.22em] text-[#b52322]">{game.subtitle}</p>
            </div>
            <RetroDetailTabs
              game={game}
              activeTab={activeTab}
              accountLinked={Boolean(userProfile?.retroAchievementsUlid)}
              onEditGame={onEditGame}
              onOpenSettingsConnections={onOpenSettingsConnections}
              onTabChange={(tab) => { playSound("select"); setActiveTab(tab); }}
            />
            <footer className="grid grid-cols-[1fr_220px] items-center gap-6 border-t border-white/10 px-8 py-6">
              <div>
                <span className="block text-[9px] font-bold uppercase tracking-[0.2em] text-[#969087]">Plataforma</span>
                <strong className="mt-1 block text-sm">{game.console}</strong>
              </div>
            {game.executablePath ? (
              <button ref={playActionRef} type="button" aria-label={`Jogar ${game.title}`} disabled={isLaunching} onClick={handleLaunch} className="flex w-full items-center justify-between border border-[#fcf9f3] bg-[#fcf9f3] px-6 py-4 text-xs font-bold tracking-[0.12em] text-[#09090a] transition hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#fcf9f3] disabled:opacity-60">
                <span>{isLaunching ? "ABRINDO..." : "JOGAR"}</span><span aria-hidden="true">▶</span>
              </button>
            ) : (
              <button ref={playActionRef} type="button" onClick={() => onEditGame(game)} className="w-full border border-[#fcf9f3] bg-transparent px-6 py-4 text-[10px] font-bold tracking-[0.12em] text-[#fcf9f3] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#fcf9f3]">CONFIGURAR JOGO</button>
            )}
            </footer>
            {launchError && <p role="alert" className="mx-8 mb-6 border border-white/15 bg-black/70 p-3 text-xs text-[#fcf9f3]">{launchError}</p>}
          </motion.section>

          <button ref={closeButtonRef} type="button" aria-label="Fechar detalhes" onClick={handleClose} className="absolute right-8 top-8 grid h-12 w-12 place-items-center border border-white/25 bg-[#09090a]/75 text-2xl text-[#fcf9f3] transition hover:bg-[#242321] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#fcf9f3]">×</button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
