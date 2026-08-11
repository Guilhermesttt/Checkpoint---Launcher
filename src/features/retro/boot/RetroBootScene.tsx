import { OrthographicCamera, Text } from "@react-three/drei";
import { useThree } from "@react-three/fiber";

import stixRegularUrl from "@fontsource/stix-two-text/files/stix-two-text-latin-400-normal.woff";
import stixBoldUrl from "@fontsource/stix-two-text/files/stix-two-text-latin-700-normal.woff";

interface RetroBootSceneProps {
  progress: number;
  active: boolean;
}

const BOOT_SEGMENTS = 20;
const PHOSPHOR = "#fcf9f3";

function BootComposition({ progress, active }: RetroBootSceneProps) {
  const viewport = useThree((state) => state.viewport);
  const scale = Math.min(0.85, viewport.width / 13.5, viewport.height / 9.5);
  const filledSegments = Math.round((progress / 100) * BOOT_SEGMENTS);

  return (
    <group scale={scale}>
      <group position={[-4.25, 2.15, 0]}>
        {[1.52, 1.75, 1.92, 1.75, 1.52].map((width, index) => (
          <mesh key={index} position={[0, 0.32 - index * 0.16, 0]}>
            <planeGeometry args={[width, 0.09]} />
            <meshBasicMaterial color={PHOSPHOR} toneMapped={false} />
          </mesh>
        ))}
      </group>

      <Text position={[0.85, 2.03, 0]} font={stixBoldUrl} fontSize={1.42} color={PHOSPHOR} anchorX="center" anchorY="middle">
        CHECKPOINT
      </Text>
      <Text position={[0, 0.72, 0]} font={stixRegularUrl} fontSize={0.24} lineHeight={1.25} color={PHOSPHOR} textAlign="center" anchorX="center" anchorY="middle">
        {"CHECKPOINT RETRO ARCHIVE SYSTEM\nVERSION 3.0.8"}
      </Text>

      <mesh position={[0, -1.02, -0.02]}>
        <planeGeometry args={[6.08, 0.62]} />
        <meshBasicMaterial color={PHOSPHOR} toneMapped={false} />
      </mesh>
      <mesh position={[0, -1.02, -0.01]}>
        <planeGeometry args={[5.98, 0.52]} />
        <meshBasicMaterial color="#3d3d9e" toneMapped={false} />
      </mesh>
      {Array.from({ length: BOOT_SEGMENTS }, (_, index) => (
        <mesh key={index} position={[-2.78 + index * 0.292, -1.02, 0]} visible={index < filledSegments}>
          <planeGeometry args={[0.22, 0.42]} />
          <meshBasicMaterial color={PHOSPHOR} toneMapped={false} />
        </mesh>
      ))}

      <Text position={[0, -1.58, 0]} font={stixRegularUrl} fontSize={0.16} color={PHOSPHOR} anchorX="center" anchorY="middle">
        {`${active ? "CARREGANDO RECURSOS" : "SINCRONIZANDO SINAL"} / ${progress}%`}
      </Text>
      <Text position={[0, -3.08, 0]} font={stixRegularUrl} fontSize={0.18} color="#d4c388" anchorX="center" anchorY="middle">
        CHECKPOINT ENTERTAINMENT SYSTEM · CRT OUTPUT 480i
      </Text>
    </group>
  );
}

export function RetroBootScene(props: RetroBootSceneProps) {
  return (
    <>
      <color attach="background" args={["#3d3d9e"]} />
      <OrthographicCamera makeDefault position={[0, 0, 10]} zoom={100} near={0.1} far={20} />
      <BootComposition {...props} />
    </>
  );
}
