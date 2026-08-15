import { useCallback, useEffect, useRef, useState } from "react";

import type { LauncherMode } from "../context/PreferencesContext";

export type LauncherTransitionPhase = "idle" | "collapse" | "blind" | "boot";

interface UseLauncherTransitionOptions {
  requestedMode: LauncherMode;
  enabled: boolean;
  collapseDuration?: number;
  blindDuration?: number;
}

interface LauncherTransitionState {
  mountedMode: LauncherMode;
  phase: LauncherTransitionPhase;
  completeBoot: () => void;
}

export function useLauncherTransition({
  requestedMode,
  enabled,
  collapseDuration = 600,
  blindDuration = 800,
}: UseLauncherTransitionOptions): LauncherTransitionState {
  const [mountedMode, setMountedMode] = useState<LauncherMode>(requestedMode);
  const [phase, setPhase] = useState<LauncherTransitionPhase>(
    requestedMode === "retro" ? "boot" : "idle",
  );
  const mountedModeRef = useRef(mountedMode);
  const phaseRef = useRef(phase);

  const updatePhase = useCallback((nextPhase: LauncherTransitionPhase) => {
    phaseRef.current = nextPhase;
    setPhase(nextPhase);
  }, []);

  useEffect(() => {
    if (!enabled) {
      if (mountedModeRef.current !== requestedMode) {
        mountedModeRef.current = requestedMode;
        setMountedMode(requestedMode);
      }
      const nextPhase = requestedMode === "retro" ? "boot" : "idle";
      if (phaseRef.current !== nextPhase) updatePhase(nextPhase);
      return;
    }

    if (requestedMode === mountedModeRef.current) {
      if (phaseRef.current === "collapse" || phaseRef.current === "blind") {
        updatePhase(requestedMode === "retro" ? "boot" : "idle");
      }
      return;
    }

    updatePhase("collapse");
    let blindTimer: number | undefined;
    const collapseTimer = window.setTimeout(() => {
      // The outgoing tree is replaced only after the opaque blind layer exists.
      updatePhase("blind");
      mountedModeRef.current = requestedMode;
      setMountedMode(requestedMode);

      blindTimer = window.setTimeout(() => {
        updatePhase(requestedMode === "retro" ? "boot" : "idle");
      }, blindDuration);
    }, collapseDuration);

    return () => {
      window.clearTimeout(collapseTimer);
      if (blindTimer !== undefined) window.clearTimeout(blindTimer);
    };
  }, [
    blindDuration,
    collapseDuration,
    enabled,
    requestedMode,
    updatePhase,
  ]);

  const completeBoot = useCallback(() => {
    if (phaseRef.current !== "boot" || mountedModeRef.current !== "retro") return;
    updatePhase("idle");
  }, [updatePhase]);

  return { mountedMode, phase, completeBoot };
}
