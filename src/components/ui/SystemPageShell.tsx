import React, { useRef } from "react";
import { motion } from "framer-motion";
import { useGamepadNavigation } from "../../hooks/useGamepadNavigation";

export interface SystemPageShellProps {
  eyebrow: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}

export const SystemPageShell: React.FC<SystemPageShellProps> = React.memo(
  ({ eyebrow, title, description, actions, children }) => {
    const scrollRef = useRef<HTMLDivElement>(null);

    useGamepadNavigation({
      scrollRef: scrollRef as React.RefObject<HTMLElement>,
      scrollSpeed: 25,
      disableX: true,
      disableO: true,
    });

    return (
      <motion.div
        ref={scrollRef}
        data-system-page
        initial={{ opacity: 0, y: 24, filter: "blur(8px)" }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="flex-1 overflow-y-auto px-10 pb-14 pt-8 thin-scrollbar"
      >
        <div className="mx-auto flex min-h-full max-w-6xl flex-col">
          <div className="mx-auto mb-8 w-full max-w-5xl text-right">
            <p className="mb-3 text-[10px] font-black uppercase tracking-[0.32em] text-white/25">
              {eyebrow}
            </p>
            <h1
              className="text-5xl font-black uppercase tracking-tight text-white"
              style={{ textShadow: "0 0 28px rgb(var(--launcher-accent) / 0.28)" }}
            >
              {title}
            </h1>
            {description && (
              <p className="mt-2 text-xs md:text-sm font-body text-white/50">
                {description}
              </p>
            )}
            {actions && <div className="mt-4 flex justify-end">{actions}</div>}
          </div>
          <div className="mx-auto w-full max-w-5xl">{children}</div>
        </div>
      </motion.div>
    );
  },
);

SystemPageShell.displayName = "SystemPageShell";
