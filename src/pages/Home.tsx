import React, { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2,
  LogOut,
  Play,
  Plus,
  RefreshCw,
  Search,
  Unlink2,
  User,
  MouseLeft,
  MouseRight,
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
import CategoryBar from "../components/CategoryBar";
import ContextMenu from "../components/ContextMenu";
import DynamicBackground from "../components/DynamicBackground";
import GameDetailPanel from "../components/GameDetailPanel";
import GameRow from "../components/GameRow";
import LoadingSkeleton from "../components/LoadingSkeleton";
import { useNotification } from "../components/NotificationCenter";
import Stepper, { Step } from "../components/ReactBits/Stepper";
import { useAuth } from "../auth/AuthProvider";
import { useImagePreloader } from "../hooks/useImagePreloader";
import { useSoundEffects } from "../hooks/useSoundEffects";
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

const CATEGORIES = [
  { id: "ALL", label: "TODOS" },
  { id: "FAVORITES", label: "FAVORITOS" },
  { id: "STEAM", label: "STEAM" },
  { id: "LOCAL", label: "LOCAL" },
  { id: "RACING", label: "CORRIDA" },
  { id: "ROLEPLAYING", label: "RPG" },
  { id: "SPORTS", label: "ESPORTES" },
  { id: "ONLINE", label: "ON-LINE" },
  { id: "SHOOTER", label: "TIRO" },
];
const normalizeCategory = (value?: string) =>
  value?.toUpperCase().replace(/[^A-Z0-9]/g, "") ?? "";
const steamIdStorageKey = (uid: string) => `checkpoint_steam_id_${uid}`;
const steamDisconnectedStorageKey = (uid: string) =>
  `checkpoint_steam_disconnected_${uid}`;

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
  const { playSound } = useSoundEffects();
  const { notify } = useNotification();
  const { user, userProfile, signOutUser, refreshProfile } = useAuth();
  const resolvedSteamId = useMemo(() => {
    return userProfile?.steamId || undefined;
  }, [userProfile?.steamId]);

  useEffect(() => {
    if (!user?.uid) {
      setGames([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    const q = query(userGamesCollectionRef(user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs
        .map(
          (gameDoc) =>
            ({
              id: gameDoc.id,
              ...gameDoc.data(),
            }) as Game,
        )
        .sort((a, b) => a.title.localeCompare(b.title));
      setGames(data);
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid) {
      setOnboardingCompleted(false);
      return;
    }
    const onboardingLocal =
      localStorage.getItem(`checkpoint_onboarding_${user.uid}`) === "1";
    const profileDone = Boolean(userProfile?.onboardingCompletedAt);
    setOnboardingCompleted(onboardingLocal || profileDone);
  }, [user?.uid, userProfile?.onboardingCompletedAt]);

  useEffect(() => {
    const migrateLegacyGames = async () => {
      if (!user?.uid) return;
      if (userProfile?.gamesMigratedAt) return;
      try {
        const legacySnap = await getDocs(
          query(collection(db, "games"), where("ownerUid", "==", user.uid)),
        );
        if (legacySnap.empty) {
          await setDoc(
            profileDocRef(user.uid),
            { gamesMigratedAt: new Date().toISOString() },
            { merge: true },
          );
          return;
        }
        const batch = writeBatch(db);
        legacySnap.docs.forEach((legacyDoc) => {
          const payload = legacyDoc.data();
          const rest = { ...payload };
          delete rest.ownerUid;
          batch.set(userGameDocRef(user.uid, legacyDoc.id), rest, {
            merge: true,
          });
          batch.delete(legacyDoc.ref);
        });
        batch.set(
          profileDocRef(user.uid),
          { gamesMigratedAt: new Date().toISOString() },
          { merge: true },
        );
        batch.set(
          userDocRef(user.uid),
          { migratedAt: new Date().toISOString() },
          { merge: true },
        );
        await batch.commit();
      } catch (error) {
        const code = (error as { code?: string } | undefined)?.code;
        if (code === "permission-denied") {
          await setDoc(
            profileDocRef(user.uid),
            {
              gamesMigratedAt: new Date().toISOString(),
              migrationSkippedReason: "legacy_games_permission_denied",
            },
            { merge: true },
          );
        } else {
          console.error("Falha na migração legacy de jogos:", error);
        }
      } finally {
        await refreshProfile();
      }
    };
    void migrateLegacyGames();
  }, [refreshProfile, user?.uid, userProfile?.gamesMigratedAt]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const steamStatus = params.get("steamStatus");
    const steamId = params.get("steamId");
    const state = params.get("state");

    if (!steamStatus) return;

    // Espera o auth carregar para não perder steamId antes de vincular.
    if (!user?.uid) return;

    if (steamStatus === "ok" && steamId && state === user.uid) {
      localStorage.removeItem(steamDisconnectedStorageKey(user.uid));
      localStorage.setItem(steamIdStorageKey(user.uid), steamId);
      setDoc(
        profileDocRef(user.uid),
        { steamId, updatedAt: new Date().toISOString() },
        { merge: true },
      )
        .catch((error) => {
          console.error("Falha ao vincular Steam no perfil:", error);
          notify(
            "Conta Steam autenticada, mas não foi possível salvar o vínculo no perfil.",
            "error",
          );
        })
        .finally(() => refreshProfile());
    } else if (steamStatus !== "ok") {
      const labels: Record<string, string> = {
        invalid_state: "Estado inválido ao conectar com a Steam.",
        invalid: "Falha na validação OpenID da Steam.",
        missing_id: "Steam ID não retornado pela autenticação.",
        error: "Erro inesperado na autenticação Steam.",
      };
      notify(
        labels[steamStatus] ?? "Não foi possível conectar com a Steam.",
        "error",
      );
    }

    window.history.replaceState({}, document.title, window.location.pathname);
  }, [notify, refreshProfile, user?.uid]);

  const displayGames = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    const ordered = [...games].sort((a, b) => {
      if (Boolean(a.isFavorite) === Boolean(b.isFavorite)) return 0;
      return a.isFavorite ? -1 : 1;
    });
    const byCategory =
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
              : ordered.filter(
                  (g) =>
                    normalizeCategory(g.category) ===
                    normalizeCategory(activeCategory),
                );
    if (!normalizedSearch) return byCategory;
    return byCategory.filter((game) => {
      const titleMatch = game.title.toLowerCase().includes(normalizedSearch);
      const categoryMatch = (game.category ?? "")
        .toLowerCase()
        .includes(normalizedSearch);
      return titleMatch || categoryMatch;
    });
  }, [activeCategory, games, searchTerm]);

  const canonicalIndex =
    displayGames.length > 0
      ? Math.min(Math.max(selectedIndex, 0), displayGames.length - 1)
      : 0;
  const currentGame = displayGames[canonicalIndex];
  const recentGames = useMemo(
    () =>
      [...games]
        .filter((game) => Boolean(game.lastPlayedAt))
        .sort(
          (a, b) =>
            new Date(b.lastPlayedAt ?? 0).getTime() -
            new Date(a.lastPlayedAt ?? 0).getTime(),
        )
        .slice(0, 8),
    [games],
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
    if (displayGames.length === 0 && selectedIndex !== 0) {
      setSelectedIndex(0);
      return;
    }
    if (displayGames.length > 0 && selectedIndex > displayGames.length - 1) {
      setSelectedIndex(displayGames.length - 1);
    }
  }, [displayGames.length, selectedIndex]);

  const openDetails = useCallback(
    (game: Game) => {
      setSelectedGame(game);
      setIsDetailOpen(true);
      setContextMenu(null);
      playSound("select");
    },
    [playSound],
  );

  const handleSyncSteam = async () => {
    if (!user?.uid || !resolvedSteamId) {
      notify("Conecte sua conta Steam para sincronizar.", "info");
      return;
    }
    const backendHealthy = await isBackendHealthy();
    if (!backendHealthy) {
      notify(
        "Backend Steam offline. Inicie com npm run server ou npm run dev:full.",
        "error",
      );
      return;
    }
    let hasApiKey = false;
    try {
      hasApiKey = await isSteamApiKeyConfigured();
    } catch {
      notify(
        "Não foi possível verificar a API key da Steam. Confira se o backend está ativo.",
        "error",
      );
      return;
    }
    if (!hasApiKey) {
      const shouldConfigure = window.confirm(
        "A Steam Web API Key não está configurada. Deseja abrir a página da Steam para gerar a chave?",
      );
      if (!shouldConfigure) return;
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
      if (count === 0) {
        notify(
          "Nenhum jogo retornado pela Steam. Verifique se o perfil/biblioteca estao publicos.",
          "info",
        );
      } else {
        notify(
          `Sincronização concluída: ${count} jogos importados/atualizados.`,
          "success",
        );
      }
      await refreshProfile();
    } catch (error) {
      notify(
        error instanceof Error
          ? error.message
          : "Falha na sincronização Steam.",
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
    isBackendHealthy().then((healthy) => {
      if (!healthy) {
        notify(
          "Backend Steam offline. Inicie com npm run server ou npm run dev:full.",
          "error",
        );
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

  const closeContextMenu = () => {
    setContextMenu(null);
    playSound("back");
  };

  const handleMenuAction = async (action: string, game: Game) => {
    if (action === "delete") {
      const confirmed = window.confirm(
        `Remover "${game.title}" da biblioteca?`,
      );
      if (confirmed) {
        if (!user?.uid) return;
        await deleteDoc(userGameDocRef(user.uid, game.id));
      }
    } else if (action === "favorite") {
      if (!user?.uid) return;
      await updateDoc(userGameDocRef(user.uid, game.id), {
        isFavorite: !game.isFavorite,
      });
    } else if (action === "edit") {
      setEditingGame(game);
      setIsAddModalOpen(true);
    }
    closeContextMenu();
  };

  const handleSignOut = async () => {
    playSound("back");
    setIsExitingSession(true);
    await new Promise((resolve) => window.setTimeout(resolve, 850));
    await signOutUser();
  };

  const handleDisconnectSteam = async () => {
    if (!user?.uid) return;
    playSound("back");
    setIsLoading(true);

    try {
      // 1. Update Firestore Profile (remove steamId)
      await updateDoc(profileDocRef(user.uid), {
        steamId: "", // Or use deleteField() if preferred, but "" is handled by ResolvedSteamId
        updatedAt: new Date().toISOString(),
      });

      // 2. Fetch and delete all Steam-linked games for this user
      const ownedGamesSnap = await getDocs(
        query(
          userGamesCollectionRef(user.uid),
          where("launcherType", "==", "steam"), // Optimize search
        ),
      );

      const steamGameDocs = ownedGamesSnap.docs;

      if (steamGameDocs.length > 0) {
        const batch = writeBatch(db);
        steamGameDocs.forEach((gameDoc) => batch.delete(gameDoc.ref));
        await batch.commit();
      }

      // 3. Clear local storage cache
      localStorage.removeItem(steamDisconnectedStorageKey(user.uid));
      localStorage.removeItem(steamIdStorageKey(user.uid));

      // 4. Update local profile state via the provider
      await refreshProfile();

      // 5. Reset selected index to prevent crashes if current game was deleted
      setSelectedIndex(0);

      notify(
        "Steam desconectada e biblioteca sincronizada localmente.",
        "success",
      );
    } catch (error) {
      console.error("Erro ao desconectar Steam:", error);
      notify(
        "Erro ao desconectar conta Steam. Verifique sua conexão.",
        "error",
      );
    } finally {
      setIsLoading(false);
    }
  };

  const closeAddModal = () => {
    playSound("back");
    setIsAddModalOpen(false);
    setEditingGame(null);
    // Garantia explícita: fechar modal não altera o estado da lista.
    setGames((prev) => prev);
  };

  const handleSaveSteamApiKey = async () => {
    const value = steamApiKeyInput.trim();
    if (!value) {
      notify("Informe a Steam Web API Key.", "error");
      return;
    }
    setSteamApiKeySaving(true);
    try {
      await saveSteamApiKey(value);
      setSteamApiKeyModalOpen(false);
      setSteamApiKeyInput("");
      notify(
        "API key salva. Clique novamente em Sync Steam para iniciar a sincronização.",
        "success",
      );
    } catch (error) {
      notify(
        error instanceof Error
          ? error.message
          : "Falha ao salvar a API key da Steam.",
        "error",
      );
    } finally {
      setSteamApiKeySaving(false);
    }
  };

  return (
    <div className="relative h-screen w-full text-white overflow-hidden no-scrollbar flex flex-col">
      <DynamicBackground
        backgroundImage={
          currentGame?.backgroundImage || currentGame?.image || ""
        }
        reducedEffects={isAnyModalOpen}
      />

      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="fixed top-0 left-0 right-0 z-40 px-6 md:px-12 py-4 flex items-center justify-between"
        style={{
          background:
            "linear-gradient(to bottom, rgba(5,5,7,0.85), rgba(5,5,7,0.25), transparent)",
        }}
      >
        <div className="flex items-center gap-4">
          <div className="h-11 px-4 rounded-2xl liquid-glass-subtle flex items-center gap-3">
            <User className="w-4 h-4 text-white/70" />
            <div className="text-xs">
              <p className="font-semibold">
                {userProfile?.displayName || user?.email || "Jogador"}
              </p>
              <p className="text-white/50">
                {resolvedSteamId
                  ? `Steam ${resolvedSteamId}`
                  : "Steam não conectada"}
              </p>
            </div>
          </div>
          <button
            onClick={handleSyncSteam}
            disabled={steamSyncing}
            onMouseEnter={() => playSound("navigate")}
            className="h-11 px-5 rounded-2xl liquid-glass-subtle text-xs font-bold tracking-wider uppercase flex items-center gap-2
            hover:scale-[1.02] hover:bg-white/10 active:scale-[0.98] transition-all disabled:opacity-60"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${steamSyncing ? "animate-spin" : ""}`}
            />
            {steamSyncing ? "Sincronizando..." : "Sync Steam"}
          </button>
          {!resolvedSteamId && (
            <button
              onClick={connectSteam}
              disabled={steamConnecting}
              onMouseEnter={() => playSound("navigate")}
              className="h-11 px-5 rounded-2xl bg-blue-500/20 border border-blue-400/30 text-xs font-bold tracking-wider uppercase
              hover:bg-blue-500/30 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-60"
            >
              {steamConnecting ? "Conectando..." : "Conectar Steam"}
            </button>
          )}
          {resolvedSteamId && (
            <button
              onClick={() => setDisconnectSteamModalOpen(true)}
              onMouseEnter={() => playSound("navigate")}
              className="h-11 px-5 rounded-2xl bg-red-500/15 border border-red-400/30 text-xs font-bold tracking-wider uppercase
              hover:bg-red-500/25 hover:scale-[1.02] active:scale-[0.98] transition-all"
            >
              <span className="inline-flex items-center gap-2">
                <Unlink2 className="w-3.5 h-3.5" />
                Desconectar Steam
              </span>
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              playSound("select");
              setIsAddModalOpen(true);
            }}
            onMouseEnter={() => playSound("navigate")}
            className="h-11 px-5 rounded-2xl bg-white text-black text-xs font-bold tracking-wider uppercase flex items-center gap-2
            hover:scale-[1.02] active:scale-[0.98] transition-all shadow-[0_0_30px_rgba(255,255,255,0.2)]"
          >
            <Plus className="w-4 h-4" />
            Novo Jogo
          </button>
          <button
            onClick={() => setSignOutModalOpen(true)}
            onMouseEnter={() => playSound("navigate")}
            className="w-11 h-11 rounded-2xl liquid-glass-subtle flex items-center justify-center hover:bg-red-500/15
            hover:scale-105 active:scale-95 transition-all"
            aria-label="Sair"
          >
            <LogOut className="w-4 h-4 text-white/80" />
          </button>
        </div>
      </motion.header>

      <div className="mt-24 pb-28 flex-1">
        {isLoading ? (
          <LoadingSkeleton />
        ) : games.length === 0 ? (
          onboardingCompleted ? (
            <div className="h-full flex items-center justify-center px-6 md:px-12">
              <div className="w-full max-w-2xl liquid-glass-dark rounded-4xl border border-white/10 p-6">
                <h3 className="text-2xl font-semibold mb-2 text-white">
                  Biblioteca vazia
                </h3>
                <p className="text-white/65 text-sm mb-4">
                  Adicione um jogo manualmente ou conecte a Steam para
                  sincronizar sua biblioteca.
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={connectSteam}
                    className="h-11 px-5 rounded-2xl bg-blue-500/25 border border-blue-400/40 text-xs font-bold tracking-wider uppercase hover:bg-blue-500/35 transition-all"
                  >
                    Conectar Steam
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsAddModalOpen(true)}
                    className="h-11 px-5 rounded-2xl bg-white text-black text-xs font-bold tracking-wider uppercase hover:scale-[1.02] transition-all"
                  >
                    Novo Jogo
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <EmptyLibraryOnboarding
              onConnectSteam={connectSteam}
              onOpenAddGame={() => setIsAddModalOpen(true)}
              onComplete={async () => {
                if (!user?.uid) return;
                localStorage.setItem(`checkpoint_onboarding_${user.uid}`, "1");
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
          )
        ) : (
          <>
            <section className="mb-10 px-6 md:px-12">
              <h3 className="text-[10px] font-bold uppercase tracking-[0.4em] text-white/30 mb-5 pl-1">
                Recentes
              </h3>
              {recentGames.length === 0 ? (
                <p className="text-[11px] text-white/40 italic ml-1">
                  Nenhum jogo iniciado recentemente.
                </p>
              ) : (
                <div className="flex gap-2.5 overflow-x-auto no-scrollbar pb-4 -ml-1 pl-1">
                  {recentGames.map((game) => (
                    <motion.button
                      key={game.id}
                      whileHover={{ scale: 1.1, y: -2 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => openDetails(game)}
                      onMouseEnter={() => playSound("navigate")}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        setContextMenu({ x: e.clientX, y: e.clientY, game });
                      }}
                      className="group relative w-12 h-12 rounded-xl overflow-hidden shrink-0 
                                 ring-1 ring-white/10 hover:ring-white/40 shadow-lg transition-all duration-300"
                    >
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity z-10" />
                      <img
                        src={game.cardImage || game.image}
                        alt={game.title}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                        loading="lazy"
                        decoding="async"
                      />
                      {/* Active shadow glow */}
                      <div className="absolute -inset-1 bg-white/5 blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
                    </motion.button>
                  ))}
                </div>
              )}
            </section>

            <div className="px-6 md:px-12 mb-4">
              <div className="h-11 max-w-md rounded-2xl liquid-glass-subtle border border-white/10 px-3 flex items-center gap-2">
                <Search className="w-4 h-4 text-white/55" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Buscar jogo por nome ou categoria..."
                  className="flex-1 bg-transparent text-sm text-white placeholder:text-white/35 outline-none"
                />
              </div>
            </div>

            <CategoryBar
              categories={CATEGORIES}
              activeCategory={activeCategory}
              onCategoryChange={setActiveCategory}
              playSound={playSound}
              disableKeyboardShortcuts={isAnyModalOpen}
            />

            <div className="relative -mt-4">
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.div
                  key={activeCategory}
                  initial={{ opacity: 0, scale: 0.98, filter: "blur(4px)" }}
                  animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                  exit={{ opacity: 0, scale: 0.98, filter: "blur(4px)" }}
                  transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                >
                  {displayGames.length === 0 ? (
                    <div className="px-6 md:px-12 py-10 text-center text-white/65">
                      {searchTerm
                        ? "Nenhum jogo encontrado para esta busca."
                        : "Você não tem jogos adicionados nesta categoria."}
                    </div>
                  ) : (
                    <GameRow
                      games={displayGames}
                      selectedIndex={selectedIndex}
                      onSelect={onSelectHandler}
                      onMouseEnter={() => playSound("navigate")}
                      onContextMenu={(e, game) =>
                        setContextMenu({ x: e.clientX, y: e.clientY, game })
                      }
                      playSound={playSound}
                    />
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          </>
        )}
      </div>

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
        onClose={closeContextMenu}
        onAction={(action) =>
          contextMenu && handleMenuAction(action, contextMenu.game)
        }
        isFavorite={contextMenu?.game.isFavorite}
        playSound={playSound}
      />

      <AddGameModal
        isOpen={isAddModalOpen}
        onClose={closeAddModal}
        onSaved={() => {
          // No manual isLoading(true) here to keep it instant and smooth
        }}
        playSound={playSound}
        gameToEdit={editingGame}
      />

      <AnimatePresence>
        {steamApiKeyModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-160 flex items-center justify-center p-6"
          >
            <div
              className="absolute inset-0 bg-black/70 backdrop-blur-xl"
              onClick={() => {
                playSound("back");
                setSteamApiKeyModalOpen(false);
              }}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 16 }}
              className="relative w-full max-w-xl liquid-glass-dark rounded-4xl border border-white/10 p-6"
            >
              <h3 className="text-xl font-semibold text-white mb-2">
                Cole sua Steam Web API Key
              </h3>
              <p className="text-sm text-white/65 mb-4">
                A página da Steam já foi aberta em outra aba. Depois de
                gerar/copiar a chave, cole aqui para atualizar o backend.
              </p>
              <input
                type="text"
                value={steamApiKeyInput}
                onChange={(e) => setSteamApiKeyInput(e.target.value)}
                placeholder="Ex: 9A8B7C6D5E4F..."
                className="w-full h-11 rounded-xl bg-white/5 border border-white/15 px-4 text-sm text-white outline-none focus:border-blue-400/70"
              />
              <div className="mt-5 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    playSound("back");
                    setSteamApiKeyModalOpen(false);
                  }}
                  onMouseEnter={() => playSound("navigate")}
                  className="h-10 px-4 rounded-xl liquid-glass-subtle text-xs font-bold tracking-wider uppercase"
                >
                  Fechar
                </button>
                <button
                  type="button"
                  onClick={handleSaveSteamApiKey}
                  onMouseEnter={() => playSound("navigate")}
                  disabled={steamApiKeySaving}
                  className="h-10 px-4 rounded-xl bg-white text-black text-xs font-bold tracking-wider uppercase disabled:opacity-60"
                >
                  {steamApiKeySaving ? "Salvando..." : "Salvar API Key"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <ConfirmationModal
        isOpen={signOutModalOpen}
        title="Confirmar saída"
        description="Tem certeza de que deseja sair da sua conta?"
        confirmLabel="Sair"
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
        description="Deseja remover o vínculo da conta Steam deste perfil?"
        confirmLabel="Desconectar"
        onClose={() => setDisconnectSteamModalOpen(false)}
        onConfirm={async () => {
          setDisconnectSteamModalOpen(false);
          await handleDisconnectSteam();
        }}
        playSound={playSound}
      />

      <footer
        className="fixed gap bottom-0 left-0 right-0 z-40 px-6 md:px-12 py-5 flex items-center justify-between"
        style={{
          background:
            "linear-gradient(to top, rgba(5,5,7,0.9), rgba(5,5,7,0.35), transparent)",
        }}
      >
        <p className="text-[10px] text-white/35 tracking-[0.2em] uppercase">
          Biblioteca {games.length} jogos
        </p>
        <div className="flex items-center gap-10">
          <div className="flex items-center gap-3 group">
            <span className="text-xl font-bold text-white/70 group-hover:text-white transition-colors">← →</span>
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">Navegar</span>
          </div>

          <div className="flex items-center gap-3 group">
            <MouseLeft className="w-5 h-5 text-white/70 group-hover:text-white transition-colors" />
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">Escolher</span>
          </div>

          <div className="flex items-center gap-3 group">
            <MouseRight className="w-5 h-5 text-white/70 group-hover:text-white transition-colors" />
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">Opções</span>
          </div>
        </div>
      </footer>

      <AnimatePresence>
        {isExitingSession && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-210 bg-[#050507] flex items-center justify-center"
          >
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center"
            >
              <p className="text-[11px] tracking-[0.35em] uppercase text-white/45 mb-3">
                Checkpoint
              </p>
              <h3 className="text-3xl font-light text-white tracking-wide">
                Encerrando sessão...
              </h3>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const EmptyLibraryOnboarding: React.FC<{
  onConnectSteam: () => void;
  onOpenAddGame: () => void;
  onComplete: () => void | Promise<void>;
  playSound: (type: "select" | "back" | "navigate") => void;
}> = ({ onConnectSteam, onOpenAddGame, onComplete, playSound }) => (
  <div className="h-full flex items-center justify-center px-6 md:px-12">
    <div className="w-full max-w-2xl liquid-glass-dark rounded-4xl border border-white/10 p-6">
      <p className="text-[11px] tracking-[0.25em] text-white/40 uppercase mb-4">
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
          <h3 className="text-2xl font-semibold mb-2 text-white">
            Sua biblioteca está vazia
          </h3>
          <p className="text-white/65 text-sm">
            Você não tem jogos adicionados. Por favor, adicione um jogo
            manualmente ou conecte sua conta Steam.
          </p>
        </Step>
        <Step>
          <h3 className="text-2xl font-semibold mb-2 text-white">
            1. Conecte com a Steam
          </h3>
          <p className="text-white/65 text-sm mb-4">
            Vincule sua conta para importar seus jogos automaticamente.
          </p>
          <button
            type="button"
            onClick={onConnectSteam}
            className="h-11 px-5 rounded-2xl bg-blue-500/25 border border-blue-400/40 text-xs font-bold tracking-wider uppercase
              hover:bg-blue-500/35 transition-all"
          >
            Conectar Steam
          </button>
        </Step>
        <Step>
          <h3 className="text-2xl font-semibold mb-2 text-white">
            2. Adicione manualmente
          </h3>
          <p className="text-white/65 text-sm mb-4">
            Prefere começar rápido? Cadastre seu primeiro jogo manualmente
            agora.
          </p>
          <button
            type="button"
            onClick={() => {
              playSound("select");
              onOpenAddGame();
            }}
            className="h-11 px-5 rounded-2xl bg-white text-black text-xs font-bold tracking-wider uppercase hover:scale-[1.02] transition-all"
          >
            Novo Jogo
          </button>
        </Step>
      </Stepper>
      <p className="mt-4 text-xs text-white/50 flex items-center gap-2">
        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
        Depois da primeira sincronização, seus jogos aparecem automaticamente.
      </p>
    </div>
  </div>
);

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
  <AnimatePresence>
    {isOpen && (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-170 flex items-center justify-center p-6"
      >
        <div
          className="absolute inset-0 bg-black/65 backdrop-blur-xl"
          onClick={() => {
            playSound("back");
            onClose();
          }}
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 14 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 14 }}
          className="relative w-full max-w-md liquid-glass-dark rounded-3xl border border-white/10 p-6"
        >
          <h3 className="text-xl font-semibold text-white mb-2">{title}</h3>
          <p className="text-sm text-white/65">{description}</p>
          <div className="mt-6 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                playSound("back");
                onClose();
              }}
              onMouseEnter={() => playSound("navigate")}
              className="h-10 px-4 rounded-xl liquid-glass-subtle text-xs font-bold tracking-wider uppercase hover:scale-[1.02] active:scale-[0.97] transition-transform"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => {
                playSound("select");
                void onConfirm();
              }}
              onMouseEnter={() => playSound("navigate")}
              className="h-10 px-4 rounded-xl bg-white text-black text-xs font-bold tracking-wider uppercase hover:scale-[1.03] active:scale-[0.97] transition-transform shadow-[0_0_24px_rgba(255,255,255,0.18)]"
            >
              {confirmLabel}
            </button>
          </div>
        </motion.div>
      </motion.div>
    )}
  </AnimatePresence>
);

export default Home;
