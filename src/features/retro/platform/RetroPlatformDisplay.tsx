import { Suspense } from "react";

import type { RetroGame } from "../shelf/retroCollection";
import type { StudioTunerParams } from "../studio/retroStudioTuner";
import { resolveRetroPlatform } from "./retroPlatformRegistry";
import { RetroPlatformHardware } from "./RetroPlatformHardware";
import { RetroTvScreen } from "./RetroTvScreen";

export interface RetroPlatformDisplayProps {
  game: RetroGame;
  visible: boolean;
  reducedMotion: boolean;
  tunerParams?: StudioTunerParams;
}

export function RetroPlatformDisplay({
  game,
  visible,
  reducedMotion,
  tunerParams,
}: RetroPlatformDisplayProps) {
  const artworkUrl = game.coverImage ?? game.wrapImage;
  const platform = resolveRetroPlatform(game.console);

  const tvX = tunerParams?.tvX ?? 0.1;
  const tvY = tunerParams?.tvY ?? 0.55;
  const tvZ = tunerParams?.tvZ ?? -0.6;

  const consoleX = tunerParams?.consoleX ?? 0.15;
  const consoleY = tunerParams?.consoleY ?? -0.35;
  const consoleZ = tunerParams?.consoleZ ?? 1.2;

  const lightX = tunerParams?.consoleLightX ?? 0.0;
  const lightY = tunerParams?.consoleLightY ?? 2.5;
  const lightZ = tunerParams?.consoleLightZ ?? 3.5;
  const lightIntensity = tunerParams?.consoleLightIntensity ?? 6.5;

  return (
    <group visible={visible}>
      {/* TV CRT — posicionada no centro atrás */}
      <group position={[tvX, tvY, tvZ]}>
        <Suspense fallback={null}>
          <RetroTvScreen
            artworkUrl={artworkUrl}
            reducedMotion={reducedMotion}
          />
        </Suspense>
      </group>

      {/* Console de hardware 3D (PS2, PS1, SNES, NES) — posicionado em destaque na frente da TV */}
      {platform ? (
        <group position={[consoleX, consoleY, consoleZ]}>
          <RetroPlatformHardware
            consoleName={game.console}
            reducedMotion={reducedMotion}
            tunerParams={tunerParams}
          />
          {/* Luzes dedicadas para iluminar a parte superior e frontal do console */}
          <pointLight
            position={[lightX, lightY, lightZ]}
            color="#ffffff"
            intensity={lightIntensity}
            distance={10}
            decay={1.2}
          />
          <directionalLight
            position={[1, 3, 2]}
            color="#d0e0ff"
            intensity={2.2}
          />
        </group>
      ) : null}

      {/* Luz de brilho da tela da TV */}
      <pointLight
        data-testid="retro-tv-bloom-light"
        position={[tvX, tvY, tvZ + 1.8]}
        color="#fcf1d4"
        intensity={2.8}
        distance={6.5}
        decay={2}
      />
    </group>
  );
}

