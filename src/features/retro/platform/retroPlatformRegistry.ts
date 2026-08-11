import nesConsoleUrl from "../../../assets/3D_OBJS/nes_console_and_controller.glb";
import ps1ConsoleUrl from "../../../assets/3D_OBJS/sony_pvm-1341__sony_playstation.glb";
import ps2ConsoleUrl from "../../../assets/3D_OBJS/sony_playstation_2.glb";
import snesConsoleUrl from "../../../assets/3D_OBJS/super_yes.glb";

export type RetroPlatformKey = "ps1" | "ps2" | "snes" | "nes";

export interface RetroPlatformDefinition {
  key: RetroPlatformKey;
  modelUrl: string;
  targetWidth: number;
  position: readonly [number, number, number];
  rotation: readonly [number, number, number];
  aliases: readonly string[];
}

const retroPlatformDefinitions: readonly RetroPlatformDefinition[] = Object.freeze([
  Object.freeze({
    key: "ps1",
    modelUrl: ps1ConsoleUrl,
    targetWidth: 2.6,
    position: Object.freeze([0, 0, 0]) as readonly [number, number, number],
    rotation: Object.freeze([0.35, -0.28, 0]) as readonly [number, number, number],
    aliases: Object.freeze(["PS1", "PSX", "PLAYSTATION", "PLAYSTATION 1", "SONY PLAYSTATION", "SONY PLAYSTATION 1"]),
  }),
  Object.freeze({
    key: "ps2",
    modelUrl: ps2ConsoleUrl,
    targetWidth: 3.2,
    position: Object.freeze([0, 0, 0]) as readonly [number, number, number],
    rotation: Object.freeze([0.38, -0.32, 0]) as readonly [number, number, number],
    aliases: Object.freeze(["PS2", "PLAYSTATION 2", "SONY PLAYSTATION 2", "PLAYSTATION2"]),
  }),
  Object.freeze({
    key: "snes",
    modelUrl: snesConsoleUrl,
    targetWidth: 2.8,
    position: Object.freeze([0, 0, 0]) as readonly [number, number, number],
    rotation: Object.freeze([0.36, -0.25, 0]) as readonly [number, number, number],
    aliases: Object.freeze(["SNES", "SUPER NINTENDO", "SUPER NES", "SUPER NINTENDO ENTERTAINMENT SYSTEM"]),
  }),
  Object.freeze({
    key: "nes",
    modelUrl: nesConsoleUrl,
    targetWidth: 2.8,
    position: Object.freeze([0, 0, 0]) as readonly [number, number, number],
    rotation: Object.freeze([0.36, -0.25, 0]) as readonly [number, number, number],
    aliases: Object.freeze(["NES", "NINTENDO ENTERTAINMENT SYSTEM", "NINTENDO"]),
  }),
]);

const platformByAlias = new Map(
  retroPlatformDefinitions.flatMap((definition) =>
    definition.aliases.map((alias) => [alias, definition] as const),
  ),
);

export function resolveRetroPlatform(consoleName: string): RetroPlatformDefinition | null {
  if (!consoleName || !consoleName.trim()) return null;
  const upper = consoleName.trim().toUpperCase();
  // Exact match
  const exact = platformByAlias.get(upper);
  if (exact) return exact;

  // Fuzzy match (check if console string contains any alias)
  for (const def of retroPlatformDefinitions) {
    if (def.aliases.some((alias) => upper.includes(alias) || alias.includes(upper))) {
      return def;
    }
  }

  // Fallback default: if console name starts with PS or PLAYSTATION, use PS2
  if (upper.includes("PS") || upper.includes("PLAYSTATION")) {
    return platformByAlias.get("PS2") ?? retroPlatformDefinitions[1];
  }

  return null;
}
