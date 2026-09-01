import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ExternalLink, LogOut, CheckCircle2, KeyRound, AlertCircle } from "lucide-react";
import type { SoundEffectType } from "../../hooks/useSoundEffects";
import { LoadingState } from "../ui/loading-state";
import { fetchEpicStatus, validateEpicSession } from "../../services/epic";
import { PHERIELIUM_LOGO_PATH } from "../../constants/assets";

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
  const [error, setError] = useState<string | null>(null);
  const [currentAccount, setCurrentAccount] = useState<{
    authenticated: boolean;
    displayName?: string;
  } | null>(null);
  const [needsReauth, setNeedsReauth] = useState<{
    reason: "expired" | "network";
  } | null>(null);

  useEffect(() => {
    if (isOpen) {
      setError(null);
      setSid("");
      setNeedsReauth(null);
      // Run both checks in parallel. fetchEpicStatus reflects Legendary's view;
      // validateEpicSession reflects the encrypted vault + auto-refresh path.
      void Promise.allSettled([fetchEpicStatus(), validateEpicSession()]).then(
        ([statusResult, sessionResult]) => {
          if (statusResult.status === "fulfilled") {
            setCurrentAccount({
              authenticated: Boolean(statusResult.value.authenticated),
              displayName: statusResult.value.displayName,
            });
          } else {
            setCurrentAccount({ authenticated: false });
          }
          if (sessionResult.status === "fulfilled") {
            const { valid, reason } = sessionResult.value;
            if (!valid && (reason === "expired" || reason === "network")) {
              setNeedsReauth({ reason });
            }
          }
        },
      );
    }
  }, [isOpen]);

  const reauthMessage = needsReauth
    ? needsReauth.reason === "expired"
      ? "Sua sessão expirou. Reconecte a conta da Epic Games para continuar."
      : "Não foi possível validar sua sessão Epic. Verifique a conexão e reconecte."
    : null;

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
            className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg bg-black border border-neutral-800 rounded-2xl shadow-2xl z-50 overflow-hidden font-sans"
          >
            <div className="p-6">
              <div className="flex items-center justify-between pb-4 border-b border-neutral-800">
                <div className="flex items-center gap-3">
                  <img src={PHERIELIUM_LOGO_PATH} alt="Phelierium" className="w-8 h-8 rounded-lg" />
                  <h2 className="text-lg font-bold text-white">Conectar Epic Games</h2>
                </div>
                <button
                  onClick={() => !isBusy && onClose()}
                  disabled={isBusy}
                  className="text-neutral-500 hover:text-white transition-colors disabled:opacity-30 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="mt-6 space-y-5">
                {currentAccount?.authenticated && (
                  <div className="flex items-center justify-between p-3.5 rounded-xl bg-neutral-900/50 border border-neutral-800">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-white shrink-0">
                        <CheckCircle2 size={16} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-white truncate">
                          {currentAccount.displayName || "Conta Conectada"}
                        </p>
                        <p className="text-[10px] text-neutral-400">Conta atualmente vinculada</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleDisconnectCurrent}
                      disabled={isBusy}
                      className="px-3 py-1.5 rounded-lg bg-transparent hover:bg-white text-neutral-300 hover:text-black border border-neutral-700 hover:border-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 shrink-0"
                    >
                      <LogOut size={13} />
                      Desconectar
                    </button>
                  </div>
                )}

                {reauthMessage && (
                  <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/40">
                    <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <div className="min-w-0 space-y-1">
                      <p className="text-amber-100 text-xs font-semibold leading-relaxed">
                        {reauthMessage}
                      </p>
                      <button
                        type="button"
                        onClick={handleQuickLogin}
                        disabled={isBusy}
                        className="text-amber-300 hover:text-amber-200 text-[11px] font-bold underline underline-offset-2 disabled:opacity-50 cursor-pointer"
                      >
                        Reconectar agora
                      </button>
                    </div>
                  </div>
                )}

                <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-800 space-y-4">
                  <p className="text-xs text-neutral-400 leading-relaxed">
                    Insira o código de autorização ou JSON da Epic Games para vincular sua conta localmente.
                  </p>
                  <div className="space-y-3">
                    <button
                      type="button"
                      onClick={handleOpenAuthUrl}
                      disabled={isBusy}
                      className="flex items-center gap-2 w-full px-3 py-2.5 bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white text-xs font-medium rounded-lg border border-neutral-800 transition-colors cursor-pointer"
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
                        className="w-full bg-black border border-neutral-800 rounded-xl px-4 py-2.5 text-xs text-white placeholder-neutral-600 focus:outline-none focus:border-neutral-500 transition-colors"
                      />
                      <button
                        type="submit"
                        disabled={!sid.trim() || isBusy}
                        className="w-full py-2.5 bg-white hover:bg-neutral-200 disabled:bg-neutral-800 disabled:text-neutral-500 text-black rounded-xl text-xs font-bold transition-colors cursor-pointer disabled:cursor-not-allowed"
                      >
                        Confirmar Código
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};