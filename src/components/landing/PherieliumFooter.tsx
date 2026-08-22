import React from "react";
import { Github, MessageSquare, Terminal, Heart, Shield, Radio } from "lucide-react";
import { pherieliumAudio } from "../../utils/pherieliumSound";

export const PherieliumFooter: React.FC = () => {
  return (
    <footer className="relative border-t border-white/8 bg-[#030408] py-16 px-4 sm:px-8 text-white/50 font-mono text-xs">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-8 pb-12 border-b border-white/8">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#7DFFB2]/10 border border-[#7DFFB2]/30 text-[#7DFFB2]">
              <img
                src="/Checkpoint_Logo.png"
                alt="Pherielium"
                className="h-5 w-5 object-contain"
              />
            </div>
            <div>
              <div className="text-sm font-extrabold text-white font-mono tracking-wider">
                PHERIELIUM
              </div>
              <div className="text-[10px] text-white/40 uppercase">
                PERSONAL GAMING HUB // v3.1.4
              </div>
            </div>
          </div>

          {/* Quick Links */}
          <div className="flex flex-wrap items-center gap-6 text-[11px] font-mono">
            <a
              href="#hub"
              onClick={() => pherieliumAudio.playClick(800)}
              className="hover:text-[#7DFFB2] transition"
            >
              HUB
            </a>
            <a
              href="#console"
              onClick={() => pherieliumAudio.playClick(800)}
              className="hover:text-[#7DFFB2] transition"
            >
              CONSOLE
            </a>
            <a
              href="#mods"
              onClick={() => pherieliumAudio.playClick(800)}
              className="hover:text-[#7DFFB2] transition"
            >
              MODS
            </a>
            <a
              href="#achievements"
              onClick={() => pherieliumAudio.playClick(800)}
              className="hover:text-[#7DFFB2] transition"
            >
              CONQUISTAS
            </a>
            <a
              href="#social"
              onClick={() => pherieliumAudio.playClick(800)}
              className="hover:text-[#7DFFB2] transition"
            >
              VOZ & SOCIAL
            </a>
            <a
              href="#overlay"
              onClick={() => pherieliumAudio.playClick(800)}
              className="hover:text-[#7DFFB2] transition"
            >
              OVERLAY
            </a>
            <a
              href="https://github.com/Guilhermesttt/Checkpoint---Launcher"
              target="_blank"
              rel="noreferrer"
              onClick={() => pherieliumAudio.playClick(800)}
              className="hover:text-white transition flex items-center gap-1"
            >
              <Github className="h-3 w-3" />
              GITHUB
            </a>
          </div>

          {/* System Telemetry Badge */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.03] border border-white/10 text-[10px]">
            <span className="h-2 w-2 rounded-full bg-[#7DFFB2] animate-pulse" />
            <span className="text-[#7DFFB2] font-bold">SYSTEM STATUS: ONLINE</span>
          </div>
        </div>

        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-white/35">
          <p>© {new Date().getFullYear()} Pherielium. All rights reserved.</p>
          <p className="flex items-center gap-1.5">
            Crafted for pure PC & Console Gaming Excellence.
          </p>
        </div>
      </div>
    </footer>
  );
};
