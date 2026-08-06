import React, { useState } from "react";
import { CheckCircle2, ChevronLeft, ChevronRight, Check } from "lucide-react";
import type { SoundEffectType } from "../../hooks/useSoundEffects";

export interface EmptyStateProps {
  searchTerm: string;
  onAddGame: () => void;
  onConnect: () => void;
  steamConnected: boolean;
}

export const EmptyState: React.FC<EmptyStateProps> = React.memo(
  ({ searchTerm, onAddGame, onConnect, steamConnected }) => (
    <div
      className="w-full max-w-md rounded-3xl p-8 text-center"
      style={{
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.08)",
        backdropFilter: "blur(24px)",
      }}
    >
      <h3 className="mb-2 text-2xl font-black text-white">
        {searchTerm ? "Nenhum resultado" : "Biblioteca vazia"}
      </h3>
      <p className="mb-6 text-sm" style={{ color: "rgba(255,255,255,0.45)" }}>
        {searchTerm
          ? "Tente buscar por outro termo."
          : steamConnected
            ? "Você não possui jogos salvos. Adicione um jogo manualmente."
            : "Adicione um jogo ou conecte sua conta Steam."}
      </p>
      {!searchTerm && (
        <div className="flex justify-center gap-3">
          {!steamConnected && (
            <button
              type="button"
              onClick={onConnect}
              className="h-10 rounded-full px-5 text-[11px] font-black uppercase tracking-wider transition-all hover:scale-[1.02]"
              style={{
                background: "rgba(103,182,118,0.1)",
                border: "1px solid rgba(103,182,118,0.3)",
                color: "#67b676",
              }}
            >
              Conectar Steam
            </button>
          )}
          <button
            type="button"
            onClick={onAddGame}
            className="h-10 rounded-full bg-white px-5 text-[11px] font-black uppercase tracking-wider text-black transition-all hover:scale-[1.02]"
          >
            Novo Jogo
          </button>
        </div>
      )}
    </div>
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
      <div
        className="w-full max-w-2xl rounded-3xl p-8"
        style={{
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.09)",
          backdropFilter: "blur(32px)",
        }}
      >
        <div className="flex items-center justify-between mb-6">
          <p className="text-[10px] uppercase tracking-[0.28em]" style={{ color: "rgba(255,255,255,0.3)" }}>
            Primeiros passos • Passo {step + 1} de 3
          </p>
          <div className="flex items-center gap-1.5">
            {[0, 1, 2].map((idx) => (
              <span
                key={idx}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  idx === step ? "w-6 bg-white" : "w-1.5 bg-white/20"
                }`}
              />
            ))}
          </div>
        </div>

        <div className="min-h-[140px]">
          {step === 0 && (
            <div>
              <h3 className="mb-2 text-2xl font-black text-white">Sua biblioteca está vazia</h3>
              <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.55)" }}>
                Adicione seus jogos favoritos para ter um hub completo com estatísticas, conquistas e acompanhamento em tempo real.
              </p>
            </div>
          )}

          {step === 1 && (
            <div>
              <h3 className="mb-2 text-2xl font-black text-white">Conecte com a Steam</h3>
              <p className="mb-5 text-sm" style={{ color: "rgba(255,255,255,0.55)" }}>
                Vincule sua conta para importar jogos e conquistas automaticamente.
              </p>
              <button
                type="button"
                onClick={onConnectSteam}
                className="h-10 rounded-full px-5 text-[11px] font-black uppercase tracking-wider transition-all hover:scale-[1.02]"
                style={{
                  background: "rgba(103,182,118,0.1)",
                  border: "1px solid rgba(103,182,118,0.35)",
                  color: "#67b676",
                }}
              >
                Conectar Steam
              </button>
            </div>
          )}

          {step === 2 && (
            <div>
              <h3 className="mb-2 text-2xl font-black text-white">Adicione manualmente</h3>
              <p className="mb-5 text-sm" style={{ color: "rgba(255,255,255,0.55)" }}>
                Cadastre seu primeiro jogo local ou emulador manualmente agora.
              </p>
              <button
                type="button"
                onClick={() => {
                  playSound("select");
                  onOpenAddGame();
                }}
                className="h-10 rounded-full bg-white px-5 text-[11px] font-black uppercase tracking-wider text-black transition-all hover:scale-[1.02]"
              >
                Novo Jogo
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between pt-6 border-t border-white/10 mt-4">
          <button
            type="button"
            onClick={handleBack}
            disabled={step === 0}
            className="flex items-center gap-1 text-xs font-bold text-white/50 hover:text-white disabled:opacity-0 transition-opacity"
          >
            <ChevronLeft className="h-4 w-4" /> Voltar
          </button>

          <button
            type="button"
            onClick={handleNext}
            className="flex items-center gap-1.5 h-9 rounded-full bg-white px-5 text-xs font-black uppercase tracking-wider text-black transition-all hover:scale-[1.02]"
          >
            {step === 2 ? (
              <>Concluir <Check className="h-4 w-4" /></>
            ) : (
              <>Próximo <ChevronRight className="h-4 w-4" /></>
            )}
          </button>
        </div>

        <p className="mt-5 flex items-center gap-2 text-[11px]" style={{ color: "rgba(255,255,255,0.35)" }}>
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
          Depois da primeira sincronização, seus jogos aparecem automaticamente.
        </p>
      </div>
    );
  },
);

EmptyLibraryOnboarding.displayName = "EmptyLibraryOnboarding";
