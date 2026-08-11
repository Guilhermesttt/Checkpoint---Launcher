import React, { useState, useEffect } from "react";
import { AnimatePresence } from "framer-motion";
import {
  X,
  Gamepad2,
  FolderOpen,
  Check,
  Palette,
  Image as ImageIcon,
  LoaderCircle,
  Search,
  Trophy,
  Trash2,
  Upload,
} from "lucide-react";
import ModalShell from "../../../components/ui/ModalShell";
import type { RetroGame } from "../shelf/retroCollection";
import type { SoundEffectType } from "../../../hooks/useSoundEffects";
import {
  searchRetroAchievementGames,
  type RetroAchievementsGameMatch,
} from "../../../services/retroAchievements";
import {
  searchTheGamesDbGames,
  type TheGamesDbGameMatch,
} from "../../../services/theGamesDb";

interface RetroAddGameModalProps {
  isOpen: boolean;
  onClose: (silent?: boolean) => void;
  playSound: (type: SoundEffectType) => void;
  gameToEdit?: RetroGame | null;
  onSaveGame: (game: RetroGame) => void;
  onDeleteGame?: (game: RetroGame) => void;
}

const MAX_LOCAL_IMAGE_SIZE = 3 * 1024 * 1024;
const SUPPORTED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
]);

const CONSOLES = [
  { id: "PS2", label: "PlayStation 2", defaultAccent: "#b52322" },
  { id: "PS1", label: "PlayStation 1", defaultAccent: "#ddd8ca" },
  { id: "SNES", label: "Super Nintendo", defaultAccent: "#b52322" },
  { id: "NES", label: "Nintendinho (NES)", defaultAccent: "#c83232" },
  { id: "N64", label: "Nintendo 64", defaultAccent: "#00a550" },
  { id: "GENESIS", label: "Sega Genesis / Mega Drive", defaultAccent: "#0066cc" },
  { id: "GBA", label: "Game Boy Advance", defaultAccent: "#7c3aed" },
  { id: "SWITCH", label: "Nintendo Switch", defaultAccent: "#e60012" },
  { id: "PSP", label: "PlayStation Portable", defaultAccent: "#0070d1" },
];

const PRESET_COLORS = [
  "#b52322",
  "#ddd8ca",
  "#8f9390",
  "#00a550",
  "#0066cc",
  "#7c3aed",
  "#e60012",
  "#eab308",
];

export function RetroAddGameModal({
  isOpen,
  onClose,
  playSound,
  gameToEdit,
  onSaveGame,
  onDeleteGame,
}: RetroAddGameModalProps) {
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [consoleType, setConsoleType] = useState("PS2");
  const [year, setYear] = useState<number>(2005);
  const [publisher, setPublisher] = useState("");
  const [description, setDescription] = useState("");
  const [accent, setAccent] = useState("#b52322");
  const [coverImage, setCoverImage] = useState("");
  const [backImage, setBackImage] = useState("");
  const [wrapImage, setWrapImage] = useState("");
  const [executablePath, setExecutablePath] = useState("");
  const [retroAchievementsGameId, setRetroAchievementsGameId] = useState<number>();
  const [achievementMatches, setAchievementMatches] = useState<RetroAchievementsGameMatch[]>([]);
  const [achievementSearchLoading, setAchievementSearchLoading] = useState(false);
  const [achievementSearchError, setAchievementSearchError] = useState<string>();
  const [imageError, setImageError] = useState<string>();
  const [deleteConfirmationOpen, setDeleteConfirmationOpen] = useState(false);
  const [theGamesDbMatches, setTheGamesDbMatches] = useState<TheGamesDbGameMatch[]>([]);
  const [theGamesDbLoading, setTheGamesDbLoading] = useState(false);
  const [theGamesDbError, setTheGamesDbError] = useState<string>();
  const [selectedTheGamesDbGameId, setSelectedTheGamesDbGameId] = useState<number>();
  const [selectedArtworkImages, setSelectedArtworkImages] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    if (gameToEdit) {
      setTitle(gameToEdit.title ?? "");
      setSubtitle(gameToEdit.subtitle ?? "");
      setConsoleType(gameToEdit.console ?? "PS2");
      setYear(gameToEdit.year ?? 2005);
      setPublisher(gameToEdit.publisher ?? "");
      setDescription(gameToEdit.description ?? "");
      setAccent(gameToEdit.accent ?? "#b52322");
      setCoverImage(gameToEdit.coverImage ?? "");
      setBackImage(gameToEdit.backImage ?? "");
      setWrapImage(gameToEdit.wrapImage ?? "");
      setSelectedArtworkImages(gameToEdit.artworkImages ?? []);
      setExecutablePath(gameToEdit.executablePath ?? "");
      setRetroAchievementsGameId(gameToEdit.retroAchievementsGameId);
    } else {
      setTitle("");
      setSubtitle("");
      setConsoleType("PS2");
      setYear(2005);
      setPublisher("");
      setDescription("");
      setAccent("#b52322");
      setCoverImage("");
      setBackImage("");
      setWrapImage("");
      setSelectedArtworkImages([]);
      setExecutablePath("");
      setRetroAchievementsGameId(undefined);
    }
    setAchievementMatches([]);
    setAchievementSearchError(undefined);
    setAchievementSearchLoading(false);
    setImageError(undefined);
    setDeleteConfirmationOpen(false);
    setTheGamesDbMatches([]);
    setTheGamesDbError(undefined);
    setTheGamesDbLoading(false);
    setSelectedTheGamesDbGameId(undefined);
    setSaving(false);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [gameToEdit, isOpen]);

  const handleSelectExecutable = async () => {
    playSound("search");
    if (window.electronAPI?.selectExecutable) {
      try {
        const path = await window.electronAPI.selectExecutable();
        if (path) {
          setExecutablePath(path);
        }
      } catch (err) {
        console.error("Erro ao selecionar executável/ROM:", err);
      }
    }
  };

  const materializeRemoteImage = async (value: string) => {
    const trimmed = value.trim();
    if (!/^https?:\/\//i.test(trimmed)) return trimmed;
    if (!window.electronAPI?.importRetroArtwork) {
      throw new Error("Abra o launcher desktop para importar imagens por link.");
    }
    return window.electronAPI.importRetroArtwork(trimmed);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || saving) return;

    setSaving(true);
    setImageError(undefined);
    try {
      const [savedCover, savedBack, savedWrap] = await Promise.all([
        materializeRemoteImage(coverImage),
        materializeRemoteImage(backImage),
        materializeRemoteImage(wrapImage),
      ]);
      playSound("select");
      const gameId = gameToEdit ? gameToEdit.id : `retro-${Date.now()}`;
      const newGame: RetroGame = {
        id: gameId,
        title: title.trim(),
        subtitle: subtitle.trim() || "EDIÇÃO CLÁSSICA",
        year: Number(year) || 2000,
        console: consoleType,
        publisher: publisher.trim() || "DESCONHECIDO",
        description: description.trim() || undefined,
        accent: accent || "#b52322",
        coverImage: savedCover || undefined,
        backImage: savedBack || undefined,
        wrapImage: savedWrap || undefined,
        artworkImages: selectedArtworkImages.length ? selectedArtworkImages : undefined,
        executablePath: executablePath.trim() || undefined,
        retroAchievementsGameId,
      };
      onSaveGame(newGame);
      onClose();
    } catch (reason) {
      setImageError(reason instanceof Error ? reason.message : "Não foi possível importar a imagem.");
    } finally {
      setSaving(false);
    }
  };

  const handleLocalImage = (
    file: File | undefined,
    setImage: React.Dispatch<React.SetStateAction<string>>,
  ) => {
    if (!file) return;
    if (!SUPPORTED_IMAGE_TYPES.has(file.type)) {
      setImageError("Escolha uma imagem JPG, PNG, WebP, GIF ou AVIF.");
      return;
    }
    if (file.size > MAX_LOCAL_IMAGE_SIZE) {
      setImageError("A imagem deve ter no máximo 3 MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setImage(reader.result);
        setImageError(undefined);
      }
    };
    reader.onerror = () => setImageError("Não foi possível carregar a imagem escolhida.");
    reader.readAsDataURL(file);
  };

  const handleDelete = () => {
    if (!gameToEdit || !onDeleteGame) return;
    playSound("select");
    onDeleteGame(gameToEdit);
    onClose();
  };

  const clearAchievementMatch = () => {
    setRetroAchievementsGameId(undefined);
    setAchievementMatches([]);
    setAchievementSearchError(undefined);
  };

  const handleAchievementSearch = async (
    requestedTitle = title,
    autoSelectBestMatch = false,
  ) => {
    const searchedTitle = requestedTitle.trim();
    if (searchedTitle.length < 2) {
      setAchievementSearchError("Digite pelo menos 2 caracteres do título.");
      return;
    }
    setAchievementSearchLoading(true);
    setAchievementSearchError(undefined);
    try {
      const matches = await searchRetroAchievementGames(searchedTitle, consoleType);
      setAchievementMatches(matches);
      if (autoSelectBestMatch && matches.length > 0) {
        const normalizedTitle = searchedTitle.toLocaleLowerCase("pt-BR");
        const bestMatch = matches.find(
          (match) => match.title.trim().toLocaleLowerCase("pt-BR") === normalizedTitle,
        ) ?? matches[0];
        setRetroAchievementsGameId(bestMatch.id);
      }
      if (matches.length === 0) {
        setAchievementSearchError("Nenhum jogo compatível foi encontrado.");
      }
    } catch (reason) {
      setAchievementMatches([]);
      setAchievementSearchError(
        reason instanceof Error
          ? reason.message
          : "Não foi possível buscar na RetroAchievements.",
      );
    } finally {
      setAchievementSearchLoading(false);
    }
  };

  useEffect(() => {
    const query = title.trim();
    if (!isOpen || selectedTheGamesDbGameId || query.length < 2) return;

    let active = true;
    const timeout = window.setTimeout(async () => {
      setTheGamesDbLoading(true);
      setTheGamesDbError(undefined);
      try {
        const matches = await searchTheGamesDbGames(query);
        if (!active) return;
        setTheGamesDbMatches(matches);
        if (!matches.length) setTheGamesDbError("Nenhum jogo foi encontrado no TheGamesDB.");
      } catch (reason) {
        if (!active) return;
        setTheGamesDbMatches([]);
        setTheGamesDbError(reason instanceof Error ? reason.message : "Não foi possível buscar no TheGamesDB.");
      } finally {
        if (active) setTheGamesDbLoading(false);
      }
    }, 350);

    return () => {
      active = false;
      window.clearTimeout(timeout);
    };
  }, [isOpen, selectedTheGamesDbGameId, title]);

  const applyTheGamesDbMatch = async (match: TheGamesDbGameMatch) => {
    setSelectedTheGamesDbGameId(match.id);
    setTitle(match.title);
    if (match.year) setYear(match.year);
    if (match.publisher) setPublisher(match.publisher);
    setDescription(match.description || "");
    setSubtitle(match.developer || match.platform || "EDIÇÃO CLÁSSICA");
    if (match.frontImage) setCoverImage(match.frontImage);
    if (match.backImage) setBackImage(match.backImage);
    setSelectedArtworkImages(match.images);
    setTheGamesDbMatches([]);
    setTheGamesDbError(undefined);
    await handleAchievementSearch(match.title, true);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <ModalShell
          isOpen={isOpen}
          onClose={() => onClose()}
          maxWidthClassName="max-w-2xl"
        >
          <div className="retro-mode max-h-[calc(100dvh-2rem)] overflow-y-auto p-6 space-y-6 text-stone-100 md:max-h-[calc(100dvh-4rem)]">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-stone-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-red-950/40 border border-red-800/40 text-red-400">
                  <Gamepad2 className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-bold tracking-wide font-mono text-stone-100 uppercase">
                    {gameToEdit ? "Editar Jogo Retrô" : "Adicionar Jogo Retrô"}
                  </h2>
                  <p className="text-xs text-stone-400 font-mono">
                    Cadastre jogos para a coleção retrô 3D
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  playSound("modalClose");
                  onClose();
                }}
                className="p-2 rounded-lg text-stone-400 hover:text-stone-100 hover:bg-stone-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Título & Subtítulo */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-mono text-stone-300 mb-1">
                    Título do Jogo *
                  </label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => {
                      setTitle(e.target.value);
                      clearAchievementMatch();
                      setSelectedTheGamesDbGameId(undefined);
                      setTheGamesDbMatches([]);
                      setTheGamesDbError(undefined);
                    }}
                    placeholder="Ex: God of War II"
                    className="w-full px-3.5 py-2.5 bg-stone-900/90 border border-stone-700/80 rounded-lg text-sm text-stone-100 placeholder-stone-500 focus:outline-none focus:border-red-500/80 transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-mono text-stone-300 mb-1">
                    Subtítulo / Slogan
                  </label>
                  <input
                    type="text"
                    value={subtitle}
                    onChange={(e) => setSubtitle(e.target.value)}
                    placeholder="Ex: EDIÇÃO CLÁSSICA"
                    className="w-full px-3.5 py-2.5 bg-stone-900/90 border border-stone-700/80 rounded-lg text-sm text-stone-100 placeholder-stone-500 focus:outline-none focus:border-red-500/80 transition"
                  />
                </div>
              </div>

              {/* Console & Ano */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-mono text-stone-300 mb-1">
                    Console / Plataforma
                  </label>
                  <select
                    value={consoleType}
                    onChange={(e) => {
                      setConsoleType(e.target.value);
                      clearAchievementMatch();
                      const matched = CONSOLES.find((c) => c.id === e.target.value);
                      if (matched) setAccent(matched.defaultAccent);
                    }}
                    className="w-full px-3.5 py-2.5 bg-stone-900/90 border border-stone-700/80 rounded-lg text-sm text-stone-100 focus:outline-none focus:border-red-500/80 transition"
                  >
                    {CONSOLES.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label} ({c.id})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-mono text-stone-300 mb-1">
                    Ano de Lançamento
                  </label>
                  <input
                    type="number"
                    value={year}
                    onChange={(e) => setYear(Number(e.target.value))}
                    min={1970}
                    max={2030}
                    className="w-full px-3.5 py-2.5 bg-stone-900/90 border border-stone-700/80 rounded-lg text-sm text-stone-100 focus:outline-none focus:border-red-500/80 transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-mono text-stone-300 mb-1">
                    Distribuidora / Publisher
                  </label>
                  <input
                    type="text"
                    value={publisher}
                    onChange={(e) => setPublisher(e.target.value)}
                    placeholder="Ex: Sony Computer"
                    className="w-full px-3.5 py-2.5 bg-stone-900/90 border border-stone-700/80 rounded-lg text-sm text-stone-100 placeholder-stone-500 focus:outline-none focus:border-red-500/80 transition"
                  />
                </div>
              </div>

              <div className="rounded-xl border border-sky-800/50 bg-sky-950/20 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs font-bold text-stone-100">TheGamesDB</p>
                    <p className="text-[10px] text-stone-400">Preenche descrição, ano, estúdio e capas frontal/traseira.</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2 text-[10px] font-bold uppercase text-sky-200/80">
                    {theGamesDbLoading && <LoaderCircle className="h-3.5 w-3.5 animate-spin" />}
                    {theGamesDbLoading ? "Buscando..." : "Busca automática"}
                  </div>
                </div>
                {theGamesDbMatches.length > 0 && (
                  <div className="mt-3 grid max-h-52 gap-2 overflow-y-auto" role="list" aria-label="Resultados TheGamesDB">
                    {theGamesDbMatches.map((match) => (
                      <button
                        key={match.id}
                        type="button"
                        aria-label={`Usar dados de ${match.title} do TheGamesDB`}
                        onClick={() => void applyTheGamesDbMatch(match)}
                        className="flex w-full items-center gap-3 rounded-xl border border-stone-700 bg-black/20 p-2.5 text-left transition hover:border-sky-600"
                      >
                        {match.frontImage ? <img src={match.frontImage} alt="" className="h-14 w-10 rounded object-cover" /> : <span className="h-14 w-10 rounded bg-stone-800" />}
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-xs font-semibold text-stone-100">{match.title}</span>
                          <span className="block text-[10px] text-stone-400">{match.platform || "Plataforma desconhecida"}{match.year ? ` · ${match.year}` : ""}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                )}
                <p aria-live="polite" className="mt-2 min-h-4 text-[10px] text-red-300">{theGamesDbError || ""}</p>
              </div>

              <div className="rounded-xl border border-stone-700/70 bg-stone-900/55 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-2.5">
                    <Trophy className="h-4 w-4 text-amber-400" aria-hidden="true" />
                    <div>
                      <p className="text-xs font-bold text-stone-100">RetroAchievements</p>
                      <p className="text-[10px] text-stone-400">
                        Confirme o jogo correto antes de vincular as conquistas.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    aria-label="Buscar na RetroAchievements"
                    disabled={achievementSearchLoading || title.trim().length < 2}
                    onClick={() => void handleAchievementSearch()}
                    className="flex shrink-0 items-center justify-center gap-2 rounded-xl border border-stone-600 bg-stone-800 px-3 py-2 text-[10px] font-bold uppercase text-stone-100 transition hover:bg-stone-700 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {achievementSearchLoading ? (
                      <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Search className="h-3.5 w-3.5" />
                    )}
                    Buscar
                  </button>
                </div>

                {achievementMatches.length > 0 && (
                  <div className="mt-3 grid gap-2" role="list" aria-label="Resultados RetroAchievements">
                    {achievementMatches.map((match) => {
                      const selected = retroAchievementsGameId === match.id;
                      return (
                        <div key={match.id} role="listitem">
                          <button
                            type="button"
                            aria-label={`Usar ${match.title} da RetroAchievements`}
                            aria-pressed={selected}
                            onClick={() => {
                              setRetroAchievementsGameId(match.id);
                              setAchievementSearchError(undefined);
                            }}
                            className={`flex w-full items-center gap-3 rounded-xl border p-2.5 text-left transition ${
                              selected
                                ? "border-amber-500/70 bg-amber-500/10"
                                : "border-stone-700 bg-black/20 hover:border-stone-500"
                            }`}
                          >
                            {match.imageUrl ? (
                              <img src={match.imageUrl} alt="" className="h-10 w-10 rounded-lg object-cover" />
                            ) : (
                              <span className="h-10 w-10 rounded-lg bg-stone-800" />
                            )}
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-xs font-semibold text-stone-100">
                                {match.title}
                              </span>
                              <span className="block text-[10px] text-stone-400">
                                {match.consoleName} · {match.achievementCount} conquistas
                              </span>
                            </span>
                            {selected && <Check className="h-4 w-4 text-amber-400" />}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}

                {retroAchievementsGameId && achievementMatches.length === 0 && (
                  <p className="mt-3 text-[10px] font-semibold text-emerald-400">
                    Jogo vinculado: ID {retroAchievementsGameId}
                  </p>
                )}
                <p aria-live="polite" className="mt-2 min-h-4 text-[10px] text-red-300">
                  {achievementSearchError || ""}
                </p>
              </div>

              <div>
                <label className="mb-1 block text-xs font-mono text-stone-300">Descrição</label>
                <textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="Descrição do jogo"
                  rows={4}
                  className="w-full resize-y rounded-lg border border-stone-700/80 bg-stone-900/90 px-3.5 py-2.5 text-sm text-stone-100 placeholder-stone-500 transition focus:border-red-500/80 focus:outline-none"
                />
              </div>

              {/* Capa frontal, traseira e box wrap */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-mono text-stone-300 mb-1 flex items-center gap-1.5">
                    <ImageIcon className="w-3.5 h-3.5 text-red-400" /> Capa Frontal (URL ou Imagem)
                  </label>
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={coverImage}
                      onChange={(e) => setCoverImage(e.target.value)}
                      placeholder="URL da imagem frontal"
                      className="w-full px-3.5 py-2.5 bg-stone-900/90 border border-stone-700/80 rounded-lg text-sm text-stone-100 placeholder-stone-500 focus:outline-none focus:border-red-500/80 transition"
                    />
                    <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-stone-700 bg-stone-800 px-3 py-2 text-[10px] font-mono font-bold uppercase text-stone-200 transition hover:bg-stone-700">
                      <Upload className="h-3.5 w-3.5" /> Escolher do PC
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
                        aria-label="Escolher capa frontal do PC"
                        className="sr-only"
                        onChange={(event) => handleLocalImage(event.target.files?.[0], setCoverImage)}
                      />
                    </label>
                    {coverImage && (
                      <img
                        src={coverImage}
                        alt="Prévia da capa frontal"
                        className="h-28 w-full rounded-lg border border-stone-700 bg-black/30 object-contain"
                      />
                    )}
                  </div>
                </div>
                <div>
                  <label className="mb-1 flex items-center gap-1.5 text-xs font-mono text-stone-300">
                    <ImageIcon className="h-3.5 w-3.5 text-sky-400" /> Capa Traseira (URL ou Imagem)
                  </label>
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={backImage}
                      onChange={(e) => setBackImage(e.target.value)}
                      placeholder="URL da imagem traseira"
                      className="w-full rounded-lg border border-stone-700/80 bg-stone-900/90 px-3.5 py-2.5 text-sm text-stone-100 placeholder-stone-500 transition focus:border-red-500/80 focus:outline-none"
                    />
                    <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-stone-700 bg-stone-800 px-3 py-2 text-[10px] font-mono font-bold uppercase text-stone-200 transition hover:bg-stone-700">
                      <Upload className="h-3.5 w-3.5" /> Escolher do PC
                      <input type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/avif" aria-label="Escolher capa traseira do PC" className="sr-only" onChange={(event) => handleLocalImage(event.target.files?.[0], setBackImage)} />
                    </label>
                    {backImage && <img src={backImage} alt="Prévia da capa traseira" className="h-28 w-full rounded-lg border border-stone-700 bg-black/30 object-contain" />}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-mono text-stone-300 mb-1 flex items-center gap-1.5">
                    <ImageIcon className="w-3.5 h-3.5 text-amber-400" /> Box Wrap 360° (Opcional - Frente/Lombada/Costas)
                  </label>
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={wrapImage}
                      onChange={(e) => setWrapImage(e.target.value)}
                      placeholder="URL da imagem completa da caixa"
                      className="w-full px-3.5 py-2.5 bg-stone-900/90 border border-stone-700/80 rounded-lg text-sm text-stone-100 placeholder-stone-500 focus:outline-none focus:border-red-500/80 transition"
                    />
                    <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-stone-700 bg-stone-800 px-3 py-2 text-[10px] font-mono font-bold uppercase text-stone-200 transition hover:bg-stone-700">
                      <Upload className="h-3.5 w-3.5" /> Escolher capa completa
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
                        aria-label="Escolher capa completa do PC"
                        className="sr-only"
                        onChange={(event) => handleLocalImage(event.target.files?.[0], setWrapImage)}
                      />
                    </label>
                    {wrapImage && (
                      <img
                        src={wrapImage}
                        alt="Prévia da capa completa"
                        className="h-28 w-full rounded-lg border border-stone-700 bg-black/30 object-contain"
                      />
                    )}
                  </div>
                </div>
              </div>
              <p aria-live="polite" className="min-h-4 text-[10px] text-red-300">
                {imageError || ""}
              </p>

              {/* Executável / ROM Path */}
              <div>
                <label className="block text-xs font-mono text-stone-300 mb-1 flex items-center gap-1.5">
                  <FolderOpen className="w-3.5 h-3.5 text-emerald-400" /> Executável ou Arquivo de ROM (.iso, .bin, .sfc, .exe)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={executablePath}
                    onChange={(e) => setExecutablePath(e.target.value)}
                    placeholder="C:\Emulators\PCSX2\pcsx2.exe ou C:\Roms\GOW.iso"
                    className="flex-1 px-3.5 py-2.5 bg-stone-900/90 border border-stone-700/80 rounded-lg text-sm text-stone-100 placeholder-stone-500 focus:outline-none focus:border-red-500/80 transition"
                  />
                  <button
                    type="button"
                    onClick={handleSelectExecutable}
                    className="px-4 py-2.5 bg-stone-800 hover:bg-stone-700 text-stone-200 rounded-lg border border-stone-700 text-xs font-mono font-medium transition flex items-center gap-1.5"
                  >
                    <FolderOpen className="w-4 h-4" /> Procurar
                  </button>
                </div>
              </div>

              {/* Cor de Acento */}
              <div>
                <label className="block text-xs font-mono text-stone-300 mb-1.5 flex items-center gap-1.5">
                  <Palette className="w-3.5 h-3.5 text-stone-400" /> Cor de Acento da Caixa
                </label>
                <div className="flex items-center gap-2">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setAccent(c)}
                      className={`w-7 h-7 rounded-full border transition flex items-center justify-center ${
                        accent === c
                          ? "border-white scale-110 shadow-lg shadow-black/50"
                          : "border-transparent opacity-70 hover:opacity-100"
                      }`}
                      style={{ backgroundColor: c }}
                    >
                      {accent === c && <Check className="w-3.5 h-3.5 text-white drop-shadow" />}
                    </button>
                  ))}
                  <input
                    type="color"
                    value={accent}
                    onChange={(e) => setAccent(e.target.value)}
                    className="w-8 h-8 rounded border border-stone-700 bg-transparent cursor-pointer ml-2"
                  />
                </div>
              </div>

              {/* Botões de Ação */}
              {deleteConfirmationOpen && gameToEdit && (
                <div role="alert" className="rounded-xl border border-red-800/70 bg-red-950/30 p-4">
                  <p className="text-sm font-bold text-stone-100">Excluir {gameToEdit.title}?</p>
                  <p className="mt-1 text-xs text-stone-400">
                    O jogo será removido do seu acervo retrô neste PC.
                  </p>
                  <div className="mt-3 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setDeleteConfirmationOpen(false)}
                      className="rounded-lg px-3 py-2 text-xs text-stone-300 hover:bg-stone-800"
                    >
                      Manter jogo
                    </button>
                    <button
                      type="button"
                      aria-label="Confirmar exclusão"
                      onClick={handleDelete}
                      className="rounded-lg bg-red-700 px-3 py-2 text-xs font-bold text-white hover:bg-red-600"
                    >
                      Excluir definitivamente
                    </button>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between gap-3 border-t border-stone-800 pt-4 mt-6">
                <div>
                  {gameToEdit && onDeleteGame && (
                    <button
                      type="button"
                      aria-label="Excluir jogo"
                      onClick={() => setDeleteConfirmationOpen(true)}
                      className="flex items-center gap-2 rounded-lg px-4 py-2.5 text-xs font-mono font-semibold text-red-400 transition hover:bg-red-950/40 hover:text-red-300"
                    >
                      <Trash2 className="h-4 w-4" /> Excluir jogo
                    </button>
                  )}
                </div>
                <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    playSound("modalClose");
                    onClose();
                  }}
                  className="px-5 py-2.5 text-xs font-mono font-semibold text-stone-400 hover:text-stone-100 hover:bg-stone-800 rounded-lg transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  aria-label="Salvar jogo"
                  disabled={saving}
                  className="px-6 py-2.5 bg-red-700 hover:bg-red-600 text-stone-100 font-mono text-xs font-bold uppercase rounded-lg shadow-lg shadow-red-950/50 transition flex items-center gap-2"
                >
                  {saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  {saving ? "Importando imagens..." : gameToEdit ? "Salvar Alterações" : "Adicionar à Coleção"}
                </button>
                </div>
              </div>
            </form>
          </div>
        </ModalShell>
      )}
    </AnimatePresence>
  );
}
