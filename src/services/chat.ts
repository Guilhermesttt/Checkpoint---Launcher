import {
  limitToLast,
  off,
  onValue,
  orderByChild,
  push,
  query,
  ref,
  remove,
  serverTimestamp,
  set,
  update,
} from "firebase/database";
import {
  deleteObject,
  getDownloadURL,
  ref as storageRef,
  uploadBytes,
} from "firebase/storage";
import { auth, realtimeDb, storage } from "../../Firebase";
import type { ChatMessage } from "../types/domain";
import { apiUrl } from "./api";

const HISTORY_LIMIT = 50;
const MAX_IMAGE_SIZE = 8 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const messageListeners = new Set<(message: ChatMessage) => void>();
const typingListeners = new Set<(data: { senderId: string; typing: boolean }) => void>();
const unreadListeners = new Set<(messages: ChatMessage[]) => void>();
const unreadMessages: ChatMessage[] = [];

const activeChatSubscriptions = new Map<string, number>();
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
  attachmentName: value.attachmentName ? String(value.attachmentName) : undefined,
  attachmentUrl: value.attachmentUrl ? String(value.attachmentUrl) : undefined,
  attachmentType: value.attachmentType ? String(value.attachmentType) : undefined,
  attachmentSize: typeof value.attachmentSize === "number"
    ? value.attachmentSize
    : undefined,
  attachmentPath: value.attachmentPath ? String(value.attachmentPath) : undefined,
});

const messageTimestamp = (message: Pick<ChatMessage, "createdAt">) => {
  const timestamp = Date.parse(String(message.createdAt || ""));
  return Number.isFinite(timestamp) ? timestamp : 0;
};

export const compareChatMessages = (a: ChatMessage, b: ChatMessage) => {
  const timeDifference = messageTimestamp(a) - messageTimestamp(b);
  if (timeDifference !== 0) return timeDifference;
  return String(a.id || "").localeCompare(String(b.id || ""));
};

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
          !activeChatSubscriptions.has(message.senderId)
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
  activeChatSubscriptions.clear();
  unreadMessages.splice(0, unreadMessages.length);
  openedChatIds.clear();
  openingChats.clear();
  emitUnread();
};

export const sendChatMessage = async (
  receiverUid: string,
  rawText: string,
  attachment?: Pick<
    ChatMessage,
    "attachmentName" | "attachmentUrl" | "attachmentType" | "attachmentSize" | "attachmentPath"
  >,
): Promise<ChatMessage> => {
  const senderId = auth.currentUser?.uid;
  const receiverId = String(receiverUid || "").trim();
  const text = String(rawText || "").trim();
  if (!senderId) throw new Error("Sessao expirada. Entre novamente.");
  if (!receiverId || receiverId === senderId) throw new Error("Destinatario invalido.");
  if ((!text && !attachment?.attachmentUrl) || text.length > 2_000) {
    throw new Error("Mensagem invalida.");
  }

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
    ...(attachment?.attachmentUrl ? {
      attachmentName: String(attachment.attachmentName || "imagem").slice(0, 160),
      attachmentUrl: attachment.attachmentUrl,
      attachmentType: String(attachment.attachmentType || "").slice(0, 80),
      attachmentSize: Math.max(0, Number(attachment.attachmentSize) || 0),
      attachmentPath: String(attachment.attachmentPath || "").slice(0, 500),
    } : {}),
    createdAt: serverTimestamp(),
  };
  await set(messageRef, messageData);
  await update(ref(realtimeDb), {
    [`userChats/${senderId}/${chatId}`]: {
      friendUid: receiverId,
      lastMessageId: messageId,
      senderId,
      receiverId,
      text: text || "📷 Imagem",
      updatedAt: createdAt,
    },
    [`userChats/${receiverId}/${chatId}`]: {
      friendUid: senderId,
      lastMessageId: messageId,
      senderId,
      receiverId,
      text: text || "📷 Imagem",
      updatedAt: createdAt,
    },
  });
  return normalizeMessage(messageId, { ...messageData, createdAt });
};

export const sendChatImage = async (
  receiverUid: string,
  file: File,
  caption = "",
): Promise<ChatMessage> => {
  const senderId = auth.currentUser?.uid;
  if (!senderId) throw new Error("Sessao expirada. Entre novamente.");
  if (!ALLOWED_IMAGE_TYPES.has(file.type) || file.size <= 0 || file.size > MAX_IMAGE_SIZE) {
    throw new Error("Use uma imagem JPG, PNG, WEBP ou GIF de ate 8 MB.");
  }

  const chatId = await ensureChat(senderId, receiverUid);
  const extension = file.type.split("/")[1]?.replace("jpeg", "jpg") || "img";
  const uploadId = globalThis.crypto?.randomUUID?.()
    || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  let attachmentPath = `chat-images/${senderId}/${chatId}/${uploadId}.${extension}`;
  let imageRef = storageRef(storage, attachmentPath);
  try {
    await uploadBytes(imageRef, file, {
      contentType: file.type,
      customMetadata: { chatId, senderId },
    });
  } catch (error) {
    const code = String((error as { code?: string })?.code || "");
    const legacyCompatible =
      code === "storage/unauthorized"
      && file.size <= 5 * 1024 * 1024
      && file.type !== "image/gif";
    if (!legacyCompatible) throw error;
    // Compatibilidade com clientes cuja regra de chat-images ainda não foi publicada.
    attachmentPath = `profile-avatars/${senderId}/chat-${chatId}-${uploadId}.${extension}`;
    imageRef = storageRef(storage, attachmentPath);
    await uploadBytes(imageRef, file, { contentType: file.type });
  }

  try {
    const attachmentUrl = await getDownloadURL(imageRef);
    return await sendChatMessage(receiverUid, caption.trim() || "📷 Imagem", {
      attachmentName: file.name,
      attachmentUrl,
      attachmentType: file.type,
      attachmentSize: file.size,
      attachmentPath,
    });
  } catch (error) {
    await deleteObject(imageRef).catch(() => undefined);
    throw error;
  }
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
    orderByChild("createdAt"),
    limitToLast(HISTORY_LIMIT),
  );
  const messages = new Map<string, ChatMessage>();
  activeChatSubscriptions.set(
    friendUid,
    (activeChatSubscriptions.get(friendUid) || 0) + 1,
  );
  void establishChatConnection();

  let cancelled = false;
  let unsubscribe: () => void = () => {};
  void ensureChat(uid, friendUid).then(() => {
    if (cancelled) return;
    void markMessagesAsRead(friendUid);
    unsubscribe = onValue(messagesQuery, (snapshot) => {
      const value = snapshot.val() as Record<string, Record<string, unknown>> | null;
      messages.clear();
      Object.entries(value || {}).forEach(([messageId, rawMessage]) => {
        const message = normalizeMessage(messageId, rawMessage);
        if (message.id) messages.set(messageId, message);
      });
      callback([...messages.values()].sort(compareChatMessages));
    });
  }).catch((error) => console.error("Erro ao abrir conversa:", error));

  const forwardMessage = (message: ChatMessage) => {
    if (message.chatId !== chatId || !message.id || messages.has(message.id)) return;
    messages.set(message.id, message);
    callback([...messages.values()].sort(compareChatMessages));
  };
  messageListeners.add(forwardMessage);

  return () => {
    cancelled = true;
    unsubscribe();
    messageListeners.delete(forwardMessage);
    const remainingSubscriptions = (activeChatSubscriptions.get(friendUid) || 1) - 1;
    if (remainingSubscriptions > 0) {
      activeChatSubscriptions.set(friendUid, remainingSubscriptions);
    } else {
      activeChatSubscriptions.delete(friendUid);
    }
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
    let lastTyping = false;
    const emitTyping = (value: { active?: boolean; updatedAt?: number } | null) => {
      const fresh = value?.updatedAt
        ? Date.now() - Number(value.updatedAt) < 6_000
        : false;
      const typing = Boolean(value?.active && fresh);
      if (typing === lastTyping) return;
      lastTyping = typing;
      callback(typing);
      typingListeners.forEach((listener) => listener({ senderId: friendUid, typing }));
    };
    let latestValue: { active?: boolean; updatedAt?: number } | null = null;
    unsubscribe = onValue(typingRef, (snapshot) => {
      latestValue = snapshot.val() as { active?: boolean; updatedAt?: number } | null;
      emitTyping(latestValue);
    });
    const freshnessTimer = window.setInterval(() => emitTyping(latestValue), 1_000);
    const firebaseUnsubscribe = unsubscribe;
    unsubscribe = () => {
      window.clearInterval(freshnessTimer);
      firebaseUnsubscribe();
    };
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
