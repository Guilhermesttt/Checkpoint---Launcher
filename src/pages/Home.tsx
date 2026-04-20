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
import AddGameModal from "../components/AddGameModal";
import ContextMenu from "../components/ContextMenu";
import DynamicBackground from "../components/DynamicBackground";
import GameDetailPanel from "../components/GameDetailPanel";
import GameRow from "../components/GameRow";
import LoadingSkeleton from "../components/LoadingSkeleton";
import { useNotification } from "../components/NotificationCenter";
import Stepper, { Step } from "../components/ReactBits/Stepper";
import GlassButton from "../components/ui/GlassButton";
import ModalShell from "../components/ui/ModalShell";
import { useAuth } from "../auth/AuthProvider";
import { useImagePreloader } from "../hooks/useImagePreloader";
import { useSoundEffects } from "../hooks/useSoundEffects";
import { useGameColor } from "../hooks/useGameColor";
import { isBackendHealthy } from "../services/api";
import {
  getSteamApiKeyPageUrl,
  getSteamLinkUrl,
  isSteamApiKeyConfigured,
  saveSteamApiKey,
  syncSteamLibraryToFirestore,
} from "../services/steam";
import type { Game } from "../types/domain";
import {
  profileDocRef,
  userDocRef,
  userGameDocRef,
  userGamesCollectionRef,
} from "../services/firestorePaths";

// ─── Category config with icons ──────────────────────────────────────────────
const CATEGORIES = [
  { id: "ALL", label: "Todos", Icon: Gamepad2 },
  { id: "FAVORITES", label: "Favoritos", Icon: Star },
  { id: "STEAM", label: "Steam", Icon: Zap },
  { id: "LOCAL", label: "Local", Icon: Sparkles },
  { id: "RACING", label: "Corrida", Icon: Car },
  { id: "ROLEPLAYING", label: "RPG", Icon: Swords },
  { id: "SPORTS", label: "Esportes", Icon: Trophy },
  { id: "ONLINE", label: "Online", Icon: Globe },
  { id: "SHOOTER", label: "Tiro", Icon: Crosshair },
  { id: "ACTION", label: "Ação", Icon: Gamepad2 },
  { id: "ADVENTURE", label: "Aventura", Icon: Sparkles },
  { id: "HORROR", label: "Terror", Icon: Zap },
  { id: "STRATEGY", label: "Estratégia", Icon: Trophy },
  { id: "FIGHTING", label: "Luta", Icon: Swords },
];

const normalizeCategory = (v?: string) =>
  v?.toUpperCase().replace(/[^A-Z0-9]/g, "") ?? "";
const steamIdKey = (uid: string) => `checkpoint_steam_id_${uid}`;
const steamDiscKey = (uid: string) => `checkpoint_steam_disconnected_${uid}`;

// ─── Sidebar ─────────────────────────────────────────────────────────────────
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
  playSound,
}) => {
  const [showSteamMenu, setShowSteamMenu] = useState(false);

  return (
    <motion.aside
      initial={{ x: -80, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
      className="fixed left-0 top-0 bottom-0 z-50 flex flex-col"
      style={{ width: 72 }}
    >
      <div
        className="flex-1 flex flex-col items-center py-6 gap-1"
        style={{
          background: "rgba(6,6,10,0.78)",
          backdropFilter: "blur(40px)",
          borderRight: "1px solid rgba(255,255,255,0.055)",
        }}
      >
        {/* Logo */}
        <div className="mb-5 flex flex-col items-center">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{
              background: "rgba(255,255,255,0.92)",
              boxShadow: "0 4px 20px rgba(255,255,255,0.14)",
            }}
          >
            <Sparkles className="w-4 h-4 text-black" />
          </div>
        </div>

        <div
          className="w-8 h-px mb-3"
          style={{ background: "rgba(255,255,255,0.07)" }}
        />

        {/* Category nav */}
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
                {/* Tooltip */}
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
      </div>
    </motion.aside>
  );
};

// ─── Home ────────────────────────────────────────────────────────────────────
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
  const [steamApiKeyModalOpen, setSteamApiKeyModalOpen] = useState(false);
  const [steamApiKeyInput, setSteamApiKeyInput] = useState("");
  const [steamApiKeySaving, setSteamApiKeySaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [signOutModalOpen, setSignOutModalOpen] = useState(false);
  const [disconnectSteamModalOpen, setDisconnectSteamModalOpen] =
    useState(false);
  const [isExitingSession, setIsExitingSession] = useState(false);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    game: Game;
  } | null>(null);
  const [editingGame, setEditingGame] = useState<Game | null>(null);
  const [onboardingCompleted, setOnboardingCompleted] = useState(false);

  const lastWheelTime = useRef<number>(0);

  const { playSound } = useSoundEffects();
  const { notify } = useNotification();
  const { user, userProfile, signOutUser, refreshProfile } = useAuth();
  const userDisplay =
    userProfile?.displayName || user?.email?.split("@")[0] || "Jogador";
  const resolvedSteamId = useMemo(
    () => userProfile?.steamId || undefined,
    [userProfile?.steamId],
  );

  // ── Effects ──────────────────────────────────────────────────────────────
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
    const status = params.get("steamStatus"),
      id = params.get("steamId"),
      state = params.get("state");
    if (!status || !user?.uid) return;
    if (status === "ok" && id && state === user.uid) {
      localStorage.removeItem(steamDiscKey(user.uid));
      localStorage.setItem(steamIdKey(user.uid), id);
      setDoc(
        profileDocRef(user.uid),
        { steamId: id, updatedAt: new Date().toISOString() },
        { merge: true },
      )
        .catch(() =>
          notify(
            "Conta Steam autenticada, mas não foi possível salvar o vínculo.",
            "error",
          ),
        )
        .finally(() => refreshProfile());
    } else if (status !== "ok") {
      const labels: Record<string, string> = {
        invalid_state: "Estado inválido.",
        invalid: "Falha na validação OpenID.",
        missing_id: "Steam ID não retornado.",
        error: "Erro inesperado.",
      };
      notify(
        labels[status] ?? "Não foi possível conectar com a Steam.",
        "error",
      );
    }
    window.history.replaceState({}, document.title, window.location.pathname);
  }, [notify, refreshProfile, user?.uid]);

  // ── Derived ──────────────────────────────────────────────────────────────
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
    steamApiKeyModalOpen ||
    signOutModalOpen ||
    disconnectSteamModalOpen;

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

  // ── Handlers & Navigation ───────────────────────────────────────────────
  const openDetails = useCallback(
    (game: Game) => {
      setSelectedGame(game);
      setIsDetailOpen(true);
      setContextMenu(null);
      playSound("select");
    },
    [playSound],
  );
  useEffect(() => {
    if (isAnyModalOpen || displayGames.length === 0) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Allow input interactions
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
          playSound("select");
        }
      }
    };

    const handleWheel = (e: WheelEvent) => {
      const now = Date.now();
      // Scroll cooldown of 120ms to allow 1 tile change per small scroll flick
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
    let hasKey = false;
    try {
      hasKey = await isSteamApiKeyConfigured();
    } catch {
      notify("Não foi possível verificar a API key.", "error");
      return;
    }
    if (!hasKey) {
      if (
        !window.confirm(
          "A Steam Web API Key não está configurada. Abrir a página da Steam?",
        )
      )
        return;
      window.open(getSteamApiKeyPageUrl(), "_blank", "noopener,noreferrer");
      setSteamApiKeyInput("");
      setSteamApiKeyModalOpen(true);
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
          ? "Nenhum jogo retornado. Verifique se o perfil é público."
          : `${count} jogos importados/atualizados.`,
        count === 0 ? "info" : "success",
      );
      await refreshProfile();
    } catch (e) {
      notify(
        e instanceof Error ? e.message : "Falha na sincronização Steam.",
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
    isBackendHealthy().then((h) => {
      if (!h) {
        notify("Backend Steam offline.", "error");
        setSteamConnecting(false);
        return;
      }
      window.location.href = getSteamLinkUrl(user.uid);
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
    closeCtx();
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
      await updateDoc(profileDocRef(user.uid), {
        steamId: "",
        updatedAt: new Date().toISOString(),
      });
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

  const closeAddModal = (silent = false) => {
    if (!silent) playSound("back");
    setIsAddModalOpen(false);
    setEditingGame(null);
    setGames((p) => p);
  };

  const handleSaveSteamApiKey = async () => {
    const v = steamApiKeyInput.trim();
    if (!v) {
      notify("Informe a Steam Web API Key.", "error");
      return;
    }
    setSteamApiKeySaving(true);
    try {
      await saveSteamApiKey(v);
      setSteamApiKeyModalOpen(false);
      setSteamApiKeyInput("");
      notify("API key salva. Clique em Sync para sincronizar.", "success");
    } catch (e) {
      notify(
        e instanceof Error ? e.message : "Falha ao salvar a API key.",
        "error",
      );
    } finally {
      setSteamApiKeySaving(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
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

      {/* Sidebar */}
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
        playSound={playSound}
      />

      {/* ── Main canvas ───────────────────────────────────────────────────── */}
      <div
        className="flex-1 flex flex-col h-screen overflow-hidden"
        style={{ marginLeft: 72 }}
      >
        {/* Top bar */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          className="shrink-0 flex items-center justify-between px-10 pt-7 relative"
        >
          {/* Breadcrumb */}
          <div className="flex items-center gap-5">
            <div className="flex items-center gap-2">
              <span
                className="text-[9.5px] font-black uppercase tracking-[0.32em]"
                style={{ color: "rgba(255,255,255,0.18)" }}
              >
                Checkpoint
              </span>

              {/* Search next to Checkpoint */}
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
                          placeholder="Buscar jogo... (S)"
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
                  onClick={() => setSearchOpen((s) => !s)}
                  onMouseEnter={() => playSound("navigate")}
                  className="p-1 hover:bg-white/5 rounded-full transition-all group"
                >
                  <Search className="w-3.5 h-3.5 text-white/20 group-hover:text-white/50 transition-colors" />
                </button>
              </div>
            </div>

            <span style={{ color: "rgba(255,255,255,0.14)" }}>›</span>

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
                {CATEGORIES.find((c) => c.id === activeCategory)?.label}
              </motion.span>
            </AnimatePresence>
          </div>

          <div className="flex items-center gap-4">
            {/* Action Buttons Top Bar */}
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
                  Novo
                </span>
              </button>

              <div className="w-px h-4 bg-white/10" />

              {resolvedSteamId ? (
                <div className="flex items-center gap-1.5">
                  {/* Steam Status / Disconnect Toggle */}
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
                          Desvincular
                        </span>
                      </AnimatePresence>
                    </div>
                  </button>

                  <div className="w-px h-3 bg-white/5" />

                  {/* Sync Button */}
                  <button
                    onClick={handleSyncSteam}
                    disabled={steamSyncing}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl transition-all hover:bg-white/5 active:scale-95 disabled:opacity-50 group"
                  >
                    <RefreshCw
                      className={`w-3 h-3 text-white/30 group-hover:text-white/60 ${steamSyncing ? "animate-spin" : ""}`}
                    />
                    <span className="text-[10px] font-black uppercase tracking-wider text-white/30 group-hover:text-white/60">
                      {steamSyncing ? "Sync..." : "Sync"}
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
                    {steamConnecting ? "Conectando..." : "Conectar Steam"}
                  </span>
                </button>
              )}
            </div>

            {/* Profile / Logout with Username */}
            <div className="flex items-center gap-3 pl-2">
              <div className="flex flex-col items-end">
                <span className="text-[8px] font-black uppercase tracking-widest text-white/20 select-none">
                  Identidade
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

        {/* ── Content: flex-1, carousel + hero anchored to bottom ────── */}
        <div className="flex-1 flex flex-col justify-end min-h-0">
          {isLoading ? (
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
              {/* ── Hero info ── */}
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
                    {/* Title + meta */}
                    <div className="min-w-0 flex-1">
                      <p
                        className="text-[10px] font-black uppercase tracking-[0.28em] mb-2.5"
                        style={{ color: "rgba(255,255,255,0.25)" }}
                      >
                        {currentGame?.category ?? "Jogo"} · {canonicalIndex + 1}
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
                      {/* Metadata pills */}
                      <div className="flex items-center gap-4 mt-3.5 flex-wrap">
                        {currentGame?.launcherType === "steam" && (
                          <span
                            className="flex items-center gap-1.5 text-[11px] font-bold"
                            style={{ color: "rgba(103,182,118,0.82)" }}
                          >
                            <Zap className="w-3 h-3" /> Via Steam
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
                            <Star className="w-3 h-3 fill-current" /> Favorito
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Primary CTA */}
                    <button
                      onClick={() => currentGame && openDetails(currentGame)}
                      onMouseEnter={() => playSound("navigate")}
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
                        Jogar Agora
                      </span>
                    </button>
                  </motion.div>
                </AnimatePresence>
              </motion.div>

              {/* ── Carousel ── */}
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
                      playSound={playSound}
                    />
                  </motion.div>
                </AnimatePresence>
              </div>
            </>
          )}
        </div>

        {/* ── HUD footer ───────────────────────────────────────────────── */}
        <div
          className="fixed bottom-0 z-30 flex items-center justify-between px-8 py-3.5 pointer-events-none"
          style={{
            left: 72,
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
                node: <span className="text-[12px] font-bold">← →</span>,
              },
              { label: "Abrir", node: <MouseLeft className="w-3.5 h-3.5" /> },
              { label: "Opções", node: <MouseRight className="w-3.5 h-3.5" /> },
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

      {/* ── Overlays ─────────────────────────────────────────────────────── */}
      <GameDetailPanel
        game={selectedGame}
        isOpen={isDetailOpen}
        onClose={() => {
          playSound("back");
          setIsDetailOpen(false);
        }}
        playSound={playSound}
      />

      <ContextMenu
        x={contextMenu?.x ?? 0}
        y={contextMenu?.y ?? 0}
        isOpen={Boolean(contextMenu)}
        onClose={closeCtx}
        onAction={(a) => contextMenu && handleMenuAction(a, contextMenu.game)}
        isFavorite={contextMenu?.game.isFavorite}
        playSound={playSound}
      />

      <AddGameModal
        isOpen={isAddModalOpen}
        onClose={closeAddModal}
        onSaved={() => {}}
        playSound={playSound}
        gameToEdit={editingGame}
      />

      <ModalShell
        isOpen={steamApiKeyModalOpen}
        onClose={() => {
          playSound("back");
          setSteamApiKeyModalOpen(false);
        }}
        maxWidthClassName="max-w-xl"
        zIndexClassName="z-[160]"
      >
        <h3 className="text-xl font-bold text-white mb-2">Steam Web API Key</h3>
        <p className="text-sm mb-5" style={{ color: "rgba(255,255,255,0.5)" }}>
          Cole aqui a chave gerada na página da Steam para habilitar a
          sincronização.
        </p>
        <input
          type="text"
          value={steamApiKeyInput}
          onChange={(e) => setSteamApiKeyInput(e.target.value)}
          placeholder="Ex: 9A8B7C6D5E4F..."
          className="w-full h-11 rounded-xl px-4 text-sm text-white outline-none"
          style={{
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.12)",
          }}
          onFocus={(e) =>
            (e.currentTarget.style.borderColor = "rgba(103,182,118,0.5)")
          }
          onBlur={(e) =>
            (e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)")
          }
        />
        <div className="mt-5 flex justify-end gap-2">
          <GlassButton
            type="button"
            onClick={() => {
              playSound("back");
              setSteamApiKeyModalOpen(false);
            }}
            onMouseEnter={() => playSound("navigate")}
            variant="secondary"
          >
            Cancelar
          </GlassButton>
          <GlassButton
            type="button"
            onClick={handleSaveSteamApiKey}
            onMouseEnter={() => playSound("navigate")}
            disabled={steamApiKeySaving}
            variant="primary"
          >
            {steamApiKeySaving ? "Salvando..." : "Salvar API Key"}
          </GlassButton>
        </div>
      </ModalShell>

      <ConfirmationModal
        isOpen={signOutModalOpen}
        title="Encerrar Sessão"
        description="Você será desconectado e retornará à tela de entrada."
        confirmLabel="Sair Agora"
        onClose={() => setSignOutModalOpen(false)}
        onConfirm={async () => {
          setSignOutModalOpen(false);
          await handleSignOut();
        }}
        playSound={playSound}
      />

      <ConfirmationModal
        isOpen={disconnectSteamModalOpen}
        title="Desconectar Steam"
        description="Desvincular sua conta Steam removerá os jogos sincronizados da biblioteca."
        confirmLabel="Confirmar"
        onClose={() => setDisconnectSteamModalOpen(false)}
        onConfirm={async () => {
          setDisconnectSteamModalOpen(false);
          await handleDisconnectSteam();
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
              <div
                className="w-16 h-16 mx-auto mb-8 rounded-full flex items-center justify-center animate-pulse"
                style={{ background: "rgba(255,255,255,0.92)" }}
              >
                <Sparkles className="w-6 h-6 text-black" />
              </div>
              <h3 className="text-3xl font-black text-white tracking-tighter uppercase mb-4">
                Encerrando Sessão
              </h3>
              <p
                className="text-[10px] tracking-[0.4em] uppercase"
                style={{ color: "rgba(255,255,255,0.3)" }}
              >
                Até logo
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ─── Empty State ─────────────────────────────────────────────────────────────
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
          ? "Você não possui jogos salvos. Adicione um jogo manualmente."
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

// ─── Empty Library Onboarding ─────────────────────────────────────────────────
const EmptyLibraryOnboarding: React.FC<{
  onConnectSteam: () => void;
  onOpenAddGame: () => void;
  onComplete: () => void | Promise<void>;
  playSound: (type: "select" | "back" | "navigate") => void;
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
      nextButtonText="Próximo"
      onStepChange={() => playSound("navigate")}
      onFinalStepCompleted={() => {
        playSound("select");
        void onComplete();
      }}
      resetOnComplete
    >
      <Step>
        <h3 className="text-2xl font-black mb-2 text-white">
          Sua biblioteca está vazia
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
      Depois da primeira sincronização, seus jogos aparecem automaticamente.
    </p>
  </div>
);

// ─── Confirmation Modal ───────────────────────────────────────────────────────
const ConfirmationModal: React.FC<{
  isOpen: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
  playSound: (type: "select" | "back" | "navigate") => void;
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
    zIndexClassName="z-[170]"
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
        onMouseEnter={() => playSound("navigate")}
        variant="secondary"
      >
        Cancelar
      </GlassButton>
      <GlassButton
        type="button"
        onClick={() => {
          playSound("select");
          void onConfirm();
        }}
        onMouseEnter={() => playSound("navigate")}
        variant="primary"
      >
        {confirmLabel}
      </GlassButton>
    </div>
  </ModalShell>
);

export default Home;
