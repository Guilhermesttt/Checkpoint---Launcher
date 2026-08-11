export interface RetroCaseMotionOptions {
  selected: boolean;
  reducedMotion: boolean;
  isPs2?: boolean;
  is3D?: boolean;
}

export interface RetroCaseMotion {
  rotationY: number;
  scale: number;
  damping: number;
}

export function getRetroCaseMotion({
  selected,
  reducedMotion,
  isPs2,
  is3D,
}: RetroCaseMotionOptions): RetroCaseMotion {
  const is3DModel = isPs2 || is3D;
  const shelfRotation = is3DModel ? Math.PI / 2 : -Math.PI / 2;
  return {
    rotationY: selected ? -0.13 : shelfRotation,
    scale: selected ? 1.28 : 1.04,
    damping: reducedMotion ? 18 : 5.5,
  };
}
