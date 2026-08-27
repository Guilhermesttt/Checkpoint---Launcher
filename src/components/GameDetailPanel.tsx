import React from "react";
import DOMPurify from "dompurify";
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform } from "framer-motion";
import {
  X, Play, Clock, CalendarClock, Trophy, Camera, Trash2, PackageOpen, ChevronLeft, ChevronRight,
  Search, AlertCircle, RotateCw, FolderOpen
} from "lucide-react";
import psCross from "../assets/PlayStation Series/Vector/playstation_button_cross.svg?raw";
import psSquare from "../assets/PlayStation Series/Vector/playstation_button_square.svg?raw";
import xboxA from "../assets/Xbox Series/Vector/xbox_button_a.svg?raw";
import xboxX from "../assets/Xbox Series/Vector/xbox_button_x.svg?raw";
import { getMonitorableExecutablePath, launchGame } from "../services/launcher";
import type { Game, GameLaunchProfile } from "../types/domain";
import type { SoundEffectType } from "../hooks/useSoundEffects";
import { useGamepadNavigation } from "../hooks/useGamepadNavigation";
import {
  fetchSteamAchievementDetails,
  fetchSteamAchievementSchema,
  fetchSteamAppDetailsResult,
  searchSteamGames,
  type SteamAchievement,
} from "../services/steam";
import ModalShell from "./ui/ModalShell";
import GlassButton from "./ui/GlassButton";
import { ShinyButton } from "./ui/shiny-button";
import { useAuth } from "../auth/AuthProvider";
import { usePreferences } from "../context/PreferencesContext";
import {
  deleteLibraryGame,
  updateLibraryGame,
} from "../services/localLibrary";
import { useNotification } from "./NotificationCenter";
import { useGamepad, useGamepadButton } from "../context/GamepadContext";
import InputHints from "./ui/InputHints";
import { fetchEpicAppDetailsResult } from "../services/epic";
import { ModsSummaryBanner } from "./game/ModsSummaryBanner";
import { AdvancedLaunchSettings } from "./game/AdvancedLaunchSettings";

interface GameDetailPanelProps {
  game: Game | null;
  isOpen: boolean;
  onClose: () => void;
  playSound: (type: SoundEffectType) => void;
  onLibraryChanged?: () => Promise<void> | void;
  onGameHydrated?: (game: Game) => void;
  onOpenMods?: () => void;
}

interface GamePanelMod {
  id: string;
  name: string;
  pictureUrl?: string;
  enabled: boolean;
  status?: "downloaded" | "installed";
  manifestPath?: string;
}

const MIN_LAUNCH_SCREEN_MS = 3000;
const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));
const normalizeSteamLookup = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const GameDetailPanel: React.FC<GameDetailPanelProps> = ({
  game,
  isOpen,
  onClose,
  playSound,
  onLibraryChanged,
  onGameHydrated,
  onOpenMods,
}) => {
  const { user, userProfile } = useAuth();
  const { t, language, closeOnLaunch } = usePreferences();
  const { notify } = useNotification();
  const { isGamepadConnected, gamepadFamily, activeInputType } = useGamepad();

  // Estados existentes
  const [isLaunching, setIsLaunching] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState("JOGAR");
  const [launchError, setLaunchError] = React.useState<string | null>(null);
  const [galleryModalOpen, setGalleryModalOpen] = React.useState(false);
  const [currentGalleryIndex, setCurrentGalleryIndex] = React.useState(0);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const [deleteModalOpen, setDeleteModalOpen] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = React.useState("");
  const [achievementItems, setAchievementItems] = React.useState<SteamAchievement[]>([]);
  const [achievementSourceAppId, setAchievementSourceAppId] = React.useState<string>("");
  const [isAchievementsLoading, setIsAchievementsLoading] = React.useState(false);
  const [achievementsError, setAchievementsError] = React.useState<string | null>(null);
  const [isAddAchModalOpen, setIsAddAchModalOpen] = React.useState(false);
  const [newAchName, setNewAchName] = React.useState("");
  const [newAchDesc, setNewAchDesc] = React.useState("");
  const [launchProfile, setLaunchProfile] = React.useState<GameLaunchProfile>({});
  const [displayOptions, setDisplayOptions] = React.useState<Array<{
    id: number;
    label: string;
    primary: boolean;
    width: number;
    height: number;
  }>>([]);
  const [isSavingLaunchProfile, setIsSavingLaunchProfile] = React.useState(false);
  const [localScreenshots, setLocalScreenshots] = React.useState<string[]>([]);
  const [gameMods, setGameMods] = React.useState<GamePanelMod[]>([]);
  const hydratedEpicGamesRef = React.useRef(new Set<string>());
  const hydratedSteamGamesRef = React.useRef(new Set<string>());

  // NOVOS ESTADOS (melhorias)
  const [isRunning, setIsRunning] = React.useState(false);
  const [refetchKey, setRefetchKey] = React.useState(0);
  const [achievementFilter, setAchievementFilter] = React.useState<"all" | "unlocked" | "locked">("all");
  const [achievementSearch, setAchievementSearch] = React.useState("");

  // ============================================================
  // INTERNACIONALIZAÇÃO (dicionário completo)
  // ============================================================
  const detailLanguage =
    language === "pt-BR" || language === "en-US" || language === "es-ES"
      ? language
      : "en-US";

  const copy = {
    "pt-BR": {
      tabPlay: "JOGAR",
      tabCaptures: "CAPTURAS",
      tabAchievements: "CONQUISTAS",
      tabAbout: "SOBRE",
      tabManage: "GERENCIAR",
      tabMods: "MODS",
      steamLabel: "Steam",
      epicLabel: "Epic Games",
      localLabel: "PC Local",
      library: "Biblioteca",
      timePlayed: "TEMPO JOGADO",
      lastSession: "ÚLTIMA SESSÃO",
      neverStarted: "Ainda não iniciado",
      achievements: "CONQUISTAS",
      appId: "App ID",
      epicShortcutLabel: "Epic",
      epicShortcut: "Atalho direto",
      epicStore: "Via loja",
      source: "Fonte",
      sourceSteamSync: "Sync Steam",
      sourceEpicCatalog: "Catálogo Epic",
      sourceManual: "Manual",
      photoWall: "Mural de fotos",
      viewGallery: "Ver Galeria",
      noScreenshot: "Nenhuma captura",
      about: "Sobre",
      seeMore: "Ver mais →",
      popularTags: "Marcadores Populares",
      developer: "Desenvolvedor",
      publisher: "Distribuidora",
      releaseDate: "Data de Lançamento",
      category: "Categoria",
      notInformed: "Não informado",
      management: "Gerenciamento",
      verify: "Verificar",
      edit: "Editar",
      createShortcut: "Criar Atalho",
      remove: "Remover",
      platform: "Plataforma",
      noDescription: "Sem descrição disponível para este jogo.",
      gallery: "GALERIA",
      previous: "← Anterior",
      next: "Próximo →",
      removeGame: "Remover jogo",
      cannotUndo: "Esta ação não pode ser desfeita",
      confirmRemove: (title: string) =>
        `Tem certeza que deseja remover "${title}" da sua biblioteca? Digite o nome do jogo para confirmar.`,
      cancel: "Cancelar",
      removing: "Removendo...",
      close: "Fechar",
      loginToRemove: "Você precisa estar logado para remover um jogo.",
      removedSuccess: "Jogo removido.",
      removeError: "Erro ao remover jogo.",
      launchGenericError: "Falha ao iniciar o jogo.",
      achievementsLoading: "Buscando conquistas...",
      achievementsEmpty: "Nenhuma conquista encontrada.",
      achievementsLocked: "Bloqueada",
      achievementsUnlocked: "Desbloqueada",
      achievementsUnlockedAt: "Desbloqueada em",
      verifySuccess: "Executável encontrado.",
      verifyNotFound: "Executável não encontrado.",
      shortcutComingSoon: "Em breve.",
      achievementsSource: "Suas conquistas",
      achievementsLocalSource: "Conquistas locais",
      achievementsEpicLocalSource: "Arquivos locais Epic",
      achievementsSteamFallback: "Steam",
      achievementsNeedSteam: "Conecte sua conta Steam para carregar conquistas.",
      achievementsMissingAppId: "Este jogo não possui Steam App ID.",
      achievementsEpicLocalEmpty: "Nenhum arquivo local de conquistas legível.",
      achievementsEpicBinarySave: "Formato binário/protegido não suportado.",
      achievementsEpicNotInstalled: "Jogo não instalado localmente.",
      filterAll: "Todas",
      filterUnlocked: "Desbloqueadas",
      filterLocked: "Bloqueadas",
      searchPlaceholder: "Buscar conquista...",
      tryAgain: "Tentar novamente",
      running: "Em execução",
      launch: "Jogar",
      launching: "Iniciando...",
      openFolder: "Abrir pasta",
      confirmDeletePlaceholder: "Digite o nome do jogo",
      gameRunning: "Jogo em execução",
    },
    "en-US": {
      tabPlay: "PLAY",
      tabCaptures: "CAPTURES",
      tabAchievements: "ACHIEVEMENTS",
      tabAbout: "ABOUT",
      tabManage: "MANAGE",
      tabMods: "MODS",
      steamLabel: "Steam",
      epicLabel: "Epic Games",
      localLabel: "Local PC",
      library: "Library",
      timePlayed: "TIME PLAYED",
      lastSession: "LAST SESSION",
      neverStarted: "Not started",
      achievements: "ACHIEVEMENTS",
      appId: "App ID",
      epicShortcutLabel: "Epic",
      epicShortcut: "Direct shortcut",
      epicStore: "Via store",
      source: "Source",
      sourceSteamSync: "Steam sync",
      sourceEpicCatalog: "Epic catalog",
      sourceManual: "Manual",
      photoWall: "Photo wall",
      viewGallery: "View gallery",
      noScreenshot: "No screenshot",
      about: "About",
      seeMore: "See more →",
      popularTags: "Popular tags",
      developer: "Developer",
      publisher: "Publisher",
      releaseDate: "Release date",
      category: "Category",
      notInformed: "Not informed",
      management: "Management",
      verify: "Verify",
      edit: "Edit",
      createShortcut: "Create shortcut",
      remove: "Remove",
      platform: "Platform",
      noDescription: "No description available.",
      gallery: "GALLERY",
      previous: "← Previous",
      next: "Next →",
      removeGame: "Remove game",
      cannotUndo: "This action cannot be undone",
      confirmRemove: (title: string) =>
        `Are you sure you want to remove "${title}" from your library? Type the game name to confirm.`,
      cancel: "Cancel",
      removing: "Removing...",
      close: "Close",
      loginToRemove: "You must be logged in to remove a game.",
      removedSuccess: "Game removed.",
      removeError: "Error removing game.",
      launchGenericError: "Failed to launch the game.",
      achievementsLoading: "Loading achievements...",
      achievementsEmpty: "No achievements found.",
      achievementsLocked: "Locked",
      achievementsUnlocked: "Unlocked",
      achievementsUnlockedAt: "Unlocked on",
      verifySuccess: "Executable found.",
      verifyNotFound: "Executable not found.",
      shortcutComingSoon: "Coming soon.",
      achievementsSource: "Your achievements",
      achievementsLocalSource: "Local achievements",
      achievementsEpicLocalSource: "Epic local files",
      achievementsSteamFallback: "Steam",
      achievementsNeedSteam: "Connect your Steam account to load achievements.",
      achievementsMissingAppId: "This game has no Steam App ID.",
      achievementsEpicLocalEmpty: "No readable local achievement file found.",
      achievementsEpicBinarySave: "Binary/protected save not supported.",
      achievementsEpicNotInstalled: "Game not installed locally.",
      filterAll: "All",
      filterUnlocked: "Unlocked",
      filterLocked: "Locked",
      searchPlaceholder: "Search achievement...",
      tryAgain: "Try again",
      running: "Running",
      launch: "Play",
      launching: "Launching...",
      openFolder: "Open folder",
      confirmDeletePlaceholder: "Type the game name",
      gameRunning: "Game is running",
    },
    "es-ES": {
      tabPlay: "JUGAR",
      tabCaptures: "CAPTURAS",
      tabAchievements: "LOGROS",
      tabAbout: "ACERCA DE",
      tabManage: "GESTIONAR",
      tabMods: "MODS",
      steamLabel: "Steam",
      epicLabel: "Epic Games",
      localLabel: "PC Local",
      library: "Biblioteca",
      timePlayed: "TIEMPO JUGADO",
      lastSession: "ÚLTIMA SESIÓN",
      neverStarted: "No iniciado",
      achievements: "LOGROS",
      appId: "App ID",
      epicShortcutLabel: "Epic",
      epicShortcut: "Acceso directo",
      epicStore: "Vía tienda",
      source: "Fuente",
      sourceSteamSync: "Sync Steam",
      sourceEpicCatalog: "Catálogo Epic",
      sourceManual: "Manual",
      photoWall: "Mural de fotos",
      viewGallery: "Ver galería",
      noScreenshot: "Sin capturas",
      about: "Acerca de",
      seeMore: "Ver más →",
      popularTags: "Etiquetas populares",
      developer: "Desarrollador",
      publisher: "Distribuidora",
      releaseDate: "Fecha de lanzamiento",
      category: "Categoría",
      notInformed: "No informado",
      management: "Gestión",
      verify: "Verificar",
      edit: "Editar",
      createShortcut: "Crear acceso directo",
      remove: "Eliminar",
      platform: "Plataforma",
      noDescription: "Sin descripción.",
      gallery: "GALERÍA",
      previous: "← Anterior",
      next: "Siguiente →",
      removeGame: "Eliminar juego",
      cannotUndo: "Esta acción no se puede deshacer",
      confirmRemove: (title: string) =>
        `¿Seguro que deseas eliminar "${title}" de tu biblioteca? Escribe el nombre del juego para confirmar.`,
      cancel: "Cancelar",
      removing: "Eliminando...",
      close: "Cerrar",
      loginToRemove: "Debes iniciar sesión para eliminar un juego.",
      removedSuccess: "Juego eliminado.",
      removeError: "Error al eliminar el juego.",
      launchGenericError: "No se pudo iniciar el juego.",
      achievementsLoading: "Cargando logros...",
      achievementsEmpty: "No se encontraron logros.",
      achievementsLocked: "Bloqueado",
      achievementsUnlocked: "Desbloqueado",
      achievementsUnlockedAt: "Desbloqueado el",
      verifySuccess: "Ejecutable encontrado.",
      verifyNotFound: "Ejecutable no encontrado.",
      shortcutComingSoon: "Próximamente.",
      achievementsSource: "Tus logros",
      achievementsLocalSource: "Logros locales",
      achievementsEpicLocalSource: "Archivos locales Epic",
      achievementsSteamFallback: "Steam",
      achievementsNeedSteam: "Conecta tu cuenta de Steam para cargar logros.",
      achievementsMissingAppId: "Este juego no tiene Steam App ID.",
      achievementsEpicLocalEmpty: "No se encontró archivo local legible.",
      achievementsEpicBinarySave: "Formato binario/protegido no soportado.",
      achievementsEpicNotInstalled: "Juego no instalado localmente.",
      filterAll: "Todas",
      filterUnlocked: "Desbloqueadas",
      filterLocked: "Bloqueadas",
      searchPlaceholder: "Buscar logro...",
      tryAgain: "Reintentar",
      running: "En ejecución",
      launch: "Jugar",
      launching: "Iniciando...",
      openFolder: "Abrir carpeta",
      confirmDeletePlaceholder: "Escribe el nombre del juego",
      gameRunning: "El juego está en ejecución",
    },
  }[detailLanguage];

  const locale = language;
  const categoryLabels: Record<string, Record<string, string>> = {
    ACTION: { "pt-BR": "Ação", "en-US": "Action", "es-ES": "Acción" },
    ADVENTURE: { "pt-BR": "Aventura", "en-US": "Adventure", "es-ES": "Aventura" },
    RPG: { "pt-BR": "RPG", "en-US": "RPG", "es-ES": "RPG" },
    SPORTS: { "pt-BR": "Esportes", "en-US": "Sports", "es-ES": "Deportes" },
    RACING: { "pt-BR": "Corrida", "en-US": "Racing", "es-ES": "Carreras" },
    STRATEGY: { "pt-BR": "Estratégia", "en-US": "Strategy", "es-ES": "Estrategia" },
  };
  const localizedCategory = categoryLabels[String(game?.category || "").toUpperCase()]?.[language] || game?.category || copy.library;

  // ============================================================
  // EFECTOS EXISTENTES (mantidos)
  // ============================================================
  // (todos os useEffect originais permanecem, pois não foram alterados)
  // Apenas adicionamos novos efeitos abaixo.

  // ============================================================
  // NOVOS EFECTOS (melhorias)
  // ============================================================

  // Monitoramento de jogo em execução
  React.useEffect(() => {
    if (!isOpen || !game?.executablePath) return;
    const checkRunning = async () => {
      try {
        const running = await window.electronAPI?.isExecutableRunning(game.executablePath);
        setIsRunning(!!running);
      } catch {
        setIsRunning(false);
      }
    };
    checkRunning();
    const interval = setInterval(checkRunning, 5000);
    return () => clearInterval(interval);
  }, [isOpen, game?.executablePath]);

  // Navegação por teclado (setas para abas)
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen || galleryModalOpen || deleteModalOpen || isLaunching) return;
      const tabs = [copy.tabPlay, copy.tabAbout, copy.tabAchievements, copy.tabCaptures, copy.tabMods, copy.tabManage];
      const currentIndex = tabs.indexOf(activeTab);
      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        const nextIndex = (currentIndex + 1) % tabs.length;
        setActiveTab(tabs[nextIndex]);
        playSound("navigate");
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        const prevIndex = (currentIndex - 1 + tabs.length) % tabs.length;
        setActiveTab(tabs[prevIndex]);
        playSound("navigate");
      } else if (e.key === "Escape" && !galleryModalOpen && !deleteModalOpen) {
        onClose();
        playSound("back");
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, activeTab, galleryModalOpen, deleteModalOpen, isLaunching, copy, playSound, onClose]);

  // Forçar recarregamento de conquistas quando refetchKey mudar
  React.useEffect(() => {
    let cancelled = false;

    const loadSteamAchievements = async () => {
      setAchievementItems([]);
      setAchievementSourceAppId("");
      setAchievementsError(null);

      if (!game?.id) return;

      setIsAchievementsLoading(true);

      try {
        if (game.launcherType === "epic") {
          if (!window.electronAPI?.getEpicLocalAchievements) {
            setAchievementsError(copy.achievementsEpicLocalEmpty);
            return;
          }

          const localResult = await window.electronAPI.getEpicLocalAchievements({
            gameId: game.id,
            title: game.title,
            epicCatalogId: game.epicCatalogId,
            epicLaunchId: game.epicLaunchId,
            executablePath: game.executablePath,
          });
          if (cancelled) return;

          setAchievementSourceAppId("epic-local");
          setAchievementItems(localResult.achievements);

          if (user?.uid) {
            void updateLibraryGame(user.uid, game.id, {
              totalAchievements: localResult.total,
              completedAchievements: localResult.unlocked,
              achievementsUpdatedAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            }).catch((error) => {
              console.error("Erro ao salvar totais de conquistas da Epic:", error);
            }).then(() => onLibraryChanged?.());
          }

          if (localResult.achievements.length === 0) {
            setAchievementsError(
              localResult.status === "not-installed"
                ? copy.achievementsEpicNotInstalled
                : localResult.status === "binary-save"
                  ? copy.achievementsEpicBinarySave
                  : copy.achievementsEpicLocalEmpty,
            );
          }
          return;
        }

        let resolvedAppId = String(game.steamAppId || "").trim();

        if (!resolvedAppId) {
          const results = await searchSteamGames(game.title);
          const normalizedTitle = normalizeSteamLookup(game.title);
          const matched = results.find((candidate) => {
            const rawName =
              typeof candidate.name === "string"
                ? candidate.name
                : typeof candidate.title === "string"
                  ? candidate.title
                  : "";
            return normalizeSteamLookup(rawName) === normalizedTitle;
          });

          if (matched && matched.id != null) {
            resolvedAppId = String(matched.id).trim();
          }
        }

        if (!resolvedAppId) {
          setAchievementsError(copy.achievementsMissingAppId);
          return;
        }

        let result =
          game.launcherType === "local"
            ? await fetchSteamAchievementSchema(resolvedAppId, language)
            : userProfile?.steamId
              ? await fetchSteamAchievementDetails(
                userProfile.steamId,
                resolvedAppId,
                language,
              )
              : await fetchSteamAchievementSchema(resolvedAppId, language);

        if (cancelled) return;

        if (result.achievements && result.achievements.length > 0 && window.electronAPI?.saveLocalAchievementDefinitions) {
          try {
            await window.electronAPI.saveLocalAchievementDefinitions(
              game.id,
              result.achievements.map((ach) => ({
                id: ach.apiName,
                name: ach.name,
                description: ach.description,
                icon: ach.icon,
              })),
              String(resolvedAppId)
            );
          } catch (e) {
            console.error("Erro ao salvar definições de conquistas locais:", e);
          }
        }

        if (game.launcherType === "local" && window.electronAPI?.getLocalAchievementProgress) {
          try {
            const localProgress = await window.electronAPI.getLocalAchievementProgress(game.id);
            if (localProgress && localProgress.unlockedAchievements) {
              const mappedAchievements = result.achievements.map((ach) => {
                const unlocked = localProgress.unlockedAchievements[ach.apiName] || localProgress.unlockedAchievements[ach.apiName.toLowerCase()];
                if (unlocked) {
                  return {
                    ...ach,
                    achieved: true,
                    unlockTime: unlocked.unlockedAt ? Math.floor(new Date(unlocked.unlockedAt).getTime() / 1000) : 0,
                  };
                }
                return ach;
              });
              result = {
                achievements: mappedAchievements,
                total: mappedAchievements.length,
                unlocked: mappedAchievements.filter((a) => a.achieved).length,
              };
            }
          } catch (e) {
            console.error("Erro ao carregar progresso de conquistas locais:", e);
          }
        }

        if (game.launcherType === "local" && window.electronAPI?.getLocalAchievementState) {
          try {
            const appIdToQuery = (game.launcherType === "local" && game.id ? String(game.id).trim() : "") || resolvedAppId;
            const retroactiveState = await window.electronAPI.getLocalAchievementState(appIdToQuery);
            if (retroactiveState && Object.keys(retroactiveState).length > 0) {
              result.achievements = result.achievements.map((ach) => {
                const emuState = retroactiveState[ach.apiName] || retroactiveState[ach.apiName.toLowerCase()];
                if (emuState && emuState.earned) {
                  return {
                    ...ach,
                    achieved: true,
                    unlockTime: emuState.earnedTime || 0,
                  };
                }
                return ach;
              });
            }
          } catch (e) {
            console.error("Erro ao carregar estado retroativo do emulador:", e);
          }
        }

        setAchievementSourceAppId(resolvedAppId);
        setAchievementItems(result.achievements);

        if (user?.uid && (result.achievements.length > 0 || !game.totalAchievements)) {
          const canResolveUnlockedProgress =
            game.launcherType === "local" || Boolean(userProfile?.steamId);
          void updateLibraryGame(user.uid, game.id, {
            totalAchievements: result.achievements.length,
            completedAchievements: canResolveUnlockedProgress
              ? result.achievements.filter((achievement) => achievement.achieved).length
              : game.completedAchievements ?? 0,
            updatedAt: new Date().toISOString(),
          }).catch((error) => {
            console.error("Erro ao salvar totais de conquistas:", error);
          }).then(() => onLibraryChanged?.());
        }

        if (result.achievements.length === 0) {
          setAchievementsError(
            !userProfile?.steamId && game.launcherType !== "local"
              ? copy.achievementsNeedSteam
              : copy.achievementsEmpty,
          );
        }
      } catch {
        if (!cancelled) {
          setAchievementsError(copy.achievementsEmpty);
        }
      } finally {
        if (!cancelled) {
          setIsAchievementsLoading(false);
        }
      }
    };

    void loadSteamAchievements();

    return () => {
      cancelled = true;
    };
  }, [
    copy.achievementsEmpty,
    copy.achievementsEpicBinarySave,
    copy.achievementsEpicLocalEmpty,
    copy.achievementsEpicNotInstalled,
    copy.achievementsMissingAppId,
    copy.achievementsNeedSteam,
    game?.completedAchievements,
    game?.id,
    game?.launcherType,
    game?.steamAppId,
    game?.title,
    game?.totalAchievements,
    language,
    onLibraryChanged,
    user?.uid,
    userProfile?.steamId,
    refetchKey
  ]);

  React.useEffect(() => {
    if (!game?.id || game.launcherType !== "local") return;
    if (!window.electronAPI?.onRealtimeAchievementUnlock) return;

    const handler = window.electronAPI.onRealtimeAchievementUnlock((payload) => {
      const { achievementId, earnedTime, unlockedAt } = payload;
      const payloadSteamAppId = payload.gameId.match(/^steam_(\d+)$/i)?.[1];
      const belongsToCurrentGame = 
        String(game.id) === String(payload.gameId) ||
        (payloadSteamAppId && String(game.steamAppId || "") === payloadSteamAppId) ||
        String(game.steamAppId || "") === String(payload.gameId);
      if (!belongsToCurrentGame) return;

      setAchievementItems((prev) => {
        let changed = false;
        const next = prev.map((ach) => {
          const isMatch = ach.apiName.toLowerCase() === achievementId.toLowerCase();
          if (!isMatch || ach.achieved) return ach;
          changed = true;
          const unixSecs = earnedTime > 0 ? earnedTime : Math.floor(new Date(unlockedAt).getTime() / 1000);
          return { ...ach, achieved: true, unlockTime: unixSecs };
        });

        if (changed && user?.uid) {
          void updateLibraryGame(user.uid, game.id, {
            totalAchievements: next.length,
            completedAchievements: next.filter((achievement) => achievement.achieved).length,
            updatedAt: new Date().toISOString(),
          }).then(() => onLibraryChanged?.()).catch(() => { });
        }
        return next;
      });
    });

    return () => window.electronAPI?.removeRealtimeAchievementUnlock?.(handler);
  }, [game?.id, game?.launcherType, game?.steamAppId, onLibraryChanged, user?.uid]);

  React.useEffect(() => {
    if (game?.id && activeTab === copy.tabCaptures) {
      window.electronAPI?.getLocalGameScreenshots?.({
        title: game.title,
        launcherType: game.launcherType,
        steamAppId: game.steamAppId
      }).then((paths) => {
        setLocalScreenshots(paths || []);
      }).catch(() => { });
    }
  }, [game?.id, game?.title, game?.launcherType, game?.steamAppId, activeTab, copy.tabCaptures]);

  // ============================================================
  // FUNÇÕES DE AÇÃO (handleLaunch, handleDelete, etc.) - mantidas e ajustadas
  // ============================================================

  const handleLaunch = async () => {
    if (isLaunching || !game) return;
    setIsLaunching(true);
    setLaunchError(null);
    playSound("play");
    try {
      const [result] = await Promise.allSettled([
        launchGame(game, { hideLauncher: closeOnLaunch }),
        wait(MIN_LAUNCH_SCREEN_MS),
      ]);
      if (result.status === "rejected") throw result.reason;
      if (user?.uid) {
        updateLibraryGame(user.uid, game.id, { lastPlayedAt: new Date().toISOString() }).then(() => onLibraryChanged?.()).catch(() => undefined);
      }
      window.dispatchEvent(
        new CustomEvent("checkpoint:game-launch", {
          detail: { title: game.title, executablePath: getMonitorableExecutablePath(game) },
        }),
      );
    } catch (error) {
      setLaunchError(error instanceof Error ? error.message : copy.launchGenericError);
    } finally {
      setIsLaunching(false);
    }
  };

  const handleDeleteGame = async () => {
    if (!user?.uid) { notify(copy.loginToRemove, "error"); return; }
    if (deleteConfirmText !== game?.title) {
      notify("O nome digitado não corresponde ao jogo.", "error");
      return;
    }
    if (isDeleting) return;
    setIsDeleting(true);
    try {
      await deleteLibraryGame(user.uid, game.id);
      await onLibraryChanged?.();
      notify(copy.removedSuccess, "success");
      setDeleteModalOpen(false);
      onClose();
    } catch {
      notify(copy.removeError, "error");
    } finally {
      setIsDeleting(false);
      setDeleteConfirmText("");
    }
  };

  const handleAddAchievement = async () => {
    setIsAddAchModalOpen(false);
    setNewAchName("");
    setNewAchDesc("");
  };

  const saveLaunchProfile = async () => {
    if (!user?.uid || !game?.id || isSavingLaunchProfile) return;
    setIsSavingLaunchProfile(true);
    try {
      await updateLibraryGame(user.uid, game.id, {
        launchProfile,
        updatedAt: new Date().toISOString(),
      });
      await onLibraryChanged?.();
      notify("Perfil de inicialização salvo.", "success");
    } catch {
      notify("Não foi possível salvar o perfil de inicialização.", "error");
    } finally {
      setIsSavingLaunchProfile(false);
    }
  };

  // ============================================================
  // RENDER E COMPUTAÇÕES
  // ============================================================

  const heroImage = game?.backgroundImage || game?.image;
  const coverImage = game?.cardImage || game?.image || game?.backgroundImage;
  const hasEpicLaunchShortcut = game?.launcherType === "epic" && String(game?.epicLaunchId || game?.executablePath || game?.epicCatalogId || "").split(":").filter(Boolean).length >= 3;
  const safeAboutHtml = DOMPurify.sanitize(game?.aboutTheGame || game?.description || copy.noDescription, { ALLOWED_TAGS: ["b", "br", "em", "i", "li", "ol", "p", "strong", "ul"], ALLOWED_ATTR: [] });
  const achievementsTotal = game?.totalAchievements ?? 0;
  const achievementsDone = game?.completedAchievements ?? 0;
  const detailedAchievementsUnlocked = achievementItems.filter((achievement) => achievement.achieved).length;

  const lastSessionSource = game?.launcherType === "steam" ? game?.steamLastPlayedAt || game?.lastPlayedAt : game?.lastPlayedAt;
  const lastSession = lastSessionSource ? new Date(lastSessionSource).toLocaleDateString(locale) : copy.neverStarted;
  const platformLabel = game?.launcherType === "steam" ? copy.steamLabel : game?.launcherType === "epic" ? copy.epicLabel : copy.localLabel;
  const aboutPreview = (game?.aboutTheGame || game?.description || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  const achievementSourceLabel = achievementSourceAppId === "epic-local" ? copy.achievementsEpicLocalSource : achievementSourceAppId ? copy.steamLabel : copy.achievementsSteamFallback;

  const formatHours = (hours: number = 0) => {
    const h = Math.floor(hours);
    const m = Math.floor((hours - h) * 60);
    return `${h}H ${m}M`;
  };

  const formatAchievementDate = (unixTime: number) => {
    if (!unixTime || unixTime <= 0) return null;
    try {
      return new Date(unixTime * 1000).toLocaleString(locale, {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return null;
    }
  };

  // Filtragem e ordenação de conquistas
  const filteredAchievements = React.useMemo(() => {
    let filtered = achievementItems;
    if (achievementFilter === "unlocked") filtered = filtered.filter(a => a.achieved);
    if (achievementFilter === "locked") filtered = filtered.filter(a => !a.achieved);
    if (achievementSearch.trim()) {
      const search = achievementSearch.toLowerCase().trim();
      filtered = filtered.filter(a =>
        a.name.toLowerCase().includes(search) ||
        (a.description && a.description.toLowerCase().includes(search))
      );
    }
    return filtered;
  }, [achievementItems, achievementFilter, achievementSearch]);

  const sortedAchievements = React.useMemo(() => {
    return [...filteredAchievements].sort((a, b) => {
      if (a.achieved !== b.achieved) return a.achieved ? -1 : 1;
      return (b.unlockTime || 0) - (a.unlockTime || 0);
    });
  }, [filteredAchievements]);

  const mostRecentAchievement = sortedAchievements.find(a => a.achieved);
  const otherAchievements = mostRecentAchievement ? sortedAchievements.filter(a => a.apiName !== mostRecentAchievement.apiName) : sortedAchievements;

  // ============================================================
  // SUBCOMPONENTES INTERNOS (Skeletons, etc.)
  // ============================================================

  const AchievementSkeleton: React.FC = () => (
    <div className="flex items-center gap-4 animate-pulse">
      <div className="w-12 h-12 rounded-xl bg-white/10" />
      <div className="flex-1 space-y-2">
        <div className="h-4 w-3/4 bg-white/10 rounded" />
        <div className="h-3 w-1/2 bg-white/10 rounded" />
      </div>
      <div className="w-16 h-6 bg-white/10 rounded-lg" />
    </div>
  );

  const ScreenshotSkeleton: React.FC = () => (
    <div className="aspect-video rounded-2xl bg-white/5 animate-pulse" />
  );

  // ============================================================
  // JSX
  // ============================================================

  const TABS = [copy.tabPlay, copy.tabAbout, copy.tabAchievements, copy.tabCaptures, copy.tabMods, copy.tabManage];
  const activeManagedMods = gameMods.filter((mod) => mod.enabled && mod.manifestPath).length;
  const modsPanelCopy = detailLanguage === "pt-BR"
    ? { title: "Mods deste jogo", summary: `${activeManagedMods} ativos de ${gameMods.length}`, empty: "Nenhum mod foi associado a este jogo.", manage: "Gerenciar mods", active: "Ativo", downloaded: "Baixado", verify: "Verificação necessária" }
    : { title: "Mods for this game", summary: `${activeManagedMods} active of ${gameMods.length}`, empty: "No mods are associated with this game.", manage: "Manage mods", active: "Active", downloaded: "Downloaded", verify: "Verification required" };

  // Hook de navegação gamepad (existente)
  useGamepadNavigation({
    onClose: () => {
      if (galleryModalOpen) {
        setGalleryModalOpen(false);
        playSound("modalClose");
      } else if (deleteModalOpen) {
        setDeleteModalOpen(false);
        playSound("back");
        setDeleteConfirmText("");
      } else if (isAddAchModalOpen) {
        setIsAddAchModalOpen(false);
        playSound("back");
      } else if (isOpen && !isLaunching) {
        onClose();
        playSound("back");
      }
    },
    scrollRef: scrollRef as React.RefObject<HTMLElement>,
    scrollSpeed: 25,
    disableX: true,
    disableO: false,
    enabled: isOpen,
  });

  useGamepadButton("L1", () => {
    if (!isOpen || deleteModalOpen || galleryModalOpen || isAddAchModalOpen || isLaunching) return;
    const i = TABS.indexOf(activeTab);
    if (i > 0) {
      setActiveTab(TABS[i - 1]);
      playSound("navigate");
    }
  });

  useGamepadButton("R1", () => {
    if (!isOpen || deleteModalOpen || galleryModalOpen || isAddAchModalOpen || isLaunching) return;
    const i = TABS.indexOf(activeTab);
    if (i >= 0 && i < TABS.length - 1) {
      setActiveTab(TABS[i + 1]);
      playSound("navigate");
    }
  });

  useGamepadButton("X", () => {
    if (!isOpen || galleryModalOpen || deleteModalOpen || isAddAchModalOpen || isLaunching) return;
    handleLaunch();
  });

  useGamepadButton("SQUARE", () => {
    if (!isOpen || galleryModalOpen || deleteModalOpen || isAddAchModalOpen || isLaunching) return;
    if (!game?.screenshots?.length) return;
    setGalleryModalOpen(true);
    setCurrentGalleryIndex(0);
    playSound("select");
  });

  useGamepadButton("DPAD_LEFT", () => {
    if (!galleryModalOpen) return;
    setCurrentGalleryIndex((c) => c > 0 ? c - 1 : (game?.screenshots?.length ?? 1) - 1);
    playSound("navigate");
  }, isOpen && galleryModalOpen, 100);

  useGamepadButton("DPAD_RIGHT", () => {
    if (!galleryModalOpen) return;
    setCurrentGalleryIndex((c) => c < (game?.screenshots?.length ?? 1) - 1 ? c + 1 : 0);
    playSound("navigate");
  }, isOpen && galleryModalOpen, 100);

  if (!game) return null;

  return (
    <AnimatePresence mode="wait">
      {isOpen && (
        <motion.div
          key="detail-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.3 } }}
          className="fixed inset-0 z-100 bg-[#050505] overflow-y-auto thin-scrollbar"
          ref={scrollRef as React.RefObject<HTMLDivElement>}
          role="dialog"
          aria-modal="true"
          aria-label={`Detalhes de ${game.title}`}
        >
          <div className="fixed bottom-6 right-8 z-[120] pointer-events-none">
            <InputHints hints={galleryModalOpen ? [
              { button: "DPAD", label: "Navegar" },
              { button: "O", label: "Fechar" },
            ] : [
              { button: "X", label: "Jogar" },
              { button: "SQUARE", label: "Fotos" },
              { button: "O", label: "Voltar" },
              { button: "SCROLL", label: "Scroll" },
              { button: "L1_R1", label: "Abas" },
            ]} />
          </div>

          <button
            onClick={onClose}
            aria-label={copy.close}
            className="fixed top-8 right-8 z-[150] p-4 bg-black/40 backdrop-blur-md border border-white/10 rounded-full hover:bg-white/10 transition-all hover:rotate-90 active:scale-90 cursor-pointer shadow-xl"
          >
            <X className="w-5 h-5 text-white" />
          </button>

          {/* Fundo Hero */}
          <div className="fixed top-0 left-0 right-0 h-[65vh] pointer-events-none z-0">
            <motion.img
              initial={{ scale: 1.05, opacity: 0 }}
              animate={{ scale: 1, opacity: 0.65 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.5, ease: "easeOut" }}
              src={heroImage || undefined}
              alt=""
              className="w-full h-full object-cover"
              loading="eager"
              decoding="async"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-[#050505]/40 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-transparent" />
          </div>

          <div className="relative z-10 w-full min-h-screen flex flex-col pt-[45vh]">
            <motion.div
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className="flex-1 w-full bg-[#050505]/95 backdrop-blur-3xl border-t border-white/10 rounded-t-[40px] shadow-[0_-20px_50px_rgba(0,0,0,0.8)] pb-24"
            >
              <div className="max-w-5xl w-full mx-auto px-4 sm:px-8 md:px-12 py-10">

                {/* Header */}
                <div className="flex flex-col sm:flex-row items-start sm:items-end gap-6 sm:gap-8 mb-8">
                  <div className="w-28 sm:w-32 h-40 sm:h-44 rounded-2xl overflow-hidden shrink-0 border border-white/15 shadow-[0_8px_40px_rgba(0,0,0,0.7)] ring-1 ring-white/5 -mt-24 relative z-20 bg-black">
                    <img src={coverImage || undefined} alt={game.title} className="w-full h-full object-cover" />
                  </div>

                  <div className="flex-1 min-w-0 pb-2">
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                      <h1 className="text-3xl sm:text-5xl font-display font-black tracking-tight text-white mb-3 leading-[0.95] truncate">{game.title}</h1>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-white/[0.06] border border-white/10 text-[9px] font-black tracking-[0.25em] text-white/60 uppercase">{platformLabel}</span>
                        {localizedCategory && localizedCategory.toUpperCase() !== platformLabel.toUpperCase() && <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-white/[0.04] border border-white/[0.07] text-[9px] font-black tracking-[0.25em] text-white/40 uppercase">{localizedCategory}</span>}
                        {isRunning && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-green-500/20 border border-green-500/30 text-[9px] font-black tracking-[0.25em] text-green-400 uppercase">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                            {copy.running}
                          </span>
                        )}
                      </div>
                    </motion.div>
                  </div>

                  <div className="shrink-0 w-full sm:w-[220px] pb-2">
                    <ShinyButton
                      onClick={handleLaunch}
                      disabled={isLaunching || isRunning}
                      onMouseEnter={() => playSound("hover")}
                      className="!w-full !flex !items-center !justify-center shadow-[0_0_24px_rgba(255,255,255,0.12)]"
                    >
                      {activeInputType === "gamepad" && isGamepadConnected ? (
                        <span
                          className="w-5 h-5 rounded-full bg-black border border-white/15 flex items-center justify-center shrink-0 overflow-hidden group-hover:scale-110 transition-transform [&>svg]:w-[14px] [&>svg]:h-[14px] [&>svg]:object-contain"
                          dangerouslySetInnerHTML={{
                            __html: DOMPurify.sanitize(
                              (() => {
                                const raw = gamepadFamily === "xbox" ? xboxA : psCross;
                                let svg = raw;
                                if (!svg.includes("viewBox=")) {
                                  svg = svg.replace(/<svg([^>]*)width="(\d+)"([^>]*)height="(\d+)"([^>]*)>/, '<svg$1$3$5 viewBox="0 0 $2 $4">');
                                }
                                return svg.replace(/\swidth="[^"]*"/, "").replace(/\sheight="[^"]*"/, "").replace("<svg ", '<svg style="width:100%;height:100%;display:block" ');
                              })(),
                              { USE_PROFILES: { svg: true } }
                            ),
                          }}
                        />
                      ) : (
                        <Play className={`w-4 h-4 fill-white text-white shrink-0 transition-transform duration-300 group-hover:scale-115 ${isLaunching ? "animate-pulse" : ""}`} />
                      )}
                      <span className="font-display font-black tracking-widest text-white text-sm">
                        {isLaunching ? copy.launching : isRunning ? copy.running : copy.launch}
                      </span>
                    </ShinyButton>
                    {launchError && <p className="mt-2 text-[10px] text-white/80 max-w-[220px] text-center">{launchError}</p>}
                  </div>
                </div>

                {/* Abas */}
                <div className="flex items-center gap-4 sm:gap-8 border-b border-white/10 mb-10 overflow-x-auto hide-scrollbar" role="tablist">
                  <NavTab label={copy.tabPlay} active={activeTab === copy.tabPlay} onClick={() => { setActiveTab(copy.tabPlay); playSound("navigate"); }} id="tab-play" controls="panel-play" />
                  <NavTab label={copy.tabAbout} active={activeTab === copy.tabAbout} onClick={() => { setActiveTab(copy.tabAbout); playSound("navigate"); }} id="tab-about" controls="panel-about" />
                  <NavTab label={copy.tabAchievements} active={activeTab === copy.tabAchievements} onClick={() => { setActiveTab(copy.tabAchievements); playSound("navigate"); }} id="tab-achievements" controls="panel-achievements" />
                  <NavTab label={copy.tabCaptures} active={activeTab === copy.tabCaptures} onClick={() => { setActiveTab(copy.tabCaptures); playSound("navigate"); }} id="tab-captures" controls="panel-captures" />
                  <NavTab label={copy.tabMods} active={activeTab === copy.tabMods} onClick={() => { setActiveTab(copy.tabMods); playSound("navigate"); }} id="tab-mods" controls="panel-mods" />
                  <NavTab label={copy.tabManage} active={activeTab === copy.tabManage} onClick={() => { setActiveTab(copy.tabManage); playSound("navigate"); }} id="tab-manage" controls="panel-manage" />
                </div>

                {/* Conteúdo */}
                <AnimatePresence mode="wait" initial={false}>
                  {activeTab === copy.tabPlay && (
                    <motion.div key="panel-play" role="tabpanel" id="panel-play" aria-labelledby="tab-play" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.24 }} className="w-full flex flex-col gap-10">
                      {/* Stats */}
                      <div className="flex flex-col gap-4">
                        <div className="flex flex-wrap items-center gap-4 sm:gap-8">
                          <div className="flex items-baseline gap-2">
                            <span className="text-3xl sm:text-5xl font-black text-white tracking-tighter" style={{ textShadow: "0 0 30px rgba(255,255,255,0.15)" }}>
                              {achievementItems.length ? detailedAchievementsUnlocked : achievementsDone}
                            </span>
                            <span className="text-sm font-bold text-white/35 uppercase tracking-widest">
                              / {achievementItems.length || achievementsTotal} {copy.achievements}
                            </span>
                          </div>
                          <div className="w-px h-12 bg-gradient-to-b from-transparent via-white/15 to-transparent shrink-0 hidden sm:block" />
                          <div className="flex flex-col gap-0.5">
                            <span className="text-[9px] font-black text-white/35 uppercase tracking-[0.28em]">{copy.timePlayed}</span>
                            <span className="text-xl font-black text-white/90 tracking-tight">{formatHours(game.hoursPlayed)}</span>
                          </div>
                          <div className="w-px h-12 bg-gradient-to-b from-transparent via-white/15 to-transparent shrink-0 hidden sm:block" />
                          <div className="flex flex-col gap-0.5">
                            <span className="text-[9px] font-black text-white/35 uppercase tracking-[0.28em]">{copy.lastSession}</span>
                            <span className="text-xl font-black text-white/90 tracking-tight">{lastSession}</span>
                          </div>
                        </div>
                        {(achievementItems.length || achievementsTotal) > 0 && (
                          <div className="w-full h-[3px] rounded-full bg-white/[0.06] overflow-hidden">
                            <motion.div
                              className="h-full rounded-full bg-white/50"
                              initial={{ width: 0 }}
                              animate={{ width: `${Math.min(100, ((achievementItems.length ? detailedAchievementsUnlocked : achievementsDone) / (achievementItems.length || achievementsTotal)) * 100)}%` }}
                              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay: 0.3 }}
                            />
                          </div>
                        )}
                      </div>

                      <div className="inline-flex flex-wrap items-center gap-3 px-4 py-2.5 rounded-2xl bg-white/[0.04] border border-white/[0.07] self-start">
                        {game.launcherType === "steam" && (
                          <span className="text-[9px] font-black text-white/35 uppercase tracking-[0.22em]">{copy.appId} <span className="text-white/70 ml-1.5">{game.steamAppId || "---"}</span></span>
                        )}
                        {game.launcherType === "epic" && (
                          <span className="text-[9px] font-black text-white/35 uppercase tracking-[0.22em]">{copy.epicShortcutLabel} <span className="text-white/70 ml-1.5">{hasEpicLaunchShortcut ? copy.epicShortcut : copy.epicStore}</span></span>
                        )}
                        {(game.launcherType === "steam" || game.launcherType === "epic") && (
                          <span className="h-3 w-px bg-white/10" />
                        )}
                        <span className="text-[9px] font-black text-white/35 uppercase tracking-[0.22em]">{copy.source} <span className="text-white/70 ml-1.5">{game.source === "steam" ? copy.sourceSteamSync : game.source === "epic" ? copy.sourceEpicCatalog : copy.sourceManual}</span></span>
                      </div>

                      {/* Photo Wall */}
                      <div className="w-full">
                        <h3 className="text-[10px] font-black tracking-[0.28em] text-white/35 uppercase mb-4 flex items-center gap-2">
                          <Camera className="w-3 h-3" /> {copy.photoWall}
                          {game.screenshots && game.screenshots.length > 0 && (
                            <span className="ml-1 px-2 py-0.5 rounded-md bg-white/[0.07] border border-white/10 text-[9px] font-black text-white/40">{game.screenshots.length}</span>
                          )}
                        </h3>
                        {game.screenshots && game.screenshots.length > 0 ? (
                          <div className="flex flex-col sm:flex-row gap-3">
                            <div onClick={() => { setGalleryModalOpen(true); setCurrentGalleryIndex(0); playSound("select"); }} className="flex-1 rounded-[20px] overflow-hidden border border-white/10 relative group cursor-pointer h-[200px] sm:h-[260px] shadow-xl min-w-0">
                              <img src={game.screenshots[game.screenshots.length - 1] || undefined} alt="" className="w-full h-full object-cover group-hover:scale-105 will-change-transform transition-transform duration-700 ease-out" />
                              <div className={`absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex items-end p-5 transition-opacity duration-300 ${activeInputType === "gamepad" && isGamepadConnected ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}>
                                <span className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-black/70 backdrop-blur-md border border-white/10 text-white text-[10px] font-black tracking-wider shadow-[0_0_15px_rgba(0,0,0,0.5)]">
                                  {activeInputType === "gamepad" && isGamepadConnected ? (
                                    <>
                                      <span
                                        className="w-3.5 h-3.5 opacity-80 [&>svg]:w-full [&>svg]:h-full"
                                        dangerouslySetInnerHTML={{
                                          __html: DOMPurify.sanitize(
                                            (() => {
                                              const raw = gamepadFamily === "xbox" ? xboxX : psSquare;
                                              let svg = raw;
                                              if (!svg.includes("viewBox=")) {
                                                svg = svg.replace(/<svg([^>]*)width="(\d+)"([^>]*)height="(\d+)"([^>]*)>/, '<svg$1$3$5 viewBox="0 0 $2 $4">');
                                              }
                                              return svg.replace(/\swidth="[^"]*"/, "").replace(/\sheight="[^"]*"/, "").replace("<svg ", '<svg style="width:100%;height:100%;display:block" ');
                                            })(),
                                            { USE_PROFILES: { svg: true } }
                                          ),
                                        }}
                                      />
                                      ABRIR
                                    </>
                                  ) : (
                                    <>
                                      <Camera className="w-3.5 h-3.5" /> {copy.viewGallery}
                                    </>
                                  )}
                                </span>
                              </div>
                            </div>
                            {game.screenshots.length > 1 && (
                              <div className="flex sm:flex-col gap-3 w-full sm:w-[120px] shrink-0 flex-row sm:flex-col">
                                {game.screenshots.slice(0, Math.min(3, game.screenshots.length - 1)).map((src, i) => (
                                  <div
                                    key={i}
                                    onClick={() => { setGalleryModalOpen(true); setCurrentGalleryIndex(i); playSound("select"); }}
                                    className="rounded-[14px] overflow-hidden border border-white/10 cursor-pointer hover:border-white/30 transition-all duration-200 hover:scale-[1.02] flex-1"
                                  >
                                    <img src={src || undefined} alt="" className="w-full h-full object-cover" />
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="rounded-[20px] border border-white/[0.07] bg-white/[0.03] flex flex-col items-center justify-center gap-3 text-white/30 h-[200px] sm:h-[260px] w-full">
                            <Camera className="w-6 h-6 opacity-40" />
                            <span className="text-[10px] uppercase tracking-widest font-black text-white/25">{copy.noScreenshot}</span>
                          </div>
                        )}
                      </div>

                      {aboutPreview && (
                        <div className="w-full">
                          <div className="flex items-center justify-between mb-4">
                            <h3 className="text-[10px] font-black tracking-[0.28em] text-white/35 uppercase">{copy.about}</h3>
                            <button onClick={() => { setActiveTab(copy.tabAbout); playSound("navigate"); }} className="text-[10px] font-bold text-white/40 hover:text-white uppercase tracking-widest transition-colors">{copy.seeMore}</button>
                          </div>
                          <p className="line-clamp-3 text-white/65 text-sm leading-[1.8]">{aboutPreview}</p>
                        </div>
                      )}
                    </motion.div>
                  )}

                  {activeTab === copy.tabAbout && (
                    <motion.div key="panel-about" role="tabpanel" id="panel-about" aria-labelledby="tab-about" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="w-full flex flex-col gap-8">
                      <div>
                        <h3 className="text-[10px] font-black tracking-[0.28em] text-white/35 uppercase mb-4">{copy.about}</h3>
                        <div className="text-white/70 leading-relaxed text-sm prose prose-invert prose-p:my-0 pb-2" dangerouslySetInnerHTML={{ __html: safeAboutHtml }} />
                      </div>
                      <div className="grid grid-cols-2 gap-y-6 gap-x-12 pt-6 border-t border-white/[0.07]">
                        <TechnicalDetail label={copy.developer} value={game.developer} fallback={copy.notInformed} />
                        <TechnicalDetail label={copy.publisher} value={game.publisher} fallback={copy.notInformed} />
                        <TechnicalDetail label={copy.releaseDate} value={game.releaseDate} fallback={copy.notInformed} />
                        <TechnicalDetail label={copy.category} value={localizedCategory} fallback={copy.notInformed} />
                      </div>
                      {game.tags && game.tags.length > 0 && (
                        <div>
                          <h3 className="text-[10px] font-black tracking-[0.28em] text-white/35 uppercase mb-3">{copy.popularTags}</h3>
                          <div className="flex flex-wrap gap-2">
                            {game.tags.slice(0, 15).map((tag, i) => (
                              <span key={i} className="px-3 py-1.5 rounded-lg bg-white/[0.05] border border-white/[0.08] text-[10px] font-semibold text-white/65 tracking-wide">{tag}</span>
                            ))}
                          </div>
                        </div>
                      )}
                    </motion.div>
                  )}

                  {activeTab === copy.tabAchievements && (
                    <motion.div key="panel-achievements" role="tabpanel" id="panel-achievements" aria-labelledby="tab-achievements" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="w-full flex flex-col gap-6">
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between rounded-2xl border border-white/[0.08] bg-white/[0.04] px-6 py-5 gap-4">
                        <div>
                          <p className="mb-1.5 text-[9px] font-black uppercase tracking-[0.28em] text-white/35">{copy.achievementsSource}</p>
                          <p className="text-base font-bold text-white/90">{achievementSourceLabel}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[9px] font-black uppercase tracking-[0.24em] text-white/35 mb-1.5">{copy.achievements}</p>
                          <p className="text-2xl font-black text-white" style={{ textShadow: "0 0 20px rgba(255,255,255,0.15)" }}>{achievementItems.length ? `${detailedAchievementsUnlocked}/${achievementItems.length}` : `${achievementsDone}/${achievementsTotal}`}</p>
                        </div>
                      </div>

                      {/* Filtros e busca */}
                      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
                        <div className="flex gap-2">
                          <button
                            onClick={() => setAchievementFilter("all")}
                            className={`px-3 py-1.5 rounded-lg border text-[10px] font-black uppercase tracking-wider transition-all ${achievementFilter === "all" ? "border-white/40 bg-white/10 text-white" : "border-white/10 bg-white/5 text-white/40 hover:border-white/30 hover:text-white/70"
                              }`}
                          >
                            {copy.filterAll}
                          </button>
                          <button
                            onClick={() => setAchievementFilter("unlocked")}
                            className={`px-3 py-1.5 rounded-lg border text-[10px] font-black uppercase tracking-wider transition-all ${achievementFilter === "unlocked" ? "border-white/40 bg-white/10 text-white" : "border-white/10 bg-white/5 text-white/40 hover:border-white/30 hover:text-white/70"
                              }`}
                          >
                            {copy.filterUnlocked}
                          </button>
                          <button
                            onClick={() => setAchievementFilter("locked")}
                            className={`px-3 py-1.5 rounded-lg border text-[10px] font-black uppercase tracking-wider transition-all ${achievementFilter === "locked" ? "border-white/40 bg-white/10 text-white" : "border-white/10 bg-white/5 text-white/40 hover:border-white/30 hover:text-white/70"
                              }`}
                          >
                            {copy.filterLocked}
                          </button>
                        </div>
                        <div className="relative flex-1 min-w-[180px]">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                          <input
                            type="text"
                            placeholder={copy.searchPlaceholder}
                            value={achievementSearch}
                            onChange={(e) => setAchievementSearch(e.target.value)}
                            className="w-full rounded-xl border border-white/10 bg-black/40 pl-9 pr-4 py-2 text-xs text-white placeholder-white/20 focus:border-white/40 focus:outline-none"
                            aria-label="Buscar conquista"
                          />
                        </div>
                      </div>

                      {/* Loading com skeleton */}
                      {isAchievementsLoading && (
                        <div className="flex flex-col gap-4 min-h-[200px] justify-center">
                          <AchievementSkeleton />
                          <AchievementSkeleton />
                          <AchievementSkeleton />
                          <AchievementSkeleton />
                        </div>
                      )}

                      {/* Erro com botão "Tentar novamente" */}
                      {!isAchievementsLoading && achievementsError && achievementItems.length === 0 && (
                        <div className="flex flex-col items-center justify-center gap-3 min-h-[200px] border border-dashed border-white/[0.08] rounded-2xl p-6 text-center">
                          <AlertCircle className="w-8 h-8 text-white/30" />
                          <p className="text-sm text-white/50">{achievementsError}</p>
                          <button
                            onClick={() => setRefetchKey(prev => prev + 1)}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-white/20 bg-white/5 text-[10px] font-black uppercase tracking-widest text-white/70 hover:bg-white/10 hover:text-white transition-colors"
                          >
                            <RotateCw className="w-3.5 h-3.5" />
                            {copy.tryAgain}
                          </button>
                        </div>
                      )}

                      {/* Lista de conquistas */}
                      {!isAchievementsLoading && achievementItems.length > 0 && (
                        <div className="flex flex-col gap-6">
                          {mostRecentAchievement && (
                            <div>
                              <h3 className="text-[10px] font-black tracking-[0.28em] text-white/35 uppercase mb-3">Conquista Mais Recente</h3>
                              <AchievementRow achievement={mostRecentAchievement} featured lockedLabel={copy.achievementsLocked} unlockedLabel={copy.achievementsUnlocked} unlockedAtLabel={copy.achievementsUnlockedAt} formatDate={formatAchievementDate} />
                            </div>
                          )}
                          {otherAchievements.length > 0 && (
                            <div className="flex flex-col gap-3">
                              {mostRecentAchievement && <div className="w-full h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent mt-2" />}
                              <h3 className="text-[10px] font-black tracking-[0.28em] text-white/35 uppercase">Todas as Conquistas</h3>
                              {otherAchievements.map((achievement) => (
                                <AchievementRow key={achievement.apiName} achievement={achievement} lockedLabel={copy.achievementsLocked} unlockedLabel={copy.achievementsUnlocked} unlockedAtLabel={copy.achievementsUnlockedAt} formatDate={formatAchievementDate} />
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </motion.div>
                  )}

                  {activeTab === copy.tabCaptures && (
                    <motion.div key="panel-captures" role="tabpanel" id="panel-captures" aria-labelledby="tab-captures" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="w-full flex flex-col gap-6">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-[10px] font-black tracking-[0.28em] text-white/35 uppercase">Capturas ({localScreenshots.length})</h3>
                        {localScreenshots.length > 0 && (
                          <button
                            onClick={() => {
                              const dir = game.executablePath?.replace(/[^/\\]+$/, '') || '';
                              if (dir) window.electronAPI?.openPath?.(dir);
                            }}
                            className="flex items-center gap-1.5 text-[10px] font-bold text-white/40 hover:text-white transition-colors"
                          >
                            <FolderOpen className="w-3.5 h-3.5" />
                            {copy.openFolder}
                          </button>
                        )}
                      </div>

                      {localScreenshots.length === 0 ? (
                        <div className="flex min-h-[220px] flex-col items-center justify-center rounded-[24px] border border-dashed border-white/10 bg-white/5 text-center">
                          <Camera className="mb-4 h-8 w-8 text-white/20" />
                          <p className="text-sm font-semibold text-white/50">{copy.noScreenshot}</p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                          {localScreenshots.map((src, idx) => (
                            <div key={idx} className="group relative rounded-2xl overflow-hidden border border-white/10 aspect-video cursor-pointer" onClick={() => {
                              window.electronAPI?.openPath?.(src);
                              playSound("select");
                            }}>
                              <img src={src} alt="Capture" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" loading="lazy" />
                              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <span className="text-[10px] font-bold text-white uppercase tracking-widest px-4 py-2 bg-white/10 rounded-full backdrop-blur-md">Abrir Imagem</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </motion.div>
                  )}

                  {activeTab === copy.tabMods && (
                    <motion.div key="panel-mods" role="tabpanel" id="panel-mods" aria-labelledby="tab-mods" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="w-full">
                      <ModsSummaryBanner installedModsCount={gameMods.length} activeModsCount={gameMods.filter((m) => m.enabled).length} onOpenFullModManager={() => { playSound("select"); onOpenMods?.(); }} />
                      <div className="mb-6 flex items-center justify-between">
                        <div>
                          <h3 className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.28em] text-white/35"><PackageOpen className="h-3.5 w-3.5" /> {modsPanelCopy.title}</h3>
                          <p className="mt-2 text-xs text-white/40">{modsPanelCopy.summary}</p>
                        </div>
                        <button onClick={() => { playSound("select"); onOpenMods?.(); }} className="rounded-xl border border-white/[0.08] bg-white/[0.04] px-5 py-3 text-[10px] font-black uppercase tracking-widest text-white/60 transition hover:bg-white/10 hover:text-white">{modsPanelCopy.manage}</button>
                      </div>

                      {gameMods.length === 0 ? (
                        <div className="flex min-h-[220px] flex-col items-center justify-center rounded-[24px] border border-dashed border-white/10 bg-white/5 text-center">
                          <PackageOpen className="mb-4 h-8 w-8 text-white/20" />
                          <p className="text-sm font-semibold text-white/50">{modsPanelCopy.empty}</p>
                        </div>
                      ) : (
                        <div className="grid gap-3">
                          {gameMods.map((mod) => {
                            const isManagedActive = mod.enabled && Boolean(mod.manifestPath);
                            const needsVerification = mod.enabled && !mod.manifestPath;
                            return (
                              <div key={mod.id} className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/5 p-3 transition-colors hover:bg-white/10">
                                <div className="h-14 w-20 shrink-0 overflow-hidden rounded-xl bg-white/5">
                                  {mod.pictureUrl ? <img src={mod.pictureUrl} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center"><PackageOpen className="h-5 w-5 text-white/20" /></div>}
                                </div>
                                <p className="min-w-0 flex-1 truncate text-sm font-bold text-white/80">{mod.name}</p>
                                <span className={`shrink-0 rounded-lg border px-3 py-1.5 text-[9px] font-black uppercase tracking-wider ${isManagedActive ? "border-white/40 bg-white/10 text-white shadow-[0_0_10px_rgba(255,255,255,0.1)]" : needsVerification ? "border-white/20 bg-white/5 text-white/60" : "border-transparent text-white/40"}`}>
                                  {isManagedActive ? modsPanelCopy.active : needsVerification ? modsPanelCopy.verify : modsPanelCopy.downloaded}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </motion.div>
                  )}

                  {activeTab === copy.tabManage && (
                    <motion.div key="panel-manage" role="tabpanel" id="panel-manage" aria-labelledby="tab-manage" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="w-full flex flex-col gap-6">
                      <h3 className="text-[10px] font-black tracking-[0.28em] text-white/35 uppercase">{copy.management}</h3>

                      <div className="px-5 py-4 rounded-2xl border border-white/[0.08] bg-white/[0.04] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <span className="text-white/60 text-xs truncate font-mono">{game.executablePath || "—"}</span>
                        <div className="flex items-center gap-2 flex-wrap">
                          <button
                            onClick={async () => {
                              if (!game.executablePath) return;
                              try {
                                const running = await window.electronAPI?.isExecutableRunning(game.executablePath);
                                notify(running !== undefined ? copy.verifySuccess : copy.verifyNotFound, running !== undefined ? "success" : "error");
                              } catch { notify(copy.verifyNotFound, "error"); }
                            }}
                            className="shrink-0 text-[9px] font-black text-white/50 uppercase tracking-[0.24em] px-4 py-2 rounded-xl border border-white/[0.08] bg-white/[0.04] hover:bg-white/10 hover:text-white transition-all"
                          >
                            {copy.verify}
                          </button>
                          {game.executablePath && (
                            <button
                              onClick={() => {
                                const path = game.executablePath?.replace(/[^/\\]+$/, '');
                                if (path) window.electronAPI?.openPath?.(path);
                              }}
                              className="shrink-0 text-[9px] font-black text-white/50 uppercase tracking-[0.24em] px-4 py-2 rounded-xl border border-white/[0.08] bg-white/[0.04] hover:bg-white/10 hover:text-white transition-all"
                            >
                              {copy.openFolder}
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="rounded-[24px] border border-white/[0.08] bg-white/[0.04] p-6">
                        <div className="mb-6 flex flex-col sm:flex-row items-start justify-between gap-4">
                          <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.28em] text-white/35 mb-1">Perfil de inicialização</p>
                            <p className="text-xs text-white/40">Aplicado a jogos locais iniciados pelo desktop.</p>
                          </div>
                          <button type="button" disabled={isSavingLaunchProfile || !user?.uid} onClick={() => void saveLaunchProfile()} className="shrink-0 cursor-pointer rounded-xl bg-white px-5 py-2.5 text-[10px] font-black uppercase tracking-widest text-black shadow-[0_0_15px_rgba(255,255,255,0.15)] transition-all hover:bg-white/90 disabled:opacity-40">
                            {isSavingLaunchProfile ? "Salvando..." : "Salvar perfil"}
                          </button>
                        </div>
                        <AdvancedLaunchSettings
                          monitorIndex={launchProfile.monitorId ?? 0}
                          onMonitorChange={(monitorId) => setLaunchProfile((curr) => ({ ...curr, monitorId }))}
                          resolution={launchProfile.resolutionWidth && launchProfile.resolutionHeight ? `${launchProfile.resolutionWidth}x${launchProfile.resolutionHeight}` : "Native"}
                          onResolutionChange={(res) => {
                            const [w, h] = res.split("x").map(Number);
                            setLaunchProfile((curr) => ({ ...curr, resolutionWidth: w || null, resolutionHeight: h || null }));
                          }}
                          processPriority={launchProfile.processPriority || "Normal"}
                          onPriorityChange={(processPriority) => setLaunchProfile((curr) => ({ ...curr, processPriority: processPriority as GameLaunchProfile["processPriority"] }))}
                          commandLineArgs={launchProfile.arguments || ""}
                          onArgsChange={(args) => setLaunchProfile((curr) => ({ ...curr, arguments: args }))}
                          workingDirectory={launchProfile.workingDirectory || ""}
                          onWorkDirChange={(workingDirectory) => setLaunchProfile((curr) => ({ ...curr, workingDirectory }))}
                        />
                      </div>

                      <div className="mt-4 pt-4 border-t border-white/[0.06]">
                        <button
                          onClick={() => setDeleteModalOpen(true)}
                          className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.24em] text-red-400/70 hover:text-red-400 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          {copy.removeGame}
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          </div>

          {/* ============================================================
              GALERIA
              ============================================================ */}
          <ModalShell
            isOpen={Boolean(galleryModalOpen && game.screenshots && game.screenshots.length > 0)}
            onClose={() => { setGalleryModalOpen(false); playSound("modalClose"); }}
            maxWidthClassName="max-w-none w-full h-full"
            className="p-0 bg-transparent border-0 shadow-none h-full"
            backdropClassName="bg-transparent"
            zIndexClassName="z-[150]"
            reducedEffects
          >
            <div className="fixed inset-0 w-full h-full bg-[radial-gradient(circle_at_center,rgba(0,0,0,0.6)_0%,rgba(0,0,0,0.95)_100%)] backdrop-blur-sm pointer-events-none" />
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center">
              <div className="absolute top-0 left-0 right-0 p-4 sm:p-6 flex justify-between items-center z-50 bg-gradient-to-b from-black/80 to-transparent">
                <div className="flex items-center gap-4">
                  <span className="text-sm sm:text-base font-bold text-white shadow-sm">{game.title}</span>
                  <span className="h-1 w-1 rounded-full bg-white/20" />
                  <span className="text-[10px] sm:text-[11px] font-bold tracking-[0.2em] text-white/50 uppercase">{currentGalleryIndex + 1} de {game.screenshots?.length ?? 0}</span>
                </div>
                <button onClick={() => { setGalleryModalOpen(false); playSound("modalClose"); }} className="p-3 rounded-full border border-white/10 hover:bg-white/10 transition-colors backdrop-blur-md" aria-label="Fechar galeria"><X className="w-5 h-5 text-white" /></button>
              </div>

              <button
                onClick={() => { setCurrentGalleryIndex((c) => c > 0 ? c - 1 : (game.screenshots?.length ?? 1) - 1); playSound("navigate"); }}
                className="absolute left-0 top-0 bottom-0 w-1/6 flex items-center justify-start pl-4 sm:pl-8 z-40 group outline-none"
                aria-label={copy.previous}
              >
                <div className="w-10 h-10 sm:w-14 sm:h-14 rounded-full flex items-center justify-center bg-black/40 border border-white/10 opacity-30 group-hover:opacity-100 group-hover:scale-110 transition-all backdrop-blur-md"><ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6 text-white" /></div>
              </button>
              <button
                onClick={() => { setCurrentGalleryIndex((c) => c < (game.screenshots?.length ?? 1) - 1 ? c + 1 : 0); playSound("navigate"); }}
                className="absolute right-0 top-0 bottom-0 w-1/6 flex items-center justify-end pr-4 sm:pr-8 z-40 group outline-none"
                aria-label={copy.next}
              >
                <div className="w-10 h-10 sm:w-14 sm:h-14 rounded-full flex items-center justify-center bg-black/40 border border-white/10 opacity-30 group-hover:opacity-100 group-hover:scale-110 transition-all backdrop-blur-md"><ChevronRight className="w-5 h-5 sm:w-6 sm:h-6 text-white" /></div>
              </button>

              <div className="w-full h-full max-h-screen p-8 sm:p-12 md:p-24 flex items-center justify-center">
                <AnimatePresence mode="wait">
                  <motion.img
                    key={currentGalleryIndex}
                    initial={{ opacity: 0, filter: "blur(8px)", scale: 0.98 }}
                    animate={{ opacity: 1, filter: "blur(0px)", scale: 1 }}
                    exit={{ opacity: 0, filter: "blur(8px)", scale: 1.02 }}
                    transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                    src={game.screenshots?.[currentGalleryIndex] || undefined}
                    alt={`Screenshot ${currentGalleryIndex + 1}`}
                    className="max-w-full max-h-full object-contain rounded-xl drop-shadow-[0_20px_50px_rgba(0,0,0,0.5)]"
                  />
                </AnimatePresence>
              </div>

              <div className="absolute bottom-0 left-0 right-0 flex flex-col items-center bg-gradient-to-t from-black/90 to-transparent pt-12 pb-6 z-50">
                <div className="flex justify-center gap-2 mb-6 overflow-x-auto max-w-full px-4">
                  {game.screenshots?.map((src, idx) => (
                    <button
                      key={idx}
                      onClick={() => { setCurrentGalleryIndex(idx); playSound("navigate"); }}
                      className={`w-16 h-10 sm:w-20 sm:h-12 rounded-lg overflow-hidden border-2 transition-all duration-300 flex-shrink-0 ${idx === currentGalleryIndex ? "border-white scale-110 shadow-[0_0_15px_rgba(255,255,255,0.3)]" : "border-transparent opacity-40 hover:opacity-80"
                        }`}
                      aria-label={`Ir para imagem ${idx + 1}`}
                    >
                      <img src={src || undefined} className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
                <div className="text-[10px] font-bold tracking-[0.2em] text-white/30 uppercase">
                  ← → navegar &nbsp;·&nbsp; Esc fechar
                </div>
              </div>
            </div>
          </ModalShell>

          {/* ============================================================
              MODAL DE EXCLUSÃO (COM CONFIRMAÇÃO DE TEXTO)
              ============================================================ */}
          <ModalShell
            isOpen={deleteModalOpen}
            onClose={() => { setDeleteModalOpen(false); playSound("back"); setDeleteConfirmText(""); }}
            maxWidthClassName="max-w-md"
            className="p-0 bg-transparent border-0 shadow-none"
            backdropClassName="bg-black/90"
            zIndexClassName="z-[160]"
            reducedEffects
          >
            <div className="w-full bg-[#0a0a0c] backdrop-blur-3xl rounded-[32px] overflow-hidden border border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.8)]">
              <div className="flex items-center justify-between px-8 py-6 border-b border-white/10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
                    <Trash2 className="w-5 h-5 text-white/60" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-black tracking-[0.2em] uppercase text-white">{copy.removeGame}</span>
                    <span className="text-[10px] font-bold tracking-[0.24em] uppercase text-white/40">{copy.cannotUndo}</span>
                  </div>
                </div>
                <button onClick={() => { setDeleteModalOpen(false); playSound("back"); setDeleteConfirmText(""); }} className="w-10 h-10 flex items-center justify-center hover:bg-white/10 rounded-full transition-colors"><X className="text-white/40" size={20} /></button>
              </div>
              <div className="px-8 py-7">
                <p className="text-sm text-white/70 leading-relaxed">{copy.confirmRemove(game.title)}</p>
                <input
                  type="text"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder={copy.confirmDeletePlaceholder}
                  className="mt-4 w-full rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 text-xs text-white placeholder-white/20 focus:border-white/40 focus:outline-none"
                  aria-label="Digite o nome do jogo para confirmar"
                />
                <div className="flex gap-3 justify-end mt-8">
                  <button
                    type="button"
                    onClick={() => { setDeleteModalOpen(false); playSound("back"); setDeleteConfirmText(""); }}
                    disabled={isDeleting}
                    className="px-6 py-3 rounded-xl border border-white/10 text-[10px] font-black uppercase tracking-[0.2em] text-white/60 hover:text-white hover:bg-white/10 transition-all disabled:opacity-40"
                  >
                    {copy.cancel}
                  </button>
                  <button
                    type="button"
                    onClick={handleDeleteGame}
                    disabled={isDeleting || deleteConfirmText !== game.title}
                    className="px-6 py-3 rounded-xl border border-red-500/30 text-[10px] font-black uppercase tracking-[0.2em] text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-all disabled:opacity-40 shadow-[0_0_15px_rgba(239,68,68,0.1)]"
                  >
                    {isDeleting ? copy.removing : copy.remove}
                  </button>
                </div>
              </div>
            </div>
          </ModalShell>

          {/* ============================================================
              TELA DE LAUNCH
              ============================================================ */}
          <AnimatePresence>
            {isLaunching && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[200] bg-black flex flex-col items-center justify-center overflow-hidden"
                role="alert"
                aria-label="Iniciando o jogo"
              >
                <motion.div
                  initial={{ scale: 1.05 }}
                  animate={{ scale: 1.15 }}
                  transition={{ duration: 8, ease: "easeOut" }}
                  className="absolute inset-0 z-0"
                >
                  <img
                    src={heroImage || undefined}
                    alt=""
                    className="w-full h-full object-cover blur-[12px] brightness-[0.25]"
                    loading="eager"
                  />
                </motion.div>

                <div className="relative z-10 flex flex-col items-center justify-center">
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
                    className="relative w-40 h-40 flex items-center justify-center mb-8"
                  >
                    <div className="absolute inset-0 rounded-full border border-white/10 animate-ping" style={{ animationDuration: '3s' }} />
                    <div className="absolute inset-4 rounded-full border-t border-white/30 animate-spin" style={{ animationDuration: '2s' }} />
                    <div className="absolute inset-8 rounded-full border-b border-white/60 animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }} />
                    <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center shadow-[0_0_30px_rgba(255,255,255,0.1)]">
                      {game.logoImage ? (
                        <img src={game.logoImage} className="w-12 object-contain opacity-80 animate-pulse" />
                      ) : (
                        <Play className="w-8 h-8 text-white/80 animate-pulse fill-white/80" />
                      )}
                    </div>
                  </motion.div>

                  <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.2, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                    className="text-center"
                  >
                    <h2 className="text-3xl md:text-4xl font-display font-light tracking-[0.25em] text-white uppercase mb-3 drop-shadow-[0_0_20px_rgba(255,255,255,0.4)]">
                      {game.title}
                    </h2>
                    <p className="text-[10px] font-bold text-white/40 tracking-[0.4em] uppercase animate-pulse">
                      {copy.launching}
                    </p>
                  </motion.div>
                </div>

                <motion.div
                  initial={{ scaleX: 0, x: "-100%" }}
                  animate={{ scaleX: 1, x: "100%" }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                  className="absolute bottom-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-white/80 to-transparent shadow-[0_0_15px_rgba(255,255,255,0.6)] origin-left"
                />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}

      {/* Modal Adicionar Conquista (existente) */}
      <ModalShell isOpen={isAddAchModalOpen} onClose={() => { playSound("back"); setIsAddAchModalOpen(false); setNewAchName(""); setNewAchDesc(""); }} maxWidthClassName="max-w-md" zIndexClassName="z-[200]" className="rounded-[32px] border border-white/10 bg-[#0a0a0c]/95 p-8 shadow-2xl backdrop-blur-3xl">
        <h3 className="mb-4 text-xl font-semibold text-white">Criar Conquista Nativa</h3>
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-white/40">Nome da Conquista</label>
            <input type="text" value={newAchName} onChange={(e) => setNewAchName(e.target.value)} placeholder="Ex: Velocidade Máxima" className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 text-xs text-white placeholder-white/20 focus:border-white/40 focus:outline-none" />
          </div>
          <div>
            <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-white/40">Descrição</label>
            <textarea value={newAchDesc} onChange={(e) => setNewAchDesc(e.target.value)} placeholder="Ex: Alcance 100km/h com qualquer veículo." rows={3} className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 text-xs text-white placeholder-white/20 focus:border-white/40 focus:outline-none resize-none" />
          </div>
        </div>
        <div className="mt-6 flex items-center justify-end gap-3">
          <button type="button" onClick={() => { playSound("back"); setIsAddAchModalOpen(false); setNewAchName(""); setNewAchDesc(""); }} className="px-5 py-2.5 text-[10px] font-bold uppercase tracking-widest text-white/50 hover:text-white transition-colors">Cancelar</button>
          <button type="button" onClick={handleAddAchievement} disabled={!newAchName.trim()} className="px-6 py-2.5 rounded-xl bg-white text-black text-[10px] font-black uppercase tracking-widest disabled:opacity-50 hover:bg-white/90 shadow-[0_0_15px_rgba(255,255,255,0.2)] transition-all">Criar</button>
        </div>
      </ModalShell>
    </AnimatePresence>
  );
};

// ============================================================
// SUBCOMPONENTES (NavTab, AchievementRow, TechnicalDetail)
// ============================================================

const NavTab: React.FC<{ label?: string; active?: boolean; onClick?: () => void; id?: string; controls?: string; }> = ({ label, active, onClick, id, controls }) => (
  <button
    role="tab"
    id={id}
    aria-selected={active}
    aria-controls={controls}
    onClick={onClick}
    className={`relative pb-3.5 text-[11px] font-black tracking-[0.18em] uppercase transition-all outline-none focus-visible:ring-2 focus-visible:ring-white/50 ${active ? "text-white" : "text-white/35 hover:text-white/70"
      }`}
    style={active ? { textShadow: "0 0 12px rgba(255,255,255,0.4)" } : undefined}
  >
    {label}
    {active && (
      <motion.div
        layoutId="activeTabIndicator"
        className="absolute bottom-0 left-0 right-0 h-[3px] rounded-full bg-white shadow-[0_0_12px_rgba(255,255,255,0.6)]"
      />
    )}
  </button>
);

const AchievementRow: React.FC<{
  achievement: SteamAchievement;
  lockedLabel: string;
  unlockedLabel: string;
  unlockedAtLabel: string;
  formatDate: (unixTime: number) => string | null;
  onManualUnlock?: () => void;
  featured?: boolean;
}> = ({ achievement, lockedLabel, unlockedLabel, unlockedAtLabel, formatDate, onManualUnlock, featured }) => {
  const unlockedAt = formatDate(achievement.unlockTime);
  return (
    <div className={`flex ${featured ? 'items-start md:items-center' : 'items-center'} gap-5 rounded-[20px] border p-5 transition-all duration-300 ${achievement.achieved ? "border-white/20 bg-white/10 shadow-[0_4px_20px_rgba(255,255,255,0.05),inset_0_0_0_1px_rgba(255,255,255,0.06)]" : "border-white/[0.06] bg-white/[0.02]"} ${featured && achievement.achieved ? "shadow-[0_4px_30px_rgba(255,255,255,0.07),inset_0_0_0_1px_rgba(255,255,255,0.1)]" : ""}`}>
      <div className={`flex ${featured ? 'h-16 w-16' : 'h-12 w-12'} shrink-0 items-center justify-center overflow-hidden rounded-xl border bg-black/40 transition-all duration-300 ${achievement.achieved ? "border-white/30 shadow-[0_0_15px_rgba(255,255,255,0.2)]" : "border-white/10 opacity-40 grayscale contrast-75"}`}>
        {achievement.icon || achievement.iconGray ? <img src={achievement.achieved ? achievement.icon : achievement.iconGray || achievement.icon} alt="" className="h-full w-full object-cover" loading="lazy" decoding="async" /> : <Trophy className="h-6 w-6 text-white/30" />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h4 className={`truncate ${featured ? 'text-lg' : 'text-sm'} font-bold tracking-wide transition-all ${achievement.achieved ? "text-white" : "text-white/70"}`}>{achievement.name}</h4>
            <p className={`mt-1 text-xs leading-relaxed transition-colors ${achievement.achieved ? "text-white/60" : "text-white/40"}`}>{achievement.description || " "}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {!achievement.achieved && onManualUnlock && (
              <button type="button" onClick={(e) => { e.stopPropagation(); onManualUnlock(); }} className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-[9px] font-bold uppercase tracking-wider text-white/60 hover:bg-white/10 hover:text-white transition-colors">Desbloquear</button>
            )}
            <span className={`rounded-lg border px-3 py-1.5 text-[9px] font-bold uppercase tracking-wider transition-all ${achievement.achieved ? "border-white/30 bg-white/10 text-white shadow-[0_0_10px_rgba(255,255,255,0.1)]" : "border-white/10 bg-white/5 text-white/35"}`}>
              {achievement.achieved ? unlockedLabel : lockedLabel}
            </span>
          </div>
        </div>
        {achievement.achieved && unlockedAt && (
          <p className="mt-2 text-[10px] font-bold tracking-widest uppercase text-white/40">
            {unlockedAtLabel} <span className="ml-1 text-white/80">{unlockedAt}</span>
          </p>
        )}
      </div>
    </div>
  );
};

const TechnicalDetail: React.FC<{ label: string; value?: string; fallback: string; }> = ({ label, value, fallback }) => (
  <div>
    <span className="block text-[9px] font-black text-white/35 uppercase tracking-[0.28em] mb-1.5">{label}</span>
    <span className="text-sm font-bold text-white/90">{value || fallback}</span>
  </div>
);

export default GameDetailPanel;