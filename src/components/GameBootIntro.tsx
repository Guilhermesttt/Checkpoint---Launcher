import React, { useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { useLottie } from "lottie-react";
import animationData from "../animationData.json";

interface GameBootIntroProps {
  onFinish?: () => void;
}

const GameBootIntro: React.FC<GameBootIntroProps> = ({ onFinish }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const finishedRef = useRef(false);

  // useLottie is often more stable in mixed ESM environments
  const { View } = useLottie({
    animationData: animationData,
    loop: false,
    autoplay: true,
    rendererSettings: {
      preserveAspectRatio: "xMidYMid slice",
    },
  }, { 
    width: "100%", 
    height: "100%",
    position: "absolute",
    top: 0,
    left: 0
  });

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = 0.5;
      // Explicitly call play() to ensure audio starts
      videoRef.current.play().catch(err => {
        console.warn("Autoplay with audio blocked or failed:", err);
      });
    }
  }, []);

  const handleFinish = () => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    onFinish?.();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5, ease: "easeInOut" }}
      className="fixed inset-0 z-[500] bg-black flex items-center justify-center overflow-hidden pointer-events-none"
    >
      {/* Lottie for high-quality vector visuals */}
      <div className="w-full h-full flex items-center justify-center">
        {View}
      </div>

      {/* Hidden video for synchronized audio track */}
      {/* We use opacity-0 instead of display:none (hidden) to ensure the browser keeps the video "active" and playing */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        onEnded={handleFinish}
        muted={false}
        className="absolute opacity-0 pointer-events-none w-0 h-0"
        src="/CheckPoint Intro.mp4"
      />
    </motion.div>
  );
};


export default GameBootIntro;


