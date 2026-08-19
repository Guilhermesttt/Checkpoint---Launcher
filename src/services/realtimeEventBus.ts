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

// ── Outbound channel pool with idle-close ────────────────────────────────────
// Canais de saída são reutilizados e fechados automaticamente após 30s de idle,
// evitando acúmulo ilimitado de WebSockets abertos.
const activeInboxChannels = new Map<string, any>();
const sentMessageIds = new Set<string>();

const INBOX_CHANNEL_IDLE_MS = 30_000;
const channelIdleTimers = new Map<string, ReturnType<typeof setTimeout>>();

/** Agenda o fechamento automático de um canal de saída após período de idle. */
function scheduleChannelIdleClose(channelName: string, channelObj: any) {
  // Cancela timer anterior antes de criar um novo
  cancelChannelIdleClose(channelName);
  const t = setTimeout(() => {
    try {
      channelObj?.unsubscribe?.();
      supabase.removeChannel(channelObj);
    } catch {
      // Ignora erros no fechamento silencioso
    }
    activeInboxChannels.delete(channelName);
    channelIdleTimers.delete(channelName);
  }, INBOX_CHANNEL_IDLE_MS);
  channelIdleTimers.set(channelName, t);
}

/** Cancela um timer de idle-close existente (ao reutilizar o canal). */
function cancelChannelIdleClose(channelName: string) {
  const t = channelIdleTimers.get(channelName);
  if (t !== undefined) {
    clearTimeout(t);
    channelIdleTimers.delete(channelName);
  }
}

/** Fecha e remove os canais globais de inbox e presence quando não há mais handlers. */
function teardownGlobalChannels() {
  if (inboxChannel) {
    try {
      inboxChannel.unsubscribe?.();
      supabase.removeChannel(inboxChannel);
    } catch {
      // Silencioso
    }
    inboxChannel = null;
  }
  if (presenceChannel) {
    try {
      presenceChannel.unsubscribe?.();
      supabase.removeChannel(presenceChannel);
    } catch {
      // Silencioso
    }
    presenceChannel = null;
  }
}

/**
 * Garante que existe um canal de saída (outbound) para o destinatário.
 * A subscrição é feita de forma não bloqueante em background.
 * Retorna o canal imediatamente para que o caller possa enfileirar o send.
 */
function getOrCreateOutboundChannel(channelName: string): any {
  let channel = activeInboxChannels.get(channelName);
  if (!channel) {
    channel = supabase.channel(channelName);
    activeInboxChannels.set(channelName, channel);
    // Subscrição assíncrona em background — não bloqueia o envio
    channel.subscribe(() => {
      // Canal pronto; idle timer continua válido
    });
  }
  // Reutilizando o canal: cancela o idle timer para mantê-lo vivo
  cancelChannelIdleClose(channelName);
  return channel;
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
      .on("broadcast", { event: "u2u:custom" }, (e: any) => {
        if (e.payload && typeof e.payload === "object") {
          globalEventHandlers.forEach((h) => h.onCustomEvent?.(e.payload.event, e.payload.data));
        }
      });

    inboxChannel.subscribe((status: string) => {
      if (status === "SUBSCRIBED") {
        // Conectado ao inbox pessoal
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

  // ── Cleanup correto: remove o handler E fecha os canais globais se não há mais ninguém ──
  return () => {
    globalEventHandlers.delete(handlers);
    if (globalEventHandlers.size === 0) {
      teardownGlobalChannels();
    }
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
 * Envia uma mensagem direta de entrega instantânea (Fast-Path via WebSocket).
 * A subscrição do canal é feita em background — não bloqueia o envio.
 */
export const sendFastU2UMessage = async (receiverUid: string, message: ChatMessage) => {
  try {
    const channelName = `user_inbox_${receiverUid}`;
    const targetChannel = getOrCreateOutboundChannel(channelName);

    sentMessageIds.add(message.id || "");

    await targetChannel.send({
      type: "broadcast",
      event: "u2u:message",
      payload: message,
    });

    // Agenda o fechamento idle após o envio
    scheduleChannelIdleClose(channelName, targetChannel);
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
    const targetChannel = getOrCreateOutboundChannel(channelName);

    await targetChannel.send({
      type: "broadcast",
      event: "u2u:typing",
      payload: { senderId, typing },
    });

    // Typing é muito frequente: usa idle timer curto de 5s para fechar logo
    const t = setTimeout(() => {
      try {
        targetChannel?.unsubscribe?.();
        supabase.removeChannel(targetChannel);
      } catch {
        // Silencioso
      }
      activeInboxChannels.delete(channelName);
      channelIdleTimers.delete(channelName);
    }, 5_000);
    // Sobrescreve o timer existente (cancelChannelIdleClose já chamado em getOrCreateOutboundChannel)
    channelIdleTimers.set(channelName, t);
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
    const targetChannel = getOrCreateOutboundChannel(channelName);

    await targetChannel.send({
      type: "broadcast",
      event: "u2u:friend_request",
      payload: {
        fromUid: fromUser.uid,
        fromName: fromUser.displayName,
        fromAvatar: fromUser.photoURL || null,
      },
    });

    scheduleChannelIdleClose(channelName, targetChannel);
  } catch (err) {
    console.warn("[realtimeEventBus] sendFastFriendRequestNotification error:", err);
  }
};
