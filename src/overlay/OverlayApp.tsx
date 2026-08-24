import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Trophy,
  Users,
  MessageSquare,
  Gamepad2,
  Camera,
  Settings,
  X,
  Sparkles,
  Send,
  Image as ImageIcon,
  ChevronLeft,
  Loader2,
  ExternalLink,
  ZoomIn,
  Maximize2,
  Phone,
  PhoneCall,
  PhoneOff,
  PhoneIncoming,
  CheckCircle2,
  AlertCircle,
  Info,
  Bell,
  UserPlus,
  UserCheck,
} from "lucide-react";
import { Button } from "@/components/ui/Shandc/button";

interface AchievementToast {
  id: string;
  title: string;
  description: string;
  icon?: string;
  gameTitle?: string;
  percent?: number;
  unlockedAt?: string;
}

interface SocialToast {
  id: string;
  kind: "friend-playing" | "friend-request" | "friend-accepted" | "message" | "capture" | "hint" | "incoming-call" | "success" | "error" | "info" | "achievement" | string;
  title: string;
  subtitle?: string;
  description?: string;
  avatar?: string;
  message?: string;
  gameTitle?: string;
  screenshotUrl?: string;
  callerUid?: string;
}

interface OverlayChatMessage {
  id: string;
  text: string;
  attachmentUrl?: string;
  attachmentName?: string;
  createdAt: string;
  mine: boolean;
  pending?: boolean;
}

interface OverlayChatSession {
  friendId: string;
  friendName: string;
  friendAvatar?: string;
  typing?: boolean;
  sending?: boolean;
  error?: string;
  messages: OverlayChatMessage[];
}

interface CommandPanelState {
  gameTitle?: string;
  userDisplay?: string;
  userAvatar?: string;
  playingGame?: any;
  achievements?: any[];
  friends?: any[];
  chat?: OverlayChatSession | null;
  screenshots?: string[];
  settings?: {
    achievementVolume?: number;
    achievementSoundTheme?: string;
  };
}

const playOverlaySound = (type: "unlock" | "welcome" | "toast" | "toggle") => {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    const now = ctx.currentTime;
    if (type === "unlock") {
      osc.type = "sine";
      osc.frequency.setValueAtTime(523.25, now);
      osc.frequency.exponentialRampToValueAtTime(783.99, now + 0.18);
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
      osc.start(now);
      osc.stop(now + 0.5);
    } else if (type === "welcome" || type === "toast") {
      osc.type = "sine";
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.12);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc.start(now);
      osc.stop(now + 0.35);
    } else if (type === "toggle") {
      osc.type = "triangle";
      osc.frequency.setValueAtTime(360, now);
      osc.frequency.exponentialRampToValueAtTime(620, now + 0.08);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
      osc.start(now);
      osc.stop(now + 0.1);
    }
  } catch {
    // AudioContext fallback
  }
};

const OverlayApp: React.FC = () => {
  const [achievementToasts, setAchievementToasts] = useState<AchievementToast[]>([]);
  const [socialToasts, setSocialToasts] = useState<SocialToast[]>([]);
  const [isPanelVisible, setIsPanelVisible] = useState(false);
  const [activeView, setActiveView] = useState<"friends" | "chats" | "game" | "achievements" | "media" | "settings">("game");
  const [panelData, setPanelData] = useState<CommandPanelState>({});
  const [inputText, setInputText] = useState("");
  const [viewingImage, setViewingImage] = useState<string | null>(null);
  const chatMessagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const api = (window as any).achievementOverlay;
    if (!api) return;

    const unbindUnlock = api.onUnlock?.((payload: any) => {
      const toast: AchievementToast = {
        id: String(Date.now() + Math.random()),
        title: payload.title || "Conquista Desbloqueada",
        description: payload.description || "",
        icon: payload.icon,
        gameTitle: payload.gameTitle,
        percent: payload.percent,
        unlockedAt: payload.unlockedAt,
      };
      playOverlaySound("unlock");
      setAchievementToasts((prev) => [...prev, toast]);
      setTimeout(() => {
        setAchievementToasts((prev) => prev.filter((t) => t.id !== toast.id));
      }, 5000);
    });

    const unbindWelcome = api.onWelcome?.((payload: any) => {
      const toast: SocialToast = {
        id: String(Date.now() + Math.random()),
        kind: "hint",
        title: `Bem-vindo a ${payload.gameTitle || "Phelierium"}`,
        subtitle: payload.userDisplay ? `Jogando como ${payload.userDisplay}` : "Overlay ativo",
        avatar: payload.userAvatar,
      };
      playOverlaySound("welcome");
      setSocialToasts((prev) => [...prev, toast]);
      setTimeout(() => {
        setSocialToasts((prev) => prev.filter((t) => t.id !== toast.id));
      }, 4500);
    });

    const unbindSocial = api.onSocial?.((payload: any) => {
      const toast: SocialToast = {
        id: String(Date.now() + Math.random()),
        kind: payload.kind || "message",
        title: payload.title || "Notificação",
        subtitle: payload.subtitle,
        avatar: payload.avatar,
        message: payload.message || payload.description,
        gameTitle: payload.gameTitle,
        screenshotUrl: payload.screenshotUrl,
      };
      playOverlaySound("toast");
      setSocialToasts((prev) => [...prev, toast]);
      setTimeout(() => {
        setSocialToasts((prev) => prev.filter((t) => t.id !== toast.id));
      }, 5000);
    });

    const unbindVisibility = api.onPanelVisibility?.((payload: any) => {
      setIsPanelVisible(Boolean(payload.open || payload.visible));
      if (payload.state) {
        setPanelData((prev) => ({ ...prev, ...payload.state }));
      }
    });

    const unbindState = api.onPanelState?.((payload: any) => {
      setPanelData((prev) => ({ ...prev, ...payload }));
    });

    const unbindCommand = api.onPanelCommand?.((payload: any) => {
      playOverlaySound("toggle");
      if (payload.kind === "open-chat") {
        setIsPanelVisible(true);
        setActiveView("chats");
      } else if (payload.kind === "toggle") {
        setIsPanelVisible((prev) => !prev);
      }
    });

    return () => {
      unbindUnlock?.();
      unbindWelcome?.();
      unbindSocial?.();
      unbindVisibility?.();
      unbindState?.();
      unbindCommand?.();
    };
  }, []);

  useEffect(() => {
    if (activeView === "chats" && panelData.chat?.messages?.length) {
      chatMessagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [activeView, panelData.chat?.messages]);

  const closePanel = () => {
    setIsPanelVisible(false);
    (window as any).achievementOverlay?.panelAction?.({ kind: "close" });
  };

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (viewingImage) {
          setViewingImage(null);
        } else if (isPanelVisible) {
          closePanel();
        }
      } else if (e.key === "Enter" && !e.shiftKey) {
        if (
          document.activeElement &&
          document.activeElement !== document.body &&
          (document.activeElement as HTMLElement).tagName !== "INPUT" &&
          (document.activeElement as HTMLElement).tagName !== "TEXTAREA"
        ) {
          (document.activeElement as HTMLElement).click?.();
        }
      }
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isPanelVisible, viewingImage]);

  useEffect(() => {
    if (!isPanelVisible) return;
    let raf = 0;
    const prevButtons = new Map<number, boolean>();

    function poll() {
      const gps = navigator.getGamepads?.() ?? [];
      for (const g of gps) {
        if (!g) continue;
        g.buttons.forEach((b, i) => {
          const pressed = b.pressed;
          const prev = prevButtons.get(i) || false;
          if (pressed && !prev) {
            if (i === 0) {
              const active = document.activeElement as HTMLElement | null;
              active?.click?.();
            } else if (i === 1) {
              closePanel();
            }
          }
          prevButtons.set(i, pressed);
        });
      }
      raf = requestAnimationFrame(poll);
    }
    raf = requestAnimationFrame(poll);
    return () => cancelAnimationFrame(raf);
  }, [isPanelVisible]);

  const handleSelectChat = (friendId: string) => {
    setActiveView("chats");
    (window as any).achievementOverlay?.panelAction?.({
      kind: "select-chat",
      friendId,
    });
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    const text = inputText.trim();
    if (!text || panelData.chat?.sending) return;

    (window as any).achievementOverlay?.panelAction?.({
      kind: "send-message",
      text,
    });
    setInputText("");
  };

  const handleCloseChat = () => {
    (window as any).achievementOverlay?.panelAction?.({
      kind: "close-chat",
    });
  };

  return (
    <div className="fixed inset-0 pointer-events-none z-9999 font-sans select-none overflow-hidden">
      {/* Top Right Achievement Toasts */}
      <div className="fixed top-6 right-6 flex flex-col gap-3 z-10000 max-w-sm w-full pointer-events-auto">
        <AnimatePresence>
          {achievementToasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className="flex items-center gap-3.5 rounded-[22px] border border-emerald-500/25 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#13241b]/98 via-[#0e1612]/99 to-[#080c09] p-4 shadow-[0_25px_60px_rgba(0,0,0,0.85)] backdrop-blur-2xl"
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-emerald-400/30 bg-emerald-500/10 shadow-[0_0_15px_rgba(16,185,129,0.25)]">
                {toast.icon ? (
                  <img src={toast.icon} alt="" className="h-full w-full object-cover" />
                ) : (
                  <Trophy className="h-5 w-5 text-emerald-300" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-[9px] font-bold uppercase tracking-widest text-emerald-400">
                    Conquista Desbloqueada
                  </span>
                  {toast.gameTitle && (
                    <>
                      <span className="h-1 w-1 rounded-full bg-white/20" />
                      <span className="text-[9px] font-bold uppercase tracking-wider text-white/40 truncate">
                        {toast.gameTitle}
                      </span>
                    </>
                  )}
                </div>
                <h4 className="truncate text-xs font-bold text-white mt-0.5">{toast.title}</h4>
                <p className="line-clamp-1 text-[10px] font-medium text-white/50">{toast.description}</p>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Bottom Left Social & System Toasts */}
      <div className="fixed bottom-6 left-6 flex flex-col-reverse gap-3 z-[10000] max-w-sm w-full pointer-events-auto">
        <AnimatePresence>
          {socialToasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, x: -30, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: -30, scale: 0.95 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className="flex flex-col gap-3 rounded-[22px] border border-white/[0.12] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#1c1d28]/98 via-[#111218]/99 to-[#08090c] p-4 shadow-[0_25px_60px_rgba(0,0,0,0.85)] backdrop-blur-2xl"
            >
              <div className="flex items-center gap-3.5">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white/10">
                  {toast.avatar && !toast.avatar.includes("icon.ico") ? (
                    <img src={toast.avatar} alt="" className="h-full w-full object-cover" />
                  ) : toast.kind === "incoming-call" ? (
                    <PhoneIncoming className="h-5 w-5 text-emerald-400 animate-bounce" />
                  ) : toast.kind === "success" || toast.kind === "friend-accepted" ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                  ) : toast.kind === "error" ? (
                    <AlertCircle className="h-5 w-5 text-rose-400" />
                  ) : toast.kind === "info" ? (
                    <Info className="h-5 w-5 text-blue-400" />
                  ) : toast.kind === "friend-request" ? (
                    <UserPlus className="h-5 w-5 text-blue-400" />
                  ) : toast.kind === "achievement" ? (
                    <Trophy className="h-5 w-5 text-yellow-400" />
                  ) : toast.kind === "hint" ? (
                    <div className="h-full w-full p-1 bg-black/60 flex items-center justify-center">
                      <img src="./assets/icon.png" alt="Phelierium" className="h-6 w-6 object-contain" />
                    </div>
                  ) : toast.screenshotUrl ? (
                    <Camera className="h-4.5 w-4.5 text-cyan-300" />
                  ) : (
                    <Sparkles className="h-4.5 w-4.5 text-white/70" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  {(toast.kind === "message" || toast.kind === "friend-message") && (
                    <span className="text-[9px] font-bold uppercase tracking-widest text-emerald-400 block mb-0.5">
                      Nova Mensagem
                    </span>
                  )}
                  <h4 className="truncate text-xs font-bold text-white">{toast.title}</h4>
                  {toast.subtitle && (
                    <p className="truncate text-[10px] font-medium text-white/50 mt-0.5">{toast.subtitle}</p>
                  )}
                  {toast.message && (
                    <p className="line-clamp-1 text-[10px] font-medium text-white/70 mt-0.5">{toast.message}</p>
                  )}
                  {!toast.subtitle && !toast.message && toast.description && (
                    <p className="line-clamp-1 text-[10px] font-medium text-white/70 mt-0.5">{toast.description}</p>
                  )}
                </div>
              </div>

              {toast.kind === "incoming-call" && (
                <div className="mt-2 grid grid-cols-2 gap-2 border-t border-white/[0.07] pt-3">
                  <Button
                    type="button"
                    onClick={() => {
                      (window as any).achievementOverlay?.panelAction?.({ kind: "voice-accept" });
                      setSocialToasts((prev) => prev.filter((t) => t.id !== toast.id));
                    }}
                    className="h-9 rounded-xl bg-white text-black text-[11px] font-black shadow-none hover:!bg-white/90 hover:!text-black"
                  >
                    <PhoneCall className="mr-1.5 h-3.5 w-3.5" />
                    Atender
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      (window as any).achievementOverlay?.panelAction?.({ kind: "voice-reject" });
                      setSocialToasts((prev) => prev.filter((t) => t.id !== toast.id));
                    }}
                    className="h-9 rounded-xl border-rose-500/20 bg-rose-500/[0.06] text-rose-300 text-[11px] font-black shadow-none hover:!bg-rose-500/15 hover:!text-rose-200"
                  >
                    <PhoneOff className="mr-1.5 h-3.5 w-3.5" />
                    Recusar
                  </Button>
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* In-Game Full Command Panel Overlay */}
      <AnimatePresence>
        {isPanelVisible && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[10050] flex items-center justify-center bg-black/75 backdrop-blur-3xl pointer-events-auto p-8"
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.96, opacity: 0, y: 15 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="relative flex h-[82vh] w-[90vw] max-w-6xl overflow-hidden rounded-[28px] border border-white/15 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#1c1d28] via-[#0d0e12] to-[#050507] shadow-[0_30px_100px_rgba(0,0,0,0.95)]"
            >
              {/* Sidebar Navigation */}
              <div className="flex w-64 flex-col border-r border-white/[0.08] bg-white/[0.02] p-5">
                <div className="flex items-center gap-3 pb-6 border-b border-white/[0.08]">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white/10 border border-white/10">
                    {panelData.userAvatar ? (
                      <img src={panelData.userAvatar} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <Gamepad2 className="h-5 w-5 text-white/70" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <h3 className="truncate text-xs font-bold text-white">
                      {panelData.userDisplay || "Jogador"}
                    </h3>
                    <p className="truncate text-[10px] font-medium text-emerald-400">Em Jogo</p>
                  </div>
                </div>

                <nav className="mt-6 flex flex-col gap-1.5 flex-1">
                  <button
                    type="button"
                    onClick={() => setActiveView("game")}
                    className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-xs font-bold transition-all ${activeView === "game"
                      ? "bg-white text-black shadow-md"
                      : "text-white/50 hover:bg-white/5 hover:text-white"
                      }`}
                  >
                    <Gamepad2 className="h-4 w-4" /> Visão Geral
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveView("achievements")}
                    className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-xs font-bold transition-all ${activeView === "achievements"
                      ? "bg-white text-black shadow-md"
                      : "text-white/50 hover:bg-white/5 hover:text-white"
                      }`}
                  >
                    <Trophy className="h-4 w-4" /> Conquistas
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveView("friends")}
                    className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-xs font-bold transition-all ${activeView === "friends"
                      ? "bg-white text-black shadow-md"
                      : "text-white/50 hover:bg-white/5 hover:text-white"
                      }`}
                  >
                    <Users className="h-4 w-4" /> Amigos
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveView("chats")}
                    className={`flex items-center justify-between rounded-xl px-3.5 py-2.5 text-xs font-bold transition-all ${activeView === "chats"
                      ? "bg-white text-black shadow-md"
                      : "text-white/50 hover:bg-white/5 hover:text-white"
                      }`}
                  >
                    <div className="flex items-center gap-3">
                      <MessageSquare className="h-4 w-4" /> Bate-papo
                    </div>
                    {panelData.friends?.some((f: any) => f.unread > 0) && (
                      <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveView("media")}
                    className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-xs font-bold transition-all ${activeView === "media"
                      ? "bg-white text-black shadow-md"
                      : "text-white/50 hover:bg-white/5 hover:text-white"
                      }`}
                  >
                    <Camera className="h-4 w-4" /> Capturas
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveView("settings")}
                    className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-xs font-bold transition-all ${activeView === "settings"
                      ? "bg-white text-black shadow-md"
                      : "text-white/50 hover:bg-white/5 hover:text-white"
                      }`}
                  >
                    <Settings className="h-4 w-4" /> Ajustes
                  </button>
                </nav>

                <div className="pt-4 border-t border-white/[0.08]">
                  <button
                    type="button"
                    onClick={closePanel}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-white/70 transition hover:bg-white/10 hover:text-white"
                  >
                    <X className="h-4 w-4" /> Fechar Overlay
                  </button>
                </div>
              </div>

              {/* Main Content Area */}
              <div className="flex flex-1 flex-col overflow-y-auto p-7 thin-scrollbar">
                {activeView === "game" && (
                  <div className="flex flex-col gap-6">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-white/40">
                        Jogo Ativo
                      </span>
                      <h2 className="text-3xl font-bold text-white mt-1">
                        {panelData.gameTitle || "Jogo Atual"}
                      </h2>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.035] p-4">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-white/40">
                          Sessão Atual
                        </span>
                        <p className="text-xl font-bold text-white mt-2">Em andamento</p>
                      </div>
                      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.035] p-4">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-white/40">
                          Conquistas
                        </span>
                        <p className="text-xl font-bold text-white mt-2">
                          {panelData.achievements?.filter((a: any) => a.achieved).length || 0} /{" "}
                          {panelData.achievements?.length || 0}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.035] p-4">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-white/40">
                          Amigos Online
                        </span>
                        <p className="text-xl font-bold text-white mt-2">
                          {panelData.friends?.filter((f: any) => f.status === "online" || f.status === "playing").length || 0}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {activeView === "achievements" && (
                  <div className="flex flex-col gap-4">
                    <h3 className="text-lg font-bold text-white">Conquistas do Jogo</h3>
                    <div className="grid gap-3">
                      {(panelData.achievements || []).map((ach: any, idx: number) => (
                        <div
                          key={idx}
                          className="flex items-center gap-3.5 rounded-2xl border border-white/[0.06] bg-white/[0.035] p-4"
                        >
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10">
                            <Trophy className="h-5 w-5 text-white/70" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <h4 className="text-xs font-bold text-white">{ach.name || "Conquista"}</h4>
                            <p className="text-[10px] text-white/40 mt-0.5">{ach.description}</p>
                          </div>
                          <span
                            className={`rounded-lg px-2.5 py-1 text-[9px] font-bold uppercase ${ach.achieved
                              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-400/30"
                              : "bg-white/5 text-white/40 border border-white/10"
                              }`}
                          >
                            {ach.achieved ? "Desbloqueada" : "Bloqueada"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {activeView === "friends" && (
                  <div className="flex flex-col gap-4">
                    <h3 className="text-lg font-bold text-white">Amigos</h3>
                    <div className="grid grid-cols-2 gap-3">
                      {(panelData.friends || []).map((friend: any, idx: number) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between rounded-2xl border border-white/[0.06] bg-white/[0.035] p-4"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="relative h-10 w-10 rounded-xl bg-white/10 shrink-0 overflow-hidden">
                              {friend.avatar ? (
                                <img src={friend.avatar} alt="" className="h-full w-full object-cover" />
                              ) : (
                                <div className="h-full w-full flex items-center justify-center text-white/70">
                                  <Users className="h-5 w-5" />
                                </div>
                              )}
                              <span
                                className={`absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-black ${friend.status === "playing"
                                  ? "bg-green-500 animate-pulse"
                                  : friend.status === "online"
                                    ? "bg-green-400"
                                    : "bg-white/20"
                                  }`}
                              />
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-white truncate">{friend.name || "Amigo"}</p>
                              <p className="text-[10px] text-white/40 truncate">
                                {friend.status === "playing"
                                  ? `Jogando ${friend.playing || ""}`
                                  : friend.status === "online"
                                    ? "Online"
                                    : "Offline"}
                              </p>
                            </div>
                          </div>
                          {friend.canChat && (
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  (window as any).achievementOverlay?.panelAction?.({
                                    kind: "voice-call",
                                    friendId: friend.id,
                                    friendName: friend.name,
                                    friendAvatar: friend.avatar,
                                  });
                                }}
                                className="flex items-center gap-1.5 rounded-xl border border-emerald-400/30 bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25 px-2.5 py-1.5 text-xs font-bold transition-all"
                                title="Ligar para amigo"
                              >
                                <Phone className="h-3.5 w-3.5" /> Ligar
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSelectChat(friend.id)}
                                className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs font-bold text-white hover:bg-white/15 transition-all"
                              >
                                <MessageSquare className="h-3.5 w-3.5" /> Chat
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {activeView === "chats" && (
                  <div className="flex flex-col h-full gap-4">
                    {panelData.chat ? (
                      <div className="flex flex-col h-full">
                        {/* Active Chat Header */}
                        <div className="flex items-center justify-between pb-4 border-b border-white/[0.08] mb-4">
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              onClick={handleCloseChat}
                              className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white"
                            >
                              <ChevronLeft className="h-4 w-4" />
                            </button>
                            <div className="h-9 w-9 rounded-xl bg-white/10 overflow-hidden shrink-0">
                              {panelData.chat.friendAvatar ? (
                                <img src={panelData.chat.friendAvatar} alt="" className="h-full w-full object-cover" />
                              ) : (
                                <div className="h-full w-full flex items-center justify-center text-white/60">
                                  <Users className="h-4 w-4" />
                                </div>
                              )}
                            </div>
                            <div>
                              <h4 className="text-xs font-bold text-white">{panelData.chat.friendName}</h4>
                              <p className="text-[9px] text-emerald-400 font-bold uppercase tracking-wider">
                                {panelData.chat.typing ? "Digitando..." : "Em conversa"}
                              </p>
                            </div>
                          </div>

                          {/* Call Button in Chat Header */}
                          <button
                            type="button"
                            onClick={() => {
                              (window as any).achievementOverlay?.panelAction?.({
                                kind: "voice-call",
                                friendId: panelData.chat?.friendId,
                                friendName: panelData.chat?.friendName,
                                friendAvatar: panelData.chat?.friendAvatar,
                              });
                            }}
                            className="flex items-center gap-1.5 rounded-xl border border-emerald-400/30 bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25 px-3 py-1.5 text-xs font-bold transition-all shadow-md shadow-emerald-500/10"
                          >
                            <Phone className="h-3.5 w-3.5" /> Ligar
                          </button>
                        </div>

                        {/* Messages Feed */}
                        <div className="flex-1 overflow-y-auto space-y-3 pr-2 thin-scrollbar">
                          {panelData.chat.messages.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-white/30 text-xs">
                              <MessageSquare className="h-8 w-8 mb-2 opacity-50" />
                              Nenhuma mensagem anterior.
                            </div>
                          ) : (
                            panelData.chat.messages.map((msg) => (
                              <div
                                key={msg.id}
                                className={`flex ${msg.mine ? "justify-end" : "justify-start"}`}
                              >
                                <div
                                  className={`max-w-[70%] rounded-2xl px-4 py-2.5 text-xs shadow-md ${msg.mine
                                    ? "bg-white text-black font-medium"
                                    : "bg-white/[0.07] border border-white/10 text-white"
                                    }`}
                                >
                                  {msg.attachmentUrl && (
                                    <div className="mb-2 overflow-hidden rounded-xl border border-black/10">
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          setViewingImage(msg.attachmentUrl!);
                                        }}
                                        className="relative group block w-full text-left cursor-pointer"
                                      >
                                        <img
                                          src={msg.attachmentUrl}
                                          alt="Anexo"
                                          className="max-h-48 w-full object-cover rounded-xl transition-transform group-hover:scale-[1.02]"
                                        />
                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity rounded-xl">
                                          <ZoomIn className="h-6 w-6 text-white drop-shadow-md" />
                                        </div>
                                      </button>
                                    </div>
                                  )}
                                  {msg.text && <p className="break-words leading-relaxed">{msg.text}</p>}
                                  <span
                                    className={`mt-1 block text-right text-[8px] font-bold ${msg.mine ? "text-black/50" : "text-white/40"
                                      }`}
                                  >
                                    {new Date(msg.createdAt).toLocaleTimeString([], {
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    })}
                                  </span>
                                </div>
                              </div>
                            ))
                          )}
                          <div ref={chatMessagesEndRef} />
                        </div>

                        {/* Message Input */}
                        <form onSubmit={handleSendMessage} className="mt-4 flex items-center gap-2">
                          <input
                            type="text"
                            value={inputText}
                            onChange={(e) => setInputText(e.target.value)}
                            placeholder={`Enviar mensagem para ${panelData.chat.friendName}...`}
                            className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-xs text-white placeholder-white/30 focus:border-white/30 focus:outline-none"
                          />
                          <button
                            type="submit"
                            disabled={!inputText.trim() || panelData.chat.sending}
                            className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-black hover:bg-white/90 disabled:opacity-40"
                          >
                            {panelData.chat.sending ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Send className="h-4 w-4" />
                            )}
                          </button>
                        </form>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-3">
                        <h3 className="text-lg font-bold text-white">Selecione um Amigo para Conversar</h3>
                        <div className="grid grid-cols-2 gap-3">
                          {(panelData.friends || [])
                            .filter((f: any) => f.canChat)
                            .map((friend: any, idx: number) => (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => handleSelectChat(friend.id)}
                                className="flex items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.035] p-4 text-left hover:bg-white/[0.07] transition-all"
                              >
                                <div className="h-9 w-9 rounded-xl bg-white/10 overflow-hidden shrink-0">
                                  {friend.avatar ? (
                                    <img src={friend.avatar} alt="" className="h-full w-full object-cover" />
                                  ) : (
                                    <div className="h-full w-full flex items-center justify-center text-white/60">
                                      <Users className="h-4 w-4" />
                                    </div>
                                  )}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="text-xs font-bold text-white truncate">{friend.name}</p>
                                  <p className="text-[10px] text-white/40 truncate">Clique para abrir chat</p>
                                </div>
                                {friend.unread > 0 && (
                                  <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-emerald-400 px-1.5 text-[10px] font-black text-black">
                                    {friend.unread}
                                  </span>
                                )}
                              </button>
                            ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {activeView === "media" && (
                  <div className="flex flex-col gap-4">
                    <h3 className="text-lg font-bold text-white">Capturas de Tela</h3>
                    <div className="grid grid-cols-3 gap-3">
                      {(panelData.screenshots || []).map((url: string, idx: number) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setViewingImage(url);
                          }}
                          className="h-32 rounded-xl overflow-hidden border border-white/10 relative group text-left cursor-pointer transition-transform hover:scale-[1.02]"
                        >
                          <img src={url} alt="Captura de tela" className="h-full w-full object-cover" />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                            <ZoomIn className="h-6 w-6 text-white drop-shadow-md" />
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {activeView === "settings" && (
                  <div className="flex flex-col gap-4 max-w-lg">
                    <h3 className="text-lg font-bold text-white">Ajustes do Overlay</h3>
                    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.035] p-4 space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-white">Notificações em Jogo</span>
                        <span className="text-[10px] text-emerald-400 font-bold">Ativadas</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Image Lightbox Viewer inside Overlay */}
      <AnimatePresence>
        {viewingImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[10100] flex items-center justify-center bg-black/90 backdrop-blur-2xl pointer-events-auto p-8"
            onClick={() => setViewingImage(null)}
          >
            <div className="relative max-w-5xl max-h-[85vh] overflow-hidden rounded-2xl border border-white/15 bg-black/80 shadow-2xl p-2" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                onClick={() => setViewingImage(null)}
                className="absolute top-4 right-4 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/70 text-white hover:bg-white/20 transition-all border border-white/10"
              >
                <X className="h-5 w-5" />
              </button>
              <img
                src={viewingImage}
                alt="Imagem expandida no overlay"
                className="max-h-[80vh] max-w-full rounded-xl object-contain"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default OverlayApp;
