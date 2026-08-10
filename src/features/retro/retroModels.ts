export type JvcMeshRole = "display" | "cabinet";
export type DvdCaseNodeRole =
  | "case"
  | "artwork"
  | "plastic"
  | "fingerprint"
  | "disc"
  | "disc-art"
  | "discard"
  | "detail";

export function classifyJvcMesh(materialNames: readonly string[]): JvcMeshRole {
  return materialNames.some((name) => name.toLowerCase() === "display")
    ? "display"
    : "cabinet";
}

export function classifyDvdCaseNode(name: string): DvdCaseNodeRole {
  const normalized = name.toLowerCase();
  if (normalized.includes("camera") || normalized.includes("light"))
    return "discard";
  if (normalized.includes("case_art")) return "artwork";
  if (normalized.includes("case_plastic")) return "case";
  if (normalized.includes("cd art")) return "disc-art";
  if (normalized.includes("cylinder_cd")) return "disc";
  if (normalized.includes("circle_fingerprint")) return "disc";
  if (normalized.includes("fingerprint")) return "fingerprint";
  if (normalized.includes("plastic")) return "plastic";
  return "detail";
}

export function getJvcOverlayScale(
  viewportHeight: number,
  displayHeight: number,
): number {
  if (viewportHeight <= 0 || displayHeight <= 0) return 1;
  return (viewportHeight * 0.78) / displayHeight;
}
