import { Suspense, useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { OrthographicCamera } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { useReducedMotion } from "framer-motion";

import { useGamepadButton } from "../context/GamepadContext";
import { usePreferences } from "../context/PreferencesContext";
import { useSoundEffects } from "../hooks/useSoundEffects";
import { RetroCrtPass } from "../features/retro/RetroCrtPass";
import { RetroInterface } from "../features/retro/RetroInterface";
import { RetroShelf } from "../features/retro/RetroShelf";
import {
  RETRO_COLLECTION,
  RETRO_FILTERS,
  filterRetroGames,
  getWrappedIndex,
} from "../features/retro/retroCollection";
import { createRetroTransition } from "../features/retro/retroCrt";
import {
  INITIAL_RETRO_INSPECTION_STATE,
  reduceRetroInspection,
} from "../features/retro/retroInspection";

interface RetroGamingPageProps {
  onReturnToStandard?: () => void;
}

export const RetroGamingPage = ({ onReturnToStandard }: RetroGamingPageProps) => {
  const { toggleLauncherMode, effectsVolume, soundTheme, notificationVolume } = usePreferences();
  const { playSound } = useSoundEffects(
    effectsVolume / 100,
    soundTheme,
    notificationVolume / 100,
  );
  const prefersReducedMotion = Boolean(useReducedMotion());

  const [selectedFilter, setSelectedFilter] = useState("ALL");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [inspection, dispatchInspection] = useReducer(
    reduceRetroInspection,
    INITIAL_RETRO_INSPECTION_STATE,
  );
  const [webglUnavailable, setWebglUnavailable] = useState(false);
  const transitionSignal = useRef(0);
  const transition = useRef(createRetroTransition(prefersReducedMotion ? 240 : 420));
  const transitionFrame = useRef<number | null>(null);

  const filteredGames = useMemo(
    () => filterRetroGames(RETRO_COLLECTION, selectedFilter),
    [selectedFilter],
  );
  const activeGame = filteredGames[selectedIndex];

  useEffect(() => {
    transition.current = createRetroTransition(prefersReducedMotion ? 240 : 420);
    transitionSignal.current = 0;
  }, [prefersReducedMotion]);

  useEffect(
    () => () => {
      if (transitionFrame.current !== null) cancelAnimationFrame(transitionFrame.current);
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
    if (filteredGames.length === 0) return;
    const nextIndex = getWrappedIndex(selectedIndex, -1, filteredGames.length);
    if (beginTransition(() => setSelectedIndex(nextIndex))) {
      dispatchInspection({ type: "SELECT" });
    }
  }, [beginTransition, filteredGames.length, selectedIndex]);

  const handleNext = useCallback(() => {
    if (filteredGames.length === 0) return;
    const nextIndex = getWrappedIndex(selectedIndex, 1, filteredGames.length);
    if (beginTransition(() => setSelectedIndex(nextIndex))) {
      dispatchInspection({ type: "SELECT" });
    }
  }, [beginTransition, filteredGames.length, selectedIndex]);

  const handleConfirm = useCallback(() => {
    if (!activeGame) return;
    dispatchInspection({ type: "CONFIRM", index: selectedIndex });
    playSound("select");
  }, [activeGame, playSound, selectedIndex]);

  const handleSelect = useCallback(
    (index: number) => {
      if (index === selectedIndex) {
        handleConfirm();
        return;
      }
      if (beginTransition(() => setSelectedIndex(index))) {
        dispatchInspection({ type: "SELECT" });
      }
    },
    [beginTransition, handleConfirm, selectedIndex],
  );

  const handleFilter = useCallback(
    (filterId: string) => {
      if (filterId === selectedFilter) return;
      if (beginTransition(() => {
        setSelectedFilter(filterId);
        setSelectedIndex(0);
      })) {
        dispatchInspection({ type: "SELECT" });
      }
    },
    [beginTransition, selectedFilter],
  );

  const handleCancel = useCallback(() => {
    if (inspection.inspectedIndex !== null) {
      dispatchInspection({ type: "CANCEL" });
      playSound("back");
      return;
    }
    handleReturn();
  }, [handleReturn, inspection.inspectedIndex, playSound]);

  useEffect(() => {
    if (!inspection.playRequested) return;
    dispatchInspection({ type: "PLAY_HANDLED" });
  }, [inspection.playRequested]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) return;
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        handlePrevious();
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        handleNext();
      } else if (event.key === "Escape" || event.key === "Backspace") {
        event.preventDefault();
        handleCancel();
      } else if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        handleConfirm();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleCancel, handleConfirm, handleNext, handlePrevious]);

  useGamepadButton("DPAD_LEFT", handlePrevious, true, 60);
  useGamepadButton("DPAD_RIGHT", handleNext, true, 60);
  useGamepadButton("X", handleConfirm, true, 60);
  useGamepadButton("O", handleCancel, true, 60);

  return (
    <main
      className="relative h-screen w-full overflow-hidden bg-[#171615] text-[#eee9dd]"
      aria-label="Acervo de jogos retrô"
      data-system-page
    >
      <Suspense fallback={null}>
        <Canvas
          dpr={[1, 1.5]}
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
            canvas.addEventListener("webglcontextrestored", () => setWebglUnavailable(false));
          }}
        >
          <color attach="background" args={["#171615"]} />
          <OrthographicCamera makeDefault position={[0, 0, 10]} zoom={118} near={0.1} far={30} />
          <ambientLight intensity={1.65} />
          <directionalLight
            castShadow
            position={[3.8, 5.8, 6]}
            intensity={2.15}
            shadow-mapSize-width={1024}
            shadow-mapSize-height={1024}
          />
          <pointLight position={[-4, 0.5, 4]} color="#b52322" intensity={0.75} />
          <pointLight position={[4, 2, 5]} color="#eee9dd" intensity={0.5} />

          <RetroShelf
            games={filteredGames}
            selectedIndex={selectedIndex}
            inspectedIndex={inspection.inspectedIndex}
            reducedMotion={prefersReducedMotion}
            onSelect={handleSelect}
          />
          <RetroInterface
            activeGame={activeGame}
            filters={RETRO_FILTERS}
            selectedFilter={selectedFilter}
            inspectionOpen={inspection.inspectedIndex === selectedIndex}
            onReturn={handleReturn}
            onFilter={handleFilter}
            onPrevious={handlePrevious}
            onNext={handleNext}
            onPrimaryAction={handleConfirm}
          />
          <RetroCrtPass
            reducedMotion={prefersReducedMotion}
            transitionSignal={transitionSignal}
          />
        </Canvas>
      </Suspense>

      <section className="sr-only" aria-label="Controles do acervo retrô">
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
        <button type="button" onClick={handlePrevious} disabled={filteredGames.length === 0}>
          Jogo anterior
        </button>
        <button
          type="button"
          onClick={handleConfirm}
          disabled={!activeGame}
        >
          {inspection.inspectedIndex === selectedIndex
            ? "Jogar jogo selecionado"
            : "Abrir caixa do jogo selecionado"}
        </button>
        <button type="button" onClick={handleNext} disabled={filteredGames.length === 0}>
          Próximo jogo
        </button>
        <div role="list" aria-label="Jogos no filtro atual">
          {filteredGames.map((game, index) => (
            <button
              key={game.id}
              type="button"
              role="listitem"
              aria-current={index === selectedIndex ? "true" : undefined}
              onClick={() => handleSelect(index)}
            >
              {game.title}, {game.year}, {game.console}
            </button>
          ))}
        </div>
        <p role="status" aria-live="polite">
          {activeGame
            ? inspection.inspectedIndex === selectedIndex
              ? `Caixa aberta: ${activeGame.title}, ${activeGame.year}, ${activeGame.console}`
              : `Jogo selecionado: ${activeGame.title}, ${activeGame.year}, ${activeGame.console}`
            : "Nenhum jogo encontrado nesta década"}
        </p>
      </section>

      {webglUnavailable && (
        <div className="absolute inset-0 z-10 grid place-items-center bg-[#171615] px-8 text-center">
          <p className="max-w-md font-mono text-sm tracking-wide text-[#ddd8ca]">
            O sinal da TV foi interrompido. A cena será restaurada assim que o contexto gráfico
            estiver disponível.
          </p>
        </div>
      )}
    </main>
  );
};

export default RetroGamingPage;
