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
  X,
  LogOut,
  Settings,
  Users,
  Palette,
  BadgeDollarSign,
} from "lucide-react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faDiscord, faSteam } from "@fortawesome/free-brands-svg-icons";
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
import { HomeOverviewPanels } from "../components/HomeOverviewPanels";
import {
  AddFriendModal,
  ChatModal,
  ConfirmationModal,
  EmptyLibraryOnboarding,
  EmptyState,
  FriendsPage,
  PriceAlertsPage,
  SettingsPageV2,
} from "../components/home/HomePanels";
import { useNotification } from "../components/NotificationCenter";
import ModalShell from "../components/ui/ModalShell";
import { useAuth } from "../auth/AuthProvider";
import type { UserProfile } from "../types/domain";
import { useImagePreloader } from "../hooks/useImagePreloader";
import { useSoundEffects, type SoundEffectType } from "../hooks/useSoundEffects";
import { useGameColor } from "../hooks/useGameColor";
import { useGamepadNavigation } from "../hooks/useGamepadNavigation";
import {
  usePreferences,
  type LauncherLanguage,
  type SoundTheme,
  type VisualTheme,
} from "../context/PreferencesContext";
import { isBackendHealthy } from "../services/api";
import {
  disconnectSteamAccount,
  getSteamLinkUrl,
  syncSteamLibraryToFirestore,
  fetchSteamAchievementDetails,
} from "../services/steam";
import {
  disconnectDiscordAccount,
  getDiscordLinkUrl,
} from "../services/discord";
import {
  acceptCheckpointFriendRequest,
  getCheckpointFriendProfile,
  getCheckpointFriendStatuses,
  rejectCheckpointFriendRequest,
  removeCheckpointFriend,
  sendCheckpointFriendRequest,
  updateCheckpointPresence,
} from "../services/checkpointFriends";
import {
  subscribeToUnreadMessages,
} from "../services/chat";
import { discordRichPresence, useDiscordRichPresence } from "../services/discordRichPresence";
import { getMonitorableExecutablePath } from "../services/launcher";
import type { Game } from "../types/domain";
import {
  profileDocRef,
  userDocRef,
  userGameDocRef,
  userGamesCollectionRef,
} from "../services/firestorePaths";
import { EPIC_GAMES_ICON_PATH } from "../constants/assets";
import { useGamepadButton, useGamepad } from "../context/GamepadContext";
import InputHints from "../components/ui/InputHints";

const AddGameModal = React.lazy(() => import("../components/AddGameModal"));
const GameDetailPanel = React.lazy(() => import("../components/GameDetailPanel"));
const UserProfilePage = React.lazy(() => import("../components/UserProfilePage"));

const SteamBrandIcon: React.FC<{ className?: string; style?: React.CSSProperties }> = ({ className, style }) => (
  <FontAwesomeIcon icon={faSteam} className={className} style={style as any} />
);

const DiscordBrandIcon: React.FC<{ className?: string; style?: React.CSSProperties }> = ({ className, style }) => (
  <FontAwesomeIcon icon={faDiscord} className={className} style={style as any} />
);

const EpicBrandIcon: React.FC<{ className?: string; style?: React.CSSProperties }> = ({ className, style }) => (
  <img
    width={96}
    height={96}
    src={EPIC_GAMES_ICON_PATH}
    alt="Epic Games"
    className={className}
    style={{ filter: "invert(1)", ...style }}
  />
);

const CATEGORIES = [
  { id: "ALL", label: "Todos", Icon: Gamepad2 },
  { id: "FAVORITES", label: "Favoritos", Icon: Star },
  { id: "FRIENDS", label: "Amigos", Icon: Users },
  { id: "DEALS", label: "Ofertas", Icon: BadgeDollarSign },
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

const SIDEBAR_CATEGORIES = CATEGORIES.filter(({ id }) =>
  ["ALL", "FAVORITES", "FRIENDS", "DEALS", "STEAM", "EPIC", "LOCAL", "PROFILE"].includes(id),
);

const normalizeCategory = (v?: string) =>
  v?.toUpperCase().replace(/[^A-Z0-9]/g, "") ?? "";
const steamIdKey = (uid: string) => `checkpoint_steam_id_${uid}`;
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

interface SocialFriend {
  id: string;
  name: string;
  status: "online" | "playing" | "offline";
  playing?: string;
  avatar?: string;
  source?: "discord" | "discord_friend" | "local" | "checkpoint";
}

const buildLocalFriendProfile = (friend: SocialFriend): { profile: UserProfile; games: Game[] } => ({
  profile: {
    uid: friend.id,
    displayName: friend.name,
    photoURL: friend.avatar || null,
    discordAvatar: friend.source === "discord_friend" ? friend.avatar : undefined,
    discordUsername: friend.source === "discord_friend" ? friend.name : undefined,
    status: friend.status,
    playing: friend.playing || null,
  },
  games: [],
});

type CheckpointFriendRequest = NonNullable<UserProfile["checkpointFriendRequestsIncoming"]>[number];

interface PriceAlert {
  id: string;
  gameId: string;
  title: string;
  source: "Steam" | "Epic" | "Manual";
}

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
  playSound: (t: SoundEffectType) => void;
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
          className="flex-1 flex flex-col items-center py-5 gap-1 min-h-0"
          style={{
            background: "rgba(6,6,10,0.78)",
            boxShadow: "12px 0 40px rgba(0,0,0,0.35), inset -1px 0 rgb(var(--launcher-accent) / 0.08)",
            backdropFilter: "blur(40px)",
            borderRight: "1px solid rgba(255,255,255,0.055)",
          }}
        >
          <div className="mb-4 flex flex-col items-center shrink-0">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center"
            >
              <img src="/Checkpoint_Logo.png" alt="" className="h-full w-full object-contain" />
            </div>
          </div>

          <div
            className="w-8 h-px mb-2 shrink-0"
            style={{ background: "rgba(255,255,255,0.07)" }}
          />

          <nav className="flex flex-col gap-0.5 w-full px-2 shrink-0">
            {SIDEBAR_CATEGORIES.map(({ id, label, Icon }) => {
              const active = activeCategory === id;
              return (
                <button
                  key={id}
                  onClick={() => {
                    onCategory(id);
                    playSound("navigate");
                  }}
                  title={label}
                  className="relative group flex flex-col items-center justify-center gap-1 w-full py-2 rounded-xl transition-all duration-200"
                  style={{
                    background: active ? "var(--launcher-accent-soft)" : "transparent",
                    border: active
                      ? "1px solid rgba(255,255,255,0.1)"
                      : "1px solid transparent",
                  }}
                >
                  {active && (
                    <motion.div
                      layoutId="sb-active"
                      className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full"
                      style={{ background: "rgb(var(--launcher-accent))" }}
                    />
                  )}
                  <Icon
                    className="w-[15px] h-[15px] transition-colors"
                    style={{
                      color: active
                        ? "rgb(var(--launcher-accent))"
                        : "rgba(255,255,255,0.28)",
                    }}
                  />
                  <span
                    className="text-[7.5px] font-black uppercase tracking-wide leading-none transition-colors"
                    style={{
                      color: active
                        ? "rgb(var(--launcher-accent))"
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
            className="w-8 h-px mt-auto mb-3 shrink-0"
            style={{ background: "rgba(255,255,255,0.07)" }}
          />

          <button
            onClick={() => {
              onCategory("SETTINGS");
              playSound("navigate");
            }}
            title="Configurações"
            className="relative group flex flex-col items-center justify-center gap-1 w-[80px] py-2 rounded-xl transition-all duration-200 shrink-0"
            style={{
              background:
                activeCategory === "SETTINGS"
                  ? "var(--launcher-accent-soft)"
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
                style={{ background: "rgb(var(--launcher-accent))" }}
              />
            )}
            <Settings
              className="w-[15px] h-[15px] transition-colors"
              style={{
                color:
                  activeCategory === "SETTINGS"
                    ? "rgb(var(--launcher-accent))"
                    : "rgba(255,255,255,0.28)",
              }}
            />
            <span
              className="text-[7.5px] font-black uppercase tracking-wide leading-none transition-colors"
              style={{
                color:
                  activeCategory === "SETTINGS"
                    ? "rgb(var(--launcher-accent))"
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
  const [discordConnecting, setDiscordConnecting] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [signOutModalOpen, setSignOutModalOpen] = useState(false);
  const [disconnectSteamModalOpen, setDisconnectSteamModalOpen] =
    useState(false);
  const [disconnectDiscordModalOpen, setDisconnectDiscordModalOpen] =
    useState(false);
  const [isExitingSession, setIsExitingSession] = useState(false);
  const [socialFriends, setSocialFriends] = useState<SocialFriend[]>([]);
  const [unreadMessagesByFriend, setUnreadMessagesByFriend] = useState<Record<string, number>>({});
  const [incomingFriendRequests, setIncomingFriendRequests] = useState<CheckpointFriendRequest[]>([]);
  const [currentPresenceGame, setCurrentPresenceGame] = useState<string | null>(null);
  const [currentPresenceExecutablePath, setCurrentPresenceExecutablePath] = useState<string | null>(null);
  const [activeChatFriend, setActiveChatFriend] = useState<SocialFriend | null>(null);
  const [priceAlerts, setPriceAlerts] = useState<PriceAlert[]>([]);
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

  const handleContextMenu = useCallback((e: React.MouseEvent, game: Game) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, game });
  }, []);
  const [editingGame, setEditingGame] = useState<Game | null>(null);
  const [onboardingCompleted, setOnboardingCompleted] = useState(false);
  const [isAddFriendModalOpen, setIsAddFriendModalOpen] = useState(false);

  const lastWheelTime = useRef<number>(0);
  const previousCheckpointFriendsRef = useRef<Set<string> | null>(null);
  const previousOutgoingRequestsRef = useRef<Set<string> | null>(null);
  const previousIncomingRequestsRef = useRef<Set<string> | null>(null);
  const previousSteamIdRef = useRef<string | undefined>(undefined);
  const previousDiscordIdRef = useRef<string | undefined>(undefined);
  const friendPresenceFingerprintRef = useRef<Map<string, string>>(new Map());
  const didInitConnectionRefs = useRef(false);

  const { notify } = useNotification();
  const { user, userProfile, signOutUser, refreshProfile } = useAuth();
  const checkpointFriendIds = useMemo(
    () => new Set((userProfile?.checkpointFriends ?? []).map((friend) => friend.uid)),
    [userProfile?.checkpointFriends],
  );
  const outgoingFriendRequestIds = useMemo(
    () => new Set((userProfile?.checkpointFriendRequestsOutgoing ?? []).map((request) => request.uid)),
    [userProfile?.checkpointFriendRequestsOutgoing],
  );
  const incomingFriendRequestIds = useMemo(
    () => new Set((userProfile?.checkpointFriendRequestsIncoming ?? []).map((request) => request.uid)),
    [userProfile?.checkpointFriendRequestsIncoming],
  );
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
  const {
    setGameActivity,
    setBrowsingActivity,
    clearActivity,
    setEnabled: setRichPresenceEnabled,
    isEnabled: isRichPresenceEnabled
  } = useDiscordRichPresence();
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
  const hasLocalScanner = Boolean(window.electronAPI?.scanLocalGames);

  const clearCurrentPresence = useCallback(() => {
    setCurrentPresenceGame(null);
    setCurrentPresenceExecutablePath(null);
  }, []);

  const syncDetectedRunningGame = useCallback(async () => {
    if (!window.electronAPI?.detectRunningGames || games.length === 0) {
      return;
    }

    const monitorableGames = games
      .map((game) => ({
        game,
        executablePath: getMonitorableExecutablePath(game),
      }))
      .filter(
        (entry): entry is { game: Game; executablePath: string } =>
          Boolean(entry.executablePath),
      );

    if (monitorableGames.length === 0) {
      return;
    }

    try {
      const runningPaths = await window.electronAPI.detectRunningGames(
        monitorableGames.map((entry) => entry.executablePath),
      );
      const normalizedRunning = new Set(
        runningPaths.map((value) => value.trim().toLowerCase()),
      );

      const matchedCurrent = currentPresenceExecutablePath
        ? monitorableGames.find(
          (entry) =>
            entry.executablePath.trim().toLowerCase() ===
              currentPresenceExecutablePath.trim().toLowerCase() &&
            normalizedRunning.has(entry.executablePath.trim().toLowerCase()),
        )
        : undefined;

      const matchedGame =
        matchedCurrent ||
        monitorableGames.find((entry) =>
          normalizedRunning.has(entry.executablePath.trim().toLowerCase()),
        );

      if (!matchedGame) {
        if (currentPresenceExecutablePath) {
          clearCurrentPresence();
        }
        return;
      }

      if (
        currentPresenceGame !== matchedGame.game.title ||
        currentPresenceExecutablePath !== matchedGame.executablePath
      ) {
        setCurrentPresenceGame(matchedGame.game.title);
        setCurrentPresenceExecutablePath(matchedGame.executablePath);
      }
    } catch {
      // Presence auto-detection is best-effort.
    }
  }, [
    clearCurrentPresence,
    currentPresenceExecutablePath,
    currentPresenceGame,
    games,
  ]);

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
  }, [notify, resolvedDiscordId, resolvedSteamId]);

  // ── Auto-Updater Global Listener ──────────────────────────────────────────
  useEffect(() => {
    if (!(window as any).electronAPI?.onUpdateMessage) return;

    const unsubscribe = (window as any).electronAPI.onUpdateMessage((msg: string, data: any) => {
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

  // Discord Rich Presence: Inicialização
  useEffect(() => {
    const initializeRichPresence = async () => {
      if (resolvedDiscordId && user?.uid) {
        const success = await discordRichPresence.initialize();
        if (success) {
          // Habilitar automaticamente se Discord estiver conectado
          setRichPresenceEnabled(true);
          // Definir status inicial como "navegando"
          await setBrowsingActivity();
        }
      }
    };

    initializeRichPresence();
  }, [resolvedDiscordId, user?.uid]);

  // Discord Rich Presence: Atualizar quando jogo atual mudar
  useEffect(() => {
    if (!isRichPresenceEnabled || !currentPresenceGame) {
      if (isRichPresenceEnabled && !currentPresenceGame) {
        setBrowsingActivity();
      }
      return;
    }

    // Encontrar o jogo que está sendo jogado
    const playingGame = games.find(game =>
      game.title.toLowerCase().includes(currentPresenceGame.toLowerCase()) ||
      currentPresenceGame.toLowerCase().includes(game.title.toLowerCase())
    );

    if (playingGame) {
      setGameActivity(playingGame, 'playing');
    }
  }, [currentPresenceGame, games, isRichPresenceEnabled]);

  // Discord Rich Presence: Limpar quando sair ou desconectar Discord
  useEffect(() => {
    if (!resolvedDiscordId || !user?.uid) {
      clearActivity();
      setRichPresenceEnabled(false);
    }
  }, [resolvedDiscordId, user?.uid]);

  useEffect(() => {
    if (!user?.uid) {
      setSocialFriends([]);
      setPriceAlerts([]);
      setLocalSocialStateLoaded(false);
      return;
    }
    // Filter out any legacy demo/local friends — real friends come from Discord via Firestore
    const stored: SocialFriend[] = JSON.parse(
      localStorage.getItem(`checkpoint_social_friends_${user.uid}`) || "[]",
    );
    setSocialFriends(stored.filter((f) => f.source?.startsWith("discord") || f.source === "checkpoint"));
    setPriceAlerts(
      JSON.parse(localStorage.getItem(`checkpoint_price_alerts_${user.uid}`) || "[]"),
    );
    setLocalSocialStateLoaded(true);
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid || !localSocialStateLoaded) return;
    localStorage.setItem(`checkpoint_social_friends_${user.uid}`, JSON.stringify(socialFriends));
  }, [localSocialStateLoaded, socialFriends, user?.uid]);

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

      setCurrentPresenceGame(title);
      setCurrentPresenceExecutablePath(detail?.executablePath || null);
      void window.electronAPI?.showGameStartOverlay({ gameTitle: title });

      if (isRichPresenceEnabled) {
        const launchedGame = games.find(
          (game) =>
            game.title.toLowerCase().includes(title.toLowerCase()) ||
            title.toLowerCase().includes(game.title.toLowerCase()),
        );

        if (launchedGame) {
          setGameActivity(launchedGame, "playing");
        }
      }
    };

    window.addEventListener("checkpoint:game-launch", handleGameLaunch);
    return () => window.removeEventListener("checkpoint:game-launch", handleGameLaunch);
  }, [games, isRichPresenceEnabled, setGameActivity]);

  useEffect(() => {
    if (!currentPresenceGame || !currentPresenceExecutablePath || !window.electronAPI?.isExecutableRunning) {
      return;
    }

    let cancelled = false;

    const syncRunningState = async () => {
      try {
        const isRunning = await window.electronAPI?.isExecutableRunning(
          currentPresenceExecutablePath,
        );
        if (!cancelled && !isRunning) {
          clearCurrentPresence();
        }
      } catch {
        // Presence cleanup is best-effort.
      }
    };

    void syncRunningState();
    const interval = window.setInterval(() => {
      void syncRunningState();
    }, 5000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [clearCurrentPresence, currentPresenceExecutablePath, currentPresenceGame]);

  useEffect(() => {
    if (!user?.uid || !window.electronAPI?.detectRunningGames) {
      return;
    }

    void syncDetectedRunningGame();

    const handleFocus = () => {
      void syncDetectedRunningGame();
    };

    const interval = window.setInterval(() => {
      if (!currentPresenceExecutablePath) {
        void syncDetectedRunningGame();
      }
    }, 15_000);

    window.addEventListener("focus", handleFocus);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", handleFocus);
    };
  }, [currentPresenceExecutablePath, syncDetectedRunningGame, user?.uid]);

  useEffect(() => {
    if (!currentPresenceGame || currentPresenceExecutablePath || !window.electronAPI?.isExecutableRunning) {
      return;
    }

    const handleFocus = () => {
      clearCurrentPresence();
    };

    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [clearCurrentPresence, currentPresenceExecutablePath, currentPresenceGame]);

  const notifiedMessageIdsRef = useRef<Set<string>>(new Set());
  const isFirstUnreadSnapshotRef = useRef(true);

  // Unread messages snapshot listener for overlay notifications
  useEffect(() => {
    if (!user?.uid) {
      isFirstUnreadSnapshotRef.current = true;
      notifiedMessageIdsRef.current.clear();
      setUnreadMessagesByFriend({});
      return;
    }

    const unsubscribe = subscribeToUnreadMessages((unreadMsgs) => {
      const counts = unreadMsgs.reduce<Record<string, number>>((acc, msg) => {
        acc[msg.senderId] = (acc[msg.senderId] || 0) + 1;
        return acc;
      }, {});
      setUnreadMessagesByFriend(counts);

      if (isFirstUnreadSnapshotRef.current) {
        unreadMsgs.forEach((msg) => {
          const messageId = msg.id || `${msg.senderId}:${msg.createdAt}:${msg.text}`;
          notifiedMessageIdsRef.current.add(messageId);
        });
        isFirstUnreadSnapshotRef.current = false;
        return;
      }

      unreadMsgs.forEach((msg) => {
        const messageId = msg.id || `${msg.senderId}:${msg.createdAt}:${msg.text}`;
        if (!notifiedMessageIdsRef.current.has(messageId)) {
          notifiedMessageIdsRef.current.add(messageId);
          
          const senderFriend = socialFriends.find((f) => f.id === `cp-friend:${msg.senderId}`);
          const senderName = senderFriend?.name || "Amigo";
          const avatarUrl = senderFriend?.avatar || "";

          if (activeChatFriend?.id !== `cp-friend:${msg.senderId}`) {
            void window.electronAPI?.showFriendMessageOverlay({
              senderName,
              messageText: msg.text,
              avatarUrl,
            });
            playSound("friendRequest");
          }
        }
      });
    });

    return () => unsubscribe();
  }, [user?.uid, socialFriends, activeChatFriend, playSound]);

  // Polling loop for Steam achievements while playing
  useEffect(() => {
    if (!currentPresenceGame || !userProfile?.steamId) {
      return;
    }

    const runningGame = games.find(
      (g) =>
        g.title.toLowerCase().includes(currentPresenceGame.toLowerCase()) ||
        currentPresenceGame.toLowerCase().includes(g.title.toLowerCase())
    );

    const appId = runningGame?.steamAppId;
    if (!appId) return;

    let isPolling = true;
    const unlockedSet = new Set<string>();
    let firstLoadDone = false;

    const pollAchievements = async () => {
      try {
        const details = await fetchSteamAchievementDetails(userProfile.steamId!, appId);
        if (!isPolling) return;

        if (!firstLoadDone) {
          details.achievements.forEach((ach) => {
            if (ach.achieved) {
              unlockedSet.add(ach.apiName);
            }
          });
          firstLoadDone = true;
          return;
        }

        for (const ach of details.achievements) {
          if (ach.achieved && !unlockedSet.has(ach.apiName)) {
            unlockedSet.add(ach.apiName);

            void window.electronAPI?.showAchievementOverlay({
              gameId: runningGame.id,
              achievementId: ach.apiName,
              achievement: {
                id: ach.apiName,
                name: ach.name,
                description: ach.description,
                icon: ach.icon || "",
              },
              unlockedAt: new Date().toISOString(),
              duplicate: false,
            });
          }
        }
      } catch (error) {
        console.error("Erro no polling de conquistas Steam:", error);
      }
    };

    void pollAchievements();
    const interval = window.setInterval(() => {
      void pollAchievements();
    }, 5000);

    return () => {
      isPolling = false;
      window.clearInterval(interval);
    };
  }, [currentPresenceGame, userProfile?.steamId, games]);

  useEffect(() => {
    if (!user?.uid) return;

    const markOffline = () => {
      void updateCheckpointPresence("offline").catch(() => undefined);
    };

    window.addEventListener("beforeunload", markOffline);
    return () => window.removeEventListener("beforeunload", markOffline);
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid || (userProfile?.checkpointFriends ?? []).length === 0) return;

    const syncFriendStatuses = async () => {
      try {
        const statuses = await getCheckpointFriendStatuses();
        if (statuses.length === 0) return;
        setSocialFriends((current) => {
          const statusById = new Map(statuses.map((friend) => [friend.uid, friend]));
          let hasChanges = false;

          const updatedFriends = current.map((friend) => {
            if (!friend.id.startsWith("cp-friend:")) return friend;
            const uid = friend.id.split(":")[1];
            const status = statusById.get(uid);
            if (!status) return friend;

            const newFriend = {
              ...friend,
              name: status.displayName || friend.name,
              avatar: status.photoURL || friend.avatar,
              status: status.status || "offline",
              playing: status.playing || undefined,
            };
            const nextFingerprint = `${newFriend.status}:${newFriend.playing || ""}`;
            const previousFingerprint = friendPresenceFingerprintRef.current.get(friend.id);

            // Verificar mudanças relevantes e notificar
            if (friend.status !== newFriend.status || friend.playing !== newFriend.playing) {
              hasChanges = true;

              // Notificar quando amigo fica online
              if (
                friend.status === "offline" &&
                newFriend.status === "online" &&
                previousFingerprint !== nextFingerprint
              ) {
                notify(`${newFriend.name} ficou online`, "success");
              }

              // Notificar quando amigo começa a jogar
              if (
                friend.status !== "playing" &&
                newFriend.status === "playing" &&
                newFriend.playing &&
                previousFingerprint !== nextFingerprint
              ) {
                notify(`${newFriend.name} começou a jogar ${newFriend.playing}`, "success");
                void window.electronAPI?.showFriendPlayingOverlay({
                  playerName: newFriend.name,
                  gameTitle: newFriend.playing,
                  avatarUrl: newFriend.avatar || null,
                });
              }
            }

            friendPresenceFingerprintRef.current.set(friend.id, nextFingerprint);
            return newFriend;
          });

          // Só atualizar se houver mudanças reais
          return hasChanges ? updatedFriends : current;
        });
      } catch {
        // Presence is opportunistic; the friend list still works without it.
      }
    };

    // Sincronização inicial (sem notificações)
    let isInitialSync = true;
    const initialSync = async () => {
      try {
        const statuses = await getCheckpointFriendStatuses();
        if (statuses.length === 0) return;
        setSocialFriends((current) => {
          const statusById = new Map(statuses.map((friend) => [friend.uid, friend]));

          const updatedFriends = current.map((friend) => {
            if (!friend.id.startsWith("cp-friend:")) return friend;
            const uid = friend.id.split(":")[1];
            const status = statusById.get(uid);
            if (!status) return friend;

            const nextFriend = {
              ...friend,
              name: status.displayName || friend.name,
              avatar: status.photoURL || friend.avatar,
              status: status.status || "offline",
              playing: status.playing || undefined,
            };

            friendPresenceFingerprintRef.current.set(
              friend.id,
              `${nextFriend.status}:${nextFriend.playing || ""}`,
            );

            return nextFriend;
          });

          return updatedFriends;
        });
      } catch {
        // Presence is opportunistic; the friend list still works without it.
      }
      isInitialSync = false;
    };

    initialSync();

    // Intervalo mais frequente para updates em tempo real (com notificações)
    const interval = window.setInterval(() => {
      if (!isInitialSync) {
        syncFriendStatuses();
      }
    }, 15_000);

    // Sincronizar quando a aba volta ao foco
    const handleFocus = () => {
      if (!isInitialSync) {
        syncFriendStatuses();
      }
    };

    window.addEventListener('focus', handleFocus);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
    };
  }, [user?.uid, userProfile?.checkpointFriends, notify]);

  useEffect(() => {
    setIncomingFriendRequests(userProfile?.checkpointFriendRequestsIncoming ?? []);
  }, [userProfile?.checkpointFriendRequestsIncoming]);

  useEffect(() => {
    const currentIncoming = userProfile?.checkpointFriendRequestsIncoming ?? [];
    const currentIncomingIds = new Set(currentIncoming.map((request) => request.uid));

    if (!previousIncomingRequestsRef.current) {
      previousIncomingRequestsRef.current = currentIncomingIds;
      return;
    }

    const previousIncomingIds = previousIncomingRequestsRef.current;
    const freshRequest = currentIncoming.find((request) => !previousIncomingIds.has(request.uid));

    if (freshRequest) {
      notify(`${freshRequest.displayName} enviou um pedido de amizade.`, "info");
      playSound("friendRequest");
      void window.electronAPI?.showFriendRequestOverlay({
        playerName: freshRequest.displayName,
        avatarUrl: freshRequest.photoURL || null,
      });
    }

    previousIncomingRequestsRef.current = currentIncomingIds;
  }, [notify, playSound, userProfile?.checkpointFriendRequestsIncoming]);

  useEffect(() => {
    const currentFriends = new Set((userProfile?.checkpointFriends ?? []).map((friend) => friend.uid));
    const currentOutgoing = new Set(
      (userProfile?.checkpointFriendRequestsOutgoing ?? []).map((request) => request.uid),
    );
    const previousFriends = previousCheckpointFriendsRef.current;
    const previousOutgoing = previousOutgoingRequestsRef.current;

    if (previousFriends && previousOutgoing) {
      const acceptedFriend = (userProfile?.checkpointFriends ?? []).find(
        (friend) => !previousFriends.has(friend.uid) && previousOutgoing.has(friend.uid),
      );
      if (acceptedFriend) {
        notify(
          `${acceptedFriend.displayName} aceitou seu pedido. Agora voces sao amigos.`,
          "success",
        );
        void window.electronAPI?.showFriendAcceptedOverlay({
          playerName: acceptedFriend.displayName,
          avatarUrl: acceptedFriend.photoURL || null,
        });
      }
    }

    previousCheckpointFriendsRef.current = currentFriends;
    previousOutgoingRequestsRef.current = currentOutgoing;
  }, [notify, userProfile?.checkpointFriendRequestsOutgoing, userProfile?.checkpointFriends]);

  useEffect(() => {
    if (!localSocialStateLoaded) return;
    if (!resolvedDiscordId) {
      setSocialFriends((current) =>
        current.filter((friend) => !friend.source?.startsWith("discord")),
      );
      return;
    }

    setSocialFriends((current) => {
      // Apenas amigos do Discord (não incluir o próprio usuário)
      const remoteFriends: SocialFriend[] = (userProfile?.discordFriends ?? [])
        .filter((friend) => friend.id && friend.id !== resolvedDiscordId)
        .map((friend) => ({
          id: `discord-friend:${friend.id}`,
          name: friend.username || "Discord",
          status: "offline",
          avatar: friend.avatar || undefined,
          source: "discord_friend",
        }));
      const cpFriends: SocialFriend[] = (userProfile?.checkpointFriends ?? []).map(f => ({
        id: `cp-friend:${f.uid}`,
        name: f.displayName,
        status: "offline",
        playing: undefined,
        avatar: f.photoURL || undefined,
        source: "checkpoint",
      }));
      const remoteIds = new Set([...remoteFriends.map((friend) => friend.id), ...cpFriends.map(f => f.id)]);
      const localFriends = current.filter(
        (friend) => !friend.source?.startsWith("discord") && friend.source !== "checkpoint" && !remoteIds.has(friend.id),
      );
      return [...remoteFriends, ...cpFriends, ...localFriends];
    });
  }, [
    localSocialStateLoaded,
    resolvedDiscordId,
    userProfile?.discordAvatar,
    userProfile?.discordFriends,
    userProfile?.checkpointFriends,
    userProfile?.discordUsername,
  ]);

  useEffect(() => {
    if (!user?.uid || !localSocialStateLoaded) return;
    localStorage.setItem(`checkpoint_price_alerts_${user.uid}`, JSON.stringify(priceAlerts));
  }, [localSocialStateLoaded, priceAlerts, user?.uid]);

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
  const continuePlayingGames = useMemo(
    () =>
      [...games]
        .filter((game) => Boolean(game.lastPlayedAt || game.steamLastPlayedAt || game.hoursPlayed))
        .sort((a, b) => {
          const aPlayed = new Date(a.lastPlayedAt || a.steamLastPlayedAt || 0).getTime();
          const bPlayed = new Date(b.lastPlayedAt || b.steamLastPlayedAt || 0).getTime();
          if (aPlayed !== bPlayed) return bPlayed - aPlayed;
          return (b.hoursPlayed || 0) - (a.hoursPlayed || 0);
        })
        .slice(0, 3),
    [games],
  );
  const favoriteShowcaseGames = useMemo(
    () =>
      [...games]
        .filter((game) => game.isFavorite)
        .sort((a, b) => (b.hoursPlayed || 0) - (a.hoursPlayed || 0))
        .slice(0, 4),
    [games],
  );
  const friendsPlayingNow = useMemo(
    () => socialFriends.filter((friend) => friend.status === "playing").slice(0, 4),
    [socialFriends],
  );
  const recentOverviewActivity = useMemo(() => {
    const items: Array<{ id: string; title: string; detail: string; tone: "accent" | "success" | "muted" }> = [];

    friendsPlayingNow.forEach((friend) => {
      items.push({
        id: `friend-${friend.id}`,
        title: `${friend.name} ${t("activityFriendPlaying")}`,
        detail: friend.playing
          ? `${t("activityFriendPlayingDetail")} ${friend.playing}.`
          : t("activityFriendOnlineDetail"),
        tone: "success",
      });
    });

    continuePlayingGames.forEach((game) => {
      items.push({
        id: `game-${game.id}`,
        title: `${t("activityReturnedTo")} ${game.title}`,
        detail: `${game.hoursPlayed || 0}${t("activityLibraryHours")}`,
        tone: "accent",
      });
    });

    favoriteShowcaseGames.slice(0, 2).forEach((game) => {
      items.push({
        id: `favorite-${game.id}`,
        title: `${game.title} ${t("activityFavoriteStill")}`,
        detail: t("activityFavoriteHint"),
        tone: "muted",
      });
    });

    return items.slice(0, 5);
  }, [continuePlayingGames, favoriteShowcaseGames, friendsPlayingNow, t]);
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
    setSelectedIndex(0);
  }, [activeCategory]);
  useEffect(() => {
    if (displayGames.length === 0 && selectedIndex !== 0) setSelectedIndex(0);
    else if (displayGames.length > 0 && selectedIndex > displayGames.length - 1)
      setSelectedIndex(displayGames.length - 1);
  }, [displayGames.length, selectedIndex]);

  useEffect(() => {
    const cards = document.querySelectorAll<HTMLElement>("[data-game-card]");
    if (cards[selectedIndex]) {
      cards[selectedIndex].focus();
    }
  }, [selectedIndex]);

  // Keyboard arrows stay separate; gamepad D-pad is handled by useGamepadButton below.

  const openDetails = useCallback(
    (game: Game) => {
      setSelectedGame(game);
      setIsDetailOpen(true);
      setContextMenu(null);
      playSound("detailOpen");
    },
    [playSound],
  );

  const isSystemCategory = ["FRIENDS", "SETTINGS", "PROFILE", "DEALS"].includes(activeCategory);

  const getSystemFocusableElements = useCallback(() => {
    const root = document.querySelector<HTMLElement>("[data-system-page]");
    if (!root) return [];

    return Array.from(
      root.querySelectorAll<HTMLElement>(
        [
          "button:not(:disabled)",
          "input:not(:disabled)",
          "select:not(:disabled)",
          "textarea:not(:disabled)",
          "[tabindex]:not([tabindex='-1'])",
        ].join(","),
      ),
    ).filter((element) => {
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
    });
  }, []);

  type SpatialDirection = "up" | "down" | "left" | "right";

  const focusSystemElement = useCallback((element: HTMLElement, previousElement?: HTMLElement) => {
    document
      .querySelectorAll<HTMLElement>("[data-gamepad-focused='true']")
      .forEach((focusedElement) => {
        delete focusedElement.dataset.gamepadFocused;
      });

    element.dataset.gamepadFocused = "true";
    element.focus({ preventScroll: true });
    element.scrollIntoView({ block: "nearest", inline: "nearest" });

    if (element !== previousElement) {
      playSound("navigate");
    }
  }, [playSound]);

  const moveSystemFocus = useCallback((direction: SpatialDirection = "down") => {
    const elements = getSystemFocusableElements();
    if (elements.length === 0) return false;

    const activeElement = document.activeElement;
    const currentIndex = activeElement instanceof HTMLElement ? elements.indexOf(activeElement) : -1;

    if (currentIndex === -1) {
      focusSystemElement(elements[0]);
      return true;
    }

    const currentElement = elements[currentIndex];
    const currentRect = currentElement.getBoundingClientRect();
    const currentCenterX = currentRect.left + currentRect.width / 2;
    const currentCenterY = currentRect.top + currentRect.height / 2;
    const threshold = 8;

    const rankedCandidates = elements
      .map((element, index) => {
        if (index === currentIndex) return null;

        const rect = element.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const deltaX = centerX - currentCenterX;
        const deltaY = centerY - currentCenterY;

        const isInDirection =
          direction === "left"
            ? deltaX < -threshold
            : direction === "right"
              ? deltaX > threshold
              : direction === "up"
                ? deltaY < -threshold
                : deltaY > threshold;

        if (!isInDirection) return null;

        const primaryDistance =
          direction === "left" || direction === "right"
            ? Math.abs(deltaX)
            : Math.abs(deltaY);
        const secondaryDistance =
          direction === "left" || direction === "right"
            ? Math.abs(deltaY)
            : Math.abs(deltaX);

        return {
          element,
          score: primaryDistance * 4 + secondaryDistance,
        };
      })
      .filter((candidate): candidate is { element: HTMLElement; score: number } => Boolean(candidate))
      .sort((a, b) => a.score - b.score);

    const nextElement = rankedCandidates[0]?.element;
    if (!nextElement) return false;

    focusSystemElement(nextElement, currentElement);
    return true;
  }, [focusSystemElement, getSystemFocusableElements]);

  useEffect(() => {
    if (isSystemCategory) return;
    document
      .querySelectorAll<HTMLElement>("[data-gamepad-focused='true']")
      .forEach((focusedElement) => {
        delete focusedElement.dataset.gamepadFocused;
      });
  }, [isSystemCategory]);

  const adjustFocusedRange = useCallback((direction: 1 | -1) => {
    const activeElement = document.activeElement;
    if (!(activeElement instanceof HTMLInputElement) || activeElement.type !== "range") {
      return false;
    }

    const previousValue = activeElement.value;
    if (direction > 0) {
      activeElement.stepUp();
    } else {
      activeElement.stepDown();
    }

    if (activeElement.value !== previousValue) {
      activeElement.dispatchEvent(new Event("input", { bubbles: true }));
      activeElement.dispatchEvent(new Event("change", { bubbles: true }));
      playSound("navigate");
    }
    return true;
  }, [playSound]);

  useEffect(() => {
    if (!isSystemCategory) return;
    const timer = window.setTimeout(() => {
      const root = document.querySelector<HTMLElement>("[data-system-page]");
      if (root?.contains(document.activeElement)) return;
      moveSystemFocus("down");
    }, 80);

    return () => window.clearTimeout(timer);
  }, [activeCategory, isSystemCategory, moveSystemFocus]);

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
    signOutModalOpen,
  ]);

  useGamepadNavigation({
    disableX: true,
    disableO: isDetailOpen || isAddModalOpen,
    onClose: closeTopGamepadSurface,
  });

  useGamepadButton("X", () => {
    if (isAnyModalOpen || searchOpen) return;
    if (isSystemCategory) {
      const activeElement = document.activeElement;
      if (activeElement instanceof HTMLElement) {
        activeElement.click();
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
        await updateDoc(userGameDocRef(user.uid, game.id), {
          isFavorite: !game.isFavorite,
        });
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

    notify(
      "Iniciando conexão com Steam. Isso pode levar alguns segundos se o servidor estiver acordando...",
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
        const url = await getSteamLinkUrl();
        if (window.electronAPI?.openExternalUrl) {
          await window.electronAPI.openExternalUrl(url);
          notify("Navegador aberto! Conecte sua conta Steam e volte ao app.", "info");
          setSteamConnecting(false);
        } else {
          window.location.href = url;
        }
      } catch (e) {
        notify(
          e instanceof Error ? e.message : "Não foi possível conectar com a Steam.",
          "error",
        );
        setSteamConnecting(false);
      }
    });
  };

  const connectDiscord = () => {
    if (!user?.uid) return;
    playSound("select");
    setDiscordConnecting(true);

    isBackendHealthy().then(async (h) => {
      if (!h) {
        notify("Backend Discord offline.", "error");
        setDiscordConnecting(false);
        return;
      }
      try {
        const url = await getDiscordLinkUrl();
        if (window.electronAPI?.openExternalUrl) {
          await window.electronAPI.openExternalUrl(url);
          notify("Navegador aberto! Conecte sua conta Discord e volte ao app.", "info");
          setDiscordConnecting(false);
        } else {
          window.location.href = url;
        }
      } catch (e) {
        notify(
          e instanceof Error ? e.message : "Não foi possível conectar com o Discord.",
          "error",
        );
        setDiscordConnecting(false);
      }
    });
  };

  const removeFriend = async (friend: SocialFriend) => {
    const id = friend.id;
    if (id.startsWith("cp-friend:") && user?.uid) {
      const friendUid = id.split(":")[1];
      try {
        await removeCheckpointFriend(friendUid);
        await refreshProfile();
        notify(`${friend.name} foi removido da sua lista de amigos.`, "success");
      } catch (e) {
        notify(e instanceof Error ? e.message : "Erro ao remover amigo do Checkpoint.", "error");
      }
    } else {
      setSocialFriends((current) => current.filter((friend) => friend.id !== id));
    }
  };

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
    } catch (e) {
      setFriendProfileModal(buildLocalFriendProfile(friend));
      playSound("detailOpen");
    } finally {
      setFriendProfileLoadingId(null);
    }
  };

  const handleAddCheckpointFriend = async (friendProfile: UserProfile) => {
    if (!user?.uid) return;
    try {
      await sendCheckpointFriendRequest(friendProfile.uid);
      notify("Solicitação enviada.", "success");
      await refreshProfile();
      setIsAddFriendModalOpen(false);
    } catch (e) {
      notify(e instanceof Error ? e.message : "Erro ao enviar solicitação.", "error");
      throw e;
    }
  };

  const handleAcceptCheckpointFriendRequest = async (uid: string) => {
    const request = incomingFriendRequests.find((item) => item.uid === uid);
    try {
      const acceptedFriend = await acceptCheckpointFriendRequest(uid);
      const friendName = acceptedFriend?.displayName || request?.displayName || "Usuario";
      const nextFriend: SocialFriend = {
        id: `cp-friend:${acceptedFriend?.uid || uid}`,
        name: friendName,
        status: acceptedFriend?.status || "offline",
        playing: acceptedFriend?.playing || undefined,
        avatar: acceptedFriend?.photoURL || request?.photoURL || undefined,
        source: "checkpoint",
      };
      setIncomingFriendRequests((current) => current.filter((item) => item.uid !== uid));
      setSocialFriends((current) => [
        nextFriend,
        ...current.filter((friend) => friend.id !== nextFriend.id),
      ]);
      notify(`${friendName} agora e seu amigo no Checkpoint.`, "success");
      await refreshProfile();
    } catch (e) {
      notify(e instanceof Error ? e.message : "Erro ao aceitar solicitacao.", "error");
    }
  };

  const handleRejectCheckpointFriendRequest = async (uid: string) => {
    try {
      await rejectCheckpointFriendRequest(uid);
      setIncomingFriendRequests((current) => current.filter((item) => item.uid !== uid));
      notify("Solicitacao rejeitada.", "success");
      await refreshProfile();
    } catch (e) {
      notify(e instanceof Error ? e.message : "Erro ao rejeitar solicitacao.", "error");
    }
  };

  const addPriceAlert = (game: Game) => {
    setPriceAlerts((current) => [
      {
        id: crypto.randomUUID(),
        gameId: game.id,
        title: game.title,
        source:
          game.launcherType === "steam"
            ? "Steam"
            : game.launcherType === "epic"
              ? "Epic"
              : "Manual",
      },
      ...current,
    ]);
    notify("Alerta de oferta criado.", "success");
  };

  const removePriceAlert = (id: string) => {
    setPriceAlerts((current) => current.filter((alert) => alert.id !== id));
  };

  const openFriendChatFromOverview = useCallback(
    (friendId: string) => {
      const friend = socialFriends.find((item) => item.id === friendId);
      if (!friend) return;
      setActiveCategory("FRIENDS");
      setActiveChatFriend(friend);
      playSound("select");
    },
    [playSound, socialFriends],
  );

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
      await updateDoc(userGameDocRef(user.uid, game.id), {
        isFavorite: !game.isFavorite,
      });
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

  const handleDisconnectDiscord = async () => {
    if (!user?.uid) return;
    try {
      await disconnectDiscordAccount();
      await refreshProfile();
      notify("Discord desconectado.", "success");
    } catch {
      notify("Erro ao desconectar Discord.", "error");
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
        userDisplay={
          userProfile?.displayName || user?.email?.split("@")[0] || "Jogador"
        }
        steamConnected={Boolean(resolvedSteamId)}
        steamSyncing={steamSyncing}
        steamConnecting={steamConnecting}
        onSync={handleSyncSteam}
        onConnect={connectSteam}
        onDisconnect={() => setDisconnectSteamModalOpen(true)}
        onAddGame={() => openAddGameModal()}
        onSignOut={() => setSignOutModalOpen(true)}
        settingsLabel={t("settings")}
        playSound={playSound}
      />

      <div
        className="relative z-10 flex-1 flex flex-col h-screen overflow-hidden"
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
              onAcceptRequest={handleAcceptCheckpointFriendRequest}
              onRejectRequest={handleRejectCheckpointFriendRequest}
              onAddFriendClick={() => {
                playSound("select");
                setIsAddFriendModalOpen(true);
              }}
              onOpenChat={(friend) => {
                playSound("select");
                setActiveChatFriend(friend);
              }}
            />
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
              />
            </React.Suspense>
          ) : activeCategory === "DEALS" ? (
            <PriceAlertsPage
              t={t}
              games={games}
              alerts={priceAlerts}
              onAddAlert={addPriceAlert}
              onRemoveAlert={removePriceAlert}
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
          onSaved={() => { }}
          playSound={playSound}
          gameToEdit={editingGame}
        />
      </React.Suspense>

      <AddFriendModal
        isOpen={isAddFriendModalOpen}
        onClose={() => setIsAddFriendModalOpen(false)}
        onAddFriend={handleAddCheckpointFriend}
        currentUserUid={user?.uid ?? ""}
        friendIds={checkpointFriendIds}
        outgoingRequestIds={outgoingFriendRequestIds}
        incomingRequestIds={incomingFriendRequestIds}
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
            await deleteDoc(userGameDocRef(user.uid, pendingDeleteGame.id));
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
