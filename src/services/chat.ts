import {
  addDoc,
  collection,
  onSnapshot,
  query,
  serverTimestamp,
  where,
  writeBatch,
  getDocs,
  orderBy,
} from "firebase/firestore";
import { db, auth } from "../../Firebase";
import type { ChatMessage } from "../types/domain";

export const getChatId = (uid1: string, uid2: string) => {
  return [uid1, uid2].sort().join("_");
};

export const sendChatMessage = async (receiverUid: string, text: string) => {
  const currentUid = auth.currentUser?.uid;
  if (!currentUid) throw new Error("Usuário não autenticado");

  const chatId = getChatId(currentUid, receiverUid);
  const messagePayload = {
    chatId,
    senderId: currentUid,
    receiverId: receiverUid,
    text,
    createdAt: serverTimestamp(),
    read: false,
  };

  await addDoc(collection(db, "messages"), messagePayload);
};

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
    orderBy("createdAt", "asc"),
  );

  return onSnapshot(q, (snapshot) => {
    const msgs: ChatMessage[] = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      msgs.push({
        id: doc.id,
        chatId: data.chatId,
        senderId: data.senderId,
        receiverId: data.receiverId,
        text: data.text,
        createdAt: data.createdAt
          ? new Date(data.createdAt.seconds * 1000).toISOString()
          : new Date().toISOString(),
        read: Boolean(data.read),
      });
    });
    callback(msgs);
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
    const msgs: ChatMessage[] = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      msgs.push({
        id: doc.id,
        chatId: data.chatId,
        senderId: data.senderId,
        receiverId: data.receiverId,
        text: data.text,
        createdAt: data.createdAt
          ? new Date(data.createdAt.seconds * 1000).toISOString()
          : new Date().toISOString(),
        read: Boolean(data.read),
      });
    });
    callback(msgs);
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
    snapshot.forEach((doc) => {
      batch.update(doc.ref, { read: true });
    });
    await batch.commit();
  } catch (error) {
    console.error("Error marking messages as read:", error);
  }
};
