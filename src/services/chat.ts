import { supabase } from "./supabase";
import type { ChatMessage } from "../types/domain";
import { apiUrl } from "./api";

const HISTORY_LIMIT = 50;
const MAX_IMAGE_SIZE = 8 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

const messageListeners = new Set<(message: ChatMessage) => void>();
const unreadListeners = new Set<(messages: ChatMessage[]) => void>();
const unreadMessages: ChatMessage[] = [];

const activeChatChannels = new Map<string, any>();
const openedChatIds = new Map<string, string>();
const openingChats = new Map<string, Promise<string>>();

export const getChatId = (uid1: string, uid2: string) =>
  [uid1, uid2].sort().join("_");

const messageTimestamp = (message: Pick<ChatMessage, "createdAt">) => {
  const timestamp = Date.parse(String(message.createdAt || ""));
  return Number.isFinite(timestamp) ? timestamp : 0;
};

export const compareChatMessages = (a: ChatMessage, b: ChatMessage) => {
  const timeDifference = messageTimestamp(a) - messageTimestamp(b);
  if (timeDifference !== 0) return timeDifference;
  return String(a.id || "").localeCompare(String(b.id || ""));
};

const emitUnread = () => {
  unreadListeners.forEach((listener) => listener([...unreadMessages]));
};

export const normalizeMessage = (
  id: string,
  value: Record<string, unknown>,
): ChatMessage => {
  let createdAtIso: string;
  if (typeof value.createdAt === "number") {
    createdAtIso = new Date(value.createdAt).toISOString();
  } else if (typeof value.created_at === "string" && value.created_at) {
    createdAtIso = value.created_at;
  } else {
    createdAtIso = new Date().toISOString();
  }

  return {
    id: id || String(value.id || ""),
    chatId: String(value.chatId || value.chat_id || ""),
    senderId: String(value.senderId || value.sender_id || ""),
    receiverId: String(value.receiverId || value.receiver_id || ""),
    text: String(value.text || ""),
    createdAt: createdAtIso,
    read: Boolean(value.read),
    attachmentName: typeof value.attachmentName === "string" ? value.attachmentName : typeof value.attachment_name === "string" ? value.attachment_name : undefined,
    attachmentUrl: typeof value.attachmentUrl === "string" ? value.attachmentUrl : typeof value.attachment_url === "string" ? value.attachment_url : undefined,
    attachmentType: typeof value.attachmentType === "string" ? value.attachmentType : typeof value.attachment_type === "string" ? value.attachment_type : undefined,
    attachmentSize: typeof value.attachmentSize === "number" ? value.attachmentSize : typeof value.attachment_size === "number" ? value.attachment_size : undefined,
    attachmentPath: typeof value.attachmentPath === "string" ? value.attachmentPath : typeof value.attachment_path === "string" ? value.attachment_path : undefined,
  };
};

const hydrateAttachmentUrl = async (message: ChatMessage): Promise<ChatMessage> => {
  if (!message.attachmentPath) return message;
  const { data, error } = await supabase.storage
    .from("attachments")
    .createSignedUrl(message.attachmentPath, 60 * 60);
  return {
    ...message,
    attachmentUrl: error ? undefined : data.signedUrl,
  };
};

export const ensureChatSession = async (
  currentUid: string,
  friendUid: string,
): Promise<string> => {
  const chatId = getChatId(currentUid, friendUid);
  const openedChatId = openedChatIds.get(chatId);
  if (openedChatId) return openedChatId;

  const pending = openingChats.get(chatId);
  if (pending) return pending;

  const sessionPromise = (async () => {
    try {
      const session = (await supabase.auth.getSession()).data.session;
      if (!session?.access_token || session.user.id !== currentUid) {
        throw new Error("Sessao expirada. Entre novamente.");
      }
      const response = await fetch(apiUrl("/api/chat/open"), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ friendUid }),
      });
      const payload = await response.json().catch(() => ({})) as {
        chatId?: string;
        error?: string;
      };
      if (!response.ok || !payload.chatId) {
        throw new Error(payload.error || "Erro ao abrir conversa.");
      }
      openedChatIds.set(chatId, payload.chatId);
      return payload.chatId;
    } finally {
      openingChats.delete(chatId);
    }
  })();

  openingChats.set(chatId, sessionPromise);
  return sessionPromise;
};

export const establishChatConnection = async () => {
  const session = (await supabase.auth.getSession()).data.session;
  if (!session?.user) return;
  const uid = session.user.id;
  subscribeToActiveChats(uid);
};

export const subscribeToActiveChats = (uid: string) => {
  const channelKey = `unread_${uid}`;
  if (activeChatChannels.has(channelKey)) {
    return () => undefined;
  }

  void supabase
    .from("chat_messages")
    .select("*")
    .eq("receiver_id", uid)
    .eq("read", false)
    .order("created_at", { ascending: true })
    .limit(100)
    .then(async ({ data }) => {
      const messages = await Promise.all(
        (data || []).map((item) =>
          hydrateAttachmentUrl(normalizeMessage(String(item.id), item as any)),
        ),
      );
      messages.forEach((message) => {
        if (!unreadMessages.some((current) => current.id === message.id)) {
          unreadMessages.push(message);
        }
      });
      emitUnread();
    });

  const channel = supabase
    .channel(`user_chats_${uid}`)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "chat_messages", filter: `receiver_id=eq.${uid}` },
      async (payload) => {
        const msg = await hydrateAttachmentUrl(
          normalizeMessage(String(payload.new.id), payload.new as any),
        );
        if (!unreadMessages.some((m) => m.id === msg.id)) {
          unreadMessages.push(msg);
          emitUnread();
        }
        messageListeners.forEach((listener) => listener(msg));
      }
    )
    .subscribe();
  activeChatChannels.set(channelKey, channel);

  return () => {
    supabase.removeChannel(channel);
    activeChatChannels.delete(channelKey);
  };
};

export const closeChatConnection = () => {
  activeChatChannels.forEach((channel) => {
    supabase.removeChannel(channel);
  });
  activeChatChannels.clear();
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
  const session = (await supabase.auth.getSession()).data.session;
  const senderId = session?.user?.id;
  const receiverId = String(receiverUid || "").trim();
  const text = String(rawText || "").trim();
  if (!senderId) throw new Error("Sessao expirada. Entre novamente.");
  if (!receiverId || receiverId === senderId) throw new Error("Destinatario invalido.");
  if ((!text && !attachment?.attachmentPath) || text.length > 2_000) {
    throw new Error("Mensagem invalida.");
  }

  const chatId = await ensureChatSession(senderId, receiverId);
  const newMsg = {
    chat_id: chatId,
    sender_id: senderId,
    receiver_id: receiverId,
    text,
    read: false,
    attachment_name: attachment?.attachmentName || null,
    attachment_url: attachment?.attachmentUrl || null,
    attachment_type: attachment?.attachmentType || null,
    attachment_size: attachment?.attachmentSize || null,
    attachment_path: attachment?.attachmentPath || null,
    created_at: new Date().toISOString(),
  };

  const { data, error } = await supabase.from("chat_messages").insert(newMsg).select().single();
  if (error || !data) throw new Error(error?.message || "Falha ao enviar mensagem.");

  return hydrateAttachmentUrl(normalizeMessage(String(data.id), data as any));
};

export const sendChatImage = async (
  receiverUid: string,
  file: File,
  caption = "",
): Promise<ChatMessage> => {
  const session = (await supabase.auth.getSession()).data.session;
  const senderId = session?.user?.id;
  if (!senderId) throw new Error("Sessao expirada. Entre novamente.");
  if (!ALLOWED_IMAGE_TYPES.has(file.type) || file.size <= 0 || file.size > MAX_IMAGE_SIZE) {
    throw new Error("Use uma imagem JPG, PNG, WEBP ou GIF de ate 8 MB.");
  }

  const chatId = await ensureChatSession(senderId, receiverUid);
  const ext = file.name.split(".").pop() || "png";
  const path = `${chatId}/${Date.now()}_${crypto.randomUUID()}.${ext}`;

  const { data, error } = await supabase.storage.from("attachments").upload(path, file);
  if (error || !data) {
    throw new Error(error?.message || "Falha ao enviar a imagem.");
  }

  return sendChatMessage(receiverUid, caption.trim() || "📷 Imagem", {
    attachmentName: file.name,
    attachmentType: file.type,
    attachmentSize: file.size,
    attachmentPath: data.path,
  });
};

export const setChatTyping = async (friendUid: string, typing: boolean) => {
  const session = (await supabase.auth.getSession()).data.session;
  if (!session?.user) return;
  const uid = session.user.id;
  const chatId = await ensureChatSession(uid, friendUid);
  const channelKey = `typing_send_${chatId}`;
  let channel = activeChatChannels.get(channelKey);
  if (!channel) {
    channel = supabase.channel(`typing_${chatId}`);
    await new Promise<void>((resolve, reject) => {
      const timeoutId = window.setTimeout(
        () => reject(new Error("Tempo limite ao conectar indicador de digitacao.")),
        5_000,
      );
      channel.subscribe((status: string) => {
        if (status === "SUBSCRIBED") {
          window.clearTimeout(timeoutId);
          resolve();
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          window.clearTimeout(timeoutId);
          reject(new Error("Falha no indicador de digitacao."));
        }
      });
    });
    activeChatChannels.set(channelKey, channel);
  }
  await channel.send({
    type: "broadcast",
    event: "typing",
    payload: { senderId: uid, typing },
  });
};

export const cleanupExpiredChatMessages = async (friendUid: string) => {
  void friendUid;
};

export const markMessagesAsRead = async (friendUid: string) => {
  const session = (await supabase.auth.getSession()).data.session;
  if (!session?.user) return;
  const uid = session.user.id;
  const chatId = await ensureChatSession(uid, friendUid);

  await supabase
    .from("chat_messages")
    .update({ read: true })
    .eq("chat_id", chatId)
    .eq("receiver_id", uid);

  for (let index = unreadMessages.length - 1; index >= 0; index -= 1) {
    if (unreadMessages[index].senderId === friendUid) unreadMessages.splice(index, 1);
  }
  emitUnread();
};

export const subscribeToChatMessages = (
  friendUid: string,
  callback: (messages: ChatMessage[]) => void,
) => {
  let cancelled = false;
  let latestMessages: ChatMessage[] = [];
  let activeKey = "";

  supabase.auth.getSession().then(async ({ data: { session } }) => {
    if (!session?.user || cancelled) return;
    const uid = session.user.id;
    const chatId = await ensureChatSession(uid, friendUid);
    if (cancelled) return;
    activeKey = chatId;

    supabase
      .from("chat_messages")
      .select("*")
      .eq("chat_id", chatId)
      .order("created_at", { ascending: true })
      .limit(HISTORY_LIMIT)
      .then(async ({ data }) => {
        if (data && !cancelled) {
          latestMessages = await Promise.all(data.map((item) =>
            hydrateAttachmentUrl(normalizeMessage(String(item.id), item as any)),
          ));
          callback([...latestMessages]);
        }
      });

    const channel = supabase
      .channel(`chat_${chatId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages", filter: `chat_id=eq.${chatId}` },
        async (payload) => {
          const msg = await hydrateAttachmentUrl(
            normalizeMessage(String(payload.new.id), payload.new as any),
          );
          if (cancelled) return;
          if (!latestMessages.some((current) => current.id === msg.id)) {
            latestMessages = [...latestMessages, msg].sort(compareChatMessages);
            callback([...latestMessages]);
          }
          messageListeners.forEach((fn) => fn(msg));
        }
      )
      .subscribe();

    activeChatChannels.set(chatId, channel);
  });

  return () => {
    cancelled = true;
    const channel = activeChatChannels.get(activeKey);
    if (channel) {
      supabase.removeChannel(channel);
      activeChatChannels.delete(activeKey);
    }
  };
};

export const subscribeToFriendTyping = (
  friendUid: string,
  callback: (typing: boolean) => void,
) => {
  let cancelled = false;
  let channelKey = "";
  supabase.auth.getSession().then(async ({ data: { session } }) => {
    if (!session?.user || cancelled) return;
    const uid = session.user.id;
    const chatId = await ensureChatSession(uid, friendUid);
    if (cancelled) return;
    channelKey = `typing_receive_${chatId}`;
    const channel = supabase
      .channel(`typing_${chatId}`)
      .on("broadcast", { event: "typing" }, (event) => {
        if (event.payload?.senderId === friendUid) {
          callback(Boolean(event.payload?.typing));
        }
      })
      .subscribe();
    activeChatChannels.set(channelKey, channel);
  });

  return () => {
    cancelled = true;
    const channel = activeChatChannels.get(channelKey);
    if (channel) {
      supabase.removeChannel(channel);
      activeChatChannels.delete(channelKey);
    }
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

export const clearUnreadForFriend = (friendUid: string) => {
  let changed = false;
  for (let i = unreadMessages.length - 1; i >= 0; i -= 1) {
    if (unreadMessages[i].senderId === friendUid) {
      unreadMessages.splice(i, 1);
      changed = true;
    }
  }
  if (changed) emitUnread();
};
