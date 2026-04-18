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
        className="w-full h-full object-cover"
        src="/CheckPoint Intro.mp4"
      />
    </motion.div>
  );
};

export default GameBootIntro;
