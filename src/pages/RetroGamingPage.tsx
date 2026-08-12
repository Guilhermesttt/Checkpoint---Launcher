import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { CSSProperties } from "react";
import { OrthographicCamera } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { useReducedMotion } from "framer-motion";

import { useGamepadButton } from "../context/GamepadContext";
import { usePreferences } from "../context/PreferencesContext";
import { useAuth } from "../auth/AuthProvider";
import { useSoundEffects } from "../hooks/useSoundEffects";
import { RetroBootScreen } from "../features/retro/boot/RetroBootScreen";
import { RetroCrtPass } from "../features/retro/crt/RetroCrtPass";
import { RETRO_TV_CURVE } from "../features/retro/crt/retroViewport";
import { RetroInterface } from "../features/retro/components/RetroInterface";
import { RetroPlatformDisplay } from "../features/retro/platform/RetroPlatformDisplay";
import { RetroShelf } from "../features/retro/shelf/RetroShelf";
import {
  RETRO_COLLECTION,
  RETRO_FILTERS,
  filterRetroGames,
  getWrappedIndex,
} from "../features/retro/shelf/retroCollection";
import { createRetroTransition } from "../features/retro/crt/retroCrt";
import { RETRO_DETAIL_TRANSITION_MS } from "../features/retro/shelf/retroDetailTransition";
import { requestSettingsConnections } from "../services/launcherNavigation";

import { RetroAddGameModal } from "../features/retro/components/RetroAddGameModal";
import { RetroGameDetailsScreen } from "../features/retro/components/RetroGameDetailsScreen";
import type { RetroGame } from "../features/retro/shelf/retroCollection";
import {
  DEFAULT_STUDIO_TUNER_PARAMS,
  type StudioTunerParams,
} from "../features/retro/studio/retroStudioTuner";
import { RetroStudioTunerPanel } from "../features/retro/studio/RetroStudioTunerPanel";

interface RetroGamingPageProps {
  onReturnToStandard?: () => void;
  transitionComplete?: boolean;
}

const LOCAL_STORAGE_CUSTOM_GAMES_KEY = "checkpoint_retro_custom_games";
const LOCAL_STORAGE_HIDDEN_GAMES_KEY = "checkpoint_retro_hidden_game_ids";
const retroViewportStyle: CSSProperties & { "--retro-tv-curve": string } = {
  "--retro-tv-curve": RETRO_TV_CURVE,
};

export const RetroGamingPage = ({
  onReturnToStandard,
  transitionComplete = true,
}: RetroGamingPageProps) => {
  const { toggleLauncherMode, effectsVolume, soundTheme, notificationVolume } =
    usePreferences();
  const { user } = useAuth();
  const { playSound } = useSoundEffects(
    effectsVolume / 100,
    soundTheme,
    notificationVolume / 100,
  );
  const prefersReducedMotion = Boolean(useReducedMotion());

  const [customGames, setCustomGames] = useState<RetroGame[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_CUSTOM_GAMES_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [hiddenGameIds, setHiddenGameIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_HIDDEN_GAMES_KEY);
      const parsed: unknown = saved ? JSON.parse(saved) : [];
      return Array.isArray(parsed)
        ? parsed.filter((id): id is string => typeof id === "string")
        : [];
    } catch {
      return [];
    }
  });

  const [selectedFilter, setSelectedFilter] = useState("ALL");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [view, setView] = useState<"library" | "opening-details" | "details">("library");
  const [webglUnavailable, setWebglUnavailable] = useState(false);
  const [isBooting, setIsBooting] = useState(true);
  const [libraryRevealed, setLibraryRevealed] = useState(false);

  // Estados do cadastro/edição e da tela de detalhes.
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [gameToEdit, setGameToEdit] = useState<RetroGame | null>(null);
  const selectedCaseButtonRef = useRef<HTMLButtonElement>(null);
  const [tunerParams, setTunerParams] = useState<StudioTunerParams>(() => {
    try {
      const savedCrt = localStorage.getItem("checkpoint_retro_crt_enabled");
      if (savedCrt !== null) {
        return { ...DEFAULT_STUDIO_TUNER_PARAMS, crtEnabled: savedCrt === "true" };
      }
    } catch {
      // ignore
    }
    return DEFAULT_STUDIO_TUNER_PARAMS;
  });

  const handleTunerChange = useCallback((newParams: StudioTunerParams) => {
    setTunerParams(newParams);
    try {
      localStorage.setItem("checkpoint_retro_crt_enabled", String(newParams.crtEnabled));
    } catch {
      // ignore
    }
  }, []);

  const transitionSignal = useRef(0);
  const transition = useRef(
    createRetroTransition(prefersReducedMotion ? 240 : 420),
  );
  const transitionFrame = useRef<number | null>(null);
  const detailTransitionTimer = useRef<number | null>(null);

  // Coleção completa (Original + Adicionados pelo Usuário)
  const fullCollection = useMemo(() => {
    const gamesById = new Map(RETRO_COLLECTION.map((game) => [game.id, game]));
    customGames.forEach((game) => gamesById.set(game.id, game));
    return [...gamesById.values()].filter((game) => !hiddenGameIds.includes(game.id));
  }, [customGames, hiddenGameIds]);

  const filteredGames = useMemo(
    () => filterRetroGames(fullCollection, selectedFilter),
    [fullCollection, selectedFilter],
  );

  // Garante índice válido e seguro de forma puramente determinística na renderização
  const safeSelectedIndex =
    filteredGames.length > 0
      ? Math.min(selectedIndex, filteredGames.length - 1)
      : 0;

  const activeGame = filteredGames[safeSelectedIndex];

  // Salvar novo jogo ou alterações
  const handleSaveGame = useCallback((savedGame: RetroGame) => {
    setCustomGames((prev) => {
      const existsIndex = prev.findIndex((g) => g.id === savedGame.id);
      let updated: RetroGame[];
      if (existsIndex >= 0) {
        updated = [...prev];
        updated[existsIndex] = savedGame;
      } else {
        updated = [...prev, savedGame];
      }
      try {
        localStorage.setItem(
          LOCAL_STORAGE_CUSTOM_GAMES_KEY,
          JSON.stringify(updated),
        );
      } catch {
        console.error("Erro ao salvar jogo no localStorage");
      }
      return updated;
    });
  }, []);

  const handleDeleteGame = useCallback((game: RetroGame) => {
    setCustomGames((previousGames) => {
      const updatedGames = previousGames.filter((candidate) => candidate.id !== game.id);
      try {
        localStorage.setItem(LOCAL_STORAGE_CUSTOM_GAMES_KEY, JSON.stringify(updatedGames));
      } catch {
        console.error("Erro ao excluir jogo do localStorage");
      }
      return updatedGames;
    });
    setHiddenGameIds((previousIds) => {
      const updatedIds = previousIds.includes(game.id)
        ? previousIds
        : [...previousIds, game.id];
      try {
        localStorage.setItem(LOCAL_STORAGE_HIDDEN_GAMES_KEY, JSON.stringify(updatedIds));
      } catch {
        console.error("Erro ao ocultar jogo no localStorage");
      }
      return updatedIds;
    });
    setSelectedIndex(0);
    setView("library");
  }, []);

  useEffect(() => {
    transition.current = createRetroTransition(
      prefersReducedMotion ? 240 : 420,
    );
    transitionSignal.current = 0;
  }, [prefersReducedMotion]);

  useEffect(
    () => () => {
      if (transitionFrame.current !== null)
        cancelAnimationFrame(transitionFrame.current);
      if (detailTransitionTimer.current !== null)
        window.clearTimeout(detailTransitionTimer.current);
      document.body.style.cursor = "default";
    },
    [],
  );

  const beginTransition = useCallback(
    (swapSelection: () => void) => {
      const now = performance.now();
      if (transition.current.isLocked(now)) return false;

      transition.current.start(now);
      playSound("navigate");

      const tick = (frameNow: number) => {
        const sample = transition.current.sample(frameNow);
        transitionSignal.current = sample.signal;
        if (sample.shouldSwap) swapSelection();
        if (sample.active) {
          transitionFrame.current = requestAnimationFrame(tick);
        } else {
          transitionSignal.current = 0;
          transitionFrame.current = null;
        }
      };

      transitionFrame.current = requestAnimationFrame(tick);
      return true;
    },
    [playSound],
  );

  const handleReturn = useCallback(() => {
    playSound("back");
    if (onReturnToStandard) onReturnToStandard();
    else toggleLauncherMode();
  }, [onReturnToStandard, playSound, toggleLauncherMode]);

  const handlePrevious = useCallback(() => {
    if (view !== "library") return;
    if (filteredGames.length === 0) return;
    const nextIndex = getWrappedIndex(safeSelectedIndex, -1, filteredGames.length);
    beginTransition(() => setSelectedIndex(nextIndex));
  }, [beginTransition, filteredGames.length, safeSelectedIndex, view]);

  const handleNext = useCallback(() => {
    if (view !== "library") return;
    if (filteredGames.length === 0) return;
    const nextIndex = getWrappedIndex(safeSelectedIndex, 1, filteredGames.length);
    beginTransition(() => setSelectedIndex(nextIndex));
  }, [beginTransition, filteredGames.length, safeSelectedIndex, view]);

  const handleConfirm = useCallback(() => {
    if (!activeGame || view !== "library") return;
    setView("opening-details");
    playSound("detailOpen");
    detailTransitionTimer.current = window.setTimeout(() => {
      setView("details");
      detailTransitionTimer.current = null;
    }, RETRO_DETAIL_TRANSITION_MS);
  }, [activeGame, playSound, view]);

  const handleBootReady = useCallback(() => setIsBooting(false), []);
  const handleBootRevealStart = useCallback(() => setLibraryRevealed(true), []);

  const handleSelect = useCallback(
    (index: number) => {
      if (index === safeSelectedIndex) {
        handleConfirm();
        return;
      }
      beginTransition(() => setSelectedIndex(index));
    },
    [beginTransition, handleConfirm, safeSelectedIndex],
  );

  const handleFilter = useCallback(
    (filterId: string) => {
      if (filterId === selectedFilter) return;
      if (
        beginTransition(() => {
          setSelectedFilter(filterId);
          setSelectedIndex(0);
        })
      )
        return;
    },
    [beginTransition, selectedFilter],
  );

  const handleCancel = useCallback(() => {
    if (view !== "library") {
      if (detailTransitionTimer.current !== null) {
        window.clearTimeout(detailTransitionTimer.current);
        detailTransitionTimer.current = null;
      }
      setView("library");
      playSound("back");
      return;
    }
    handleReturn();
  }, [handleReturn, playSound, view]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) return;
      const target = event.target;
      if (target instanceof Element && target.matches("input, textarea, select, [contenteditable='true']")) return;
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        handlePrevious();
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        handleNext();
      } else if (event.key === "Escape" || event.key === "Backspace") {
        event.preventDefault();
        handleCancel();
      } else if (view === "library" && (event.key === "Enter" || event.key === " ")) {
        event.preventDefault();
        handleConfirm();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleCancel, handleConfirm, handleNext, handlePrevious, view]);

  useGamepadButton("DPAD_LEFT", handlePrevious, !isBooting, 60);
  useGamepadButton("DPAD_RIGHT", handleNext, !isBooting, 60);
  useGamepadButton("X", handleConfirm, !isBooting, 60);
  useGamepadButton("O", handleCancel, !isBooting, 60);

  return (
    <div className="retro-tv-container">
      <main
        className="retro-tv-viewport retro-mode font-arquivoBlack relative overflow-hidden bg-[#303030] text-[#eee9dd]"
        style={retroViewportStyle}
        aria-label="Acervo de jogos retrô"
        aria-busy={isBooting}
        data-system-page
      >
        <div
          data-testid="retro-crt-screen"
          className="retro-crt-screen"
        >
          {transitionComplete && (
            <Suspense fallback={null}>
              <Canvas
                dpr={[1, 1.5]}
                frameloop="always"
                shadows
                gl={{
                  alpha: false,
                  antialias: false,
                  powerPreference: "high-performance",
                }}
                onCreated={({ gl }) => {
                  const canvas = gl.domElement;
                  canvas.setAttribute("aria-hidden", "true");
                  canvas.addEventListener("webglcontextlost", (event) => {
                    event.preventDefault();
                    setWebglUnavailable(true);
                  });
                  canvas.addEventListener("webglcontextrestored", () =>
                    setWebglUnavailable(false),
                  );
                }}
              >
                <color attach="background" args={[view === "library" ? "#303030" : "#09090a"]} />
                <OrthographicCamera
                  makeDefault
                  position={[0, 0, 20]}
                  zoom={100}
                  near={0.1}
                  far={50}
                />
                {/* Luz ambiente: configurável ao vivo pelo Estúdio 3D */}
                <ambientLight intensity={view === "library" ? 0.9 : tunerParams.ambientIntensity} />

                {/* Luz direcional principal — vem de cima-frente para iluminar TV e console */}
                <directionalLight
                  castShadow
                  position={view === "library" ? [3.8, 5.8, 6] : [tunerParams.dirLightX, tunerParams.dirLightY, tunerParams.dirLightZ]}
                  color={view === "library" ? "#ffffff" : "#ccd8f0"}
                  intensity={view === "library" ? 2.15 : tunerParams.dirLightIntensity}
                  shadow-mapSize-width={1024}
                  shadow-mapSize-height={1024}
                />

                <directionalLight
                  visible={view !== "library"}
                  position={[-3, 2, 3]}
                  color="#e8d5b0"
                  intensity={1.0}
                />

                <pointLight
                  position={view === "library" ? [-4, 0.5, 4] : [-2, -0.5, 2]}
                  color={view === "library" ? "#b52322" : "#c8702a"}
                  intensity={view === "library" ? 0.5 : 0.7}
                  distance={12}
                />

                <pointLight
                  position={view === "library" ? [4, 2, 5] : [1.5, 1.5, 4]}
                  color={view === "library" ? "#eee9dd" : "#b0c8e8"}
                  intensity={view === "library" ? 0.35 : 0.6}
                  distance={12}
                />

                {activeGame && (
                  <RetroPlatformDisplay
                    game={activeGame}
                    visible={view !== "library"}
                    reducedMotion={prefersReducedMotion}
                    tunerParams={tunerParams}
                  />
                )}
                <RetroShelf
                  games={filteredGames}
                  selectedIndex={safeSelectedIndex}
                  reducedMotion={prefersReducedMotion}
                  detailMode={view !== "library"}
                  revealed={libraryRevealed}
                  onSelect={handleSelect}
                />
                {view === "library" && (
                  <RetroInterface
                    activeGame={activeGame}
                    filters={RETRO_FILTERS}
                    selectedFilter={selectedFilter}
                    onReturn={handleReturn}
                    onFilter={handleFilter}
                    onPrevious={handlePrevious}
                    onNext={handleNext}
                    onPrimaryAction={handleConfirm}
                    onAddGame={() => {
                      playSound("showModal");
                      setGameToEdit(null);
                      setIsAddModalOpen(true);
                    }}
                  />
                )}
                <RetroCrtPass
                  reducedMotion={prefersReducedMotion}
                  transitionSignal={transitionSignal}
                  enabled={tunerParams.crtEnabled}
                />
              </Canvas>
            </Suspense>
          )}
        </div>
        {tunerParams.crtEnabled && (
          <>
            <div
              data-testid="retro-crt-glass"
              aria-hidden="true"
              className="retro-crt-glass"
            />
            <div
              data-testid="retro-crt-bezel"
              aria-hidden="true"
              className="retro-crt-bezel"
            />
          </>
        )}

        {isBooting && (
          <RetroBootScreen
            onRevealStart={handleBootRevealStart}
            onReady={handleBootReady}
            minimumDuration={3500}
          />
        )}

        {/* Painel de Controles de Estúdio 3D (Luzes e Posição de Objetos) */}
        <RetroStudioTunerPanel
          params={tunerParams}
          onChange={handleTunerChange}
          onReset={() => handleTunerChange(DEFAULT_STUDIO_TUNER_PARAMS)}
        />

        {/* Modais de Cadastro/Edição e Painel de Detalhes Retrô */}
        <RetroAddGameModal
          isOpen={isAddModalOpen}
          onClose={() => {
            setIsAddModalOpen(false);
            setGameToEdit(null);
          }}
          playSound={playSound}
          gameToEdit={gameToEdit}
          onSaveGame={handleSaveGame}
          onDeleteGame={handleDeleteGame}
        />

        {activeGame && (
          <Suspense fallback={null}>
            <RetroGameDetailsScreen
              game={activeGame}
              isOpen={view === "details"}
              onClose={() => setView("library")}
              playSound={playSound}
              restoreFocusRef={selectedCaseButtonRef}
              onOpenSettingsConnections={() => {
                if (user?.uid) requestSettingsConnections(user.uid);
                setView("library");
                handleReturn();
              }}
              onEditGame={(game) => {
                setView("library");
                setGameToEdit(game);
                setIsAddModalOpen(true);
              }}
            />
          </Suspense>
        )}

        <section className="sr-only" aria-label="Controles do acervo retrô">
          {view === "details" ? (
            <>
              <button type="button" onClick={handleCancel}>
                Voltar ao acervo
              </button>
              <p role="status" aria-live="polite">
                Detalhes de {activeGame?.title}
              </p>
            </>
          ) : (
            <>
              <button type="button" onClick={handleReturn}>
                Voltar ao launcher
              </button>
              <div role="group" aria-label="Filtros por década">
                {RETRO_FILTERS.map((filter) => (
                  <button
                    key={filter.id}
                    type="button"
                    aria-pressed={selectedFilter === filter.id}
                    onClick={() => handleFilter(filter.id)}
                  >
                    {filter.id === "ALL"
                      ? "Filtrar todos os jogos"
                      : `Filtrar anos ${filter.startYear}`}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={handlePrevious}
                disabled={filteredGames.length === 0}
              >
                Jogo anterior
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={!activeGame}
              >
                Abrir detalhes do jogo selecionado
              </button>
              <button
                type="button"
                onClick={handleNext}
                disabled={filteredGames.length === 0}
              >
                Próximo jogo
              </button>
              <div role="list" aria-label="Jogos no filtro atual">
                {filteredGames.map((game, index) => (
                  <div key={game.id} role="listitem">
                    <button
                      ref={index === safeSelectedIndex ? selectedCaseButtonRef : undefined}
                      type="button"
                      aria-current={index === safeSelectedIndex ? "true" : undefined}
                      onClick={() => handleSelect(index)}
                    >
                      {game.title}, {game.year}, {game.console}
                    </button>
                  </div>
                ))}
              </div>
              <p role="status" aria-live="polite">
                {activeGame
                  ? `Jogo selecionado: ${activeGame.title}, ${activeGame.year}, ${activeGame.console}`
                  : "Nenhum jogo encontrado nesta década"}
              </p>
            </>
          )}
        </section>

        {webglUnavailable && (
          <div className="absolute inset-0 z-10 grid place-items-center bg-[#757575] px-8 text-center">
            {/* A classe 'font-mono' foi removida do <p> abaixo */}
            <p className="max-w-md text-sm tracking-wide text-[#ddd8ca]">
              O sinal da TV foi interrompido. A cena será restaurada assim que o
              contexto gráfico estiver disponível.
            </p>
          </div>
        )}
      </main>
      <div className="retro-tv-bezel-overlay" aria-hidden="true" />
    </div>
  );
};

export default RetroGamingPage;
