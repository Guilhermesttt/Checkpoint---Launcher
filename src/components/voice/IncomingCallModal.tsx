import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Phone, PhoneOff, Video } from "lucide-react";
import { Button } from "@/components/ui/Shandc/button";
import { Badge } from "@/components/ui/Shandc/badge";
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
      <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/70 p-4 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 14 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 14 }}
          transition={{ type: "spring", stiffness: 380, damping: 28 }}
          className="relative w-full max-w-[360px] overflow-hidden rounded-[28px] border border-white/[0.12] bg-[#0d0d0f]/95 shadow-[0_30px_100px_rgba(0,0,0,0.75)] backdrop-blur-2xl"
        >
          {/* Ambient light */}
          <div className="pointer-events-none absolute left-1/2 top-[-90px] h-48 w-48 -translate-x-1/2 rounded-full bg-white/[0.07] blur-3xl" />

          <div className="relative p-6">
            {/* Top status */}
            <div className="mb-7 flex items-center justify-between">
              <Badge
                variant="outline"
                className="h-6 gap-1.5 rounded-full border-white/10 bg-white/[0.04] px-2.5 text-[10px] font-bold uppercase tracking-wider text-white/60"
              >
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                Chamada recebida
              </Badge>

              <span className="text-[10px] font-semibold text-white/30">
                Phelierium
              </span>
            </div>

            <div className="flex flex-col items-center text-center">
              {/* Avatar */}
              <div className="relative mb-5 flex h-[104px] w-[104px] items-center justify-center">
                <motion.div
                  animate={{ scale: [0.92, 1.14, 0.92], opacity: [0.18, 0.02, 0.18] }}
                  transition={{ repeat: Infinity, duration: 2.2, ease: "easeInOut" }}
                  className="absolute inset-0 rounded-full bg-white/20 blur-sm"
                />
                <motion.div
                  animate={{ scale: [1, 1.08, 1], opacity: [0.35, 0.08, 0.35] }}
                  transition={{ repeat: Infinity, duration: 2.2, delay: 0.25, ease: "easeInOut" }}
                  className="absolute inset-2 rounded-full border border-white/20"
                />

                <div className="relative h-[76px] w-[76px] overflow-hidden rounded-full border border-white/15 bg-[#17171a] shadow-[0_0_35px_rgba(255,255,255,0.12)]">
                  {invite.callerAvatar ? (
                    <img
                      src={invite.callerAvatar}
                      alt={invite.callerName}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-white/[0.06] text-xl font-black tracking-tight text-white">
                      {invite.callerName.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                </div>
              </div>

              <h3 className="text-xl font-black tracking-tight text-white">
                {invite.callerName}
              </h3>

              <div className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-white/60">
                {invite.hasVideo ? (
                  <>
                    <Video className="h-3.5 w-3.5 text-white/75" />
                    Chamada de vídeo
                  </>
                ) : (
                  <>
                    <Phone className="h-3.5 w-3.5 text-white/75" />
                    Chamada de voz
                  </>
                )}
              </div>

              <p className="mt-3 text-[11px] font-medium text-white/30">
                Está ligando para você...
              </p>

              {/* Actions */}
              <div className="mt-8 grid w-full grid-cols-2 gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onReject}
                  className="h-12 rounded-2xl border-rose-500/20 bg-rose-500/[0.07] text-rose-300 shadow-none hover:!bg-rose-500/15 hover:!text-rose-200 active:scale-[0.98]"
                >
                  <PhoneOff className="mr-2 h-4 w-4" />
                  Recusar
                </Button>

                <Button
                  type="button"
                  onClick={onAccept}
                  className="h-12 rounded-2xl bg-white text-black shadow-[0_8px_30px_rgba(255,255,255,0.12)] hover:!bg-white/90 hover:!text-black active:scale-[0.98]"
                >
                  <Phone className="mr-2 h-4 w-4" />
                  Atender
                </Button>
              </div>
            </div>
          </div>

          {/* Bottom hint */}
          <div className="border-t border-white/[0.06] px-6 py-3 text-center">
            <span className="text-[10px] font-medium text-white/25">
              Você pode aceitar ou recusar a chamada
            </span>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
