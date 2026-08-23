@@
*** Begin Patch
*** Update File: src/components/NotificationCenter.tsx
@@
-  const notify = useCallback(
-    (message: string, type: NotificationType = "info", options?: NotificationOptions) => {
-      if (!preferences.enabled) return;
-
-      const typePrefs = preferences.types[type];
-      if (typePrefs?.enabled === false) return;
-
-      const duration = options?.duration ?? typePrefs?.duration ?? preferences.defaultDuration;
-      const shouldPlaySound = options?.sound ?? typePrefs?.sound ?? preferences.soundEnabled;
-
-      // Overlay-specific kinds (messages, friend requests, calls, achievements)
-      const isOverlayType =
-        type === "incoming-call" ||
-        type === "friend-request" ||
-        type === "friend-accepted" ||
-        type === "message" ||
-        type === "achievement";
-
-      if (isOverlayType && preferences.showInOverlay && window.electronAPI?.showNotificationOverlay) {
-        void window.electronAPI.showNotificationOverlay({
-          message,
-          type,
-          title: options?.title,
-          imageUrl: options?.imageUrl,
-          duration,
-          sound: shouldPlaySound,
-          action: options?.action ? { label: options.action.label, actionId: "custom" } : undefined,
-          metadata: options?.metadata,
-        });
-      } else {
-        const toastType =
-          type === "achievement" ? "info" : type === "incoming-call" || type === "message" ? "info" : type;
-
-        toast.add({
-          title: options?.title,
-          description: message,
-          type: toastType as any,
-          timeout: duration,
-        });
-      }
-    },
-    [preferences],
-  );
+  const recentNotificationsRef = React.useRef<Map<string, number>>(new Map());
+  const ANNOUNCE_TTL_MS = 3000;
+  const [srAnnouncement, setSrAnnouncement] = React.useState<string | null>(null);
+
+  const notify = useCallback(
+    (message: string, type: NotificationType = "info", options?: NotificationOptions) => {
+      if (!preferences.enabled) return;
+
+      const typePrefs = preferences.types[type];
+      if (typePrefs?.enabled === false) return;
+
+      const duration = options?.duration ?? typePrefs?.duration ?? preferences.defaultDuration;
+      const shouldPlaySound = options?.sound ?? typePrefs?.sound ?? preferences.soundEnabled;
+
+      // Deduplicate identical notifications within a short TTL to avoid flood
+      const dedupeKey = `${type}::${String(options?.title ?? "").slice(0, 100)}::${message.slice(0, 200)}`;
+      const now = Date.now();
+      const last = recentNotificationsRef.current.get(dedupeKey) ?? 0;
+      if (now - last < ANNOUNCE_TTL_MS) {
+        return;
+      }
+      recentNotificationsRef.current.set(dedupeKey, now);
+      window.setTimeout(() => recentNotificationsRef.current.delete(dedupeKey), ANNOUNCE_TTL_MS + 50);
+
+      // Overlay-specific kinds (messages, friend requests, calls, achievements)
+      const isOverlayType =
+        type === "incoming-call" ||
+        type === "friend-request" ||
+        type === "friend-accepted" ||
+        type === "message" ||
+        type === "achievement";
+
+      const shortMessage = message.length > 500 ? `${message.slice(0, 497)}...` : message;
+
+      // Accessibility: announce to screen readers
+      setSrAnnouncement(`${options?.title ? options.title + ': ' : ''}${shortMessage}`);
+
+      if (isOverlayType && preferences.showInOverlay && window.electronAPI?.showNotificationOverlay) {
+        void window.electronAPI.showNotificationOverlay({
+          message: shortMessage,
+          type,
+          title: options?.title,
+          imageUrl: options?.imageUrl,
+          duration,
+          sound: shouldPlaySound,
+          action: options?.action ? { label: options.action.label, actionId: "custom" } : undefined,
+          metadata: options?.metadata,
+        });
+      } else {
+        const toastType =
+          type === "achievement" ? "info" : type === "incoming-call" || type === "message" ? "info" : type;
+
+        toast.add({
+          title: options?.title,
+          description: shortMessage,
+          type: toastType as any,
+          timeout: duration,
+        });
+      }
+    },
+    [preferences],
+  );
@@
-      {children}
-      <Toaster />
+      {children}
+      <Toaster />
+      {/* Screen reader announcement region (polite) */}
+      <div
+        aria-live="polite"
+        aria-atomic="true"
+        role="status"
+        style={{
+          position: "absolute",
+          width: 1,
+          height: 1,
+          overflow: "hidden",
+          clip: "rect(1px, 1px, 1px, 1px)",
+          whiteSpace: "nowrap",
+          border: 0,
+          padding: 0,
+          margin: -1,
+        }}
+      >
+        {srAnnouncement ?? ""}
+      </div>
*** End Patch
