export type SpatialDirection = "up" | "down" | "left" | "right";

export interface SpatialRect {
  left: number;
  right: number;
  top: number;
  bottom: number;
  width: number;
  height: number;
}

export interface SpatialCandidate<T> {
  id: T;
  rect: SpatialRect;
}

const overlapsSecondaryAxis = (
  current: SpatialRect,
  candidate: SpatialRect,
  direction: SpatialDirection,
) => direction === "up" || direction === "down"
  ? candidate.right >= current.left && candidate.left <= current.right
  : candidate.bottom >= current.top && candidate.top <= current.bottom;

export const rankSpatialCandidates = <T>(
  current: SpatialRect,
  candidates: SpatialCandidate<T>[],
  direction: SpatialDirection,
) => {
  const currentCenterX = current.left + current.width / 2;
  const currentCenterY = current.top + current.height / 2;
  const threshold = 8;

  return candidates
    .map((candidate, order) => {
      const centerX = candidate.rect.left + candidate.rect.width / 2;
      const centerY = candidate.rect.top + candidate.rect.height / 2;
      const deltaX = centerX - currentCenterX;
      const deltaY = centerY - currentCenterY;
      const primaryDelta = direction === "left" || direction === "right" ? deltaX : deltaY;
      const signedPrimary = direction === "left" || direction === "up" ? -primaryDelta : primaryDelta;
      if (signedPrimary <= threshold) return null;

      const secondaryDistance = direction === "left" || direction === "right"
        ? Math.abs(deltaY)
        : Math.abs(deltaX);
      const secondarySize = direction === "left" || direction === "right"
        ? current.height
        : current.width;
      if (secondaryDistance > signedPrimary * 1.5 + secondarySize) return null;

      return {
        ...candidate,
        order,
        aligned: overlapsSecondaryAxis(current, candidate.rect, direction),
        angle: secondaryDistance / signedPrimary,
        primaryDistance: signedPrimary,
        secondaryDistance,
      };
    })
    .filter((candidate): candidate is NonNullable<typeof candidate> => Boolean(candidate))
    .sort((a, b) =>
      Number(b.aligned) - Number(a.aligned)
      || a.angle - b.angle
      || a.primaryDistance - b.primaryDistance
      || a.secondaryDistance - b.secondaryDistance
      || a.order - b.order,
    );
};

export const findDeclaredSpatialNeighbor = (
  root: HTMLElement,
  current: HTMLElement,
  direction: SpatialDirection,
) => {
  const property = `gamepadNav${direction[0].toUpperCase()}${direction.slice(1)}` as
    | "gamepadNavUp"
    | "gamepadNavDown"
    | "gamepadNavLeft"
    | "gamepadNavRight";
  const targetId = current.dataset[property];
  if (!targetId) return null;
  return Array.from(root.querySelectorAll<HTMLElement>("[data-gamepad-id]"))
    .find((element) => element.dataset.gamepadId === targetId) ?? null;
};
