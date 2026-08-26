import React, { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Gamepad2 } from "lucide-react";
import { useGamepad } from "../../context/GamepadContext";

export const GamepadStatusOverlay: React.FC = () => {
  const { isGamepadConnected } = useGamepad();
  const [show, setShow] = useState(false);
  const [status, setStatus] = useState<"connected" | "disconnected" | null>(null);

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

  const isConnected = status === "connected";

  return (
    <div className="fixed top-8 left-1/2 -translate-x-1/2 z-[9999] pointer-events-none flex flex-col items-center">
      <AnimatePresence>
        {show && status && (
          <motion.div
            initial={{ opacity: 0, y: -18, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.96 }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            className="relative flex items-center gap-3 pl-3.5 pr-5 py-2.5 rounded-full backdrop-blur-2xl border border-white/[0.08] bg-white/[0.04] shadow-[0_20px_50px_rgba(0,0,0,0.7)]"
          >
            {/* Halo pulsante atrás do ícone — único indicador de estado, sem matiz de cor */}
            <span className="relative flex items-center justify-center w-8 h-8 rounded-full bg-white/[0.05] border border-white/[0.12]">
              <motion.span
                animate={
                  isConnected
                    ? { scale: [1, 1.6, 1], opacity: [0.35, 0, 0.35] }
                    : { scale: 1, opacity: 0 }
                }
                transition={{ duration: 1.8, repeat: isConnected ? Infinity : 0, ease: "easeInOut" }}
                className="absolute inset-0 rounded-full bg-white"
              />
              <Gamepad2
                className={`relative w-4 h-4 transition-colors duration-300 ${isConnected ? "text-white" : "text-white/35"
                  }`}
                strokeWidth={2.25}
              />
            </span>

            <div className="flex flex-col leading-tight">
              <span className="font-display font-semibold text-[13px] tracking-tight text-white">
                {isConnected ? "Controle conectado" : "Controle desconectado"}
              </span>
              {/* Ponto de status: cheio e brilhante quando conectado, oco e apagado quando não */}
              <span className="flex items-center gap-1.5 mt-0.5">
                <span
                  className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${isConnected
                      ? "bg-white shadow-[0_0_8px_rgba(255,255,255,0.7)]"
                      : "bg-transparent border border-white/30"
                    }`}
                />
                <span className="font-body text-[10px] uppercase tracking-[0.16em] text-white/40">
                  {isConnected ? "Pronto para jogar" : "Sem sinal"}
                </span>
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};