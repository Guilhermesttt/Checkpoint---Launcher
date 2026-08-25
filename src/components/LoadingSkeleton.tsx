import React from "react";
import { motion } from "framer-motion";

const CARD_WIDTH = 168;
const CARD_HEIGHT = 252;

const LoadingSkeleton: React.FC = () => {
  const cards = [-2, -1, 0, 1, 2];

  return (
    <div className="w-full flex-1 flex flex-col justify-between overflow-hidden select-none pointer-events-none">
      {/* Top Hero Stage Skeleton */}
      <div className="px-10 pb-4 shrink-0 flex items-end justify-between gap-8 mt-auto">
        <div className="space-y-3 min-w-0 flex-1">
          {/* Category / Position Pill */}
          <div className="flex items-center gap-2">
            <div className="h-3 w-28 rounded-full bg-white/[0.06] animate-pulse" />
          </div>

          {/* Large Title Skeleton */}
          <div className="h-10 md:h-12 w-72 md:w-96 rounded-2xl bg-white/[0.08] animate-pulse shadow-sm" />

          {/* Meta Tags Row */}
          <div className="flex items-center gap-2.5 pt-1">
            <div className="h-6 w-20 rounded-full bg-[#16171c]/90 border border-white/[0.08] animate-pulse" />
            <div className="h-6 w-24 rounded-full bg-[#16171c]/70 border border-white/[0.06] animate-pulse" />
            <div className="h-6 w-16 rounded-full bg-[#16171c]/90 border border-white/[0.08] animate-pulse" />
          </div>
        </div>

        {/* Action Button Skeleton */}
        <div className="shrink-0">
          <div className="h-12 w-36 rounded-full bg-white/[0.08] border border-white/[0.12] animate-pulse flex items-center justify-center shadow-lg" />
        </div>
      </div>

      {/* Game Cards Carousel Skeleton */}
      <div className="shrink-0 pb-14 pt-6">
        <div className="relative w-full overflow-hidden flex items-center justify-center">
          <div className="flex items-center gap-3">
            {cards.map((offset) => {
              const isCenter = offset === 0;
              return (
                <motion.div
                  key={offset}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: isCenter ? 1.05 : 0.95 }}
                  transition={{ duration: 0.4 }}
                  className={`relative overflow-hidden rounded-[28px] bg-[#090A0D]/90 border backdrop-blur-xl p-3 flex flex-col justify-between transition-all ${
                    isCenter
                      ? "border-white/30 shadow-[0_20px_50px_rgba(0,0,0,0.95),0_0_30px_rgba(255,255,255,0.15)] z-20"
                      : "border-white/[0.06] shadow-[0_10px_28px_rgba(0,0,0,0.7)] opacity-60 z-10"
                  }`}
                  style={{
                    width: CARD_WIDTH,
                    height: CARD_HEIGHT,
                  }}
                >
                  {/* Top Badges */}
                  <div className="flex items-center justify-between">
                    <div className="h-5 w-14 rounded-full bg-white/[0.08] animate-pulse" />
                    {isCenter && <div className="h-5 w-5 rounded-full bg-white/[0.08] animate-pulse" />}
                  </div>

                  {/* Central Shimmer Area */}
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.04] to-transparent bg-[length:200%_100%] animate-pulse pointer-events-none" />

                  {/* Bottom Title Skeleton */}
                  <div className="space-y-1.5 z-10 mt-auto">
                    <div className="h-3.5 w-3/4 rounded-md bg-white/[0.12] animate-pulse" />
                    <div className="h-2.5 w-1/2 rounded-md bg-white/[0.06] animate-pulse" />
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Carousel Pagination Dots Skeleton */}
        <div className="flex justify-center mt-6 gap-1.5">
          <div className="h-[3px] w-7 rounded-full bg-white/60 animate-pulse" />
          <div className="h-[3px] w-1.5 rounded-full bg-white/20" />
          <div className="h-[3px] w-1.5 rounded-full bg-white/20" />
          <div className="h-[3px] w-1.5 rounded-full bg-white/20" />
          <div className="h-[3px] w-1.5 rounded-full bg-white/20" />
        </div>
      </div>
    </div>
  );
};

export default LoadingSkeleton;
