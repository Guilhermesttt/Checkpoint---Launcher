import { useState } from "react";
import { useThree } from "@react-three/fiber";

import type { RetroFilter, RetroGame } from "../shelf/retroCollection";
import { CanvasText } from "./CanvasText";

interface CanvasTextButtonProps {
  label: string;
  position: [number, number, number];
  onClick: () => void;
  width?: number;
  fontSize?: number;
  active?: boolean;
  align?: "left" | "center" | "right";
}

function CanvasTextButton({
  label,
  position,
  onClick,
  width = 1,
  fontSize = 0.11,
  active = false,
  align = "center",
}: CanvasTextButtonProps) {
  const [hovered, setHovered] = useState(false);
  const { viewport } = useThree();
  const halfWidth = viewport.width / 2;
  const halfHeight = viewport.height / 2;
  
  // AUMENTAMOS A MARGEM: Empurramos mais para baixo do topo e mais para cima da base
  const top = halfHeight - 1.4; 
  const bottom = -halfHeight + 1.2; 
  
  const filterWidth = 0.86;
  const filterGap = 0.07;

  return (
    <group position={position}>
      {(active || hovered) && (
        <mesh position={[0, 0, -0.006]}>
          <planeGeometry args={[width, 0.31]} />
          <meshBasicMaterial color={active ? "#ddd8ca" : "#342f2c"} />
        </mesh>
      )}
      <mesh
        onClick={(event) => {
          event.stopPropagation();
          onClick();
        }}
        onPointerEnter={(event) => {
          event.stopPropagation();
          setHovered(true);
          document.body.style.cursor = "pointer";
        }}
        onPointerLeave={() => {
          setHovered(false);
          document.body.style.cursor = "default";
        }}
      >
        <planeGeometry args={[Math.max(width, 0.5), 0.44]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      <CanvasText
        text={label}
        position={[
          align === "left"
            ? -width / 2 + 0.08
            : align === "right"
              ? width / 2 - 0.08
              : 0,
          0,
          0.004,
        ]}
        fontSize={fontSize}
        maxWidth={Math.max(0.2, width - 0.16)}
        color={active ? "#171615" : hovered ? "#ffffff" : "#ddd8ca"}
        align={align}
      />
    </group>
  );
}

interface RetroInterfaceProps {
  activeGame?: RetroGame;
  filters: RetroFilter[];
  selectedFilter: string;
  onReturn: () => void;
  onFilter: (filterId: string) => void;
  onPrevious: () => void;
  onNext: () => void;
  onPrimaryAction: () => void;
  onAddGame?: () => void;
}

export function RetroInterface({
  activeGame,
  filters,
  selectedFilter,
  onReturn,
  onFilter,
  onPrevious,
  onNext,
  onPrimaryAction,
  onAddGame,
}: RetroInterfaceProps) {
  const { viewport } = useThree();
  const halfWidth = viewport.width / 2;
  const halfHeight = viewport.height / 2;
  const top = halfHeight - 0.98;
  const bottom = -halfHeight + 0.72;
  const filterWidth = 0.86;
  const filterGap = 0.07;
  const filtersTotalWidth =
    filters.length * filterWidth + (filters.length - 1) * filterGap;

  return (
    <group position={[0, 0, 2.4]}>
      <CanvasTextButton
        label="VOLTAR"
        position={[-halfWidth + 1.9, top, 0]} // Aumentado de 1.48 para 1.9
        width={1.72}
        fontSize={0.105}
        align="left"
        onClick={onReturn}
      />

      <CanvasText
        text="CHECKPOINT  RETRÔ"
        position={[0, top + 0.02, 0]}
        fontSize={0.16}
        maxWidth={2.75}
        color="#b52322"
      />

      {onAddGame && (
        <CanvasTextButton
          label="+  ADICIONAR JOGO"
          position={[halfWidth - 1.9, top, 0]} // Aumentado de 1.48 para 1.9
          width={1.9}
          fontSize={0.092}
          align="right"
          onClick={onAddGame}
        />
      )}

      <group
        position={[-filtersTotalWidth / 2 + filterWidth / 2, top - 0.58, 0]}
      >
        {filters.map((filter, index) => (
          <CanvasTextButton
            key={filter.id}
            label={filter.label}
            position={[index * (filterWidth + filterGap), 0, 0]}
            width={filterWidth}
            fontSize={0.09}
            active={filter.id === selectedFilter}
            onClick={() => onFilter(filter.id)}
          />
        ))}
      </group>

      {activeGame ? (
        <group position={[0, bottom + 0.9, 0]}>
          <CanvasText
            text={activeGame.title}
            position={[0, 0.56, 0]}
            fontSize={0.46}
            maxWidth={Math.max(4.6, viewport.width * 0.62)}
            color="#eee9dd"
            fontRole="display"
          />
          <CanvasText
            text={activeGame.subtitle}
            position={[0, 0.18, 0]}
            fontSize={0.092}
            maxWidth={5.4}
            color="#b52322"
          />
          <CanvasText
            text={`${activeGame.year}  /  ${activeGame.console}`}
            position={[0, -0.08, 0]}
            fontSize={0.086}
            maxWidth={2}
            color="#aaa49a"
          />
          <group position={[0, -0.48, 0]}>
            <CanvasTextButton
              label="ABRIR"
              position={[0, 0, 0]}
              width={1.62}
              fontSize={0.108}
              active
              onClick={onPrimaryAction}
            />
          </group>
        </group>
      ) : (
        <CanvasText
          text="Nenhum jogo encontrado nesta década."
          position={[0, -0.52, 0]}
          fontSize={0.38}
          maxWidth={4.8}
          color="#aaa49a"
          fontRole="display"
        />
      )}

      <CanvasTextButton
        label="←"
        position={[-halfWidth + 1.6, bottom + 1.02, 0]} // Empurrado mais para a direita
        width={0.62}
        fontSize={0.22}
        onClick={onPrevious}
      />
      <CanvasTextButton
        label="→"
        position={[halfWidth - 1.6, bottom + 1.02, 0]} // Empurrado mais para a esquerda
        width={0.62}
        fontSize={0.22}
        onClick={onNext}
      />

      <CanvasText
        text="© CHECKPOINT. TODOS OS DIREITOS RESERVADOS."
        position={[-halfWidth + 1.3, bottom - 0.2, 0]} // Deslocado do canto
        fontSize={0.068}
        maxWidth={3.6}
        color="#aaa49a"
        align="left"
      />
      <CanvasText
        text="CRT ARCHIVE / 480i"
        position={[halfWidth - 1.3, bottom - 0.2, 0]} // Deslocado do canto
        fontSize={0.068}
        maxWidth={1.8}
        color="#aaa49a"
        align="right"
      />
    </group>
  );
}
