import React, { createContext, useCallback, useContext, useMemo, useState, useEffect } from "react";
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
  sound?: boolean;
  action?: {
    label: string;
    onClick: () => void;
  };
  metadata?: Record<string, any>;
}

interface NotificationPreferences {
  enabled: boolean;
  soundEnabled: boolean;
  defaultDuration: number;
  showInOverlay: boolean;
  types: Record<NotificationType, { enabled: boolean; duration?: number; sound?: boolean }>;
}

const DEFAULT_PREFERENCES: NotificationPreferences = {
  enabled: true,
  soundEnabled: true,
  defaultDuration: 4200,
  showInOverlay: true,
  types: {
    success: { enabled: true, duration: 3000 },
    error: { enabled: true, duration: 6000, sound: true },
    info: { enabled: true, duration: 4200 },
    warning: { enabled: true, duration: 5000, sound: true },
    achievement: { enabled: true, duration: 8000, sound: true },
    "incoming-call": { enabled: true, duration: 0, sound: true },
    "friend-request": { enabled: true, duration: 10000, sound: true },
    "friend-accepted": { enabled: true, duration: 5000 },
    message: { enabled: true, duration: 6000, sound: true },
  },
};

interface NotificationContextValue {
  notify: (message: string, type?: NotificationType, options?: NotificationOptions) => void;
  preferences: NotificationPreferences;
  updatePreferences: (prefs: Partial<NotificationPreferences>) => void;
  dismissAll: () => void;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [preferences, setPreferences] = useState<NotificationPreferences>(() => {
    try {
      const saved = localStorage.getItem("notification_preferences");
      if (saved) {
        return { ...DEFAULT_PREFERENCES, ...JSON.parse(saved) };
      }
    } catch {}
    return DEFAULT_PREFERENCES;
  });

  useEffect(() => {
    try {
      localStorage.setItem("notification_preferences", JSON.stringify(preferences));
    } catch {}
  }, [preferences]);

  const notify = useCallback(
    (message: string, type: NotificationType = "info", options?: NotificationOptions) => {
      if (!preferences.enabled) return;

      const typePrefs = preferences.types[type];
      if (typePrefs?.enabled === false) return;

      const duration = options?.duration ?? typePrefs?.duration ?? preferences.defaultDuration;
      const shouldPlaySound = options?.sound ?? typePrefs?.sound ?? preferences.soundEnabled;

      // Overlay-specific kinds (messages, friend requests, calls, achievements)
      const isOverlayType =
        type === "incoming-call" ||
        type === "friend-request" ||
        type === "friend-accepted" ||
        type === "message" ||
        type === "achievement";

      if (isOverlayType && preferences.showInOverlay && window.electronAPI?.showNotificationOverlay) {
        void window.electronAPI.showNotificationOverlay({
          message,
          type,
          title: options?.title,
          imageUrl: options?.imageUrl,
          duration,
          sound: shouldPlaySound,
          action: options?.action ? { label: options.action.label, actionId: "custom" } : undefined,
          metadata: options?.metadata,
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
    [preferences],
  );

  const updatePreferences = useCallback((newPrefs: Partial<NotificationPreferences>) => {
    setPreferences((prev) => ({
      ...prev,
      ...newPrefs,
      types: newPrefs.types ? { ...prev.types, ...newPrefs.types } : prev.types,
    }));
  }, []);

  const dismissAll = useCallback(() => {
    if (window.electronAPI?.dismissNotificationOverlay) {
      void window.electronAPI.dismissNotificationOverlay({ dismissAll: true });
    }
  }, []);

  const value = useMemo<NotificationContextValue>(() => ({ notify, preferences, updatePreferences, dismissAll }), [
    notify,
    preferences,
    updatePreferences,
    dismissAll,
  ]);

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

