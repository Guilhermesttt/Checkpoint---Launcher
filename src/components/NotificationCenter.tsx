import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";

type NotificationType = "success" | "error" | "info";

interface NotificationItem {
  id: string;
  type: NotificationType;
  message: string;
}

interface NotificationContextValue {
  notify: (message: string, type?: NotificationType) => void;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

const iconByType: Record<NotificationType, React.ReactNode> = {
  success: <CheckCircle2 className="w-4 h-4 text-emerald-300" />,
  error: <AlertCircle className="w-4 h-4 text-rose-300" />,
  info: <Info className="w-4 h-4 text-blue-300" />,
};

const ringByType: Record<NotificationType, string> = {
  success: "border-emerald-400/30",
  error: "border-rose-400/30",
  info: "border-blue-400/30",
};

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<NotificationItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const notify = useCallback(
    (message: string, type: NotificationType = "info") => {
      const id = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
      setItems((prev) => [...prev, { id, type, message }]);
      window.setTimeout(() => dismiss(id), 4200);
    },
    [dismiss],
  );

  const value = useMemo<NotificationContextValue>(() => ({ notify }), [notify]);

  return (
    <NotificationContext.Provider value={value}>
      {children}
      <div className="fixed right-6 bottom-6 z-200 flex w-full max-w-sm flex-col-reverse gap-3 pointer-events-none">
        <AnimatePresence mode="popLayout">
          {items.map((item) => (
            <motion.div
              key={item.id}
              layout
              initial={{ opacity: 0, y: 20, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.9, transition: { duration: 0.15 } }}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
              className="pointer-events-auto bg-[#0a0a0c]/80 backdrop-blur-2xl rounded-full border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.5)] p-1.5 pr-4 flex items-center gap-3"
            >
              <div
                className={`flex items-center justify-center w-8 h-8 rounded-full ${
                  item.type === "success"
                    ? "bg-emerald-500/20 text-emerald-400"
                    : item.type === "error"
                    ? "bg-rose-500/20 text-rose-400"
                    : "bg-blue-500/20 text-blue-400"
                }`}
              >
                {item.type === "success" && <CheckCircle2 size={16} strokeWidth={2.5} />}
                {item.type === "error" && <AlertCircle size={16} strokeWidth={2.5} />}
                {item.type === "info" && <Info size={16} strokeWidth={2.5} />}
              </div>
              <p className="text-[13px] font-semibold text-white/90 flex-1">{item.message}</p>
              <button
                type="button"
                onClick={() => dismiss(item.id)}
                className="ml-1 text-white/40 hover:text-white/80 hover:bg-white/10 rounded-full p-1 transition-all"
              >
                <X size={14} strokeWidth={2.5} />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </NotificationContext.Provider>
  );
};

export const useNotification = () => {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error("useNotification deve ser usado dentro de NotificationProvider");
  return ctx;
};
