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
      // Versoes antigas marcavam o download como ativo mesmo sem um manifesto.
      // Nesse caso o Checkpoint so pode confirmar que o pacote foi baixado.
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
        className="flex min-h-0 flex-1 flex-col overflow-y-auto px-10 pb-10 pt-4 thin-scrollbar"
      >
        <div className="mx-auto w-full max-w-6xl space-y-5">
          <section className="relative overflow-hidden rounded-[28px] border border-white/10 bg-black/40 p-6 md:p-7 backdrop-blur-3xl shadow-[0_24px_90px_rgba(0,0,0,0.45)]">
            <div
              className="pointer-events-none absolute inset-0 opacity-60"
              style={{
                background:
                  "radial-gradient(circle at 82% 15%, rgb(var(--launcher-accent) / 0.24), transparent 36%)",
              }}
            />
            <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-3.5 py-1.5 text-[9px] font-black uppercase tracking-[0.2em] text-white/45">
                  <PackageOpen className="h-3.5 w-3.5" />
                  Biblioteca de mods
                </div>
                <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white">
                  Escolha um jogo para modificar
                </h1>
                <p className="mt-1.5 max-w-2xl text-xs md:text-sm font-medium leading-relaxed text-white/40">
                  Cada jogo possui seu próprio catálogo, pasta, mods instalados e controles.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <SummaryStat label="Jogos" value={games.length} />
                <SummaryStat label="Configurados" value={configuredGames} />
                <SummaryStat label="Mods" value={installedCount} />
              </div>
            </div>
          </section>

          <section className="rounded-[28px] border border-white/10 bg-black/40 p-6 md:p-7 backdrop-blur-3xl shadow-[0_20px_70px_rgba(0,0,0,0.35)]">
            <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="flex items-center gap-2.5">
                  <Gamepad2 className="h-4.5 w-4.5 text-white/50" />
                  <h2 className="text-base md:text-lg font-bold text-white tracking-tight">
                    Meus jogos
                  </h2>
                </div>
                <p className="mt-0.5 text-xs font-medium text-white/40">
                  Abra um card para explorar e gerenciar os mods daquele jogo.
                </p>
              </div>

              <div className="relative w-full md:w-72">
                <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
                <input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Buscar jogo"
                  className="h-11 w-full rounded-2xl border border-white/10 bg-white/[0.04] pl-10 pr-3 text-sm text-white outline-none placeholder:text-white/20 focus:border-white/25"
                />
              </div>
            </div>

            {filteredGames.length === 0 ? (
              <div className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-6 text-center">
                <Gamepad2 className="mb-3 h-7 w-7 text-white/15" />
                <p className="text-sm font-bold text-white/50">
                  {games.length ? "Nenhum jogo encontrado" : "Sua biblioteca está vazia"}
                </p>
                <p className="mt-1 text-xs font-medium text-white/40">
                  {games.length ? "Tente outro nome." : "Adicione um jogo antes de configurar seus mods."}
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
                      className="group overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.035] text-left shadow-[0_14px_40px_rgba(0,0,0,0.32)] transition duration-300 hover:-translate-y-1 hover:border-white/25 hover:bg-white/[0.07]"
                    >
                      <div className="relative h-36 overflow-hidden bg-white/[0.04]">
                        {image ? (
                          <img
                            src={image}
                            alt=""
                            className="h-full w-full object-cover transition duration-700 group-hover:scale-105"
                            loading="lazy"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center">
                            <Gamepad2 className="h-8 w-8 text-white/15" />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-linear-to-t from-black via-black/15 to-transparent" />
                        <div className="absolute left-3 top-3 flex gap-1.5">
                          {folder && (
                            <span className="flex h-6 items-center gap-1 rounded-lg border border-emerald-400/30 bg-emerald-500/20 px-2 text-[9px] font-black uppercase text-emerald-300 backdrop-blur-md">
                              <CheckCircle2 className="h-3 w-3" /> Pasta
                            </span>
                          )}
                          {domain && (
                            <span className="flex h-6 items-center gap-1 rounded-lg border border-white/15 bg-black/60 px-2 text-[9px] font-black uppercase text-white/70 backdrop-blur-md">
                              Nexus
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-between p-4">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-bold text-white group-hover:text-white">
                            {game.title}
                          </p>
                          <p className="mt-0.5 text-xs font-semibold uppercase tracking-wider text-white/35">
                            {game.launcherType || "local"}
                          </p>
                          <p className="mt-1 text-xs font-medium text-white/40">
                            {installed.length
                              ? `${activeMods} de ${installed.length} mods ativos`
                              : "Nenhum mod instalado"}
                          </p>
                        </div>
                        <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-white/30 transition group-hover:bg-white/10 group-hover:text-white">
                          <Sparkles className="h-4 w-4" />
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          <section className="flex items-center gap-3.5 rounded-2xl border border-amber-400/20 bg-amber-400/[0.06] p-4.5 backdrop-blur-2xl">
            <ShieldCheck className="h-5 w-5 shrink-0 text-amber-300/80" />
            <div>
              <p className="text-xs font-bold text-amber-100/80">Instalação de mods</p>
              <p className="mt-0.5 text-xs font-medium leading-relaxed text-amber-100/50">
                ZIPs reconhecidos do Cyberpunk 2077 e Resident Evil Requiem são instalados automaticamente
                com backup. Formatos desconhecidos permanecem disponíveis para instalação manual.
              </p>
            </div>
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

const SummaryStat: React.FC<{ label: string; value: number }> = ({ label, value }) => (
  <div className="min-w-24 rounded-2xl border border-white/[0.06] bg-white/[0.035] px-4.5 py-3 text-right backdrop-blur-xl">
    <p className="text-xl font-bold text-white tabular-nums">{value}</p>
    <p className="mt-0.5 text-[9px] font-black uppercase tracking-wider text-white/35">{label}</p>
  </div>
);

export default ModsPage;
