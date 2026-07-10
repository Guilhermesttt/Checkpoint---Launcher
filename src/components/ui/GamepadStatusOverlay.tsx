import React, { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Gamepad2 } from "lucide-react";
import { useGamepad } from "../../context/GamepadContext";
import { usePreferences } from "../../context/PreferencesContext";

export const GamepadStatusOverlay: React.FC = () => {
  const { isGamepadConnected } = useGamepad();
  const { visualTheme } = usePreferences();
  const [show, setShow] = useState(false);
  const [status, setStatus] = useState<"connected" | "disconnected" | null>(null);

  const getThemeClasses = () => {
    if (status === "disconnected") {
      return "bg-red-950/40 border-red-500/30 text-red-400";
    }
    switch (visualTheme) {
      case "gamecube": return "bg-purple-950/40 border-purple-500/30 text-purple-400";
      case "xbox360": return "bg-emerald-950/40 border-emerald-500/30 text-emerald-400";
      case "playstation": return "bg-blue-950/40 border-blue-500/30 text-blue-400";
      case "checkpoint":
      default: return "bg-white/10 border-white/30 text-white";
    }
  };

  useEffect(() => {
    // Only show notification after initial mount to prevent showing on startup
    if (status === null) {
      setStatus(isGamepadConnected ? "connected" : "disconnected");
      return;
    }

    if (isGamepadConnected && status !== "connected") {
      setStatus("connected");
      setShow(true);
    } else if (!isGamepadConnected && status !== "disconnected") {
      setStatus("disconnected");
      setShow(true);
    }

    const timer = setTimeout(() => {
      setShow(false);
    }, 3000);

    return () => clearTimeout(timer);
  }, [isGamepadConnected]);

  return (
    <div className="fixed top-8 left-1/2 -translate-x-1/2 z-[9999] pointer-events-none flex flex-col items-center">
      <AnimatePresence>
        {show && status && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className={`flex items-center gap-3 px-5 py-3 rounded-full backdrop-blur-xl border shadow-2xl ${getThemeClasses()}`}
          >
            <Gamepad2 className="w-5 h-5" strokeWidth={2.5} />
            <span className="font-sans font-bold text-sm tracking-wide text-white">
              {status === "connected" ? "Controle Conectado" : "Controle Desconectado"}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
