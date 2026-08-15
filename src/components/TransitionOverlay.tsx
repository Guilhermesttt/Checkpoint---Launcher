import type { ReactNode } from "react";

import type { LauncherTransitionPhase } from "../hooks/useLauncherTransition";

interface TransitionOverlayProps {
  children: ReactNode;
  phase: LauncherTransitionPhase;
  bootProgress?: number;
}

export function TransitionOverlay({
  children,
  phase,
  bootProgress = 0,
}: TransitionOverlayProps) {
  const normalizedProgress = Math.round(Math.min(100, Math.max(0, bootProgress)));

  return (
    <div className="launcher-transition-root" data-transition-phase={phase}>
      <div
        data-testid="launcher-mode-stage"
        className={`launcher-mode-stage ${phase === "collapse" ? "is-crt-collapsing" : ""}`}
      >
        {children}
      </div>

      <div
        data-testid="launcher-transition-overlay"
        className={`launcher-transition-overlay is-${phase}`}
        aria-hidden="true"
      >
        <div className="launcher-transition-blackout" />
        <div className="launcher-transition-noise" />
        <div className="launcher-transition-scan" />
        <div className="launcher-transition-flare" />
      </div>

      {phase === "boot" ? (
        <div
          className="sr-only"
          role="progressbar"
          aria-label="Inicializando modo retro"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={normalizedProgress}
        />
      ) : null}
    </div>
  );
}
