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
  onCustomEvent?: (event: string, payload: any) => void;
}

let inboxChannel: any = null;
let presenceChannel: any = null;
const globalEventHandlers = new Set<U2UEventHandlers>();
const activeInboxChannels = new Map<string, any>();
const sentMessageIds = new Set<string>();

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
      .on("broadcast", { event: "u2u:custom" }, (e: any) => {
        if (e.payload && typeof e.payload === "object") {
          globalEventHandlers.forEach((h) => h.onCustomEvent?.(e.payload.event, e.payload.data));
        }
      });

    inboxChannel.subscribe((status: string) => {
      if (status === "SUBSCRIBED") {
        // Connected to personal inbox
      }
    });
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
      });

    presenceChannel.subscribe();
  }

  return () => {
    globalEventHandlers.delete(handlers);
  };
};

/**
 * Emite uma mudança de status / jogo em tempo real via WebSocket para todos os amigos conectados
 */
export const broadcastPresenceStatus = async (presence: PresencePayload) => {
  try {
    if (!presenceChannel) {
      presenceChannel = supabase.channel("checkpoint_presence_bus");
      await new Promise<void>((resolve) => {
        presenceChannel.subscribe((s: string) => {
          if (s === "SUBSCRIBED") resolve();
        });
      });
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
      await new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, 2000);
        targetChannel.subscribe((s: string) => {
          if (s === "SUBSCRIBED") {
            clearTimeout(timer);
            resolve();
          }
        });
      });
    }

    sentMessageIds.add(message.id || "");

    await targetChannel.send({
      type: "broadcast",
      event: "u2u:message",
      payload: message,
    });
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
      await targetChannel.subscribe();
    }

    await targetChannel.send({
      type: "broadcast",
      event: "u2u:typing",
      payload: { senderId, typing },
    });
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
      await targetChannel.subscribe();
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
  } catch (err) {
    console.warn("[realtimeEventBus] sendFastFriendRequestNotification error:", err);
  }
};
