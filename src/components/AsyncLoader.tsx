import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const loadingMsgs = [
  "Iniciando sistemas...",
  "Conectando ao banco de dados...",
  "Sincronizando biblioteca...",
  "Preparando interface...",
  "Quase pronto..."
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
        const increment = Math.random() * 15;
        return Math.min(prev + increment, 98); // Stay at 98 until actual switch
      });
    }, 400);

    return () => {
      clearInterval(msgInterval);
      clearInterval(progInterval);
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[1000] bg-[#050507] flex flex-col items-center justify-center overflow-hidden">
      {/* Dynamic Background Glows */}
      <div className="absolute inset-0">
        <motion.div
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.1, 0.2, 0.1],
          }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-blue-600/10 blur-[120px] rounded-full"
        />
        <motion.div
          animate={{
            scale: [1.2, 1, 1.2],
            opacity: [0.05, 0.15, 0.05],
          }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 1 }}
          className="absolute top-1/3 left-1/4 w-[600px] h-[600px] bg-indigo-600/10 blur-[100px] rounded-full"
        />
      </div>

      <div className="relative z-10 w-full max-w-sm px-10 flex flex-col items-center">
        {/* Abstract Loading Shape */}
        <div className="relative w-24 h-24 mb-12">
          {[...Array(3)].map((_, i) => (
            <motion.div
              key={i}
              initial={{ rotate: 0, opacity: 0 }}
              animate={{ 
                rotate: 360, 
                opacity: 1,
                scale: [1, 1.1, 1]
              }}
              transition={{ 
                rotate: { duration: 3, repeat: Infinity, ease: "linear", delay: i * 0.4 },
                opacity: { duration: 1 },
                scale: { duration: 2, repeat: Infinity, ease: "easeInOut" }
              }}
              className="absolute inset-0 border-t-2 border-blue-500/30 rounded-full"
              style={{ padding: i * 8 }}
            />
          ))}
          <motion.div
            animate={{ 
              opacity: [0.4, 1, 0.4],
              scale: [0.95, 1.05, 0.95]
            }}
            transition={{ duration: 2, repeat: Infinity }}
            className="absolute inset-4 bg-gradient-to-br from-blue-500/20 to-indigo-500/20 rounded-full blur-sm"
          />
        </div>

        {/* Progress Text */}
        <div className="h-6 mb-4 overflow-hidden text-center w-full">
          <AnimatePresence mode="wait">
            <motion.p
              key={msgIndex}
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -20, opacity: 0 }}
              className="text-white/60 text-[13px] tracking-widest uppercase font-light"
            >
              {loadingMsgs[msgIndex]}
            </motion.p>
          </AnimatePresence>
        </div>

        {/* Modern Progress Bar */}
        <div className="w-full h-[3px] bg-white/5 rounded-full overflow-hidden relative">
          <motion.div
            initial={{ width: "0%" }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="h-full bg-gradient-to-r from-blue-600 via-blue-400 to-indigo-500 relative"
          >
            {/* Shimmer on bar */}
            <motion.div
              animate={{ x: ["-100%", "200%"] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
              className="absolute inset-0 bg-white/30 skew-x-12"
            />
          </motion.div>
        </div>

        <motion.span
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-3 text-[10px] text-white/30 font-mono tracking-tighter"
        >
          {Math.floor(progress)}%
        </motion.span>
      </div>

      {/* Decorative details */}
      <div className="absolute bottom-12 left-12 flex gap-4">
        <div className="w-1 h-1 bg-white/10 rounded-full" />
        <div className="w-1 h-1 bg-white/10 rounded-full" />
        <div className="w-1 h-1 bg-blue-500/20 rounded-full" />
      </div>
    </div>
  );
};

export default AsyncLoader;
