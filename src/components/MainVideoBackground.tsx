import React from "react";

const MainVideoBackground: React.FC = () => {
  return (
    <div className="fixed inset-0 z-[-50] overflow-hidden pointer-events-none bg-[#050507]">
      <div className="absolute inset-0 flex items-center justify-center">
        <video
          autoPlay
          loop
          muted
          playsInline
          className="absolute w-[100vh] h-[100vw] object-cover opacity-20 transition-opacity duration-1000"
          style={{
            transform: "rotate(90deg)",
          }}
        >
          <source
            src="/PinDown.io_@sebasoler__1776538674.mp4"
            type="video/mp4"
          />
        </video>
      </div>
      
      {/* Cinematic Overlay for depth and readability */}
      <div 
        className="absolute inset-0 z-10"
        style={{
          background: "radial-gradient(circle at center, transparent 0%, rgba(5, 5, 7, 0.4) 100%), linear-gradient(to bottom, rgba(5, 5, 7, 0.3), rgba(5, 5, 7, 0.6))"
        }}
      />
      
      {/* Noise/Grain texture for premium feel */}
      <div
        className="absolute inset-0 opacity-[0.03] z-20 mix-blend-overlay pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        }}
      />
    </div>
  );
};

export default MainVideoBackground;
