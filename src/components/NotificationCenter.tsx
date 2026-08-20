import React, { createContext, useCallback, useContext, useMemo } from "react";
import { Toaster, toast } from "./ui/Shandc/toast";

type NotificationType =
  | "success"
  | "error"
  | "info"
  | "warning"
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
        const toastType =
          type === "achievement" ? "info" : type === "incoming-call" || type === "message" ? "info" : type;

        toast.add({
          title: options?.title,
          description: message,
          type: toastType as any,
          timeout: duration,
        });
      }
    },
    []
  );

  const value = useMemo<NotificationContextValue>(() => ({ notify }), [notify]);

  return (
    <NotificationContext.Provider value={value}>
      {children}
      <Toaster />
    </NotificationContext.Provider>
  );
};

export const useNotification = () => {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error("useNotification deve ser usado dentro de NotificationProvider");
  return ctx;
};

