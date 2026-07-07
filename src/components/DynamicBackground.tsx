import React, { useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";

interface DynamicBackgroundProps {
  backgroundImage: string;
  reducedEffects?: boolean;
}

const DynamicBackground: React.FC<DynamicBackgroundProps> = ({ backgroundImage, reducedEffects = false }) => {
  const [currentImg, setCurrentImg] = useState(backgroundImage);

  useEffect(() => {
    setCurrentImg(backgroundImage);
  }, [backgroundImage]);

  return (
    <div className="fixed inset-0 z-0 bg-[#050507] overflow-hidden pointer-events-none">
      {!reducedEffects && (
        <video
          autoPlay
          loop
          muted
          playsInline
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[100vh] h-[100vw] rotate-90 object-cover opacity-[0.18]"
        >
          <source src="/PinDown.io_@sebasoler__1776538674.mp4" type="video/mp4" />
        </video>
      )}

      <AnimatePresence mode="popLayout">
        <motion.img
          key={currentImg}
          src={currentImg}
          initial={{ opacity: 0 }}
          animate={{ opacity: reducedEffects ? 0.3 : 0.45 }}
          exit={{ opacity: 0 }}
          transition={{ 
            duration: reducedEffects ? 0.1 : 0.8, 
            ease: "easeOut" 
          }}
          className={`absolute inset-0 w-full h-full object-cover transition-all duration-700 ${reducedEffects ? "" : "blur-[80px] scale-[1.2]"}`}
        />
      </AnimatePresence>

      <div className="absolute inset-0 bg-gradient-to-t from-[#050507] via-[#050507]/40 to-transparent opacity-95" />
      <div className="absolute inset-0 bg-gradient-to-r from-[#050507]/60 via-transparent to-transparent opacity-80" />
      <div
        className="absolute inset-0 transition-[background] duration-700"
        style={{
          background:
            "radial-gradient(circle at 76% 18%, rgb(var(--launcher-accent) / 0.20), transparent 45%), radial-gradient(circle at 18% 82%, rgb(var(--launcher-accent) / 0.28), transparent 50%)",
          opacity: 1,
        }}
      />

      {!reducedEffects && (
        <div className="absolute inset-0 opacity-[0.015] pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/dark-matter.png')]" />
      )}
    </div>
  );
};

export default DynamicBackground;
