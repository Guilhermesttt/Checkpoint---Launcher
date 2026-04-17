import React, { useEffect } from "react";
import { motion } from "framer-motion";
import { useSoundEffects } from "../hooks/useSoundEffects";

interface GameBootIntroProps {}

const GameBootIntro: React.FC<GameBootIntroProps> = () => {
  const { playSound } = useSoundEffects();

  useEffect(() => {
    // Play the boot sound exactly when the white flash starts (2.2s)
    const soundTimer = setTimeout(() => {
      playSound("boot");
    }, 2200);
    
    return () => clearTimeout(soundTimer);
  }, [playSound]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="fixed inset-0 z-[500] bg-[#000000] flex flex-col items-center justify-center overflow-hidden"
    >
      {/* Background Glow Effect */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ 
          opacity: [0, 0.4, 0.2], 
        }}
        transition={{ duration: 2.5, ease: "easeOut" }}
        className="absolute inset-0 pointer-events-none"
        style={{
          background: "radial-gradient(circle at center, rgba(59, 130, 246, 0.12) 0%, rgba(37, 99, 235, 0.04) 40%, transparent 80%)"
        }}
      />

      {/* Grid Pattern (Subtle) */}
      <div 
        className="absolute inset-0 opacity-[0.02] pointer-events-none"
        style={{
          backgroundImage: `linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)`,
          backgroundSize: '40px 40px'
        }}
      />

      {/* Main Content Container */}
      <div className="relative flex flex-col items-center">
        
        {/* The Icon */}
        <motion.div
          initial={{ opacity: 0, scale: 0.6, rotateY: 90, filter: "blur(12px)" }}
          animate={{ opacity: 1, scale: 1, rotateY: 0, filter: "blur(0px)" }}
          transition={{ 
            duration: 1.2, 
            delay: 0.1,
            ease: [0.22, 1, 0.36, 1] 
          }}
          className="mb-8 relative"
          style={{ perspective: "1000px" }}
        >
          {/* Icon Glow Aura */}
          <motion.div
            animate={{ 
              scale: [1, 1.15, 1],
              opacity: [0.4, 0.7, 0.4]
            }}
            transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
            className="absolute inset-0 bg-blue-500/20 blur-2xl rounded-full"
          />

          <svg width="120" height="120" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="relative z-10">
            <defs>
              <linearGradient id="iconGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#ffffff" />
                <stop offset="50%" stopColor="#60a5fa" />
                <stop offset="100%" stopColor="#2563eb" />
              </linearGradient>
              <filter id="glow-heavy">
                <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
                <feMerge>
                  <feMergeNode in="coloredBlur"/>
                  <feMergeNode in="SourceGraphic"/>
                </feMerge>
              </filter>
            </defs>
            <motion.path
              d="M50 5 L90 25 L90 75 L50 95 L10 75 L10 25 Z"
              stroke="url(#iconGradient)"
              strokeWidth="1.5"
              fill="rgba(59, 130, 246, 0.04)"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 1.4, delay: 0.3, ease: "easeInOut" }}
            />
            <motion.path
              d="M30 50 L45 65 L75 35"
              stroke="white"
              strokeWidth="5"
              strokeLinecap="round"
              strokeLinejoin="round"
              filter="url(#glow-heavy)"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: 0.8, delay: 1.5, ease: "backOut" }}
            />
          </svg>
        </motion.div>

        {/* The Text */}
        <div className="text-center">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.2, delay: 0.8 }}
            className="relative"
          >
            <h1 className="text-white text-4xl font-extralight uppercase tracking-[0.5em] relative z-10">
              Checkpoint
            </h1>
            {/* Shimmer overlay */}
            <motion.div
              animate={{ x: ["-100%", "200%"] }}
              transition={{ duration: 2.5, repeat: Infinity, delay: 1.5, repeatDelay: 1 }}
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-12 z-20 pointer-events-none"
            />
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0, letterSpacing: "0.1em" }}
            animate={{ opacity: 1, letterSpacing: "0.35em" }}
            transition={{ duration: 1.5, delay: 1.8 }}
            className="mt-5 flex items-center justify-center gap-5"
          >
            <div className="h-[1px] w-10 bg-gradient-to-r from-transparent via-blue-500/40 to-blue-400" />
            <span className="text-blue-400/90 text-xs font-light uppercase">
              Game Launcher
            </span>
            <div className="h-[1px] w-10 bg-gradient-to-l from-transparent via-blue-500/40 to-blue-400" />
          </motion.div>
        </div>
      </div>

      {/* Floating Particles (Crystal Cubes) */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {[...Array(6)].map((_, i) => (
          <motion.div
            key={i}
            initial={{ 
              opacity: 0, 
              x: (Math.random() * 100) + "%", 
              y: "110%",
              scale: Math.random() * 0.4 + 0.4,
            }}
            animate={{ 
              opacity: [0, 0.12, 0],
              y: "-10%",
              rotate: (Math.random() * 360) + 720
            }}
            transition={{ 
              duration: 4 + Math.random() * 3, 
              repeat: Infinity,
              delay: Math.random() * 3,
              ease: "linear"
            }}
            className="absolute w-5 h-5 border border-blue-400/5 bg-blue-500/5 backdrop-blur-[1px]"
          />
        ))}
      </div>

      {/* Final Flash and Transition Shimmer */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 1, 0] }}
        transition={{ delay: 2.2, duration: 0.5 }}
        className="absolute inset-0 bg-white/20 backdrop-blur-[4px] z-[600] pointer-events-none"
      />
    </motion.div>
  );
};

export default GameBootIntro;
