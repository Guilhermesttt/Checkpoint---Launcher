export interface RetroCaseMotionOptions {
  selected: boolean;
  inspected: boolean;
  reducedMotion: boolean;
}

export interface RetroCaseMotion {
  rotationY: number;
  scale: number;
  hingeRotation: number;
  damping: number;
  discVisible: boolean;
  rotateDisc: boolean;
}

export function getRetroCaseMotion({
  selected,
  inspected,
  reducedMotion,
}: RetroCaseMotionOptions): RetroCaseMotion {
  return {
    rotationY: inspected ? 0.08 : selected ? -0.13 : -1.47,
    scale: selected ? 1.28 : 1.04,
    hingeRotation: inspected ? -1.92 : 0,
    damping: reducedMotion ? 18 : 5.5,
    discVisible: inspected,
    rotateDisc: inspected && !reducedMotion,
  };
}
