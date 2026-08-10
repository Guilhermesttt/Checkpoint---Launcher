import { ContactShadows } from "@react-three/drei";

import { getCircularOffset, type RetroGame } from "./retroCollection";
import { RetroGameCase } from "./RetroGameCase";

interface RetroShelfProps {
  games: RetroGame[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  onActiveHoverChange: (hovered: boolean) => void;
}

export function RetroShelf({
  games,
  selectedIndex,
  onSelect,
  onActiveHoverChange,
}: RetroShelfProps) {
  return (
    <group position={[0, 0.22, 0]}>
      {games.map((game, index) => {
        const relative = getCircularOffset(index, selectedIndex, games.length);
        const side = Math.sign(relative);
        const distance = Math.abs(relative);
        const x = relative === 0 ? 0 : side * (1.38 + (distance - 1) * 0.42);
        const z = relative === 0 ? 0.82 : -0.18 - distance * 0.025;

        return (
          <RetroGameCase
            key={game.id}
            game={game}
            position={[x, 0, z]}
            selected={index === selectedIndex}
            onSelect={() => onSelect(index)}
            onActiveHoverChange={onActiveHoverChange}
          />
        );
      })}

      <ContactShadows position={[0, -1.11, -0.1]} opacity={0.56} scale={10} blur={2.4} far={3.5} />
    </group>
  );
}
