import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import LoadingState from "./ui/loading-state";

const loadingMsgs = [
  "Iniciando sistemas...",
  "Conectando ao banco de dados...",
  "Sincronizando biblioteca...",
  "Preparando interface...",
  "Quase pronto...",
];

const AsyncLoader: React.FC = () => {
  const [msgIndex, setMsgIndex] = useState(0);

  useEffect(() => {
    const msgInterval = setInterval(() => {
      setMsgIndex((prev) => (prev + 1) % loadingMsgs.length);
    }, 1800);

    return () => {
      clearInterval(msgInterval);
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[1000] bg-[#030405] flex flex-col items-center justify-center overflow-hidden select-none">
      {/* Subtle Atmospheric Radial Star Glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(circle 600px at 50% 50%, rgba(255,255,255,0.03) 0%, transparent 70%)",
        }}
      />

      <div className="relative z-10 flex flex-col items-center gap-8">
        {/* Floating Pherielium Monochromatic Logo Mark */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="relative flex items-center justify-center"
        >
          {/* Pulsing Light Rings */}
          <div className="absolute -inset-4 rounded-full bg-white/[0.03] blur-xl animate-pulse" />
          <div className="relative w-14 h-14 rounded-2xl bg-white/[0.05] border border-white/[0.12] flex items-center justify-center shadow-[0_0_30px_rgba(255,255,255,0.1)] backdrop-blur-xl">
            <img
              src="/Pherielium_logo.png"
              alt="Pherielium"
              className="w-8 h-8 object-contain drop-shadow-[0_0_10px_rgba(255,255,255,0.5)]"
            />
          </div>
        </motion.div>

        {/* High-End LoadingState with Dynamic Messages and Elapsed Time */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="flex flex-col items-center"
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={msgIndex}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.25 }}
            >
              <LoadingState
                label={loadingMsgs[msgIndex]}
                variant="Drive"
                className="py-2 px-4 rounded-full bg-white/[0.04] border border-white/[0.08] backdrop-blur-md shadow-lg"
              />
            </motion.div>
          </AnimatePresence>
        </motion.div>
      </div>

      {/* Decorative Star Dust Points */}
      <div className="absolute bottom-10 left-10 flex gap-3 pointer-events-none opacity-30">
        {[0.2, 0.4, 0.1].map((op, i) => (
          <div
            key={i}
            className="w-1 h-1 rounded-full bg-white animate-pulse"
            style={{ opacity: op }}
          />
        ))}
      </div>
    </div>
  );
};

export default AsyncLoader;
