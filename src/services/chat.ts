import { auth } from "../../Firebase";
import { apiUrl } from "./api";
import type { ChatMessage } from "../types/domain";

// Conexão SSE global autenticada por header. O token nunca entra na URL.
let streamAbortController: AbortController | null = null;
let reconnectTimer: number | null = null;
let connectedUserUid: string | null = null;
const messageListeners = new Set<(msg: ChatMessage) => void>();
const typingListeners = new Set<(data: { senderId: string; typing: boolean }) => void>();

// Gerenciamento de Não Lidas em Memória (Tempo Real)
let activeChatFriendUid: string | null = null;
const unreadMessages: ChatMessage[] = [];
const unreadListeners = new Set<(messages: ChatMessage[]) => void>();

const getAuthHeaders = async () => {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error("Sessao expirada. Entre novamente.");
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
};

const dispatchChatStreamData = (rawData: string) => {
  if (!rawData) return;
  try {
    const data = JSON.parse(rawData) as {
      type?: string;
      message?: ChatMessage;
      senderId?: string;
      typing?: boolean;
    };
    if (data.type === "message" && data.message) {
      const msg = data.message;
      if (
        activeChatFriendUid !== msg.senderId
        && !unreadMessages.some((message) => message.id === msg.id)
      ) {
        unreadMessages.push(msg);
        unreadListeners.forEach((listener) => listener([...unreadMessages]));
      }
      messageListeners.forEach((listener) => listener(msg));
      return;
    }
    if (data.type === "typing" && data.senderId) {
      typingListeners.forEach((listener) => listener({
        senderId: String(data.senderId),
        typing: Boolean(data.typing),
      }));
    }
  } catch {
    console.error("[ChatClient] Evento SSE inválido recebido.");
  }
};

const consumeChatStream = async (response: Response, signal: AbortSignal) => {
  if (!response.body) throw new Error("Stream de chat indisponível.");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (!signal.aborted) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n");
    let boundary = buffer.indexOf("\n\n");
    while (boundary >= 0) {
      const block = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      const data = block
        .split("\n")
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).trimStart())
        .join("\n");
      dispatchChatStreamData(data);
      boundary = buffer.indexOf("\n\n");
    }
  }
};

/** Garante que a conexão SSE autenticada esteja ativa. */
export const establishChatConnection = async () => {
  const user = auth.currentUser;
  if (!user) return;
  if (streamAbortController && connectedUserUid === user.uid) return;

  if (streamAbortController) streamAbortController.abort();
  if (reconnectTimer != null) {
    window.clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  const controller = new AbortController();
  streamAbortController = controller;
  connectedUserUid = user.uid;

  try {
    const response = await fetch(apiUrl("/api/chat/stream"), {
      headers: await getAuthHeaders(),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Chat SSE respondeu ${response.status}.`);
    await consumeChatStream(response, controller.signal);
    if (!controller.signal.aborted) throw new Error("Stream de chat encerrado.");
  } catch {
    if (!controller.signal.aborted) {
      console.error("[ChatClient] Conexão em tempo real interrompida; nova tentativa agendada.");
    }
  } finally {
    if (streamAbortController === controller) {
      streamAbortController = null;
      connectedUserUid = null;
      if (!controller.signal.aborted && auth.currentUser) {
        reconnectTimer = window.setTimeout(() => {
          reconnectTimer = null;
          void establishChatConnection();
        }, 5000);
      }
    }
  }
};

/**
 * Fecha a conexão SSE
 */
export const closeChatConnection = () => {
  if (reconnectTimer != null) {
    window.clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  streamAbortController?.abort();
  streamAbortController = null;
  connectedUserUid = null;
  activeChatFriendUid = null;
  if (unreadMessages.length > 0) {
    unreadMessages.splice(0, unreadMessages.length);
    unreadListeners.forEach((listener) => listener([]));
  }
};

export const getChatId = (uid1: string, uid2: string) => {
  return [uid1, uid2].sort().join("_");
};

export const sendChatMessage = async (receiverUid: string, text: string) => {
  const headers = await getAuthHeaders();
  const response = await fetch(apiUrl("/api/chat/send"), {
    method: "POST",
    headers,
    body: JSON.stringify({ receiverId: receiverUid, text }),
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error || "Erro ao enviar mensagem.");
  }
  return payload.message as ChatMessage;
};

export const setChatTyping = async (friendUid: string, typing: boolean) => {
  const headers = await getAuthHeaders();
  await fetch(apiUrl("/api/chat/typing"), {
    method: "POST",
    headers,
    body: JSON.stringify({ receiverId: friendUid, typing }),
  }).catch(() => undefined);
};

export const cleanupExpiredChatMessages = async (friendUid: string) => {
  void friendUid;
  return Promise.resolve();
};

export const markMessagesAsRead = async (friendUid: string) => {
  const initialLength = unreadMessages.length;
  // Remove mensagens não lidas do amigo específico
  for (let i = unreadMessages.length - 1; i >= 0; i--) {
    if (unreadMessages[i].senderId === friendUid) {
      unreadMessages.splice(i, 1);
    }
  }
  if (unreadMessages.length !== initialLength) {
    unreadListeners.forEach((listener) => listener([...unreadMessages]));
  }
  return Promise.resolve();
};

/**
 * Inscreve-se nas mensagens de um amigo específico.
 * Carrega o histórico da memória do backend no início.
 */
export const subscribeToChatMessages = (
  friendUid: string,
  callback: (messages: ChatMessage[]) => void,
) => {
  let messagesList: ChatMessage[] = [];
  activeChatFriendUid = friendUid;

  // Ao abrir o chat de um amigo, limpa as mensagens não lidas dele
  void markMessagesAsRead(friendUid);

  // 1. Carrega o histórico em memória inicial
  const loadHistory = async () => {
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(apiUrl(`/api/chat/history?friendUid=${friendUid}`), { headers });
      if (res.ok) {
        messagesList = await res.json();
        callback([...messagesList]);
      }
    } catch (err) {
      console.error("[ChatClient] Erro ao carregar histórico inicial:", err);
    }
  };

  void loadHistory();
  void establishChatConnection();

  // 2. Escuta novas mensagens em tempo real
  const handleNewMessage = (msg: ChatMessage) => {
    const currentUid = auth.currentUser?.uid;
    if (!currentUid) return;
    const currentChatId = getChatId(currentUid, friendUid);

    if (msg.chatId === currentChatId) {
      // Evita duplicados
      if (!messagesList.some((m) => m.id === msg.id)) {
        messagesList.push(msg);
        callback([...messagesList]);
      }
    }
  };

  messageListeners.add(handleNewMessage);

  return () => {
    messageListeners.delete(handleNewMessage);
    if (activeChatFriendUid === friendUid) {
      activeChatFriendUid = null;
    }
  };
};

/**
 * Inscreve-se na digitação do amigo
 */
export const subscribeToFriendTyping = (
  friendUid: string,
  callback: (typing: boolean) => void,
) => {
  void establishChatConnection();

  const handleTypingEvent = (data: { senderId: string; typing: boolean }) => {
    if (data.senderId === friendUid) {
      callback(data.typing);
    }
  };

  typingListeners.add(handleTypingEvent);

  return () => {
    typingListeners.delete(handleTypingEvent);
  };
};

/**
 * Escuta não lidas em tempo real (em memória do cliente)
 */
export const subscribeToUnreadMessages = (
  callback: (messages: ChatMessage[]) => void,
) => {
  unreadListeners.add(callback);
  callback([...unreadMessages]);
  
  return () => {
    unreadListeners.delete(callback);
  };
};
