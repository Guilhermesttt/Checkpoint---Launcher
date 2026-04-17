import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, useMotionValue, useSpring, AnimatePresence } from "framer-motion";

interface DynamicBackgroundProps {
  backgroundImage?: string;
}

/**
 * PS5-style cinematic background with Liquid Glass aesthetics
 */
const DynamicBackground: React.FC<DynamicBackgroundProps> = ({
  backgroundImage,
}) => {
  // ── Crossfade state ──
  const [layers, setLayers] = useState<{ src: string; key: number }[]>(
    backgroundImage ? [{ src: backgroundImage, key: 0 }] : []
  );
  const layerCounter = useRef(0);
  const trimTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!backgroundImage) return;

    if (layers.length > 0 && layers[layers.length - 1].src === backgroundImage) return;

    layerCounter.current += 1;
    const newLayer = { src: backgroundImage, key: layerCounter.current };
    
    setLayers((prev) => [...prev.slice(-1), newLayer]);

    if (trimTimerRef.current) {
      window.clearTimeout(trimTimerRef.current);
    }
    trimTimerRef.current = window.setTimeout(() => {
      setLayers((prev) => prev.slice(-1));
    }, 650);
  }, [backgroundImage]);

  useEffect(() => {
    return () => {
      if (trimTimerRef.current) {
        window.clearTimeout(trimTimerRef.current);
      }
    };
  }, []);


  // ── Mouse parallax ──
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const parallaxX = useSpring(mouseX, { stiffness: 30, damping: 20 });
  const parallaxY = useSpring(mouseY, { stiffness: 30, damping: 20 });

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      const cx = window.innerWidth / 2;
      const cy = window.innerHeight / 2;
      mouseX.set(((e.clientX - cx) / cx) * -15);
      mouseY.set(((e.clientY - cy) / cy) * -10);
    },
    [mouseX, mouseY]
  );

  useEffect(() => {
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [handleMouseMove]);

  return (
    <div className="fixed inset-0 z-[-1] overflow-hidden bg-[#050507]">
      <div className="absolute inset-0 z-0">
        <AnimatePresence mode="popLayout">
          {layers.map((layer) => (
            <motion.div
              key={layer.key}
              initial={{ opacity: 0, scale: 1.08 }}
              animate={{ opacity: 0.65, scale: 1 }}
              exit={{ opacity: 0, transition: { duration: 0.55, ease: [0.16, 1, 0.3, 1] } }}
              transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
              className="absolute inset-[-60px]"
              style={{
                x: parallaxX,
                y: parallaxY,
              }}
            >
              <img
                src={layer.src}
                alt=""
                className="w-full h-full object-cover blur-[20px] scale-105"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  // If it's a Steam asset that failed, try the reliable header.jpg
                  if (target.src.includes('steamstatic.com') || target.src.includes('steamstatic.com')) {
                    const match = target.src.match(/\/apps\/(\d+)\//);
                    if (match && !target.src.includes('header.jpg')) {
                      target.src = `https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/${match[1]}/header.jpg`;
                    }
                  }
                }}
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* ── Cinematic Gradient Overlays (Fixed on top of images) ── */}
      <div className="absolute inset-0 z-10 pointer-events-none">
        {/* Main bottom gradient */}
        <div
          className="absolute inset-0"
          style={{
            background: `
              linear-gradient(to top, 
                #050507 0%, 
                rgba(5,5,7,0.95) 15%,
                rgba(5,5,7,0.7) 35%, 
                rgba(5,5,7,0.3) 55%, 
                rgba(5,5,7,0.1) 100%
              )
            `,
          }}
        />
        
        {/* Left vignette */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to right, rgba(5,5,7,0.95) 0%, rgba(5,5,7,0.6) 20%, transparent 45%)",
          }}
        />
        
        {/* Top subtle vignette */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to bottom, rgba(5,5,7,0.4) 0%, transparent 25%)",
          }}
        />

        {/* ── Liquid Glass Ambient Light Effects ── */}
        <motion.div
          animate={{
            opacity: [0.3, 0.5, 0.3],
            scale: [1, 1.1, 1],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="absolute top-[-30%] right-[-20%] w-[70%] h-[70%] rounded-full mix-blend-screen"
          style={{
            background:
              "radial-gradient(circle, rgba(59, 130, 246, 0.08) 0%, transparent 60%)",
            filter: "blur(120px)",
          }}
        />
        
        <motion.div
          animate={{
            opacity: [0.2, 0.4, 0.2],
            scale: [1, 1.15, 1],
          }}
          transition={{
            duration: 10,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 2,
          }}
          className="absolute bottom-[-20%] left-[-15%] w-[50%] h-[50%] rounded-full mix-blend-screen"
          style={{
            background:
              "radial-gradient(circle, rgba(139, 92, 246, 0.05) 0%, transparent 55%)",
            filter: "blur(100px)",
          }}
        />
      </div>

      <div className="absolute inset-0 pointer-events-none z-20">
        {PARTICLES.map((p, i) => (
          <motion.div
            key={i}
            animate={{
              y: [0, -20, 0],
              opacity: [p.opacity, p.opacity * 1.5, p.opacity],
            }}
            transition={{
              duration: p.duration,
              repeat: Infinity,
              ease: "easeInOut",
              delay: p.delay,
            }}
            className="absolute rounded-full"
            style={{
              top: p.top,
              left: p.left,
              width: p.size,
              height: p.size,
              background: `rgba(255,255,255,${p.opacity})`,
              filter: `blur(${p.blur}px)`,
              boxShadow: `0 0 ${parseInt(p.size) * 2}px rgba(255,255,255,${p.opacity * 0.5})`,
            }}
          />
        ))}
      </div>

      <motion.div
        animate={{
          borderRadius: [
            "60% 40% 30% 70% / 60% 30% 70% 40%",
            "30% 60% 70% 40% / 50% 60% 30% 60%",
            "50% 60% 30% 60% / 30% 40% 70% 50%",
            "60% 40% 30% 70% / 60% 30% 70% 40%",
          ],
        }}
        transition={{
          duration: 20,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        className="absolute top-[10%] right-[5%] w-[400px] h-[400px] opacity-[0.03]"
        style={{
          background: "linear-gradient(135deg, white 0%, transparent 50%)",
          filter: "blur(60px)",
        }}
      />

      <div
        className="absolute inset-0 opacity-[0.02] pointer-events-none mix-blend-overlay"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        }}
      />

      <div
        className="absolute inset-0 opacity-[0.015] pointer-events-none"
        style={{
          backgroundImage: `repeating-linear-gradient(
            0deg,
            transparent,
            transparent 2px,
            rgba(255,255,255,0.03) 2px,
            rgba(255,255,255,0.03) 4px
          )`,
        }}
      />
    </div>
  );
};


/** Bokeh particle presets */
const PARTICLES = [
  { top: "12%", left: "6%", size: "6px", opacity: 0.15, blur: 1, delay: 0, duration: 7 },
  { top: "55%", left: "85%", size: "8px", opacity: 0.1, blur: 2, delay: 2, duration: 9 },
  { top: "28%", left: "45%", size: "4px", opacity: 0.2, blur: 0.5, delay: 1, duration: 6 },
  { top: "6%", left: "75%", size: "10px", opacity: 0.06, blur: 3, delay: 3.5, duration: 10 },
  { top: "72%", left: "22%", size: "3px", opacity: 0.25, blur: 0, delay: 0.5, duration: 5 },
  { top: "42%", left: "90%", size: "7px", opacity: 0.08, blur: 2, delay: 4, duration: 8 },
  { top: "85%", left: "60%", size: "5px", opacity: 0.12, blur: 1, delay: 2.5, duration: 7 },
  { top: "18%", left: "35%", size: "4px", opacity: 0.18, blur: 0.5, delay: 1.5, duration: 6 },
];

export default DynamicBackground;
