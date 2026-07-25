import React, { useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { PVideoBackground, PGlow, useLowPerf } from "./PerformanceComponents";

interface DynamicBackgroundProps {
  backgroundImage: string;
  reducedEffects?: boolean;
}

const DynamicBackground: React.FC<DynamicBackgroundProps> = ({ backgroundImage, reducedEffects = false }) => {
  const [currentImg, setCurrentImg] = useState(backgroundImage);
  const low = useLowPerf();
  const noFx = reducedEffects || low;

  useEffect(() => {
    setCurrentImg(backgroundImage);
  }, [backgroundImage]);

  return (
    <div className="fixed inset-0 z-0 bg-[#050507] overflow-hidden pointer-events-none">
      <PVideoBackground
        src="/PinDown.io_@sebasoler__1776538674.mp4"
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[100vh] h-[100vw] rotate-90 object-cover"
        opacity={0.18}
      />

      <AnimatePresence mode="popLayout">
        <motion.img
          key={currentImg}
          src={currentImg}
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

      <div className="absolute inset-0 bg-gradient-to-t from-[#050507] via-[#050507]/40 to-transparent opacity-95" />
      <div className="absolute inset-0 bg-gradient-to-r from-[#050507]/60 via-transparent to-transparent opacity-80" />

      {/* Radial accent glow — removido no modo desempenho via PGlow */}
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

      {/* Noise texture — removida no modo desempenho */}
      {!low && (
        <div className="absolute inset-0 opacity-[0.015] pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/dark-matter.png')]" />
      )}
    </div>
  );
};

export default DynamicBackground;

