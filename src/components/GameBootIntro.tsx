import React, { useRef, useEffect, useLayoutEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { setLauncherInputLocked } from "../utils/launcherInputLock";
import checkpointIntroVideo from "../assets/Checkpoint_Intro.mp4";

interface GameBootIntroProps {
  onFinish?: () => void;
}

const GameBootIntro: React.FC<GameBootIntroProps> = ({ onFinish }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const finishedRef = useRef(false);
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [showSkipHint, setShowSkipHint] = useState(false);

  useLayoutEffect(() => {
    setLauncherInputLocked(true);

    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }

    const blockInteraction = (event: Event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
    };
    const blockedEvents = [
      "keyup",
      "keypress",
    ];

    blockedEvents.forEach((eventName) => {
      window.addEventListener(eventName, blockInteraction, { capture: true, passive: false });
    });

    // Allow skipping with any key (keydown for responsiveness)
    const handleKeySkip = () => handleFinish();
    window.addEventListener("keydown", handleKeySkip, { capture: true });

    return () => {
      setLauncherInputLocked(false);
      blockedEvents.forEach((eventName) => {
        window.removeEventListener(eventName, blockInteraction, { capture: true });
      });
      window.removeEventListener("keydown", handleKeySkip, { capture: true });
    };
  }, []);

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

    // Show skip hint after 1 second
    const hintTimer = window.setTimeout(() => setShowSkipHint(true), 1000);
    return () => window.clearTimeout(hintTimer);
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
      className="fixed inset-0 z-500 bg-black flex items-center justify-center overflow-hidden pointer-events-auto cursor-default"
      role="presentation"
      onClick={handleFinish}
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        preload="auto"
        onEnded={handleFinish}
        onError={handleFinish}
        muted={false}
        className="absolute inset-0 h-full w-full object-cover"
        src={checkpointIntroVideo}
      />

      {/* Skip hint */}
      <AnimatePresence>
        {showSkipHint && !isFadingOut && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="absolute bottom-8 right-8 z-10 flex items-center gap-2 select-none"
            style={{ pointerEvents: "none" }}
          >
            <span style={{
              fontFamily: "'Inter', 'Segoe UI', sans-serif",
              fontSize: "0.8rem",
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "rgba(255,255,255,0.55)",
              textShadow: "0 1px 8px rgba(0,0,0,0.8)",
            }}>
              Clique ou pressione qualquer tecla para pular
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default GameBootIntro;
