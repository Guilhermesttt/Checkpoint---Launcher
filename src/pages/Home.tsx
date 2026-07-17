import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  RefreshCw,
  Search,
  Star,
  Gamepad2,
  X,
  LogOut,
} from "lucide-react";

import {
  collection,
  getDocs,
  query,
  setDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "../../Firebase";
import DynamicBackground from "../components/DynamicBackground";
import GameRow from "../components/GameRow";
import LoadingSkeleton from "../components/LoadingSkeleton";
import { HomeOverviewPanels } from "../components/HomeOverviewPanels";
import {
  AddFriendModal,
  ChatModal,
  ConfirmationModal,
  EmptyLibraryOnboarding,
  EmptyState,
  FriendsPage,
  SettingsPageV2,
} from "../components/home/HomePanels";
import { useNotification } from "../components/NotificationCenter";
import ModalShell from "../components/ui/ModalShell";
import { useAuth } from "../auth/AuthProvider";
// Correção 1: Importando Game, UserProfile e SocialFriend no mesmo lugar
import type { ChatMessage, Game, SocialFriend, UserProfile } from "../types/domain";
import { useImagePreloader } from "../hooks/useImagePreloader";
import { useSoundEffects } from "../hooks/useSoundEffects";
import { useGameColor } from "../hooks/useGameColor";
import Sidebar, { CATEGORIES, SIDEBAR_CATEGORIES, SteamBrandIcon, DiscordBrandIcon, EpicBrandIcon } from '../components/Sidebar';
import { useGamepadFocusNavigation } from '../hooks/useGamepadFocusNavigation';
import { useGamePresence } from '../hooks/useGamePresence';
import { useAchievementLibrarySync } from '../hooks/useAchievementLibrarySync';
import { useAccountConnections } from '../hooks/useAccountConnections';
import { buildLocalFriendProfile, useFriendsSystem } from '../hooks/useFriendsSystem';
import { useGamepadNavigation } from "../hooks/useGamepadNavigation";
import {
  usePreferences,
  type LauncherLanguage,
  type SoundTheme,
  type VisualTheme,
} from "../context/PreferencesContext";
import { useGameLibraryView } from "../hooks/useGameLibraryView";
import {
  closeChatConnection,
  establishChatConnection,
  markMessagesAsRead,
  sendChatImage,
  sendChatMessage,
  setChatTyping,
  subscribeToChatMessages,
  subscribeToFriendTyping,
} from "../services/chat";
import {
  fetchSteamAchievementDetails,
  fetchSteamAchievementSchema,
  type SteamAchievement,
} from "../services/steam";

import {
  getCheckpointFriendProfile,
  updateCheckpointPresence,
} from "../services/checkpointFriends";
import {
  profileDocRef,
  userDocRef,
  userGameDocRef,
} from "../services/firestorePaths";
import {
  deleteLibraryGame,
  importFirestoreLibraryIntoLocal,
  listLibraryGames,
  syncPublicLibrarySummary,
  updateLibraryGame,
} from "../services/localLibrary";
import { useGamepadButton, useGamepad } from "../context/GamepadContext";
import { activateElementWithController } from "../utils/controllerTextInput";
import { calculateAchievementTotals } from "../utils/achievementTotals";
import { formatPlayedHours, getGamePlayedHours } from "../utils/playtime";
import InputHints from "../components/ui/InputHints";

const AddGameModal = React.lazy(() => import("../components/AddGameModal"));
const GameDetailPanel = React.lazy(() => import("../components/GameDetailPanel"));
const UserProfilePage = React.lazy(() => import("../components/UserProfilePage"));
const GamingRadarPage = React.lazy(() => import("../components/GamingRadarPage"));

const steamDiscKey = (uid: string) => `checkpoint_steam_disconnected_${uid}`;
const LANGUAGE_OPTIONS: Array<{ id: LauncherLanguage; label: string; hint: string }> = [
  { id: "pt-BR", label: "Português", hint: "Brasil" },
  { id: "en-US", label: "English", hint: "United States" },
  { id: "es-ES", label: "Español", hint: "España" },
];

const APP_THEME_OPTIONS: Array<{
  id: "default" | "playstation" | "gamecube" | "xbox360";
  label: string;
  hint: string;
  swatch: string;
  soundTheme: SoundTheme;
  visualTheme: VisualTheme;
}> = [
    {
      id: "default",
      label: "Padrao",
      hint: "Visual Checkpoint + sons PS5",
      swatch: "rgb(255 255 255)",
      soundTheme: "ps5",
      visualTheme: "checkpoint",
    },
    {
      id: "playstation",
      label: "PlayStation",
      hint: "Azul frio + sons PS2",
      swatch: "rgb(37 99 235)",
      soundTheme: "ps2",
      visualTheme: "playstation",
    },
    {
      id: "gamecube",
      label: "GameCube",
      hint: "Roxo Nintendo + sons GameCube",
      swatch: "rgb(124 58 237)",
      soundTheme: "gamecube",
      visualTheme: "gamecube",
    },
    {
      id: "xbox360",
      label: "Xbox 360",
      hint: "Verde Xbox + sons Metro UI",
      swatch: "rgb(132 204 22)",
      soundTheme: "xbox360",
      visualTheme: "xbox360",
    },
  ];


const Home: React.FC = () => {
  const [games, setGames] = useState<Game[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [activeCategory, setActiveCategory] = useState("ALL");
  const [isLoading, setIsLoading] = useState(true);
  const [localLibraryReady, setLocalLibraryReady] = useState(false);
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [signOutModalOpen, setSignOutModalOpen] = useState(false);
  const [disconnectSteamModalOpen, setDisconnectSteamModalOpen] =
    useState(false);
  const [disconnectDiscordModalOpen, setDisconnectDiscordModalOpen] =
    useState(false);
  const [isExitingSession, setIsExitingSession] = useState(false);

  const [friendProfileModal, setFriendProfileModal] = useState<{
    profile: UserProfile;
    games: Game[];
  } | null>(null);
  const [pendingFriendRemoval, setPendingFriendRemoval] = useState<SocialFriend | null>(null);
  const [pendingDeleteGame, setPendingDeleteGame] = useState<Game | null>(null);
  const [friendProfileLoadingId, setFriendProfileLoadingId] = useState<string | null>(null);
  const [localSocialStateLoaded, setLocalSocialStateLoaded] = useState(false);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    game: Game;
  } | null>(null);

  const { activeInputType } = useGamepad();

  const [editingGame, setEditingGame] = useState<Game | null>(null);
  const [onboardingCompleted, setOnboardingCompleted] = useState(false);
  const [isAddFriendModalOpen, setIsAddFriendModalOpen] = useState(false);

  const lastWheelTime = useRef<number>(0);
  const previousSteamIdRef = useRef<string | undefined>(undefined);
  const previousDiscordIdRef = useRef<string | undefined>(undefined);
  const didInitConnectionRefs = useRef(false);

  const { notify } = useNotification();
  const { user, userProfile, signOutUser, refreshProfile } = useAuth();
  const {
    language: launcherLanguage,
    effectsVolume,
    musicVolume,
    soundTheme,
    visualTheme,
    setLanguage: setLauncherLanguage,
    setEffectsVolume,
    setMusicVolume,
    setSoundTheme,
    setVisualTheme,
    t,
  } = usePreferences();
  const { playSound } = useSoundEffects(effectsVolume / 100, soundTheme);
  const userDisplay =
    userProfile?.displayName || user?.email?.split("@")[0] || "Jogador";
  const resolvedSteamId = useMemo(
    () => userProfile?.steamId || undefined,
    [userProfile?.steamId],
  );
  const resolvedDiscordId = useMemo(
    () => userProfile?.discordId || undefined,
    [userProfile?.discordId],
  );

  const refreshLibrary = useCallback(async () => {
    if (!user?.uid) {
      setGames([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      setGames(await listLibraryGames(user.uid));
    } finally {
      setIsLoading(false);
    }
  }, [user?.uid]);

  useAchievementLibrarySync(
    user?.uid,
    resolvedSteamId,
    games,
    !isLoading,
    refreshLibrary,
  );

  // Correção 2: Desestruturando as funções faltantes
  const {
    currentPresenceGame,
    currentPresenceExecutablePath,
    sessionStartedAt: overlaySessionStartedAt,
    presenceVerification,
    markCurrentPresence,
  } = useGamePresence({
    userUid: user?.uid,
    userProfile,
    games,
    onLibraryChanged: refreshLibrary,
  });

  const {
    steamConnecting,
    setSteamConnecting,
    discordConnecting,
    setDiscordConnecting,
    steamSyncing,
    connectSteam,
    connectDiscord,
    handleDisconnectSteam,
    handleDisconnectDiscord,
    handleSyncSteam,
  } = useAccountConnections({
    userUid: user?.uid,
    resolvedSteamId,
    playSound,
    notify,
    refreshProfile,
    setIsLoading,
    setSelectedIndex,
    onLibraryChanged: refreshLibrary,
  });

  const {
    socialFriends,
    unreadMessagesByFriend,
    incomingFriendRequests,
    activeChatFriend,
    setActiveChatFriend,
    removeFriend,
    handleAddCheckpointFriend,
    acceptFriendRequest,
    rejectFriendRequest,
  } = useFriendsSystem({
    user,
    userProfile,
    playSound,
    notify,
    refreshProfile,
    localSocialStateLoaded,
    setLocalSocialStateLoaded,
    setIsAddFriendModalOpen,
  });

  const [overlayAchievements, setOverlayAchievements] = useState<{
    loading: boolean;
    items: SteamAchievement[];
    unlocked: number;
    available: number;
  }>({ loading: false, items: [], unlocked: 0, available: 0 });
  const [overlayAchievementRevision, setOverlayAchievementRevision] = useState(0);
  const [overlayChatFriendId, setOverlayChatFriendId] = useState<string | null>(null);
  const [overlayChatMessages, setOverlayChatMessages] = useState<ChatMessage[]>([]);
  const [overlayChatTyping, setOverlayChatTyping] = useState(false);
  const [overlayChatSending, setOverlayChatSending] = useState(false);
  const [overlayChatError, setOverlayChatError] = useState<string | null>(null);

  const overlayCurrentGame = useMemo(() => {
    if (!currentPresenceGame) return null;
    const normalizedPresence = currentPresenceGame.trim().toLowerCase();
    return games.find((game) =>
      game.title.trim().toLowerCase() === normalizedPresence
      || game.title.toLowerCase().includes(normalizedPresence)
      || normalizedPresence.includes(game.title.toLowerCase()),
    ) || null;
  }, [currentPresenceGame, games]);

  const overlayChatFriend = useMemo(
    () => socialFriends.find((friend) => friend.id === overlayChatFriendId) || null,
    [overlayChatFriendId, socialFriends],
  );


  useEffect(() => {
    if (!didInitConnectionRefs.current) {
      previousSteamIdRef.current = resolvedSteamId;
      previousDiscordIdRef.current = resolvedDiscordId;
      didInitConnectionRefs.current = true;
      return;
    }

    if (!previousSteamIdRef.current && resolvedSteamId) {
      notify("Conta Steam conectada com sucesso.", "success");
      setSteamConnecting(false);
    }

    if (!previousDiscordIdRef.current && resolvedDiscordId) {
      notify("Conta Discord conectada com sucesso.", "success");
      setDiscordConnecting(false);
    }

    previousSteamIdRef.current = resolvedSteamId;
    previousDiscordIdRef.current = resolvedDiscordId;
  }, [notify, resolvedDiscordId, resolvedSteamId, setDiscordConnecting, setSteamConnecting]);

  // ── Auto-Updater Global Listener ──────────────────────────────────────────
  useEffect(() => {
    const api = window.electronAPI as typeof window.electronAPI & { onUpdateMessage?: (cb: (msg: string, data: { version?: string }) => void) => () => void };
    if (!api?.onUpdateMessage) return;

    const unsubscribe = api.onUpdateMessage((msg, data) => {
      if (msg === "update-available") {
        notify(`Nova atualização disponível (v${data?.version})! Vá nas Configurações para baixar.`, "success");
      } else if (msg === "update-downloaded") {
        notify("Nova versão baixada! Reinicie o aplicativo para aplicar as atualizações.", "success");
      }
    });

    return unsubscribe;
  }, [notify]);

  useEffect(() => {
    if (!user?.uid) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setGames([]);

      setIsLoading(false);
      setLocalLibraryReady(false);
      return;
    }

    if (!window.electronAPI?.importLegacyGames) {
      setLocalLibraryReady(true);
    }
    void refreshLibrary();
  }, [refreshLibrary, user?.uid]);

  useEffect(() => {
    if (
      !user?.uid
      || !userProfile?.gamesMigratedAt
      || !window.electronAPI?.importLegacyGames
    ) return;
    const migrateLocalLibrary = async () => {
      try {
        const result = await importFirestoreLibraryIntoLocal(user.uid);
        if (result.imported > 0) await refreshLibrary();
        setLocalLibraryReady(true);
      } catch (error) {
        console.error("Falha ao importar a biblioteca do Firestore para SQLite:", error);
      }
    };
    void migrateLocalLibrary();
  }, [refreshLibrary, user?.uid, userProfile?.gamesMigratedAt]);

  useEffect(() => {
    if (!user?.uid || isLoading || !localLibraryReady) return;
    const timer = window.setTimeout(() => {
      void syncPublicLibrarySummary(user.uid, userProfile).catch((error) => {
        console.error("Falha ao sincronizar resumo publico da biblioteca:", error);
      });
    }, 1_000);
    return () => window.clearTimeout(timer);
  }, [games, isLoading, localLibraryReady, user?.uid, userProfile]);

  useEffect(() => {
    if (!user?.uid) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOnboardingCompleted(false);
      return;
    }

    setOnboardingCompleted(
      localStorage.getItem(`checkpoint_onboarding_${user.uid}`) === "1" ||
      Boolean(userProfile?.onboardingCompletedAt),
    );
  }, [user?.uid, userProfile?.onboardingCompletedAt]);

  useEffect(() => {
    if (!user?.uid) {
      closeChatConnection();
      return;
    }
    void establishChatConnection();
    return () => closeChatConnection();
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid) return;

    const heartbeat = () => {
      updateCheckpointPresence(
        currentPresenceGame ? "playing" : "online",
        currentPresenceGame || undefined,
      ).catch(() => undefined);
    };

    heartbeat();
    const interval = window.setInterval(heartbeat, 45_000);
    return () => window.clearInterval(interval);
  }, [currentPresenceGame, user?.uid]);

  useEffect(() => {
    const handleGameLaunch = (event: Event) => {
      const detail = (event as CustomEvent<{
        title?: string;
        executablePath?: string | null;
      }>).detail;
      const title = detail?.title?.trim();
      if (!title) return;

      markCurrentPresence(title, detail?.executablePath || null);
      void window.electronAPI?.showGameStartOverlay({ gameTitle: title });
    };

    window.addEventListener("checkpoint:game-launch", handleGameLaunch);
    return () => window.removeEventListener("checkpoint:game-launch", handleGameLaunch);
  }, [markCurrentPresence]);

  useEffect(() => {
    if (!user?.uid) return;

    const markOffline = () => {
      void updateCheckpointPresence("offline").catch(() => undefined);
    };

    window.addEventListener("beforeunload", markOffline);
    return () => window.removeEventListener("beforeunload", markOffline);
  }, [user?.uid]);

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
    const discordStatus = params.get("discordStatus");
    if ((!steamStatus && !discordStatus) || !user?.uid) return;

    if (steamStatus === "ok") {
      localStorage.removeItem(steamDiscKey(user.uid));
      notify("Conta Steam conectada com sucesso.", "success");
      void refreshProfile();
    } else if (steamStatus) {
      const labels: Record<string, string> = {
        invalid_state: "Estado inválido.",
        invalid: "Falha na validação OpenID.",
        missing_id: "Steam ID não retornado.",
        server_not_configured: "Backend Firebase Admin não configurado.",
        error: "Erro inesperado.",
      };
      notify(
        labels[steamStatus] ?? "Não foi possível conectar com a Steam.",
        "error",
      );
    }

    if (discordStatus === "ok") {
      notify("Conta Discord conectada com sucesso.", "success");
      void refreshProfile();
    } else if (discordStatus) {
      const labels: Record<string, string> = {
        invalid_state: "Estado inválido.",
        denied: "Autorização do Discord cancelada.",
        missing_code: "Código de retorno do Discord não recebido.",
        missing_id: "Conta Discord não retornou identificador.",
        client_not_configured: "Credenciais do Discord não configuradas no backend.",
        server_not_configured: "Backend Firebase Admin não configurado.",
        token_error: "O Discord recusou a troca do código de autenticação.",
        error: "Erro inesperado.",
      };
      notify(
        labels[discordStatus] ?? "Não foi possível conectar com o Discord.",
        "error",
      );
    }

    window.history.replaceState({}, document.title, window.location.pathname);
  }, [notify, refreshProfile, user?.uid]);

  const {
    displayGames,
    continuePlayingGames,
    favoriteShowcaseGames,
    friendsPlayingNow,
    recentOverviewActivity,
  } = useGameLibraryView({
    games,
    activeCategory,
    searchTerm,
    socialFriends,
    t,
  });

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
    Boolean(activeChatFriend) ||
    Boolean(friendProfileModal) ||
    Boolean(pendingFriendRemoval) ||
    Boolean(pendingDeleteGame) ||
    isAddFriendModalOpen ||
    signOutModalOpen ||
    disconnectSteamModalOpen ||
    disconnectDiscordModalOpen;

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
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedIndex(0);
  }, [activeCategory]);

  useEffect(() => {
    if (displayGames.length === 0 && selectedIndex !== 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedIndex(0);
    } else if (displayGames.length > 0 && selectedIndex > displayGames.length - 1) {

      setSelectedIndex(displayGames.length - 1);
    }
  }, [displayGames.length, selectedIndex]);

  useEffect(() => {
    const cards = document.querySelectorAll<HTMLElement>("[data-game-card]");
    if (cards[selectedIndex]) {
      cards[selectedIndex].focus();
    }
  }, [selectedIndex]);

  const openDetails = useCallback(
    (game: Game) => {
      setSelectedGame(game);
      setIsDetailOpen(true);
      setContextMenu(null);
      playSound("detailOpen");
    },
    [playSound],
  );

  const isSystemCategory = ["FRIENDS", "FEED", "SETTINGS", "PROFILE", "DEALS"].includes(activeCategory);

  const { moveSystemFocus, adjustFocusedRange } = useGamepadFocusNavigation({
    playSound,
    activeCategory,
    isSystemCategory,
  });

  const closeTopGamepadSurface = useCallback(() => {
    if (activeChatFriend) {
      setActiveChatFriend(null);
      playSound("back");
      return;
    }
    if (friendProfileModal) {
      setFriendProfileModal(null);
      playSound("back");
      return;
    }
    if (pendingFriendRemoval) {
      setPendingFriendRemoval(null);
      playSound("back");
      return;
    }
    if (pendingDeleteGame) {
      setPendingDeleteGame(null);
      playSound("back");
      return;
    }
    if (signOutModalOpen) {
      setSignOutModalOpen(false);
      playSound("back");
      return;
    }
    if (disconnectSteamModalOpen) {
      setDisconnectSteamModalOpen(false);
      playSound("back");
      return;
    }
    if (disconnectDiscordModalOpen) {
      setDisconnectDiscordModalOpen(false);
      playSound("back");
      return;
    }
    if (isAddFriendModalOpen) {
      setIsAddFriendModalOpen(false);
      playSound("back");
      return;
    }
    if (contextMenu) {
      setContextMenu(null);
      playSound("back");
      return;
    }
    if (searchOpen) {
      setSearchOpen(false);
      setSearchTerm("");
      playSound("back");
    }
  }, [
    activeChatFriend,
    contextMenu,
    disconnectDiscordModalOpen,
    disconnectSteamModalOpen,
    friendProfileModal,
    isAddFriendModalOpen,
    pendingDeleteGame,
    pendingFriendRemoval,
    playSound,
    searchOpen,
    setActiveChatFriend,
    signOutModalOpen,
  ]);

  useGamepadNavigation({
    disableX: true,
    disableO: isAnyModalOpen,
    onClose: closeTopGamepadSurface,
  });

  useGamepadButton("X", () => {
    if (searchOpen) {
      const activeElement = document.activeElement;
      if (activeElement instanceof HTMLElement) activateElementWithController(activeElement);
      return;
    }
    if (isAnyModalOpen) return;
    if (isSystemCategory) {
      const activeElement = document.activeElement;
      if (activeElement instanceof HTMLElement) {
        activateElementWithController(activeElement);
        return;
      }
      moveSystemFocus("down");
      return;
    }

    const game = displayGames[selectedIndex];
    if (game) {
      openDetails(game);
    }
  });

  useGamepadButton("DPAD_LEFT", () => {
    if (isAnyModalOpen || searchOpen) return;
    if (isSystemCategory) {
      if (!adjustFocusedRange(-1)) moveSystemFocus("left");
      return;
    }
    if (displayGames.length === 0) return;

    setSelectedIndex((p) => {
      const prev = Math.max(p - 1, 0);
      if (prev !== p) playSound("navigate");
      return prev;
    });
  });

  useGamepadButton("DPAD_RIGHT", () => {
    if (isAnyModalOpen || searchOpen) return;
    if (isSystemCategory) {
      if (!adjustFocusedRange(1)) moveSystemFocus("right");
      return;
    }
    if (displayGames.length === 0) return;

    setSelectedIndex((p) => {
      const next = Math.min(p + 1, displayGames.length - 1);
      if (next !== p) playSound("navigate");
      return next;
    });
  });

  useGamepadButton("DPAD_UP", () => {
    if (isAnyModalOpen || searchOpen || !isSystemCategory) return;
    moveSystemFocus("up");
  });

  useGamepadButton("DPAD_DOWN", () => {
    if (isAnyModalOpen || searchOpen || !isSystemCategory) return;
    moveSystemFocus("down");
  });

  useGamepadButton("SQUARE", async () => {
    if (isAnyModalOpen || searchOpen || isSystemCategory) return;
    const game = displayGames[selectedIndex];
    if (game && user?.uid) {
      playSound(game.isFavorite ? "favoriteOff" : "favoriteOn");
      try {
        await updateLibraryGame(user.uid, game.id, {
          isFavorite: !game.isFavorite,
        });
        await refreshLibrary();
      } catch (err) {
        console.error("Error toggling favorite via gamepad", err);
      }
    }
  });

  useGamepadButton("L2", () => {
    if (isAnyModalOpen || searchOpen) return;
    const currentIndex = SIDEBAR_CATEGORIES.findIndex((c) => c.id === activeCategory);
    if (currentIndex > 0) {
      setActiveCategory(SIDEBAR_CATEGORIES[currentIndex - 1].id);
      playSound("navigate");
    }
  });

  useGamepadButton("R2", () => {
    if (isAnyModalOpen || searchOpen) return;
    const currentIndex = SIDEBAR_CATEGORIES.findIndex((c) => c.id === activeCategory);
    if (currentIndex < SIDEBAR_CATEGORIES.length - 1) {
      setActiveCategory(SIDEBAR_CATEGORIES[currentIndex + 1].id);
      playSound("navigate");
    }
  });

  useGamepadButton("TRIANGLE", () => {
    if (isAnyModalOpen || searchOpen || isSystemCategory) return;
    setIsAddModalOpen(true);
    playSound("select");
  });

  useGamepadButton("OPTIONS", () => {
    if (isAnyModalOpen || searchOpen) return;
    setActiveCategory("SETTINGS");
    playSound("select");
  });

  useGamepadButton("SHARE", () => {
    if (isAnyModalOpen || searchOpen) return;
    setActiveCategory("FRIENDS");
    playSound("select");
  });

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
  }, [isAnyModalOpen, displayGames, selectedIndex, openDetails, playSound, searchOpen]);

  // Correção 3: Construção do perfil local caso não seja amigo do Checkpoint
  const handleViewFriendProfile = async (friend: SocialFriend) => {
    if (!friend.id.startsWith("cp-friend:")) {
      setFriendProfileModal(buildLocalFriendProfile(friend));
      playSound("detailOpen");
      return;
    }

    const friendUid = friend.id.split(":")[1];
    setFriendProfileLoadingId(friend.id);
    try {
      const payload = await getCheckpointFriendProfile(friendUid);
      setFriendProfileModal(payload);
      playSound("detailOpen");
    } catch {
      setFriendProfileModal(buildLocalFriendProfile(friend));
      playSound("detailOpen");
    } finally {
      setFriendProfileLoadingId(null);
    }
  };

  const openFriendChatFromOverview = useCallback(
    (friendId: string) => {
      const friend = socialFriends.find((item) => item.id === friendId);
      if (!friend) return;
      setActiveCategory("FRIENDS");
      setActiveChatFriend(friend);
      playSound("select");
    },
    [playSound, setActiveChatFriend, socialFriends],
  );

  useEffect(() => {
    const api = window.electronAPI;
    if (!api?.onRealtimeAchievementUnlock) return;
    const handler = api.onRealtimeAchievementUnlock(() => {
      setOverlayAchievementRevision((current) => current + 1);
    });
    return () => api.removeRealtimeAchievementUnlock(handler);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadAchievements = async () => {
      const game = overlayCurrentGame;
      if (!game) {
        setOverlayAchievements({ loading: false, items: [], unlocked: 0, available: 0 });
        return;
      }

      setOverlayAchievements((current) => ({ ...current, loading: true }));
      const appId = String(game.steamAppId || "").trim();
      if (!appId) {
        setOverlayAchievements({
          loading: false,
          items: [],
          unlocked: game.completedAchievements || 0,
          available: game.totalAchievements || 0,
        });
        return;
      }

      try {
        const result = userProfile?.steamId && game.launcherType !== "local"
          ? await fetchSteamAchievementDetails(userProfile.steamId, appId)
          : await fetchSteamAchievementSchema(appId);
        let items = result.achievements;

        if (game.launcherType === "local" && window.electronAPI) {
          if (items.length === 0) {
            const cached = await window.electronAPI.getLocalAchievementDefinitions(game.id).catch(() => null);
            const cachedItems = Array.isArray(cached?.achievements) ? cached.achievements : [];
            items = cachedItems.map((raw) => {
              const achievement = raw as Record<string, unknown>;
              const id = String(achievement.id || achievement.apiName || "");
              return {
                apiName: id,
                achieved: false,
                unlockTime: 0,
                name: String(achievement.name || id),
                description: String(achievement.description || ""),
                icon: String(achievement.icon || ""),
                iconGray: String(achievement.iconGray || ""),
                hidden: Boolean(achievement.hidden),
              };
            }).filter((achievement) => achievement.apiName);
          }
          const [progress, localState] = await Promise.all([
            window.electronAPI.getLocalAchievementProgress(game.id).catch(() => null),
            window.electronAPI.getLocalAchievementState(appId).catch(() => (
              {} as Record<string, { earned: boolean; earnedTime: number }>
            )),
          ]);
          const progressById = new Map(
            Object.entries(progress?.unlockedAchievements || {}).map(([id, value]) => [id.toLowerCase(), value]),
          );
          items = items.map((achievement) => {
            const saved = progressById.get(achievement.apiName.toLowerCase());
            const retroactive = localState[achievement.apiName];
            if (!saved && !retroactive?.earned) return achievement;
            const unlockedAt = saved?.unlockedAt
              ? Math.floor(Date.parse(saved.unlockedAt) / 1000)
              : retroactive?.earnedTime || 0;
            return { ...achievement, achieved: true, unlockTime: unlockedAt };
          });
        }

        if (!cancelled) {
          setOverlayAchievements({
            loading: false,
            items,
            unlocked: items.filter((achievement) => achievement.achieved).length,
            available: items.length || game.totalAchievements || 0,
          });
        }
      } catch {
        if (!cancelled) {
          setOverlayAchievements({
            loading: false,
            items: [],
            unlocked: game.completedAchievements || 0,
            available: game.totalAchievements || 0,
          });
        }
      }
    };

    void loadAchievements();
    return () => { cancelled = true; };
  }, [overlayAchievementRevision, overlayCurrentGame, userProfile?.steamId]);

  const overlayChatFriendUid = overlayChatFriend?.id.startsWith("cp-friend:")
    ? overlayChatFriend.id.split(":")[1]
    : null;

  useEffect(() => {
    if (!overlayChatFriendUid) {
      return;
    }
    void markMessagesAsRead(overlayChatFriendUid);
    const unsubscribeMessages = subscribeToChatMessages(overlayChatFriendUid, setOverlayChatMessages);
    const unsubscribeTyping = subscribeToFriendTyping(overlayChatFriendUid, setOverlayChatTyping);
    return () => {
      unsubscribeMessages();
      unsubscribeTyping();
    };
  }, [overlayChatFriendUid]);

  useEffect(() => {
    if (!window.electronAPI?.updateOverlayPanel) return;
    void window.electronAPI.updateOverlayPanel({
      friends: socialFriends.map((friend) => ({
        id: friend.id,
        name: friend.name,
        status: friend.status,
        playing: friend.playing,
        avatar: friend.avatar,
        unread: friend.id.startsWith("cp-friend:")
          ? unreadMessagesByFriend[friend.id.split(":")[1]] || 0
          : 0,
        canChat: friend.id.startsWith("cp-friend:"),
      })),
      achievements: {
        unlocked: overlayAchievements.unlocked,
        available: overlayAchievements.available,
        loading: overlayAchievements.loading,
        items: overlayAchievements.items.map((achievement) => ({
          id: achievement.apiName,
          name: achievement.name,
          description: achievement.description,
          icon: achievement.icon || achievement.iconGray,
          achieved: achievement.achieved,
          unlockedAt: achievement.unlockTime > 0
            ? new Date(achievement.unlockTime * 1000).toISOString()
            : "",
        })),
      },
      currentGame: overlayCurrentGame ? {
        id: overlayCurrentGame.id,
        title: overlayCurrentGame.title,
        image: overlayCurrentGame.backgroundImage || overlayCurrentGame.cardImage || overlayCurrentGame.image,
        platform: overlayCurrentGame.launcherType === "steam"
          ? "Steam"
          : overlayCurrentGame.launcherType === "epic" ? "Epic Games" : "Jogo local",
        category: overlayCurrentGame.category || "",
        developer: overlayCurrentGame.developer || "",
        releaseDate: overlayCurrentGame.releaseDate || "",
        executableName: String(overlayCurrentGame.executablePath || "").split(/[\\/]/).pop() || "",
        totalPlaytimeMinutes: overlayCurrentGame.steamPlaytimeMinutes
          ?? Math.round(Math.max(0, Number(overlayCurrentGame.hoursPlayed || 0)) * 60),
        sessionStartedAt: overlaySessionStartedAt || "",
        windowMode: overlayCurrentGame.launchProfile?.windowMode || "default",
        resolution: overlayCurrentGame.launchProfile?.resolutionWidth && overlayCurrentGame.launchProfile?.resolutionHeight
          ? `${overlayCurrentGame.launchProfile.resolutionWidth} × ${overlayCurrentGame.launchProfile.resolutionHeight}`
          : "Automática",
        monitoring: presenceVerification === "process" || presenceVerification === "steam"
          ? "verified"
          : "unverified",
      } : null,
      chat: overlayChatFriend && overlayChatFriendUid ? {
        friendId: overlayChatFriend.id,
        friendName: overlayChatFriend.name,
        friendAvatar: overlayChatFriend.avatar,
        typing: overlayChatTyping,
        sending: overlayChatSending,
        error: overlayChatError || "",
        messages: overlayChatMessages.map((message) => ({
          id: message.id || `${message.senderId}:${message.createdAt}`,
          text: message.text,
          attachmentUrl: message.attachmentUrl,
          attachmentName: message.attachmentName,
          createdAt: message.createdAt,
          mine: message.senderId === user?.uid || message.senderId === "me",
          pending: String(message.id || "").startsWith("overlay-pending-"),
        })),
      } : null,
      profile: {
        name: userProfile?.displayName || userProfile?.steamUsername || userDisplay,
        avatar: userProfile?.discordAvatar || userProfile?.photoURL || userProfile?.steamAvatar || "",
        discordConnected: Boolean(userProfile?.discordId),
        discordUsername: userProfile?.discordUsername || "",
        achievements: calculateAchievementTotals(games).unlocked,
      },
    }).catch(() => undefined);
  }, [
    overlayAchievements,
    overlayChatError,
    overlayChatFriend,
    overlayChatFriendUid,
    overlayChatMessages,
    overlayChatSending,
    overlayChatTyping,
    overlayCurrentGame,
    overlaySessionStartedAt,
    currentPresenceExecutablePath,
    presenceVerification,
    games,
    socialFriends,
    unreadMessagesByFriend,
    user?.uid,
    userDisplay,
    userProfile?.displayName,
    userProfile?.discordAvatar,
    userProfile?.discordId,
    userProfile?.discordUsername,
    userProfile?.photoURL,
    userProfile?.steamAvatar,
    userProfile?.steamUsername,
  ]);

  useEffect(() => {
    if (!window.electronAPI?.onOverlayPanelAction) return;
    return window.electronAPI.onOverlayPanelAction((action) => {
      if (action.kind === "select-chat") {
        const friend = socialFriends.find((candidate) => candidate.id === action.friendId);
        if (friend?.id.startsWith("cp-friend:")) {
          setOverlayChatMessages([]);
          setOverlayChatTyping(false);
          setOverlayChatError(null);
          setOverlayChatFriendId(friend.id);
        }
        return;
      }
      if (action.kind === "close-chat") {
        if (overlayChatFriendUid) void setChatTyping(overlayChatFriendUid, false);
        setOverlayChatMessages([]);
        setOverlayChatTyping(false);
        setOverlayChatError(null);
        setOverlayChatFriendId(null);
        return;
      }
      if (action.kind === "set-typing") {
        if (overlayChatFriendUid) void setChatTyping(overlayChatFriendUid, action.typing);
        return;
      }
      if (action.kind === "send-image") {
        if (!overlayChatFriendUid || overlayChatSending) return;
        const bytes = action.data instanceof Uint8Array
          ? action.data
          : new Uint8Array(action.data);
        const imageBuffer = new ArrayBuffer(bytes.byteLength);
        new Uint8Array(imageBuffer).set(bytes);
        const file = new File([imageBuffer], action.name, { type: action.type });
        setOverlayChatSending(true);
        setOverlayChatError(null);
        void sendChatImage(overlayChatFriendUid, file).then((message) => {
          setOverlayChatMessages((current) => current.some((item) => item.id === message.id)
            ? current
            : [...current, message].sort(
              (a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt),
            ));
        }).catch((error) => {
          setOverlayChatError(error instanceof Error ? error.message : "Nao foi possivel enviar a imagem.");
        }).finally(() => setOverlayChatSending(false));
        return;
      }
      if (action.kind !== "send-message" || !overlayChatFriendUid || overlayChatSending) return;
      const text = action.text.trim();
      if (!text) return;
      const pendingId = `overlay-pending-${Date.now()}`;
      setOverlayChatSending(true);
      setOverlayChatError(null);
      void setChatTyping(overlayChatFriendUid, false);
      setOverlayChatMessages((current) => [...current, {
        id: pendingId,
        chatId: overlayChatFriendUid,
        senderId: user?.uid || "me",
        receiverId: overlayChatFriendUid,
        text,
        createdAt: new Date().toISOString(),
        read: true,
      }]);
      void sendChatMessage(overlayChatFriendUid, text).then((message) => {
        setOverlayChatMessages((current) => [
          ...current.filter((item) => item.id !== pendingId && item.id !== message.id),
          message,
        ].sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt)));
      }).catch((error) => {
        setOverlayChatMessages((current) => current.filter((item) => item.id !== pendingId));
        setOverlayChatError(error instanceof Error ? error.message : "Não foi possível enviar a mensagem.");
      }).finally(() => setOverlayChatSending(false));
    });
  }, [overlayChatFriendUid, overlayChatSending, socialFriends, user?.uid]);

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

  const openAddGameModal = useCallback((gameToEdit?: Game | null) => {
    playSound("showModal");
    setEditingGame(gameToEdit ?? null);
    setIsAddModalOpen(true);
  }, [playSound]);

  const closeCtx = (silent = false) => {
    setContextMenu(null);
    if (!silent) playSound("back");
  };

  const handleMenuAction = async (action: string, game: Game) => {
    if (action === "delete") {
      setPendingDeleteGame(game);
      closeCtx(true);
      return;
    } else if (action === "favorite" && user?.uid) {
      await updateLibraryGame(user.uid, game.id, {
        isFavorite: !game.isFavorite,
      });
      await refreshLibrary();
    } else if (action === "edit") {
      openAddGameModal(game);
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

  const closeAddModal = (silent = false) => {
    if (!silent) playSound("back");
    setIsAddModalOpen(false);
    setEditingGame(null);
    setGames((p) => p);
  };

  // Correção 4: Adição das listas de IDs calculadas para o AddFriendModal
  const checkpointFriendIds = useMemo(() => {
    return socialFriends
      .filter((f) => f.id.startsWith("cp-friend:"))
      .map((f) => f.id.split(":")[1]);
  }, [socialFriends]);

  const incomingFriendRequestIds = useMemo(() => {
    return incomingFriendRequests.map((req) => req.uid);
  }, [incomingFriendRequests]);

  const outgoingFriendRequestIds = useMemo(() => {
    return (userProfile?.checkpointFriendRequestsOutgoing ?? []).map(
      (request) => request.uid,
    );
  }, [userProfile?.checkpointFriendRequestsOutgoing]);

  return (
    <div
      className="relative flex h-full min-h-0 w-full overflow-hidden overscroll-none text-white no-scrollbar transition-colors duration-1000"
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

      {/* Hero Section Gradient */}
      <div
        className="pointer-events-none absolute inset-0 z-0 bg-gradient-to-t from-[#050507] via-[#050507]/70 to-transparent"
        style={{ left: 96 }}
      />

      {/* Widgets flutuantes (Pulso, Amigos) com animação sincronizada ao jogo */}
      {activeCategory === "ALL" && !isLoading && (
        <AnimatePresence mode="wait">
          <motion.div
            key={`widgets-${currentGame?.id}`}
            initial={{ opacity: 0, filter: "blur(8px)" }}
            animate={{ opacity: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0, filter: "blur(4px)" }}
            transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
          >
            <HomeOverviewPanels
              continuePlaying={continuePlayingGames}
              favoriteGames={favoriteShowcaseGames}
              friendsPlaying={friendsPlayingNow}
              recentActivity={recentOverviewActivity}
              onOpenGame={openDetails}
              onOpenFriends={() => setActiveCategory("FRIENDS")}
              onOpenFriendChat={openFriendChatFromOverview}
              t={t}
            />
          </motion.div>
        </AnimatePresence>
      )}


      <Sidebar
        activeCategory={activeCategory}
        onCategory={setActiveCategory}
        settingsLabel={t("settings")}
        playSound={playSound}
        notificationCount={
          incomingFriendRequests.length
          + Object.values(unreadMessagesByFriend).reduce(
            (total, count) => total + Math.max(0, Number(count) || 0),
            0,
          )
        }
      />

      <div
        className="relative z-10 flex min-h-0 flex-1 flex-col overflow-hidden"
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
                  openAddGameModal();
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
              visualTheme={visualTheme}
              languageOptions={LANGUAGE_OPTIONS}
              appThemeOptions={APP_THEME_OPTIONS}
              SteamIcon={SteamBrandIcon}
              DiscordIcon={DiscordBrandIcon}
              EpicIcon={EpicBrandIcon}
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
              onVisualThemeChange={(next) => {
                setVisualTheme(next);
                playSound("select");
              }}
              onPreviewSound={() => playSound("select")}
              t={t}
              steamConnected={Boolean(resolvedSteamId)}
              discordConnected={Boolean(resolvedDiscordId)}
              discordUsername={userProfile?.discordUsername}
              discordAvatar={userProfile?.discordAvatar}
              steamConnecting={steamConnecting}
              discordConnecting={discordConnecting}
              steamSyncing={steamSyncing}
              onConnectSteam={connectSteam}
              onConnectDiscord={connectDiscord}
              onDisconnectSteam={() => {
                playSound("back");
                setDisconnectSteamModalOpen(true);
              }}
              onDisconnectDiscord={() => {
                playSound("back");
                setDisconnectDiscordModalOpen(true);
              }}
              onSyncSteam={handleSyncSteam}
              onTestOverlayWelcome={() => {
                playSound("select");
                void window.electronAPI?.testOverlayWelcome();
              }}
              onTestOverlayAchievement={() => {
                playSound("select");
                void window.electronAPI?.testOverlayAchievement();
              }}
            />
          ) : activeCategory === "FRIENDS" ? (
            <FriendsPage
              t={t}
              discordConnected={Boolean(resolvedDiscordId)}
              userDisplay={userDisplay}
              discordUsername={userProfile?.discordUsername}
              discordAvatar={userProfile?.discordAvatar}
              DiscordIcon={DiscordBrandIcon}
              friends={socialFriends}
              unreadMessagesByFriend={unreadMessagesByFriend}
              incomingRequests={incomingFriendRequests}
              currentPresenceGame={currentPresenceGame}
              onConnectDiscord={connectDiscord}
              onRemoveFriend={(friend) => {
                playSound("back");
                setPendingFriendRemoval(friend);
              }}
              onViewFriendProfile={handleViewFriendProfile}
              friendProfileLoadingId={friendProfileLoadingId}
              onAcceptRequest={acceptFriendRequest}
              onRejectRequest={rejectFriendRequest}
              onAddFriendClick={() => {
                playSound("select");
                setIsAddFriendModalOpen(true);
              }}
              onOpenChat={(friend) => {
                playSound("select");
                setActiveChatFriend(friend);
              }}
            />
          ) : activeCategory === "FEED" ? (
            <React.Suspense fallback={
              <div className="flex flex-1 items-center justify-center text-white/40">Carregando Radar Gamer...</div>
            }>
              <GamingRadarPage />
            </React.Suspense>
          ) : activeCategory === "PROFILE" ? (
            <React.Suspense fallback={
              <div className="flex items-center justify-center flex-1">
                <div className="text-white/40">Carregando perfil...</div>
              </div>
            }>
              <UserProfilePage
                userProfile={userProfile}
                user={user}
                games={games}
                onOpenGame={openDetails}
                onProfileUpdated={refreshProfile}
              />
            </React.Suspense>
          ) : isLoading ? (
            <div className="flex-1 flex items-center justify-center">
              <LoadingSkeleton />
            </div>
          ) : displayGames.length === 0 ? (
            <div className="flex-1 flex items-center justify-center px-10">
              {onboardingCompleted ? (
                <EmptyState
                  searchTerm={searchTerm}
                  onAddGame={() => openAddGameModal()}
                  onConnect={connectSteam}
                  steamConnected={Boolean(resolvedSteamId)}
                />
              ) : (
                <EmptyLibraryOnboarding
                  onConnectSteam={connectSteam}
                  onOpenAddGame={() => openAddGameModal()}
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
                className="px-10 pb-4 shrink-0"
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
                        className="mb-2 text-[10px] font-black uppercase tracking-[0.28em]"
                        style={{ color: "rgba(255,255,255,0.25)" }}
                      >
                        {currentGame?.category ?? "Jogo"} · {canonicalIndex + 1}
                        /{displayGames.length}
                      </p>
                      <h1
                        className="tracking-wide font-black uppercase text-6xl text-white leading-none"
                        style={{
                          textShadow: "0 8px 48px rgba(0,0,0,0.85)",
                          maxWidth: "75vw",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {currentGame?.title}
                      </h1>
                      <div className="mt-2.5 flex items-center gap-4 flex-wrap">
                        {currentGame?.launcherType === "steam" && (
                          <span
                            className="flex items-center gap-1.5 text-[11px] font-bold"
                            style={{ color: "rgba(103,182,118,0.82)" }}
                          >
                            <SteamBrandIcon className="w-3 h-3" /> {t("viaSteam")}
                          </span>
                        )}
                        {currentGame?.hoursPlayed != null && (
                          <span
                            className="text-[11px] font-semibold"
                            style={{ color: "rgba(255,255,255,0.3)" }}
                          >
                            {formatPlayedHours(getGamePlayedHours(currentGame))}h jogadas
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
                      className="relative shrink-0 flex items-center gap-3 overflow-hidden rounded-full px-7 py-3 font-black text-[12px] tracking-wider uppercase transition-all duration-500 group"
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
                      onContextMenu={handleMenuAction}
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
          <InputHints hints={activeInputType === "gamepad" ? [
            { button: "DPAD", label: "Navegar" },
            { button: "X", label: "Abrir" },
            { button: "TRIANGLE", label: "Novo Jogo" },
            { button: "L2_R2", label: "Categorias" },
            { button: "SHARE", label: "Amigos" },
            { button: "OPTIONS", label: "Ajustes" }
          ] : [
            { button: "DPAD", label: "Navegar" },
            { button: "X", label: "Abrir" },
            { button: "CONTEXT", label: "Opções" }
          ]} />
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
          onLibraryChanged={refreshLibrary}
          onGameHydrated={setSelectedGame}
        />
      </React.Suspense>

      <React.Suspense fallback={null}>
        <AddGameModal
          isOpen={isAddModalOpen}
          onClose={closeAddModal}
          onSaved={() => void refreshLibrary()}
          playSound={playSound}
          gameToEdit={editingGame}
        />
      </React.Suspense>

      <AddFriendModal
        isOpen={isAddFriendModalOpen}
        onClose={() => setIsAddFriendModalOpen(false)}
        onAddFriend={handleAddCheckpointFriend}
        currentUserUid={user?.uid ?? ""}
        friendIds={new Set(checkpointFriendIds)}
        outgoingRequestIds={new Set(outgoingFriendRequestIds)}
        incomingRequestIds={new Set(incomingFriendRequestIds)}
        playSound={playSound}
        t={t}
      />

      <ModalShell
        isOpen={Boolean(friendProfileModal)}
        onClose={() => {
          playSound("back");
          setFriendProfileModal(null);
        }}
        maxWidthClassName="max-w-6xl"
        zIndexClassName="z-[165]"
        className="relative max-h-[90vh] overflow-hidden rounded-[32px] border border-white/10 bg-[#050507] p-0 shadow-2xl"
      >
        <button
          type="button"
          onClick={() => {
            playSound("back");
            setFriendProfileModal(null);
          }}
          className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-black/60 text-white/60 hover:bg-white/10 hover:text-white"
        >
          <X className="h-5 w-5" />
        </button>
        {friendProfileModal && (
          <React.Suspense fallback={<div className="p-10 text-white/40">Carregando perfil...</div>}>
            <UserProfilePage
              userProfile={friendProfileModal.profile}
              user={{ email: null, photoURL: friendProfileModal.profile.photoURL }}
              games={friendProfileModal.games}
              editable={false}
            />
          </React.Suspense>
        )}
      </ModalShell>

      <ConfirmationModal
        isOpen={Boolean(pendingDeleteGame)}
        title="Remover jogo"
        description={
          pendingDeleteGame
            ? `Tem certeza que deseja remover "${pendingDeleteGame.title}" da sua biblioteca?`
            : ""
        }
        confirmLabel="Remover"
        onClose={() => setPendingDeleteGame(null)}
        onConfirm={async () => {
          if (!pendingDeleteGame || !user?.uid) {
            setPendingDeleteGame(null);
            return;
          }
          try {
            await deleteLibraryGame(user.uid, pendingDeleteGame.id);
            await refreshLibrary();
            notify("Jogo removido da biblioteca.", "success");
          } catch (e) {
            notify(e instanceof Error ? e.message : "Erro ao remover jogo.", "error");
          } finally {
            setPendingDeleteGame(null);
          }
        }}
        playSound={playSound}
      />

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
        isOpen={disconnectDiscordModalOpen}
        title={t("disconnectDiscordTitle")}
        description={t("disconnectDiscordDescription")}
        confirmLabel={t("confirm")}
        onClose={() => setDisconnectDiscordModalOpen(false)}
        onConfirm={async () => {
          setDisconnectDiscordModalOpen(false);
          await handleDisconnectDiscord();
        }}
        playSound={playSound}
      />

      <ConfirmationModal
        isOpen={pendingFriendRemoval !== null}
        title="Desfazer amizade"
        description={
          pendingFriendRemoval
            ? `Voce quer remover ${pendingFriendRemoval.name} da sua lista de amigos?`
            : ""
        }
        confirmLabel="Remover"
        onClose={() => setPendingFriendRemoval(null)}
        onConfirm={async () => {
          const friend = pendingFriendRemoval;
          setPendingFriendRemoval(null);
          if (!friend) return;
          await removeFriend(friend);
        }}
        playSound={playSound}
      />

      <ChatModal
        isOpen={activeChatFriend !== null}
        onClose={() => setActiveChatFriend(null)}
        friend={activeChatFriend}
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

export default Home;
