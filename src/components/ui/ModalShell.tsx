import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";

interface ModalShellProps {
  isOpen: boolean;
  onClose: (silent?: boolean) => void;
  children: React.ReactNode;
  maxWidthClassName?: string;
  className?: string;
  backdropClassName?: string;
  zIndexClassName?: string;
  reducedEffects?: boolean;
}

const ModalShell: React.FC<ModalShellProps> = ({
  isOpen,
  onClose,
  children,
  maxWidthClassName = "max-w-2xl",
  className,
  backdropClassName,
  zIndexClassName = "z-[100]",
  reducedEffects = false,
}) => {
  // Handle escape key
  React.useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className={cn(
            "fixed inset-0 flex items-center justify-center p-4 md:p-8",
            zIndexClassName
          )}
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => onClose()}
            className={cn(
              "absolute inset-0 bg-black/60 backdrop-blur-md",
              backdropClassName
            )}
          />

          {/* Modal Content */}
          <motion.div
            initial={reducedEffects ? { opacity: 0 } : { opacity: 0, scale: 0.95, y: 20 }}
            animate={reducedEffects ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
            exit={reducedEffects ? { opacity: 0 } : { opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className={cn(
              "relative w-full overflow-hidden",
              maxWidthClassName,
              className
            )}
          >
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default ModalShell;
