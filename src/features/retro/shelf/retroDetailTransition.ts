export const RETRO_DETAIL_TRANSITION_MS = 720;

const FULL_TURN = Math.PI * 2;

const easeOutQuint = (value: number) => 1 - Math.pow(1 - value, 5);

export function getFrontFacingRotation(startRotation: number): number {
  const normalized = ((startRotation % FULL_TURN) + FULL_TURN) % FULL_TURN;
  return startRotation + (FULL_TURN - normalized) + FULL_TURN;
}

export function sampleRetroDetailTransition(
  elapsedMs: number,
  startRotation: number,
) {
  const progress = Math.min(1, Math.max(0, elapsedMs / RETRO_DETAIL_TRANSITION_MS));
  const eased = easeOutQuint(progress);
  const targetRotation = getFrontFacingRotation(startRotation);

  return {
    progress,
    x: 2.12 * eased,
    y: -0.16 * eased,
    z: 0.12 * eased,
    scale: 1 + 0.12 * eased,
    rotationY: startRotation + (targetRotation - startRotation) * eased,
  };
}
