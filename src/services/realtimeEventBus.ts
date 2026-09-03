import { supabase } from "./supabase";
import type { ChatMessage } from "../types/domain";

export type UserPresenceStatus = "online" | "playing" | "offline";

export interface PresencePayload {
  uid: string;
  displayName: string;
  photoURL?: string | null;
  status: UserPresenceStatus;
  playing?: string | null;
  updatedAt: number;
}

export interface U2UEventHandlers {
  onMessage?: (msg: ChatMessage) => void;
  onStatusUpdate?: (presence: PresencePayload) => void;
  onTyping?: (data: { senderId: string; typing: boolean }) => void;
  onFriendRequest?: (data: { fromUid: string; fromName: string; fromAvatar?: string | null }) => void;
  onFriendAccepted?: (data: { friendUid: string; friendName: string; friendAvatar?: string | null }) => void;
  onFriendRemoved?: (data: { fromUid: string }) => void;
  onCustomEvent?: (event: string, payload: any) => void;
}

let inboxChannel: any = null;
let presenceChannel: any = null;
const globalEventHandlers = new Set<U2UEventHandlers>();
const activeInboxChannels = new Map<string, any>();
const sentMessageIds = new Set<string>();

// Refcount + idle close management for per-user inbox channels created on-demand.
const channelRefCounts = new Map<string, number>();
const channelIdleTimers = new Map<string, ReturnType<typeof setTimeout>>();
const INBOX_CHANNEL_IDLE_MS = 30_000; // close channels after 30s idle

function scheduleChannelIdleClose(channelName: string, channelObj: any) {
  if (channelIdleTimers.has(channelName)) return;
  const t = setTimeout(() => {
    try {
      channelObj?.unsubscribe?.();
    } catch { }
    try {
      supabase.removeChannel(channelObj);
    } catch { }
    activeInboxChannels.delete(channelName);
    channelRefCounts.delete(channelName);
    channelIdleTimers.delete(channelName);
  }, INBOX_CHANNEL_IDLE_MS);
  // @ts-ignore
  channelIdleTimers.set(channelName, t);
}

function cancelChannelIdleClose(channelName: string) {
  const t = channelIdleTimers.get(channelName);
  if (t) {
    clearTimeout(t);
    channelIdleTimers.delete(channelName);
  }
}

/**
 * Inscreve no canal pessoal de eventos U2U (Mensagens rápidas, convites e notificações diretas)
 */
export const subscribeToGlobalEventBus = (
  myUid: string,
  handlers: U2UEventHandlers,
) => {
  globalEventHandlers.add(handlers);

  if (!inboxChannel && myUid) {
    const channelName = `user_inbox_${myUid}`;
    inboxChannel = supabase.channel(channelName, {
      config: { broadcast: { self: false } },
    });

    inboxChannel
      .on("broadcast", { event: "u2u:message" }, (e: any) => {
        if (e.payload && typeof e.payload === "object") {
          const msg = e.payload as ChatMessage;
          globalEventHandlers.forEach((h) => h.onMessage?.(msg));
        }
      })
      .on("broadcast", { event: "u2u:status" }, (e: any) => {
        if (e.payload && typeof e.payload === "object") {
          const presence = e.payload as PresencePayload;
          globalEventHandlers.forEach((h) => h.onStatusUpdate?.(presence));
        }
      })
      .on("broadcast", { event: "u2u:typing" }, (e: any) => {
        if (e.payload && typeof e.payload === "object") {
          globalEventHandlers.forEach((h) => h.onTyping?.(e.payload));
        }
      })
      .on("broadcast", { event: "u2u:friend_request" }, (e: any) => {
        if (e.payload && typeof e.payload === "object") {
          globalEventHandlers.forEach((h) => h.onFriendRequest?.(e.payload));
        }
      })
      .on("broadcast", { event: "u2u:friend_accepted" }, (e: any) => {
        if (e.payload && typeof e.payload === "object") {
          globalEventHandlers.forEach((h) => h.onFriendAccepted?.(e.payload));
        }
      })
      .on("broadcast", { event: "u2u:friend_removed" }, (e: any) => {
        if (e.payload && typeof e.payload === "object") {
          globalEventHandlers.forEach((h) => h.onFriendRemoved?.(e.payload));
        }
      })
      .on("broadcast", { event: "u2u:custom" }, (e: any) => {
        if (e.payload && typeof e.payload === "object") {
          globalEventHandlers.forEach((h) => h.onCustomEvent?.(e.payload.event, e.payload.data));
        }
      });

    // non-blocking subscribe (do not await SUBSCRIBED here to avoid blocking callers)
    try {
      inboxChannel.subscribe((status: string) => {
        if (status === "SUBSCRIBED") {
          // connected to personal inbox
        }
      });
    } catch (err) {
      // ignore subscribe errors silently — presence of the channel object is sufficient
    }
  }

  // Inscreve também no canal global de Presence para sincronização instantânea de status de amigos
  if (!presenceChannel) {
    presenceChannel = supabase.channel("checkpoint_presence_bus", {
      config: {
        presence: {
          key: myUid || "guest",
        },
      },
    });

    presenceChannel
      .on("broadcast", { event: "presence:status_update" }, (e: any) => {
        if (e.payload && typeof e.payload === "object") {
          const presence = e.payload as PresencePayload;
          globalEventHandlers.forEach((h) => h.onStatusUpdate?.(presence));
        }
      })
      .on("presence", { event: "sync" }, () => {
        const state = presenceChannel.presenceState();
        Object.values(state).forEach((presences: any) => {
          if (Array.isArray(presences)) {
            presences.forEach((p: any) => {
              if (p.presence && p.presence.uid) {
                globalEventHandlers.forEach((h) => h.onStatusUpdate?.(p.presence));
              }
            });
          }
        });
      })
      .on("presence", { event: "join" }, ({ newPresences }: any) => {
        if (Array.isArray(newPresences)) {
          newPresences.forEach((p: any) => {
            if (p.presence && p.presence.uid) {
              globalEventHandlers.forEach((h) => h.onStatusUpdate?.(p.presence));
            }
          });
        }
      })
      .on("presence", { event: "leave" }, ({ leftPresences }: any) => {
        if (Array.isArray(leftPresences)) {
          leftPresences.forEach((p: any) => {
            const uid = p.presence?.uid || p.uid;
            if (uid) {
              globalEventHandlers.forEach((h) =>
                h.onStatusUpdate?.({
                  uid,
                  displayName: p.presence?.displayName || p.displayName || "Jogador",
                  photoURL: p.presence?.photoURL || p.photoURL || null,
                  status: "offline",
                  playing: null,
                  updatedAt: Date.now(),
                }),
              );
            }
          });
        }
      });

    try {
      presenceChannel.subscribe();
    } catch { }
  }

  const unsubscribe = () => {
    globalEventHandlers.delete(handlers);
    // If no more handlers remain, clean up inbox/presence channels to free resources
    if (globalEventHandlers.size === 0) {
      try {
        inboxChannel?.unsubscribe?.();
      } catch { }
      try {
        if (inboxChannel) supabase.removeChannel(inboxChannel);
      } catch { }
      inboxChannel = null;

      try {
        presenceChannel?.unsubscribe?.();
      } catch { }
      try {
        if (presenceChannel) supabase.removeChannel(presenceChannel);
      } catch { }
      presenceChannel = null;
    }
  };

  return unsubscribe;
};

/**
 * Emite uma mudança de status / jogo em tempo real via WebSocket para todos os amigos conectados
 */
export const broadcastPresenceStatus = async (presence: PresencePayload) => {
  try {
    if (!presenceChannel) {
      presenceChannel = supabase.channel("checkpoint_presence_bus");
      try {
        presenceChannel.subscribe((s: string) => { });
      } catch { }
    }

    // 1. Broadcast instantâneo para canais inscritos
    await presenceChannel.send({
      type: "broadcast",
      event: "presence:status_update",
      payload: presence,
    });

    // 2. Track no estado Presence do canal
    await presenceChannel.track({
      presence,
    });
  } catch (err) {
    console.warn("[realtimeEventBus] broadcastPresenceStatus error:", err);
  }
};

/**
 * Envia uma mensagem direta de entrega instantânea (Fast-Path via WebSocket)
 */
export const sendFastU2UMessage = async (receiverUid: string, message: ChatMessage) => {
  try {
    const channelName = `user_inbox_${receiverUid}`;
    let targetChannel = activeInboxChannels.get(channelName);

    if (!targetChannel) {
      targetChannel = supabase.channel(channelName);
      activeInboxChannels.set(channelName, targetChannel);
      channelRefCounts.set(channelName, 0);
      // non-blocking subscribe
      try {
        targetChannel.subscribe((s: string) => { });
      } catch { }
    }

    // Keep the channel alive while sending
    channelRefCounts.set(channelName, (channelRefCounts.get(channelName) || 0) + 1);
    cancelChannelIdleClose(channelName);

    sentMessageIds.add(message.id || "");

    await targetChannel.send({
      type: "broadcast",
      event: "u2u:message",
      payload: message,
    });

    // decrement refcount and schedule idle close if none left
    channelRefCounts.set(channelName, (channelRefCounts.get(channelName) || 1) - 1);
    if ((channelRefCounts.get(channelName) || 0) <= 0) {
      scheduleChannelIdleClose(channelName, targetChannel);
    }
  } catch (err) {
    console.warn("[realtimeEventBus] sendFastU2UMessage error:", err);
  }
};

/**
 * Envia indicador rápido de digitação via WebSocket
 */
export const sendFastU2UTyping = async (receiverUid: string, senderId: string, typing: boolean) => {
  try {
    const channelName = `user_inbox_${receiverUid}`;
    let targetChannel = activeInboxChannels.get(channelName);

    if (!targetChannel) {
      targetChannel = supabase.channel(channelName);
      activeInboxChannels.set(channelName, targetChannel);
      channelRefCounts.set(channelName, 0);
      try {
        targetChannel.subscribe((s: string) => { });
      } catch { }
    }

    // do not increase refcount for typing (fire-and-forget)
    try {
      await targetChannel.send({
        type: "broadcast",
        event: "u2u:typing",
        payload: { senderId, typing },
      });
    } catch { }

    // schedule idle close since this was only a fire-and-forget use
    if ((channelRefCounts.get(channelName) || 0) <= 0) {
      scheduleChannelIdleClose(channelName, targetChannel);
    }
  } catch {
    // Ignore typing throttle errors
  }
};

/**
 * Notifica solicitação de amizade recebida instantaneamente via WebSocket
 */
export const sendFastFriendRequestNotification = async (
  targetUid: string,
  fromUser: { uid: string; displayName: string; photoURL?: string | null },
) => {
  try {
    const channelName = `user_inbox_${targetUid}`;
    let targetChannel = activeInboxChannels.get(channelName);
    if (!targetChannel) {
      targetChannel = supabase.channel(channelName);
      activeInboxChannels.set(channelName, targetChannel);
      channelRefCounts.set(channelName, 0);
      await new Promise<void>((resolve) => {
        let finished = false;
        const timeout = setTimeout(() => {
          if (!finished) {
            finished = true;
            resolve();
          }
        }, 1500);
        targetChannel.subscribe((status: string) => {
          if (!finished && (status === "SUBSCRIBED" || status === "CHANNEL_ERROR" || status === "TIMED_OUT")) {
            finished = true;
            clearTimeout(timeout);
            resolve();
          }
        });
      });
    }

    await targetChannel.send({
      type: "broadcast",
      event: "u2u:friend_request",
      payload: {
        fromUid: fromUser.uid,
        fromName: fromUser.displayName,
        fromAvatar: fromUser.photoURL || null,
      },
    });

    if ((channelRefCounts.get(channelName) || 0) <= 0) {
      scheduleChannelIdleClose(channelName, targetChannel);
    }
  } catch (err) {
    console.warn("[realtimeEventBus] sendFastFriendRequestNotification error:", err);
  }
};

/**
 * Notifica que uma solicitação de amizade foi aceita instantaneamente via WebSocket
 */
export const sendFastFriendAcceptedNotification = async (
  targetUid: string,
  fromUser: { uid: string; displayName: string; photoURL?: string | null },
) => {
  try {
    const channelName = `user_inbox_${targetUid}`;
    let targetChannel = activeInboxChannels.get(channelName);
    if (!targetChannel) {
      targetChannel = supabase.channel(channelName);
      activeInboxChannels.set(channelName, targetChannel);
      channelRefCounts.set(channelName, 0);
      await new Promise<void>((resolve) => {
        let finished = false;
        const timeout = setTimeout(() => {
          if (!finished) {
            finished = true;
            resolve();
          }
        }, 1500);
        targetChannel.subscribe((status: string) => {
          if (!finished && (status === "SUBSCRIBED" || status === "CHANNEL_ERROR" || status === "TIMED_OUT")) {
            finished = true;
            clearTimeout(timeout);
            resolve();
          }
        });
      });
    }

    await targetChannel.send({
      type: "broadcast",
      event: "u2u:friend_accepted",
      payload: {
        friendUid: fromUser.uid,
        friendName: fromUser.displayName,
        friendAvatar: fromUser.photoURL || null,
      },
    });

    if ((channelRefCounts.get(channelName) || 0) <= 0) {
      scheduleChannelIdleClose(channelName, targetChannel);
    }
  } catch (err) {
    console.warn("[realtimeEventBus] sendFastFriendAcceptedNotification error:", err);
  }
};

/**
 * Notifica que uma amizade foi desfeita/removida instantaneamente via WebSocket
 */
export const sendFastFriendRemovedNotification = async (
  targetUid: string,
  myUid: string,
) => {
  try {
    const channelName = `user_inbox_${targetUid}`;
    let targetChannel = activeInboxChannels.get(channelName);
    if (!targetChannel) {
      targetChannel = supabase.channel(channelName);
      activeInboxChannels.set(channelName, targetChannel);
      channelRefCounts.set(channelName, 0);
      await new Promise<void>((resolve) => {
        let finished = false;
        const timeout = setTimeout(() => {
          if (!finished) {
            finished = true;
            resolve();
          }
        }, 1500);
        targetChannel.subscribe((status: string) => {
          if (!finished && (status === "SUBSCRIBED" || status === "CHANNEL_ERROR" || status === "TIMED_OUT")) {
            finished = true;
            clearTimeout(timeout);
            resolve();
          }
        });
      });
    }

    await targetChannel.send({
      type: "broadcast",
      event: "u2u:friend_removed",
      payload: { fromUid: myUid },
    });

    if ((channelRefCounts.get(channelName) || 0) <= 0) {
      scheduleChannelIdleClose(channelName, targetChannel);
    }
  } catch (err) {
    console.warn("[realtimeEventBus] sendFastFriendRemovedNotification error:", err);
  }
};