import { ContactShadows } from "@react-three/drei";

import { getCircularOffset, type RetroGame } from "./retroCollection";
import { RetroGameCase } from "./RetroGameCase";

interface RetroShelfProps {
  games: RetroGame[];
  selectedIndex: number;
  inspectedIndex: number | null;
  reducedMotion: boolean;
  onSelect: (index: number) => void;
}

export function RetroShelf({
  games,
  selectedIndex,
  inspectedIndex,
  reducedMotion,
  onSelect,
}: RetroShelfProps) {
  return (
    <group position={[0, 0.42, 0]}>
      {games.map((game, index) => {
        const relative = getCircularOffset(index, selectedIndex, games.length);
        const side = Math.sign(relative);
        const distance = Math.abs(relative);
        const x = relative === 0 ? 0 : side * (1.78 + (distance - 1) * 0.5);
        const z = relative === 0 ? 0.82 : -0.18 - distance * 0.025;

        return (
          <RetroGameCase
            key={game.id}
            game={game}
            position={[x, 0, z]}
            selected={index === selectedIndex}
            inspected={index === inspectedIndex}
            reducedMotion={reducedMotion}
            onSelect={() => onSelect(index)}
          />
        );
      })}

      <ContactShadows position={[0, -1.35, -0.1]} opacity={0.48} scale={11} blur={2.8} far={4} />
    </group>
  );
}
