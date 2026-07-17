import {
  limitToLast,
  off,
  onChildAdded,
  onValue,
  push,
  query,
  ref,
  remove,
  serverTimestamp,
  set,
  update,
} from "firebase/database";
import { auth, realtimeDb } from "../../Firebase";
import type { ChatMessage } from "../types/domain";
import { apiUrl } from "./api";

const HISTORY_LIMIT = 50;
const messageListeners = new Set<(message: ChatMessage) => void>();
const typingListeners = new Set<(data: { senderId: string; typing: boolean }) => void>();
const unreadListeners = new Set<(messages: ChatMessage[]) => void>();
const unreadMessages: ChatMessage[] = [];

let activeChatFriendUid: string | null = null;
let connectedUserUid: string | null = null;
let userChatsRef: ReturnType<typeof ref> | null = null;
let seenInboxMessageIds = new Set<string>();
let inboxInitialized = false;
const openedChatIds = new Set<string>();
const openingChats = new Map<string, Promise<string>>();

export const getChatId = (uid1: string, uid2: string) =>
  [uid1, uid2].sort().join("_");

const emitUnread = () => {
  unreadListeners.forEach((listener) => listener([...unreadMessages]));
};

const normalizeMessage = (
  id: string,
  value: Record<string, unknown>,
): ChatMessage => ({
  id,
  chatId: String(value.chatId || ""),
  senderId: String(value.senderId || ""),
  receiverId: String(value.receiverId || ""),
  text: String(value.text || ""),
  createdAt: typeof value.createdAt === "number"
    ? new Date(value.createdAt).toISOString()
    : String(value.createdAt || new Date().toISOString()),
  read: false,
});

const ensureChat = async (uid: string, friendUid: string) => {
  const expectedChatId = getChatId(uid, friendUid);
  if (openedChatIds.has(expectedChatId)) return expectedChatId;
  const pending = openingChats.get(expectedChatId);
  if (pending) return pending;
  const request = (async () => {
    const token = await auth.currentUser?.getIdToken();
    if (!token || auth.currentUser?.uid !== uid) {
      throw new Error("Sessao expirada. Entre novamente.");
    }
    const response = await fetch(apiUrl("/api/chat/open"), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ friendUid }),
    });
    const payload = await response.json().catch(() => ({})) as {
      chatId?: string;
      error?: string;
    };
    if (!response.ok || !payload.chatId) {
      throw new Error(payload.error || "Nao foi possivel abrir a conversa.");
    }
    openedChatIds.add(payload.chatId);
    return payload.chatId;
  })();
  openingChats.set(expectedChatId, request);
  try {
    return await request;
  } finally {
    openingChats.delete(expectedChatId);
  }
};

export const establishChatConnection = async () => {
  const uid = auth.currentUser?.uid;
  if (!uid || connectedUserUid === uid) return;
  closeChatConnection();
  connectedUserUid = uid;
  seenInboxMessageIds = new Set();
  inboxInitialized = false;
  userChatsRef = ref(realtimeDb, `userChats/${uid}`);

  onValue(userChatsRef, (snapshot) => {
    const chats = snapshot.val() as Record<string, {
      lastMessageId?: string;
      senderId?: string;
      receiverId?: string;
      text?: string;
      updatedAt?: number;
    }> | null;
    if (!chats) {
      inboxInitialized = true;
      return;
    }
    if (!inboxInitialized) {
      Object.values(chats).forEach((item) => {
        const messageId = String(item.lastMessageId || "");
        if (messageId) seenInboxMessageIds.add(messageId);
      });
      inboxInitialized = true;
      return;
    }
    Object.entries(chats).forEach(([chatId, item]) => {
      const messageId = String(item.lastMessageId || "");
      if (!messageId || seenInboxMessageIds.has(messageId)) return;
      seenInboxMessageIds.add(messageId);
      if (item.senderId !== uid) {
        const message = normalizeMessage(messageId, { ...item, chatId });
        if (
          activeChatFriendUid !== message.senderId
          && !unreadMessages.some((candidate) => candidate.id === message.id)
        ) {
          unreadMessages.push(message);
          emitUnread();
        }
        messageListeners.forEach((listener) => listener(message));
      }
    });
  });
};

export const closeChatConnection = () => {
  if (userChatsRef) off(userChatsRef);
  userChatsRef = null;
  connectedUserUid = null;
  inboxInitialized = false;
  activeChatFriendUid = null;
  unreadMessages.splice(0, unreadMessages.length);
  openedChatIds.clear();
  openingChats.clear();
  emitUnread();
};

export const sendChatMessage = async (
  receiverUid: string,
  rawText: string,
): Promise<ChatMessage> => {
  const senderId = auth.currentUser?.uid;
  const receiverId = String(receiverUid || "").trim();
  const text = String(rawText || "").trim();
  if (!senderId) throw new Error("Sessao expirada. Entre novamente.");
  if (!receiverId || receiverId === senderId) throw new Error("Destinatario invalido.");
  if (!text || text.length > 2_000) throw new Error("Mensagem invalida.");

  const chatId = await ensureChat(senderId, receiverId);
  const messageRef = push(ref(realtimeDb, `chats/${chatId}/messages`));
  const messageId = messageRef.key;
  if (!messageId) throw new Error("Nao foi possivel gerar a mensagem.");
  const createdAt = Date.now();
  const messageData = {
    chatId,
    senderId,
    receiverId,
    text,
    createdAt: serverTimestamp(),
  };
  await set(messageRef, messageData);
  await update(ref(realtimeDb), {
    [`userChats/${senderId}/${chatId}`]: {
      friendUid: receiverId,
      lastMessageId: messageId,
      senderId,
      receiverId,
      text,
      updatedAt: createdAt,
    },
    [`userChats/${receiverId}/${chatId}`]: {
      friendUid: senderId,
      lastMessageId: messageId,
      senderId,
      receiverId,
      text,
      updatedAt: createdAt,
    },
  });
  return normalizeMessage(messageId, { ...messageData, createdAt });
};

export const setChatTyping = async (friendUid: string, typing: boolean) => {
  const uid = auth.currentUser?.uid;
  if (!uid) return;
  const chatId = await ensureChat(uid, friendUid);
  const typingRef = ref(realtimeDb, `chats/${chatId}/typing/${uid}`);
  if (!typing) {
    await remove(typingRef).catch(() => undefined);
    return;
  }
  await set(typingRef, {
    active: true,
    updatedAt: serverTimestamp(),
  }).catch(() => undefined);
};

export const cleanupExpiredChatMessages = async (friendUid: string) => {
  void friendUid;
};

export const markMessagesAsRead = async (friendUid: string) => {
  const uid = auth.currentUser?.uid;
  if (!uid) return;
  const chatId = getChatId(uid, friendUid);
  await set(ref(realtimeDb, `chats/${chatId}/reads/${uid}`), serverTimestamp())
    .catch(() => undefined);
  for (let index = unreadMessages.length - 1; index >= 0; index -= 1) {
    if (unreadMessages[index].senderId === friendUid) unreadMessages.splice(index, 1);
  }
  emitUnread();
};

export const subscribeToChatMessages = (
  friendUid: string,
  callback: (messages: ChatMessage[]) => void,
) => {
  const uid = auth.currentUser?.uid;
  if (!uid) return () => undefined;
  const chatId = getChatId(uid, friendUid);
  const messagesQuery = query(
    ref(realtimeDb, `chats/${chatId}/messages`),
    limitToLast(HISTORY_LIMIT),
  );
  const messages = new Map<string, ChatMessage>();
  activeChatFriendUid = friendUid;
  void establishChatConnection();

  let cancelled = false;
  let unsubscribe: () => void = () => {};
  void ensureChat(uid, friendUid).then(() => {
    if (cancelled) return;
    void markMessagesAsRead(friendUid);
    unsubscribe = onChildAdded(messagesQuery, (snapshot) => {
      const message = normalizeMessage(
        snapshot.key || "",
        snapshot.val() as Record<string, unknown>,
      );
      if (!message.id || messages.has(message.id)) return;
      messages.set(message.id, message);
      callback(
        [...messages.values()]
          .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
      );
    });
  }).catch((error) => console.error("Erro ao abrir conversa:", error));

  const forwardMessage = (message: ChatMessage) => {
    if (message.chatId !== chatId || !message.id || messages.has(message.id)) return;
    messages.set(message.id, message);
    callback([...messages.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt)));
  };
  messageListeners.add(forwardMessage);

  return () => {
    cancelled = true;
    unsubscribe();
    messageListeners.delete(forwardMessage);
    if (activeChatFriendUid === friendUid) activeChatFriendUid = null;
  };
};

export const subscribeToFriendTyping = (
  friendUid: string,
  callback: (typing: boolean) => void,
) => {
  const uid = auth.currentUser?.uid;
  if (!uid) return () => undefined;
  const chatId = getChatId(uid, friendUid);
  const typingRef = ref(realtimeDb, `chats/${chatId}/typing/${friendUid}`);
  let cancelled = false;
  let unsubscribe: () => void = () => {};
  void ensureChat(uid, friendUid).then(() => {
    if (cancelled) return;
    unsubscribe = onValue(typingRef, (snapshot) => {
      const value = snapshot.val() as { active?: boolean; updatedAt?: number } | null;
      const fresh = value?.updatedAt
        ? Date.now() - Number(value.updatedAt) < 10_000
        : false;
      callback(Boolean(value?.active && fresh));
      typingListeners.forEach((listener) =>
        listener({ senderId: friendUid, typing: Boolean(value?.active && fresh) }));
    });
  }).catch(() => callback(false));
  return () => {
    cancelled = true;
    unsubscribe();
  };
};

export const subscribeToUnreadMessages = (
  callback: (messages: ChatMessage[]) => void,
) => {
  unreadListeners.add(callback);
  callback([...unreadMessages]);
  return () => {
    unreadListeners.delete(callback);
  };
};
