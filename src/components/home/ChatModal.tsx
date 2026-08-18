import React, { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ImagePlus, MessageSquare, Phone, Send, Video, X } from "lucide-react";
import ModalShell from "../ui/ModalShell";
import { useNotification } from "../NotificationCenter";
import {
  cleanupExpiredChatMessages,
  compareChatMessages,
  markMessagesAsRead,
  sendChatImage,
  sendChatMessage,
  setChatTyping,
  subscribeToChatMessages,
  subscribeToFriendTyping,
  validateChatImage,
} from "../../services/chat";
import type { ChatMessage, SocialFriend } from "../../types/domain";
import type { SoundEffectType } from "../../hooks/useSoundEffects";
import { CONTROLLER_KEYBOARD_VISIBILITY_EVENT } from "../../utils/controllerTextInput";

const LINK_PATTERN = /(https?:\/\/[^\s]+)|(www\.[^\s]+)/gi;
const IMAGE_LINK_PATTERN = /^https?:\/\/[^\s]+\.(png|jpe?g|gif|webp|bmp|svg)(\?[^\s]*)?$/i;

export interface ChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  friend: SocialFriend | null;
  playSound: (type: SoundEffectType) => void;
  onStartVoiceCall?: (friend: SocialFriend, withVideo?: boolean) => void;
}

export const ChatModal: React.FC<ChatModalProps> = React.memo(
  ({ isOpen, onClose, friend, playSound, onStartVoiceCall }) => {
    const { notify } = useNotification();
    const [displayMessages, setDisplayMessages] = useState<ChatMessage[]>([]);
    const optimisticRef = useRef<Map<string, ChatMessage>>(new Map());
    const [inputText, setInputText] = useState("");
    const [pendingImage, setPendingImage] = useState<{
      file: File;
      previewUrl: string;
    } | null>(null);
    const [viewingImage, setViewingImage] = useState<{
      url: string;
      text: string;
      createdAt: string;
    } | null>(null);
    const [friendTyping, setFriendTyping] = useState(false);
    const [isSendingImage, setIsSendingImage] = useState(false);
    const [spamLockedUntil, setSpamLockedUntil] = useState<number | null>(null);
    const [controllerKeyboardOpen, setControllerKeyboardOpen] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement | null>(null);
    const imageInputRef = useRef<HTMLInputElement | null>(null);
    const pendingImageRef = useRef<{
      file: File;
      previewUrl: string;
    } | null>(null);
    const recentSendTimestampsRef = useRef<number[]>([]);
    const lastTypingSentRef = useRef(false);
    const lastTypingRefreshRef = useRef(0);
    const friendUidRef = useRef<string | null>(null);

    const friendUid = friend?.id.split(":")[1] ?? null;

    const detachPendingImage = React.useCallback(() => {
      const current = pendingImageRef.current;
      if (current) URL.revokeObjectURL(current.previewUrl);
      pendingImageRef.current = null;
      setPendingImage(null);
    }, []);

    const attachImageDraft = React.useCallback(
      (file: File) => {
        validateChatImage(file);
        detachPendingImage();
        const imageDraft = {
          file,
          previewUrl: URL.createObjectURL(file),
        };
        pendingImageRef.current = imageDraft;
        setPendingImage(imageDraft);
      },
      [detachPendingImage],
    );

    useEffect(
      () => () => {
        const current = pendingImageRef.current;
        if (current) URL.revokeObjectURL(current.previewUrl);
      },
      [],
    );

    useEffect(() => {
      const handleKeyboardVisibility = (event: Event) => {
        setControllerKeyboardOpen(
          Boolean((event as CustomEvent<{ isOpen?: boolean }>).detail?.isOpen),
        );
      };
      window.addEventListener(CONTROLLER_KEYBOARD_VISIBILITY_EVENT, handleKeyboardVisibility);
      return () =>
        window.removeEventListener(CONTROLLER_KEYBOARD_VISIBILITY_EVENT, handleKeyboardVisibility);
    }, []);

    // ── Subscrições Firebase ──────────────────────────────────────────────────
    useEffect(() => {
      if (!isOpen || !friendUid) {
        setDisplayMessages([]);
        optimisticRef.current.clear();
        setInputText("");
        detachPendingImage();
        setViewingImage(null);
        setFriendTyping(false);
        setIsSendingImage(false);
        setSpamLockedUntil(null);
        recentSendTimestampsRef.current = [];
        lastTypingSentRef.current = false;
        friendUidRef.current = null;
        return;
      }

      if (friendUidRef.current === friendUid) return;
      friendUidRef.current = friendUid;

      void cleanupExpiredChatMessages(friendUid).catch(() => undefined);
      void markMessagesAsRead(friendUid);

      let messagesInitialized = false;
      let knownServerMessageIds = new Set<string>();

      const unsubscribeMessages = subscribeToChatMessages(friendUid, (serverMsgs) => {
        const serverIds = new Set(serverMsgs.map((m) => m.id));
        optimisticRef.current.forEach((_, key) => {
          if (serverIds.has(key)) optimisticRef.current.delete(key);
        });

        const pending = Array.from(optimisticRef.current.values());
        const merged = [...serverMsgs, ...pending].sort(compareChatMessages);

        const nextServerMessageIds = new Set(
          serverMsgs.flatMap((message) => (message.id ? [message.id] : [])),
        );
        if (
          messagesInitialized &&
          serverMsgs.some(
            (message) =>
              message.senderId === friendUid &&
              Boolean(message.id) &&
              !knownServerMessageIds.has(message.id!),
          )
        ) {
          playSound("chatReceived");
        }
        knownServerMessageIds = nextServerMessageIds;
        messagesInitialized = true;
        setDisplayMessages(merged);
      });

      const unsubscribeTyping = subscribeToFriendTyping(friendUid, (typing) => {
        setFriendTyping(typing);
      });

      return () => {
        void setChatTyping(friendUid, false);
        unsubscribeMessages();
        unsubscribeTyping();
        friendUidRef.current = null;
      };
    }, [detachPendingImage, isOpen, friendUid, playSound]);

    // ── Scroll automático ────────────────────────────────────────────────────
    useEffect(() => {
      const el = messagesEndRef.current;
      if (!el) return;
      const timer = setTimeout(() => el.scrollIntoView({ behavior: "smooth" }), 60);
      return () => clearTimeout(timer);
    }, [displayMessages, friendTyping]);

    // ── Anti-spam cooldown ───────────────────────────────────────────────────
    useEffect(() => {
      if (!spamLockedUntil) return;
      const remaining = spamLockedUntil - Date.now();
      if (remaining <= 0) {
        setSpamLockedUntil(null);
        return;
      }
      const timer = window.setTimeout(() => setSpamLockedUntil(null), remaining);
      return () => window.clearTimeout(timer);
    }, [spamLockedUntil]);

    // ── Indicador de "está digitando" ────────────────────────────────────────
    useEffect(() => {
      if (!isOpen || !friendUid) return;
      const shouldSendTyping = inputText.trim().length > 0;
      if (!shouldSendTyping) {
        lastTypingSentRef.current = false;
        lastTypingRefreshRef.current = 0;
        void setChatTyping(friendUid, false);
        return;
      }

      const now = Date.now();
      if (!lastTypingSentRef.current || now - lastTypingRefreshRef.current >= 1_500) {
        lastTypingSentRef.current = true;
        lastTypingRefreshRef.current = now;
        void setChatTyping(friendUid, true);
      }
      const idleTimer = window.setTimeout(() => {
        lastTypingSentRef.current = false;
        lastTypingRefreshRef.current = 0;
        void setChatTyping(friendUid, false);
      }, 2_500);
      return () => window.clearTimeout(idleTimer);
    }, [friendUid, inputText, isOpen]);

    if (!isOpen || !friend) return null;

    const renderMessageText = (text: string) => {
      if (!text) return null;

      return text
        .split(LINK_PATTERN)
        .filter(Boolean)
        .map((part, index) => {
          const isLink = /^(https?:\/\/|www\.)/i.test(part);
          if (!isLink) {
            return <React.Fragment key={`${part}-${index}`}>{part}</React.Fragment>;
          }

          const href = part.startsWith("http") ? part : `https://${part}`;
          return (
            <a
              key={`${href}-${index}`}
              href={href}
              target="_blank"
              rel="noreferrer"
              className="break-all text-sky-300 underline underline-offset-2 transition-colors hover:text-sky-200"
            >
              {part}
            </a>
          );
        });
    };

    const extractImageLinks = (text: string) =>
      Array.from(
        new Set(
          (text.match(LINK_PATTERN) ?? [])
            .map((part) => (part.startsWith("http") ? part : `https://${part}`))
            .filter((part) => IMAGE_LINK_PATTERN.test(part)),
        ),
      );

    const handleSendMessageSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      const text = inputText.trim();
      const imageDraft = pendingImageRef.current;
      if (!text && !imageDraft) return;
      if (!friendUid) return;

      const now = Date.now();
      const optimisticId = `local-${crypto.randomUUID()}`;
      const recentWindow = now - 8000;
      const freshTimestamps = recentSendTimestampsRef.current.filter(
        (timestamp) => timestamp > recentWindow,
      );

      if (spamLockedUntil && spamLockedUntil > now) {
        notify("DEVAGAR PAE: Você está enviando mensagens rápido demais!", "error");
        return;
      }

      if (freshTimestamps.length >= 4) {
        const cooldownEnd = now + 6000;
        recentSendTimestampsRef.current = freshTimestamps;
        setSpamLockedUntil(cooldownEnd);
        notify("DEVAGAR PAE: Você está enviando mensagens rápido demais!", "error");
        return;
      }

      try {
        playSound("chatSent");
        const optimisticMessage: ChatMessage = {
          id: optimisticId,
          chatId: friendUid,
          senderId: "me",
          receiverId: friendUid,
          text,
          createdAt: new Date(now).toISOString(),
          read: true,
          attachmentName: imageDraft?.file.name,
          attachmentUrl: imageDraft?.previewUrl,
          attachmentType: imageDraft?.file.type,
          attachmentSize: imageDraft?.file.size,
        };

        recentSendTimestampsRef.current = [...freshTimestamps, now];
        optimisticRef.current.set(optimisticId, optimisticMessage);
        setDisplayMessages((current) => [...current, optimisticMessage].sort(compareChatMessages));
        setInputText("");
        if (imageDraft) {
          pendingImageRef.current = null;
          setPendingImage(null);
          setIsSendingImage(true);
        }
        lastTypingSentRef.current = false;
        void setChatTyping(friendUid, false);
        const confirmedMessage = imageDraft
          ? await sendChatImage(friendUid, imageDraft.file, text)
          : await sendChatMessage(friendUid, text);
        optimisticRef.current.delete(optimisticId);
        setDisplayMessages((current) =>
          [
            ...current.filter(
              (message) => message.id !== optimisticId && message.id !== confirmedMessage.id,
            ),
            confirmedMessage,
          ].sort(compareChatMessages),
        );
        if (imageDraft) {
          setViewingImage((current) =>
            current?.url === imageDraft.previewUrl
              ? {
                  ...current,
                  url: confirmedMessage.attachmentUrl || current.url,
                  createdAt: confirmedMessage.createdAt,
                }
              : current,
          );
          URL.revokeObjectURL(imageDraft.previewUrl);
        }
      } catch (error) {
        console.error("Erro ao enviar mensagem:", error);
        optimisticRef.current.delete(optimisticId);
        setDisplayMessages((current) => current.filter((message) => message.id !== optimisticId));
        setInputText((current) => current || text);
        if (imageDraft) {
          pendingImageRef.current = imageDraft;
          setPendingImage(imageDraft);
        }
        notify("Nao foi possivel enviar a mensagem.", "error");
      } finally {
        if (imageDraft) setIsSendingImage(false);
      }
    };

    const handleImageSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file || !friendUid || isSendingImage) return;
      try {
        playSound("select");
        attachImageDraft(file);
      } catch (error) {
        notify(
          error instanceof Error ? error.message : "Nao foi possivel anexar a imagem.",
          "error",
        );
      }
    };

    const handleImagePaste = (event: React.ClipboardEvent<HTMLInputElement>) => {
      if (!friendUid || isSendingImage) return;
      const clipboardImage = Array.from(event.clipboardData.items)
        .find((item) => item.kind === "file" && item.type.startsWith("image/"))
        ?.getAsFile();
      if (!clipboardImage) return;

      event.preventDefault();
      try {
        const extension = clipboardImage.type.split("/")[1]?.replace("jpeg", "jpg") || "png";
        const file = clipboardImage.name
          ? clipboardImage
          : new File([clipboardImage], `imagem-colada-${Date.now()}.${extension}`, {
              type: clipboardImage.type,
            });
        playSound("select");
        attachImageDraft(file);
      } catch (error) {
        notify(
          error instanceof Error ? error.message : "Nao foi possivel colar a imagem.",
          "error",
        );
      }
    };

    return (
      <ModalShell
        isOpen={isOpen}
        onClose={() => {
          if (viewingImage) {
            setViewingImage(null);
            playSound("modalClose");
            return;
          }
          playSound("back");
          onClose();
        }}
        maxWidthClassName={controllerKeyboardOpen ? "max-w-[min(880px,68vw)]" : "max-w-4xl"}
        zIndexClassName="z-[180]"
        containerClassName={
          controllerKeyboardOpen
            ? "items-start justify-center p-2 md:items-center md:justify-start md:p-3"
            : undefined
        }
        className="overflow-hidden rounded-[24px] border-0 p-0"
        ariaLabel={`Conversa com ${friend.name}`}
      >
        <div className="flex h-[calc(100dvh-2rem)] max-h-[760px] min-h-[560px] w-full flex-col bg-[#050507] md:h-[calc(100dvh-4rem)]">
          {/* Header */}
          <div className="flex shrink-0 items-center justify-between border-b border-white/5 bg-white/[0.02] px-7 py-4">
            <div className="flex items-center gap-3">
              <div className="relative">
                <img
                  src={
                    friend.avatar ||
                    "https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=256"
                  }
                  alt={friend.name}
                  className="h-10 w-10 rounded-full object-cover ring-2 ring-white/10"
                />
                <span
                  className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-[#050507] ${
                    friend.status === "playing"
                      ? "animate-pulse bg-green-500"
                      : friend.status === "online"
                        ? "bg-green-400"
                        : "bg-white/20"
                  }`}
                />
              </div>
              <div>
                <h4 className="text-sm font-bold leading-none text-white">{friend.name}</h4>
                <span className="mt-1 block text-[10px] uppercase tracking-wider text-white/40">
                  {friend.status === "playing" ? `Jogando ${friend.playing}` : friend.status}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {onStartVoiceCall && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      playSound("select");
                      onStartVoiceCall(friend, false);
                    }}
                    aria-label="Iniciar chamada de voz"
                    title="Iniciar chamada de voz"
                    className="flex h-8 w-8 items-center justify-center rounded-full border border-white/5 bg-white/[0.02] text-white/60 hover:bg-white/10 hover:text-white transition"
                  >
                    <Phone className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      playSound("select");
                      onStartVoiceCall(friend, true);
                    }}
                    aria-label="Compartilhar tela / Vídeo"
                    title="Compartilhar tela / Vídeo"
                    className="flex h-8 w-8 items-center justify-center rounded-full border border-white/5 bg-white/[0.02] text-white/60 hover:bg-white/10 hover:text-white transition"
                  >
                    <Video className="h-3.5 w-3.5" />
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={() => {
                  playSound("back");
                  onClose();
                }}
                aria-label="Fechar conversa"
                className="flex h-8 w-8 items-center justify-center rounded-full border border-white/5 bg-white/[0.02] text-white/60 hover:bg-white/10 hover:text-white transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="chat-scrollbar flex-1 space-y-3 overflow-y-auto px-8 py-6 pr-5">
            <section className="flex flex-col items-center pb-8 pt-2 text-center" aria-label="Identidade da amizade">
              <div className="relative">
                <div className="h-24 w-24 overflow-hidden rounded-full border border-white/15 bg-white/[0.06] p-1 shadow-[0_18px_48px_rgba(0,0,0,.55)]">
                  <img
                    src={friend.avatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=256"}
                    alt=""
                    className="h-full w-full rounded-full object-cover"
                  />
                </div>
                <span className={`absolute bottom-1 right-1 h-4 w-4 rounded-full border-[3px] border-[#050507] ${friend.status === "offline" ? "bg-white/25" : "bg-emerald-400"}`} />
              </div>
              <h2 className="mt-4 text-xl font-black tracking-tight text-white">{friend.name}</h2>
              <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.22em] text-white/35">
                {friend.status === "playing" ? `Jogando ${friend.playing}` : friend.status === "online" ? "Online agora" : "Offline"}
              </p>
              <div className="mt-5 flex items-center -space-x-2" aria-hidden="true">
                <img src={friend.avatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=128"} alt="" className="h-9 w-9 rounded-full border-2 border-[#050507] object-cover" />
                <span className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-[#050507] bg-white/[0.08] text-[10px] font-black text-white/60">CP</span>
              </div>
              <p className="mt-4 text-xs font-semibold text-white/45">Vocês já são amigos</p>
              <p className="mt-1 text-[10px] text-white/25">Comece a conversar agora</p>
            </section>
            {displayMessages.length === 0 ? (
              <div className="flex flex-col items-center justify-center space-y-2 pb-8 text-center text-white/20">
                <MessageSquare className="h-6 w-6" />
                <p className="text-xs uppercase tracking-wider">Nenhuma mensagem ainda</p>
              </div>
            ) : (
              displayMessages.map((msg, index) => {
                const isMe = msg.senderId !== friendUid;
                const messageDate = new Date(msg.createdAt);
                const previousDate =
                  index > 0 ? new Date(displayMessages[index - 1].createdAt) : null;
                const dayKey = Number.isFinite(messageDate.getTime())
                  ? `${messageDate.getFullYear()}-${messageDate.getMonth()}-${messageDate.getDate()}`
                  : "";
                const previousDayKey =
                  previousDate && Number.isFinite(previousDate.getTime())
                    ? `${previousDate.getFullYear()}-${previousDate.getMonth()}-${previousDate.getDate()}`
                    : "";
                const showDaySeparator = index === 0 || dayKey !== previousDayKey;
                const today = new Date();
                const yesterday = new Date(today);
                yesterday.setDate(today.getDate() - 1);
                const todayKey = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`;
                const yesterdayKey = `${yesterday.getFullYear()}-${yesterday.getMonth()}-${yesterday.getDate()}`;
                const dayLabel =
                  dayKey === todayKey
                    ? "Hoje"
                    : dayKey === yesterdayKey
                      ? "Ontem"
                      : messageDate.toLocaleDateString("pt-BR", {
                          day: "2-digit",
                          month: "long",
                          year: "numeric",
                        });
                const inlineImageLinks = extractImageLinks(msg.text);
                const visibleImages = Array.from(
                  new Set([
                    ...(msg.attachmentUrl ? [msg.attachmentUrl] : []),
                    ...inlineImageLinks,
                  ]),
                );
                return (
                  <React.Fragment key={msg.id || index}>
                    {showDaySeparator ? (
                      <div
                        className="flex items-center gap-3 py-2"
                        role="separator"
                        aria-label={dayLabel}
                      >
                        <span className="h-px flex-1 bg-white/[0.06]" />
                        <span className="text-[9px] font-semibold uppercase tracking-[0.24em] text-white/30">
                          {dayLabel}
                        </span>
                        <span className="h-px flex-1 bg-white/[0.06]" />
                      </div>
                    ) : null}
                    <div className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                      <div
                        className={`max-w-[58%] rounded-[16px] px-4 py-2.5 text-sm shadow-[0_8px_24px_rgba(0,0,0,.2)] ${
                          isMe
                            ? "rounded-br-[5px] bg-white text-black"
                            : "rounded-tl-none border border-white/5 bg-white/5 text-white/80"
                        }`}
                      >
                        {visibleImages.length > 0 ? (
                          <div className="mb-2 space-y-2">
                            {visibleImages.map((imageUrl) => (
                              <button
                                type="button"
                                key={imageUrl}
                                onClick={() => {
                                  playSound("select");
                                  setViewingImage({
                                    url: imageUrl,
                                    text:
                                      imageUrl === msg.attachmentUrl
                                        ? msg.text
                                        : msg.text.replace(imageUrl, "").trim(),
                                    createdAt: msg.createdAt,
                                  });
                                }}
                                aria-label="Visualizar imagem compartilhada"
                                className={`block w-full rounded-2xl border px-3 py-3 text-left transition-all ${
                                  isMe
                                    ? "border-white/10 bg-black/25 hover:bg-black/35"
                                    : "border-white/8 bg-white/[0.03] hover:bg-white/[0.06]"
                                }`}
                              >
                                <img
                                  src={imageUrl}
                                  alt="Imagem compartilhada"
                                  className="max-h-48 w-full rounded-xl object-cover"
                                />
                              </button>
                            ))}
                          </div>
                        ) : null}
                        {msg.text ? (
                          <p className="break-words leading-relaxed">{renderMessageText(msg.text)}</p>
                        ) : null}
                        <span className={`mt-1 block text-right text-[8px] uppercase tracking-wider ${isMe ? "text-black/45" : "text-white/30"}`}>
                          {new Date(msg.createdAt).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                    </div>
                  </React.Fragment>
                );
              })
            )}
            {friendTyping && (
              <div className="flex justify-start">
                <div className="rounded-[18px] rounded-tl-none border border-white/5 bg-white/[0.04] px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] uppercase tracking-[0.28em] text-white/30">
                      digitando
                    </span>
                    <div className="flex items-center gap-1">
                      {[0, 1, 2].map((dot) => (
                        <motion.span
                          key={dot}
                          animate={{ opacity: [0.25, 1, 0.25], y: [0, -2, 0] }}
                          transition={{
                            duration: 0.8,
                            repeat: Infinity,
                            delay: dot * 0.12,
                            ease: "easeInOut",
                          }}
                          className="h-1.5 w-1.5 rounded-full bg-emerald-400"
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Footer / Input */}
          <form
            onSubmit={handleSendMessageSubmit}
            className="shrink-0 border-t border-white/5 bg-[#0a0a0d] px-6 py-4"
          >
            <div className="mb-2 flex min-h-4 items-center justify-between px-1">
              <span className="text-[10px] uppercase tracking-[0.24em] text-white/25">
                {friendTyping ? `${friend.name} está digitando...` : "Chat em tempo real"}
              </span>
              {spamLockedUntil && spamLockedUntil > Date.now() ? (
                <span className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-300">
                  DEVAGAR PAE
                </span>
              ) : null}
            </div>
            {pendingImage ? (
              <div className="relative mb-3 w-fit max-w-full rounded-2xl border border-white/10 bg-white/4 p-2">
                <img
                  src={pendingImage.previewUrl}
                  alt="Prévia da imagem anexada"
                  className="max-h-32 max-w-full rounded-xl object-cover"
                />
                <button
                  type="button"
                  onClick={detachPendingImage}
                  aria-label="Remover imagem anexada"
                  title="Remover imagem"
                  className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full border border-white/15 bg-[#17171a] text-white shadow-lg transition-colors hover:bg-red-500"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
                <span className="mt-1.5 block max-w-56 truncate px-1 text-[9px] text-white/40">
                  {pendingImage.file.name}
                </span>
              </div>
            ) : null}
            <div className="flex items-center gap-2">
              <input
                ref={imageInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                onChange={handleImageSelected}
              />
              <button
                type="button"
                onClick={() => imageInputRef.current?.click()}
                disabled={isSendingImage}
                aria-label="Anexar imagem"
                title="Anexar imagem"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-white/60 transition-colors hover:bg-white/10 hover:text-white disabled:cursor-wait disabled:opacity-40"
              >
                <ImagePlus className="h-4 w-4" />
              </button>
              <input
                type="text"
                value={inputText}
                disabled={isSendingImage}
                onChange={(e) => setInputText(e.target.value)}
                onPaste={handleImagePaste}
                placeholder={
                  pendingImage ? "Adicionar uma legenda (opcional)..." : "Digite sua mensagem..."
                }
                className="h-11 flex-1 rounded-full border border-white/10 bg-white/[0.055] px-5 text-sm text-white placeholder-white/25 focus:border-white/20 focus:outline-none disabled:cursor-wait disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={
                  isSendingImage ||
                  (!inputText.trim() && !pendingImage) ||
                  Boolean(spamLockedUntil && spamLockedUntil > Date.now())
                }
                aria-label="Enviar mensagem"
                className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-black transition-transform hover:bg-white/90 active:scale-95 disabled:cursor-not-allowed disabled:bg-white/30 disabled:text-black/50"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </form>
        </div>

        <ModalShell
          isOpen={Boolean(viewingImage)}
          onClose={() => {
            setViewingImage(null);
            playSound("modalClose");
          }}
          maxWidthClassName="max-w-5xl"
          className="border-0 bg-transparent p-0 shadow-none"
          backdropClassName="bg-black/90"
          zIndexClassName="z-[220]"
          reducedEffects
          ariaLabel="Visualização da imagem do chat"
          gamepadPriority={220}
        >
          {viewingImage ? (
            <div className="relative overflow-hidden rounded-[28px] border border-white/10 bg-[#08080a]/95 shadow-[0_32px_128px_rgba(0,0,0,0.9)]">
              <div className="flex items-center justify-between border-b border-white/5 px-6 py-4">
                <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/50">
                  Imagem do chat
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setViewingImage(null);
                    playSound("modalClose");
                  }}
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-white/60 transition-colors hover:bg-white/10 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="flex max-h-[75dvh] items-center justify-center p-6">
                <img
                  src={viewingImage.url}
                  alt="Imagem expandida"
                  className="max-h-[68dvh] max-w-full rounded-2xl object-contain shadow-2xl"
                />
              </div>
              {viewingImage.text ? (
                <div className="border-t border-white/5 bg-white/[0.02] px-6 py-4 text-xs text-white/80">
                  {viewingImage.text}
                </div>
              ) : null}
            </div>
          ) : null}
        </ModalShell>
      </ModalShell>
    );
  },
);

ChatModal.displayName = "ChatModal";
