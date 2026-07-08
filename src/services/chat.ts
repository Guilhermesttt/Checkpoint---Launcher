import { auth } from "../../Firebase";
import { apiUrl } from "./api";
import type { ChatMessage } from "../types/domain";

// Conexão SSE Global ativa
let eventSource: EventSource | null = null;
const messageListeners = new Set<(msg: ChatMessage) => void>();
const typingListeners = new Set<(data: { senderId: string; typing: boolean }) => void>();

const getAuthHeaders = async () => {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error("Sessao expirada. Entre novamente.");
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
};

/**
 * Garante que a conexão SSE esteja ativa e escutando eventos globais
 */
export const establishChatConnection = async () => {
  const user = auth.currentUser;
  if (!user) return;

  if (eventSource) {
    if (eventSource.readyState === EventSource.OPEN || eventSource.readyState === EventSource.CONNECTING) {
      return;
    }
    eventSource.close();
  }

  const token = await user.getIdToken();
  const streamUrl = apiUrl(`/api/chat/stream?token=${encodeURIComponent(token)}`);

  console.log("[ChatClient] Abrindo conexão SSE em:", streamUrl);
  eventSource = new EventSource(streamUrl);

  eventSource.onmessage = (event) => {
    // Tratamento de ping silencioso
    if (!event.data) return;

    try {
      const data = JSON.parse(event.data);
      if (data.type === "message" && data.message) {
        console.log("[ChatClient] Nova mensagem recebida via SSE:", data.message);
        messageListeners.forEach((listener) => listener(data.message));
      } else if (data.type === "typing") {
        console.log("[ChatClient] Evento de digitação recebido via SSE:", data);
        typingListeners.forEach((listener) => listener({ senderId: data.senderId, typing: data.typing }));
      }
    } catch (err) {
      console.error("[ChatClient] Erro ao parsear dados do SSE:", err);
    }
  };

  eventSource.onerror = (err) => {
    console.error("[ChatClient] Erro na conexão SSE. Tentando reconectar...", err);
    eventSource?.close();
    eventSource = null;
    // Tenta reconectar após 5 segundos
    setTimeout(establishChatConnection, 5000);
  };
};

/**
 * Fecha a conexão SSE
 */
export const closeChatConnection = () => {
  if (eventSource) {
    eventSource.close();
    eventSource = null;
    console.log("[ChatClient] Conexão SSE encerrada manualmente.");
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
  return Promise.resolve();
};

export const markMessagesAsRead = async (friendUid: string) => {
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
 * Mock para compatibilidade com o Home.tsx que ouve não lidos
 */
export const subscribeToUnreadMessages = (
  callback: (messages: ChatMessage[]) => void,
) => {
  callback([]);
  return () => {};
};
