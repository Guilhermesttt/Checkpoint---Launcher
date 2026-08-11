import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useProgress } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import * as THREE from "three";

import { RetroBootScene } from "./RetroBootScene";
import { RetroCrtPass } from "../crt/RetroCrtPass";
import stixRegularUrl from "@fontsource/stix-two-text/files/stix-two-text-latin-400-normal.woff";
import stixBoldUrl from "@fontsource/stix-two-text/files/stix-two-text-latin-700-normal.woff";

interface RetroBootScreenProps {
  onReady: () => void;
  onRevealStart?: () => void;
  minimumDuration?: number;
  exitDuration?: number;
}

const BOOT_SEGMENTS = 20;

export function RetroBootScreen({
  onReady,
  onRevealStart,
  minimumDuration = 1800,
  exitDuration = 620,
}: RetroBootScreenProps) {
  const { active, progress, loaded, total } = useProgress();

  // Pre-load font files via THREE.FileLoader so they are tracked by useProgress()
  useEffect(() => {
    const fileLoader = new THREE.FileLoader();
    const ignoreFontPreloadError = () => {};
    const preloadFont = (url: string) => {
      try {
        fileLoader.load(url, () => {}, undefined, ignoreFontPreloadError);
      } catch {
        ignoreFontPreloadError();
      }
    };
    preloadFont(stixRegularUrl);
    preloadFont(stixBoldUrl);
  }, []);
  const [isExiting, setIsExiting] = useState(false);
  const [displayProgress, setDisplayProgress] = useState(0);
  const transitionSignal = useRef(0);
  const visualElapsedRef = useRef(0);
  const revealStartedRef = useRef(false);
  const minimumElapsedRef = useRef(false);
  const exitStartedRef = useRef(false);
  const rawProgress = Math.round(Math.min(100, Math.max(0, progress)));
  const assetsReady = !active && (total === 0 || loaded >= total);
  const assetsReadyRef = useRef(assetsReady);
  const filledSegments = Math.round((displayProgress / 100) * BOOT_SEGMENTS);

  useEffect(() => {
    assetsReadyRef.current = assetsReady;
  }, [assetsReady]);

  const beginExit = useCallback(() => {
    if (exitStartedRef.current) return;
    exitStartedRef.current = true;
    setDisplayProgress(100);
    if (!revealStartedRef.current) {
      revealStartedRef.current = true;
      onRevealStart?.();
    }
    setIsExiting(true);
  }, [onRevealStart]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      minimumElapsedRef.current = true;
      if (assetsReadyRef.current) beginExit();
    }, minimumDuration);
    return () => window.clearTimeout(timer);
  }, [beginExit, minimumDuration]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (minimumElapsedRef.current && assetsReadyRef.current) {
        beginExit();
        return;
      }

      visualElapsedRef.current += 50;
      const timedTarget = Math.min(
        92,
        (visualElapsedRef.current / Math.max(1, minimumDuration)) * 92,
      );
      const loaderTarget = Math.min(92, rawProgress);
      const target = Math.max(timedTarget, loaderTarget);

      setDisplayProgress((current) => {
        if (current >= target) return current;
        return Math.min(
          target,
          current + Math.max(1, Math.ceil((target - current) * 0.22)),
        );
      });
    }, 50);

    return () => window.clearInterval(timer);
  }, [beginExit, minimumDuration, rawProgress]);

  useEffect(() => {
    if (!isExiting) return;
    const timer = window.setTimeout(onReady, exitDuration);
    return () => window.clearTimeout(timer);
  }, [exitDuration, isExiting, onReady]);

  return (
    <section
      className={`retro-boot-overlay retro-mode ${isExiting ? "is-exiting" : ""}`}
      aria-label="Inicializando modo retrô"
      aria-live="polite"
    >
      <div className="retro-boot-monitor">
        <div className="retro-boot-tube">
          <Suspense fallback={null}>
            <Canvas
              className="retro-boot-canvas"
              dpr={[1, 1.5]}
              gl={{ alpha: false, antialias: false, powerPreference: "high-performance" }}
            >
              <RetroBootScene progress={displayProgress} active={!assetsReady} />
              <RetroCrtPass reducedMotion={false} transitionSignal={transitionSignal} />
            </Canvas>
          </Suspense>
        </div>
      </div>
      <div
        className="sr-only"
        role="progressbar"
        aria-label="Carregando recursos do modo retrô"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={displayProgress}
        data-active-segments={filledSegments}
      />
    </section>
  );
}
