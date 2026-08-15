import React, { Suspense, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { Float, ContactShadows } from "@react-three/drei";
import { PS2CaseModel3D } from "./PS2CaseModel3D";
import type { RetroGame } from "../../types/domain";

export interface RetroShelf3DProps {
  games: RetroGame[];
  selectedIndex: number;
  onSelectIndex: (index: number) => void;
  onOpenDetails?: (game: RetroGame) => void;
  accentColor?: string;
  className?: string;
}

interface ShelfItemProps {
  game: RetroGame;
  index: number;
  selectedIndex: number;
  onSelect: () => void;
  onOpenDetails?: (game: RetroGame) => void;
}

const ShelfItem: React.FC<ShelfItemProps> = ({
  game,
  index,
  selectedIndex,
  onSelect,
  onOpenDetails,
}) => {
  const [isHovered, setIsHovered] = useState<boolean>(false);
  const isSelected = index === selectedIndex;
  const offset = index - selectedIndex;

  // Posição 3D calibrada para o tamanho ampliado
  const posX = offset * 4.6;
  const posZ = -Math.abs(offset) * 2.2;
  const rotY = -Math.sign(offset) * 0.45;
  const scale = isSelected ? 0.28 : 0.21;

  if (Math.abs(offset) > 3) {
    return null;
  }

  const handleClick = (e: any) => {
    e.stopPropagation();
    if (isSelected) {
      onOpenDetails?.(game);
    } else {
      onSelect();
    }
  };

  return (
    <group
      position={[posX, 0, posZ]}
      onClick={handleClick}
      onPointerOver={(e) => {
        e.stopPropagation();
        setIsHovered(true);
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        setIsHovered(false);
        document.body.style.cursor = "default";
      }}
    >
      <Float
        speed={isSelected ? 1.8 : 0}
        rotationIntensity={isSelected ? 0.15 : 0}
        floatIntensity={isSelected ? 0.15 : 0}
      >
        <PS2CaseModel3D
          coverUrl={game.coverImage || game.wrapImage}
          isSelected={isSelected}
          isHovered={isHovered}
          rotationY={rotY}
          scale={scale}
          autoRotate={isSelected}
        />
      </Float>
    </group>
  );
};

export const RetroShelf3D: React.FC<RetroShelf3DProps> = ({
  games,
  selectedIndex,
  onSelectIndex,
  onOpenDetails,
  accentColor = "#10b981",
  className = "",
}) => {
  return (
    <div className={`relative w-full h-full select-none ${className}`}>
      <Canvas
        camera={{ position: [0, 0.2, 5.6], fov: 44 }}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        onPointerMissed={() => {
          document.body.style.cursor = "default";
        }}
      >
        <ambientLight intensity={0.9} />
        
        {/* Iluminação de Estúdio com Holofotes Temáticos */}
        <spotLight
          position={[0, 8, 7]}
          angle={0.65}
          penumbra={0.8}
          intensity={2.8}
          color="#ffffff"
          castShadow
        />
        <pointLight
          position={[-5, 2.5, 3]}
          intensity={2.2}
          color={accentColor}
        />
        <pointLight
          position={[5, 2, 2.5]}
          intensity={1.5}
          color={accentColor}
        />
        <directionalLight
          position={[0, -2, 2]}
          intensity={0.4}
          color="#ffffff"
        />

        <Suspense fallback={null}>
          <group position={[0, -0.2, 0]}>
            {games.map((game, idx) => (
              <ShelfItem
                key={game.id}
                game={game}
                index={idx}
                selectedIndex={selectedIndex}
                onSelect={() => onSelectIndex(idx)}
                onOpenDetails={onOpenDetails}
              />
            ))}
          </group>

          {/* Sombra de Contato no Chão */}
          <ContactShadows
            position={[0, -1.5, 0]}
            opacity={0.65}
            scale={18}
            blur={2.6}
            far={6}
            color={accentColor}
          />
        </Suspense>
      </Canvas>
    </div>
  );
};

export default RetroShelf3D;
