import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { auth, db } from "../../Firebase";
import type { ChatMessage } from "../types/domain";
import { apiUrl } from "./api";

const CHAT_RETENTION_MS = 24 * 60 * 60 * 1000;

const getRecentChatCutoffDate = () => new Date(Date.now() - CHAT_RETENTION_MS);

const getAuthHeaders = async () => {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error("Sessao expirada. Entre novamente.");
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
};

export const getChatId = (uid1: string, uid2: string) => {
  return [uid1, uid2].sort().join("_");
};

export const sendChatMessage = async (receiverUid: string, text: string) => {
  const currentUid = auth.currentUser?.uid;
  if (!currentUid) throw new Error("Usuario nao autenticado");

  const chatId = getChatId(currentUid, receiverUid);
  const normalizedText = String(text).trim();
  if (!normalizedText) {
    throw new Error("Mensagem vazia.");
  }

  await addDoc(collection(db, "messages"), {
    chatId,
    senderId: currentUid,
    receiverId: receiverUid,
    text: normalizedText,
    createdAt: serverTimestamp(),
    read: false,
    attachmentName: "",
    attachmentUrl: "",
    attachmentType: "",
    attachmentSize: 0,
    attachmentPath: "",
  });
};

export const cleanupExpiredChatMessages = async (friendUid: string) => {
  const response = await fetch(apiUrl("/api/chat/cleanup"), {
    method: "POST",
    headers: await getAuthHeaders(),
    body: JSON.stringify({ uid: friendUid }),
  });
  const payload = (await response.json().catch(() => ({}))) as { error?: string };
  if (!response.ok) {
    throw new Error(payload.error || "Erro ao limpar conversa expirada.");
  }
};

export const setChatTyping = async (friendUid: string, typing: boolean) => {
  const currentUid = auth.currentUser?.uid;
  if (!currentUid) throw new Error("Usuario nao autenticado");

  const chatId = getChatId(currentUid, friendUid);
  const typingRef = doc(db, "chatTyping", `${chatId}_${currentUid}`);

  if (!typing) {
    await deleteDoc(typingRef).catch(() => undefined);
    return;
  }

  await setDoc(typingRef, {
    chatId,
    userId: currentUid,
    participants: [currentUid, friendUid].sort(),
    typing: true,
    updatedAt: serverTimestamp(),
  });
};

export const subscribeToFriendTyping = (
  friendUid: string,
  callback: (typing: boolean) => void,
) => {
  const currentUid = auth.currentUser?.uid;
  if (!currentUid) return () => {};

  const chatId = getChatId(currentUid, friendUid);
  const typingRef = doc(db, "chatTyping", `${chatId}_${friendUid}`);

  return onSnapshot(typingRef, (snapshot) => {
    if (!snapshot.exists()) {
      callback(false);
      return;
    }

    const data = snapshot.data();
    const updatedAtMs = data.updatedAt?.seconds
      ? data.updatedAt.seconds * 1000
      : Date.now();
    callback(Boolean(data.typing) && Date.now() - updatedAtMs < 6000);
  });
};

const toChatMessage = (id: string, data: Record<string, unknown>): ChatMessage => ({
  id,
  chatId: String(data.chatId || ""),
  senderId: String(data.senderId || ""),
  receiverId: String(data.receiverId || ""),
  text: String(data.text || ""),
  createdAt: data.createdAt && typeof data.createdAt === "object" && "seconds" in data.createdAt
    ? new Date(Number((data.createdAt as { seconds: number }).seconds) * 1000).toISOString()
    : new Date().toISOString(),
  read: Boolean(data.read),
  attachmentName: String(data.attachmentName || ""),
  attachmentUrl: String(data.attachmentUrl || ""),
  attachmentType: String(data.attachmentType || ""),
  attachmentSize: Number(data.attachmentSize || 0),
  attachmentPath: String(data.attachmentPath || ""),
});

export const subscribeToChatMessages = (
  friendUid: string,
  callback: (messages: ChatMessage[]) => void,
) => {
  const currentUid = auth.currentUser?.uid;
  if (!currentUid) return () => {};

  const chatId = getChatId(currentUid, friendUid);
  const q = query(
    collection(db, "messages"),
    where("chatId", "==", chatId),
    where("createdAt", ">=", getRecentChatCutoffDate()),
    orderBy("createdAt", "asc"),
  );

  return onSnapshot(q, (snapshot) => {
    const messages = snapshot.docs.map((item) =>
      toChatMessage(item.id, item.data() as Record<string, unknown>),
    );
    callback(messages);
  });
};

export const subscribeToUnreadMessages = (
  callback: (messages: ChatMessage[]) => void,
) => {
  const currentUid = auth.currentUser?.uid;
  if (!currentUid) return () => {};

  const q = query(
    collection(db, "messages"),
    where("receiverId", "==", currentUid),
    where("read", "==", false),
  );

  return onSnapshot(q, (snapshot) => {
    const messages = snapshot.docs
      .map((item) => toChatMessage(item.id, item.data() as Record<string, unknown>))
      .filter((message) => Date.now() - new Date(message.createdAt).getTime() < CHAT_RETENTION_MS);
    callback(messages);
  });
};

export const markMessagesAsRead = async (friendUid: string) => {
  const currentUid = auth.currentUser?.uid;
  if (!currentUid) return;

  const chatId = getChatId(currentUid, friendUid);
  const q = query(
    collection(db, "messages"),
    where("chatId", "==", chatId),
    where("receiverId", "==", currentUid),
    where("read", "==", false),
  );

  try {
    const snapshot = await getDocs(q);
    if (snapshot.empty) return;

    const batch = writeBatch(db);
    snapshot.forEach((item) => {
      batch.update(item.ref, { read: true });
    });
    await batch.commit();
  } catch (error) {
    console.error("Error marking messages as read:", error);
  }
};
