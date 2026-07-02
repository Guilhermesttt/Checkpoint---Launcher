import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2,
  Plus,
  RefreshCw,
  Search,
  Unlink2,
  User,
  ChevronRight,
  Sparkles,
  Star,
  Gamepad2,
  Zap,
  Car,
  Swords,
  Trophy,
  Globe,
  Crosshair,
  MouseLeft,
  MouseRight,
  X,
  LogOut,
  Settings,
  Languages,
  Volume2,
} from "lucide-react";
import {
  collection,
  deleteDoc,
  getDocs,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "../../Firebase";
import ContextMenu from "../components/ContextMenu";
import DynamicBackground from "../components/DynamicBackground";
import GameRow from "../components/GameRow";
import LoadingSkeleton from "../components/LoadingSkeleton";
import { useNotification } from "../components/NotificationCenter";
import Stepper, { Step } from "../components/ReactBits/Stepper";
import GlassButton from "../components/ui/GlassButton";
import ModalShell from "../components/ui/ModalShell";
import { useAuth } from "../auth/AuthProvider";
import { useImagePreloader } from "../hooks/useImagePreloader";
import { useSoundEffects, type SoundEffectType } from "../hooks/useSoundEffects";
import { useGameColor } from "../hooks/useGameColor";
import {
  usePreferences,
  type LauncherLanguage,
  type SoundTheme,
} from "../context/PreferencesContext";
import { isBackendHealthy } from "../services/api";
import {
  disconnectSteamAccount,
  getSteamLinkUrl,
  syncSteamLibraryToFirestore,
} from "../services/steam";
import {
  disconnectEpicAccount,
  getEpicLinkUrl,
  syncEpicLibraryToFirestore,
} from "../services/epic";
import type { Game } from "../types/domain";
import {
  profileDocRef,
  userDocRef,
  userGameDocRef,
  userGamesCollectionRef,
} from "../services/firestorePaths";

const AddGameModal = React.lazy(() => import("../components/AddGameModal"));
const GameDetailPanel = React.lazy(() => import("../components/GameDetailPanel"));

const CATEGORIES = [
  { id: "ALL", label: "Todos", Icon: Gamepad2 },
  { id: "FAVORITES", label: "Favoritos", Icon: Star },
  { id: "STEAM", label: "Steam", Icon: Zap },
  { id: "EPIC", label: "Epic", Icon: Globe },
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

const normalizeCategory = (v?: string) =>
  v?.toUpperCase().replace(/[^A-Z0-9]/g, "") ?? "";
const steamIdKey = (uid: string) => `checkpoint_steam_id_${uid}`;
const steamDiscKey = (uid: string) => `checkpoint_steam_disconnected_${uid}`;
const LANGUAGE_OPTIONS: Array<{ id: LauncherLanguage; label: string; hint: string }> = [
  { id: "pt-BR", label: "PortuguÃªs", hint: "Brasil" },
  { id: "en-US", label: "English", hint: "United States" },
  { id: "es-ES", label: "EspaÃ±ol", hint: "EspaÃ±a" },
];

const SOUND_THEME_OPTIONS: Array<{ id: SoundTheme; labelKey: "defaultTheme" | "gamecubeTheme"; hint: string }> = [
  { id: "ps2", labelKey: "defaultTheme", hint: "PS2 System Sounds" },
  { id: "gamecube", labelKey: "gamecubeTheme", hint: "Nintendo GameCube Menu SFX" },
];

const Sidebar: React.FC<{
  activeCategory: string;
  onCategory: (id: string) => void;
  userDisplay: string;
  steamConnected: boolean;
  steamSyncing: boolean;
  steamConnecting: boolean;
  onSync: () => void;
  onConnect: () => void;
  onDisconnect: () => void;
  onAddGame: () => void;
  onSignOut: () => void;
  settingsLabel: string;
  playSound: (t: "select" | "back" | "navigate") => void;
}> = ({
  activeCategory,
  onCategory,
  userDisplay,
  steamConnected,
  steamSyncing,
  steamConnecting,
  onSync,
  onConnect,
  onDisconnect,
  onAddGame,
  onSignOut,
  settingsLabel,
  playSound,
}) => {
  const [showSteamMenu, setShowSteamMenu] = useState(false);

  return (
    <motion.aside
      initial={{ x: -80, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
      className="fixed left-0 top-0 bottom-0 z-50 flex flex-col"
      style={{ width: 96 }}
    >
      <div
        className="flex-1 flex flex-col items-center py-6 gap-1"
        style={{
          background: "rgba(6,6,10,0.78)",
          backdropFilter: "blur(40px)",
          borderRight: "1px solid rgba(255,255,255,0.055)",
        }}
      >
        <div className="mb-5 flex flex-col items-center">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{
              background: "rgba(255,255,255,0.92)",
              boxShadow: "0 4px 20px rgba(255,255,255,0.14)",
            }}
          >
            <Gamepad2 className="w-5 h-5 text-black" />
          </div>
        </div>

        <div
          className="w-8 h-px mb-3"
          style={{ background: "rgba(255,255,255,0.07)" }}
        />

        <nav className="flex flex-col gap-0.5 w-full px-2 flex-1">
          {CATEGORIES.map(({ id, label, Icon }) => {
            const active = activeCategory === id;
            return (
              <button
                key={id}
                onClick={() => {
                  onCategory(id);
                  playSound("navigate");
                }}
                title={label}
                className="relative group flex flex-col items-center justify-center gap-1 w-full py-2.5 rounded-xl transition-all duration-200"
                style={{
                  background: active ? "rgba(255,255,255,0.09)" : "transparent",
                  border: active
                    ? "1px solid rgba(255,255,255,0.1)"
                    : "1px solid transparent",
                }}
              >
                {active && (
                  <motion.div
                    layoutId="sb-active"
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full"
                    style={{ background: "rgba(255,255,255,0.75)" }}
                  />
                )}
                <Icon
                  className="w-[15px] h-[15px] transition-colors"
                  style={{
                    color: active
                      ? "rgba(255,255,255,0.88)"
                      : "rgba(255,255,255,0.28)",
                  }}
                />
                <span
                  className="text-[7.5px] font-black uppercase tracking-wide leading-none transition-colors"
                  style={{
                    color: active
                      ? "rgba(255,255,255,0.65)"
                      : "rgba(255,255,255,0.18)",
                  }}
                >
                  {label}
                </span>
                <div
                  className="absolute left-full ml-3 px-2.5 py-1.5 rounded-lg text-[11px] font-bold whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-150 z-50 translate-x-1 group-hover:translate-x-0"
                  style={{
                    background: "rgba(14,14,22,0.97)",
                    border: "1px solid rgba(255,255,255,0.09)",
                    color: "rgba(255,255,255,0.8)",
                    backdropFilter: "blur(16px)",
                    boxShadow: "0 8px 32px rgba(0,0,0,0.7)",
                  }}
                >
                  {label}
                </div>
              </button>
            );
          })}
        </nav>

        <div
          className="w-8 h-px my-3"
          style={{ background: "rgba(255,255,255,0.07)" }}
        />

        <button
          onClick={() => {
            onCategory("SETTINGS");
            playSound("navigate");
          }}
          title="ConfiguraÃ§Ãµes"
          className="relative group flex flex-col items-center justify-center gap-1 w-full mx-2 py-2.5 rounded-xl transition-all duration-200"
          style={{
            background:
              activeCategory === "SETTINGS"
                ? "rgba(255,255,255,0.09)"
                : "transparent",
            border:
              activeCategory === "SETTINGS"
                ? "1px solid rgba(255,255,255,0.1)"
                : "1px solid transparent",
          }}
        >
          {activeCategory === "SETTINGS" && (
            <motion.div
              layoutId="sb-active"
              className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full"
              style={{ background: "rgba(255,255,255,0.75)" }}
            />
          )}
          <Settings
            className="w-[15px] h-[15px] transition-colors"
            style={{
              color:
                activeCategory === "SETTINGS"
                  ? "rgba(255,255,255,0.88)"
                  : "rgba(255,255,255,0.28)",
            }}
          />
          <span
            className="text-[7.5px] font-black uppercase tracking-wide leading-none transition-colors"
            style={{
              color:
                activeCategory === "SETTINGS"
                  ? "rgba(255,255,255,0.65)"
                  : "rgba(255,255,255,0.18)",
            }}
          >
            {settingsLabel}
          </span>
          <div
            className="absolute left-full ml-3 px-2.5 py-1.5 rounded-lg text-[11px] font-bold whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-150 z-50 translate-x-1 group-hover:translate-x-0"
            style={{
              background: "rgba(14,14,22,0.97)",
              border: "1px solid rgba(255,255,255,0.09)",
              color: "rgba(255,255,255,0.8)",
              backdropFilter: "blur(16px)",
              boxShadow: "0 8px 32px rgba(0,0,0,0.7)",
            }}
          >
            {settingsLabel}
          </div>
        </button>
      </div>
    </motion.aside>
  );
};

const Home: React.FC = () => {
  const [games, setGames] = useState<Game[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [activeCategory, setActiveCategory] = useState("ALL");
  const [isLoading, setIsLoading] = useState(true);
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [steamSyncing, setSteamSyncing] = useState(false);
  const [steamConnecting, setSteamConnecting] = useState(false);
  const [epicSyncing, setEpicSyncing] = useState(false);
  const [epicConnecting, setEpicConnecting] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [signOutModalOpen, setSignOutModalOpen] = useState(false);
  const [disconnectSteamModalOpen, setDisconnectSteamModalOpen] =
    useState(false);
  const [disconnectEpicModalOpen, setDisconnectEpicModalOpen] =
    useState(false);
  const [isExitingSession, setIsExitingSession] = useState(false);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    game: Game;
  } | null>(null);

  const handleContextMenu = useCallback((e: React.MouseEvent, game: Game) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, game });
  }, []);
  const [editingGame, setEditingGame] = useState<Game | null>(null);
  const [onboardingCompleted, setOnboardingCompleted] = useState(false);

  const lastWheelTime = useRef<number>(0);

  const { notify } = useNotification();
  const { user, userProfile, signOutUser, refreshProfile } = useAuth();
  const {
    language: launcherLanguage,
    effectsVolume,
    musicVolume,
    soundTheme,
    setLanguage: setLauncherLanguage,
    setEffectsVolume,
    setMusicVolume,
    setSoundTheme,
    t,
  } = usePreferences();
  const { playSound } = useSoundEffects(effectsVolume / 100, soundTheme);
  const userDisplay =
    userProfile?.displayName || user?.email?.split("@")[0] || "Jogador";
  const resolvedSteamId = useMemo(
    () => userProfile?.steamId || undefined,
    [userProfile?.steamId],
  );
  const resolvedEpicAccountId = useMemo(
    () => userProfile?.epicAccountId || undefined,
    [userProfile?.epicAccountId],
  );

  useEffect(() => {
    if (!user?.uid) {
      setGames([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    const unsub = onSnapshot(
      query(userGamesCollectionRef(user.uid)),
      (snap) => {
        setGames(
          snap.docs
            .map((d) => ({ id: d.id, ...d.data() }) as Game)
            .sort((a, b) => a.title.localeCompare(b.title)),
        );
        setIsLoading(false);
      },
    );
    return () => unsub();
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid) {
      setOnboardingCompleted(false);
      return;
    }
    setOnboardingCompleted(
      localStorage.getItem(`checkpoint_onboarding_${user.uid}`) === "1" ||
        Boolean(userProfile?.onboardingCompletedAt),
    );
  }, [user?.uid, userProfile?.onboardingCompletedAt]);

  useEffect(() => {
    const migrate = async () => {
      if (!user?.uid || userProfile?.gamesMigratedAt) return;
      try {
        const snap = await getDocs(
          query(collection(db, "games"), where("ownerUid", "==", user.uid)),
        );
        const batch = writeBatch(db);
        if (!snap.empty) {
          snap.docs.forEach((d) => {
            const rest = { ...d.data() };
            delete rest.ownerUid;
            batch.set(userGameDocRef(user.uid, d.id), rest, { merge: true });
            batch.delete(d.ref);
          });
          batch.set(
            userDocRef(user.uid),
            { migratedAt: new Date().toISOString() },
            { merge: true },
          );
        }
        batch.set(
          profileDocRef(user.uid),
          { gamesMigratedAt: new Date().toISOString() },
          { merge: true },
        );
        await batch.commit();
      } catch (e) {
        if ((e as { code?: string })?.code === "permission-denied")
          await setDoc(
            profileDocRef(user.uid),
            {
              gamesMigratedAt: new Date().toISOString(),
              migrationSkippedReason: "legacy_games_permission_denied",
            },
            { merge: true },
          );
      } finally {
        await refreshProfile();
      }
    };
    void migrate();
  }, [refreshProfile, user?.uid, userProfile?.gamesMigratedAt]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const steamStatus = params.get("steamStatus");
    const epicStatus = params.get("epicStatus");
    if ((!steamStatus && !epicStatus) || !user?.uid) return;

    if (steamStatus === "ok") {
      localStorage.removeItem(steamDiscKey(user.uid));
      notify("Conta Steam conectada com sucesso.", "success");
      void refreshProfile();
    } else if (steamStatus) {
      const labels: Record<string, string> = {
        invalid_state: "Estado invÃ¡lido.",
        invalid: "Falha na validaÃ§Ã£o OpenID.",
        missing_id: "Steam ID nÃ£o retornado.",
        server_not_configured: "Backend Firebase Admin nÃ£o configurado.",
        error: "Erro inesperado.",
      };
      notify(
        labels[steamStatus] ?? "NÃ£o foi possÃ­vel conectar com a Steam.",
        "error",
      );
    }

    if (epicStatus === "ok") {
      notify("Conta Epic Games conectada com sucesso.", "success");
      void refreshProfile();
    } else if (epicStatus) {
      const labels: Record<string, string> = {
        invalid_state: "Estado invÃ¡lido.",
        denied: "Autorização da Epic Games cancelada.",
        missing_code: "Código de retorno da Epic Games não recebido.",
        missing_id: "Conta Epic Games não retornou identificador.",
        client_not_configured: "Credenciais da Epic Games não configuradas no backend.",
        server_not_configured: "Backend Firebase Admin não configurado.",
        token_error: "A Epic Games recusou a troca do código de autenticação.",
        error: "Erro inesperado.",
      };
      notify(
        labels[epicStatus] ?? "Não foi possível conectar com a Epic Games.",
        "error",
      );
    }

    window.history.replaceState({}, document.title, window.location.pathname);
  }, [notify, refreshProfile, user?.uid]);

  const displayGames = useMemo(() => {
    const s = searchTerm.trim().toLowerCase();
    const ordered = [...games].sort((a, b) => {
      if (Boolean(a.isFavorite) === Boolean(b.isFavorite)) return 0;
      return a.isFavorite ? -1 : 1;
    });

    const categoryConfig = CATEGORIES.find((c) => c.id === activeCategory);
    const categoryLabel = categoryConfig?.label;

    const filtered =
      activeCategory === "ALL"
        ? ordered
        : activeCategory === "FAVORITES"
          ? ordered.filter((g) => g.isFavorite)
          : activeCategory === "STEAM"
            ? ordered.filter((g) => g.launcherType === "steam")
          : activeCategory === "LOCAL"
              ? ordered.filter(
                  (g) => g.launcherType === "local" || !g.launcherType,
                )
              : activeCategory === "EPIC"
              ? ordered.filter((g) => g.launcherType === "epic")
              : ordered.filter((g) => {
                  const gCat = normalizeCategory(g.category);
                  return (
                    gCat === normalizeCategory(activeCategory) ||
                    gCat === normalizeCategory(categoryLabel)
                  );
                });
    return s
      ? filtered.filter(
          (g) =>
            g.title.toLowerCase().includes(s) ||
            (g.category ?? "").toLowerCase().includes(s),
        )
      : filtered;
  }, [activeCategory, games, searchTerm]);

  const canonicalIndex =
    displayGames.length > 0
      ? Math.min(Math.max(selectedIndex, 0), displayGames.length - 1)
      : 0;
  const currentGame = displayGames[canonicalIndex];
  const dominantColor = useGameColor(
    currentGame?.cardImage || currentGame?.image,
  );
  const isAnyModalOpen =
    isAddModalOpen ||
    isDetailOpen ||
    Boolean(contextMenu) ||
    signOutModalOpen ||
    disconnectSteamModalOpen ||
    disconnectEpicModalOpen;

  useImagePreloader(
    useMemo(
      () =>
        displayGames
          .slice(0, 6)
          .flatMap((g) => [g.image, g.cardImage].filter(Boolean) as string[]),
      [displayGames],
    ),
  );
  useEffect(() => {
    setSelectedIndex(0);
  }, [activeCategory]);
  useEffect(() => {
    if (displayGames.length === 0 && selectedIndex !== 0) setSelectedIndex(0);
    else if (displayGames.length > 0 && selectedIndex > displayGames.length - 1)
      setSelectedIndex(displayGames.length - 1);
  }, [displayGames.length, selectedIndex]);

  const openDetails = useCallback(
    (game: Game) => {
      setSelectedGame(game);
      setIsDetailOpen(true);
      setContextMenu(null);
      playSound("detailOpen");
    },
    [playSound],
  );
  useEffect(() => {
    if (isAnyModalOpen || displayGames.length === 0) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (["INPUT", "TEXTAREA"].includes(document.activeElement?.tagName || ""))
        return;

      if (e.key === "ArrowRight") {
        e.preventDefault();
        setSelectedIndex((p) => {
          const next = Math.min(p + 1, displayGames.length - 1);
          if (next !== p) playSound("navigate");
          return next;
        });
      } else if (e.key === "Escape") {
        if (searchOpen) {
          setSearchOpen(false);
          setSearchTerm("");
          playSound("back");
        }
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        setSelectedIndex((p) => {
          const prev = Math.max(p - 1, 0);
          if (prev !== p) playSound("navigate");
          return prev;
        });
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (displayGames[selectedIndex])
          openDetails(displayGames[selectedIndex]);
      } else if (e.key.toLowerCase() === "s") {
        if (!isAnyModalOpen) {
          e.preventDefault();
          setSearchOpen((prev) => !prev);
          playSound("search");
        }
      }
    };

    const handleWheel = (e: WheelEvent) => {
      const now = Date.now();
      if (now - lastWheelTime.current < 120) return;

      if (Math.abs(e.deltaX) > 15 || Math.abs(e.deltaY) > 15) {
        lastWheelTime.current = now;
        if (e.deltaY > 0 || e.deltaX > 0) {
          setSelectedIndex((p) => {
            const next = Math.min(p + 1, displayGames.length - 1);
            if (next !== p) playSound("navigate");
            return next;
          });
        } else {
          setSelectedIndex((p) => {
            const prev = Math.max(p - 1, 0);
            if (prev !== p) playSound("navigate");
            return prev;
          });
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("wheel", handleWheel, { passive: true });

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("wheel", handleWheel);
    };
  }, [isAnyModalOpen, displayGames, selectedIndex, openDetails, playSound]);

  const handleSyncSteam = async () => {
    if (!user?.uid || !resolvedSteamId) {
      notify("Conecte sua conta Steam para sincronizar.", "info");
      return;
    }
    const healthy = await isBackendHealthy();
    if (!healthy) {
      notify("Backend Steam offline.", "error");
      return;
    }
    setIsLoading(true);
    setSteamSyncing(true);
    try {
      const count = await syncSteamLibraryToFirestore(
        user.uid,
        resolvedSteamId,
      );
      notify(
        count === 0
          ? "Nenhum jogo retornado. Verifique se o perfil Ã© pÃºblico."
          : `${count} jogos importados/atualizados.`,
        count === 0 ? "info" : "success",
      );
      await refreshProfile();
    } catch (e) {
      notify(
        e instanceof Error ? e.message : "Falha na sincronizaÃ§Ã£o Steam.",
        "error",
      );
    } finally {
      setSteamSyncing(false);
      setIsLoading(false);
    }
  };

  const connectSteam = () => {
    if (!user?.uid) return;
    playSound("select");
    setSteamConnecting(true);

    notify(
      "Iniciando conexÃ£o com Steam. Isso pode levar alguns segundos se o servidor estiver acordando...",
      "info",
    );

    isBackendHealthy().then(async (h) => {
      if (!h) {
        notify(
          "O servidor Steam demorou demais para responder. Tente novamente em instantes.",
          "error",
        );
        setSteamConnecting(false);
        return;
      }
      try {
        window.location.href = await getSteamLinkUrl();
      } catch (e) {
        notify(
          e instanceof Error ? e.message : "NÃ£o foi possÃ­vel conectar com a Steam.",
          "error",
        );
        setSteamConnecting(false);
      }
    });
  };

  const handleSyncEpic = async () => {
    if (!user?.uid || !resolvedEpicAccountId) {
      notify("Conecte sua conta Epic para sincronizar.", "info");
      return;
    }
    const healthy = await isBackendHealthy();
    if (!healthy) {
      notify("Backend Epic offline.", "error");
      return;
    }
    setIsLoading(true);
    setEpicSyncing(true);
    try {
      const count = await syncEpicLibraryToFirestore(
        user.uid,
        resolvedEpicAccountId,
      );
      notify(
        count === 0
          ? "Nenhum jogo retornado. Verifique se o perfil é público."
          : `${count} jogos importados/atualizados.`,
        count === 0 ? "info" : "success",
      );
      await refreshProfile();
    } catch (e) {
      notify(
        e instanceof Error ? e.message : "Falha na sincronização Epic.",
        "error",
      );
    } finally {
      setEpicSyncing(false);
      setIsLoading(false);
    }
  };

  const connectEpic = () => {
    if (!user?.uid) return;
    playSound("select");
    setEpicConnecting(true);

    notify(
      "Iniciando conexão com Epic Games. Isso pode levar alguns segundos se o servidor estiver acordando...",
      "info",
    );

    isBackendHealthy().then(async (h) => {
      if (!h) {
        notify(
          "O servidor Epic Games demorou demais para responder. Tente novamente em instantes.",
          "error",
        );
        setEpicConnecting(false);
        return;
      }
      try {
        window.location.href = await getEpicLinkUrl();
      } catch (e) {
        notify(
          e instanceof Error ? e.message : "Não foi possível conectar com a Epic Games.",
          "error",
        );
        setEpicConnecting(false);
      }
    });
  };

  const onSelectHandler = useCallback(
    (index: number, openGame?: Game) => {
      if (openGame) {
        openDetails(openGame);
        return;
      }
      setSelectedIndex(index);
      playSound("navigate");
    },
    [openDetails, playSound],
  );

  const closeCtx = (silent = false) => {
    setContextMenu(null);
    if (!silent) playSound("back");
  };

  const handleMenuAction = async (action: string, game: Game) => {
    if (action === "delete") {
      if (!window.confirm(`Remover "${game.title}"?`) || !user?.uid) return;
      await deleteDoc(userGameDocRef(user.uid, game.id));
    } else if (action === "favorite" && user?.uid) {
      await updateDoc(userGameDocRef(user.uid, game.id), {
        isFavorite: !game.isFavorite,
      });
    } else if (action === "edit") {
      setEditingGame(game);
      setIsAddModalOpen(true);
      closeCtx(true);
      return;
    }
    closeCtx(true);
  };

  const handleSignOut = async () => {
    playSound("back");
    setIsExitingSession(true);
    await new Promise((r) => window.setTimeout(r, 850));
    await signOutUser();
  };

  const handleDisconnectSteam = async () => {
    if (!user?.uid) return;
    playSound("back");
    setIsLoading(true);
    try {
      await disconnectSteamAccount();
      const snap = await getDocs(
        query(
          userGamesCollectionRef(user.uid),
          where("launcherType", "==", "steam"),
        ),
      );
      if (snap.docs.length > 0) {
        const b = writeBatch(db);
        snap.docs.forEach((d) => b.delete(d.ref));
        await b.commit();
      }
      localStorage.removeItem(steamDiscKey(user.uid));
      localStorage.removeItem(steamIdKey(user.uid));
      await refreshProfile();
      setSelectedIndex(0);
      notify("Steam desconectada e biblioteca atualizada.", "success");
    } catch {
      notify("Erro ao desconectar conta Steam.", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisconnectEpic = async () => {
    if (!user?.uid) return;
    playSound("back");
    setIsLoading(true);
    try {
      await disconnectEpicAccount();
      const snap = await getDocs(
        query(
          userGamesCollectionRef(user.uid),
          where("launcherType", "==", "epic"),
        ),
      );
      if (snap.docs.length > 0) {
        const b = writeBatch(db);
        snap.docs.forEach((d) => b.delete(d.ref));
        await b.commit();
      }
      await refreshProfile();
      setSelectedIndex(0);
      notify("Epic Games desconectada e biblioteca atualizada.", "success");
    } catch {
      notify("Erro ao desconectar conta Epic Games.", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const closeAddModal = (silent = false) => {
    if (!silent) playSound("back");
    setIsAddModalOpen(false);
    setEditingGame(null);
    setGames((p) => p);
  };

  return (
    <div
      className="relative h-screen w-full text-white overflow-hidden no-scrollbar flex transition-colors duration-1000"
      style={
        {
          "--game-color": dominantColor.hex,
          "--game-text-color": dominantColor.isDark ? "#ffffff" : "#08080f",
        } as React.CSSProperties
      }
    >
      <DynamicBackground
        backgroundImage={
          currentGame?.backgroundImage ||
          currentGame?.image ||
          currentGame?.cardImage ||
          ""
        }
        reducedEffects={isAnyModalOpen}
      />

      <Sidebar
        activeCategory={activeCategory}
        onCategory={setActiveCategory}
        userDisplay={
          userProfile?.displayName || user?.email?.split("@")[0] || "Jogador"
        }
        steamConnected={Boolean(resolvedSteamId)}
        steamSyncing={steamSyncing}
        steamConnecting={steamConnecting}
        onSync={handleSyncSteam}
        onConnect={connectSteam}
        onDisconnect={() => setDisconnectSteamModalOpen(true)}
        onAddGame={() => setIsAddModalOpen(true)}
        onSignOut={() => setSignOutModalOpen(true)}
        settingsLabel={t("settings")}
        playSound={playSound}
      />

      <div
        className="flex-1 flex flex-col h-screen overflow-hidden"
        style={{ marginLeft: 96 }}
      >
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          className="shrink-0 flex items-center justify-between px-10 pt-7 relative"
        >
          <div className="flex items-center gap-5">
            <div className="flex items-center gap-2">
              <span
                className="text-[9.5px] font-black uppercase tracking-[0.32em]"
                style={{ color: "rgba(255,255,255,0.18)" }}
              >
                Checkpoint
              </span>

              <div className="relative flex items-center h-4 ml-1">
                <AnimatePresence>
                  {searchOpen && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9, x: -10 }}
                      animate={{ opacity: 1, scale: 1, x: 0 }}
                      exit={{ opacity: 0, scale: 0.9, x: -10 }}
                      className="absolute left-6 top-1/2 -translate-y-1/2 z-[60]"
                    >
                      <div className="relative">
                        <input
                          autoFocus
                          type="text"
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          placeholder={t("searchPlaceholder")}
                          className="h-8 w-48 rounded-xl bg-black/40 backdrop-blur-3xl border border-white/5 pl-3 pr-8 text-[11px] text-white outline-none shadow-2xl focus:border-white/10"
                          onBlur={() => {
                            if (!searchTerm) setSearchOpen(false);
                          }}
                        />
                        {searchTerm && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSearchTerm("");
                              playSound("back");
                            }}
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-white/10 rounded-full transition-all"
                          >
                            <X className="w-2.5 h-2.5 text-white/30 hover:text-white" />
                          </button>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <button
                  onClick={() => {
                    setSearchOpen((s) => !s);
                    playSound("search");
                  }}
                  onMouseEnter={() => playSound("hover")}
                  className="p-1 hover:bg-white/5 rounded-full transition-all group"
                >
                  <Search className="w-3.5 h-3.5 text-white/20 group-hover:text-white/50 transition-colors" />
                </button>
              </div>
            </div>

            <span style={{ color: "rgba(255,255,255,0.14)" }}>â€º</span>

            <AnimatePresence mode="wait">
              <motion.span
                key={activeCategory}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.18 }}
                className="text-[9.5px] font-black uppercase tracking-[0.32em]"
                style={{ color: "rgba(255,255,255,0.42)" }}
              >
                {activeCategory === "SETTINGS"
                  ? t("settings")
                  : CATEGORIES.find((c) => c.id === activeCategory)?.label}
              </motion.span>
            </AnimatePresence>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1 p-1 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
              <button
                onClick={() => {
                  setIsAddModalOpen(true);
                  playSound("select");
                }}
                className="flex items-center gap-2 px-4 py-2 rounded-xl transition-all hover:bg-white/10 group"
              >
                <Plus className="w-4 h-4 text-white/40 group-hover:text-white transition-colors" />
                <span className="text-[10px] font-black uppercase tracking-wider text-white/40 group-hover:text-white transition-colors">
                  {t("new")}
                </span>
              </button>

              <div className="w-px h-4 bg-white/10" />

              {resolvedSteamId ? (
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => {
                      playSound("back");
                      setDisconnectSteamModalOpen(true);
                    }}
                    className="relative flex items-center gap-2 px-3 py-2 rounded-xl transition-all hover:bg-red-500/10 group/steam"
                  >
                    <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)] group-hover/steam:bg-red-500 group-hover/steam:shadow-[0_0_8px_rgba(239,68,68,0.6)] transition-all" />
                    <div className="relative h-3 overflow-hidden min-w-[40px]">
                      <AnimatePresence mode="wait">
                        <motion.span
                          key="steam-label"
                          initial={{ y: 20, opacity: 0 }}
                          animate={{ y: 0, opacity: 1 }}
                          exit={{ y: -20, opacity: 0 }}
                          className="absolute inset-0 text-[10px] font-black uppercase tracking-wider text-emerald-500/60 group-hover/steam:hidden"
                        >
                          Steam
                        </motion.span>
                        <span className="hidden group-hover/steam:block text-[10px] font-black uppercase tracking-wider text-red-500/60 whitespace-nowrap">
                          {t("unlink")}
                        </span>
                      </AnimatePresence>
                    </div>
                  </button>

                  <div className="w-px h-3 bg-white/5" />

                  <button
                    onClick={handleSyncSteam}
                    disabled={steamSyncing}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl transition-all hover:bg-white/5 active:scale-95 disabled:opacity-50 group"
                  >
                    <RefreshCw
                      className={`w-3 h-3 text-white/30 group-hover:text-white/60 ${steamSyncing ? "animate-spin" : ""}`}
                    />
                    <span className="text-[10px] font-black uppercase tracking-wider text-white/30 group-hover:text-white/60">
                      {steamSyncing ? t("syncing") : t("sync")}
                    </span>
                  </button>
                </div>
              ) : (
                <button
                  onClick={connectSteam}
                  disabled={steamConnecting}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl transition-all hover:bg-white/10 group"
                >
                  <div className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]" />
                  <span className="text-[10px] font-black uppercase tracking-wider text-red-500/60 group-hover:text-white transition-colors">
                    {steamConnecting ? t("connecting") : t("connectSteam")}
                  </span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-3 pl-2">
              <div className="flex flex-col items-end">
                <span className="text-[8px] font-black uppercase tracking-widest text-white/20 select-none">
                  {t("identity")}
                </span>
                <span className="text-[10px] font-black uppercase text-white/70">
                  {userDisplay}
                </span>
              </div>

              <button
                onClick={() => setSignOutModalOpen(true)}
                className="h-10 px-4 rounded-xl flex items-center justify-center gap-2 transition-all bg-white/[0.03] border border-white/[0.06] hover:bg-red-500/10 hover:border-red-500/20 group"
              >
                <LogOut className="w-3.5 h-3.5 text-white/30 group-hover:text-red-400 transition-colors" />
              </button>
            </div>
          </div>
        </motion.div>

        <div className="flex-1 flex flex-col justify-end min-h-0">
          {activeCategory === "SETTINGS" ? (
            <SettingsPageV2
              language={launcherLanguage}
              effectsVolume={effectsVolume}
              musicVolume={musicVolume}
              soundTheme={soundTheme}
              onLanguageChange={(next) => {
                setLauncherLanguage(next);
                playSound("select");
              }}
              onEffectsVolumeChange={(next) => {
                setEffectsVolume(next);
              }}
              onMusicVolumeChange={setMusicVolume}
              onSoundThemeChange={(next) => {
                setSoundTheme(next);
                playSound("select");
              }}
              onPreviewSound={() => playSound("select")}
              t={t}
              steamConnected={Boolean(resolvedSteamId)}
              epicConnected={Boolean(resolvedEpicAccountId)}
              steamConnecting={steamConnecting}
              epicConnecting={epicConnecting}
              steamSyncing={steamSyncing}
              epicSyncing={epicSyncing}
              onConnectSteam={connectSteam}
              onConnectEpic={connectEpic}
              onDisconnectSteam={() => {
                playSound("back");
                setDisconnectSteamModalOpen(true);
              }}
              onDisconnectEpic={() => {
                playSound("back");
                setDisconnectEpicModalOpen(true);
              }}
              onSyncSteam={handleSyncSteam}
              onSyncEpic={handleSyncEpic}
            />
          ) : isLoading ? (
            <div className="flex-1 flex items-center justify-center">
              <LoadingSkeleton />
            </div>
          ) : displayGames.length === 0 ? (
            <div className="flex-1 flex items-center justify-center px-10">
              {onboardingCompleted ? (
                <EmptyState
                  searchTerm={searchTerm}
                  onAddGame={() => setIsAddModalOpen(true)}
                  onConnect={connectSteam}
                  steamConnected={Boolean(resolvedSteamId)}
                />
              ) : (
                <EmptyLibraryOnboarding
                  onConnectSteam={connectSteam}
                  onOpenAddGame={() => setIsAddModalOpen(true)}
                  onComplete={async () => {
                    if (!user?.uid) return;
                    localStorage.setItem(
                      `checkpoint_onboarding_${user.uid}`,
                      "1",
                    );
                    setOnboardingCompleted(true);
                    await setDoc(
                      profileDocRef(user.uid),
                      { onboardingCompletedAt: new Date().toISOString() },
                      { merge: true },
                    );
                    await refreshProfile();
                  }}
                  playSound={playSound}
                />
              )}
            </div>
          ) : (
            <>
              <motion.div
                className="px-10 pb-7 shrink-0"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5, delay: 0.2 }}
              >
                <AnimatePresence mode="wait">
                  <motion.div
                    key={`hero-${currentGame?.id}`}
                    initial={{ opacity: 0, y: 18, filter: "blur(8px)" }}
                    animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                    exit={{ opacity: 0, y: -8, filter: "blur(4px)" }}
                    transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
                    className="flex items-end justify-between gap-8"
                  >
                    <div className="min-w-0 flex-1">
                      <p
                        className="text-[10px] font-black uppercase tracking-[0.28em] mb-2.5"
                        style={{ color: "rgba(255,255,255,0.25)" }}
                      >
                        {currentGame?.category ?? "Jogo"} Â· {canonicalIndex + 1}
                        /{displayGames.length}
                      </p>
                      <h1
                        className="font-black tracking-tighter text-white uppercase leading-none"
                        style={{
                          fontSize: "clamp(2.8rem, 5.5vw, 5.5rem)",
                          textShadow: "0 8px 48px rgba(0,0,0,0.85)",
                          maxWidth: "75vw",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {currentGame?.title}
                      </h1>
                      <div className="flex items-center gap-4 mt-3.5 flex-wrap">
                        {currentGame?.launcherType === "steam" && (
                          <span
                            className="flex items-center gap-1.5 text-[11px] font-bold"
                            style={{ color: "rgba(103,182,118,0.82)" }}
                          >
                            <Zap className="w-3 h-3" /> {t("viaSteam")}
                          </span>
                        )}
                        {currentGame?.hoursPlayed != null && (
                          <span
                            className="text-[11px] font-semibold"
                            style={{ color: "rgba(255,255,255,0.3)" }}
                          >
                            {currentGame.hoursPlayed}h jogadas
                          </span>
                        )}
                        {currentGame?.isFavorite && (
                          <span className="flex items-center gap-1 text-[11px] font-bold text-amber-400/75">
                            <Star className="w-3 h-3 fill-current" /> {t("favorite")}
                          </span>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={() => currentGame && openDetails(currentGame)}
                      onMouseEnter={() => playSound("hover")}
                      className="shrink-0 flex items-center gap-3 px-8 py-4 rounded-full font-black text-[13px] tracking-wider uppercase relative overflow-hidden group transition-all duration-500"
                      style={{
                        background: "var(--game-color, rgba(255,255,255,1))",
                        color: "var(--game-text-color, #08080f)",
                        boxShadow:
                          "0 0 0 1.5px rgba(255,255,255,0.08), 0 20px 56px var(--game-color, rgba(0,0,0,0.7))",
                      }}
                      onMouseOver={(e) => {
                        const b = e.currentTarget as HTMLButtonElement;
                        b.style.transform = "scale(1.04)";
                        b.style.boxShadow =
                          "0 0 0 1.5px rgba(255,255,255,0.12), 0 24px 64px var(--game-color, rgba(0,0,0,0.8))";
                      }}
                      onMouseOut={(e) => {
                        const b = e.currentTarget as HTMLButtonElement;
                        b.style.transform = "scale(1)";
                        b.style.boxShadow =
                          "0 0 0 1.5px rgba(255,255,255,0.08), 0 20px 56px var(--game-color, rgba(0,0,0,0.7))";
                      }}
                    >
                      <span
                        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
                        style={{
                          background:
                            "linear-gradient(105deg, transparent 38%, rgba(255,255,255,0.38) 50%, transparent 62%)",
                        }}
                      />
                      <svg
                        viewBox="0 0 24 24"
                        className="w-5 h-5 fill-current relative z-10 transition-colors"
                        style={{
                          color: "var(--game-text-color)",
                          fill: "var(--game-text-color)",
                        }}
                      >
                        <path d="M8 5v14l11-7z" />
                      </svg>
                      <span
                        className="relative z-10 transition-colors"
                        style={{ color: "var(--game-text-color)" }}
                      >
                        {t("playNow")}
                      </span>
                    </button>
                  </motion.div>
                </AnimatePresence>
              </motion.div>

              <div className="shrink-0 pb-14">
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.div
                    key={activeCategory}
                    initial={{ opacity: 0, y: 28 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 14 }}
                    transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                  >
                    <GameRow
                      games={displayGames}
                      selectedIndex={selectedIndex}
                      onSelect={onSelectHandler}
                      onContextMenu={handleContextMenu}
                      playSound={playSound}
                    />
                  </motion.div>
                </AnimatePresence>
              </div>
            </>
          )}
        </div>

        <div
          className="fixed bottom-0 z-30 flex items-center justify-between px-8 py-3.5 pointer-events-none"
          style={{
            left: 96,
            right: 0,
            background:
              "linear-gradient(to top, rgba(4,4,8,0.9) 0%, transparent 100%)",
          }}
        >
          <p
            className="text-[9px] font-black uppercase tracking-[0.28em]"
            style={{ color: "rgba(255,255,255,0.16)" }}
          >
            {displayGames.length} {displayGames.length === 1 ? "jogo" : "jogos"}
          </p>
          <div className="flex items-center gap-7">
            {[
              {
                label: "Navegar",
                node: <span className="text-[12px] font-bold">â† â†’</span>,
              },
              { label: "Abrir", node: <MouseLeft className="w-3.5 h-3.5" /> },
              { label: "OpÃ§Ãµes", node: <MouseRight className="w-3.5 h-3.5" /> },
            ].map(({ label, node }) => (
              <div key={label} className="flex items-center gap-2">
                <span style={{ color: "rgba(255,255,255,0.28)" }}>{node}</span>
                <span
                  className="text-[9px] font-black uppercase tracking-[0.2em]"
                  style={{ color: "rgba(255,255,255,0.18)" }}
                >
                  {label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <React.Suspense fallback={null}>
        <GameDetailPanel
          game={selectedGame}
          isOpen={isDetailOpen}
          onClose={() => {
            playSound("back");
            setIsDetailOpen(false);
          }}
          playSound={playSound}
        />
      </React.Suspense>

      <ContextMenu
        x={contextMenu?.x ?? 0}
        y={contextMenu?.y ?? 0}
        isOpen={Boolean(contextMenu)}
        onClose={closeCtx}
        onAction={(a) => contextMenu && handleMenuAction(a, contextMenu.game)}
        isFavorite={contextMenu?.game.isFavorite}
        playSound={playSound}
      />

      <React.Suspense fallback={null}>
        <AddGameModal
          isOpen={isAddModalOpen}
          onClose={closeAddModal}
          onSaved={() => {}}
          playSound={playSound}
          gameToEdit={editingGame}
        />
      </React.Suspense>

      <ConfirmationModal
        isOpen={signOutModalOpen}
        title={t("signOutTitle")}
        description={t("signOutDescription")}
        confirmLabel={t("signOutConfirm")}
        onClose={() => setSignOutModalOpen(false)}
        onConfirm={async () => {
          setSignOutModalOpen(false);
          await handleSignOut();
        }}
        playSound={playSound}
      />

      <ConfirmationModal
        isOpen={disconnectSteamModalOpen}
        title={t("disconnectSteamTitle")}
        description={t("disconnectSteamDescription")}
        confirmLabel={t("confirm")}
        onClose={() => setDisconnectSteamModalOpen(false)}
        onConfirm={async () => {
          setDisconnectSteamModalOpen(false);
          await handleDisconnectSteam();
        }}
        playSound={playSound}
      />

      <ConfirmationModal
        isOpen={disconnectEpicModalOpen}
        title={t("disconnectEpicTitle")}
        description={t("disconnectEpicDescription")}
        confirmLabel={t("confirm")}
        onClose={() => setDisconnectEpicModalOpen(false)}
        onConfirm={async () => {
          setDisconnectEpicModalOpen(false);
          await handleDisconnectEpic();
        }}
        playSound={playSound}
      />

      <AnimatePresence>
        {isExitingSession && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[210] flex flex-col items-center justify-center"
            style={{ background: "#050507" }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              className="text-center"
            >
              <div className="w-16 h-16 mx-auto mb-8 rounded-full flex items-center justify-center animate-pulse">
                <Gamepad2 className="w-7 h-7 text-black" />
              </div>
              <h3 className="text-3xl font-black text-white tracking-tighter uppercase mb-4">
                Encerrando SessÃ£o
              </h3>
              <p
                className="text-[10px] tracking-[0.4em] uppercase"
                style={{ color: "rgba(255,255,255,0.3)" }}
              >
                AtÃ© logo
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const SettingsPageV2: React.FC<{
  language: LauncherLanguage;
  effectsVolume: number;
  musicVolume: number;
  soundTheme: SoundTheme;
  onLanguageChange: (language: LauncherLanguage) => void;
  onEffectsVolumeChange: (volume: number) => void;
  onMusicVolumeChange: (volume: number) => void;
  onSoundThemeChange: (theme: SoundTheme) => void;
  onPreviewSound: () => void;
  t: ReturnType<typeof usePreferences>["t"];
  steamConnected: boolean;
  epicConnected: boolean;
  steamConnecting: boolean;
  epicConnecting: boolean;
  steamSyncing: boolean;
  epicSyncing: boolean;
  onConnectSteam: () => void;
  onConnectEpic: () => void;
  onDisconnectSteam: () => void;
  onDisconnectEpic: () => void;
  onSyncSteam: () => void;
  onSyncEpic: () => void;
}> = ({
  language,
  effectsVolume,
  musicVolume,
  soundTheme,
  onLanguageChange,
  onEffectsVolumeChange,
  onMusicVolumeChange,
  onSoundThemeChange,
  onPreviewSound,
  t,
  steamConnected,
  epicConnected,
  steamConnecting,
  epicConnecting,
  steamSyncing,
  epicSyncing,
  onConnectSteam,
  onConnectEpic,
  onDisconnectSteam,
  onDisconnectEpic,
  onSyncSteam,
  onSyncEpic,
}) => (
  <motion.div
    initial={{ opacity: 0, y: 24, filter: "blur(8px)" }}
    animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
    transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
    className="flex-1 px-10 pb-14 pt-8 overflow-y-auto thin-scrollbar"
  >
    <div className="max-w-5xl">
      <div className="mb-10">
        <p className="text-[10px] font-black uppercase tracking-[0.32em] text-white/25 mb-3">
          {t("system")}
        </p>
        <h1 className="text-5xl font-black tracking-tight text-white uppercase">
          {t("settings")}
        </h1>
      </div>

      <section className="rounded-[28px] border border-white/10 bg-black/35 backdrop-blur-3xl p-6 mb-5">
        <SettingsHeader
          icon={<Globe className="w-5 h-5 text-white/70" />}
          title={t("connectedAccounts")}
          description={t("connectedAccountsHint")}
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-center justify-between p-4 rounded-xl bg-white/[0.03] border border-white/[0.05">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
                <Zap className="w-4 h-4 text-white/60" />
              </div>
              <div>
                <p className="text-sm font-bold text-white">Steam</p>
                <p className="text-[10px] text-white/40">
                  {steamConnected ? t("connected") : t("notConnected")}
                </p>
              </div>
            </div>
            {steamConnected ? (
              <div className="flex items-center gap-2">
                <button
                onClick={onSyncSteam}
                disabled={steamSyncing}
                className="px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase text-white/60 hover:text-white hover:bg-white/10 transition-all disabled:opacity-50"
              >
                {steamSyncing ? t("syncing") : t("sync")}
              </button>
              <button
                onClick={onDisconnectSteam}
                className="px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-all"
              >
                {t("unlink")}
              </button>
              </div>
            ) : (
              <button
                onClick={onConnectSteam}
                disabled={steamConnecting}
                className="px-4 py-2 rounded-lg text-[10px] font-bold uppercase text-white/70 hover:text-white hover:bg-white/10 transition-all disabled:opacity-50"
              >
                {steamConnecting ? t("connecting") : t("connectSteam")}
              </button>
            )}
          </div>

          <div className="flex items-center justify-between p-4 rounded-xl bg-white/[0.03] border border-white/[0.05]">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
                <Globe className="w-4 h-4 text-white/60" />
              </div>
              <div>
                <p className="text-sm font-bold text-white">Epic Games</p>
                <p className="text-[10px] text-white/40">
                  {epicConnected ? t("connected") : t("notConnected")}
                </p>
              </div>
            </div>
            {epicConnected ? (
              <div className="flex items-center gap-2">
                <button
                onClick={onSyncEpic}
                disabled={epicSyncing}
                className="px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase text-white/60 hover:text-white hover:bg-white/10 transition-all disabled:opacity-50"
              >
                {epicSyncing ? t("syncing") : t("sync")}
              </button>
              <button
                onClick={onDisconnectEpic}
                className="px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-all"
              >
                {t("unlink")}
              </button>
              </div>
            ) : (
              <button
                onClick={onConnectEpic}
                disabled={epicConnecting}
                className="px-4 py-2 rounded-lg text-[10px] font-bold uppercase text-white/70 hover:text-white hover:bg-white/10 transition-all disabled:opacity-50"
              >
                {epicConnecting ? t("connecting") : t("connectEpic")}
              </button>
            )}
          </div>

        </div>
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <section className="rounded-[28px] border border-white/10 bg-black/35 backdrop-blur-3xl p-6">
          <SettingsHeader
            icon={<Languages className="w-5 h-5 text-white/70" />}
            title={t("language")}
            description={t("languageHint")}
          />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {LANGUAGE_OPTIONS.map((option) => (
              <SettingsChoice
                key={option.id}
                active={language === option.id}
                label={option.label}
                hint={option.hint}
                onClick={() => onLanguageChange(option.id)}
              />
            ))}
          </div>
        </section>

        <section className="rounded-[28px] border border-white/10 bg-black/35 backdrop-blur-3xl p-6">
          <SettingsHeader
            icon={<Settings className="w-5 h-5 text-white/70" />}
            title={t("soundTheme")}
            description={t("soundThemeHint")}
          />
          <div className="grid grid-cols-2 gap-3">
            {SOUND_THEME_OPTIONS.map((option) => (
              <SettingsChoice
                key={option.id}
                active={soundTheme === option.id}
                label={t(option.labelKey)}
                hint={option.hint}
                onClick={() => onSoundThemeChange(option.id)}
              />
            ))}
          </div>
        </section>

        <VolumeSettingsCard
          title={t("soundEffects")}
          description={t("soundEffectsHint")}
          value={effectsVolume}
          max={100}
          actionLabel={t("test")}
          onAction={onPreviewSound}
          onChange={onEffectsVolumeChange}
          t={t}
        />

        <VolumeSettingsCard
          title={t("music")}
          description={t("musicHint")}
          value={musicVolume}
          max={35}
          onChange={onMusicVolumeChange}
          t={t}
        />
      </div>
    </div>
  </motion.div>
);

const SettingsHeader: React.FC<{
  icon: React.ReactNode;
  title: string;
  description: string;
}> = ({ icon, title, description }) => (
  <div className="flex items-center gap-3 mb-6">
    <div className="h-10 w-10 rounded-2xl bg-white/10 border border-white/10 flex items-center justify-center">
      {icon}
    </div>
    <div>
      <h2 className="text-lg font-bold text-white">{title}</h2>
      <p className="text-xs text-white/40">{description}</p>
    </div>
  </div>
);

const SettingsChoice: React.FC<{
  active: boolean;
  label: string;
  hint: string;
  onClick: () => void;
}> = ({ active, label, hint, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="text-left rounded-2xl border p-4 transition-all"
    style={{
      background: active ? "rgba(255,255,255,0.13)" : "rgba(255,255,255,0.04)",
      borderColor: active ? "rgba(255,255,255,0.28)" : "rgba(255,255,255,0.08)",
    }}
  >
    <span className="block text-sm font-bold text-white">{label}</span>
    <span className="mt-1 block text-[10px] uppercase tracking-widest text-white/35">
      {hint}
    </span>
  </button>
);

const VolumeSettingsCard: React.FC<{
  title: string;
  description: string;
  value: number;
  max: number;
  actionLabel?: string;
  onAction?: () => void;
  onChange: (volume: number) => void;
  t: ReturnType<typeof usePreferences>["t"];
}> = ({ title, description, value, max, actionLabel, onAction, onChange, t }) => (
  <section className="rounded-[28px] border border-white/10 bg-black/35 backdrop-blur-3xl p-6">
    <SettingsHeader
      icon={<Volume2 className="w-5 h-5 text-white/70" />}
      title={title}
      description={description}
    />
    <div className="flex items-end justify-between gap-5 mb-5">
      <div>
        <span className="text-6xl font-light text-white tabular-nums">
          {value}
        </span>
        <span className="ml-1 text-sm font-bold text-white/35">%</span>
      </div>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="h-10 px-4 rounded-xl bg-white text-black text-[10px] font-black uppercase tracking-wider"
        >
          {actionLabel}
        </button>
      )}
    </div>
    <input
      type="range"
      min={0}
      max={max}
      step={1}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-full accent-white"
    />
    <div className="mt-3 flex justify-between text-[10px] font-black uppercase tracking-widest text-white/25">
      <span>{t("mute")}</span>
      <span>{t("max")}</span>
    </div>
  </section>
);

const SettingsPage: React.FC<{
  language: LauncherLanguage;
  volume: number;
  onLanguageChange: (language: LauncherLanguage) => void;
  onVolumeChange: (volume: number) => void;
  onPreviewSound: () => void;
}> = ({
  language,
  volume,
  onLanguageChange,
  onVolumeChange,
  onPreviewSound,
}) => (
  (() => {
    const copy = {
      "pt-BR": {
        eyebrow: "Sistema",
        title: "Ajustes",
        language: "Idioma",
        languageHint: "PreferÃªncia visual salva neste dispositivo.",
        sound: "Efeitos sonoros",
        soundHint: "Volume de navegaÃ§Ã£o, seleÃ§Ã£o e retorno.",
        test: "Testar",
        mute: "Mudo",
        max: "MÃ¡ximo",
      },
      "en-US": {
        eyebrow: "System",
        title: "Settings",
        language: "Language",
        languageHint: "Visual preference saved on this device.",
        sound: "Sound effects",
        soundHint: "Navigation, selection and back volume.",
        test: "Test",
        mute: "Mute",
        max: "Max",
      },
      "es-ES": {
        eyebrow: "Sistema",
        title: "Ajustes",
        language: "Idioma",
        languageHint: "Preferencia visual guardada en este dispositivo.",
        sound: "Efectos sonoros",
        soundHint: "Volumen de navegaciÃ³n, selecciÃ³n y retorno.",
        test: "Probar",
        mute: "Silencio",
        max: "MÃ¡ximo",
      },
    }[language];

    return (
      <motion.div
        initial={{ opacity: 0, y: 24, filter: "blur(8px)" }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="flex-1 px-10 pb-14 pt-8 overflow-y-auto thin-scrollbar"
      >
        <div className="max-w-5xl">
          <div className="mb-10">
            <p className="text-[10px] font-black uppercase tracking-[0.32em] text-white/25 mb-3">
              {copy.eyebrow}
            </p>
            <h1 className="text-5xl font-black tracking-tight text-white uppercase">
              {copy.title}
            </h1>
          </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.1fr_0.9fr] gap-5">
        <section className="rounded-[28px] border border-white/10 bg-black/35 backdrop-blur-3xl p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-10 w-10 rounded-2xl bg-white/10 border border-white/10 flex items-center justify-center">
              <Languages className="w-5 h-5 text-white/70" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">{copy.language}</h2>
              <p className="text-xs text-white/40">
                {copy.languageHint}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {LANGUAGE_OPTIONS.map((option) => {
              const active = language === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => onLanguageChange(option.id)}
                  className="text-left rounded-2xl border p-4 transition-all"
                  style={{
                    background: active
                      ? "rgba(255,255,255,0.13)"
                      : "rgba(255,255,255,0.04)",
                    borderColor: active
                      ? "rgba(255,255,255,0.28)"
                      : "rgba(255,255,255,0.08)",
                  }}
                >
                  <span className="block text-sm font-bold text-white">
                    {option.label}
                  </span>
                  <span className="mt-1 block text-[10px] uppercase tracking-widest text-white/35">
                    {option.hint}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="rounded-[28px] border border-white/10 bg-black/35 backdrop-blur-3xl p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-10 w-10 rounded-2xl bg-white/10 border border-white/10 flex items-center justify-center">
              <Volume2 className="w-5 h-5 text-white/70" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">{copy.sound}</h2>
              <p className="text-xs text-white/40">
                {copy.soundHint}
              </p>
            </div>
          </div>

          <div className="flex items-end justify-between gap-5 mb-5">
            <div>
              <span className="text-6xl font-light text-white tabular-nums">
                {volume}
              </span>
              <span className="ml-1 text-sm font-bold text-white/35">%</span>
            </div>
            <button
              type="button"
              onClick={onPreviewSound}
              className="h-10 px-4 rounded-xl bg-white text-black text-[10px] font-black uppercase tracking-wider"
            >
              {copy.test}
            </button>
          </div>

          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={volume}
            onChange={(e) => onVolumeChange(Number(e.target.value))}
            className="w-full accent-white"
          />
          <div className="mt-3 flex justify-between text-[10px] font-black uppercase tracking-widest text-white/25">
            <span>{copy.mute}</span>
            <span>{copy.max}</span>
          </div>
        </section>
      </div>
    </div>
  </motion.div>
    );
  })()
);

const EmptyState: React.FC<{
  searchTerm: string;
  onAddGame: () => void;
  onConnect: () => void;
  steamConnected: boolean;
}> = ({ searchTerm, onAddGame, onConnect, steamConnected }) => (
  <div
    className="w-full max-w-md rounded-3xl p-8 text-center"
    style={{
      background: "rgba(255,255,255,0.04)",
      border: "1px solid rgba(255,255,255,0.08)",
      backdropFilter: "blur(24px)",
    }}
  >
    <h3 className="text-2xl font-black text-white mb-2">
      {searchTerm ? "Nenhum resultado" : "Biblioteca vazia"}
    </h3>
    <p className="text-sm mb-6" style={{ color: "rgba(255,255,255,0.45)" }}>
      {searchTerm
        ? "Tente buscar por outro termo."
        : steamConnected
          ? "VocÃª nÃ£o possui jogos salvos. Adicione um jogo manualmente."
          : "Adicione um jogo ou conecte sua conta Steam."}
    </p>
    {!searchTerm && (
      <div className="flex justify-center gap-3">
        {!steamConnected && (
          <button
            onClick={onConnect}
            className="h-10 px-5 rounded-full text-[11px] font-black uppercase tracking-wider transition-all hover:scale-[1.02]"
            style={{
              background: "rgba(103,182,118,0.1)",
              border: "1px solid rgba(103,182,118,0.3)",
              color: "#67b676",
            }}
          >
            Conectar Steam
          </button>
        )}
        <button
          onClick={onAddGame}
          className="h-10 px-5 rounded-full bg-white text-black text-[11px] font-black uppercase tracking-wider hover:scale-[1.02] transition-all"
        >
          Novo Jogo
        </button>
      </div>
    )}
  </div>
);

const EmptyLibraryOnboarding: React.FC<{
  onConnectSteam: () => void;
  onOpenAddGame: () => void;
  onComplete: () => void | Promise<void>;
  playSound: (type: SoundEffectType) => void;
}> = ({ onConnectSteam, onOpenAddGame, onComplete, playSound }) => (
  <div
    className="w-full max-w-2xl rounded-3xl p-8"
    style={{
      background: "rgba(255,255,255,0.04)",
      border: "1px solid rgba(255,255,255,0.09)",
      backdropFilter: "blur(32px)",
    }}
  >
    <p
      className="text-[10px] tracking-[0.28em] uppercase mb-4"
      style={{ color: "rgba(255,255,255,0.3)" }}
    >
      Primeiros passos
    </p>
    <Stepper
      stepCircleContainerClassName="bg-transparent border-0 shadow-none"
      stepContainerClassName="pt-2"
      contentClassName="pb-2"
      footerClassName="pt-2"
      backButtonText="Voltar"
      nextButtonText="PrÃ³ximo"
      onStepChange={() => playSound("navigate")}
      onFinalStepCompleted={() => {
        playSound("select");
        void onComplete();
      }}
      resetOnComplete
    >
      <Step>
        <h3 className="text-2xl font-black mb-2 text-white">
          Sua biblioteca estÃ¡ vazia
        </h3>
        <p className="text-sm" style={{ color: "rgba(255,255,255,0.55)" }}>
          Adicione um jogo manualmente ou conecte sua conta Steam.
        </p>
      </Step>
      <Step>
        <h3 className="text-2xl font-black mb-2 text-white">
          Conecte com a Steam
        </h3>
        <p className="text-sm mb-5" style={{ color: "rgba(255,255,255,0.55)" }}>
          Vincule sua conta para importar jogos automaticamente.
        </p>
        <button
          type="button"
          onClick={onConnectSteam}
          className="h-10 px-5 rounded-full text-[11px] font-black tracking-wider uppercase transition-all"
          style={{
            background: "rgba(103,182,118,0.1)",
            border: "1px solid rgba(103,182,118,0.35)",
            color: "#67b676",
          }}
        >
          Conectar Steam
        </button>
      </Step>
      <Step>
        <h3 className="text-2xl font-black mb-2 text-white">
          Adicione manualmente
        </h3>
        <p className="text-sm mb-5" style={{ color: "rgba(255,255,255,0.55)" }}>
          Cadastre seu primeiro jogo manualmente agora.
        </p>
        <button
          type="button"
          onClick={() => {
            playSound("select");
            onOpenAddGame();
          }}
          className="h-10 px-5 rounded-full bg-white text-black text-[11px] font-black tracking-wider uppercase hover:scale-[1.02] transition-all"
        >
          Novo Jogo
        </button>
      </Step>
    </Stepper>
    <p
      className="mt-5 text-[11px] flex items-center gap-2"
      style={{ color: "rgba(255,255,255,0.35)" }}
    >
      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
      Depois da primeira sincronizaÃ§Ã£o, seus jogos aparecem automaticamente.
    </p>
  </div>
);

const ConfirmationModal: React.FC<{
  isOpen: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
  playSound: (type: SoundEffectType) => void;
}> = ({
  isOpen,
  title,
  description,
  confirmLabel,
  onClose,
  onConfirm,
  playSound,
}) => (
  <ModalShell
    isOpen={isOpen}
    onClose={() => {
      playSound("back");
      onClose();
    }}
    maxWidthClassName="max-w-md"
    zIndexClassName="z-[170]"
    className="bg-[#0a0a0c]/95 backdrop-blur-3xl rounded-[32px] p-8 border border-white/10 shadow-2xl"
  >
    <h3 className="text-xl font-semibold text-white mb-2">{title}</h3>
    <p className="text-sm" style={{ color: "rgba(255,255,255,0.55)" }}>
      {description}
    </p>
    <div className="mt-6 flex items-center justify-end gap-2">
      <GlassButton
        type="button"
        onClick={() => {
          playSound("back");
          onClose();
        }}
        onMouseEnter={() => playSound("hover")}
        variant="outline"
      >
        Cancelar
      </GlassButton>
      <GlassButton
        type="button"
        onClick={() => {
          playSound("select");
          void onConfirm();
        }}
        onMouseEnter={() => playSound("hover")}
        variant="white"
      >
        {confirmLabel}
      </GlassButton>
    </div>
  </ModalShell>
);

export default Home;
