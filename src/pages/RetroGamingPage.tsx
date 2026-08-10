import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  const [showPlay, setShowPlay] = useState(false);
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
      setShowPlay(false);
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
    beginTransition(() => setSelectedIndex(nextIndex));
  }, [beginTransition, filteredGames.length, selectedIndex]);

  const handleNext = useCallback(() => {
    if (filteredGames.length === 0) return;
    const nextIndex = getWrappedIndex(selectedIndex, 1, filteredGames.length);
    beginTransition(() => setSelectedIndex(nextIndex));
  }, [beginTransition, filteredGames.length, selectedIndex]);

  const handleSelect = useCallback(
    (index: number) => {
      if (index === selectedIndex) {
        setShowPlay(true);
        playSound("select");
        return;
      }
      beginTransition(() => setSelectedIndex(index));
    },
    [beginTransition, playSound, selectedIndex],
  );

  const handleFilter = useCallback(
    (filterId: string) => {
      if (filterId === selectedFilter) return;
      beginTransition(() => {
        setSelectedFilter(filterId);
        setSelectedIndex(0);
      });
    },
    [beginTransition, selectedFilter],
  );

  const handlePlay = useCallback(() => {
    if (!activeGame) return;
    setShowPlay(true);
    playSound("select");
  }, [activeGame, playSound]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) return;
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        handlePrevious();
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        handleNext();
      } else if (event.key === "Escape") {
        event.preventDefault();
        handleReturn();
      } else if (event.key === "Enter") {
        event.preventDefault();
        handlePlay();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleNext, handlePlay, handlePrevious, handleReturn]);

  useGamepadButton("DPAD_LEFT", handlePrevious, true, 60);
  useGamepadButton("DPAD_RIGHT", handleNext, true, 60);
  useGamepadButton("X", handlePlay, true, 60);
  useGamepadButton("O", handleReturn, true, 60);

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
            onSelect={handleSelect}
            onActiveHoverChange={setShowPlay}
          />
          <RetroInterface
            activeGame={activeGame}
            filters={RETRO_FILTERS}
            selectedFilter={selectedFilter}
            showPlay={showPlay}
            onReturn={handleReturn}
            onFilter={handleFilter}
            onPrevious={handlePrevious}
            onNext={handleNext}
            onPlay={handlePlay}
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
          onClick={handlePlay}
          onFocus={() => setShowPlay(true)}
          onBlur={() => setShowPlay(false)}
          disabled={!activeGame}
        >
          Jogar jogo selecionado
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
            ? `Jogo selecionado: ${activeGame.title}, ${activeGame.year}, ${activeGame.console}`
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
