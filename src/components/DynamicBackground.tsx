import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { PVideoBackground, PGlow, useLowPerf } from "./PerformanceComponents";
import bgVideo from "../assets/morpxd_pindown.io_1785615286.mp4";

interface DynamicBackgroundProps {
  backgroundImage: string;
  reducedEffects?: boolean;
}

const DynamicBackground: React.FC<DynamicBackgroundProps> = ({ backgroundImage, reducedEffects = false }) => {
  const low = useLowPerf();
  const noFx = reducedEffects || low;

  return (
    <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none" style={{ background: "var(--background)" }}>
      <PVideoBackground
        src={bgVideo}
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[100vh] h-[100vw] rotate-90 object-cover"
        opacity={0.18}
      />

      <AnimatePresence mode="popLayout">
        <motion.img
          key={backgroundImage}
          src={backgroundImage}
          initial={{ opacity: 0 }}
          animate={{ opacity: noFx ? 0.3 : 0.45 }}
          exit={{ opacity: 0 }}
          transition={{
            duration: noFx ? 0.1 : 0.8,
            ease: "easeOut"
          }}
          className={`absolute inset-0 w-full h-full object-cover transition-all duration-700 ${noFx ? "" : "blur-[80px] scale-[1.2]"}`}
        />
      </AnimatePresence>

      {/* Base gradients using CSS variable for unified dark background */}
      <div className="absolute inset-0 opacity-95" style={{ background: "linear-gradient(to top, var(--background) 0%, color-mix(in srgb, var(--background) 40%, transparent) 50%, transparent 100%)" }} />
      <div className="absolute inset-0 opacity-80" style={{ background: "linear-gradient(to right, color-mix(in srgb, var(--background) 60%, transparent) 0%, transparent 50%)" }} />

      {/* Edge vignette for screen-in-a-dark-room feel */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: "radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.55) 100%)",
        }}
      />

      <PGlow
        className="absolute inset-0 w-full h-full"
        style={{
          background: "radial-gradient(circle at 76% 18%, rgb(var(--launcher-accent) / 0.20), transparent 45%), radial-gradient(circle at 18% 82%, rgb(var(--launcher-accent) / 0.28), transparent 50%)",
          borderRadius: 0,
        }}
        size="100%"
        opacity={1}
        color="transparent"
      />

      {!low && (
        <div className="absolute inset-0 opacity-[0.015] pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/dark-matter.png')]" />
      )}
    </div>
  );
};

export default DynamicBackground;
