import React, { useState } from "react";
import { CheckCircle2, ChevronLeft, ChevronRight, Check, Plus, Link2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { SoundEffectType } from "../../hooks/useSoundEffects";
import { PHERIELIUM_LOGO_PATH } from "../../constants/assets";

export interface EmptyStateProps {
  searchTerm: string;
  onAddGame: () => void;
  onConnect: () => void;
  steamConnected: boolean;
}

export const EmptyState: React.FC<EmptyStateProps> = React.memo(
  ({ searchTerm, onAddGame, onConnect, steamConnected }) => (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="w-full max-w-md rounded-[32px] p-10 text-center bg-[#08090C]/90 border border-white/[0.08] shadow-[0_25px_80px_rgba(0,0,0,0.85)] backdrop-blur-2xl"
    >
      <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-white/[0.03] border border-white/[0.08] flex items-center justify-center shadow-[0_0_30px_rgba(255,255,255,0.06)]">
        <img
          src={PHERIELIUM_LOGO_PATH}
          alt="Pherielium"
          className="w-8 h-8 object-contain opacity-70"
          draggable={false}
        />
      </div>

      <h3 className="mb-2 text-2xl font-display font-semibold tracking-tight text-white">
        {searchTerm ? "Nenhum jogo encontrado" : "Biblioteca vazia"}
      </h3>
      <p className="mb-8 text-xs md:text-sm font-body text-white/45 leading-relaxed">
        {searchTerm
          ? "Não encontramos nenhum jogo correspondente à sua busca."
          : steamConnected
            ? "Você não possui jogos salvos. Adicione um jogo executável manualmente."
            : "Adicione seu primeiro jogo ou conecte sua conta Steam para sincronizar."}
      </p>
      {!searchTerm && (
        <div className="flex flex-wrap justify-center gap-3">
          {!steamConnected && (
            <button
              type="button"
              onClick={onConnect}
              className="cursor-pointer h-11 rounded-full px-6 text-xs font-body font-medium bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.12] text-white/90 hover:text-white transition-all duration-200 flex items-center gap-2"
            >
              <Link2 className="w-3.5 h-3.5" />
              Conectar Steam
            </button>
          )}
          <button
            type="button"
            onClick={onAddGame}
            className="cursor-pointer h-11 rounded-full bg-white hover:bg-white/90 px-6 text-xs font-body font-semibold text-black transition-all duration-200 flex items-center gap-2 shadow-[0_4px_20px_rgba(255,255,255,0.15)]"
          >
            <Plus className="w-3.5 h-3.5" />
            Novo Jogo
          </button>
        </div>
      )}
    </motion.div>
  ),
);

EmptyState.displayName = "EmptyState";

export interface EmptyLibraryOnboardingProps {
  onConnectSteam: () => void;
  onOpenAddGame: () => void;
  onComplete: () => void | Promise<void>;
  playSound: (type: SoundEffectType) => void;
}

export const EmptyLibraryOnboarding: React.FC<EmptyLibraryOnboardingProps> = React.memo(
  ({ onConnectSteam, onOpenAddGame, onComplete, playSound }) => {
    const [step, setStep] = useState(0);

    const handleNext = () => {
      if (step < 2) {
        playSound("navigate");
        setStep((prev) => prev + 1);
      } else {
        playSound("select");
        void onComplete();
      }
    };

    const handleBack = () => {
      if (step > 0) {
        playSound("navigate");
        setStep((prev) => prev - 1);
      }
    };

    return (
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-xl rounded-[32px] p-8 md:p-10 bg-[#08090C]/90 border border-white/[0.08] shadow-[0_25px_80px_rgba(0,0,0,0.85)] backdrop-blur-2xl font-sans"
      >
        <div className="flex items-center justify-between mb-8">
          <p className="text-[11px] font-body tracking-wider uppercase text-white/35">
            Primeiros passos • Etapa {step + 1} de 3
          </p>
          <div className="flex items-center gap-2">
            {[0, 1, 2].map((idx) => (
              <span
                key={idx}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  idx === step
                    ? "w-6 bg-white shadow-[0_0_8px_rgba(255,255,255,0.7)]"
                    : "w-1.5 bg-white/20"
                }`}
              />
            ))}
          </div>
        </div>

        <div className="min-h-[150px]">
          <AnimatePresence mode="wait">
            {step === 0 && (
              <motion.div
                key="step-0"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2 }}
                className="space-y-3"
              >
                <h3 className="text-2xl md:text-3xl font-display font-semibold tracking-tight text-white">
                  Sua biblioteca está vazia
                </h3>
                <p className="text-xs md:text-sm font-body text-white/50 leading-relaxed">
                  Centralize todos os seus jogos, mods e acompanhe estatísticas em um único hub limpo e veloz.
                </p>
              </motion.div>
            )}

            {step === 1 && (
              <motion.div
                key="step-1"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2 }}
                className="space-y-4"
              >
                <h3 className="text-2xl md:text-3xl font-display font-semibold tracking-tight text-white">
                  Conecte com a Steam
                </h3>
                <p className="text-xs md:text-sm font-body text-white/50 leading-relaxed">
                  Vincule sua conta para importar seus jogos e conquistas automaticamente em segundos.
                </p>
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={onConnectSteam}
                    className="cursor-pointer h-11 rounded-full px-6 text-xs font-body font-medium bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.12] text-white transition-all duration-200 flex items-center gap-2"
                  >
                    <Link2 className="w-3.5 h-3.5" />
                    Conectar Steam
                  </button>
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="step-2"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2 }}
                className="space-y-4"
              >
                <h3 className="text-2xl md:text-3xl font-display font-semibold tracking-tight text-white">
                  Adicione manualmente
                </h3>
                <p className="text-xs md:text-sm font-body text-white/50 leading-relaxed">
                  Cadastre qualquer jogo local, instalador ou emulador diretamente no seu launcher.
                </p>
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      playSound("select");
                      onOpenAddGame();
                    }}
                    className="cursor-pointer h-11 rounded-full bg-white hover:bg-white/90 px-6 text-xs font-body font-semibold text-black transition-all duration-200 flex items-center gap-2 shadow-[0_4px_20px_rgba(255,255,255,0.15)]"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Adicionar Jogo
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="flex items-center justify-between pt-6 border-t border-white/[0.08] mt-6">
          <button
            type="button"
            onClick={handleBack}
            disabled={step === 0}
            className="cursor-pointer flex items-center gap-1.5 text-xs font-body font-medium text-white/40 hover:text-white disabled:opacity-0 transition-all duration-200"
          >
            <ChevronLeft className="h-4 w-4" /> Voltar
          </button>

          <button
            type="button"
            onClick={handleNext}
            className="cursor-pointer flex items-center gap-1.5 h-10 rounded-full bg-white hover:bg-white/90 px-6 text-xs font-body font-semibold text-black transition-all duration-200 shadow-[0_4px_20px_rgba(255,255,255,0.12)]"
          >
            {step === 2 ? (
              <>Concluir <Check className="h-3.5 w-3.5" /></>
            ) : (
              <>Próximo <ChevronRight className="h-3.5 w-3.5" /></>
            )}
          </button>
        </div>

        <p className="mt-6 flex items-center gap-2 text-[11px] font-body text-white/35">
          <CheckCircle2 className="h-3.5 w-3.5 text-white/60" />
          Após a sincronização, seus jogos aparecem automaticamente na biblioteca.
        </p>
      </motion.div>
    );
  },
);

EmptyLibraryOnboarding.displayName = "EmptyLibraryOnboarding";
