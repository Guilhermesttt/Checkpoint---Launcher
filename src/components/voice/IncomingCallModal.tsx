import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Phone, PhoneOff, Video } from "lucide-react";
import type { CallInvitePayload } from "../../services/voiceCall";

interface IncomingCallModalProps {
  isOpen: boolean;
  invite: CallInvitePayload | null;
  onAccept: () => void;
  onReject: () => void;
}

export const IncomingCallModal: React.FC<IncomingCallModalProps> = ({
  isOpen,
  invite,
  onAccept,
  onReject,
}) => {
  if (!isOpen || !invite) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
        <motion.div
          initial={{ scale: 0.85, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.85, opacity: 0, y: 20 }}
          transition={{ type: "spring", stiffness: 350, damping: 25 }}
          className="relative w-full max-w-sm overflow-hidden rounded-3xl border border-white/15 bg-gradient-to-b from-[#18181b]/95 to-[#09090b]/95 p-6 text-center shadow-[0_25px_70px_rgba(0,0,0,0.8)] backdrop-blur-2xl"
        >
          {/* Background Ambient Glow */}
          <div className="pointer-events-none absolute -top-12 left-1/2 -translate-x-1/2 h-32 w-32 rounded-full bg-white/10 blur-3xl" />

          <div className="flex flex-col items-center">
            {/* Caller Avatar with Animated Pulse Rings */}
            <div className="relative mb-5 flex items-center justify-center">
              <motion.div
                animate={{ scale: [1, 1.25, 1], opacity: [0.5, 0, 0.5] }}
                transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                className="absolute h-24 w-24 rounded-full bg-white/15"
              />
              <motion.div
                animate={{ scale: [1, 1.15, 1], opacity: [0.7, 0.1, 0.7] }}
                transition={{ repeat: Infinity, duration: 2, delay: 0.3, ease: "easeInOut" }}
                className="absolute h-20 w-20 rounded-full border border-white/30"
              />

              <div className="relative h-18 w-18 overflow-hidden rounded-full border-2 border-white/40 bg-black/40 shadow-[0_0_20px_rgba(255,255,255,0.2)]">
                {invite.callerAvatar ? (
                  <img
                    src={invite.callerAvatar}
                    alt={invite.callerName}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-white/10 text-xl font-black text-white">
                    {invite.callerName.slice(0, 2).toUpperCase()}
                  </div>
                )}
              </div>
            </div>

            {/* Caller Info */}
            <h3 className="text-lg font-black tracking-tight text-white">
              {invite.callerName}
            </h3>
            <p className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-white/80">
              {invite.hasVideo ? (
                <>
                  <Video className="h-3.5 w-3.5 animate-pulse" /> Chamada de Vídeo
                </>
              ) : (
                <>
                  <Phone className="h-3.5 w-3.5 animate-pulse" /> Chamada de Voz
                </>
              )}
            </p>
            <p className="mt-0.5 text-[11px] text-white/40">
              Ligando para você no Checkpoint...
            </p>

            {/* Action Buttons */}
            <div className="mt-7 flex w-full items-center justify-center gap-5">
              {/* Reject Button */}
              <button
                type="button"
                onClick={onReject}
                className="group flex flex-col items-center gap-1.5 focus:outline-none cursor-pointer"
              >
                <div className="flex h-13 w-13 items-center justify-center rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30 transition-all duration-200 group-hover:scale-110 group-hover:bg-rose-600 group-hover:text-white group-active:scale-95 shadow-[0_0_20px_rgba(244,63,94,0.2)]">
                  <PhoneOff className="h-6 w-6" />
                </div>
                <span className="text-[10px] font-bold text-white/60 group-hover:text-white">
                  Recusar
                </span>
              </button>

              {/* Accept Button */}
              <button
                type="button"
                onClick={onAccept}
                className="group flex flex-col items-center gap-1.5 focus:outline-none cursor-pointer"
              >
                <div className="flex h-13 w-13 items-center justify-center rounded-full bg-white text-black transition-all duration-200 group-hover:scale-110 group-hover:bg-white/90 group-active:scale-95 shadow-[0_0_30px_rgba(255,255,255,0.4)]">
                  <Phone className="h-6 w-6" />
                </div>
                <span className="text-[10px] font-bold text-white/80 group-hover:text-white">
                  Atender
                </span>
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
