import React from "react";
import { motion } from "framer-motion";
import {
  CheckCircle2,
  Gamepad2,
  PackageOpen,
  Search,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import type { Game } from "../types/domain";
import { usePreferences } from "../context/PreferencesContext";
import { useSoundEffects } from "../hooks/useSoundEffects";
import ModGameDetailPanel, {
  type InstalledModEntry,
} from "../components/mods/ModGameDetailPanel";

import { HudCornerMarkers, HudPanel } from "../components/ui/HudPanel";
import { MetricMiniCard } from "../components/ui/MetricMiniCard";
import { PerspectiveGrid } from "../components/ui/PerspectiveGrid";

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
): Record<string, InstalledModEntry[]> => Object.fromEntries(
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

const normalizeTitle = (title: string) =>
  title.toLocaleLowerCase("en-US").replace(/[^a-z0-9]+/g, " ").trim();

const suggestedDomains: Array<[RegExp, string]> = [
  [/skyrim.*special|skyrim se/, "skyrimspecialedition"],
  [/skyrim/, "skyrim"],
  [/fallout 4/, "fallout4"],
  [/fallout new vegas/, "newvegas"],
  [/cyberpunk 2077/, "cyberpunk2077"],
  [/grand theft auto v|gta v/, "gta5"],
  [/baldur s gate 3/, "baldursgate3"],
  [/stardew valley/, "stardewvalley"],
  [/witcher 3/, "witcher3"],
  [/elden ring/, "eldenring"],
  [/ready or not/, "readyornot"],
  [/starfield/, "starfield"],
  [/red dead redemption 2/, "reddeadredemption2"],
  [/hogwarts legacy/, "hogwartslegacy"],
];

const suggestNexusDomain = (title: string) => {
  const normalized = normalizeTitle(title);
  return suggestedDomains.find(([pattern]) => pattern.test(normalized))?.[1] || "";
};

const ModsPage: React.FC<ModsPageProps> = ({ uid, games }) => {
  const { effectsVolume, soundTheme, notificationVolume } = usePreferences();
  const { playSound } = useSoundEffects(
    effectsVolume / 100,
    soundTheme,
    notificationVolume / 100,
  );

  const [searchTerm, setSearchTerm] = React.useState("");
  const [selectedGame, setSelectedGame] = React.useState<Game | null>(null);
  const [gameFolders, setGameFolders] = React.useState<Record<string, string>>(
    () => readRecord<string>(storageKeys.folders(uid)),
  );
  const [gameDomains, setGameDomains] = React.useState<Record<string, string>>(
    () => readRecord<string>(storageKeys.domains(uid)),
  );
  const [installedByGame, setInstalledByGame] = React.useState<Record<string, InstalledModEntry[]>>(
    () => normalizeInstalledMods(readRecord<InstalledModEntry[]>(storageKeys.installed(uid))),
  );

  React.useEffect(() => {
    localStorage.setItem(storageKeys.installed(uid), JSON.stringify(installedByGame));
  }, [installedByGame, uid]);

  const filteredGames = React.useMemo(() => {
    const query = searchTerm.trim().toLocaleLowerCase("pt-BR");
    if (!query) return games;
    return games.filter((game) =>
      [game.title, game.category, game.launcherType]
        .join(" ")
        .toLocaleLowerCase("pt-BR")
        .includes(query));
  }, [games, searchTerm]);

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

  const toggleInstalledMod = (game: Game, modId: string, enabled: boolean) => {
    const nextForGame: InstalledModEntry[] = (installedByGame[game.id] || []).map((mod) =>
      mod.id === modId
        ? {
            ...mod,
            enabled,
            status: enabled ? "installed" : "downloaded",
            ...(!enabled ? { manifestPath: undefined } : {}),
          }
        : mod);
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

  const recordDownloadedMod = React.useCallback((game: Game, mod: InstalledModEntry) => {
    setInstalledByGame((current) => {
      const currentForGame = current[game.id] || [];
      const existing = currentForGame.find((entry) => entry.id === mod.id);
      const mergedMod: InstalledModEntry = existing ? {
        ...existing,
        ...mod,
        name: mod.name || existing.name,
        author: mod.author === "Nexus Mods" ? existing.author || mod.author : mod.author,
        pictureUrl: mod.pictureUrl || existing.pictureUrl,
        version: mod.version || existing.version,
        status: existing.status === "installed" && mod.status === "downloaded"
          ? "installed"
          : mod.status,
        enabled: existing.status === "installed" && mod.status === "downloaded"
          ? existing.enabled
          : mod.enabled,
      } : mod;
      const nextForGame = [
        mergedMod,
        ...currentForGame.filter((entry) => entry.id !== mod.id),
      ];
      const next = { ...current, [game.id]: nextForGame };
      localStorage.setItem(storageKeys.installed(uid), JSON.stringify(next));
      return next;
    });
  }, [uid]);

  const handleDownloadRecorded = React.useCallback((mod: InstalledModEntry) => {
    if (selectedGame) recordDownloadedMod(selectedGame, mod);
  }, [recordDownloadedMod, selectedGame]);

  const configuredGames = games.filter((game) => Boolean(gameFolders[game.id])).length;
  const installedCount = Object.values(installedByGame)
    .flat()
    .length;

  return (
    <>
      <motion.main
        data-system-page
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex min-h-0 flex-1 flex-col overflow-y-auto px-8 pb-14 pt-4 thin-scrollbar"
      >
        <div className="mx-auto w-full max-w-6xl space-y-6">
          {/* HUD Header Section */}
          <section className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0A0A0A]/95 p-6 md:p-8 shadow-[0_20px_60px_rgba(0,0,0,0.5)] backdrop-blur-2xl">
            <HudCornerMarkers />
            <PerspectiveGrid opacity={0.18} dotSize={1.2} gap={24} />

            <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <div className="mb-2.5 inline-flex items-center gap-2 rounded-md border border-white/15 bg-white/[0.04] px-2.5 py-1 font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-white/60">
                  <PackageOpen className="h-3 w-3" />
                  [MOD_MANAGER // SYS_V2]
                </div>
                <h1 className="text-2xl md:text-3xl font-black uppercase tracking-tight text-white">
                  Gerenciador de Mods
                </h1>
                <p className="mt-1.5 max-w-2xl text-xs md:text-sm font-medium leading-relaxed text-white/40 font-body">
                  Selecione um jogo para gerenciar pastas, catálogo do Nexus Mods e arquivos instalados.
                </p>
              </div>

              {/* HUD Summary Counters with monospace metrics */}
              <div className="grid grid-cols-3 gap-3">
                <MetricMiniCard
                  label="Jogos"
                  value={games.length}
                  isMono={true}
                  badge="TOTAL"
                  className="min-w-28 p-3.5"
                />
                <MetricMiniCard
                  label="Configurados"
                  value={configuredGames}
                  isMono={true}
                  badge="DIR"
                  className="min-w-28 p-3.5"
                />
                <MetricMiniCard
                  label="Mods"
                  value={installedCount}
                  isMono={true}
                  badge="INSTALLED"
                  className="min-w-28 p-3.5"
                />
              </div>
            </div>
          </section>

          {/* Games Grid Section with HUD styling */}
          <section className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0A0A0A]/90 p-6 md:p-7 shadow-[0_20px_60px_rgba(0,0,0,0.5)] backdrop-blur-2xl">
            <HudCornerMarkers />

            <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between border-b border-white/[0.06] pb-5">
              <div>
                <div className="flex items-center gap-2.5">
                  <Gamepad2 className="h-4 w-4 text-white/50" />
                  <h2 className="text-base font-black uppercase tracking-tight text-white">
                    Biblioteca de Jogos
                  </h2>
                </div>
                <p className="mt-0.5 text-xs font-medium text-white/40">
                  Selecione um título para abrir o painel de mods e integração com o Nexus.
                </p>
              </div>

              <div className="relative w-full md:w-72">
                <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
                <input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Buscar jogo..."
                  className="h-10 w-full rounded-xl border border-white/[0.08] bg-[#0E0E0E] pl-10 pr-3 font-mono text-xs text-white outline-none placeholder:text-white/20 focus:border-white/25 shadow-inner"
                />
              </div>
            </div>

            {filteredGames.length === 0 ? (
              <div className="flex min-h-64 flex-col items-center justify-center rounded-xl border border-dashed border-white/[0.08] bg-[#0E0E0E] px-6 text-center">
                <Gamepad2 className="mb-3 h-7 w-7 text-white/20" />
                <p className="text-sm font-bold text-white/50">
                  {games.length ? "Nenhum jogo encontrado" : "Sua biblioteca está vazia"}
                </p>
                <p className="mt-1 text-xs font-medium text-white/35">
                  {games.length ? "Tente outro termo na busca." : "Adicione um jogo antes de configurar seus mods."}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
                {filteredGames.map((game) => {
                  const folder = gameFolders[game.id];
                  const installed = installedByGame[game.id] || [];
                  const activeMods = installed.filter((mod) => mod.enabled).length;
                  const image = game.cardImage || game.image || game.backgroundImage;
                  const domain = gameDomains[game.id] || suggestNexusDomain(game.title);

                  return (
                    <button
                      key={game.id}
                      type="button"
                      onClick={() => {
                        playSound("detailOpen");
                        if (!gameDomains[game.id] && domain) {
                          saveGameDomain(game, domain);
                        }
                        setSelectedGame(game);
                      }}
                      className="cursor-pointer group relative overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0E0E0E] text-left shadow-[0_12px_36px_rgba(0,0,0,0.4)] transition-all duration-200 hover:-translate-y-1 hover:border-white/25 hover:bg-[#151515]"
                    >
                      <HudCornerMarkers className="opacity-0 group-hover:opacity-100 transition-opacity" />

                      {/* Standardized 16:9 thumbnail */}
                      <div className="relative aspect-video w-full overflow-hidden bg-[#171717]">
                        {image ? (
                          <img
                            src={image}
                            alt=""
                            className="h-full w-full object-cover opacity-80 transition duration-700 group-hover:scale-105 group-hover:opacity-100"
                            loading="lazy"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center">
                            <Gamepad2 className="h-8 w-8 text-white/15" />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-[#0E0E0E] via-transparent to-transparent opacity-80" />

                        {/* Badges on thumbnail */}
                        <div className="absolute left-2.5 top-2.5 flex flex-wrap gap-1.5">
                          {folder && (
                            <span className="flex h-5 items-center gap-1 rounded border border-emerald-500/30 bg-black/75 px-1.5 font-mono text-[8.5px] font-bold uppercase text-emerald-400 backdrop-blur-md">
                              <CheckCircle2 className="h-2.5 w-2.5" /> DIR
                            </span>
                          )}
                          {domain && (
                            <span className="flex h-5 items-center rounded border border-white/15 bg-black/75 px-1.5 font-mono text-[8.5px] font-bold uppercase text-white/70 backdrop-blur-md">
                              NEXUS
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Card Content with monospace details */}
                      <div className="p-4">
                        <p className="truncate text-xs md:text-sm font-bold text-white group-hover:text-white tracking-tight">
                          {game.title}
                        </p>
                        <div className="mt-1 flex items-center justify-between font-mono text-[10px] text-white/35">
                          <span className="uppercase">{game.launcherType || "LOCAL"}</span>
                          <span className="text-white/50">
                            {installed.length > 0
                              ? `[ ${activeMods}/${installed.length} MODS ]`
                              : "[ 0 MODS ]"}
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </motion.main>

      <ModGameDetailPanel
        key={selectedGame?.id || "closed"}
        game={selectedGame}
        isOpen={Boolean(selectedGame)}
        gameFolder={selectedGame ? gameFolders[selectedGame.id] || "" : ""}
        gameDomain={selectedGame
          ? gameDomains[selectedGame.id] || suggestNexusDomain(selectedGame.title)
          : ""}
        installedMods={selectedGame ? installedByGame[selectedGame.id] || [] : []}
        onClose={() => setSelectedGame(null)}
        onChooseFolder={async () => {
          if (selectedGame) await chooseGameFolder(selectedGame);
        }}
        onSaveDomain={(domain) => {
          if (selectedGame) saveGameDomain(selectedGame, domain);
        }}
        onToggleMod={(modId, enabled) => {
          if (selectedGame) toggleInstalledMod(selectedGame, modId, enabled);
        }}
        onRemoveMod={(modId) => {
          if (selectedGame) removeInstalledMod(selectedGame, modId);
        }}
        onDownloadRecorded={handleDownloadRecorded}
      />
    </>
  );
};

export default ModsPage;
