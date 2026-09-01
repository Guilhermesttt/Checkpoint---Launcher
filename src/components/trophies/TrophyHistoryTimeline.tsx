// src/components/trophies/TrophyHistoryTimeline.tsx
// Paginated trophy and XP event timeline with tier + date filters (10 items per page).

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Calendar,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Filter,
  RefreshCw,
  Trophy,
} from "lucide-react";
import {
  defaultTrophyHistory,
  type TrophyTier,
  type TrophyHistoryClient,
  type UserTrophy,
  type XpEvent,
  type PageOptions,
  type Page,
} from "../../services/trophyHistory";
import {
  TIER_LEVELS,
  calculateGameTrophyCounts,
  aggregateTrophyCounts,
  calculatePlayerLevel,
} from "../../utils/trophyTiers";
import type { Game } from "../../types/domain";

const TIER_LABELS: Record<TrophyTier, string> = {
  platinum: "Platina",
  gold: "Ouro",
  silver: "Prata",
  bronze: "Bronze",
};

const TIER_ORDER: TrophyTier[] = ["platinum", "gold", "silver", "bronze"];

const ITEMS_PER_PAGE = 10;

type Tab = "trophies" | "xp";

const formatDate = (iso: string | null): string => {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
};

const tierColor = (tier: TrophyTier): string => {
  const info = TIER_LEVELS.find((t) => t.id === tier);
  return info?.color ?? "text-slate-300";
};

const tierBorder = (tier: TrophyTier): string => {
  const info = TIER_LEVELS.find((t) => t.id === tier);
  return info?.borderColor ?? "border-white/20";
};

const trophyDescriptionCopy = {
  "pt-BR": {
    title: "Histórico de Troféus",
    subtitle: "Conquistas e eventos de XP mais recentes.",
    tabTrophies: "Troféus",
    tabXp: "Eventos de XP",
    tierFilter: "Filtrar por tier",
    allTiers: "Todos",
    since: "De",
    until: "Até",
    clear: "Limpar",
    refresh: "Atualizar",
    empty: "Nenhum evento neste intervalo ainda.",
    error: "Falha ao carregar o histórico.",
    showing: (start: number, end: number, total: number, kind: string) =>
      `Mostrando ${start}–${end} de ${total} ${kind}`,
    xpLabel: (amount: number) => (amount > 0 ? `+${amount} XP` : `${amount} XP`),
    levelChange: (before: number | null, after: number | null) => {
      if (before == null || after == null) return "";
      if (after > before) return `Lv.${before} → Lv.${after}`;
      return `Lv.${after}`;
    },
    source: {
      trophy_unlock: "Troféu",
      level_milestone: "Marco de nível",
      manual: "Concessão manual",
      correction: "Correção",
    } as Record<string, string>,
  },
} as const;

// ============================================================
// COMPONENTES DE LINHA DE HISTÓRICO MEMOIZADOS
// ============================================================

const TimelineTrophyRow = React.memo<{
  trophy: UserTrophy;
  idx: number;
}>(({ trophy, idx }) => (
  <motion.li
    initial={{ opacity: 0, y: 4 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: Math.min(idx, 8) * 0.015 }}
    className={`flex items-start gap-3 rounded-xl border ${tierBorder(
      trophy.trophy?.tier ?? "bronze"
    )} bg-white/5 p-3 hover:bg-white/[0.07] transition transform-gpu will-change-transform`}
  >
    <Trophy className={`mt-0.5 h-4 w-4 ${tierColor(trophy.trophy?.tier ?? "bronze")}`} />
    <div className="min-w-0 flex-1">
      <p className="truncate text-sm font-bold text-white">
        {trophy.trophy?.title ?? "Troféu"}
        {typeof trophy.trophy?.xp_value === "number" ? (
          <span className="ml-2 text-xs font-normal text-amber-300">
            +{trophy.trophy.xp_value} XP
          </span>
        ) : null}
      </p>
      {trophy.trophy?.description ? (
        <p className="line-clamp-2 text-xs text-white/60">{trophy.trophy.description}</p>
      ) : null}
    </div>
    <time className="shrink-0 text-xs text-white/50">{formatDate(trophy.unlocked_at)}</time>
  </motion.li>
), (prev, next) => (
  prev.trophy.id === next.trophy.id &&
  prev.trophy.unlocked_at === next.trophy.unlocked_at &&
  prev.trophy.trophy?.tier === next.trophy.trophy?.tier &&
  prev.trophy.trophy?.title === next.trophy.trophy?.title &&
  prev.trophy.trophy?.xp_value === next.trophy.trophy?.xp_value &&
  prev.idx === next.idx
));

const TimelineXpRow = React.memo<{
  event: XpEvent;
  idx: number;
  copy: typeof trophyDescriptionCopy["pt-BR"];
}>(({ event, idx, copy }) => (
  <motion.li
    initial={{ opacity: 0, y: 4 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: Math.min(idx, 8) * 0.015 }}
    className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/5 p-3 hover:bg-white/[0.07] transition transform-gpu will-change-transform"
  >
    <ChevronDown className="mt-0.5 h-4 w-4 text-emerald-300" />
    <div className="min-w-0 flex-1">
      <p className="text-sm font-bold text-white">
        {copy.source[event.source_type] ?? event.source_type}
        <span className="ml-2 text-xs font-normal text-amber-300">
          {copy.xpLabel(event.amount)}
        </span>
        {event.level_before != null && event.level_after != null ? (
          <span className="ml-2 text-xs font-normal text-white/60">
            {copy.levelChange(event.level_before, event.level_after)}
          </span>
        ) : null}
      </p>
      {event.reason ? <p className="text-xs text-white/60">{event.reason}</p> : null}
    </div>
    <time className="shrink-0 text-xs text-white/50">{formatDate(event.created_at)}</time>
  </motion.li>
), (prev, next) => (
  prev.event.id === next.event.id &&
  prev.event.amount === next.event.amount &&
  prev.event.source_type === next.event.source_type &&
  prev.event.created_at === next.event.created_at &&
  prev.event.level_before === next.event.level_before &&
  prev.event.level_after === next.event.level_after &&
  prev.idx === next.idx
));

interface TrophyHistoryTimelineProps {
  userId: string;
  games?: Game[];
  client?: TrophyHistoryClient;
  initialTab?: Tab;
}

export const TrophyHistoryTimeline: React.FC<TrophyHistoryTimelineProps> = ({
  userId,
  games = [],
  client,
  initialTab = "trophies",
}) => {
  const api = client ?? defaultTrophyHistory;
  const copy = trophyDescriptionCopy["pt-BR"];

  const [tab, setTab] = useState<Tab>(initialTab);
  const [tier, setTier] = useState<TrophyTier | null>(null);
  const [since, setSince] = useState<string | null>(null);
  const [until, setUntil] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  const [trophies, setTrophies] = useState<UserTrophy[]>([]);
  const [xpEvents, setXpEvents] = useState<XpEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset page when tab or filters change
  const handleTabChange = (newTab: Tab) => {
    setTab(newTab);
    setCurrentPage(1);
  };

  const handleTierChange = (newTier: TrophyTier | null) => {
    setTier(newTier);
    setCurrentPage(1);
  };

  const handleSinceChange = (val: string | null) => {
    setSince(val);
    setCurrentPage(1);
  };

  const handleUntilChange = (val: string | null) => {
    setUntil(val);
    setCurrentPage(1);
  };

  const handleClearFilters = () => {
    setTier(null);
    setSince(null);
    setUntil(null);
    setCurrentPage(1);
  };

  // Generate real fallback items from library games if remote DB is empty
  const localSynthesizedTrophies = useMemo<UserTrophy[]>(() => {
    const list: UserTrophy[] = [];
    const validGames = (games || []).filter(
      (g) => (g.totalAchievements || 0) > 0 && (g.completedAchievements || 0) > 0
    );

    for (const g of validGames) {
      const total = g.totalAchievements || 0;
      const completed = g.completedAchievements || 0;
      const unlockDate = g.lastPlayedAt || (g as any).updatedAt || new Date().toISOString();
      const counts = calculateGameTrophyCounts(total, completed);

      // Platinum
      if (completed >= total && total > 0) {
        list.push({
          id: `plat-${g.id}`,
          user_id: userId,
          trophy_id: `plat-${g.id}`,
          progress: 1,
          unlocked_at: unlockDate,
          notified_at: null,
          metadata: { gameTitle: g.title },
          trophy: {
            id: `plat-${g.id}`,
            code: `plat_${g.id}`,
            title: `Platina: ${g.title}`,
            description: `Completou 100% das ${total} conquistas do jogo.`,
            tier: "platinum",
            xp_value: 300,
            category: "completion",
            icon_url: g.cardImage || g.image || null,
          },
        });
      }

      // Gold
      if (counts.gold > 0) {
        list.push({
          id: `gold-${g.id}`,
          user_id: userId,
          trophy_id: `gold-${g.id}`,
          progress: 1,
          unlocked_at: unlockDate,
          notified_at: null,
          metadata: { gameTitle: g.title },
          trophy: {
            id: `gold-${g.id}`,
            code: `gold_${g.id}`,
            title: `Troféu de Ouro: ${g.title}`,
            description: `${counts.gold} conquista(s) raras desbloqueadas (<5% global).`,
            tier: "gold",
            xp_value: counts.gold * 90,
            category: "achievement",
            icon_url: g.cardImage || g.image || null,
          },
        });
      }

      // Silver
      if (counts.silver > 0) {
        list.push({
          id: `silver-${g.id}`,
          user_id: userId,
          trophy_id: `silver-${g.id}`,
          progress: 1,
          unlocked_at: unlockDate,
          notified_at: null,
          metadata: { gameTitle: g.title },
          trophy: {
            id: `silver-${g.id}`,
            code: `silver_${g.id}`,
            title: `Troféu de Prata: ${g.title}`,
            description: `${counts.silver} conquista(s) incomuns desbloqueadas (5% a 10% global).`,
            tier: "silver",
            xp_value: counts.silver * 30,
            category: "achievement",
            icon_url: g.cardImage || g.image || null,
          },
        });
      }

      // Bronze
      if (counts.bronze > 0) {
        list.push({
          id: `bronze-${g.id}`,
          user_id: userId,
          trophy_id: `bronze-${g.id}`,
          progress: 1,
          unlocked_at: unlockDate,
          notified_at: null,
          metadata: { gameTitle: g.title },
          trophy: {
            id: `bronze-${g.id}`,
            code: `bronze_${g.id}`,
            title: `Troféu de Bronze: ${g.title}`,
            description: `${counts.bronze} conquista(s) comuns desbloqueadas (>10% global).`,
            tier: "bronze",
            xp_value: counts.bronze * 15,
            category: "achievement",
            icon_url: g.cardImage || g.image || null,
          },
        });
      }
    }

    return list.sort((a, b) => {
      const at = a.unlocked_at ? Date.parse(a.unlocked_at) : 0;
      const bt = b.unlocked_at ? Date.parse(b.unlocked_at) : 0;
      return bt - at;
    });
  }, [games, userId]);

  // Generate fallback XP events
  const localSynthesizedXpEvents = useMemo<XpEvent[]>(() => {
    const list: XpEvent[] = [];
    const validGames = (games || []).filter(
      (g) => (g.totalAchievements || 0) > 0 && (g.completedAchievements || 0) > 0
    );
    const agg = aggregateTrophyCounts(games || []);
    const playerLevel = calculatePlayerLevel(10, agg.completed, (games || []).length, agg);

    for (const g of validGames) {
      const unlockDate = g.lastPlayedAt || (g as any).updatedAt || new Date().toISOString();
      const counts = calculateGameTrophyCounts(g.totalAchievements || 0, g.completedAchievements || 0);

      if (counts.platinum > 0) {
        list.push({
          id: `xp-plat-${g.id}`,
          user_id: userId,
          source_type: "trophy_unlock",
          source_id: null,
          amount: 300,
          level_before: Math.max(1, playerLevel.level - 1),
          level_after: playerLevel.level,
          reason: `Platina obtida em ${g.title}`,
          metadata: { gameTitle: g.title },
          created_at: unlockDate,
        });
      }

      if (counts.gold > 0) {
        list.push({
          id: `xp-gold-${g.id}`,
          user_id: userId,
          source_type: "trophy_unlock",
          source_id: null,
          amount: counts.gold * 90,
          level_before: playerLevel.level,
          level_after: playerLevel.level,
          reason: `${counts.gold} troféu(s) de ouro em ${g.title}`,
          metadata: { gameTitle: g.title },
          created_at: unlockDate,
        });
      }
    }

    if (playerLevel.level > 1) {
      list.unshift({
        id: `xp-level-${playerLevel.level}`,
        user_id: userId,
        source_type: "level_milestone",
        source_id: null,
        amount: 500,
        level_before: playerLevel.level - 1,
        level_after: playerLevel.level,
        reason: `Alcançou o Nível ${playerLevel.level} (${playerLevel.rank})`,
        metadata: {},
        created_at: new Date().toISOString(),
      });
    }

    return list;
  }, [games, userId]);

  const buildOptions = useCallback(
    (cursor: string | null): PageOptions => ({
      limit: 100,
      before: cursor,
      tier: tab === "trophies" ? tier : null,
      since,
      until,
    }),
    [tab, tier, since, until]
  );

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (tab === "trophies") {
        let remoteRows: UserTrophy[] = [];
        try {
          const page: Page<UserTrophy> = await api.fetchTrophies(userId, buildOptions(null));
          remoteRows = page.rows || [];
        } catch {
          remoteRows = [];
        }

        let combined = remoteRows.length > 0 ? remoteRows : localSynthesizedTrophies;

        if (tier) {
          combined = combined.filter((item) => item.trophy?.tier === tier);
        }
        if (since) {
          const sinceTime = new Date(since).getTime();
          combined = combined.filter(
            (item) => item.unlocked_at && new Date(item.unlocked_at).getTime() >= sinceTime
          );
        }
        if (until) {
          const untilTime = new Date(until).getTime();
          combined = combined.filter(
            (item) => item.unlocked_at && new Date(item.unlocked_at).getTime() <= untilTime
          );
        }

        setTrophies(combined);
        setXpEvents([]);
      } else {
        let remoteRows: XpEvent[] = [];
        try {
          const page: Page<XpEvent> = await api.fetchXpEvents(userId, buildOptions(null));
          remoteRows = page.rows || [];
        } catch {
          remoteRows = [];
        }

        let combined = remoteRows.length > 0 ? remoteRows : localSynthesizedXpEvents;

        if (since) {
          const sinceTime = new Date(since).getTime();
          combined = combined.filter(
            (item) => item.created_at && new Date(item.created_at).getTime() >= sinceTime
          );
        }
        if (until) {
          const untilTime = new Date(until).getTime();
          combined = combined.filter(
            (item) => item.created_at && new Date(item.created_at).getTime() <= untilTime
          );
        }

        setXpEvents(combined);
        setTrophies([]);
      }
    } catch (e) {
      setError((e as Error).message || copy.error);
    } finally {
      setLoading(false);
    }
  }, [
    api,
    buildOptions,
    copy.error,
    localSynthesizedTrophies,
    localSynthesizedXpEvents,
    since,
    tab,
    tier,
    until,
    userId,
  ]);

  useEffect(() => {
    void reload();
  }, [reload]);

  // Pagination slicing (10 per page)
  const currentList = tab === "trophies" ? trophies : xpEvents;
  const totalItems = currentList.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / ITEMS_PER_PAGE));
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);

  const paginatedTrophies = useMemo(() => {
    const startIndex = (safeCurrentPage - 1) * ITEMS_PER_PAGE;
    return trophies.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [trophies, safeCurrentPage]);

  const paginatedXpEvents = useMemo(() => {
    const startIndex = (safeCurrentPage - 1) * ITEMS_PER_PAGE;
    return xpEvents.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [xpEvents, safeCurrentPage]);

  const isEmpty = totalItems === 0;

  const itemStart = totalItems > 0 ? (safeCurrentPage - 1) * ITEMS_PER_PAGE + 1 : 0;
  const itemEnd = Math.min(safeCurrentPage * ITEMS_PER_PAGE, totalItems);

  // Generate page buttons array
  const pageNumbers = useMemo(() => {
    const pages: (number | string)[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      if (safeCurrentPage <= 4) {
        pages.push(1, 2, 3, 4, 5, "...", totalPages);
      } else if (safeCurrentPage >= totalPages - 3) {
        pages.push(1, "...", totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
      } else {
        pages.push(1, "...", safeCurrentPage - 1, safeCurrentPage, safeCurrentPage + 1, "...", totalPages);
      }
    }
    return pages;
  }, [totalPages, safeCurrentPage]);

  return (
    <section
      className="rounded-2xl border border-white/10 bg-black/40 p-4 backdrop-blur shadow-[0_8px_32px_rgba(0,0,0,0.4)]"
      aria-label={copy.title}
    >
      {/* Header with Title and Tabs */}
      <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Trophy className="h-4 w-4 text-white" />
          <h2 className="text-sm font-black uppercase tracking-wider text-white">
            {copy.title}
          </h2>
        </div>
        <div className="flex items-center gap-1" role="tablist">
          {(["trophies", "xp"] as Tab[]).map((id) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              onClick={() => handleTabChange(id)}
              className={`rounded-full px-3.5 py-1 text-xs font-bold uppercase tracking-wide transition-all active:scale-95 ${
                tab === id
                  ? "bg-white text-black shadow-md"
                  : "bg-white/5 text-white/70 hover:bg-white/10 hover:text-white"
              }`}
            >
              {id === "trophies" ? copy.tabTrophies : copy.tabXp}
            </button>
          ))}
        </div>
      </header>

      {/* Filters & Actions Bar */}
      <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-white/70">
        <Filter className="h-3.5 w-3.5" />
        {tab === "trophies" ? (
          <label className="flex items-center gap-1">
            <span>{copy.tierFilter}:</span>
            <select
              className="rounded bg-white/5 px-2 py-1 text-white outline-none border border-white/10"
              value={tier ?? ""}
              onChange={(e) => handleTierChange((e.target.value || null) as TrophyTier | null)}
            >
              <option value="" className="bg-[#121214] text-white">{copy.allTiers}</option>
              {TIER_ORDER.map((t) => (
                <option key={t} value={t} className="bg-[#121214] text-white">
                  {TIER_LABELS[t]}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <label className="flex items-center gap-1">
          <Calendar className="h-3.5 w-3.5" />
          <span>{copy.since}</span>
          <input
            type="date"
            className="rounded bg-white/5 px-2 py-1 text-white outline-none border border-white/10"
            value={since ? since.slice(0, 10) : ""}
            onChange={(e) => handleSinceChange(e.target.value ? new Date(e.target.value).toISOString() : null)}
          />
        </label>
        <label className="flex items-center gap-1">
          <span>{copy.until}</span>
          <input
            type="date"
            className="rounded bg-white/5 px-2 py-1 text-white outline-none border border-white/10"
            value={until ? until.slice(0, 10) : ""}
            onChange={(e) => handleUntilChange(e.target.value ? new Date(e.target.value).toISOString() : null)}
          />
        </label>
        <button
          type="button"
          className="rounded bg-white/5 px-2.5 py-1 text-white/70 hover:bg-white/10 transition active:scale-95 border border-white/10"
          onClick={handleClearFilters}
        >
          {copy.clear}
        </button>
        <button
          type="button"
          className="ml-auto flex items-center gap-1.5 rounded bg-white/5 px-3 py-1 text-white/80 hover:bg-white/10 transition active:scale-95 border border-white/10 disabled:opacity-50"
          onClick={() => void reload()}
          disabled={loading}
          aria-label={copy.refresh}
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          <span>{copy.refresh}</span>
        </button>
      </div>

      {error ? (
        <p className="rounded border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {error}
        </p>
      ) : null}

      {isEmpty && !loading && !error ? (
        <p className="rounded border border-white/10 bg-white/5 px-3 py-6 text-center text-sm text-white/60">
          {copy.empty}
        </p>
      ) : null}

      {/* 10 Items per Page List with Smooth Transition */}
      <AnimatePresence mode="wait">
        <motion.ol
          key={`${tab}-${safeCurrentPage}-${tier || "all"}`}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.15 }}
          className="space-y-2"
        >
          {tab === "trophies"
            ? paginatedTrophies.map((t, idx) => (
                <TimelineTrophyRow key={t.id} trophy={t} idx={idx} />
              ))
            : paginatedXpEvents.map((e, idx) => (
                <TimelineXpRow key={e.id} event={e} idx={idx} copy={copy} />
              ))}
        </motion.ol>
      </AnimatePresence>

      {/* Pagination Footer Controls */}
      {totalPages > 1 && (
        <footer className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-white/10 pt-3">
          <p className="text-xs text-white/40">
            {copy.showing(itemStart, itemEnd, totalItems, tab === "trophies" ? "troféus" : "eventos")}
          </p>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={safeCurrentPage === 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-bold text-white/70 hover:bg-white/10 hover:text-white transition disabled:opacity-30 disabled:pointer-events-none active:scale-95"
            >
              <ChevronLeft className="h-3.5 w-3.5" /> Anterior
            </button>

            <div className="flex items-center gap-1">
              {pageNumbers.map((page, i) =>
                page === "..." ? (
                  <span key={`ellipsis-${i}`} className="px-1.5 text-xs text-white/30">
                    …
                  </span>
                ) : (
                  <button
                    key={`page-${page}`}
                    type="button"
                    onClick={() => setCurrentPage(Number(page))}
                    className={`min-w-[28px] h-7 rounded-lg text-xs font-bold transition active:scale-95 ${
                      safeCurrentPage === page
                        ? "bg-white text-black font-black shadow-sm"
                        : "border border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    {page}
                  </button>
                )
              )}
            </div>

            <button
              type="button"
              disabled={safeCurrentPage === totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-bold text-white/70 hover:bg-white/10 hover:text-white transition disabled:opacity-30 disabled:pointer-events-none active:scale-95"
            >
              Próxima <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </footer>
      )}
    </section>
  );
};

export default TrophyHistoryTimeline;
