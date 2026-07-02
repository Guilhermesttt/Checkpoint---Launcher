import React, { useRef, useEffect, useState } from "react";
import { motion } from "framer-motion";

interface GameBootIntroProps {
  onFinish?: () => void;
}

const GameBootIntro: React.FC<GameBootIntroProps> = ({ onFinish }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const finishedRef = useRef(false);
  const [isFadingOut, setIsFadingOut] = useState(false);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = 0.5;
      videoRef.current.play().catch((err) => {
        console.warn("Autoplay with audio blocked or failed:", err);
        if (!videoRef.current) return;
        videoRef.current.muted = true;
        void videoRef.current.play();
      });
    }
  }, []);

  const handleFinish = () => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    setIsFadingOut(true);
    window.setTimeout(() => onFinish?.(), 650);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: isFadingOut ? 0 : 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: isFadingOut ? 0.65 : 0.5, ease: "easeInOut" }}
      className="fixed inset-0 z-500 bg-black flex items-center justify-center overflow-hidden pointer-events-none"
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        onEnded={handleFinish}
        muted={false}
        className="absolute inset-0 h-full w-full object-cover"
        src="/Checkpoint-Intro.mp4"
      />
    </motion.div>
  );
};

export default GameBootIntro;
