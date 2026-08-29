"use client";

import { useEffect, useState } from "react";

/* ─────────────────────────────────────────────────────────
 * LOADING STATE — pixel-grid loader for long-running work
 *
 * Variants:
 *   Drive  — square cells, chevron wavefront driving right;
 *            the 650ms cycle is shorter than the sweep, so
 *            two fronts are always in flight
 *   Dots   — same wavefront, circular cells
 *   Orbit  — a comet lapping the grid perimeter
 *
 * Paired with a shimmering label and a live elapsed timer
 * in mono tabular figures. Reduced motion freezes the grid
 * to its dim state; the timer still ticks.
 * ───────────────────────────────────────────────────────── */

const chevron = Array.from({ length: 9 }, (_, i) => {
  const r = Math.floor(i / 3),
    c = i % 3;
  return (c + Math.abs(r - 1)) * 90;
});

const ORBIT_ORDER = [0, 1, 2, 5, 8, 7, 6, 3];
const orbit = Array.from({ length: 9 }, (_, i) => {
  const k = ORBIT_ORDER.indexOf(i);
  return k === -1 ? null : k * 110;
});

const PATTERNS: Record<
  string,
  { delays: (number | null)[]; dur: number; round: boolean }
> = {
  Drive: { delays: chevron, dur: 650, round: false },
  Dots: { delays: chevron, dur: 650, round: true },
  Orbit: { delays: orbit, dur: 950, round: false },
};

function useElapsed(enabled = true) {
  const [ds, setDs] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    const t = setInterval(() => setDs((d) => d + 1), 100);
    return () => clearInterval(t);
  }, [enabled]);
  const total = ds / 10;
  if (total < 60) return `${total.toFixed(1)}s`;
  return `${Math.floor(total / 60)}m ${(total % 60).toFixed(1)}s`;
}

export interface LoadingStateProps {
  label?: string;
  variant?: "Drive" | "Dots" | "Orbit" | string;
  className?: string;
  showTimer?: boolean;
  size?: "sm" | "md" | "lg";
  dark?: boolean;
}

export function LoadingState({
  label = "Carregando",
  variant = "Drive",
  className = "",
  showTimer = true,
  size = "md",
  dark = false,
}: LoadingStateProps) {
  const elapsed = useElapsed(showTimer);
  const { delays, dur, round } = PATTERNS[variant] ?? PATTERNS.Drive;

  const pixelSize = size === "sm" ? "size-[3px]" : size === "lg" ? "size-[5px]" : "size-[4px]";
  const gridGap = size === "sm" ? "gap-[1px]" : "gap-[1.5px]";
  const textSize = size === "sm" ? "text-[11px]" : size === "lg" ? "text-[14px]" : "text-[13px]";
  const timerSize = size === "sm" ? "text-[10px]" : size === "lg" ? "text-[13px]" : "text-[12px]";

  const shimmerGradient = dark
    ? "linear-gradient(90deg, rgba(0,0,0,0.4) 35%, rgba(0,0,0,0.95) 50%, rgba(0,0,0,0.4) 65%)"
    : "linear-gradient(90deg, rgba(255,255,255,0.4) 35%, rgba(255,255,255,0.95) 50%, rgba(255,255,255,0.4) 65%)";

  return (
    <div className={`flex w-fit items-center gap-2.5 ${className}`}>
      <span aria-hidden className={`grid grid-cols-[repeat(3,auto)] ${gridGap}`}>
        {delays.map((d, i) => (
          <span
            key={i}
            className={`${pixelSize} ${dark ? "bg-black" : "bg-white"} ${round ? "rounded-full" : "rounded-[1px]"}`}
            style={{
              opacity: d === null ? (dark ? 0.1 : 0.07) : (dark ? 0.2 : 0.15),
              animation:
                d === null
                  ? "none"
                  : `pixel-on ${dur}ms ease-in-out ${d}ms infinite`,
            }}
          />
        ))}
      </span>
      {label && (
        <span
          className={`bg-clip-text ${textSize} font-medium text-transparent`}
          style={{
            backgroundImage: shimmerGradient,
            backgroundSize: "200% 100%",
            animation: "shimmer-text 1.4s linear infinite",
          }}
        >
          {label}
        </span>
      )}
      {showTimer && (
        <span className={`font-mono ${timerSize} ${dark ? "text-black/50" : "text-white/50"} tabular-nums`}>
          {elapsed}
        </span>
      )}
    </div>
  );
}

export default LoadingState;
