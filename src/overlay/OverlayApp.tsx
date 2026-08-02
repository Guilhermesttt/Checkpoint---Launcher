import React, { useState, useEffect } from "react";
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
} from "lucide-react";

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
  kind: "friend-playing" | "friend-request" | "friend-accepted" | "message" | "capture" | "hint";
  title: string;
  subtitle?: string;
  avatar?: string;
  message?: string;
  gameTitle?: string;
  screenshotUrl?: string;
}

interface CommandPanelState {
  gameTitle?: string;
  userDisplay?: string;
  userAvatar?: string;
  playingGame?: any;
  achievements?: any[];
  friends?: any[];
  chatMessages?: any[];
  screenshots?: string[];
  settings?: {
    achievementVolume?: number;
    achievementSoundTheme?: string;
  };
}

const OverlayApp: React.FC = () => {
  const [achievementToasts, setAchievementToasts] = useState<AchievementToast[]>([]);
  const [socialToasts, setSocialToasts] = useState<SocialToast[]>([]);
  const [isPanelVisible, setIsPanelVisible] = useState(false);
  const [activeView, setActiveView] = useState<"friends" | "chats" | "game" | "achievements" | "media" | "settings">("game");
  const [panelData, setPanelData] = useState<CommandPanelState>({});

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
      setAchievementToasts((prev) => [...prev, toast]);
      setTimeout(() => {
        setAchievementToasts((prev) => prev.filter((t) => t.id !== toast.id));
      }, 5000);
    });

    const unbindWelcome = api.onWelcome?.((payload: any) => {
      const toast: SocialToast = {
        id: String(Date.now() + Math.random()),
        kind: "hint",
        title: `Bem-vindo a ${payload.gameTitle || "Checkpoint"}`,
        subtitle: payload.userDisplay ? `Jogando como ${payload.userDisplay}` : "Overlay ativo",
        avatar: payload.userAvatar,
      };
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
        message: payload.message,
        gameTitle: payload.gameTitle,
        screenshotUrl: payload.screenshotUrl,
      };
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

  const closePanel = () => {
    setIsPanelVisible(false);
    (window as any).achievementOverlay?.panelAction?.({ type: "close" });
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
              className="flex items-center gap-3.5 rounded-2xl border border-emerald-500/25 bg-black/85 p-4 shadow-[0_20px_50px_rgba(0,0,0,0.6)] backdrop-blur-2xl"
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
              className="flex items-center gap-3.5 rounded-2xl border border-white/10 bg-black/85 p-4 shadow-[0_20px_50px_rgba(0,0,0,0.6)] backdrop-blur-2xl"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white/10">
                {toast.avatar ? (
                  <img src={toast.avatar} alt="" className="h-full w-full object-cover" />
                ) : toast.screenshotUrl ? (
                  <Camera className="h-4.5 w-4.5 text-cyan-300" />
                ) : (
                  <Sparkles className="h-4.5 w-4.5 text-white/70" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="truncate text-xs font-bold text-white">{toast.title}</h4>
                {toast.subtitle && (
                  <p className="truncate text-[10px] font-medium text-white/50 mt-0.5">{toast.subtitle}</p>
                )}
                {toast.message && (
                  <p className="line-clamp-1 text-[10px] font-medium text-white/70 mt-0.5">{toast.message}</p>
                )}
              </div>
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
              className="relative flex h-[82vh] w-[90vw] max-w-6xl overflow-hidden rounded-[28px] border border-white/10 bg-[#08080a]/90 shadow-[0_30px_100px_rgba(0,0,0,0.8)] backdrop-blur-3xl"
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
                    className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-xs font-bold transition-all ${activeView === "chats"
                        ? "bg-white text-black shadow-md"
                        : "text-white/50 hover:bg-white/5 hover:text-white"
                      }`}
                  >
                    <MessageSquare className="h-4 w-4" /> Bate-papo
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
                          Amigos no Jogo
                        </span>
                        <p className="text-xl font-bold text-white mt-2">
                          {panelData.friends?.filter((f: any) => f.status === "online").length || 0}
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
                    <h3 className="text-lg font-bold text-white">Amigos Online</h3>
                    <div className="grid grid-cols-2 gap-3">
                      {(panelData.friends || []).map((friend: any, idx: number) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between rounded-2xl border border-white/[0.06] bg-white/[0.035] p-4"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="h-9 w-9 rounded-xl bg-white/10 shrink-0 flex items-center justify-center">
                              <Users className="h-4.5 w-4.5 text-white/70" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-white truncate">{friend.name || "Amigo"}</p>
                              <p className="text-[10px] text-emerald-400 truncate">Online</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {activeView === "chats" && (
                  <div className="flex flex-col h-full gap-4">
                    <h3 className="text-lg font-bold text-white">Bate-papo Rápido</h3>
                    <div className="flex-1 rounded-2xl border border-white/[0.06] bg-white/[0.035] p-4 overflow-y-auto">
                      <p className="text-xs text-white/40">Nenhuma mensagem recente.</p>
                    </div>
                  </div>
                )}

                {activeView === "media" && (
                  <div className="flex flex-col gap-4">
                    <h3 className="text-lg font-bold text-white">Capturas de Tela</h3>
                    <div className="grid grid-cols-3 gap-3">
                      {(panelData.screenshots || []).map((url: string, idx: number) => (
                        <div key={idx} className="h-32 rounded-xl overflow-hidden border border-white/10">
                          <img src={url} alt="" className="h-full w-full object-cover" />
                        </div>
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
    </div>
  );
};

export default OverlayApp;
