import React from "react";
import { CheckCircle2 } from "lucide-react";
import Stepper, { Step } from "../ReactBits/Stepper";
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
            ? "Voce nao possui jogos salvos. Adicione um jogo manualmente."
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
  ({ onConnectSteam, onOpenAddGame, onComplete, playSound }) => (
    <div
      className="w-full max-w-2xl rounded-3xl p-8"
      style={{
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.09)",
        backdropFilter: "blur(32px)",
      }}
    >
      <p className="mb-4 text-[10px] uppercase tracking-[0.28em]" style={{ color: "rgba(255,255,255,0.3)" }}>
        Primeiros passos
      </p>
      <Stepper
        stepCircleContainerClassName="bg-transparent border-0 shadow-none"
        stepContainerClassName="pt-2"
        contentClassName="pb-2"
        footerClassName="pt-2"
        backButtonText="Voltar"
        nextButtonText="Proximo"
        onStepChange={() => playSound("navigate")}
        onFinalStepCompleted={() => {
          playSound("select");
          void onComplete();
        }}
        resetOnComplete
      >
        <Step>
          <h3 className="mb-2 text-2xl font-black text-white">Sua biblioteca esta vazia</h3>
          <p className="text-sm" style={{ color: "rgba(255,255,255,0.55)" }}>
            Adicione um jogo manualmente ou conecte sua conta Steam.
          </p>
        </Step>
        <Step>
          <h3 className="mb-2 text-2xl font-black text-white">Conecte com a Steam</h3>
          <p className="mb-5 text-sm" style={{ color: "rgba(255,255,255,0.55)" }}>
            Vincule sua conta para importar jogos automaticamente.
          </p>
          <button
            type="button"
            onClick={onConnectSteam}
            className="h-10 rounded-full px-5 text-[11px] font-black uppercase tracking-wider transition-all"
            style={{
              background: "rgba(103,182,118,0.1)",
              border: "1px solid rgba(103,182,118,0.35)",
              color: "#67b676",
            }}
          >
            Conectar Steam
          </button>
        </Step>
        <Step>
          <h3 className="mb-2 text-2xl font-black text-white">Adicione manualmente</h3>
          <p className="mb-5 text-sm" style={{ color: "rgba(255,255,255,0.55)" }}>
            Cadastre seu primeiro jogo manualmente agora.
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
        </Step>
      </Stepper>
      <p className="mt-5 flex items-center gap-2 text-[11px]" style={{ color: "rgba(255,255,255,0.35)" }}>
        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
        Depois da primeira sincronizacao, seus jogos aparecem automaticamente.
      </p>
    </div>
  ),
);

EmptyLibraryOnboarding.displayName = "EmptyLibraryOnboarding";
