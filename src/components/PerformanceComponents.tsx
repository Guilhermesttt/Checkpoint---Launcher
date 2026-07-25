/**
 * PerformanceComponents.tsx
 *
 * Wrappers inteligentes que consultam o `lowPerformanceMode` do PreferencesContext
 * e substituem automaticamente elementos pesados (3D, blur, animações, vídeo)
 * por versões leves quando o modo de desempenho está ativo.
 *
 * Uso:
 *   import { PMotion, PBackdrop, PGlow, PVideoBackground } from "../components/PerformanceComponents";
 *
 *   <PMotion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>...</PMotion.div>
 *   → No modo desempenho: renderiza um <div> comum sem nenhuma animação.
 *
 *   <PBackdrop>...</PBackdrop>
 *   → No modo desempenho: remove o backdrop-filter blur do container.
 *
 *   <PGlow color="rgb(120,80,255)" />
 *   → No modo desempenho: não renderiza nada (null).
 *
 *   <PVideoBackground src="..." />
 *   → No modo desempenho: não renderiza nada (null).
 */

import React from "react";
import {
  motion,
  type HTMLMotionProps,
  AnimatePresence,
  type AnimatePresenceProps,
} from "framer-motion";
import { usePreferences } from "../context/PreferencesContext";

// ─── Hook auxiliar ─────────────────────────────────────────────────────────────

export function useLowPerf() {
  const { lowPerformanceMode } = usePreferences();
  return lowPerformanceMode;
}

// ─── PMotion ──────────────────────────────────────────────────────────────────
// Substituto direto dos componentes `motion.*` do Framer Motion.
// Em modo desempenho renderiza o elemento HTML puro (sem props de animação).

type PMotionProps = any;

function createPMotion(tag: any) {
  const MotionTag = (motion as any)[tag];
  return function PMotionComponent({ children, className, style, onClick, onMouseMove, onMouseLeave, as: _as, ...rest }: any) {
    const low = useLowPerf();
    if (low) {
      const Tag = tag as any;
      return (
        <Tag className={className} style={style} onClick={onClick} onMouseMove={onMouseMove} onMouseLeave={onMouseLeave}>
          {children}
        </Tag>
      );
    }
    return (
      <MotionTag className={className} style={style} onClick={onClick} onMouseMove={onMouseMove} onMouseLeave={onMouseLeave} {...rest}>
        {children}
      </MotionTag>
    );
  };
}

export const PMotion = {
  div: createPMotion("div"),
  span: createPMotion("span"),
  section: createPMotion("section"),
  article: createPMotion("article"),
  aside: createPMotion("aside"),
  header: createPMotion("header"),
  footer: createPMotion("footer"),
  ul: createPMotion("ul"),
  li: createPMotion("li"),
  button: createPMotion("button"),
  img: createPMotion("img"),
  p: createPMotion("p"),
  h1: createPMotion("h1"),
  h2: createPMotion("h2"),
};

// ─── PAnimatePresence ─────────────────────────────────────────────────────────
// Em modo desempenho, apenas renderiza os filhos sem a lógica de exit animation.

export const PAnimatePresence: React.FC<AnimatePresenceProps & { children: React.ReactNode }> = ({
  children,
  ...props
}) => {
  const low = useLowPerf();
  if (low) return <>{children}</>;
  return <AnimatePresence {...props}>{children}</AnimatePresence>;
};

// ─── PBackdrop ────────────────────────────────────────────────────────────────
// Container com backdrop-blur. Em modo desempenho remove o blur e usa fundo sólido.

interface PBackdropProps {
  children: React.ReactNode;
  className?: string;
  /** Cor de fundo sólida usada no modo desempenho. Default: rgba(10,10,14,0.96) */
  fallbackBg?: string;
  style?: React.CSSProperties;
}

export const PBackdrop: React.FC<PBackdropProps> = ({
  children,
  className = "",
  fallbackBg = "rgba(10,10,14,0.96)",
  style,
}) => {
  const low = useLowPerf();
  return (
    <div
      className={className}
      style={{
        backdropFilter: low ? "none" : undefined,
        WebkitBackdropFilter: low ? "none" : undefined,
        background: low ? fallbackBg : undefined,
        ...style,
      }}
    >
      {children}
    </div>
  );
};

// ─── PGlow ────────────────────────────────────────────────────────────────────
// Elemento decorativo de brilho (blob, radial glow). Em modo desempenho não renderiza.

interface PGlowProps {
  className?: string;
  style?: React.CSSProperties;
  color?: string;
  size?: number | string;
  opacity?: number;
}

export const PGlow: React.FC<PGlowProps> = ({ className, style, color, size = 400, opacity = 0.25 }) => {
  const low = useLowPerf();
  if (low) return null;

  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute rounded-full blur-[80px] ${className ?? ""}`}
      style={{
        width: size,
        height: size,
        background: color ?? "rgb(var(--launcher-accent))",
        opacity,
        ...style,
      }}
    />
  );
};

// ─── PVideoBackground ─────────────────────────────────────────────────────────
// Vídeo de fundo decorativo. Em modo desempenho não renderiza.

interface PVideoBackgroundProps {
  src: string;
  className?: string;
  opacity?: number;
}

export const PVideoBackground: React.FC<PVideoBackgroundProps> = ({ src, className, opacity = 0.18 }) => {
  const low = useLowPerf();
  if (low) return null;

  return (
    <video
      autoPlay
      loop
      muted
      playsInline
      className={className}
      style={{ opacity }}
    >
      <source src={src} type="video/mp4" />
    </video>
  );
};

// ─── PCard3D ──────────────────────────────────────────────────────────────────
// Wrapper para cards com efeito 3D (rotateX/Y). Em modo desempenho, desliga perspectiva e transformações.

interface PCard3DProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  rotateX?: any; // MotionValue
  rotateY?: any; // MotionValue
  scale?: number;
  isActive?: boolean;
}

export const PCard3D: React.FC<PCard3DProps> = ({
  children,
  className,
  style,
  rotateX,
  rotateY,
  scale = 1,
  isActive = false,
}) => {
  const low = useLowPerf();

  if (low) {
    return (
      <div
        className={className}
        style={{
          transform: isActive ? "scale(1.03)" : "scale(0.92)",
          transition: "transform 0.15s ease",
          ...style,
        }}
      >
        {children}
      </div>
    );
  }

  return (
    <motion.div
      className={className}
      style={{ rotateX, rotateY, scale, transformStyle: "preserve-3d", ...style }}
      transition={{ type: "spring", stiffness: 350, damping: 25 }}
    >
      {children}
    </motion.div>
  );
};

// ─── PShadow ──────────────────────────────────────────────────────────────────
// Aplica box-shadow pesado apenas se não estiver em modo desempenho.

interface PShadowProps {
  children: React.ReactNode;
  shadow: string;
  className?: string;
  style?: React.CSSProperties;
}

export const PShadow: React.FC<PShadowProps> = ({ children, shadow, className, style }) => {
  const low = useLowPerf();
  return (
    <div
      className={className}
      style={{ boxShadow: low ? "none" : shadow, ...style }}
    >
      {children}
    </div>
  );
};

// ─── PTransition ──────────────────────────────────────────────────────────────
// CSS transition wrapper. Em modo desempenho aplica duration-0 para tudo ser instantâneo.

interface PTransitionProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  /** Classes CSS de transição normais, ex: "transition-all duration-500 ease-out" */
  transition?: string;
}

export const PTransition: React.FC<PTransitionProps> = ({ children, className, style, transition = "transition-all duration-300 ease-out" }) => {
  const low = useLowPerf();
  return (
    <div
      className={`${low ? "" : transition} ${className ?? ""}`}
      style={style}
    >
      {children}
    </div>
  );
};
