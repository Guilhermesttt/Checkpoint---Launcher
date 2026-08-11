import { Suspense } from "react";

import type { RetroGame } from "../shelf/retroCollection";
import { resolveRetroPlatform } from "./retroPlatformRegistry";
import { RetroPlatformHardware } from "./RetroPlatformHardware";
import { RetroPlatformModelBoundary } from "./RetroPlatformModelBoundary";
import { RetroPvmTelevision } from "./RetroPvmTelevision";

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
      {/* TV PVM — à direita e levemente recuada */}
      <RetroPlatformModelBoundary resetKey={`pvm:${artworkUrl ?? "dark"}`}>
        <Suspense fallback={null}>
          <RetroPvmTelevision
            artworkUrl={artworkUrl}
            reducedMotion={reducedMotion}
          />
        </Suspense>
      </RetroPlatformModelBoundary>

      {/* Console de hardware — à esquerda e levemente à frente, na cena */}
      {platform ? (
        <group position={[-1.1, 0, 0.6]}>
          <RetroPlatformHardware
            consoleName={game.console}
            reducedMotion={reducedMotion}
          />
          {/* Luz dedicada para iluminar o hardware do console */}
          <pointLight
            position={[0, 2.5, 2.5]}
            color="#d0c8b8"
            intensity={4.0}
            distance={8}
            decay={1.5}
          />
          <pointLight
            position={[2, 0.5, 1.5]}
            color="#8ba6d6"
            intensity={2.5}
            distance={6}
            decay={1.5}
          />
        </group>
      ) : null}

      {/* Luz de brilho da tela da TV */}
      <pointLight
        data-testid="retro-tv-bloom-light"
        position={[1.15, 0.25, 2.25]}
        color="#fcf1d4"
        intensity={2.4}
        distance={6.5}
        decay={2}
      />
    </group>
  );
}
