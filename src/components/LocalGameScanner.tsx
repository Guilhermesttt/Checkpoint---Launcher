import React, { useCallback, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Check,
  ChevronDown,
  ChevronUp,
  FolderOpen,
  Gamepad2,
  Monitor,
  Search,
  X,
} from "lucide-react";
import { setDoc } from "firebase/firestore";
import { userGameDocRef } from "../services/firestorePaths";

interface LocalGameEntry {
  name: string;
  path: string;
  selected: boolean;
  editedName: string;
}

interface LocalGameScannerProps {
  uid: string;
  onClose: () => void;
  onImported: (count: number) => void;
}

const LocalGameScanner: React.FC<LocalGameScannerProps> = ({
  uid,
  onClose,
  onImported,
}) => {
  const [phase, setPhase] = useState<
    "idle" | "scanning" | "results" | "importing" | "done"
  >("idle");
  const [games, setGames] = useState<LocalGameEntry[]>([]);
  const [importProgress, setImportProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  const selectedCount = useMemo(
    () => games.filter((game) => game.selected).length,
    [games],
  );
  const visibleGames = useMemo(
    () => (showAll ? games : games.slice(0, 12)),
    [games, showAll],
  );

  const handleScan = useCallback(async () => {
    if (!window.electronAPI?.scanLocalGames) {
      setError("Scanner local indisponivel fora do app desktop.");
      return;
    }

    setError(null);
    setShowAll(false);
    setPhase("scanning");

    try {
      const found = await window.electronAPI.scanLocalGames();
      if (found.length === 0) {
        setError("Nenhum jogo encontrado nas selecoes feitas.");
        setPhase("idle");
        return;
      }

      setGames(
        found.map((game) => ({
          name: game.name,
          path: game.path,
          selected: true,
          editedName: game.name,
        })),
      );
      setPhase("results");
    } catch (scanError) {
      setError(
        scanError instanceof Error ? scanError.message : "Erro ao buscar jogos.",
      );
      setPhase("idle");
    }
  }, []);

  const toggleGame = useCallback((path: string) => {
    setGames((current) =>
      current.map((game) =>
        game.path === path ? { ...game, selected: !game.selected } : game,
      ),
    );
  }, []);

  const renameGame = useCallback((path: string, editedName: string) => {
    setGames((current) =>
      current.map((game) =>
        game.path === path ? { ...game, editedName } : game,
      ),
    );
  }, []);

  const toggleAll = useCallback((selected: boolean) => {
    setGames((current) => current.map((game) => ({ ...game, selected })));
  }, []);

  const handleImport = useCallback(async () => {
    const selectedGames = games.filter((game) => game.selected);
    if (selectedGames.length === 0) {
      return;
    }

    setPhase("importing");
    setImportProgress(0);

    try {
      for (let index = 0; index < selectedGames.length; index += 1) {
        const game = selectedGames[index];
        const pathHash = Array.from(game.path).reduce(
          (hash, char) => (hash * 31 + char.charCodeAt(0)) >>> 0,
          7,
        );
        const gameId = `${uid}_local_${pathHash.toString(16)}`;
        const now = new Date().toISOString();

        await setDoc(
          userGameDocRef(uid, gameId),
          {
            title: game.editedName.trim() || game.name,
            image: "",
            backgroundImage: "",
            cardImage: "",
            logoImage: "",
            category: "LOCAL",
            description: "Jogo local importado manualmente do computador.",
            executablePath: game.path,
            launcherType: "local",
            source: "manual",
            hoursPlayed: 0,
            isFavorite: false,
            createdAt: now,
            updatedAt: now,
          },
          { merge: true },
        );

        setImportProgress(
          Math.round(((index + 1) / selectedGames.length) * 100),
        );
      }

      setPhase("done");
      onImported(selectedGames.length);
    } catch (importError) {
      setError(
        importError instanceof Error
          ? importError.message
          : "Erro ao importar jogos locais.",
      );
      setPhase("results");
    }
  }, [games, onImported, uid]);

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 16 }}
        transition={{ duration: 0.22 }}
        className="relative w-full max-w-2xl overflow-hidden rounded-3xl border border-white/10 bg-[#0d1117] shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-blue-500/20 bg-blue-500/10">
              <Monitor className="h-4 w-4 text-blue-300" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">
                Buscar Jogos no PC
              </h2>
              <p className="text-xs text-white/45">
                Importe executaveis como jogos locais no launcher
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-xl text-white/45 transition hover:bg-white/10 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-6 py-5">
          <AnimatePresence mode="wait">
            {phase === "idle" && (
              <motion.div
                key="idle"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="py-8 text-center"
              >
                <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-3xl border border-white/10 bg-white/5">
                  <FolderOpen className="h-7 w-7 text-white/35" />
                </div>
                <p className="mb-2 text-sm text-white/65">
                  Selecione uma ou mais pastas, ou executaveis `.exe`, para procurar jogos.
                </p>
                <p className="mb-6 text-xs text-white/35">
                  Instaladores, updaters e redistribuiveis comuns sao ignorados.
                </p>
                {error && (
                  <p className="mx-auto mb-4 max-w-md rounded-xl border border-red-400/20 bg-red-400/10 px-3 py-2 text-xs text-red-300">
                    {error}
                  </p>
                )}
                <button
                  type="button"
                  onClick={handleScan}
                  className="mx-auto flex items-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-medium text-white transition hover:bg-blue-500"
                >
                  <Search className="h-4 w-4" />
                  Escolher e buscar
                </button>
              </motion.div>
            )}

            {phase === "scanning" && (
              <motion.div
                key="scanning"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="py-12 text-center"
              >
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1.1, repeat: Infinity, ease: "linear" }}
                  className="mx-auto mb-4 h-10 w-10 rounded-full border-2 border-white/10 border-t-blue-400"
                />
                <p className="text-sm text-white/60">
                  Buscando jogos nas selecoes feitas...
                </p>
              </motion.div>
            )}

            {phase === "results" && (
              <motion.div
                key="results"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                {error && (
                  <p className="mb-4 rounded-xl border border-red-400/20 bg-red-400/10 px-3 py-2 text-xs text-red-300">
                    {error}
                  </p>
                )}

                <div className="mb-3 flex items-center justify-between">
                  <span className="text-xs text-white/50">
                    {games.length} encontrado{games.length === 1 ? "" : "s"} ·{" "}
                    <span className="text-blue-300">
                      {selectedCount} selecionado{selectedCount === 1 ? "" : "s"}
                    </span>
                  </span>

                  <div className="flex items-center gap-2 text-xs text-white/40">
                    <button type="button" onClick={() => toggleAll(true)}>
                      Todos
                    </button>
                    <span>|</span>
                    <button type="button" onClick={() => toggleAll(false)}>
                      Nenhum
                    </button>
                  </div>
                </div>

                <div className="max-h-[340px] space-y-2 overflow-y-auto pr-1">
                  {visibleGames.map((game) => (
                    <button
                      key={game.path}
                      type="button"
                      onClick={() => toggleGame(game.path)}
                      className={`flex w-full items-center gap-3 rounded-2xl border px-3 py-3 text-left transition ${
                        game.selected
                          ? "border-blue-400/30 bg-blue-500/10"
                          : "border-white/10 bg-white/[0.03]"
                      }`}
                    >
                      <div
                        className={`flex h-4 w-4 items-center justify-center rounded-md border ${
                          game.selected
                            ? "border-blue-300 bg-blue-400/90"
                            : "border-white/25"
                        }`}
                      >
                        {game.selected && (
                          <Check className="h-3 w-3 text-[#081018]" strokeWidth={3} />
                        )}
                      </div>
                      <Gamepad2 className="h-4 w-4 shrink-0 text-white/30" />
                      <div className="min-w-0 flex-1">
                        <input
                          value={game.editedName}
                          onClick={(event) => event.stopPropagation()}
                          onChange={(event) =>
                            renameGame(game.path, event.target.value)
                          }
                          className="w-full bg-transparent text-sm text-white/85 outline-none"
                        />
                        <p className="truncate text-xs text-white/30">
                          {game.path}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>

                {games.length > 12 && (
                  <button
                    type="button"
                    onClick={() => setShowAll((current) => !current)}
                    className="mx-auto mt-3 flex items-center gap-1 text-xs text-white/40 transition hover:text-white/60"
                  >
                    {showAll ? (
                      <>
                        <ChevronUp className="h-3 w-3" />
                        Mostrar menos
                      </>
                    ) : (
                      <>
                        <ChevronDown className="h-3 w-3" />
                        Ver mais {games.length - 12}
                      </>
                    )}
                  </button>
                )}

                <div className="mt-5 flex gap-3">
                  <button
                    type="button"
                    onClick={handleScan}
                    className="flex-1 rounded-2xl border border-white/10 px-4 py-3 text-sm text-white/60 transition hover:border-white/20 hover:text-white"
                  >
                    Buscar novamente
                  </button>
                  <button
                    type="button"
                    onClick={handleImport}
                    disabled={selectedCount === 0}
                    className="flex-1 rounded-2xl bg-blue-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Importar selecionados
                  </button>
                </div>
              </motion.div>
            )}

            {phase === "importing" && (
              <motion.div
                key="importing"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="py-10 text-center"
              >
                <p className="mb-4 text-sm text-white/60">Importando jogos...</p>
                <div className="mb-2 h-1.5 w-full overflow-hidden rounded-full bg-white/8">
                  <motion.div
                    className="h-full rounded-full bg-blue-500"
                    initial={{ width: 0 }}
                    animate={{ width: `${importProgress}%` }}
                  />
                </div>
                <p className="text-xs text-white/35">{importProgress}%</p>
              </motion.div>
            )}

            {phase === "done" && (
              <motion.div
                key="done"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="py-8 text-center"
              >
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-green-400/25 bg-green-400/10">
                  <Check className="h-6 w-6 text-green-300" />
                </div>
                <h3 className="mb-2 text-base font-semibold text-white">
                  Jogos importados
                </h3>
                <p className="mb-6 text-sm text-white/50">
                  Os jogos selecionados foram adicionados a biblioteca local.
                </p>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-2xl border border-white/10 px-6 py-3 text-sm font-medium text-white transition hover:bg-white/10"
                >
                  Fechar
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
};

export default LocalGameScanner;
