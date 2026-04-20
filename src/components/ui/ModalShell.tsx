import React from "react";
import { AnimatePresence, motion } from "framer-motion";

export interface ModalShellProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
  maxWidthClassName?: string;
  backdropClassName?: string;
  reducedEffects?: boolean;
  zIndexClassName?: string;
  contentClassName?: string;
}

export default function ModalShell({
  isOpen,
  onClose,
  children,
  className,
  maxWidthClassName = "max-w-md",
  backdropClassName = "bg-black/75",
  reducedEffects = false,
  zIndexClassName = "z-[150]",
  contentClassName,
}: ModalShellProps) {
  const panelMotion = reducedEffects
    ? {}
    : {
        initial: { opacity: 0, scale: 0.96, y: 14 },
        animate: { opacity: 1, scale: 1, y: 0 },
        exit: { opacity: 0, scale: 0.96, y: 14 },
      };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className={`fixed inset-0 ${zIndexClassName} flex items-center justify-center p-6`}
        >
          <div className={`absolute inset-0 ${backdropClassName}`} onClick={onClose} />

          <motion.div
            {...panelMotion}
            className={[
              "relative w-full liquid-glass-dark rounded-3xl border border-white/10 p-6 elevation-2",
              maxWidthClassName,
              className,
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <div className={contentClassName}>{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

