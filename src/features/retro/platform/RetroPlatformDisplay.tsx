import { Suspense } from "react";

import type { RetroGame } from "../shelf/retroCollection";
import { resolveRetroPlatform } from "./retroPlatformRegistry";
import { RetroPlatformHardware } from "./RetroPlatformHardware";
import { RetroTvScreen } from "./RetroTvScreen";

export interface RetroPlatformDisplayProps {
  game: RetroGame;
  visible: boolean;
  reducedMotion: boolean;
}

export function RetroPlatformDisplay({
  game,
  visible,
  reducedMotion,
}: RetroPlatformDisplayProps) {
  const artworkUrl = game.coverImage ?? game.wrapImage;
  const platform = resolveRetroPlatform(game.console);

  return (
    <group visible={visible}>
      {/* TV CRT — posicionada no centro atrás (X = 0.1, Y = 0.55, Z = -0.6) */}
      <group position={[0.1, 0.55, -0.6]}>
        <Suspense fallback={null}>
          <RetroTvScreen
            artworkUrl={artworkUrl}
            reducedMotion={reducedMotion}
          />
        </Suspense>
      </group>

      {/* Console de hardware 3D (PS2, PS1, SNES, NES) — posicionado em destaque na frente da TV (X = 0.15, Y = -0.75, Z = 0.8) */}
      {platform ? (
        <group position={[0.15, -0.75, 0.8]}>
          <RetroPlatformHardware
            consoleName={game.console}
            reducedMotion={reducedMotion}
          />
          {/* Luzes dedicadas para iluminar a parte superior e frontal do console */}
          <pointLight
            position={[0, 2.5, 3.0]}
            color="#ffffff"
            intensity={5.0}
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
        position={[0.1, 0.55, 1.2]}
        color="#fcf1d4"
        intensity={2.8}
        distance={6.5}
        decay={2}
      />
    </group>
  );
}

