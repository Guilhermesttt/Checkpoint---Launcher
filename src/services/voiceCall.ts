import { supabase } from "./supabase";
import type { RoomCategory } from "../types/voice-governance";

export interface CallInvitePayload {
  callerId: string;
  callerName: string;
  callerAvatar?: string | null;
  chatId: string;
  hasVideo?: boolean;
  timestamp: number;
  category?: RoomCategory;
}

export interface CallKickPayload {
  adminId: string;
  targetUserId: string;
  chatId: string;
  reason?: string;
}

export interface CallAnswerPayload {
  responderId: string;
  accepted: boolean;
  chatId: string;
}

export interface CallSignalPayload {
  senderId: string;
  chatId: string;
  targetUid?: string; // Destinatário específico no Full Mesh P2P
  signal: RTCSessionDescriptionInit | { candidate: RTCIceCandidateInit };
}

export interface CallStatePayload {
  senderId: string;
  chatId: string;
  isMuted?: boolean;
  isDeafened?: boolean;
  isSpeaking?: boolean;
  isSharingScreen?: boolean;
  isCameraOn?: boolean;
}

export interface CallPrivacyPayload {
  adminId: string;
  chatId: string;
  isPrivate: boolean;
  password?: string;
  category?: RoomCategory;
  roomName?: string;
}

export interface CallEndPayload {
  senderId: string;
  chatId: string;
  reason?: "hangup" | "rejected" | "busy" | "timeout" | "error";
}

export interface CallMemberJoinedPayload {
  uid: string;
  name: string;
  avatar?: string | null;
  chatId: string;
}

export interface CallMemberLeftPayload {
  uid: string;
  chatId: string;
}

const activeChannels = new Map<string, any>();

export const getVoiceRoomTopic = (chatId: string): string => {
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(chatId);
  return isUuid ? `voice:room:${chatId}` : `call_session_${chatId}`;
};

export const getOrCreateChannel = async (channelName: string): Promise<any> => {
  let channel = activeChannels.get(channelName);
  if (channel && channel.state === "joined") {
    return channel;
  }
  if (!channel) {
    channel = supabase.channel(channelName);
    activeChannels.set(channelName, channel);
  }

  await new Promise<void>((resolve) => {
    const timer = setTimeout(() => {
      resolve();
    }, 4000);

    channel.subscribe((status: string) => {
      if (status === "SUBSCRIBED" || status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        clearTimeout(timer);
        resolve();
      }
    });
  });

  return channel;
};

/**
 * Escuta chamadas recebidas direcionadas para o UID do usuário atual
 */
export const subscribeToUserIncomingCalls = (
  myUid: string,
  callbacks: {
    onInvite: (invite: CallInvitePayload) => void;
    onEnd: (end: CallEndPayload) => void;
  },
) => {
  const channelName = `user_calls_${myUid}`;
  let channel = activeChannels.get(channelName);
  if (channel) {
    supabase.removeChannel(channel);
    activeChannels.delete(channelName);
  }

  channel = supabase.channel(channelName)
    .on("broadcast", { event: "call:invite" }, (e) => {
      if (e.payload && typeof e.payload === "object" && e.payload.callerId && e.payload.callerId !== myUid) {
        callbacks.onInvite(e.payload as CallInvitePayload);
      }
    })
    .on("broadcast", { event: "call:end" }, (e) => {
      if (e.payload && typeof e.payload === "object") {
        callbacks.onEnd(e.payload as CallEndPayload);
      }
    })
    .subscribe();

  activeChannels.set(channelName, channel);

  return () => {
    supabase.removeChannel(channel);
    activeChannels.delete(channelName);
  };
};

/**
 * Envia um convite de chamada para o amigo
 */
export const sendCallInvite = async (
  targetFriendUid: string,
  invite: CallInvitePayload,
) => {
  const channel = await getOrCreateChannel(`user_calls_${targetFriendUid}`);
  await channel.send({
    type: "broadcast",
    event: "call:invite",
    payload: invite,
  });
};

/**
 * Inscreve-se no canal da sessão ativa de chamada (chatId) para troca de sinais WebRTC
 */
export const subscribeToCallSession = (
  chatId: string,
  myUid: string,
  callbacks: {
    onAnswer?: (answer: CallAnswerPayload) => void;
    onSignal?: (signal: CallSignalPayload) => void;
    onState?: (state: CallStatePayload) => void;
    onEnd?: (end: CallEndPayload) => void;
    onKicked?: (kick: CallKickPayload) => void;
    onPrivacy?: (privacy: CallPrivacyPayload) => void;
    onMemberJoined?: (joined: CallMemberJoinedPayload) => void;
    onMemberLeft?: (left: CallMemberLeftPayload) => void;
  },
) => {
  const channelName = getVoiceRoomTopic(chatId);
  let channel = activeChannels.get(channelName);
  if (channel) {
    supabase.removeChannel(channel);
    activeChannels.delete(channelName);
  }

  channel = supabase.channel(channelName)
    .on("broadcast", { event: "call:answer" }, (e) => {
      if (e.payload && typeof e.payload === "object" && e.payload.responderId !== myUid) {
        callbacks.onAnswer?.(e.payload as CallAnswerPayload);
      }
    })
    .on("broadcast", { event: "call:signal" }, (e) => {
      if (e.payload && typeof e.payload === "object" && e.payload.senderId !== myUid) {
        const payload = e.payload as CallSignalPayload;
        // Se houver targetUid, entrega apenas se for destinado ao usuário atual
        if (!payload.targetUid || payload.targetUid === myUid) {
          callbacks.onSignal?.(payload);
        }
      }
    })
    .on("broadcast", { event: "call:state" }, (e) => {
      if (e.payload && typeof e.payload === "object" && e.payload.senderId !== myUid) {
        callbacks.onState?.(e.payload as CallStatePayload);
      }
    })
    .on("broadcast", { event: "call:kick" }, (e) => {
      if (e.payload && typeof e.payload === "object" && e.payload.targetUserId === myUid) {
        callbacks.onKicked?.(e.payload as CallKickPayload);
      }
    })
    .on("broadcast", { event: "call:privacy" }, (e) => {
      if (e.payload && typeof e.payload === "object") {
        callbacks.onPrivacy?.(e.payload as CallPrivacyPayload);
      }
    })
    .on("broadcast", { event: "call:member-joined" }, (e) => {
      if (e.payload && typeof e.payload === "object" && e.payload.uid !== myUid) {
        callbacks.onMemberJoined?.(e.payload as CallMemberJoinedPayload);
      }
    })
    .on("broadcast", { event: "call:member-left" }, (e) => {
      if (e.payload && typeof e.payload === "object" && e.payload.uid !== myUid) {
        callbacks.onMemberLeft?.(e.payload as CallMemberLeftPayload);
      }
    })
    .on("broadcast", { event: "call:end" }, (e) => {
      if (e.payload && typeof e.payload === "object") {
        callbacks.onEnd?.(e.payload as CallEndPayload);
      }
    })
    .subscribe();

  activeChannels.set(channelName, channel);

  return () => {
    supabase.removeChannel(channel);
    activeChannels.delete(channelName);
  };
};

/**
 * Responde a uma chamada (aceitar ou rejeitar)
 */
export const sendCallAnswer = async (
  chatId: string,
  callerUid: string,
  answer: CallAnswerPayload,
) => {
  const sessionChannel = await getOrCreateChannel(getVoiceRoomTopic(chatId));
  await sessionChannel.send({
    type: "broadcast",
    event: "call:answer",
    payload: answer,
  });

  const callerChannel = await getOrCreateChannel(`user_calls_${callerUid}`);
  await callerChannel.send({
    type: "broadcast",
    event: "call:answer",
    payload: answer,
  });
};

/**
 * Envia sinal WebRTC (SDP Offer / Answer ou ICE Candidate) com suporte a targetUid para Mesh
 */
export const sendCallSignal = async (
  chatId: string,
  signal: CallSignalPayload,
) => {
  const channel = await getOrCreateChannel(getVoiceRoomTopic(chatId));
  await channel.send({
    type: "broadcast",
    event: "call:signal",
    payload: signal,
  });
};

/**
 * Envia atualização de estado (mute, deafen, falando, compartilhando tela)
 */
export const sendCallState = async (
  chatId: string,
  state: CallStatePayload,
) => {
  const channel = await getOrCreateChannel(getVoiceRoomTopic(chatId));
  await channel.send({
    type: "broadcast",
    event: "call:state",
    payload: state,
  });
};

/**
 * Notifica que um novo membro entrou na sala
 */
export const sendCallMemberJoined = async (
  chatId: string,
  joinedPayload: CallMemberJoinedPayload,
) => {
  const sessionChannel = await getOrCreateChannel(getVoiceRoomTopic(chatId));
  await sessionChannel.send({
    type: "broadcast",
    event: "call:member-joined",
    payload: joinedPayload,
  });
};

/**
 * Notifica que um membro saiu da sala
 */
export const sendCallMemberLeft = async (
  chatId: string,
  leftPayload: CallMemberLeftPayload,
) => {
  const sessionChannel = await getOrCreateChannel(getVoiceRoomTopic(chatId));
  await sessionChannel.send({
    type: "broadcast",
    event: "call:member-left",
    payload: leftPayload,
  });
};

/**
 * Expulsa um participante da chamada (Admin action)
 */
export const sendCallKick = async (
  chatId: string,
  targetUserId: string,
  kickPayload: CallKickPayload,
) => {
  const sessionChannel = await getOrCreateChannel(getVoiceRoomTopic(chatId));
  await sessionChannel.send({
    type: "broadcast",
    event: "call:kick",
    payload: kickPayload,
  });

  const friendChannel = await getOrCreateChannel(`user_calls_${targetUserId}`);
  await friendChannel.send({
    type: "broadcast",
    event: "call:kick",
    payload: kickPayload,
  });
};

/**
 * Encerra a chamada
 */
export const sendCallEnd = async (
  chatId: string,
  friendUid: string,
  endPayload: CallEndPayload,
) => {
  const sessionChannel = await getOrCreateChannel(getVoiceRoomTopic(chatId));
  await sessionChannel.send({
    type: "broadcast",
    event: "call:end",
    payload: endPayload,
  });

  if (friendUid && friendUid !== "room-all") {
    const friendChannel = await getOrCreateChannel(`user_calls_${friendUid}`);
    await friendChannel.send({
      type: "broadcast",
      event: "call:end",
      payload: endPayload,
    });
  }
};

/**
 * Envia atualização de privacidade e senha da sala (Admin action)
 */
export const sendCallPrivacyUpdate = async (
  chatId: string,
  privacyPayload: CallPrivacyPayload,
) => {
  const sessionChannel = await getOrCreateChannel(getVoiceRoomTopic(chatId));
  await sessionChannel.send({
    type: "broadcast",
    event: "call:privacy",
    payload: privacyPayload,
  });
};
