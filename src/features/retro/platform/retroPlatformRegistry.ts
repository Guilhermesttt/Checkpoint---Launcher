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
    targetWidth: 2.2,
    position: Object.freeze([0, -0.55, 0]) as readonly [number, number, number],
    rotation: Object.freeze([0, 0.28, 0]) as readonly [number, number, number],
    aliases: Object.freeze(["PS1", "PSX", "PLAYSTATION", "PLAYSTATION 1"]),
  }),
  Object.freeze({
    key: "ps2",
    modelUrl: ps2ConsoleUrl,
    targetWidth: 2.4,
    position: Object.freeze([0, -0.65, 0]) as readonly [number, number, number],
    rotation: Object.freeze([0, 0.32, 0]) as readonly [number, number, number],
    aliases: Object.freeze(["PS2", "PLAYSTATION 2"]),
  }),
  Object.freeze({
    key: "snes",
    modelUrl: snesConsoleUrl,
    targetWidth: 2.35,
    position: Object.freeze([0, -0.58, 0]) as readonly [number, number, number],
    rotation: Object.freeze([0, 0.2, 0]) as readonly [number, number, number],
    aliases: Object.freeze(["SNES", "SUPER NINTENDO", "SUPER NES"]),
  }),
  Object.freeze({
    key: "nes",
    modelUrl: nesConsoleUrl,
    targetWidth: 2.3,
    position: Object.freeze([0, -0.6, 0]) as readonly [number, number, number],
    rotation: Object.freeze([0, 0.24, 0]) as readonly [number, number, number],
    aliases: Object.freeze(["NES", "NINTENDO ENTERTAINMENT SYSTEM"]),
  }),
]);

const platformByAlias = new Map(
  retroPlatformDefinitions.flatMap((definition) =>
    definition.aliases.map((alias) => [alias, definition] as const),
  ),
);

export function resolveRetroPlatform(consoleName: string): RetroPlatformDefinition | null {
  const normalizedConsoleName = consoleName.trim().toUpperCase();
  return platformByAlias.get(normalizedConsoleName) ?? null;
}
