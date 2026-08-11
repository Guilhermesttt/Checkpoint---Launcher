const REVEAL_DURATION_MS = 620;

const easeOutExpo = (value: number) =>
  value === 1 ? 1 : 1 - Math.pow(2, -10 * value);

export function sampleRetroLibraryReveal(
  elapsedMs: number,
  delayMs: number,
  reducedMotion: boolean,
) {
  const progress = reducedMotion
    ? 1
    : Math.min(1, Math.max(0, (elapsedMs - delayMs) / REVEAL_DURATION_MS));
  const eased = easeOutExpo(progress);
  const hidden = 1 - eased;

  return {
    progress,
    scale: 0.08 + eased * 0.92,
    y: hidden === 0 ? 0 : -0.72 * hidden,
    z: hidden === 0 ? 0 : -1.4 * hidden,
  };
}
