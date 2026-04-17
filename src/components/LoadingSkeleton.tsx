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
            <motion.div
              animate={{
                opacity: [0.3, 0.6, 0.3],
              }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                ease: "easeInOut",
              }}
              className="w-full h-full rounded-2xl bg-white/5 border border-white/5"
            />
          </div>
        ))}
      </div>
    </div>
  );
};

export default LoadingSkeleton;
