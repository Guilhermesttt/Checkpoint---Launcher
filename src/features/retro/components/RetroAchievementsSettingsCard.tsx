import React, { useState } from "react";
import { Award, LoaderCircle, Unlink } from "lucide-react";

export interface RetroAchievementsSettingsCardProps {
  username?: string;
  connected: boolean;
  busy: boolean;
  error?: string;
  onConnect(username: string): Promise<void>;
  onDisconnect(): Promise<void>;
}

export function RetroAchievementsSettingsCard({
  username,
  connected,
  busy,
  error,
  onConnect,
  onDisconnect,
}: RetroAchievementsSettingsCardProps) {
  const [draftUsername, setDraftUsername] = useState("");
  const normalizedUsername = draftUsername.trim();
  const validUsername = normalizedUsername.length >= 2 && normalizedUsername.length <= 32;

  if (connected) {
    return (
      <article
        aria-label="RetroAchievements"
        className="grid min-h-19 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border border-white/6 bg-white/[0.035] p-4"
      >
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10">
            <Award className="h-4.5 w-4.5 text-white/70" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold text-white">RetroAchievements</p>
            <p className="mt-0.5 max-w-32 truncate text-[10px] font-medium text-white/40">
              {username || "Conectado"}
            </p>
          </div>
        </div>
        <button
          type="button"
          aria-label="Desconectar RetroAchievements"
          disabled={busy}
          onClick={() => void onDisconnect()}
          className="flex cursor-pointer items-center gap-1 rounded-lg px-2.5 py-1 text-[9px] font-bold uppercase text-red-400 transition hover:bg-red-500/10 hover:text-red-300 disabled:cursor-wait disabled:opacity-50"
        >
          {busy ? <LoaderCircle className="h-3 w-3 animate-spin" /> : <Unlink className="h-3 w-3" />}
          Desconectar
        </button>
      </article>
    );
  }

  return (
    <article
      aria-label="RetroAchievements"
      className="rounded-2xl border border-white/6 bg-white/[0.035] p-4"
    >
      <div className="mb-3 flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10">
          <Award className="h-4.5 w-4.5 text-white/70" aria-hidden="true" />
        </div>
        <div>
          <p className="text-xs font-bold text-white">RetroAchievements</p>
          <p className="mt-0.5 text-[10px] font-medium text-white/40">
            Progresso normal e hardcore
          </p>
        </div>
      </div>
      <form
        className="flex items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (validUsername && !busy) void onConnect(normalizedUsername);
        }}
      >
        <label className="min-w-0 flex-1 text-[10px] font-semibold text-white/55">
          Usuário RetroAchievements
          <input
            value={draftUsername}
            maxLength={32}
            disabled={busy}
            onChange={(event) => setDraftUsername(event.target.value)}
            className="mt-1 w-full rounded-xl border border-white/10 bg-black/35 px-3 py-2 text-xs text-white outline-none transition placeholder:text-white/25 focus:border-white/25 disabled:cursor-wait disabled:opacity-50"
            placeholder="Seu usuário"
          />
        </label>
        <button
          type="submit"
          aria-label="Conectar RetroAchievements"
          disabled={!validUsername || busy}
          className="h-8.5 shrink-0 cursor-pointer rounded-xl bg-white px-3 text-[9px] font-bold uppercase text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-35"
        >
          {busy ? "Conectando..." : "Conectar"}
        </button>
      </form>
      <p aria-live="polite" className="mt-2 min-h-4 text-[10px] text-red-300">
        {error || ""}
      </p>
    </article>
  );
}
