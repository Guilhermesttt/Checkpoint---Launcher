export interface CrtProfile {
  exposure: number;
  blackLift: number;
  curvature: number;
  chromaticAberration: number;
  scanline: number;
  phosphorMask: number;
  bloom: number;
  noise: number;
  vignette: number;
  flicker: number;
  syncTear: number;
}

export interface RetroTransitionSample {
  signal: number;
  progress: number;
  shouldSwap: boolean;
  active: boolean;
}

export interface RetroTransitionController {
  start(now: number): void;
  sample(now: number): RetroTransitionSample;
  isLocked(now: number): boolean;
}

const STANDARD_CRT_PROFILE: CrtProfile = {
  exposure: 1.25,
  blackLift: 0.018,
  curvature: 0.18,
  chromaticAberration: 0.0024,
  scanline: 0.11,
  phosphorMask: 0.08,
  bloom: 0.2,
  noise: 0.022,
  vignette: 0.26,
  flicker: 0.012,
  syncTear: 0.38,
};

const REDUCED_MOTION_CRT_PROFILE: CrtProfile = {
  ...STANDARD_CRT_PROFILE,
  noise: 0.012,
  flicker: 0,
  syncTear: 0.08,
};

export function getCrtProfile(reducedMotion: boolean): CrtProfile {
  return reducedMotion ? REDUCED_MOTION_CRT_PROFILE : STANDARD_CRT_PROFILE;
}

export function curveCrtUvWithOverscan(
  uv: readonly [number, number],
  curvature: number,
): [number, number] {
  const centeredX = uv[0] * 2 - 1;
  const centeredY = uv[1] * 2 - 1;
  const radius = centeredX * centeredX + centeredY * centeredY;
  const overscan = 1 + curvature * 2.05;
  const curve = (1 + curvature * radius) / overscan;

  return [
    Math.min(1, Math.max(0, centeredX * curve * 0.5 + 0.5)),
    Math.min(1, Math.max(0, centeredY * curve * 0.5 + 0.5)),
  ];
}

export function createRetroTransition(durationMs = 420): RetroTransitionController {
  let startedAt: number | null = null;
  let didSwap = false;

  const getProgress = (now: number) => {
    if (startedAt === null) return 1;
    return Math.min(1, Math.max(0, (now - startedAt) / durationMs));
  };

  return {
    start(now) {
      startedAt = now;
      didSwap = false;
    },

    sample(now) {
      const progress = getProgress(now);
      const active = startedAt !== null && progress < 1;
      const shouldSwap = active && progress >= 0.5 && !didSwap;

      if (shouldSwap) didSwap = true;
      if (!active) startedAt = null;

      return {
        progress,
        active,
        shouldSwap,
        signal: active ? Math.sin(progress * Math.PI) : 0,
      };
    },

    isLocked(now) {
      return startedAt !== null && getProgress(now) < 1;
    },
  };
}
