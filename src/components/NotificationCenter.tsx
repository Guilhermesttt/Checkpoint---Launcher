import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, CheckCircle2, Info, X, Trophy } from "lucide-react";

type NotificationType = "success" | "error" | "info" | "achievement";

interface NotificationItem {
  id: string;
  type: NotificationType;
  message: string;
  title?: string;
  imageUrl?: string;
  duration?: number;
}

interface NotificationOptions {
  title?: string;
  imageUrl?: string;
  duration?: number;
}

interface NotificationContextValue {
  notify: (message: string, type?: NotificationType, options?: NotificationOptions) => void;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);



export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<NotificationItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const notify = useCallback(
    (message: string, type: NotificationType = "info", options?: NotificationOptions) => {
      const id = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const duration = options?.duration || 4200;
      setItems((prev) => [...prev, { id, type, message, ...options, duration }]);
      window.setTimeout(() => dismiss(id), duration);
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
              initial={{ opacity: 0, x: 50, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 50, scale: 0.9, transition: { duration: 0.2 } }}
              transition={{ type: "spring", stiffness: 100, damping: 15 }}
              className={`pointer-events-auto bg-[#0a0a0c]/90 backdrop-blur-3xl rounded-xl border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.6)] overflow-hidden flex flex-col relative ${item.type === "achievement" ? "p-3 w-80" : "p-1.5 pr-4 rounded-full"}`}
            >
              <div className="flex items-center gap-3 w-full">
                {item.type === "achievement" ? (
                  <div className="flex-shrink-0 w-12 h-12 rounded-lg overflow-hidden bg-white/5 border border-white/10 flex items-center justify-center">
                    {item.imageUrl ? (
                      <img src={item.imageUrl} alt="Conquista" className="w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.nextElementSibling?.classList.remove('hidden'); }} />
                    ) : null}
                    <Trophy className={`w-6 h-6 text-yellow-400 ${item.imageUrl ? 'hidden' : ''}`} />
                  </div>
                ) : (
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
                )}
                
                <div className="flex flex-col flex-1 min-w-0">
                  {item.title && (
                    <span className="text-[11px] font-bold uppercase tracking-wider text-white/50 mb-0.5">
                      {item.title}
                    </span>
                  )}
                  <p className={`${item.type === "achievement" ? "text-[14px]" : "text-[13px]"} font-semibold text-white/90 truncate`}>
                    {item.message}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => dismiss(item.id)}
                  className="flex-shrink-0 ml-1 text-white/40 hover:text-white/80 hover:bg-white/10 rounded-full p-1 transition-all duration-200"
                >
                  <X size={14} strokeWidth={2.5} />
                </button>
              </div>
              
              {/* Progress Bar */}
              <div className="absolute bottom-0 left-0 h-0.5 bg-white/20 w-full origin-left animate-shrink" style={{ animationDuration: `${item.duration}ms`, animationTimingFunction: 'linear', animationFillMode: 'forwards' }}></div>
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
