import React, { createContext, useCallback, useContext, useMemo } from "react";
import { motion } from "framer-motion";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";
import { toast, Toaster } from "sonner";

type NotificationType =
  | "success"
  | "error"
  | "info"
  | "achievement"
  | "incoming-call"
  | "friend-request"
  | "friend-accepted"
  | "message";

interface NotificationOptions {
  id?: string | number;
  title?: string;
  imageUrl?: string;
  duration?: number;
}

interface NotificationContextValue {
  notify: (message: string, type?: NotificationType, options?: NotificationOptions) => void;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

const StandardToast = ({
  message,
  type,
  title,
  t,
}: {
  message: string;
  type: NotificationType;
  title?: string;
  t: string | number;
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, x: 50, scale: 0.9 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 50, scale: 0.9, transition: { duration: 0.2 } }}
      transition={{ type: "spring", stiffness: 100, damping: 15 }}
      className="pointer-events-auto bg-[#0a0a0c]/90 backdrop-blur-3xl rounded-full border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.6)] overflow-hidden flex flex-col relative p-1.5 pr-4 w-full"
    >
      <div className="flex items-center gap-3 w-full">
        <div
          className={`flex items-center justify-center w-8 h-8 rounded-full ${
            type === "success"
              ? "bg-emerald-500/20 text-emerald-400"
              : type === "error"
              ? "bg-rose-500/20 text-rose-400"
              : "bg-blue-500/20 text-blue-400"
          }`}
        >
          {type === "success" && <CheckCircle2 size={16} strokeWidth={2.5} />}
          {type === "error" && <AlertCircle size={16} strokeWidth={2.5} />}
          {type === "info" && <Info size={16} strokeWidth={2.5} />}
        </div>

        <div className="flex flex-col flex-1 min-w-0 py-0.5">
          {title && (
            <span className="text-[11px] font-bold uppercase tracking-wider text-white/50 mb-0.5">
              {title}
            </span>
          )}
          <p className="text-[13px] font-semibold text-white/90 truncate">
            {message}
          </p>
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            const toastId = typeof t === "object" && t !== null && "id" in t ? (t as any).id : t;
            toast.dismiss(toastId);
          }}
          className="flex-shrink-0 ml-1 text-white/40 hover:text-white/80 hover:bg-white/10 rounded-full p-1 transition-all duration-200 cursor-pointer relative z-50 pointer-events-auto"
        >
          <X size={14} strokeWidth={2.5} />
        </button>
      </div>
    </motion.div>
  );
};

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const notify = useCallback(
    (message: string, type: NotificationType = "info", options?: NotificationOptions) => {
      const duration = options?.duration ?? 4200;

      // Overlay-specific kinds (messages, friend requests, calls, achievements)
      const isOverlayType =
        type === "incoming-call" ||
        type === "friend-request" ||
        type === "friend-accepted" ||
        type === "message" ||
        type === "achievement";

      if (isOverlayType && window.electronAPI?.showNotificationOverlay) {
        void window.electronAPI.showNotificationOverlay({
          message,
          type,
          title: options?.title,
          imageUrl: options?.imageUrl,
        });
      } else {
        toast.custom(
          (t) => (
            <StandardToast
              message={message}
              type={type}
              title={options?.title}
              t={t}
            />
          ),
          { id: options?.id, duration }
        );
      }
    },
    []
  );

  const value = useMemo<NotificationContextValue>(() => ({ notify }), [notify]);

  return (
    <NotificationContext.Provider value={value}>
      {children}
      <Toaster
        position="bottom-right"
        expand={false}
        toastOptions={{
          style: {
            background: "transparent",
            border: "none",
            boxShadow: "none",
            padding: 0,
            width: "auto",
          },
        }}
      />
    </NotificationContext.Provider>
  );
};

export const useNotification = () => {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error("useNotification deve ser usado dentro de NotificationProvider");
  return ctx;
};
