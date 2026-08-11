import { useEffect, useMemo, useState } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";

import { RETRO_DISPLAY_FONT, RETRO_INTERFACE_FONT } from "./retroFonts";

type RetroFontRole = "display" | "interface";
type TextAnchor = "left" | "center" | "right";

interface CanvasTextProps {
  text: string;
  position: [number, number, number];
  fontSize: number;
  maxWidth: number;
  color: string;
  fontRole?: RetroFontRole;
  align?: TextAnchor;
  lineHeight?: number;
  rotation?: [number, number, number];
  renderOrder?: number;
}

const fontPromises = new Map<RetroFontRole, Promise<void>>();

function ensureFont(role: RetroFontRole): Promise<void> {
  const existing = fontPromises.get(role);
  if (existing) return existing;

  const family = role === "display" ? "Checkpoint Retro Display" : "Checkpoint Retro Mono";
  const source = role === "display" ? RETRO_DISPLAY_FONT : RETRO_INTERFACE_FONT;
  
  const loaderId = `font:${family}`;
  THREE.DefaultLoadingManager.itemStart(loaderId);

  const pending = new FontFace(family, `url(${source})`)
    .load()
    .then((font) => {
      document.fonts.add(font);
      THREE.DefaultLoadingManager.itemEnd(loaderId);
    })
    .catch((err) => {
      console.warn(`Failed to load FontFace: ${family}`, err);
      THREE.DefaultLoadingManager.itemError(loaderId);
      THREE.DefaultLoadingManager.itemEnd(loaderId);
    });
  fontPromises.set(role, pending);
  return pending;
}

function wrapText(context: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [""];

  const lines: string[] = [];
  let current = words[0];
  for (let index = 1; index < words.length; index += 1) {
    const candidate = `${current} ${words[index]}`;
    if (context.measureText(candidate).width <= maxWidth) current = candidate;
    else {
      lines.push(current);
      current = words[index];
    }
  }
  lines.push(current);
  return lines;
}

export function CanvasText({
  text,
  position,
  fontSize,
  maxWidth,
  color,
  fontRole = "interface",
  align = "center",
  lineHeight = 1.12,
  rotation = [0, 0, 0],
  renderOrder = 10,
}: CanvasTextProps) {
  const { gl } = useThree();
  const [fontRevision, setFontRevision] = useState(0);

  useEffect(() => {
    let active = true;
    ensureFont(fontRole).then(() => {
      if (active) setFontRevision((revision) => revision + 1);
    });
    return () => {
      active = false;
    };
  }, [fontRole]);

  const rendered = useMemo(() => {
    // Rebuild the canvas texture once the local font has finished loading.
    void fontRevision;
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) return null;

    const pixelFontSize = 128;
    const padding = 24;
    const family =
      fontRole === "display"
        ? '"Checkpoint Retro Display", Georgia, serif'
        : '"Checkpoint Retro Mono", "Courier New", monospace';
    context.font = `${pixelFontSize}px ${family}`;

    const contentWidth = Math.max(96, Math.round((maxWidth / fontSize) * pixelFontSize));
    const lines = wrapText(context, text, contentWidth);
    const linePixels = pixelFontSize * lineHeight;
    canvas.width = contentWidth + padding * 2;
    canvas.height = Math.max(64, Math.ceil(lines.length * linePixels + padding * 2));

    context.clearRect(0, 0, canvas.width, canvas.height);
    context.font = `${pixelFontSize}px ${family}`;
    context.fillStyle = color;
    context.textAlign = align;
    context.textBaseline = "middle";
    context.imageSmoothingEnabled = true;

    const x = align === "left" ? padding : align === "right" ? canvas.width - padding : canvas.width / 2;
    lines.forEach((line, index) => {
      const y = padding + linePixels * (index + 0.5);
      context.fillText(line, x, y);
    });

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.generateMipmaps = true;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.anisotropy = gl.capabilities.getMaxAnisotropy();
    texture.needsUpdate = true;

    return {
      texture,
      height: Math.max(fontSize, lines.length * fontSize * lineHeight),
    };
  }, [align, color, fontRevision, fontRole, fontSize, gl, lineHeight, maxWidth, text]);

  useEffect(
    () => () => {
      rendered?.texture.dispose();
    },
    [rendered],
  );

  if (!rendered) return null;

  const anchorOffset = align === "left" ? maxWidth / 2 : align === "right" ? -maxWidth / 2 : 0;

  return (
    <group position={position} rotation={rotation} renderOrder={renderOrder}>
      <mesh position={[anchorOffset, 0, 0]} scale={[maxWidth, rendered.height, 1]}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial
          map={rendered.texture}
          transparent
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}
