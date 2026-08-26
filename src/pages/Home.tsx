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
} from "lucide-react";

import DynamicBackground from "../components/DynamicBackground";
import GameRow from "../components/GameRow";
import LoadingSkeleton from "../components/LoadingSkeleton";
import LoadingState from "../components/ui/loading-state";
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
import { ProfileDropdown } from "../components/ui/ProfileDropdown";
import { ShinyButton } from "../components/ui/shiny-button";
import { InteractiveBreadcrumb } from "../components/home/InteractiveBreadcrumb";
import { useAuth } from "../auth/AuthProvider";
import { supabase } from "../services/supabase";
// Correção 1: Importando Game, UserProfile e SocialFriend no mesmo lugar
import type { ChatMessage, Game, SocialFriend, UserProfile } from "../types/domain";
import { useImagePreloader } from "../hooks/useImagePreloader";
import { useSoundEffects } from "../hooks/useSoundEffects";
import { useGameColor } from "../hooks/useGameColor";
import Sidebar, {
  CATEGORIES,
  SteamBrandIcon,
  DiscordBrandIcon,
  EpicBrandIcon,
  EaBrandIcon,
  UbisoftBrandIcon,
  GogBrandIcon,
  XboxBrandIcon,
  RiotBrandIcon,
  BattlenetBrandIcon,
  RockstarBrandIcon,
} from '../components/Sidebar';
import { useGamepadFocusNavigation } from '../hooks/useGamepadFocusNavigation';
import { useGamePresence } from '../hooks/useGamePresence';
import { useAchievementLibrarySync } from '../hooks/useAchievementLibrarySync';
import { useAccountConnections } from '../hooks/useAccountConnections';
import { buildLocalFriendProfile, useFriendsSystem } from '../hooks/useFriendsSystem';
import { useVoiceCallContext } from '../context/VoiceCallContext';
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
  getAdjacentSidebarCategory,
  readLastNavigation,
  writeLastCategory,
  writeLastSettingsTab,
  consumeSettingsConnectionsRequest,
  type SettingsTab,
} from "../services/launcherNavigation";

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
import {
  disconnectRetroAchievements,
  linkRetroAchievements,
} from "../services/retroAchievements";
import InputHints from "../components/ui/InputHints";
import { resolveLibraryLoadingState, shouldShowLibraryFooter } from "../utils/libraryLoading";

const AddGameModal = React.lazy(() => import("../components/AddGameModal"));
const GameDetailPanel = React.lazy(() => import("../components/GameDetailPanel"));
const UserProfilePage = React.lazy(() => import("../components/UserProfilePage"));
const GamingRadarPage = React.lazy(() => import("../components/GamingRadarPage"));
const ModsPage = React.lazy(() => import("./ModsPage"));

const steamDiscKey = (uid: string) => `checkpoint_steam_disconnected_${uid}`;
const LANGUAGE_OPTIONS: Array<{ id: LauncherLanguage; label: string; hint: string }> = [
  { id: "pt-BR", label: "Português", hint: "Brasil" },
  { id: "en-US", label: "English", hint: "United States" },
  { id: "es-ES", label: "Español", hint: "España" },
  { id: "fr-FR", label: "Français", hint: "France" },
  { id: "de-DE", label: "Deutsch", hint: "Deutschland" },
  { id: "it-IT", label: "Italiano", hint: "Italia" },
];

const APP_THEME_OPTIONS: Array<{
  id: "default" | "ps5" | "playstation" | "ps4" | "psp" | "gamecube" | "xbox360" | "cyberpunk";
  label: string;
  hint: string;
  swatch: string;
  soundTheme: SoundTheme;
  visualTheme: VisualTheme;
}> = [
    {
      id: "default",
      label: "Phelierium Default",
      hint: "Estética Espaço Preto & Branco + sons originais Phelierium",
      swatch: "rgb(255 255 255)",
      soundTheme: "default",
      visualTheme: "phelierium",
    },
    {
      id: "ps5",
      label: "PlayStation 5",
      hint: "Branco e azul PlayStation + sons PS5",
      swatch: "rgb(0 114 206)",
      soundTheme: "ps5",
      visualTheme: "ps5",
    },
    {
      id: "ps4",
      label: "PlayStation 4",
      hint: "Azul cobalto + sons PS4",
      swatch: "rgb(0 112 209)",
      soundTheme: "ps4",
      visualTheme: "ps4",
    },
    {
      id: "psp",
      label: "PSP",
      hint: "Cyan Waves + sons PSP",
      swatch: "rgb(6 182 212)",
      soundTheme: "psp",
      visualTheme: "psp",
    },
    {
      id: "playstation",
      label: "PlayStation 2",
      hint: "Azul clássico + sons PS2",
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
      id: "cyberpunk",
      label: "Cyberpunk 2077",
      hint: "Amarelo Neon + sons Cyberpunk 2077",
      swatch: "rgb(255 238 0)",
      soundTheme: "cyberpunk",
      visualTheme: "cyberpunk",
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
  const loadedLibraryOwnerRef = useRef<string | null>(null);
  const [localLibraryReady, setLocalLibraryReady] = useState(false);
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [signOutModalOpen, setSignOutModalOpen] = useState(false);
  const [disconnectSteamModalOpen, setDisconnectSteamModalOpen] =
    useState(false);
  const [disconnectDiscordModalOpen, setDisconnectDiscordModalOpen] =
    useState(false);
  const [isExitingSession, setIsExitingSession] = useState(false);
  const [exitConfirmationOpen, setExitConfirmationOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<SettingsTab>("general");
  const [retroAchievementsConnecting, setRetroAchievementsConnecting] = useState(false);
  const [retroAchievementsError, setRetroAchievementsError] = useState<string>();

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
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [onboardingCompleted, setOnboardingCompleted] = useState(false);
  const [isAddFriendModalOpen, setIsAddFriendModalOpen] = useState(false);
  const [isSidebarExpanded, setIsSidebarExpanded] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem("checkpoint_sidebar_expanded");
      return stored !== null ? stored === "true" : true;
    } catch {
      return true;
    }
  });

  useEffect(() => {
    const handleToggle = (e: CustomEvent<{ expanded: boolean }>) => {
      setIsSidebarExpanded(e.detail.expanded);
    };
    window.addEventListener("checkpoint:sidebar-toggle" as any, handleToggle);
    return () => {
      window.removeEventListener("checkpoint:sidebar-toggle" as any, handleToggle);
    };
  }, []);

  const lastWheelTime = useRef<number>(0);
  const previousSteamIdRef = useRef<string | undefined>(undefined);
  const previousDiscordIdRef = useRef<string | undefined>(undefined);
  const didInitConnectionRefs = useRef(false);
  const lastOverlayWelcomeGameRef = useRef<string | null>(null);

  const { notify } = useNotification();
  const { user, userProfile, signOutUser, refreshProfile } = useAuth();
  const {
    language: launcherLanguage,
    effectsVolume,
    achievementVolume,
    notificationVolume,
    musicVolume,
    soundTheme,
    visualTheme,
    setLanguage: setLauncherLanguage,
    setEffectsVolume,
    setAchievementVolume,
    setNotificationVolume,
    setMusicVolume,
    setSoundTheme,
    setVisualTheme,
    minimizeToTrayOnClose,
    restoreLastScreen,
    confirmBeforeExit,
    preferencesHydrated,
    t,
  } = usePreferences();

  const restoredNavigationUidRef = useRef<string | null>(null);
  const currentUserUid = user?.uid;

  const selectCategory = useCallback((category: string) => {
    setActiveCategory(category);
    if (currentUserUid) writeLastCategory(currentUserUid, category);
  }, [currentUserUid]);

  const handleSettingsTabChange = useCallback((tab: SettingsTab) => {
    setSettingsTab(tab);
    if (currentUserUid) writeLastSettingsTab(currentUserUid, tab);
  }, [currentUserUid]);

  useEffect(() => {
    if (!currentUserUid || !preferencesHydrated || restoredNavigationUidRef.current === currentUserUid) return;
    restoredNavigationUidRef.current = currentUserUid;
    const lastNavigation = readLastNavigation(currentUserUid);
    const openConnections = consumeSettingsConnectionsRequest(currentUserUid);
    const timer = window.setTimeout(() => {
      setSettingsTab(lastNavigation.settingsTab);
      if (openConnections || restoreLastScreen) setActiveCategory(lastNavigation.category);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [currentUserUid, preferencesHydrated, restoreLastScreen]);

  useEffect(() => {
    if (!preferencesHydrated) return;
    void window.electronAPI?.setWindowBehavior?.({
      minimizeToTray: minimizeToTrayOnClose,
      confirmBeforeExit,
    }).catch(console.error);
  }, [confirmBeforeExit, minimizeToTrayOnClose, preferencesHydrated]);

  useEffect(() => window.electronAPI?.onExitConfirmationRequested?.(() => {
    setExitConfirmationOpen(true);
  }), []);
  const { playSound } = useSoundEffects(
    effectsVolume / 100,
    soundTheme,
    notificationVolume / 100,
  );
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
      loadedLibraryOwnerRef.current = null;
      return;
    }
    const loadingState = resolveLibraryLoadingState(
      loadedLibraryOwnerRef.current === user.uid,
    );
    if (loadingState.showSkeleton) setIsLoading(true);
    try {
      setGames(await listLibraryGames(user.uid));
      loadedLibraryOwnerRef.current = user.uid;
    } finally {
      if (loadingState.showSkeleton) setIsLoading(false);
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
    setSelectedIndex,
    onLibraryChanged: refreshLibrary,
    language: launcherLanguage,
  });

  const connectRetroAchievements = useCallback(async (username: string) => {
    setRetroAchievementsConnecting(true);
    setRetroAchievementsError(undefined);
    try {
      const identity = await linkRetroAchievements(username);
      await refreshProfile();
      playSound("select");
      notify(`RetroAchievements conectada como ${identity.username}.`, "success");
    } catch (reason) {
      const message = reason instanceof Error
        ? reason.message
        : "Não foi possível conectar a RetroAchievements.";
      setRetroAchievementsError(message);
      notify(message, "error");
    } finally {
      setRetroAchievementsConnecting(false);
    }
  }, [notify, playSound, refreshProfile]);

  const disconnectRetroAchievementsAccount = useCallback(async () => {
    setRetroAchievementsConnecting(true);
    setRetroAchievementsError(undefined);
    try {
      await disconnectRetroAchievements();
      await refreshProfile();
      playSound("back");
      notify("RetroAchievements desconectada.", "success");
    } catch (reason) {
      const message = reason instanceof Error
        ? reason.message
        : "Não foi possível desconectar a RetroAchievements.";
      setRetroAchievementsError(message);
      notify(message, "error");
    } finally {
      setRetroAchievementsConnecting(false);
    }
  }, [notify, playSound, refreshProfile]);

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

  const voiceCallContext = useVoiceCallContext();
  const { startCall, startTestCall } = voiceCallContext;

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
    const api = window.electronAPI;
    if (!api?.onUpdateMessage) return;

    const showUpdateNotification = (status: string, data?: { version?: string } | string) => {
      const version = typeof data === "object" ? data?.version : undefined;
      if (status === "update-available") {
        notify(
          `Nova atualização pendente${version ? ` (v${version})` : ""}. Abra as Configurações para baixar e atualizar.`,
          "success",
          { id: "checkpoint-app-update", title: "Atualização do Phelierium", duration: Infinity },
        );
      } else if (status === "update-downloaded") {
        notify(
          `A versão${version ? ` v${version}` : " nova"} está pronta. Vá em Configurações para reiniciar e atualizar.`,
          "success",
          { id: "checkpoint-app-update", title: "Atualização pronta", duration: Infinity },
        );
      }
    };

    void api.getUpdateState?.().then((state) => {
      if (state.status === "available" || state.status === "downloading") {
        showUpdateNotification("update-available", state.info || undefined);
      } else if (state.status === "downloaded") {
        showUpdateNotification("update-downloaded", state.info || undefined);
      }
    }).catch(() => undefined);

    const unsubscribe = api.onUpdateMessage((msg, data) => {
      if (msg === "update-available") {
        showUpdateNotification(msg, data);
      } else if (msg === "update-downloaded") {
        showUpdateNotification(msg, data);
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

    if (!window.electronAPI?.importLegacyGames || !userProfile?.gamesMigratedAt) {
      setLocalLibraryReady(true);
    }
    void refreshLibrary();
  }, [refreshLibrary, user?.uid, userProfile?.gamesMigratedAt]);

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
    return () => {
      closeChatConnection();
    };
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid) return;

    const heartbeat = () => {
      updateCheckpointPresence(
        currentPresenceGame ? "playing" : "online",
        currentPresenceGame || undefined,
        userProfile?.displayName || undefined,
        userProfile?.photoURL,
      ).catch(() => undefined);
    };

    heartbeat();
    const interval = window.setInterval(heartbeat, 45_000);
    return () => window.clearInterval(interval);
  }, [currentPresenceGame, user?.uid, userProfile?.displayName, userProfile?.photoURL]);

  useEffect(() => {
    const handleGameLaunch = (event: Event) => {
      const detail = (event as CustomEvent<{
        title?: string;
        executablePath?: string | null;
      }>).detail;
      const title = detail?.title?.trim();
      if (!title) return;

      playSound("play");
      lastOverlayWelcomeGameRef.current = title;
      markCurrentPresence(title, detail?.executablePath || null);
      void window.electronAPI?.showGameStartOverlay({ gameTitle: title });
    };

    window.addEventListener("checkpoint:game-launch", handleGameLaunch);
    return () => window.removeEventListener("checkpoint:game-launch", handleGameLaunch);
  }, [markCurrentPresence, playSound]);

  useEffect(() => {
    if (!currentPresenceGame) {
      lastOverlayWelcomeGameRef.current = null;
      return;
    }
    if (lastOverlayWelcomeGameRef.current === currentPresenceGame) return;
    lastOverlayWelcomeGameRef.current = currentPresenceGame;
    void window.electronAPI?.showGameStartOverlay({
      gameTitle: currentPresenceGame,
    });
  }, [currentPresenceGame]);

  useEffect(() => {
    if (!user?.uid) return;

    const markOffline = () => {
      void updateCheckpointPresence("offline").catch(() => undefined);
    };

    window.addEventListener("beforeunload", markOffline);
    return () => window.removeEventListener("beforeunload", markOffline);
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid) return;

    if (!didInitConnectionRefs.current) {
      previousSteamIdRef.current = resolvedSteamId;
      previousDiscordIdRef.current = resolvedDiscordId;
      didInitConnectionRefs.current = true;
      return;
    }

    if (!previousSteamIdRef.current && resolvedSteamId) {
      previousSteamIdRef.current = resolvedSteamId;
      notify("Conta Steam vinculada com sucesso!", "success");
      playSound("select");
      void handleSyncSteam();
    } else {
      previousSteamIdRef.current = resolvedSteamId;
    }

    if (!previousDiscordIdRef.current && resolvedDiscordId) {
      previousDiscordIdRef.current = resolvedDiscordId;
      notify("Conta Discord vinculada com sucesso!", "success");
      playSound("select");
    } else {
      previousDiscordIdRef.current = resolvedDiscordId;
    }
  }, [resolvedSteamId, resolvedDiscordId, user?.uid, notify, playSound, handleSyncSteam]);

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
        server_not_configured: "Backend Supabase Admin não configurado.",
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
        server_not_configured: "Backend Supabase Admin não configurado.",
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

  useEffect(() => {
    const unsubscribe = window.electronAPI?.onAccountAuthCallback?.((payload) => {
      if (payload.steamStatus) {
        setSteamConnecting(false);
        if (payload.steamStatus === "ok") {
          void refreshProfile();
        } else {
          notify(`Não foi possível conectar com a Steam (${payload.steamStatus}).`, "error");
        }
      }

      if (payload.discordStatus) {
        setDiscordConnecting(false);
        if (payload.discordStatus === "ok") {
          void refreshProfile();
        } else {
          notify(`Não foi possível conectar com o Discord (${payload.discordStatus}).`, "error");
        }
      }
    });

    return () => unsubscribe?.();
  }, [
    notify,
    refreshProfile,
    setDiscordConnecting,
    setSteamConnecting,
  ]);

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
    exitConfirmationOpen ||
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

  const isSystemCategory = ["FRIENDS", "FEED", "MODS", "SETTINGS", "PROFILE", "DEALS"].includes(activeCategory);

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
    if (exitConfirmationOpen) {
      setExitConfirmationOpen(false);
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
    exitConfirmationOpen,
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
    const previousCategory = getAdjacentSidebarCategory(activeCategory, -1);
    if (previousCategory) {
      selectCategory(previousCategory);
      playSound("navigate");
    }
  });

  useGamepadButton("R2", () => {
    if (isAnyModalOpen || searchOpen) return;
    const nextCategory = getAdjacentSidebarCategory(activeCategory, 1);
    if (nextCategory) {
      selectCategory(nextCategory);
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
    selectCategory("SETTINGS");
    playSound("select");
  });

  useGamepadButton("SHARE", () => {
    if (isAnyModalOpen || searchOpen) return;
    selectCategory("FRIENDS");
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
        if (searchTerm || document.activeElement === searchInputRef.current) {
          setSearchTerm("");
          searchInputRef.current?.blur();
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
        if (!isAnyModalOpen && !["SETTINGS", "FRIENDS", "MODS", "RADAR", "PROFILE"].includes(activeCategory)) {
          e.preventDefault();
          searchInputRef.current?.focus();
          searchInputRef.current?.select();
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

  const handleViewSearchedProfile = async (profile: UserProfile) => {
    setFriendProfileLoadingId(`cp-profile:${profile.uid}`);
    try {
      const payload = await getCheckpointFriendProfile(profile.uid);
      setFriendProfileModal(payload);
      playSound("detailOpen");
    } catch (error) {
      notify(
        error instanceof Error ? error.message : "Não foi possível abrir este perfil.",
        "error",
      );
    } finally {
      setFriendProfileLoadingId(null);
    }
  };

  const openFriendChatFromOverview = useCallback(
    (friendId: string) => {
      const friend = socialFriends.find((item) => item.id === friendId);
      if (!friend) return;
      selectCategory("FRIENDS");
      setActiveChatFriend(friend);
      playSound("select");
    },
    [playSound, selectCategory, setActiveChatFriend, socialFriends],
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
      // Prefer steamAppId quando disponível, senão para jogos locais use game.id como identificador para leitura retroativa.
      const appIdFromSteam = String(game.steamAppId || "").trim();
      const appIdForLocalReads = game.launcherType === "local" ? String(game.id || "").trim() : appIdFromSteam;
      const appIdToQuery = appIdForLocalReads || appIdFromSteam;

      if (!appIdToQuery && game.launcherType !== "local") {
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
          ? await fetchSteamAchievementDetails(userProfile.steamId, appIdFromSteam)
          : appIdFromSteam
            ? await fetchSteamAchievementSchema(appIdFromSteam)
            : { achievements: [] };
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
            // progress is keyed by game.id (renderer already used game.id)
            window.electronAPI.getLocalAchievementProgress(game.id).catch(() => null),
            // localState: read retroactive saves — pass a useful app id: steam id or game.id for local builds
            window.electronAPI.getLocalAchievementState(appIdToQuery).catch(() => (
              {} as Record<string, { earned: boolean; earnedTime: number }>
            )),
          ]);
          const savedAchievements: Record<string, { unlockedAt: string }> =
            progress?.unlockedAchievements ?? {};
          const progressById = new Map(
            Object.entries(savedAchievements).map(([id, value]) => [
              id.toLowerCase(),
              value,
            ]),
          );
          items = items.map((achievement) => {
            const saved = progressById.get(achievement.apiName.toLowerCase());
            const retroactive = localState[achievement.apiName] || localState[achievement.apiName.toLowerCase()];
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
      language: launcherLanguage,
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
    launcherLanguage,
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
      if (action.kind === "open-launcher-chat" || action.kind === "open-launcher-friends") {
        selectCategory("FRIENDS");
        setIsDetailOpen(false);
        if (action.kind === "open-launcher-chat" && action.friendId) {
          const friend = socialFriends.find((candidate) => candidate.id === action.friendId);
          if (friend?.id.startsWith("cp-friend:")) {
            setActiveChatFriend(friend);
          }
        }
        return;
      }
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
      if (action.kind === "voice-call") {
        const found = socialFriends.find((candidate) => candidate.id === action.friendId || candidate.id === `cp-friend:${action.friendId}`);
        const friendUid = action.friendUid || (action.friendId?.startsWith("cp-friend:") ? action.friendId.replace("cp-friend:", "") : action.friendId) || "";
        const targetFriend: SocialFriend = found || {
          id: `cp-friend:${friendUid}`,
          name: action.friendName || "Amigo",
          avatar: action.friendAvatar,
          status: "online",
          source: "checkpoint",
        };
        if (targetFriend.id && voiceCallContext) {
          void voiceCallContext.startCall(targetFriend);
        }
        return;
      }
      if (action.kind === "voice-accept") {
        if (voiceCallContext) {
          void voiceCallContext.answerCall();
        }
        return;
      }
      if (action.kind === "voice-reject") {
        if (voiceCallContext) {
          void voiceCallContext.rejectCall();
        }
        return;
      }
      if (action.kind === "voice-hangup") {
        if (voiceCallContext) {
          void voiceCallContext.hangUp();
        }
        return;
      }
      if (action.kind === "voice-mute") {
        voiceCallContext?.toggleMute();
        return;
      }
      if (action.kind === "voice-deafen") {
        voiceCallContext?.toggleDeafen();
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
  }, [notify, overlayChatFriendUid, overlayChatSending, selectCategory, setActiveChatFriend, socialFriends, user?.uid, voiceCallContext]);

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
        className="pointer-events-none absolute inset-0 z-0 bg-linear-to-t from-background via-background/70 to-transparent"
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
              onOpenFriends={() => selectCategory("FRIENDS")}
              onOpenFriendChat={openFriendChatFromOverview}
              t={t}
            />
          </motion.div>
        </AnimatePresence>
      )}


      <Sidebar
        activeCategory={activeCategory}
        onCategory={selectCategory}
        settingsLabel={t("settings")}
        language={launcherLanguage}
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
        className="relative z-10 flex min-h-0 flex-1 flex-col overflow-hidden transition-[margin-left] duration-300 ease-out"
        style={{ marginLeft: isSidebarExpanded ? 272 : 96 }}
      >
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          className="shrink-0 flex items-center justify-between px-10 pt-7 relative"
        >
          <div className="flex items-center gap-6">
            <InteractiveBreadcrumb
              activeCategory={activeCategory}
              categoryLabel={
                activeCategory === "SETTINGS"
                  ? t("settings")
                  : CATEGORIES.find((c) => c.id === activeCategory)?.label
              }
              onSelectCategory={selectCategory}
              playSound={playSound}
            />

            {/* Clean Pill Search Bar - Only in Menu & Platform views */}
            {!["SETTINGS", "FRIENDS", "MODS", "RADAR", "PROFILE"].includes(activeCategory) && (
              <div className="relative flex items-center">
                <div className="relative flex items-center">
                  <Search className="w-3.5 h-3.5 text-white/40 absolute left-3 pointer-events-none" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder={t("searchPlaceholder") || "Pesquisar jogo... (S)"}
                    className="h-9 w-44 md:w-56 rounded-full bg-white/[0.04] hover:bg-white/[0.07] focus:bg-white/[0.09] border border-white/[0.08] focus:border-white/20 pl-9 pr-8 text-xs text-white placeholder:text-white/30 outline-none transition-all duration-200"
                  />
                  {searchTerm && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSearchTerm("");
                        searchInputRef.current?.focus();
                        playSound("back");
                      }}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 hover:bg-white/10 rounded-full transition-all"
                    >
                      <X className="w-3 h-3 text-white/40 hover:text-white" />
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1 p-1 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
              <button
                onClick={() => {
                  openAddGameModal();
                }}
                onMouseEnter={() => playSound("hover")}
                className="cursor-pointer flex items-center gap-2 px-4 py-2 rounded-xl transition-all duration-200 hover:scale-105 hover:bg-white/10 active:scale-95 group"
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
                    onMouseEnter={() => playSound("hover")}
                    className="cursor-pointer relative flex items-center gap-2 px-3 py-2 rounded-xl transition-all duration-200 hover:scale-105 hover:bg-white/[0.06] active:scale-95 group/steam"
                  >
                    <div className="w-2 h-2 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.75)] group-hover/steam:bg-white/40 transition-all" />
                    <div className="relative h-3 overflow-hidden min-w-[40px]">
                      <span className="block group-hover/steam:hidden text-[10px] font-medium tracking-wider text-white/70">
                        Steam
                      </span>
                      <span className="hidden group-hover/steam:block text-[10px] font-medium tracking-wider text-white/40 whitespace-nowrap">
                        {t("unlink")}
                      </span>
                    </div>
                  </button>

                  <div className="w-px h-3 bg-white/10" />

                  <button
                    onClick={handleSyncSteam}
                    onMouseEnter={() => playSound("hover")}
                    disabled={steamSyncing}
                    className="cursor-pointer flex items-center gap-2 px-3 py-2 rounded-xl transition-all duration-200 hover:scale-105 hover:bg-white/[0.06] active:scale-95 disabled:opacity-50 group"
                  >
                    <RefreshCw
                      className={`w-3 h-3 text-white/40 group-hover:text-white/80 ${steamSyncing ? "animate-spin" : ""}`}
                    />
                    <span className="text-[10px] font-medium tracking-wider text-white/40 group-hover:text-white/80">
                      {steamSyncing ? t("syncing") : t("sync")}
                    </span>
                  </button>
                </div>
              ) : (
                <button
                  onClick={connectSteam}
                  onMouseEnter={() => playSound("hover")}
                  disabled={steamConnecting}
                  className="cursor-pointer flex items-center gap-2 px-4 py-2 rounded-xl transition-all duration-200 hover:scale-105 hover:bg-white/[0.08] active:scale-95 group"
                >
                  <div className="w-2 h-2 rounded-full bg-white/25" />
                  <span className="text-[10px] font-medium tracking-wider text-white/45 group-hover:text-white transition-colors">
                    {steamConnecting ? t("connecting") : t("connectSteam")}
                  </span>
                </button>
              )}
            </div>

            <ProfileDropdown
              userDisplay={userDisplay}
              email={user?.email || undefined}
              avatarUrl={userProfile?.photoURL || user?.photoURL || userProfile?.discordAvatar || userProfile?.steamAvatar || undefined}
              language={launcherLanguage}
              playSound={playSound}
              onOpenProfile={() => {
                selectCategory("PROFILE");
                playSound("select");
              }}
              onOpenSettings={() => {
                selectCategory("SETTINGS");
                playSound("select");
              }}
              onLogout={() => {
                playSound("back");
                setSignOutModalOpen(true);
              }}
            />
          </div>
        </motion.div>

        <div className="flex-1 flex flex-col justify-end min-h-0">
          {activeCategory === "SETTINGS" ? (
            <SettingsPageV2
              language={launcherLanguage}
              effectsVolume={effectsVolume}
              achievementVolume={achievementVolume}
              notificationVolume={notificationVolume}
              musicVolume={musicVolume}
              soundTheme={soundTheme}
              visualTheme={visualTheme}
              languageOptions={LANGUAGE_OPTIONS}
              appThemeOptions={APP_THEME_OPTIONS}
              SteamIcon={SteamBrandIcon}
              DiscordIcon={DiscordBrandIcon}
              EpicIcon={EpicBrandIcon}
              onLanguageChange={(next: any) => {
                setLauncherLanguage(next);
                playSound("select");
              }}
              onEffectsVolumeChange={(next: number) => {
                setEffectsVolume(next);
              }}
              onAchievementVolumeChange={setAchievementVolume}
              onNotificationVolumeChange={setNotificationVolume}
              onMusicVolumeChange={setMusicVolume}
              onSoundThemeChange={(next: any) => {
                setSoundTheme(next);
                playSound("select");
              }}
              onVisualThemeChange={(next: any) => {
                setVisualTheme(next);
                playSound("select");
              }}
              onPreviewSound={() => playSound("select")}
              onTestNotificationSound={() => playSound("notification")}
              t={t}
              steamConnected={Boolean(resolvedSteamId)}
              discordConnected={Boolean(resolvedDiscordId)}
              discordUsername={userProfile?.discordUsername}
              discordAvatar={userProfile?.discordAvatar}
              steamConnecting={steamConnecting}
              discordConnecting={discordConnecting}
              retroAchievementsConnected={Boolean(userProfile?.retroAchievementsUlid)}
              retroAchievementsUsername={userProfile?.retroAchievementsUsername}
              retroAchievementsConnecting={retroAchievementsConnecting}
              retroAchievementsError={retroAchievementsError}
              onConnectSteam={connectSteam}
              onConnectDiscord={connectDiscord}
              onConnectRetroAchievements={connectRetroAchievements}
              onDisconnectSteam={() => {
                playSound("back");
                setDisconnectSteamModalOpen(true);
              }}
              onDisconnectDiscord={() => {
                playSound("back");
                setDisconnectDiscordModalOpen(true);
              }}
              onDisconnectRetroAchievements={disconnectRetroAchievementsAccount}
              onTestOverlayWelcome={() => {
                playSound("select");
                void window.electronAPI?.testOverlayWelcome();
              }}
              onTestOverlayAchievement={() => {
                playSound("select");
                void window.electronAPI?.testOverlayAchievement();
              }}
              initialTab={settingsTab}
              onTabChange={handleSettingsTabChange}
            />
          ) : activeCategory === "FRIENDS" ? (
            <FriendsPage
              t={t}
              language={launcherLanguage}
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
              onStartVoiceCall={(friend, withVideo) => void startCall(friend, withVideo)}
              onStartTestCall={startTestCall}
              playSound={playSound}
            />
          ) : activeCategory === "FEED" ? (
            <React.Suspense fallback={
              <div className="flex flex-1 items-center justify-center">
                <LoadingState label="Carregando Radar Gamer" variant="Drive" />
              </div>
            }>
              <GamingRadarPage />
            </React.Suspense>
          ) : activeCategory === "MODS" ? (
            <React.Suspense fallback={
              <div className="flex flex-1 items-center justify-center">
                <LoadingState label="Carregando Gerenciador de Mods" variant="Drive" />
              </div>
            }>
              <ModsPage uid={user?.uid || "local"} games={games} />
            </React.Suspense>
          ) : activeCategory === "PROFILE" ? (
            <React.Suspense fallback={
              <div className="flex flex-1 items-center justify-center">
                <LoadingState label="Carregando Perfil" variant="Drive" />
              </div>
            }>
              <UserProfilePage
                userProfile={userProfile}
                user={user}
                games={games}
                onOpenGame={openDetails}
                onProfileUpdated={refreshProfile}
                playSound={playSound as any}
                language={launcherLanguage}
              />
            </React.Suspense>
          ) : isLoading ? (
            <div className="flex-1 flex flex-col justify-between w-full h-full">
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
                    await supabase.from("profiles").update({
                      onboarding_completed_at: new Date().toISOString(),
                    }).eq("uid", user.uid);
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
                        className="mb-1 text-[11px] font-body font-medium tracking-wider text-white/40 uppercase"
                      >
                        {currentGame?.category ?? "Jogo"} · {canonicalIndex + 1} de {displayGames.length}
                      </p>
                      <h1
                        className="tracking-tight font-display font-semibold text-3xl md:text-5xl text-white leading-tight drop-shadow-[0_4px_24px_rgba(0,0,0,0.75)] line-clamp-1"
                        style={{
                          maxWidth: "70vw",
                        }}
                      >
                        {currentGame?.title}
                      </h1>
                      <div className="mt-3 flex items-center gap-2.5 flex-wrap font-body">
                        {(currentGame?.launcherType === "steam" || currentGame?.source === "steam") ? (
                          <span className="flex items-center gap-1.5 rounded-full bg-[#16171c]/90 border border-white/[0.12] px-3 py-1 text-xs font-semibold text-white/90 shadow-sm backdrop-blur-md">
                            <SteamBrandIcon className="w-3.5 h-3.5 text-white" /> Steam
                          </span>
                        ) : (currentGame?.launcherType === "epic" || currentGame?.source === "epic") ? (
                          <span className="flex items-center gap-1.5 rounded-full bg-[#16171c]/90 border border-white/[0.12] px-3 py-1 text-xs font-semibold text-white/90 shadow-sm backdrop-blur-md">
                            <EpicBrandIcon className="w-3.5 h-3.5 text-white" /> Epic Games
                          </span>
                        ) : currentGame?.launcherType === "ea" ? (
                          <span className="flex items-center gap-1.5 rounded-full bg-[#16171c]/90 border border-white/[0.12] px-3 py-1 text-xs font-semibold text-white/90 shadow-sm backdrop-blur-md">
                            <EaBrandIcon className="w-3.5 h-3.5 text-white" /> EA App
                          </span>
                        ) : currentGame?.launcherType === "ubisoft" ? (
                          <span className="flex items-center gap-1.5 rounded-full bg-[#16171c]/90 border border-white/[0.12] px-3 py-1 text-xs font-semibold text-white/90 shadow-sm backdrop-blur-md">
                            <UbisoftBrandIcon className="w-3.5 h-3.5 text-white" /> Ubisoft
                          </span>
                        ) : currentGame?.launcherType === "gog" ? (
                          <span className="flex items-center gap-1.5 rounded-full bg-[#16171c]/90 border border-white/[0.12] px-3 py-1 text-xs font-semibold text-white/90 shadow-sm backdrop-blur-md">
                            <GogBrandIcon className="w-3.5 h-3.5 text-white" /> GOG
                          </span>
                        ) : currentGame?.launcherType === "xbox" ? (
                          <span className="flex items-center gap-1.5 rounded-full bg-[#16171c]/90 border border-white/[0.12] px-3 py-1 text-xs font-semibold text-white/90 shadow-sm backdrop-blur-md">
                            <XboxBrandIcon className="w-3.5 h-3.5 text-white" /> Xbox
                          </span>
                        ) : currentGame?.launcherType === "riot" ? (
                          <span className="flex items-center gap-1.5 rounded-full bg-[#16171c]/90 border border-white/[0.12] px-3 py-1 text-xs font-semibold text-white/90 shadow-sm backdrop-blur-md">
                            <RiotBrandIcon className="w-3.5 h-3.5 text-white" /> Riot Games
                          </span>
                        ) : currentGame?.launcherType === "battlenet" ? (
                          <span className="flex items-center gap-1.5 rounded-full bg-[#16171c]/90 border border-white/[0.12] px-3 py-1 text-xs font-semibold text-white/90 shadow-sm backdrop-blur-md">
                            <BattlenetBrandIcon className="w-3.5 h-3.5 text-white" /> Battle.net
                          </span>
                        ) : currentGame?.launcherType === "rockstar" ? (
                          <span className="flex items-center gap-1.5 rounded-full bg-[#16171c]/90 border border-white/[0.12] px-3 py-1 text-xs font-semibold text-white/90 shadow-sm backdrop-blur-md">
                            <RockstarBrandIcon className="w-3.5 h-3.5 text-white" /> Rockstar
                          </span>
                        ) : (
                          <span className="flex items-center gap-1.5 rounded-full bg-[#16171c]/90 border border-white/[0.12] px-3 py-1 text-xs font-semibold text-white/90 shadow-sm backdrop-blur-md">
                            <Gamepad2 className="w-3.5 h-3.5 text-white" /> Executável Local
                          </span>
                        )}

                        {currentGame && (
                          <span className="rounded-full bg-[#16171c]/70 border border-white/[0.08] px-3 py-1 text-xs font-medium text-white/50">
                            {formatPlayedHours(getGamePlayedHours(currentGame))}h jogadas
                          </span>
                        )}

                        {currentGame?.isFavorite && (
                          <span className="flex items-center gap-1.5 rounded-full bg-[#16171c]/90 border border-white/[0.15] px-3 py-1 text-xs font-semibold text-white/90 shadow-sm">
                            <Star className="w-3 h-3 fill-white text-white" /> Favorito
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <ShinyButton
                        onClick={() => currentGame && openDetails(currentGame)}
                        onMouseEnter={() => playSound("hover")}
                        className="relative shrink-0 flex items-center gap-2.5 h-12 px-7 rounded-full bg-white text-black font-body font-semibold text-xs tracking-wider"
                      >
                        <svg
                          viewBox="0 0 24 24"
                          className="w-4 h-4 fill-white text-white shrink-0 transition-transform duration-300 group-hover:scale-110"
                        >
                          <path d="M8 5v14l11-7z" />
                        </svg>
                        <span>{t("playNow")}</span>
                      </ShinyButton>
                    </div>
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

        {shouldShowLibraryFooter(activeCategory) && <div
          className="fixed bottom-0 z-30 flex items-center justify-between px-8 py-3.5 pointer-events-none transition-[left] duration-300 ease-out"
          style={{
            left: isSidebarExpanded ? 272 : 96,
            right: 0,
            background:
              "linear-gradient(to top, var(--background) 0%, transparent 100%)",
          }}
        >
          <p
            className="text-[9px] font-semibold uppercase tracking-[0.28em] font-body"
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
        </div>}
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
          onOpenMods={() => {
            setIsDetailOpen(false);
            selectCategory("MODS");
          }}
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
        onViewProfile={(profile) => void handleViewSearchedProfile(profile)}
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
        maxWidthClassName="max-w-[min(1440px,calc(100vw-48px))]"
        containerClassName="p-6"
        zIndexClassName="z-[165]"
        className="relative h-[calc(100dvh-48px)] max-h-none overflow-visible p-0"
      >
        <div
          data-friend-profile-surface
          className="flex h-full flex-col overflow-hidden rounded-[32px] border border-white/10 bg-[#050507] shadow-2xl"
        >
          {friendProfileModal && (
            <React.Suspense fallback={
              <div className="flex h-full items-center justify-center p-10">
                <LoadingState label="Carregando Perfil" variant="Drive" />
              </div>
            }>
              <UserProfilePage
                userProfile={friendProfileModal.profile}
                user={{ email: null, photoURL: friendProfileModal.profile.photoURL }}
                games={friendProfileModal.games}
                editable={false}
                playSound={playSound as any}
                language={launcherLanguage}
                copyFriendDiscord
                onNotify={notify}
              />
            </React.Suspense>
          )}
        </div>
        <button
          type="button"
          aria-label="Fechar perfil do amigo"
          onClick={() => {
            playSound("back");
            setFriendProfileModal(null);
          }}
          className="absolute -right-3 -top-3 z-20 flex h-12 w-12 items-center justify-center rounded-full border border-white/20 bg-[#08080a] text-white/70 shadow-[0_12px_32px_rgba(0,0,0,0.6)] transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
        >
          <X className="h-5 w-5" />
        </button>
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
        isOpen={exitConfirmationOpen}
        title="Sair do Phelierium"
        description="O launcher e os recursos em segundo plano serão encerrados."
        confirmLabel="Sair do aplicativo"
        onClose={() => setExitConfirmationOpen(false)}
        onConfirm={() => {
          setExitConfirmationOpen(false);
          void window.electronAPI?.confirmAppQuit?.();
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
        onStartVoiceCall={(friend, withVideo) => void startCall(friend, withVideo)}
      />

      <AnimatePresence>
        {isExitingSession && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[210] flex flex-col items-center justify-center overflow-hidden bg-[#030405]"
          >
            {/* Onda de luz expandindo */}
            <motion.div
              initial={{ scale: 0, opacity: 0.8 }}
              animate={{ scale: 1, opacity: 0 }}
              transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
              className="absolute w-[60vmax] h-[60vmax] rounded-full bg-white blur-[100px] pointer-events-none"
            />

            {/* Anéis orbitais concêntricos */}
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
              className="absolute w-80 h-80 md:w-96 md:h-96 rounded-full border border-white/[0.08]"
            />
            <motion.div
              animate={{ rotate: -360 }}
              transition={{ duration: 28, repeat: Infinity, ease: "linear" }}
              className="absolute w-64 h-64 md:w-80 md:h-80 rounded-full border border-white/[0.06] border-dashed"
            />

            {/* Núcleo com Logo */}
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              className="relative z-10 flex flex-col items-center text-center"
            >
              <div className="relative mb-6">
                <motion.div
                  animate={{ scale: [1, 1.2, 1], opacity: [0.2, 0.5, 0.2] }}
                  transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                  className="absolute inset-0 rounded-full bg-white blur-2xl"
                />
                <img
                  src="/Pherielium_logo.png"
                  alt="Pherielium"
                  className="relative w-20 h-20 md:w-24 md:h-24 object-contain drop-shadow-[0_0_35px_rgba(255,255,255,0.6)]"
                  draggable={false}
                />
              </div>

              <h3 className="text-2xl md:text-3xl font-display font-semibold text-white tracking-tight mb-2">
                Encerrando Sessão
              </h3>
              <p className="text-xs font-body tracking-wider text-white/40">
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
