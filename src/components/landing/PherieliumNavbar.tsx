import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Volume2, VolumeX, Menu, X, Shield, Terminal, Download } from "lucide-react";
import { pherieliumAudio } from "../../utils/pherieliumSound";

interface PherieliumNavbarProps {
  onEnterSystem?: () => void;
}

export const PherieliumNavbar: React.FC<PherieliumNavbarProps> = ({ onEnterSystem }) => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const toggleSound = () => {
    const nextMuted = pherieliumAudio.toggleMute();
    setIsMuted(nextMuted);
    if (!nextMuted) {
      pherieliumAudio.playClick(900);
    }
  };

  const navLinks = [
    { label: "GAMING HUB", href: "#hub" },
    { label: "CONSOLE SOUL", href: "#console" },
    { label: "LIBRARY", href: "#library" },
    { label: "MODS", href: "#mods" },
    { label: "ACHIEVEMENTS", href: "#achievements" },
    { label: "SOCIAL & CALLS", href: "#social" },
    { label: "IN-GAME OVERLAY", href: "#overlay" },
    { label: "THEMES", href: "#themes" },
    { label: "VISION", href: "#vision" },
  ];

  return (
    <header className="fixed top-0 left-0 right-0 z-50 transition-all duration-500 px-4 sm:px-8 pt-4 sm:pt-6">
      <nav
        className={`mx-auto max-w-7xl transition-all duration-500 rounded-2xl border ${
          isScrolled
            ? "bg-[#05070B]/85 border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.8)] backdrop-blur-2xl py-3 px-5 sm:px-6"
            : "bg-[#080B10]/40 border-white/5 backdrop-blur-md py-4 px-6"
        }`}
      >
        <div className="flex items-center justify-between">
          {/* Brand Logo & Orbital Symbol */}
          <a
            href="#"
            onClick={() => pherieliumAudio.playClick(750)}
            className="flex items-center gap-3.5 group cursor-pointer"
          >
            <div className="relative flex items-center justify-center h-9 w-9 rounded-xl bg-gradient-to-br from-[#7DFFB2]/20 via-black to-[#7DFFB2]/5 border border-[#7DFFB2]/30 shadow-[0_0_15px_rgba(125,255,178,0.25)] group-hover:border-[#7DFFB2] group-hover:shadow-[0_0_22px_rgba(125,255,178,0.5)] transition-all duration-300">
              {/* Orbital Ring Animation */}
              <div className="absolute inset-0 rounded-xl border border-[#7DFFB2]/40 animate-ping opacity-25" />
              <img
                src="/Checkpoint_Logo.png"
                alt="Pherielium Logo"
                className="h-5 w-5 object-contain filter drop-shadow-[0_0_8px_rgba(125,255,178,0.6)]"
              />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="font-extrabold tracking-wider text-sm sm:text-base text-white font-mono">
                  PHERIELIUM
                </span>
                <span className="hidden sm:inline-block text-[9px] font-bold uppercase tracking-widest text-[#7DFFB2] bg-[#7DFFB2]/10 border border-[#7DFFB2]/30 px-1.5 py-0.5 rounded">
                  HUB
                </span>
              </div>
              <span className="text-[9px] font-mono tracking-widest text-white/40 uppercase">
                GAMING OS // v3.1.4
              </span>
            </div>
          </a>

          {/* Desktop Nav Links */}
          <div className="hidden lg:flex items-center gap-6 xl:gap-8">
            {navLinks.map((item) => (
              <a
                key={item.label}
                href={item.href}
                onMouseEnter={() => pherieliumAudio.playHover()}
                onClick={() => pherieliumAudio.playClick(850)}
                className="text-[11px] font-mono tracking-widest text-white/60 hover:text-[#7DFFB2] transition-colors relative py-1 group uppercase"
              >
                {item.label}
                <span className="absolute bottom-0 left-0 w-0 h-[1.5px] bg-[#7DFFB2] transition-all duration-300 group-hover:w-full" />
              </a>
            ))}
          </div>

          {/* System Telemetry & CTA Actions */}
          <div className="flex items-center gap-3">
            {/* System Online Telemetry Badge */}
            <div className="hidden md:flex items-center gap-2 bg-white/[0.03] border border-white/8 px-2.5 py-1.5 rounded-lg text-[10px] font-mono text-white/50">
              <span className="h-1.5 w-1.5 rounded-full bg-[#7DFFB2] animate-pulse" />
              <span className="text-[#7DFFB2] font-semibold">ONLINE</span>
            </div>

            {/* Audio Feedback Toggle */}
            <button
              type="button"
              onClick={toggleSound}
              title={isMuted ? "Ativar som de interface" : "Silenciar interface"}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-white/60 hover:border-white/25 hover:text-white hover:bg-white/[0.08] transition cursor-pointer"
            >
              {isMuted ? <VolumeX className="h-4 w-4 text-white/40" /> : <Volume2 className="h-4 w-4 text-[#7DFFB2]" />}
            </button>

            {/* Enter / Download CTA */}
            <a
              href="/download"
              onMouseEnter={() => pherieliumAudio.playHover()}
              onClick={() => {
                pherieliumAudio.playBootSequence();
                onEnterSystem?.();
              }}
              className="relative inline-flex items-center gap-2 px-4 sm:px-5 py-2 rounded-xl text-xs font-bold font-mono tracking-wide text-black bg-[#7DFFB2] hover:bg-[#8CFF5A] shadow-[0_0_20px_rgba(125,255,178,0.35)] hover:shadow-[0_0_28px_rgba(125,255,178,0.6)] transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer"
            >
              <Download className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">ENTER PHERIELIUM</span>
              <span className="sm:hidden">BAIXAR</span>
            </a>

            {/* Mobile Menu Button */}
            <button
              type="button"
              onClick={() => {
                pherieliumAudio.playClick(600);
                setIsMobileOpen(!isMobileOpen);
              }}
              className="lg:hidden flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-white hover:bg-white/10 transition cursor-pointer"
              aria-label="Abrir menu"
            >
              {isMobileOpen ? <X className="h-5 w-5 text-white" /> : <Menu className="h-5 w-5 text-white" />}
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile Drawer */}
      <AnimatePresence>
        {isMobileOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.2 }}
            className="lg:hidden mt-2 mx-auto max-w-7xl rounded-2xl border border-white/10 bg-[#080B10]/95 backdrop-blur-2xl p-6 shadow-2xl overflow-hidden"
          >
            <div className="flex flex-col gap-4">
              <div className="text-[10px] font-mono tracking-widest text-[#7DFFB2] uppercase mb-1">
                // PHERIELIUM NAVIGATION MODULE
              </div>
              {navLinks.map((item) => (
                <a
                  key={item.label}
                  href={item.href}
                  onClick={() => {
                    pherieliumAudio.playClick(850);
                    setIsMobileOpen(false);
                  }}
                  className="flex items-center justify-between text-sm font-mono tracking-wider text-white/80 hover:text-[#7DFFB2] py-2 border-b border-white/5 transition"
                >
                  <span>{item.label}</span>
                  <span className="text-[10px] text-white/30 font-mono">↗</span>
                </a>
              ))}
              <a
                href="/download"
                onClick={() => {
                  pherieliumAudio.playBootSequence();
                  setIsMobileOpen(false);
                }}
                className="mt-2 w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-[#7DFFB2] text-black font-mono font-bold text-xs tracking-wider"
              >
                <Download className="h-4 w-4" />
                ENTER PHERIELIUM (WINDOWS PC)
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
};
