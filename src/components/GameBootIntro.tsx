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
    
    // Começa a fazer o fade-out 1 segundo antes do vídeo terminar
    // para que a tela principal apareça de forma suave
    const timeRemaining = videoRef.current.duration - videoRef.current.currentTime;
    if (timeRemaining <= 1.0) {
      finishedRef.current = true;
      onFinish?.();
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 1.0, ease: "easeInOut" }}
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
        className="w-full h-full object-cover"
        src="/CheckPoint Intro.mp4"
      />
    </motion.div>
  );
};

export default GameBootIntro;
