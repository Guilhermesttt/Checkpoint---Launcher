import { ContactShadows } from "@react-three/drei";

import { getCircularOffset, type RetroGame } from "./retroCollection";
import { RetroGameCase } from "./RetroGameCase";

interface RetroShelfProps {
  games: RetroGame[];
  selectedIndex: number;
  reducedMotion: boolean;
  detailMode?: boolean;
  revealed?: boolean;
  onSelect: (index: number) => void;
}

// Escala tudo (cases + espacamento entre eles) proporcionalmente.
// Ajuste esse numero pra calibrar o tamanho geral da prateleira.
const SHELF_SCALE = 1.42;

export function RetroShelf({
  games,
  selectedIndex,
  reducedMotion,
  detailMode = false,
  revealed = true,
  onSelect,
}: RetroShelfProps) {
  return (
    <group position={[0, 0.42, 0]} scale={SHELF_SCALE}>
      {games.map((game, index) => {
        if (detailMode && index !== selectedIndex) return null;
        const relative = getCircularOffset(index, selectedIndex, games.length);
        const distance = Math.abs(relative);
        const side = Math.sign(relative);
        const nearestOffset = 1.78;
        const x =
          relative === 0
            ? 0
            : side * (nearestOffset + (distance - 1) * 0.5);
        const z = relative === 0 ? 0.82 : -0.18 - distance * 0.025;

        return (
          <RetroGameCase
            key={game.id}
            game={game}
            position={[x, 0, z]}
            selected={index === selectedIndex}
            reducedMotion={reducedMotion}
            detailMode={detailMode}
            revealed={revealed}
            revealDelayMs={distance * 90}
            onSelect={() => onSelect(index)}
          />
        );
      })}

      <ContactShadows
        position={[0, -1.35, -0.1]}
        opacity={0.48}
        scale={11}
        blur={2.8}
        far={4}
      />
    </group>
  );
}
