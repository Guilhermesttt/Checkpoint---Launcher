import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ExternalLink, LogOut, CheckCircle2, LogIn, ChevronDown, ChevronUp, KeyRound } from "lucide-react";
import type { SoundEffectType } from "../../hooks/useSoundEffects";
import { LoadingState } from "../ui/loading-state";
import { fetchEpicStatus } from "../../services/epic";

import type { PlatformOperationState } from "../../types/platformOperations";
import { getPlatformPhaseLabel } from "../../utils/platformOperationReducer";

interface EpicConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnect: (sid: string) => Promise<void>;
  onDisconnect?: () => Promise<void>;
  playSound: (sound: SoundEffectType) => void;
  operationState?: PlatformOperationState;
}

export const EpicConnectModal: React.FC<EpicConnectModalProps> = ({
  isOpen,
  onClose,
  onConnect,
  onDisconnect,
  playSound,
  operationState,
}) => {
  const [sid, setSid] = useState("");
  const [loading, setLoading] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [showManualInput, setShowManualInput] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentAccount, setCurrentAccount] = useState<{
    authenticated: boolean;
    displayName?: string;
  } | null>(null);

  useEffect(() => {
    if (isOpen) {
      setError(null);
      setSid("");
      setShowManualInput(false);
      void fetchEpicStatus()
        .then((status) => {
          setCurrentAccount({
            authenticated: Boolean(status.authenticated),
            displayName: status.displayName,
          });
        })
        .catch(() => {
          setCurrentAccount({ authenticated: false });
        });
    }
  }, [isOpen]);

  const isOperationBusy = Boolean(
    operationState &&
      (operationState.status === "syncing" || operationState.status === "connecting" || operationState.status === "disconnecting"),
  );
  const isBusy = loading || disconnecting || isOperationBusy;
  const busyLabel =
    operationState && isOperationBusy && "phase" in operationState
      ? getPlatformPhaseLabel(operationState.phase, "pt-BR")
      : disconnecting
        ? "Desconectando..."
        : "Autenticando...";

  const handleDisconnectCurrent = async () => {
    if (isBusy) return;
    setDisconnecting(true);
    setError(null);
    playSound("back");
    try {
      if (onDisconnect) {
        await onDisconnect();
      } else if (window.electronAPI?.logoutEpic) {
        await window.electronAPI.logoutEpic();
      }
      setCurrentAccount({ authenticated: false });
      playSound("select");
    } catch (err: any) {
      setError(err?.message || "Erro ao desconectar conta da Epic Games.");
      playSound("back");
    } finally {
      setDisconnecting(false);
    }
  };

  const handleQuickLogin = async () => {
    if (isBusy) return;
    setLoading(true);
    setError(null);
    playSound("select");

    try {
      if (window.electronAPI?.openEpicLoginWindow) {
        const code = await window.electronAPI.openEpicLoginWindow();
        if (code) {
          await onConnect(code);
          setSid("");
          playSound("select");
          onClose();
        }
      } else {
        handleOpenAuthUrl();
      }
    } catch (err: any) {
      setError(err?.message || "Falha ao autenticar na Epic Games.");
      playSound("back");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sid.trim() || isBusy) return;

    setLoading(true);
    setError(null);
    playSound("select");

    try {
      await onConnect(sid.trim());
      setSid("");
      playSound("select");
      onClose();
    } catch (err: any) {
      setError(err?.message || "Falha ao autenticar na Epic Games.");
      playSound("back");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAuthUrl = () => {
    playSound("select");
    const authUrl =
      "https://www.epicgames.com/id/login?redirectUrl=https%3A%2F%2Fwww.epicgames.com%2Fid%2Fapi%2Fredirect%3FclientId%3D34a02cf8f4414e29b15921876da36f9a%26responseType%3Dcode";
    if (window.electronAPI?.openExternalUrl) {
      void window.electronAPI.openExternalUrl(authUrl);
    } else {
      window.open(authUrl, "_blank");
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => !isBusy && onClose()}
            className="fixed inset-0 bg-black/80 backdrop-blur-md z-50"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-[#0a0b0f] border border-white/10 rounded-3xl shadow-2xl z-50 overflow-hidden font-sans"
          >
            <div className="p-6">
              <div className="flex items-center justify-between pb-5 border-b border-white/10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center overflow-hidden">
                    <img src="/Pherielium_logo.png" alt="Pherielium" className="w-7 h-7 object-contain" />
                  </div>
                  <h2 className="text-lg font-bold text-white tracking-tight">Conectar Epic Games</h2>
                </div>
                <button
                  onClick={() => !isBusy && onClose()}
                  disabled={isBusy}
                  className="text-white/40 hover:text-white transition-colors disabled:opacity-30 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="mt-6 space-y-5">
                {currentAccount?.authenticated && (
                  <div className="flex items-center justify-between p-4 rounded-2xl bg-white/[0.04] border border-white/10">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-white/10 border border-white/10 flex items-center justify-center text-white shrink-0">
                        <CheckCircle2 size={18} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-white truncate">
                          {currentAccount.displayName || "Conta Conectada"}
                        </p>
                        <p className="text-[11px] text-white/50">Conta atualmente vinculada</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleDisconnectCurrent}
                      disabled={isBusy}
                      className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white border border-white/10 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 shrink-0"
                    >
                      <LogOut size={13} />
                      Desconectar
                    </button>
                  </div>
                )}

                <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/[0.07] space-y-4">
                  <p className="text-[13px] text-white/60 leading-relaxed">
                    Faça login com sua conta da Epic Games em uma janela integrada para importar seus jogos automaticamente.
                  </p>
                  <button
                    type="button"
                    onClick={handleQuickLogin}
                    disabled={isBusy}
                    className="w-full py-3.5 bg-white hover:bg-white/90 text-black rounded-2xl font-bold shadow-lg shadow-white/10 transition-all transform hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 text-sm"
                  >
                    {isBusy ? (
                      <LoadingState label={busyLabel} variant="Drive" size="sm" />
                    ) : (
                      <>
                        <LogIn size={16} />
                        <span>{currentAccount?.authenticated ? "Trocar de Conta Epic" : "Fazer Login com a Epic Games"}</span>
                      </>
                    )}
                  </button>
                </div>

                {error && <div className="text-white text-xs p-3 rounded-xl bg-white/5 border border-white/10">{error}</div>}

                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => setShowManualInput(!showManualInput)}
                    className="flex items-center justify-between w-full text-xs text-white/40 hover:text-white/70 transition-colors py-1 cursor-pointer"
                  >
                    <span className="flex items-center gap-1.5 font-medium">
                      <KeyRound size={13} />
                      Opção avançada: Inserir código de autorização manualmente
                    </span>
                    {showManualInput ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>

                  {showManualInput && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mt-3 space-y-3 pt-3 border-t border-white/5"
                    >
                      <button
                        type="button"
                        onClick={handleOpenAuthUrl}
                        disabled={isBusy}
                        className="flex items-center gap-2 px-3 py-2 bg-white/5 hover:bg-white/10 text-white/80 hover:text-white text-xs font-medium rounded-xl border border-white/10 transition-colors cursor-pointer"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        Abrir página de autorização no navegador
                      </button>

                      <form onSubmit={handleSubmit} className="space-y-3">
                        <input
                          type="text"
                          value={sid}
                          disabled={isBusy}
                          onChange={(e) => setSid(e.target.value)}
                          placeholder="Cole o código ou JSON aqui..."
                          className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white placeholder-white/30 focus:outline-none focus:border-white/30"
                        />
                        <button
                          type="submit"
                          disabled={!sid.trim() || isBusy}
                          className="w-full py-2.5 bg-white/10 hover:bg-white/15 disabled:opacity-40 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer disabled:cursor-not-allowed"
                        >
                          Confirmar Código
                        </button>
                      </form>
                    </motion.div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
