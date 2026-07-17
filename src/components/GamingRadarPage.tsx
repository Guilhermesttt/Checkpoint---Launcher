import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  AlertCircle,
  ExternalLink,
  Newspaper,
  RefreshCw,
  Radio,
  Users,
} from "lucide-react";
import { apiUrl } from "../services/api";
import { useGamepadNavigation } from "../hooks/useGamepadNavigation";

interface GamingNewsItem {
  id: string;
  title: string;
  url: string;
  summary: string;
  imageUrl?: string;
  publishedAt: string;
  source: string;
}

interface NewsPayload {
  items?: GamingNewsItem[];
  sources?: Array<{ name: string; available: boolean }>;
  stale?: boolean;
  error?: string;
}

const openExternal = async (url: string) => {
  if (window.electronAPI?.openExternalUrl) {
    await window.electronAPI.openExternalUrl(url);
    return;
  }
  window.open(url, "_blank", "noopener,noreferrer");
};

const relativeTime = (date: string) => {
  const timestamp = Date.parse(date);
  if (Number.isNaN(timestamp)) return "";
  const minutes = Math.max(0, Math.round((Date.now() - timestamp) / 60_000));
  if (minutes < 60) return `há ${minutes || 1} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `há ${hours}h`;
  return `há ${Math.round(hours / 24)}d`;
};

const GamingRadarPage: React.FC = () => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [items, setItems] = useState<GamingNewsItem[]>([]);
  const [sources, setSources] = useState<NewsPayload["sources"]>([]);
  const [activeSource, setActiveSource] = useState("Todas");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [stale, setStale] = useState(false);

  useGamepadNavigation({
    scrollRef: scrollRef as React.RefObject<HTMLElement>,
    scrollSpeed: 25,
    disableX: true,
    disableO: true,
  });

  const loadNews = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(apiUrl("/api/gaming/news"));
      const payload = await response.json() as NewsPayload;
      if (!response.ok) throw new Error(payload.error || "Não foi possível carregar as notícias.");
      setItems(Array.isArray(payload.items) ? payload.items : []);
      setSources(payload.sources || []);
      setStale(Boolean(payload.stale));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Não foi possível carregar as notícias.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => void loadNews(), 0);
    return () => window.clearTimeout(timeout);
  }, [loadNews]);

  const visibleItems = useMemo(
    () => activeSource === "Todas"
      ? items
      : items.filter((item) => item.source === activeSource),
    [activeSource, items],
  );

  return (
    <motion.div
      ref={scrollRef}
      data-system-page
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative flex-1 overflow-y-auto px-8 pb-12 pt-6 thin-scrollbar"
    >
      <div className="pointer-events-none fixed inset-0 opacity-25" style={{
        backgroundImage: "radial-gradient(circle, rgba(255,255,255,.28) 1px, transparent 1px)",
        backgroundSize: "20px 20px",
        maskImage: "linear-gradient(120deg, black, transparent 70%)",
      }} />

      <div className="relative mx-auto max-w-6xl">
        <header className="mb-6 flex flex-col justify-between gap-4 rounded-[28px] border border-white/10 bg-black/65 p-6 md:flex-row md:items-center">
          <div>
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.24em] text-white/35">
              <Radio className="h-3.5 w-3.5" /> Atualizações do mundo gamer
            </div>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-white">Radar Gamer</h1>
            <p className="mt-2 max-w-xl text-sm text-white/40">
              Notícias reunidas em um só lugar.
            </p>
          </div>
          <button
            type="button"
            disabled={loading}
            onClick={() => void loadNews()}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/12 bg-white/[0.06] px-4 py-2.5 text-xs font-black text-white/65 hover:bg-white/12 hover:text-white disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Atualizar
          </button>
        </header>

        <div className="mb-5 flex flex-wrap gap-2">
          {["Todas", ...(sources || []).filter((source) => source.available).map((source) => source.name)].map((source) => (
            <button
              key={source}
              type="button"
              onClick={() => setActiveSource(source)}
              className={`rounded-xl border px-3 py-2 text-[10px] font-black uppercase tracking-wider transition ${activeSource === source
                  ? "border-white bg-white text-black"
                  : "border-white/10 bg-white/[0.04] text-white/40 hover:text-white"
                }`}
            >
              {source}
            </button>
          ))}
          {stale && <span className="self-center text-[10px] font-bold text-amber-200/60">Exibindo o último cache disponível</span>}
        </div>

        {error ? (
          <div className="flex min-h-72 flex-col items-center justify-center rounded-[26px] border border-red-300/15 bg-red-300/[0.04] text-center">
            <AlertCircle className="mb-3 h-8 w-8 text-red-200/45" />
            <p className="font-black text-white/65">Radar temporariamente indisponível</p>
            <p className="mt-1 text-xs text-white/35">{error}</p>
          </div>
        ) : loading && !items.length ? (
          <div className="grid gap-4 md:grid-cols-2">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="h-56 animate-pulse rounded-[24px] border border-white/8 bg-white/[0.04]" />
            ))}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {visibleItems.map((item, index) => (
              <motion.button
                key={item.id}
                type="button"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(index * 0.025, 0.25) }}
                onClick={() => void openExternal(item.url)}
                className="group overflow-hidden rounded-[24px] border border-white/10 bg-black/60 text-left shadow-[0_20px_60px_rgba(0,0,0,.3)] transition hover:-translate-y-0.5 hover:border-white/20 hover:bg-black/75"
              >
                {item.imageUrl ? (
                  <div className="h-40 overflow-hidden bg-white/[0.04]">
                    <img src={item.imageUrl} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-full w-full object-cover opacity-75 transition duration-500 group-hover:scale-[1.03] group-hover:opacity-95" />
                  </div>
                ) : (
                  <div className="flex h-24 items-center justify-center bg-white/[0.035]">
                    <Newspaper className="h-7 w-7 text-white/15" />
                  </div>
                )}
                <div className="p-5">
                  <div className="mb-2 flex items-center justify-between text-[9px] font-black uppercase tracking-[0.18em] text-white/30">
                    <span>{item.source}</span>
                    <span>{relativeTime(item.publishedAt)}</span>
                  </div>
                  <h2 className="line-clamp-2 text-base font-black leading-snug text-white/85 group-hover:text-white">{item.title}</h2>
                  {item.summary && <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-white/35">{item.summary}</p>}
                  <span className="mt-4 inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-white/45 group-hover:text-white">
                    Ler matéria <ExternalLink className="h-3 w-3" />
                  </span>
                </div>
              </motion.button>
            ))}
          </div>
        )}

        <section className="mt-6 rounded-[26px] border border-white/10 bg-black/55 p-5">
          <div className="mb-4 flex items-center gap-2">
            <Users className="h-4 w-4 text-white/35" />
            <h2 className="text-[10px] font-black uppercase tracking-[0.22em] text-white/35">Comunidades para discutir</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <button type="button" onClick={() => void openExternal("https://forum.adrenaline.com.br/")} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-left hover:bg-white/[0.08]">
              <p className="text-sm font-black text-white/75">Fórum Adrenaline</p>
              <p className="mt-1 text-xs text-white/30">Hardware, lançamentos e discussões da comunidade.</p>
            </button>
            <button type="button" onClick={() => void openExternal("https://steamcommunity.com/discussions/")} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-left hover:bg-white/[0.08]">
              <p className="text-sm font-black text-white/75">Discussões Steam</p>
              <p className="mt-1 text-xs text-white/30">Fóruns organizados por jogo e pela comunidade Steam.</p>
            </button>
          </div>
        </section>
      </div>
    </motion.div>
  );
};

export default GamingRadarPage;
