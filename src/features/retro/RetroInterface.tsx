import { useState } from "react";
import { useThree } from "@react-three/fiber";

import type { RetroFilter, RetroGame } from "./retroCollection";
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
  fontSize = 0.085,
  active = false,
  align = "center",
}: CanvasTextButtonProps) {
  const [hovered, setHovered] = useState(false);
  return (
    <group position={position}>
      {(active || hovered) && (
        <mesh position={[0, 0, -0.006]}>
          <planeGeometry args={[width, 0.24]} />
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
        <planeGeometry args={[Math.max(width, 0.42), 0.34]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      <CanvasText
        text={label}
        position={[align === "left" ? -width / 2 + 0.08 : align === "right" ? width / 2 - 0.08 : 0, 0, 0.004]}
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
  inspectionOpen: boolean;
  onReturn: () => void;
  onFilter: (filterId: string) => void;
  onPrevious: () => void;
  onNext: () => void;
  onPrimaryAction: () => void;
}

export function RetroInterface({
  activeGame,
  filters,
  selectedFilter,
  inspectionOpen,
  onReturn,
  onFilter,
  onPrevious,
  onNext,
  onPrimaryAction,
}: RetroInterfaceProps) {
  const { viewport } = useThree();
  const halfWidth = viewport.width / 2;
  const halfHeight = viewport.height / 2;
  const top = halfHeight - 0.48;
  const bottom = -halfHeight + 0.34;
  const filterWidth = 0.72;
  const filterGap = 0.05;
  const filtersTotalWidth = filters.length * filterWidth + (filters.length - 1) * filterGap;

  return (
    <group position={[0, 0, 2.4]}>
      <CanvasTextButton
        label="VOLTAR / 戻る"
        position={[-halfWidth + 0.82, top, 0]}
        width={1.34}
        fontSize={0.075}
        align="left"
        onClick={onReturn}
      />

      <CanvasText
        text="CHECKPOINT  RETRÔ"
        position={[0, top + 0.02, 0]}
        fontSize={0.11}
        maxWidth={2.1}
        color="#b52322"
      />
      <CanvasText
        text="ACERVO 1980—2026"
        position={[halfWidth - 0.6, top, 0]}
        fontSize={0.065}
        maxWidth={1.25}
        color="#aaa49a"
        align="right"
      />

      <group position={[-filtersTotalWidth / 2 + filterWidth / 2, top - 0.46, 0]}>
        {filters.map((filter, index) => (
          <CanvasTextButton
            key={filter.id}
            label={filter.label}
            position={[index * (filterWidth + filterGap), 0, 0]}
            width={filterWidth}
            fontSize={0.062}
            active={filter.id === selectedFilter}
            onClick={() => onFilter(filter.id)}
          />
        ))}
      </group>

      {activeGame ? (
        <group position={[0, bottom + 0.78, 0]}>
          <CanvasText
            text={activeGame.title}
            position={[0, 0.43, 0]}
            fontSize={Math.min(0.34, viewport.width / Math.max(activeGame.title.length * 3.5, 28))}
            maxWidth={Math.max(3.4, viewport.width * 0.58)}
            color="#eee9dd"
            fontRole="display"
          />
          <CanvasText
            text={activeGame.subtitle}
            position={[0, 0.13, 0]}
            fontSize={0.062}
            maxWidth={4.2}
            color="#b52322"
          />
          <CanvasText
            text={`${activeGame.year}  /  ${activeGame.console}`}
            position={[0, -0.09, 0]}
            fontSize={0.057}
            maxWidth={1.5}
            color="#aaa49a"
          />
          <CanvasTextButton
            label={inspectionOpen ? "▶  JOGAR" : "□  ABRIR CAIXA"}
            position={[0, -0.4, 0]}
            width={inspectionOpen ? 1.3 : 1.72}
            fontSize={0.078}
            active={inspectionOpen}
            onClick={onPrimaryAction}
          />
        </group>
      ) : (
        <CanvasText
          text="Nenhum jogo encontrado nesta década."
          position={[0, -0.52, 0]}
          fontSize={0.27}
          maxWidth={4.8}
          color="#aaa49a"
          fontRole="display"
        />
      )}

      <CanvasTextButton
        label="←"
        position={[-halfWidth + 0.45, bottom + 0.84, 0]}
        width={0.46}
        fontSize={0.15}
        onClick={onPrevious}
      />
      <CanvasTextButton
        label="→"
        position={[halfWidth - 0.45, bottom + 0.84, 0]}
        width={0.46}
        fontSize={0.15}
        onClick={onNext}
      />

      <CanvasText
        text="© CHECKPOINT. TODOS OS DIREITOS RESERVADOS."
        position={[-halfWidth + 0.3, bottom, 0]}
        fontSize={0.048}
        maxWidth={2.7}
        color="#777269"
        align="left"
      />
      <CanvasText
        text="CRT ARCHIVE / 480i"
        position={[halfWidth - 0.3, bottom, 0]}
        fontSize={0.048}
        maxWidth={1.35}
        color="#777269"
        align="right"
      />
    </group>
  );
}
