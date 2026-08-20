import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  AlertCircle,
  ExternalLink,
  Newspaper,
  RefreshCw,
  Radio,
  Users,
  Layers,
  Flame,
} from "lucide-react";
import { apiUrl } from "../services/api";
import { useGamepadNavigation } from "../hooks/useGamepadNavigation";
import { usePreferences, type LauncherLanguage } from "../context/PreferencesContext";
import { PerspectiveGrid } from "./ui/PerspectiveGrid";
import { NewsCard } from "./ui/NewsCard";
import { MetricMiniCard } from "./ui/MetricMiniCard";

const proxyImage = (url?: string) => {
  if (!url) return "";
  return apiUrl(`/api/proxy/image?url=${encodeURIComponent(url)}`);
};

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

const radarCopy: Record<LauncherLanguage, {
  eyebrow: string; title: string; subtitle: string; refresh: string; all: string;
  stale: string; unavailable: string; loadError: string; read: string;
  communities: string; adrenaline: string; steam: string;
}> = {
  "pt-BR": { eyebrow: "Atualizações do mundo gamer", title: "Radar Gamer", subtitle: "Feed centralizado de notícias e novidades da indústria gamer.", refresh: "Atualizar", all: "Todas as Fontes", stale: "Exibindo cache offline", unavailable: "Radar temporariamente indisponível", loadError: "Não foi possível carregar as notícias.", read: "Ler matéria", communities: "Comunidades e Fóruns", adrenaline: "Hardware, análises, lançamentos e debates da comunidade.", steam: "Fóruns globais organizados por jogo e comunidade Steam." },
  "en-US": { eyebrow: "Gaming world updates", title: "Gaming Radar", subtitle: "Centralized feed for gaming industry news and releases.", refresh: "Refresh", all: "All Sources", stale: "Showing offline cache", unavailable: "Radar temporarily unavailable", loadError: "Could not load the news.", read: "Read article", communities: "Communities and Forums", adrenaline: "Hardware, reviews, releases, and community debates.", steam: "Global forums organized by game and the Steam community." },
  "es-ES": { eyebrow: "Actualizaciones del mundo gamer", title: "Radar Gamer", subtitle: "Feed centralizado de noticias y novedades de la industria.", refresh: "Actualizar", all: "Todas las Fuentes", stale: "Mostrando caché offline", unavailable: "Radar temporalmente no disponible", loadError: "No se pudieron cargar las noticias.", read: "Leer artículo", communities: "Comunidades y Foros", adrenaline: "Hardware, análisis, lanzamientos y debates comunitarios.", steam: "Foros globales organizados por juego y por la comunidad Steam." },
  "fr-FR": { eyebrow: "Actualités du monde du jeu", title: "Radar Gaming", subtitle: "Flux centralisé des actualités et sorties du jeu vidéo.", refresh: "Actualiser", all: "Toutes les sources", stale: "Affichage du cache hors-ligne", unavailable: "Radar temporairement indisponible", loadError: "Impossible de charger les actualités.", read: "Lire l’article", communities: "Communautés et Forums", adrenaline: "Matériel, tests, sorties et débats communautaires.", steam: "Forums mondiaux par jeu et communauté Steam." },
  "de-DE": { eyebrow: "Neuigkeiten aus der Gaming-Welt", title: "Gaming-Radar", subtitle: "Zentraler Feed für Neuigkeiten und Veröffentlichungen.", refresh: "Aktualisieren", all: "Alle Quellen", stale: "Offline-Cache wird angezeigt", unavailable: "Radar vorübergehend nicht verfügbar", loadError: "Nachrichten konnten nicht geladen werden.", read: "Artikel lesen", communities: "Communitys und Foren", adrenaline: "Hardware, Tests, Neuerscheinungen und Diskussionen.", steam: "Foren nach Spiel und Steam-Community geordnet." },
  "it-IT": { eyebrow: "Aggiornamenti dal mondo gaming", title: "Radar Gaming", subtitle: "Feed centralizzato di notizie e uscite del mondo gaming.", refresh: "Aggiorna", all: "Tutte le fonti", stale: "Visualizzazione cache offline", unavailable: "Radar temporaneamente non disponibile", loadError: "Impossibile caricare le notizie.", read: "Leggi articolo", communities: "Community e Forum", adrenaline: "Hardware, recensioni, uscite e discussioni della community.", steam: "Forum organizzati per jogo e dalla community Steam." },
};

const relativeTime = (date: string, language: LauncherLanguage) => {
  const timestamp = Date.parse(date);
  if (Number.isNaN(timestamp)) return "";
  const minutes = Math.max(0, Math.round((Date.now() - timestamp) / 60_000));
  const formatter = new Intl.RelativeTimeFormat(language, { numeric: "always", style: "narrow" });
  if (minutes < 60) return formatter.format(-(minutes || 1), "minute");
  const hours = Math.round(minutes / 60);
  if (hours < 24) return formatter.format(-hours, "hour");
  return formatter.format(-Math.round(hours / 24), "day");
};

const GamingRadarPage: React.FC = () => {
  const { language } = usePreferences();
  const copy = radarCopy[language];
  const scrollRef = useRef<HTMLDivElement>(null);
  const [items, setItems] = useState<GamingNewsItem[]>([]);
  const [sources, setSources] = useState<NewsPayload["sources"]>([]);
  const [activeSource, setActiveSource] = useState("__all__");
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
      if (!response.ok) throw new Error(payload.error || copy.loadError);
      setItems(Array.isArray(payload.items) ? payload.items : []);
      setSources(payload.sources || []);
      setStale(Boolean(payload.stale));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : copy.loadError);
    } finally {
      setLoading(false);
    }
  }, [copy.loadError]);

  useEffect(() => {
    const timeout = window.setTimeout(() => void loadNews(), 0);
    return () => window.clearTimeout(timeout);
  }, [loadNews]);

  const visibleItems = useMemo(
    () => activeSource === "__all__"
      ? items
      : items.filter((item) => item.source === activeSource),
    [activeSource, items],
  );

  const activeSourcesCount = (sources || []).filter((s) => s.available).length;

  return (
    <motion.div
      ref={scrollRef}
      data-system-page
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative flex-1 overflow-y-auto px-8 pb-14 pt-6 thin-scrollbar"
    >
      <div className="relative mx-auto max-w-6xl space-y-6">
        {/* Header with subtle dot perspective grid background */}
        <header className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0A0A0A]/90 p-6 md:p-8 shadow-[0_20px_60px_rgba(0,0,0,0.5)] backdrop-blur-2xl">
          <PerspectiveGrid opacity={0.2} dotSize={1.2} gap={22} />

          <div className="relative flex flex-col justify-between gap-6 md:flex-row md:items-center">
            <div>
              <div className="flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.24em] text-white/40">
                <Radio className="h-3.5 w-3.5" />
                <span>[{copy.eyebrow}]</span>
              </div>
              <h1 className="mt-2 text-3xl md:text-4xl font-black tracking-tight text-white uppercase">
                {copy.title}
              </h1>
              <p className="mt-2 max-w-xl text-xs md:text-sm font-medium leading-relaxed text-white/40 font-body">
                {copy.subtitle}
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-3">
              <button
                type="button"
                disabled={loading}
                onClick={() => void loadNews()}
                className="cursor-pointer inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[0.06] px-4 py-2.5 text-xs font-black uppercase tracking-wider text-white shadow-md transition-all hover:border-white/30 hover:bg-white/[0.12] disabled:opacity-50 active:scale-95"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
                <span>{copy.refresh}</span>
              </button>
            </div>
          </div>

          {/* Metric Bar in Dashboard style */}
          <div className="relative mt-6 grid grid-cols-2 gap-3.5 sm:grid-cols-3 border-t border-white/[0.06] pt-6">
            <MetricMiniCard
              label="Notícias Carregadas"
              value={items.length}
              icon={<Newspaper className="h-4 w-4" />}
              hint="Artigos mais recentes"
            />
            <MetricMiniCard
              label="Fontes Ativas"
              value={activeSourcesCount || "Auto"}
              icon={<Layers className="h-4 w-4" />}
              hint="Agregadores configurados"
            />
            <MetricMiniCard
              label="Status do Feed"
              value={stale ? "Cache" : "Live"}
              icon={<Flame className="h-4 w-4" />}
              hint={stale ? copy.stale : "Conexão em tempo real"}
            />
          </div>
        </header>

        {/* Source Filter Tags */}
        <div className="flex flex-wrap items-center gap-2">
          {["__all__", ...(sources || []).filter((source) => source.available).map((source) => source.name)].map((source) => (
            <button
              key={source}
              type="button"
              onClick={() => setActiveSource(source)}
              className={`cursor-pointer rounded-xl border px-3.5 py-2 font-mono text-[10px] font-bold uppercase tracking-wider transition-all ${
                activeSource === source
                  ? "border-white bg-white text-black shadow-md"
                  : "border-white/[0.08] bg-[#0E0E0E] text-white/50 hover:border-white/20 hover:text-white"
              }`}
            >
              {source === "__all__" ? copy.all : source}
            </button>
          ))}
          {stale && (
            <span className="self-center font-mono text-[10px] font-bold text-amber-300/70">
              [{copy.stale}]
            </span>
          )}
        </div>

        {/* News Grid */}
        {error ? (
          <div className="flex min-h-72 flex-col items-center justify-center rounded-2xl border border-red-500/20 bg-red-500/[0.04] p-8 text-center">
            <AlertCircle className="mb-3 h-8 w-8 text-red-400/60" />
            <p className="font-black text-white/80">{copy.unavailable}</p>
            <p className="mt-1 text-xs text-white/40">{error}</p>
          </div>
        ) : loading && !items.length ? (
          <div className="grid gap-4 md:grid-cols-2">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="h-64 animate-pulse rounded-2xl border border-white/[0.06] bg-[#0E0E0E]" />
            ))}
          </div>
        ) : (
          <div className="grid gap-5 md:grid-cols-2">
            {visibleItems.map((item) => (
              <NewsCard
                key={item.id}
                title={item.title}
                source={item.source}
                publishedAt={relativeTime(item.publishedAt, language)}
                summary={item.summary}
                imageUrl={proxyImage(item.imageUrl)}
                url={item.url}
                readLabel={copy.read}
                onOpen={() => void openExternal(item.url)}
              />
            ))}
          </div>
        )}

        {/* Communities Section with clean monochrome cards */}
        <section className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0A0A0A]/90 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.5)] backdrop-blur-2xl">
          <div className="mb-4 flex items-center gap-2">
            <Users className="h-4 w-4 text-white/40" />
            <h2 className="text-[10px] font-black uppercase tracking-[0.24em] text-white/40 font-body">
              {copy.communities}
            </h2>
          </div>
          <div className="grid gap-3.5 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => void openExternal("https://forum.adrenaline.com.br/")}
              className="cursor-pointer group rounded-xl border border-white/[0.08] bg-[#0E0E0E] p-4.5 text-left transition-all duration-200 hover:border-white/25 hover:bg-[#151515]"
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-white tracking-tight group-hover:text-white">
                  Fórum Adrenaline
                </p>
                <ExternalLink className="h-3.5 w-3.5 text-white/30 group-hover:text-white transition-colors" />
              </div>
              <p className="mt-1 text-xs text-white/40 font-body leading-relaxed">
                {copy.adrenaline}
              </p>
            </button>

            <button
              type="button"
              onClick={() => void openExternal("https://steamcommunity.com/discussions/")}
              className="cursor-pointer group rounded-xl border border-white/[0.08] bg-[#0E0E0E] p-4.5 text-left transition-all duration-200 hover:border-white/25 hover:bg-[#151515]"
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-white tracking-tight group-hover:text-white">
                  Discussões Steam
                </p>
                <ExternalLink className="h-3.5 w-3.5 text-white/30 group-hover:text-white transition-colors" />
              </div>
              <p className="mt-1 text-xs text-white/40 font-body leading-relaxed">
                {copy.steam}
              </p>
            </button>
          </div>
        </section>
      </div>
    </motion.div>
  );
};

export default GamingRadarPage;
