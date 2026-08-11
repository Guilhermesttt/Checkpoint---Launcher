import { useCallback, useEffect, useState } from "react";

import {
  getRetroAchievementProgress,
  type RetroAchievementsProgress,
} from "../../../services/retroAchievements";
import type { RetroGame } from "../shelf/retroCollection";

interface RetroAchievementsPanelProps {
  game: RetroGame;
  accountLinked: boolean;
  onEditGame: (game: RetroGame) => void;
  onOpenSettingsConnections?: () => void;
}

const formatEarnedDate = (value?: string) => {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" }).format(date);
};

export function RetroAchievementsPanel({ game, accountLinked, onEditGame, onOpenSettingsConnections }: RetroAchievementsPanelProps) {
  const [progress, setProgress] = useState<RetroAchievementsProgress | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requestVersion, setRequestVersion] = useState(0);

  const retry = useCallback(() => setRequestVersion((version) => version + 1), []);

  useEffect(() => {
    if (!accountLinked || !game.retroAchievementsGameId) {
      return;
    }

    let active = true;
    const requestFrame = requestAnimationFrame(() => {
      if (!active) return;
      setLoading(true);
      setError(null);
      void getRetroAchievementProgress(game.retroAchievementsGameId!)
        .then((result) => {
          if (active) setProgress(result);
        })
        .catch((requestError) => {
          if (!active) return;
          setProgress(null);
          setError(requestError instanceof Error ? requestError.message : "Não foi possível carregar as conquistas.");
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    });

    return () => {
      active = false;
      cancelAnimationFrame(requestFrame);
    };
  }, [accountLinked, game.retroAchievementsGameId, requestVersion]);

  if (!accountLinked) {
    return (
      <div className="rounded-2xl border border-dashed border-white/15 p-6">
        <p className="font-['Unbounded'] text-xs text-[#eee9dd]">Conta não vinculada</p>
        <p className="mt-3 text-sm leading-6">Vincule seu perfil para ver o progresso normal e hardcore.</p>
        <button type="button" onClick={onOpenSettingsConnections} className="mt-5 rounded-xl border border-[#b52322] px-4 py-3 text-[10px] font-bold uppercase tracking-[0.16em] text-[#eee9dd] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#eee9dd]">
          Vincular conta RetroAchievements
        </button>
      </div>
    );
  }

  if (!game.retroAchievementsGameId) {
    return (
      <div className="rounded-2xl border border-dashed border-white/15 p-6">
        <p className="font-['Unbounded'] text-xs text-[#eee9dd]">Jogo não vinculado</p>
        <p className="mt-3 text-sm leading-6">Confirme o jogo e a plataforma no catálogo do RetroAchievements.</p>
        <button type="button" aria-label={`Vincular ${game.title} ao RetroAchievements`} onClick={() => onEditGame(game)} className="mt-5 rounded-xl border border-[#b52322] px-4 py-3 text-[10px] font-bold uppercase tracking-[0.16em] text-[#eee9dd] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#eee9dd]">
          Vincular jogo
        </button>
      </div>
    );
  }

  if (loading && !progress) {
    return <p role="status" aria-live="polite" className="text-sm">Carregando conquistas pessoais...</p>;
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-[#b52322]/60 bg-[#b52322]/10 p-6">
        <p role="alert" className="text-sm text-[#eee9dd]">{error}</p>
        <button type="button" onClick={retry} className="mt-4 rounded-xl border border-white/20 px-4 py-2 text-[10px] font-bold uppercase tracking-[0.16em]">Tentar novamente</button>
      </div>
    );
  }

  if (!progress) return null;

  const isMastered = progress.summary.highestAwardKind?.toLowerCase().includes("master");
  const cacheLabel = progress.source === "stale" || progress.source === "cached";

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-5">
          <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-[#77736c]">Progresso</span>
          <strong className="mt-2 block font-['Unbounded'] text-xl text-[#eee9dd]">{progress.summary.normalUnlocked} / {progress.summary.total}</strong>
          <progress className="mt-4 h-1.5 w-full accent-[#b52322]" value={progress.summary.normalPercent} max={100} aria-label={`Progresso normal ${progress.summary.normalPercent}%`} />
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-5">
          <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-[#77736c]">Hardcore</span>
          <strong className="mt-2 block font-['Unbounded'] text-sm text-[#eee9dd]">Hardcore {progress.summary.hardcorePercent}%</strong>
          {isMastered && <span className="mt-4 inline-block rounded-full bg-[#b52322] px-3 py-1 text-[9px] font-bold uppercase tracking-[0.14em] text-white">Masterizado</span>}
        </div>
      </div>

      {cacheLabel && <p role="status" className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#aaa49a]">Dados em cache</p>}

      {progress.achievements.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-white/15 p-6 text-sm">Nenhuma conquista disponível para este jogo.</p>
      ) : (
        <ul className="space-y-3" aria-label={`Conquistas de ${game.title}`}>
          {progress.achievements.map((achievement) => {
            const earnedDate = formatEarnedDate(achievement.dateEarnedHardcore || achievement.dateEarned);
            const imageUrl = achievement.unlocked ? achievement.badgeUrl : achievement.badgeLockedUrl || achievement.badgeUrl;
            return (
              <li key={achievement.id} className={`flex gap-4 rounded-2xl border border-white/10 p-4 ${achievement.unlocked ? "bg-white/[0.035]" : "opacity-55"}`}>
                {imageUrl ? (
                  <img src={imageUrl} alt={`${achievement.title} ${achievement.unlocked ? "desbloqueada" : "bloqueada"}`} className="h-14 w-14 rounded-xl object-cover" />
                ) : (
                  <span role="img" aria-label={`${achievement.title} ${achievement.unlocked ? "desbloqueada" : "bloqueada"}`} className="grid h-14 w-14 place-items-center rounded-xl bg-white/5">◆</span>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <strong className="text-sm text-[#eee9dd]">{achievement.title}</strong>
                    <span className="shrink-0 text-[10px] font-bold text-[#b52322]">{achievement.points} pts</span>
                  </div>
                  <p className="mt-1 text-xs leading-5">{achievement.description}</p>
                  {earnedDate && <p className="mt-2 text-[10px] uppercase tracking-[0.12em] text-[#77736c]">Desbloqueada em {earnedDate}{achievement.unlockedHardcore ? " · Hardcore" : ""}</p>}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
