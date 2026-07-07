import React from "react";
import { motion } from "framer-motion";

const LoadingSkeleton: React.FC = () => {
  const items = [1, 2, 3, 4, 5, 6];
  
  return (
    <div className="w-full pt-16 pb-10 overflow-hidden">
      <div className="flex items-end px-[50vw] -translate-x-[110px]">
        {items.map((i) => (
          <div
            key={i}
            className="shrink-0 mr-5"
            style={{
              width: i === 1 ? 240 : 180,
              height: i === 1 ? 340 : 260,
            }}
          >
            <div className="w-full h-full rounded-2xl bg-white/[0.03] border border-white/5 animate-pulse shadow-[0_0_20px_rgba(255,255,255,0.02)] backdrop-blur-sm" />
          </div>
        ))}
      </div>
    </div>
  );
};

export default LoadingSkeleton;
