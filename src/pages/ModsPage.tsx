import React, { useState, useMemo, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  PackageOpen,
  Search,
  ChevronDown,
  LayoutGrid,
  ListFilter,
  CheckCircle2,
  Download,
  FolderSync,
  Activity,
  Layers,
  Sparkles,
  MoreVertical,
  ShieldCheck,
  RefreshCw,
  FolderOpen,
  ArrowUpRight,
  Power,
  Trash2,
  Settings,
  Check,
  AlertCircle,
  ExternalLink,
} from "lucide-react";
import type { Game } from "../types/domain";
import { usePreferences } from "../context/PreferencesContext";
import { useSoundEffects } from "../hooks/useSoundEffects";
import ModGameDetailPanel, {
  type InstalledModEntry,
} from "../components/mods/ModGameDetailPanel";

interface ModsPageProps {
  uid: string;
  games: Game[];
}

const storageKeys = {
  folders: (uid: string) => `checkpoint_mod_game_folders_${uid}`,
  domains: (uid: string) => `checkpoint_mod_game_domains_${uid}`,
  installed: (uid: string) => `checkpoint_installed_mods_${uid}`,
};

const readRecord = <T,>(key: string): Record<string, T> => {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "{}");
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  } catch {
    return {};
  }
};

const normalizeInstalledMods = (
  record: Record<string, InstalledModEntry[]>,
): Record<string, InstalledModEntry[]> =>
  Object.fromEntries(
    Object.entries(record).map(([gameId, mods]) => [
      gameId,
      (Array.isArray(mods) ? mods : []).map((mod) => {
        if (mod.enabled && !mod.manifestPath) {
          return { ...mod, enabled: false, status: "downloaded" as const };
        }
        return mod;
      }),
    ]),
  );

type ModSubTab =
  | "BIBLIOTECA"
  | "MEUS_MODS"
  | "INSTALADOS"
  | "ATUALIZACOES"
  | "CONFIGURACOES";

export const getGameArtwork = (game: Game): string => {
  if (game.cardImage) return game.cardImage;
  if (game.image && (game.image.startsWith("http") || game.image.startsWith("data:"))) return game.image;
  if (game.backgroundImage) return game.backgroundImage;
  if (game.steamAppId) {
    return `https://cdn.cloudflare.steamstatic.com/steam/apps/${game.steamAppId}/header.jpg`;
  }
  return game.image || "";
};

export const ModsPage: React.FC<ModsPageProps> = ({ uid, games }) => {
  const { effectsVolume, soundTheme, notificationVolume } = usePreferences();
  const { playSound } = useSoundEffects(
    effectsVolume / 100,
    soundTheme,
    notificationVolume / 100,
  );

  const [activeTab, setActiveTab] = useState<ModSubTab>("BIBLIOTECA");
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [sortOrder, setSortOrder] = useState<"AZ" | "ZA" | "MODS">("AZ");
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);

  const [gameFolders, setGameFolders] = useState<Record<string, string>>(() =>
    readRecord<string>(storageKeys.folders(uid)),
  );
  const [gameDomains, setGameDomains] = useState<Record<string, string>>(() =>
    readRecord<string>(storageKeys.domains(uid)),
  );
  const [installedByGame, setInstalledByGame] = useState<
    Record<string, InstalledModEntry[]>
  >(() =>
    normalizeInstalledMods(
      readRecord<InstalledModEntry[]>(storageKeys.installed(uid)),
    ),
  );

  const [activeModProfile, setActiveModProfile] = useState<string>(() =>
    localStorage.getItem(storageKeys.activeProfile(uid)) || "Equilibrado",
  );

  useEffect(() => {
    localStorage.setItem(
      storageKeys.installed(uid),
      JSON.stringify(installedByGame),
    );
  }, [installedByGame, uid]);

  const chooseGameFolder = async (game: Game) => {
    if (!window.electronAPI?.selectModGameDirectory) return;
    const folder = await window.electronAPI.selectModGameDirectory(game.title);
    if (!folder) return;
    const next = { ...gameFolders, [game.id]: folder };
    setGameFolders(next);
    localStorage.setItem(storageKeys.folders(uid), JSON.stringify(next));
  };

  const saveGameDomain = (game: Game, domain: string) => {
    const next = { ...gameDomains, [game.id]: domain };
    setGameDomains(next);
    localStorage.setItem(storageKeys.domains(uid), JSON.stringify(next));
  };

  const toggleInstalledMod = (
    game: Game,
    modId: string,
    enabled: boolean,
  ) => {
    const nextForGame: InstalledModEntry[] = (
      installedByGame[game.id] || []
    ).map((mod) =>
      mod.id === modId
        ? {
            ...mod,
            enabled,
            status: enabled ? "installed" : "downloaded",
            ...(!enabled ? { manifestPath: undefined } : {}),
          }
        : mod,
    );
    const next = { ...installedByGame, [game.id]: nextForGame };
    setInstalledByGame(next);
    localStorage.setItem(storageKeys.installed(uid), JSON.stringify(next));
  };

  const removeInstalledMod = (game: Game, modId: string) => {
    const next = {
      ...installedByGame,
      [game.id]: (installedByGame[game.id] || []).filter((mod) => mod.id !== modId),
    };
    setInstalledByGame(next);
    localStorage.setItem(storageKeys.installed(uid), JSON.stringify(next));
  };

  const recordDownloadedMod = useCallback(
    (game: Game, mod: InstalledModEntry) => {
      setInstalledByGame((current) => {
        const currentForGame = current[game.id] || [];
        const existing = currentForGame.find((entry) => entry.id === mod.id);
        const mergedMod: InstalledModEntry = existing
          ? {
              ...existing,
              ...mod,
              name: mod.name || existing.name,
              author:
                mod.author === "Nexus Mods"
                  ? existing.author || mod.author
                  : mod.author,
              pictureUrl: mod.pictureUrl || existing.pictureUrl,
              version: mod.version || existing.version,
              status:
                existing.status === "installed" && mod.status === "downloaded"
                  ? "installed"
                  : mod.status,
              enabled:
                existing.status === "installed" && mod.status === "downloaded"
                  ? existing.enabled
                  : mod.enabled,
            }
          : mod;
        const nextForGame = [
          mergedMod,
          ...currentForGame.filter((entry) => entry.id !== mod.id),
        ];
        const next = { ...current, [game.id]: nextForGame };
        localStorage.setItem(storageKeys.installed(uid), JSON.stringify(next));
        return next;
      });
    },
    [uid],
  );

  const handleDownloadRecorded = useCallback(
    (mod: InstalledModEntry) => {
      if (selectedGame) recordDownloadedMod(selectedGame, mod);
    },
    [recordDownloadedMod, selectedGame],
  );

  const filteredGames = useMemo(() => {
    let list = [...games];
    const query = searchTerm.trim().toLowerCase();
    if (query) {
      list = list.filter((game) =>
        [game.title, game.category, game.launcherType]
          .join(" ")
          .toLowerCase()
          .includes(query),
      );
    }
    if (statusFilter === "WITH_MODS") {
      list = list.filter((game) => (installedByGame[game.id] || []).length > 0);
    }
    if (sortOrder === "AZ") {
      list.sort((a, b) => a.title.localeCompare(b.title));
    } else if (sortOrder === "ZA") {
      list.sort((a, b) => b.title.localeCompare(a.title));
    } else if (sortOrder === "MODS") {
      list.sort(
        (a, b) =>
          (installedByGame[b.id] || []).length -
          (installedByGame[a.id] || []).length,
      );
    }
    return list;
  }, [games, searchTerm, statusFilter, sortOrder, installedByGame]);

  const allInstalledModsList = useMemo(() => {
    const list: { game: Game; mod: InstalledModEntry }[] = [];
    games.forEach((game) => {
      const mods = installedByGame[game.id] || [];
      mods.forEach((mod) => {
        list.push({ game, mod });
      });
    });
    return list;
  }, [games, installedByGame]);

  const configuredGames = games.filter((game) => Boolean(gameFolders[game.id])).length;
  const totalInstalledMods = Object.values(installedByGame).flat().length;
  const activeInstalledMods = Object.values(installedByGame)
    .flat()
    .filter((m) => m.enabled).length;

  return (
    <div className="flex flex-col min-h-0 flex-1 overflow-y-auto px-8 pb-16 pt-4 font-sans select-none thin-scrollbar">
      <div className="mx-auto w-full max-w-7xl space-y-6">
        {/* Top Header Breadcrumb */}
        <div className="flex items-center gap-2 text-xs font-body font-semibold tracking-widest text-white/40 uppercase">
          <span>PHERIELIUM</span>
          <span>&gt;</span>
          <span className="text-white/80">MODS</span>
        </div>

        {/* Hero Banner Card */}
        <section className="relative overflow-hidden rounded-[32px] border border-white/[0.08] bg-[#090A0D]/95 p-6 md:p-8 shadow-[0_20px_60px_rgba(0,0,0,0.8)] backdrop-blur-2xl">
          {/* Subtle Cosmic Ambient Atmosphere */}
          <div className="pointer-events-none absolute right-1/4 top-1/2 -translate-y-1/2 h-64 w-64 rounded-full bg-white/[0.04] blur-[100px]" />

          <div className="relative flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div className="max-w-xl">
              <div className="mb-2.5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-3 py-1 text-[10.5px] font-bold tracking-wider text-white uppercase">
                <PackageOpen className="h-3.5 w-3.5 text-white" />
                <span>GERENCIADOR DE MODS</span>
              </div>
              <h1 className="text-2xl md:text-3xl font-display font-bold tracking-tight text-white">
                Nexus Mods & Personalizações
              </h1>
              <p className="mt-1.5 text-xs md:text-sm font-body text-white/50 leading-relaxed">
                Instale, atualize e gerencie mods de forma automática. Tudo centralizado. Tudo organizado. Tudo seu.
              </p>
            </div>

            {/* Orbit Atom Visual Animation */}
            <div className="hidden xl:flex relative items-center justify-center w-36 h-36">
              <div className="absolute inset-0 rounded-full border border-white/10 animate-spin" style={{ animationDuration: "14s" }} />
              <div className="absolute inset-3 rounded-full border border-white/20 rotate-45 animate-spin" style={{ animationDuration: "10s" }} />
              <div className="w-14 h-14 rounded-full bg-white/[0.08] border border-white/30 shadow-[0_0_30px_rgba(255,255,255,0.25)] flex items-center justify-center p-2.5">
                <img
                  src="/Pherielium_logo.png"
                  alt="Pherielium Hub"
                  className="w-full h-full object-contain filter drop-shadow-[0_0_10px_rgba(255,255,255,0.6)]"
                />
              </div>
            </div>

            {/* 3 Metric Counters */}
            <div className="grid grid-cols-3 gap-3 shrink-0">
              <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 min-w-[110px] text-left">
                <span className="text-[10px] font-body font-semibold text-white/40 uppercase tracking-wider block">
                  JOGOS
                </span>
                <span className="text-2xl font-display font-bold text-white block mt-0.5">
                  {games.length}
                </span>
                <span className="text-[10px] text-white/30">com mods</span>
              </div>
              <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 min-w-[110px] text-left">
                <span className="text-[10px] font-body font-semibold text-white/40 uppercase tracking-wider block">
                  MODS INSTALADOS
                </span>
                <span className="text-2xl font-display font-bold text-white block mt-0.5">
                  {activeInstalledMods || totalInstalledMods}
                </span>
                <span className="text-[10px] text-white/60">ativos</span>
              </div>
              <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 min-w-[110px] text-left">
                <span className="text-[10px] font-body font-semibold text-white/40 uppercase tracking-wider block">
                  ARQUIVOS
                </span>
                <span className="text-2xl font-display font-bold text-white block mt-0.5">
                  342
                </span>
                <span className="text-[10px] text-white/30">no total</span>
              </div>
            </div>
          </div>
        </section>

        {/* Sub-Tabs Bar */}
        <div className="flex flex-wrap items-center gap-1.5 rounded-2xl border border-white/[0.08] bg-[#090A0D]/90 backdrop-blur-xl p-1.5 shadow-lg">
          {[
            { id: "BIBLIOTECA" as const, label: "Biblioteca", icon: <Layers className="w-3.5 h-3.5" /> },
            { id: "MEUS_MODS" as const, label: "Meus Mods", icon: <PackageOpen className="w-3.5 h-3.5" /> },
            { id: "INSTALADOS" as const, label: "Instalados", icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
            { id: "ATUALIZACOES" as const, label: "Atualizações", badge: 6, icon: <RefreshCw className="w-3.5 h-3.5" /> },
            { id: "CONFIGURACOES" as const, label: "Configurações", icon: <ShieldCheck className="w-3.5 h-3.5" /> },
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onMouseEnter={() => playSound?.("hover")}
                onClick={() => {
                  playSound?.("select");
                  setActiveTab(tab.id);
                }}
                className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold uppercase tracking-wider transition-all duration-200 cursor-pointer ${
                  isActive
                    ? "bg-white text-black shadow-[0_0_15px_rgba(255,255,255,0.2)]"
                    : "text-white/60 hover:bg-white/[0.06] hover:text-white"
                }`}
              >
                {tab.icon}
                <span className="font-body">{tab.label}</span>
                {typeof tab.badge === "number" && (
                  <span
                    className={`ml-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9.5px] font-bold ${
                      isActive ? "bg-black text-white" : "bg-white/20 text-white"
                    }`}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Dynamic Tab Views */}
        {activeTab === "BIBLIOTECA" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Main Column: Games Grid & Discovery (8 Cols) */}
            <div className="lg:col-span-8 flex flex-col gap-6">
              {/* Search, Filter & Controls Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[#090A0D]/90 border border-white/[0.08] p-2.5 backdrop-blur-xl shadow-lg">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Buscar jogos..."
                    className="w-full h-10 pl-10 pr-4 rounded-xl bg-white/[0.04] border border-white/[0.06] text-xs font-body text-white placeholder:text-white/30 focus:outline-none focus:border-white/25 transition-all"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <div className="relative">
                    <select
                      value={categoryFilter}
                      onChange={(e) => setCategoryFilter(e.target.value)}
                      className="h-10 px-4 pr-8 rounded-xl bg-white/[0.04] border border-white/[0.06] text-xs font-body font-semibold text-white/80 focus:outline-none focus:border-white/25 cursor-pointer appearance-none"
                    >
                      <option value="ALL" className="bg-[#0c0d12] text-white">Todos os jogos</option>
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/40 pointer-events-none" />
                  </div>

                  <div className="relative">
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="h-10 px-4 pr-8 rounded-xl bg-white/[0.04] border border-white/[0.06] text-xs font-body font-semibold text-white/80 focus:outline-none focus:border-white/25 cursor-pointer appearance-none"
                    >
                      <option value="ALL" className="bg-[#0c0d12] text-white">Status</option>
                      <option value="WITH_MODS" className="bg-[#0c0d12] text-white">Com Mods</option>
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/40 pointer-events-none" />
                  </div>

                  <div className="relative">
                    <select
                      value={sortOrder}
                      onChange={(e) => setSortOrder(e.target.value as any)}
                      className="h-10 px-4 pr-8 rounded-xl bg-white/[0.04] border border-white/[0.06] text-xs font-body font-semibold text-white/80 focus:outline-none focus:border-white/25 cursor-pointer appearance-none"
                    >
                      <option value="AZ" className="bg-[#0c0d12] text-white">Ordenar: A - Z</option>
                      <option value="ZA" className="bg-[#0c0d12] text-white">Ordenar: Z - A</option>
                      <option value="MODS" className="bg-[#0c0d12] text-white">Mais Mods</option>
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/40 pointer-events-none" />
                  </div>

                  <div className="flex items-center gap-1 p-1 rounded-xl bg-white/[0.04] border border-white/[0.06]">
                    <button
                      type="button"
                      title="Visualização em Grade"
                      className="p-1.5 rounded-lg bg-white/10 text-white"
                    >
                      <LayoutGrid className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      title="Visualização em Lista"
                      className="p-1.5 rounded-lg text-white/40 hover:text-white"
                    >
                      <ListFilter className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Games Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                {filteredGames.map((game) => {
                  const gameMods = installedByGame[game.id] || [];
                  const activeMods = gameMods.filter((m) => m.enabled).length;
                  const artwork = getGameArtwork(game);

                  return (
                    <div
                      key={game.id}
                      className="group relative rounded-[24px] bg-[#090A0D]/90 border border-white/[0.08] hover:border-white/25 p-3.5 transition-all duration-200 hover:-translate-y-1 shadow-lg flex flex-col justify-between"
                    >
                      <div>
                        {/* Game Artwork Thumbnail */}
                        <div className="relative h-28 w-full rounded-2xl overflow-hidden bg-[#12131a] mb-3 border border-white/10">
                          {artwork ? (
                            <img
                              src={artwork}
                              alt={game.title}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-xs font-bold text-white/40 px-2 text-center">
                              {game.title}
                            </div>
                          )}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none" />
                          <button
                            type="button"
                            title="Opções"
                            onClick={() => setSelectedGame(game)}
                            className="absolute top-2 right-2 h-7 w-7 rounded-lg bg-black/60 hover:bg-black/80 text-white/70 hover:text-white flex items-center justify-center backdrop-blur-md cursor-pointer"
                          >
                            <MoreVertical className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* Title & Mod Count */}
                        <h3 className="text-sm font-display font-bold text-white truncate">
                          {game.title}
                        </h3>
                        <p className="text-[11px] font-body text-white/60 font-medium flex items-center gap-1.5 mt-0.5">
                          <span className="h-1.5 w-1.5 rounded-full bg-white/70 shadow-[0_0_6px_rgba(255,255,255,0.8)]" />
                          <span>{activeMods ? `${activeMods} mods ativos` : "Nenhum mod ativo"}</span>
                        </p>
                      </div>

                      {/* Manage Button */}
                      <div className="mt-4 pt-2 border-t border-white/[0.06]">
                        <button
                          type="button"
                          onMouseEnter={() => playSound?.("hover")}
                          onClick={() => {
                            playSound?.("select");
                            setSelectedGame(game);
                          }}
                          className="cursor-pointer w-full py-2 rounded-xl border border-white/20 bg-white/10 hover:bg-white/20 active:scale-98 text-white text-xs font-display font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1 shadow-sm"
                        >
                          <span>GERENCIAR</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Bottom Discovery Banner */}
              <div className="rounded-[28px] bg-[#090A0D]/90 border border-white/[0.08] p-5 flex flex-col sm:flex-row items-center justify-between gap-4 backdrop-blur-xl shadow-xl">
                <div className="flex items-center gap-3.5">
                  <div className="h-10 w-10 rounded-2xl bg-white/[0.08] border border-white/20 flex items-center justify-center text-white shrink-0">
                    <Sparkles className="w-5 h-5 animate-pulse" />
                  </div>
                  <div>
                    <h4 className="text-sm font-display font-bold text-white">
                      Descubra novos mods para seus jogos favoritos
                    </h4>
                    <p className="text-xs font-body text-white/50">
                      Navegue por milhares de mods incríveis disponíveis no Nexus Mods.
                    </p>
                  </div>
                </div>

                <a
                  href="https://www.nexusmods.com"
                  target="_blank"
                  rel="noreferrer"
                  onMouseEnter={() => playSound?.("hover")}
                  className="cursor-pointer shrink-0 px-5 py-2.5 rounded-full border border-white/20 bg-white/10 hover:bg-white/20 text-white text-xs font-body font-bold uppercase tracking-wider flex items-center gap-2 transition-all active:scale-95"
                >
                  <span>EXPLORAR NEXUS MODS</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>

            {/* Right Sidebar: Status do Sistema & Atividade & Perfil (4 Cols) */}
            <div className="lg:col-span-4 flex flex-col gap-5">
              {/* Panel 1: Status do Sistema (Sem sincronização) */}
              <div className="rounded-[28px] bg-[#090A0D]/90 border border-white/[0.08] p-5 shadow-xl backdrop-blur-2xl">
                <span className="text-[10.5px] font-body font-bold uppercase tracking-[0.2em] text-white/50 block mb-4">
                  STATUS DO SISTEMA
                </span>

                <div className="space-y-3">
                  <div className="flex items-center justify-between p-2.5 rounded-2xl bg-white/[0.02] border border-white/[0.04]">
                    <div className="flex items-center gap-2.5">
                      <CheckCircle2 className="w-4 h-4 text-white" />
                      <span className="text-xs font-semibold text-white">Nexus Mods</span>
                    </div>
                    <span className="text-xs font-bold text-white flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-white shadow-[0_0_6px_rgba(255,255,255,0.8)]" />
                      Conectado
                    </span>
                  </div>

                  <div className="flex items-center justify-between p-2.5 rounded-2xl bg-white/[0.02] border border-white/[0.04]">
                    <div className="flex items-center gap-2.5">
                      <Download className="w-4 h-4 text-white/60" />
                      <span className="text-xs font-semibold text-white">Downloads</span>
                    </div>
                    <span className="text-xs font-body text-white/40">0 ativos</span>
                  </div>

                  <div className="flex items-center justify-between p-2.5 rounded-2xl bg-white/[0.02] border border-white/[0.04]">
                    <div className="flex items-center gap-2.5">
                      <Layers className="w-4 h-4 text-white/60" />
                      <span className="text-xs font-semibold text-white">Instalações</span>
                    </div>
                    <span className="text-xs font-body text-white/40">0 em andamento</span>
                  </div>
                </div>
              </div>

              {/* Panel 2: Perfil de Mods */}
              <div className="rounded-[28px] bg-[#090A0D]/90 border border-white/[0.08] p-5 shadow-xl backdrop-blur-2xl">
                <span className="text-[10.5px] font-body font-bold uppercase tracking-[0.2em] text-white/50 block mb-4">
                  PERFIL DE MODS
                </span>

                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between text-xs font-body font-semibold mb-1.5">
                      <span className="text-white/60">Performance</span>
                      <span className="text-white">Equilibrado</span>
                    </div>
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5, 6].map((bar) => (
                        <div
                          key={bar}
                          className={`h-1.5 flex-1 rounded-full ${
                            bar <= 4 ? "bg-white shadow-[0_0_6px_rgba(255,255,255,0.6)]" : "bg-white/[0.08]"
                          }`}
                        />
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between text-xs font-body font-semibold mb-1.5">
                      <span className="text-white/60">Estabilidade</span>
                      <span className="text-white">Alto</span>
                    </div>
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5, 6].map((bar) => (
                        <div
                          key={bar}
                          className={`h-1.5 flex-1 rounded-full ${
                            bar <= 5 ? "bg-white shadow-[0_0_6px_rgba(255,255,255,0.6)]" : "bg-white/[0.08]"
                          }`}
                        />
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between text-xs font-body font-semibold mb-1.5">
                      <span className="text-white/60">Qualidade Visual</span>
                      <span className="text-white">Máximo</span>
                    </div>
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5, 6].map((bar) => (
                        <div
                          key={bar}
                          className={`h-1.5 flex-1 rounded-full ${
                            bar <= 6 ? "bg-white shadow-[0_0_6px_rgba(255,255,255,0.6)]" : "bg-white/[0.08]"
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab: MEUS MODS & INSTALADOS */}
        {(activeTab === "MEUS_MODS" || activeTab === "INSTALADOS") && (
          <div className="rounded-[28px] bg-[#090A0D]/90 border border-white/[0.08] p-6 shadow-xl backdrop-blur-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/[0.06] pb-4">
              <div>
                <h2 className="text-lg font-display font-bold text-white">
                  {activeTab === "INSTALADOS" ? "Mods Ativos & Instalados" : "Todos os Meus Mods"}
                </h2>
                <p className="text-xs font-body text-white/50">
                  Gerencie e ative mods instalados em todos os seus jogos cadastrados.
                </p>
              </div>
              <span className="px-3 py-1 rounded-xl bg-white/10 text-xs font-bold text-white">
                {allInstalledModsList.length} mods
              </span>
            </div>

            {allInstalledModsList.length === 0 ? (
              <div className="py-16 text-center text-white/40 space-y-2">
                <PackageOpen className="w-10 h-10 mx-auto opacity-40 mb-2" />
                <p className="text-sm font-semibold text-white/60">Nenhum mod instalado ainda</p>
                <p className="text-xs">Selecione um jogo na Biblioteca para gerenciar e instalar modificações.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {allInstalledModsList.map(({ game, mod }) => (
                  <div
                    key={`${game.id}-${mod.id}`}
                    className="flex items-center justify-between p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06] hover:border-white/20 transition-all"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="w-12 h-12 rounded-xl overflow-hidden bg-white/[0.05] border border-white/10 shrink-0">
                        {mod.pictureUrl ? (
                          <img src={mod.pictureUrl} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-white/40 font-bold text-xs">
                            MOD
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-white truncate">{mod.name}</p>
                        <p className="text-[11px] font-body text-white/40 truncate">
                          {game.title} · v{mod.version || "1.0"}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => toggleInstalledMod(game, mod.id, !mod.enabled)}
                        className={`p-2 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                          mod.enabled
                            ? "bg-white text-black border-white"
                            : "bg-white/[0.04] text-white/50 border-white/[0.08] hover:text-white"
                        }`}
                        title={mod.enabled ? "Desativar Mod" : "Ativar Mod"}
                      >
                        <Power className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeInstalledMod(game, mod.id)}
                        className="p-2 rounded-xl bg-white/[0.04] hover:bg-rose-500/20 text-white/40 hover:text-rose-400 border border-white/[0.08] hover:border-rose-500/30 transition-all cursor-pointer"
                        title="Desinstalar Mod"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab: ATUALIZAÇÕES */}
        {activeTab === "ATUALIZACOES" && (
          <div className="rounded-[28px] bg-[#090A0D]/90 border border-white/[0.08] p-6 shadow-xl backdrop-blur-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/[0.06] pb-4">
              <div>
                <h2 className="text-lg font-display font-bold text-white">Atualizações Disponíveis</h2>
                <p className="text-xs font-body text-white/50">
                  Verifique novas versões publicadas pelos criadores no Nexus Mods.
                </p>
              </div>
              <button
                type="button"
                className="px-4 py-2 rounded-xl bg-white text-black text-xs font-bold hover:bg-white/90 transition cursor-pointer"
              >
                Atualizar Todos
              </button>
            </div>

            <div className="space-y-3">
              {[
                { name: "Cyber Engine Tweaks", game: "Cyberpunk 2077", current: "v1.28", next: "v1.29", size: "12 MB" },
                { name: "HD Reworked Project NextGen", game: "The Witcher 3", current: "v11.0", next: "v12.0", size: "4.2 GB" },
                { name: "SkyUI 5.2 SE", game: "Skyrim Special Edition", current: "v5.1", next: "v5.2", size: "45 MB" },
              ].map((update, i) => (
                <div key={i} className="flex items-center justify-between p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
                  <div>
                    <h4 className="text-xs font-bold text-white">{update.name}</h4>
                    <p className="text-[11px] text-white/40 mt-0.5">
                      {update.game} · {update.current} &rarr; <span className="text-white font-semibold">{update.next}</span> ({update.size})
                    </p>
                  </div>
                  <button
                    type="button"
                    className="px-4 py-1.5 rounded-xl border border-white/20 bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition cursor-pointer"
                  >
                    Atualizar
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab: CONFIGURAÇÕES */}
        {activeTab === "CONFIGURACOES" && (
          <div className="rounded-[28px] bg-[#090A0D]/90 border border-white/[0.08] p-6 shadow-xl backdrop-blur-2xl space-y-6">
            <div className="border-b border-white/[0.06] pb-4">
              <h2 className="text-lg font-display font-bold text-white">Configurações do Nexus & Diretórios</h2>
              <p className="text-xs font-body text-white/50">
                Ajuste os caminhos de instalação local e sincronização da API do Nexus Mods.
              </p>
            </div>

            <div className="space-y-4 max-w-2xl">
              <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06] space-y-2">
                <label className="text-xs font-bold text-white block">Nexus Mods API Key</label>
                <input
                  type="password"
                  placeholder="nexus_api_key_..."
                  defaultValue="••••••••••••••••••••••••"
                  className="w-full h-10 px-4 rounded-xl bg-white/[0.04] border border-white/[0.08] text-xs font-mono text-white focus:outline-none focus:border-white/30"
                />
                <p className="text-[10.5px] text-white/40">Usado para baixar e verificar atualizações de mods automaticamente.</p>
              </div>

              <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06] flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-white">Instalação Automática de Dependências</h4>
                  <p className="text-[10.5px] text-white/40">Baixar frameworks e pré-requisitos ao adicionar mods.</p>
                </div>
                <input type="checkbox" defaultChecked className="accent-white h-4 w-4 cursor-pointer" />
              </div>
            </div>
          </div>
        )}

        {/* Selected Game Mod Detail Panel Modal */}
        {selectedGame && (
          <ModGameDetailPanel
            game={selectedGame}
            isOpen={Boolean(selectedGame)}
            onClose={() => setSelectedGame(null)}
            gameFolder={gameFolders[selectedGame.id]}
            onSelectGameFolder={() => void chooseGameFolder(selectedGame)}
            installedMods={installedByGame[selectedGame.id] || []}
            onToggleMod={(modId, enabled) =>
              toggleInstalledMod(selectedGame, modId, enabled)
            }
            onRemoveMod={(modId) => removeInstalledMod(selectedGame, modId)}
            nexusDomain={gameDomains[selectedGame.id]}
            onSaveNexusDomain={(domain) => saveGameDomain(selectedGame, domain)}
            onDownloadRecorded={handleDownloadRecorded}
          />
        )}
      </div>
    </div>
  );
};

export default ModsPage;
