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
      <div className="fixed right-4 top-4 z-200 flex w-full max-w-sm flex-col gap-2 pointer-events-none">
        <AnimatePresence>
          {items.map((item) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, x: 24, scale: 0.98 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 24, scale: 0.98 }}
              className={`pointer-events-auto liquid-glass-dark rounded-2xl border ${ringByType[item.type]} shadow-2xl p-3`}
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5">{iconByType[item.type]}</div>
                <p className="text-sm text-white/85 flex-1">{item.message}</p>
                <button
                  type="button"
                  onClick={() => dismiss(item.id)}
                  className="text-white/45 hover:text-white/80 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
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
