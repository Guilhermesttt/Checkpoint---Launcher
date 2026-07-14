import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckLine } from "lucide-react";

const loadingMsgs = [
  "Iniciando sistemas...",
  "Conectando ao banco de dados...",
  "Sincronizando biblioteca...",
  "Preparando interface...",
  "Quase pronto...",
];

const AsyncLoader: React.FC = () => {
  const [msgIndex, setMsgIndex] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const msgInterval = setInterval(() => {
      setMsgIndex((prev) => (prev + 1) % loadingMsgs.length);
    }, 1200);

    const progInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) return 100;
        return Math.min(prev + Math.random() * 15, 98);
      });
    }, 400);

    return () => {
      clearInterval(msgInterval);
      clearInterval(progInterval);
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[1000] bg-[#050507] flex flex-col items-center justify-center overflow-hidden">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 70% 50% at 50% 50%, rgba(59,130,246,0.07) 0%, transparent 70%)",
        }}
      />

      <div className="relative z-10 w-full max-w-xs px-8 flex flex-col items-center">
        <div className="relative w-16 h-16 mb-10 flex items-center justify-center">
          {[...Array(3)].map((_, i) => (
            <motion.div
              key={i}
              animate={{ rotate: i % 2 === 0 ? 360 : -360 }}
              transition={{
                duration: 2.5 + i * 0.5,
                repeat: Infinity,
                ease: "linear",
              }}
              className="absolute border rounded-full border-transparent"
              style={{
                inset: i * 8,
                borderTopColor: `rgba(59,130,246,${0.5 - i * 0.12})`,
              }}
            />
          ))}
          <div className="w-8 h-8 rounded-xl bg-blue-500/15 border border-blue-500/25 flex items-center justify-center">
            <CheckLine className="w-4 h-4 text-blue-400" />
          </div>
        </div>

        <div className="h-6 mb-5 overflow-hidden text-center w-full">
          <AnimatePresence mode="wait">
            <motion.p
              key={msgIndex}
              initial={{ y: 12, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -12, opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="text-white/50 text-[12px] tracking-[0.2em] uppercase font-light"
            >
              {loadingMsgs[msgIndex]}
            </motion.p>
          </AnimatePresence>
        </div>

        <div className="w-full h-[2px] bg-white/8 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: "0%" }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="h-full bg-gradient-to-r from-blue-600 to-blue-400 rounded-full"
          />
        </div>

        <motion.span
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-2.5 text-[10px] text-white/25 font-mono tracking-tight"
        >
          {Math.floor(progress)}%
        </motion.span>
      </div>

      <div className="absolute bottom-10 left-10 flex gap-3">
        {[0.08, 0.06, 0.12].map((op, i) => (
          <div
            key={i}
            className="w-1 h-1 rounded-full"
            style={{ background: `rgba(255,255,255,${op})` }}
          />
        ))}
      </div>
    </div>
  );
};

export default AsyncLoader;
