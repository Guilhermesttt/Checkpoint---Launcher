import React from "react";
import DOMPurify from "dompurify";
import { motion, AnimatePresence } from "framer-motion";
import { X, Play, Clock, CalendarClock, Trophy, Camera, Trash2 } from "lucide-react";
import { updateDoc, deleteDoc } from "firebase/firestore";
import { launchGame } from "../services/launcher";
import type { Game } from "../types/domain";
import type { SoundEffectType } from "../hooks/useSoundEffects";
import {
  fetchSteamAchievementDetails,
  searchSteamGames,
  type SteamAchievement,
} from "../services/steam";
import ModalShell from "./ui/ModalShell";
import GlassButton from "./ui/GlassButton";
import { useAuth } from "../auth/AuthProvider";
import { usePreferences } from "../context/PreferencesContext";
import { userGameDocRef } from "../services/firestorePaths";
import { useNotification } from "./NotificationCenter";

interface GameDetailPanelProps {
  game: Game | null;
  isOpen: boolean;
  onClose: () => void;
  playSound: (type: SoundEffectType) => void;
}

// Tempo mínimo (ms) que a tela de "abrindo jogo" fica visível, só pra não piscar
// caso o launchGame() resolva quase instantaneamente.
const MIN_LAUNCH_SCREEN_MS = 1200;

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
}) => {
  const { user, userProfile } = useAuth();
  const { t, language } = usePreferences();
  const { notify } = useNotification();
  const [isLaunching, setIsLaunching] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState("JOGAR");
  const [launchError, setLaunchError] = React.useState<string | null>(null);
  const [galleryModalOpen, setGalleryModalOpen] = React.useState(false);
  const [currentGalleryIndex, setCurrentGalleryIndex] = React.useState(0);
  const [deleteModalOpen, setDeleteModalOpen] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [achievementItems, setAchievementItems] = React.useState<SteamAchievement[]>([]);
  const [achievementSourceAppId, setAchievementSourceAppId] = React.useState<string>("");
  const [isAchievementsLoading, setIsAchievementsLoading] = React.useState(false);
  const [achievementsError, setAchievementsError] = React.useState<string | null>(null);

  const copy = {
    "pt-BR": {
      tabPlay: "JOGAR",
      tabAchievements: "CONQUISTAS",
      tabAbout: "SOBRE",
      tabManage: "GERENCIAR",
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
      createShortcut: "Criar Atalho",
      remove: "Remover",
      platform: "Plataforma",
      noDescription: "Sem descrição disponível para este jogo.",
      gallery: "GALERIA",
      previous: "← Anterior",
      next: "Próximo →",
      removeGame: "Remover jogo",
      cannotUndo: "Esta ação não pode ser desfeita",
      confirmRemove: (title: string) => (
        <>
          Tem certeza que deseja remover{" "}
          <span className="text-white font-semibold">{title}</span> da sua
          biblioteca?
        </>
      ),
      cancel: "Cancelar",
      removing: "Removendo...",
      close: "Fechar",
      loginToRemove: "Você precisa estar logado para remover um jogo.",
      removedSuccess: "Jogo removido.",
      removeError: "Erro ao remover jogo.",
      launchGenericError: "Falha ao iniciar o jogo.",
      achievementsLoading: "Buscando conquistas da Steam...",
      achievementsEmpty: "Nenhuma conquista encontrada para este jogo.",
      achievementsSource: "Suas conquistas",
      achievementsSteamFallback: "Steam",
      achievementsSteamFallbackHint:
        "Jogo Epic usando conquistas da versão Steam vinculada.",
      achievementsSteamLinked: "Steam vinculada",
      achievementsSteamMatched: "Steam encontrada automaticamente",
      achievementsNeedSteam:
        "Conecte sua conta Steam para carregar conquistas detalhadas.",
      achievementsMissingAppId:
        "Este jogo não possui Steam App ID vinculado para importar conquistas.",
      achievementsLocked: "Bloqueada",
      achievementsUnlocked: "Desbloqueada",
      achievementsUnlockedAt: "Desbloqueada em",
    },
    "en-US": {
      tabPlay: "PLAY",
      tabAchievements: "ACHIEVEMENTS",
      tabAbout: "ABOUT",
      tabManage: "MANAGE",
      steamLabel: "Steam",
      epicLabel: "Epic Games",
      localLabel: "Local PC",
      library: "Library",
      timePlayed: "TIME PLAYED",
      lastSession: "LAST SESSION",
      neverStarted: "Not started yet",
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
      createShortcut: "Create shortcut",
      remove: "Remove",
      platform: "Platform",
      noDescription: "No description available for this game.",
      gallery: "GALLERY",
      previous: "← Previous",
      next: "Next →",
      removeGame: "Remove game",
      cannotUndo: "This action cannot be undone",
      confirmRemove: (title: string) => (
        <>
          Are you sure you want to remove{" "}
          <span className="text-white font-semibold">{title}</span> from your
          library?
        </>
      ),
      cancel: "Cancel",
      removing: "Removing...",
      close: "Close",
      loginToRemove: "You need to be logged in to remove a game.",
      removedSuccess: "Game removed.",
      removeError: "Error removing game.",
      launchGenericError: "Failed to launch the game.",
      achievementsLoading: "Loading Steam achievements...",
      achievementsEmpty: "No achievements were found for this game.",
      achievementsSource: "Your achievements",
      achievementsSteamFallback: "Steam",
      achievementsSteamFallbackHint:
        "Epic game using achievements from the linked Steam version.",
      achievementsSteamLinked: "Linked Steam version",
      achievementsSteamMatched: "Steam version matched automatically",
      achievementsNeedSteam:
        "Connect your Steam account to load detailed achievements.",
      achievementsMissingAppId:
        "This game does not have a linked Steam App ID for importing achievements.",
      achievementsLocked: "Locked",
      achievementsUnlocked: "Unlocked",
      achievementsUnlockedAt: "Unlocked on",
    },
    "es-ES": {
      tabPlay: "JUGAR",
      tabAchievements: "LOGROS",
      tabAbout: "ACERCA DE",
      tabManage: "GESTIONAR",
      steamLabel: "Steam",
      epicLabel: "Epic Games",
      localLabel: "PC Local",
      library: "Biblioteca",
      timePlayed: "TIEMPO JUGADO",
      lastSession: "ÚLTIMA SESIÓN",
      neverStarted: "Aún no iniciado",
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
      createShortcut: "Crear acceso directo",
      remove: "Eliminar",
      platform: "Plataforma",
      noDescription: "Sin descripción disponible para este juego.",
      gallery: "GALERÍA",
      previous: "← Anterior",
      next: "Siguiente →",
      removeGame: "Eliminar juego",
      cannotUndo: "Esta acción no se puede deshacer",
      confirmRemove: (title: string) => (
        <>
          ¿Seguro que deseas eliminar{" "}
          <span className="text-white font-semibold">{title}</span> de tu
          biblioteca?
        </>
      ),
      cancel: "Cancelar",
      removing: "Eliminando...",
      close: "Cerrar",
      loginToRemove: "Debes iniciar sesión para eliminar un juego.",
      removedSuccess: "Juego eliminado.",
      removeError: "Error al eliminar el juego.",
      launchGenericError: "No se pudo iniciar el juego.",
      achievementsLoading: "Cargando logros de Steam...",
      achievementsEmpty: "No se encontraron logros para este juego.",
      achievementsSource: "Tus logros",
      achievementsSteamFallback: "Steam",
      achievementsSteamFallbackHint:
        "Juego de Epic usando logros de la versión vinculada de Steam.",
      achievementsSteamLinked: "Versión de Steam vinculada",
      achievementsSteamMatched: "Versión de Steam encontrada automáticamente",
      achievementsNeedSteam:
        "Conecta tu cuenta de Steam para cargar los logros detallados.",
      achievementsMissingAppId:
        "Este juego no tiene un Steam App ID vinculado para importar logros.",
      achievementsLocked: "Bloqueado",
      achievementsUnlocked: "Desbloqueado",
      achievementsUnlockedAt: "Desbloqueado el",
    },
  }[language];

  const locale =
    language === "en-US" ? "en-US" : language === "es-ES" ? "es-ES" : "pt-BR";

  /* eslint-disable react-hooks/set-state-in-effect */
  React.useEffect(() => {
    setActiveTab(copy.tabPlay);
    setLaunchError(null);
    setGalleryModalOpen(false);
    setCurrentGalleryIndex(0);
    setDeleteModalOpen(false);
    setIsDeleting(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game?.id]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Navegação por teclado na galeria: ← → para trocar imagem, Esc para fechar.
  React.useEffect(() => {
    if (!galleryModalOpen || !game?.screenshots?.length) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setGalleryModalOpen(false);
        playSound("modalClose");
      } else if (e.key === "ArrowLeft") {
        setCurrentGalleryIndex((c) =>
          c > 0 ? c - 1 : (game.screenshots?.length ?? 1) - 1,
        );
        playSound("navigate");
      } else if (e.key === "ArrowRight") {
        setCurrentGalleryIndex((c) =>
          c < (game.screenshots?.length ?? 1) - 1 ? c + 1 : 0,
        );
        playSound("navigate");
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [galleryModalOpen, game?.screenshots, playSound]);

  React.useEffect(() => {
    let cancelled = false;

    const loadAchievements = async () => {
      setAchievementItems([]);
      setAchievementSourceAppId("");
      setAchievementsError(null);

      if (!game?.id) return;
      if (!userProfile?.steamId) {
        setAchievementsError(copy.achievementsNeedSteam);
        return;
      }

      setIsAchievementsLoading(true);

      try {
        let resolvedAppId = String(game.steamAppId || "").trim();

        if (!resolvedAppId && game.launcherType === "epic") {
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

        const result = await fetchSteamAchievementDetails(
          userProfile.steamId,
          resolvedAppId,
        );

        if (cancelled) return;

        setAchievementSourceAppId(resolvedAppId);
        setAchievementItems(result.achievements);

        if (result.achievements.length === 0) {
          setAchievementsError(copy.achievementsEmpty);
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

    void loadAchievements();

    return () => {
      cancelled = true;
    };
  }, [
    copy.achievementsEmpty,
    copy.achievementsMissingAppId,
    copy.achievementsNeedSteam,
    game?.id,
    game?.launcherType,
    game?.steamAppId,
    game?.title,
    userProfile?.steamId,
  ]);

  if (!game) return null;

  const heroImage = game.backgroundImage || game.image;
  const coverImage = game.cardImage || game.image || game.backgroundImage;
  const hasEpicLaunchShortcut =
    game.launcherType === "epic" &&
    String(game.epicLaunchId || game.executablePath || game.epicCatalogId || "")
      .split(":")
      .filter(Boolean).length >= 3;
  const safeAboutHtml = DOMPurify.sanitize(
    game.aboutTheGame || game.description || copy.noDescription,
    {
      ALLOWED_TAGS: ["b", "br", "em", "i", "li", "ol", "p", "strong", "ul"],
      ALLOWED_ATTR: [],
    },
  );
  const achievementsTotal = game.totalAchievements ?? 0;
  const achievementsDone = game.completedAchievements ?? 0;
  const achievementPercent =
    achievementsTotal > 0
      ? Math.round((achievementsDone / achievementsTotal) * 100)
      : 0;
  const detailedAchievementsUnlocked = achievementItems.filter(
    (achievement) => achievement.achieved,
  ).length;
  const detailedAchievementPercent =
    achievementItems.length > 0
      ? Math.round((detailedAchievementsUnlocked / achievementItems.length) * 100)
      : 0;
  const lastSessionSource =
    game.launcherType === "steam"
      ? game.steamLastPlayedAt || game.lastPlayedAt
      : game.lastPlayedAt;
  const lastSession = lastSessionSource
    ? new Date(lastSessionSource).toLocaleDateString(locale)
    : copy.neverStarted;
  const platformLabel =
    game.launcherType === "steam"
      ? copy.steamLabel
      : game.launcherType === "epic"
        ? copy.epicLabel
        : copy.localLabel;
  const aboutPreview = (game.aboutTheGame || game.description || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const achievementSourceLabel =
    game.launcherType === "epic" && achievementSourceAppId
      ? game.steamAppId
        ? copy.achievementsSteamLinked
        : copy.achievementsSteamMatched
      : achievementSourceAppId
        ? copy.steamLabel
        : copy.achievementsSteamFallback;

  const formatHours = (hours: number = 0) => {
    const h = Math.floor(hours);
    const m = Math.floor((hours - h) * 60);
    return `${h}H ${m}M`;
  };

  const formatAchievementDate = (unixTime: number) =>
    unixTime > 0
      ? new Date(unixTime * 1000).toLocaleDateString(locale)
      : null;

  const handleLaunch = async () => {
    if (isLaunching) return;

    setIsLaunching(true);
    setLaunchError(null);
    playSound("play");
    window.dispatchEvent(
      new CustomEvent("checkpoint:game-launch", {
        detail: { title: game.title },
      }),
    );

    try {
      const [result] = await Promise.allSettled([
        launchGame(game),
        wait(MIN_LAUNCH_SCREEN_MS),
      ]);

      if (user?.uid) {
        updateDoc(userGameDocRef(user.uid, game.id), {
          lastPlayedAt: new Date().toISOString(),
        }).catch(() => {
          return;
        });
      }

      if (result.status === "rejected") {
        throw result.reason;
      }
    } catch (error) {
      setLaunchError(
        error instanceof Error ? error.message : copy.launchGenericError,
      );
    } finally {
      setIsLaunching(false);
    }
  };

  const handleDeleteGame = async () => {
    if (!user?.uid) {
      notify(copy.loginToRemove, "error");
      return;
    }
    if (isDeleting) return;
    setIsDeleting(true);
    try {
      await deleteDoc(userGameDocRef(user.uid, game.id));
      notify(copy.removedSuccess, "success");
      setDeleteModalOpen(false);
      onClose();
    } catch {
      notify(copy.removeError, "error");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex"
        >
          <motion.div
            initial={{ scale: 1.1, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 1.1, opacity: 0 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="absolute inset-0"
          >
            <img
              src={heroImage}
              alt={game.title}
              className="w-full h-full object-cover"
              loading="eager"
              decoding="async"
            />
            <div className="absolute inset-0 bg-linear-to-r from-[#050507] via-[#050507]/70 to-transparent" />
            <div className="absolute inset-0 bg-linear-to-t from-[#050507]/90 via-transparent to-[#050507]/30" />
          </motion.div>

          <div className="relative z-10 grid w-full h-full grid-cols-[minmax(560px,720px)_1fr] gap-8">
            <motion.div
              initial={{ opacity: 0, x: -40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 }}
              transition={{
                duration: 0.6,
                delay: 0.2,
                ease: [0.16, 1, 0.3, 1],
              }}
              className="m-8 mr-0 rounded-[32px] border border-white/10 bg-black/35 backdrop-blur-3xl shadow-2xl p-8 flex flex-col justify-center h-[calc(100dvh-4rem)]"
            >
              <div className="flex items-center gap-1 mb-7">
                <NavTab
                  icon="←"
                  ariaLabel={copy.close}
                  onClick={() => {
                    playSound("back");
                    onClose();
                  }}
                />
                <NavTab
                  label={copy.tabPlay}
                  active={activeTab === copy.tabPlay}
                  onClick={() => {
                    setActiveTab(copy.tabPlay);
                    playSound("navigate");
                  }}
                />
                <NavTab
                  label={copy.tabAbout}
                  active={activeTab === copy.tabAbout}
                  onClick={() => {
                    setActiveTab(copy.tabAbout);
                    playSound("navigate");
                  }}
                />
                <NavTab
                  label={copy.tabAchievements}
                  active={activeTab === copy.tabAchievements}
                  onClick={() => {
                    setActiveTab(copy.tabAchievements);
                    playSound("navigate");
                  }}
                />
                <NavTab
                  label={copy.tabManage}
                  active={activeTab === copy.tabManage}
                  onClick={() => {
                    setActiveTab(copy.tabManage);
                    playSound("navigate");
                  }}
                />
              </div>

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="flex items-center gap-2 mb-4"
              >
                <span className="text-[10px] font-bold tracking-[0.3em] text-white/40 uppercase">
                  {platformLabel}
                </span>
                <span className="h-1 w-1 rounded-full bg-white/20" />
                <span className="text-[10px] font-bold tracking-[0.3em] text-white/30 uppercase">
                  {game.category || copy.library}
                </span>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35 }}
              >
                {game.logoImage ? (
                  <img
                    src={game.logoImage}
                    alt={game.title}
                    className="max-h-24 max-w-[520px] object-contain object-left mb-7 drop-shadow-2xl"
                  />
                ) : (
                  <h1 className="text-5xl md:text-6xl font-black tracking-tight text-white mb-7 leading-[0.95]">
                    {game.title}
                  </h1>
                )}
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8"
              >
                <StatItem
                  icon={<Clock className="w-4 h-4" />}
                  label={copy.timePlayed}
                  value={formatHours(game.hoursPlayed)}
                  isEmpty={!game.hoursPlayed}
                />
                <StatItem
                  icon={<CalendarClock className="w-4 h-4" />}
                  label={copy.lastSession}
                  value={lastSession}
                  isEmpty={!lastSessionSource}
                />
                <AchievementStat
                  total={achievementItems.length || achievementsTotal}
                  done={achievementItems.length ? detailedAchievementsUnlocked : achievementsDone}
                  percent={achievementItems.length ? detailedAchievementPercent : achievementPercent}
                  label={copy.achievements}
                />
              </motion.div>

              <div className="flex-1 min-h-0 overflow-y-auto thin-scrollbar pr-4 -mr-4 pb-4">
                <AnimatePresence mode="wait">
                  {activeTab === copy.tabPlay && (
                    <motion.div
                      key="play-content"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      className="flex flex-col gap-8 pb-12"
                    >
                      <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: false, amount: 0.2 }}
                        className="flex items-center gap-6 px-1"
                      >
                        {game.launcherType === "steam" && (
                          <span className="text-[10px] text-white/30 uppercase tracking-widest">
                            {copy.appId}{" "}
                            <span className="text-white/60 ml-1">
                              {game.steamAppId || "---"}
                            </span>
                          </span>
                        )}
                        {game.launcherType === "epic" && (
                          <span className="text-[10px] text-white/30 uppercase tracking-widest">
                            {copy.epicShortcutLabel}{" "}
                            <span className="text-white/60 ml-1">
                              {hasEpicLaunchShortcut
                                ? copy.epicShortcut
                                : copy.epicStore}
                            </span>
                          </span>
                        )}
                        <span className="h-1 w-1 rounded-full bg-white/10" />
                        <span className="text-[10px] text-white/30 uppercase tracking-widest">
                          {copy.source}{" "}
                          <span className="text-white/60 ml-1">
                            {game.source === "steam"
                              ? copy.sourceSteamSync
                              : game.source === "epic"
                                ? copy.sourceEpicCatalog
                                : copy.sourceManual}
                          </span>
                        </span>
                      </motion.div>

                      <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: false, amount: 0.2 }}
                      >
                        <h3 className="text-[10px] font-bold tracking-[0.3em] text-white/40 uppercase mb-4 flex items-center gap-2">
                          <Camera className="w-3 h-3" /> {copy.photoWall}
                        </h3>
                        {game.screenshots && game.screenshots.length > 0 ? (
                          <div
                            onClick={() => {
                              setGalleryModalOpen(true);
                              setCurrentGalleryIndex(0);
                              playSound("select");
                            }}
                            className="rounded-xl overflow-hidden ring-1 ring-white/10 relative group cursor-pointer h-[220px]"
                          >
                            <img
                              src={game.screenshots[game.screenshots.length - 1]}
                              alt=""
                              className="w-full h-full object-cover opacity-70 group-hover:opacity-100 transition-opacity duration-500 group-hover:scale-105 will-change-transform"
                            />
                            <div className="absolute inset-0 bg-linear-to-t from-[#050507]/90 via-transparent to-transparent flex items-end p-4 opacity-100 group-hover:opacity-0 transition-opacity duration-300">
                              <span className="text-xs font-bold text-white uppercase tracking-widest flex items-center gap-2">
                                <Camera className="w-3 h-3" /> {copy.viewGallery} (
                                {game.screenshots.length})
                              </span>
                            </div>
                          </div>
                        ) : (
                          <div className="rounded-xl premium-glass flex flex-col items-center justify-center gap-2 text-white/30 h-[220px]">
                            <Camera className="w-6 h-6 opacity-50" />
                            <span className="text-[10px] uppercase tracking-widest font-bold">
                              {copy.noScreenshot}
                            </span>
                          </div>
                        )}
                      </motion.div>

                      {aboutPreview && (
                        <motion.div
                          initial={{ opacity: 0, y: 30 }}
                          whileInView={{ opacity: 1, y: 0 }}
                          viewport={{ once: false, amount: 0.2 }}
                        >
                          <div className="flex items-center justify-between mb-4">
                            <h3 className="text-[10px] font-bold tracking-[0.3em] text-white/40 uppercase">
                              {copy.about}
                            </h3>
                            <button
                              onClick={() => {
                                setActiveTab(copy.tabAbout);
                                playSound("navigate");
                              }}
                              className="text-[10px] font-bold text-white/40 hover:text-white uppercase tracking-widest transition-colors"
                            >
                              {copy.seeMore}
                            </button>
                          </div>
                          <p className="text-white/60 text-sm leading-relaxed line-clamp-3">
                            {aboutPreview}
                          </p>
                          {game.tags && game.tags.length > 0 && (
                            <div className="flex flex-wrap gap-2 mt-4">
                              {game.tags.slice(0, 5).map((tag, i) => (
                                <span
                                  key={i}
                                  className="px-2.5 py-1 rounded-md bg-white/5 border border-white/10 text-[10px] text-white/60"
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}
                        </motion.div>
                      )}
                    </motion.div>
                  )}

                  {activeTab === copy.tabAbout && (
                    <motion.div
                      key="about-content"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      className="max-w-xl"
                    >
                      <div className="flex flex-col gap-6">
                        <motion.div
                          initial={{ opacity: 0, y: 30 }}
                          whileInView={{ opacity: 1, y: 0 }}
                          viewport={{ once: false, amount: 0.05 }}
                          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                        >
                          <h3 className="text-[10px] font-bold tracking-[0.3em] text-white/40 uppercase mb-4">
                            {copy.about}
                          </h3>
                          <div
                            className="text-white/70 leading-relaxed text-sm prose prose-invert prose-p:my-0 pb-2"
                            dangerouslySetInnerHTML={{ __html: safeAboutHtml }}
                          />
                        </motion.div>

                        <motion.div
                          initial={{ opacity: 0, y: 30 }}
                          whileInView={{ opacity: 1, y: 0 }}
                          viewport={{ once: false, amount: 0.2 }}
                          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                          className="grid grid-cols-2 gap-y-6 gap-x-12 pt-6 border-t border-white/5"
                        >
                          <TechnicalDetail
                            label={copy.developer}
                            value={game.developer}
                            fallback={copy.notInformed}
                          />
                          <TechnicalDetail
                            label={copy.publisher}
                            value={game.publisher}
                            fallback={copy.notInformed}
                          />
                          <TechnicalDetail
                            label={copy.releaseDate}
                            value={game.releaseDate}
                            fallback={copy.notInformed}
                          />
                          <TechnicalDetail
                            label={copy.category}
                            value={game.category}
                            fallback={copy.notInformed}
                          />
                        </motion.div>

                        {game.tags && game.tags.length > 0 && (
                          <motion.div
                            initial={{ opacity: 0, y: 30 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: false, amount: 0.2 }}
                            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                          >
                            <h3 className="text-[10px] font-bold tracking-[0.3em] text-white/40 uppercase mb-3">
                              {copy.popularTags}
                            </h3>
                            <div className="flex flex-wrap gap-2">
                              {game.tags.slice(0, 10).map((tag, i) => (
                                <span
                                  key={i}
                                  className="px-2.5 py-1 rounded-md bg-white/5 border border-white/10 text-[10px] text-white/60"
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          </motion.div>
                        )}
                      </div>
                    </motion.div>
                  )}

                  {activeTab === copy.tabAchievements && (
                    <motion.div
                      key="achievements-content"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      className="max-w-3xl"
                    >
                      <div className="flex flex-col gap-6">
                        <motion.div
                          initial={{ opacity: 0, y: 20 }}
                          whileInView={{ opacity: 1, y: 0 }}
                          viewport={{ once: false, amount: 0.2 }}
                          className="rounded-[24px] border border-white/10 bg-white/[0.04] p-5"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.3em] text-white/35">
                                {copy.achievementsSource}
                              </p>
                              <p className="text-sm font-semibold text-white/85">
                                {achievementSourceLabel}
                              </p>
                              {game.launcherType === "epic" && achievementSourceAppId && (
                                <p className="mt-2 text-xs text-white/45">
                                  {copy.achievementsSteamFallbackHint}
                                </p>
                              )}
                            </div>
                            <div className="min-w-[120px] rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-right">
                              <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-white/35">
                                {copy.achievements}
                              </p>
                              <p className="mt-2 text-2xl font-light text-white">
                                {achievementItems.length
                                  ? `${detailedAchievementsUnlocked}/${achievementItems.length}`
                                  : `${achievementsDone}/${achievementsTotal}`}
                              </p>
                            </div>
                          </div>
                        </motion.div>

                        {isAchievementsLoading && (
                          <div className="flex min-h-[260px] items-center justify-center rounded-[24px] border border-white/10 bg-white/[0.03] text-sm text-white/55">
                            {copy.achievementsLoading}
                          </div>
                        )}

                        {!isAchievementsLoading && achievementsError && achievementItems.length === 0 && (
                          <div className="flex min-h-[260px] items-center justify-center rounded-[24px] border border-dashed border-white/10 bg-white/[0.03] px-6 text-center text-sm text-white/45">
                            {achievementsError}
                          </div>
                        )}

                        {!isAchievementsLoading && achievementItems.length > 0 && (
                          <div className="grid gap-3 pb-8">
                            {achievementItems.map((achievement) => (
                              <AchievementRow
                                key={achievement.apiName}
                                achievement={achievement}
                                lockedLabel={copy.achievementsLocked}
                                unlockedLabel={copy.achievementsUnlocked}
                                unlockedAtLabel={copy.achievementsUnlockedAt}
                                formatDate={formatAchievementDate}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}

                  {activeTab === copy.tabManage && (
                    <motion.div
                      key="mgmt-content"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                    >
                      <h3 className="text-[10px] font-bold tracking-[0.3em] text-white/40 uppercase mb-4">
                        {copy.management}
                      </h3>
                      <div className="p-4 rounded-xl premium-glass flex items-center justify-between mb-4">
                        <span className="text-white/60 text-xs truncate max-w-sm">
                          {game.executablePath}
                        </span>
                        <button className="text-[10px] font-bold text-white uppercase tracking-widest pl-4 hover:text-white/70 transition-colors">
                          {copy.verify}
                        </button>
                      </div>
                      <div className="flex gap-4">
                        <button className="px-6 py-3 rounded-xl bg-white/5 border border-white/10 text-[10px] font-bold text-white/60 hover:text-white hover:bg-white/10 transition-all uppercase tracking-widest">
                          {copy.createShortcut}
                        </button>
                        <button
                          onClick={() => {
                            setDeleteModalOpen(true);
                            playSound("select");
                          }}
                          className="px-6 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-[10px] font-bold text-red-400/60 hover:text-red-400 hover:bg-red-500/20 transition-all uppercase tracking-widest"
                        >
                          {copy.remove}
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 40 }}
              transition={{ duration: 0.6, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="flex flex-col justify-end items-end p-8 pl-0"
            >
              <div className="w-[260px] rounded-[28px] overflow-hidden border border-white/10 bg-black/35 backdrop-blur-2xl shadow-2xl mb-5">
                <div className="aspect-[3/4] bg-white/5">
                  <img
                    src={coverImage}
                    alt={game.title}
                    className="h-full w-full object-cover"
                    loading="eager"
                    decoding="async"
                  />
                </div>
                <div className="p-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.24em] text-white/35 mb-1">
                    {copy.platform}
                  </p>
                  <p className="text-sm font-semibold text-white/80">
                    {platformLabel}
                  </p>
                </div>
              </div>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleLaunch}
                disabled={isLaunching}
                aria-label={isLaunching ? t("launching") : t("play")}
                className="rounded-2xl px-8 py-5 flex items-center gap-4 group w-[260px] justify-between relative overflow-hidden transition-all duration-500"
                style={{
                  background: "var(--game-color, #ffffff)",
                  boxShadow: "0 8px 32px var(--game-color, transparent)",
                }}
              >
                <span
                  className="text-sm font-black tracking-[0.15em] uppercase transition-colors"
                  style={{ color: "var(--game-text-color, #000)" }}
                >
                  {isLaunching ? t("launching") : t("play")}
                </span>
                <div className="w-10 h-10 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform bg-white/20">
                  <Play
                    className={`w-5 h-5 ml-0.5 transition-colors ${isLaunching ? "animate-pulse" : ""}`}
                    style={{
                      color: "var(--game-text-color, #000)",
                      fill: "var(--game-text-color, #000)",
                    }}
                  />
                </div>
              </motion.button>
              {launchError && (
                <p className="mt-3 text-xs text-amber-300/90 max-w-[260px] text-right">
                  {launchError}
                </p>
              )}
            </motion.div>
          </div>

          <button
            onClick={onClose}
            aria-label={copy.close}
            className="absolute top-8 right-8 z-20 p-4 premium-glass rounded-full hover:bg-white/10 transition-all hover:rotate-90 active:scale-90"
          >
            <X className="w-5 h-5 text-white" />
          </button>

          <ModalShell
            isOpen={Boolean(
              galleryModalOpen && game.screenshots && game.screenshots.length > 0,
            )}
            onClose={() => {
              setGalleryModalOpen(false);
              playSound("modalClose");
            }}
            maxWidthClassName="max-w-5xl"
            className="p-0 bg-transparent border-0 shadow-none"
            backdropClassName="bg-black/90"
            zIndexClassName="z-[150]"
            reducedEffects
          >
            <div className="relative">
              <div className="absolute top-4 left-6 z-10">
                <span className="text-[10px] font-bold tracking-[0.3em] text-white/50 uppercase">
                  {copy.gallery} ({currentGalleryIndex + 1}/
                  {game.screenshots?.length ?? 0})
                </span>
              </div>
              <button
                onClick={() => {
                  setGalleryModalOpen(false);
                  playSound("modalClose");
                }}
                aria-label={copy.close}
                className="absolute top-3 right-4 z-10 p-3 premium-glass rounded-full hover:bg-white/20 transition-all hover:rotate-90 active:scale-90"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="w-full aspect-video px-4 md:px-0">
                <AnimatePresence mode="wait">
                  <motion.img
                    key={currentGalleryIndex}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 1.1 }}
                    transition={{ duration: 0.3 }}
                    src={game.screenshots?.[currentGalleryIndex]}
                    alt="Screenshot"
                    className="w-full h-full object-contain rounded-xl overflow-hidden drop-shadow-2xl"
                  />
                </AnimatePresence>
              </div>

              <div className="flex gap-4 mt-6 justify-center pb-2">
                <GlassButton
                  type="button"
                  onClick={() => {
                    setCurrentGalleryIndex((c) =>
                      c > 0 ? c - 1 : (game.screenshots?.length ?? 1) - 1,
                    );
                    playSound("navigate");
                  }}
                >
                  {copy.previous}
                </GlassButton>
                <GlassButton
                  type="button"
                  onClick={() => {
                    setCurrentGalleryIndex((c) =>
                      c < (game.screenshots?.length ?? 1) - 1 ? c + 1 : 0,
                    );
                    playSound("navigate");
                  }}
                >
                  {copy.next}
                </GlassButton>
              </div>
            </div>
          </ModalShell>

          <ModalShell
            isOpen={deleteModalOpen}
            onClose={() => {
              setDeleteModalOpen(false);
              playSound("back");
            }}
            maxWidthClassName="max-w-lg"
            className="p-0 bg-transparent border-0 shadow-none"
            backdropClassName="bg-black/80"
            zIndexClassName="z-[160]"
            reducedEffects
          >
            <div className="w-full bg-[#0a0a0c]/98 backdrop-blur-3xl rounded-[32px] overflow-hidden border border-white/10 shadow-[0_32px_128px_rgba(0,0,0,0.9)]">
              <div className="flex items-center justify-between px-8 py-6 border-b border-white/5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                    <Trash2 className="w-5 h-5 text-red-300/80" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-black tracking-[0.2em] uppercase text-white">
                      {copy.removeGame}
                    </span>
                    <span className="text-[10px] font-bold tracking-[0.24em] uppercase text-white/35">
                      {copy.cannotUndo}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setDeleteModalOpen(false);
                    playSound("back");
                  }}
                  aria-label={copy.close}
                  className="w-10 h-10 flex items-center justify-center hover:bg-white/10 rounded-full transition-all border border-white/5"
                >
                  <X className="text-white/40" size={20} />
                </button>
              </div>

              <div className="px-8 py-7">
                <p className="text-sm text-white/70 leading-relaxed">
                  {copy.confirmRemove(game.title)}
                </p>

                <div className="flex gap-3 justify-end mt-7">
                  <button
                    type="button"
                    onClick={() => {
                      setDeleteModalOpen(false);
                      playSound("back");
                    }}
                    disabled={isDeleting}
                    className="px-5 py-3 rounded-2xl bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-[0.2em] text-white/60 hover:text-white hover:bg-white/10 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {copy.cancel}
                  </button>
                  <button
                    type="button"
                    onClick={handleDeleteGame}
                    disabled={isDeleting}
                    className="px-5 py-3 rounded-2xl bg-red-500/15 border border-red-500/25 text-[10px] font-black uppercase tracking-[0.2em] text-red-200/80 hover:text-red-100 hover:bg-red-500/25 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {isDeleting ? copy.removing : copy.remove}
                  </button>
                </div>
              </div>
            </div>
          </ModalShell>

          <AnimatePresence>
            {isLaunching && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 z-[200] bg-black flex flex-col items-center justify-center"
              >
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
                  className="relative w-full h-full"
                >
                  <img
                    src={heroImage}
                    alt={game.title}
                    className="w-full h-full object-cover scale-110 blur-sm brightness-50"
                    loading="eager"
                  />
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <motion.div
                      initial={{ y: 20, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ delay: 0.5 }}
                      className="text-center"
                    >
                      <h2 className="text-4xl font-light tracking-[0.2em] text-white/90 uppercase mb-4">
                        {game.title}
                      </h2>
                      <div className="flex items-center justify-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-white/40 animate-bounce [animation-delay:-0.3s]" />
                        <div className="w-2 h-2 rounded-full bg-white/40 animate-bounce [animation-delay:-0.15s]" />
                        <div className="w-2 h-2 rounded-full bg-white/40 animate-bounce" />
                      </div>
                    </motion.div>
                  </div>
                </motion.div>

                <motion.div
                  initial={{ x: "-100%" }}
                  animate={{ x: "100%" }}
                  transition={{ duration: 2, ease: "easeInOut" }}
                  className="absolute bottom-0 left-0 right-0 h-1 bg-linear-to-r from-transparent via-blue-500 to-transparent shadow-[0_0_20px_rgba(59,130,246,0.5)]"
                />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

const NavTab: React.FC<{
  label?: string;
  icon?: string;
  active?: boolean;
  ariaLabel?: string;
  onClick?: () => void;
}> = ({ label, icon, active, ariaLabel, onClick }) => (
  <button
    onClick={onClick}
    aria-label={ariaLabel || label}
    className={`
      px-4 py-2 rounded-full text-[10px] font-bold tracking-[0.15em] uppercase
      transition-all duration-300 flex items-center gap-1
      ${active
        ? "premium-glass-white text-black"
        : "text-white/40 hover:text-white/70 hover:bg-white/10"
      }
    `}
  >
    {icon && <span className="text-xs">{icon}</span>}
    {label}
  </button>
);

const StatItem: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: string;
  isEmpty?: boolean;
}> = ({ icon, label, value, isEmpty }) => (
  <div
    className={`rounded-2xl border p-4 min-h-[94px] flex flex-col justify-between ${isEmpty ? "border-white/5 bg-white/[0.02]" : "border-white/10 bg-white/[0.055]"
      }`}
  >
    <div className="flex items-center gap-2 text-white/40">
      {icon}
      <span className="text-[8px] font-bold tracking-[0.2em] uppercase">
        {label}
      </span>
    </div>
    <span
      className={`text-xl font-semibold tracking-tight truncate ${isEmpty ? "text-white/20" : "text-white"
        }`}
    >
      {value}
    </span>
  </div>
);

const AchievementStat: React.FC<{
  total: number;
  done: number;
  percent: number;
  label: string;
}> = ({ total, done, percent, label }) => {
  const isEmpty = total <= 0;

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.055] p-4 min-h-[94px] flex flex-col justify-between col-span-2">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-2 text-white/40">
          <Trophy className="w-4 h-4" />
          <div className="flex flex-col gap-1">
            <span className="text-[8px] font-bold tracking-[0.2em] uppercase">
              {label}
            </span>
            <span
              className={
                isEmpty ? "text-white/20 text-xs" : "text-white/55 text-xs"
              }
            >
              {isEmpty ? "---" : `${done}/${total}`}
            </span>
          </div>
        </div>
        <span
          className={
            isEmpty
              ? "text-2xl font-light text-white/20"
              : "text-2xl font-light text-white"
          }
        >
          {isEmpty ? "0%" : `${percent}%`}
        </span>
      </div>
      <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${isEmpty ? 0 : percent}%` }}
          transition={{ duration: 1, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="h-full bg-white rounded-full"
        />
      </div>
    </div>
  );
};

const AchievementRow: React.FC<{
  achievement: SteamAchievement;
  lockedLabel: string;
  unlockedLabel: string;
  unlockedAtLabel: string;
  formatDate: (unixTime: number) => string | null;
}> = ({
  achievement,
  lockedLabel,
  unlockedLabel,
  unlockedAtLabel,
  formatDate,
}) => {
  const unlockedAt = formatDate(achievement.unlockTime);

  return (
    <div
      className={`flex items-center gap-4 rounded-[24px] border p-4 transition-colors ${
        achievement.achieved
          ? "border-emerald-400/20 bg-emerald-500/[0.08]"
          : "border-white/10 bg-white/[0.035]"
      }`}
    >
      <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-black/25">
        {achievement.icon || achievement.iconGray ? (
          <img
            src={achievement.achieved ? achievement.icon : achievement.iconGray || achievement.icon}
            alt=""
            className={`h-full w-full object-cover ${achievement.achieved ? "" : "opacity-45 grayscale"}`}
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
          />
        ) : (
          <Trophy className="h-6 w-6 text-white/25" />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h4 className="truncate text-sm font-semibold text-white">
              {achievement.name}
            </h4>
            <p className="mt-1 text-xs leading-relaxed text-white/55">
              {achievement.description || " "}
            </p>
          </div>
          <span
            className={`shrink-0 rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] ${
              achievement.achieved
                ? "border-emerald-300/20 bg-emerald-400/10 text-emerald-200/90"
                : "border-white/10 bg-white/5 text-white/35"
            }`}
          >
            {achievement.achieved ? unlockedLabel : lockedLabel}
          </span>
        </div>

        {achievement.achieved && unlockedAt && (
          <p className="mt-3 text-[10px] font-bold uppercase tracking-[0.24em] text-white/35">
            {unlockedAtLabel} <span className="ml-1 text-white/55">{unlockedAt}</span>
          </p>
        )}
      </div>
    </div>
  );
};

const TechnicalDetail: React.FC<{
  label: string;
  value?: string;
  fallback: string;
}> = ({ label, value, fallback }) => (
  <div>
    <span className="block text-[10px] font-bold text-white/30 uppercase tracking-widest mb-1.5">
      {label}
    </span>
    <span className="text-white/80 text-sm font-medium">
      {value || fallback}
    </span>
  </div>
);

export default GameDetailPanel;
