import React, { useRef, useEffect } from "react";
import { motion } from "framer-motion";

interface GameBootIntroProps {
  onFinish?: () => void;
}

const GameBootIntro: React.FC<GameBootIntroProps> = ({ onFinish }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const finishedRef = useRef(false);

  useEffect(() => {
    // Optionally lower the volume if the video is too loud
    if (videoRef.current) {
      videoRef.current.volume = 0.5;
    }
  }, []);

  const handleTimeUpdate = () => {
    if (!videoRef.current || finishedRef.current) return;
    
    // Fade visual e de áudio bem pertinho do fim (0.5s)
    const timeRemaining = videoRef.current.duration - videoRef.current.currentTime;
    if (timeRemaining <= 0.5) {
      finishedRef.current = true;
      // Fade de áudio manual de 500ms
      const startVolume = videoRef.current.volume;
      const fadeInterval = setInterval(() => {
        if (!videoRef.current) {
          clearInterval(fadeInterval);
          return;
        }
        let nextVol = videoRef.current.volume - (startVolume / 10);
        if (nextVol <= 0) {
          nextVol = 0;
          clearInterval(fadeInterval);
        }
        videoRef.current.volume = nextVol;
      }, 50);

      onFinish?.();
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5, ease: "easeInOut" }}
      className="fixed inset-0 z-[500] bg-black flex items-center justify-center overflow-hidden pointer-events-none"
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        onTimeUpdate={handleTimeUpdate}
        onEnded={() => {
          if (!finishedRef.current) {
            finishedRef.current = true;
            onFinish?.();
          }
        }}
        muted={false} // Ensure audio plays if the video has it
        className="w-full h-full object-cover filter contrast-[1.15] saturate-[1.1] brightness-[1.05]"
        src="/CheckPoint Intro.mp4"
      />
      
      {/* Overlay de Vinheta e Ruído (Esconde totalmente os artefatos de 720p) */}
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(0,0,0,0.4)_100%)] mix-blend-multiply" />
      <div 
        className="absolute inset-0 pointer-events-none opacity-[0.04] mix-blend-overlay"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`
        }} 
      />
    </motion.div>
  );
};

export default GameBootIntro;
