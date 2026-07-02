import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  ImageIcon,
  Type,
  Sparkles,
  Play,
  Search,
  Tags,
  Globe,
  Gamepad2,
  RefreshCw,
  FolderOpen,
} from "lucide-react";
import { addDoc, updateDoc, deleteField } from "firebase/firestore";
import ModalShell from "./ui/ModalShell";
import GameCard from "./GameCard";
import { useAuth } from "../auth/AuthProvider";
import { usePreferences } from "../context/PreferencesContext";
import { useNotification } from "./NotificationCenter";
import {
  userGamesCollectionRef,
  userGameDocRef,
} from "../services/firestorePaths";
import {
  fetchSteamAppDetailsResult,
} from "../services/steam";
import {
  searchEpicGames,
  fetchEpicAppDetailsResult,
} from "../services/epic";
import { apiUrl } from "../services/api";

interface AddGameModalProps {
  isOpen: boolean;
  onClose: (silent?: boolean) => void;
  playSound: (type: "select" | "back" | "navigate") => void;
  gameToEdit?: any | null;
  onSaved?: () => void;
}

const CATEGORIES = [
  { id: "ACTION", label: "AÃ§Ã£o" },
  { id: "ADVENTURE", label: "Aventura" },
  { id: "RACING", label: "Corrida" },
  { id: "RPG", label: "RPG" },
  { id: "SHOOTER", label: "FPS" },
  { id: "SPORTS", label: "Esportes" },
  { id: "HORROR", label: "Terror" },
];

type GameFormData = {
  title: string;
  image?: string;
  cardImage: string;
  backgroundImage: string;
  logoImage?: string;
  category: string;
  description: string;
  aboutTheGame?: string;
  launcherType: "steam" | "local" | "epic";
  executablePath: string;
  steamAppId?: string;
  epicCatalogId?: string;
  sizeGB?: number;
  releaseDate?: string;
  developer?: string;
  publisher?: string;
  tags?: string[];
  trailerUrl?: string;
  screenshots?: string[];
  source?: "manual" | "steam" | "epic";
};

const removeUndefined = (data: Record<string, unknown>) =>
  Object.fromEntries(
    Object.entries(data).filter(([, value]) => value !== undefined),
  );

const AddGameModal: React.FC<AddGameModalProps> = ({
  isOpen,
  onClose,
  playSound,
  gameToEdit,
  onSaved,
}) => {
  const { user } = useAuth();
  const { t, language } = usePreferences();
  const copy = {
    "pt-BR": {
      editInfo: "Editar informaÃ§Ãµes",
      addGame: "Adicionar Jogo",
      steamSearch: "Buscar na Steam",
      optional: "Opcional",
      searchPlaceholder: "Pesquisar jogo para auto-preenchimento...",
      title: "TÃ­tulo",
      titlePlaceholder: "Nome do seu jogo",
      category: "Categoria",
      cover: "Capa",
      link: "Link",
      platform: "Plataforma",
      steam: "Steam",
      local: "Local",
      epic: "Epic Games",
      upload: "Upload",
      confirmAdd: "Confirmar AdiÃ§Ã£o",
      saving: "Salvando...",
      executable: "ExecutÃ¡vel",
      chooseExe: "Selecionar .exe",
      executableHint:
        "No navegador, o sistema nÃ£o expÃµe o caminho completo. Em runtime desktop, o caminho local pode ser usado para iniciar o jogo.",
      noExecutable: "Nenhum executÃ¡vel selecionado",
    },
    "en-US": {
      editInfo: "Edit information",
      addGame: "Add Game",
      steamSearch: "Search Steam",
      optional: "Optional",
      searchPlaceholder: "Search game for autofill...",
      title: "Title",
      titlePlaceholder: "Your game name",
      category: "Category",
      cover: "Cover",
      link: "Link",
      platform: "Platform",
      steam: "Steam",
      local: "Local",
      epic: "Epic Games",
      upload: "Upload",
      confirmAdd: "Confirm",
      saving: "Saving...",
      executable: "Executable",
      chooseExe: "Select .exe",
      executableHint:
        "Browsers do not expose the full local path. In a desktop runtime, the local path can be used to launch the game.",
      noExecutable: "No executable selected",
    },
    "es-ES": {
      editInfo: "Editar informaciÃ³n",
      addGame: "AÃ±adir Jogo",
      steamSearch: "Buscar en Steam",
      optional: "Opcional",
      searchPlaceholder: "Buscar juego para autocompletar...",
      title: "TÃ­tulo",
      titlePlaceholder: "Nombre de tu juego",
      category: "CategorÃ­a",
      cover: "Portada",
      link: "Link",
      platform: "Plataforma",
      steam: "Steam",
      local: "Local",
      epic: "Epic Games",
      upload: "Subir",
      confirmAdd: "Confirmar",
      saving: "Guardando...",
      executable: "Ejecutable",
      chooseExe: "Seleccionar .exe",
      executableHint:
        "El navegador no expone la ruta local completa. En runtime de escritorio, la ruta local puede usarse para iniciar el juego.",
      noExecutable: "NingÃºn ejecutable seleccionado",
    },
  }[language];
  const { notify } = useNotification();
  const executableInputRef = React.useRef<HTMLInputElement>(null);
  const coverInputRef = React.useRef<HTMLInputElement>(null);
  const wallpaperInputRef = React.useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);

  const [formData, setFormData] = useState<GameFormData>({
    title: "",
    cardImage: "",
    backgroundImage: "",
    category: "ACTION",
    description: "",
    launcherType: "local" as "steam" | "local" | "epic",
    executablePath: "",
  });

  useEffect(() => {
    if (isOpen) {
      if (gameToEdit) {
        setFormData({
          title: gameToEdit.title || "",
          image: gameToEdit.image || "",
          cardImage: gameToEdit.cardImage || "",
          backgroundImage: gameToEdit.backgroundImage || gameToEdit.image || "",
          logoImage: gameToEdit.logoImage || "",
          category: gameToEdit.category || "ACTION",
          description: gameToEdit.description || "",
          aboutTheGame: gameToEdit.aboutTheGame || "",
          launcherType: gameToEdit.launcherType || "local",
          executablePath: gameToEdit.executablePath || "",
          steamAppId: gameToEdit.steamAppId || "",
          epicCatalogId: gameToEdit.epicCatalogId || "",
          sizeGB: gameToEdit.sizeGB,
          releaseDate: gameToEdit.releaseDate || "",
          developer: gameToEdit.developer || "",
          publisher: gameToEdit.publisher || "",
          tags: gameToEdit.tags || [],
          trailerUrl: gameToEdit.trailerUrl || "",
          screenshots: gameToEdit.screenshots || [],
          source: gameToEdit.source || "manual",
        });
      } else {
        setFormData({
          title: "",
          cardImage: "",
          backgroundImage: "",
          category: "ACTION",
          description: "",
          launcherType: "local",
          executablePath: "",
          source: "manual",
        });
      }
    }
  }, [isOpen, gameToEdit]);

  const fileToDataUrl = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("Falha ao ler arquivo."));
      reader.onload = () => resolve(String(reader.result || ""));
      reader.readAsDataURL(file);
    });

  const handleSteamSearch = async (query: string) => {
    if (query.length < 3) return;
    try {
      const resp = await fetch(
        apiUrl(`/api/steam/search?query=${encodeURIComponent(query)}`),
      );
      const data = await resp.json();
      setSearchResults(data.items || []);
    } catch (e) {
      console.error(e);
    }
  };

  const handleSelectSteamGame = async (game: any) => {
    playSound("select");
    const appId = String(game.id);
    setLoading(true);
    try {
      const details = await fetchSteamAppDetailsResult(appId);
      if (details.ok) {
        const d = details.data;
        setFormData((prev) => ({
          ...prev,
          title: d.title || game.name,
          image:
            d.backgroundImage ||
            `https://cdn.akamai.steamstatic.com/steam/apps/${appId}/library_hero.jpg`,
          cardImage:
            d.cardImage ||
            `https://cdn.akamai.steamstatic.com/steam/apps/${appId}/library_600x900_2x.jpg`,
          backgroundImage:
            d.backgroundImage ||
            `https://cdn.akamai.steamstatic.com/steam/apps/${appId}/library_hero.jpg`,
          logoImage: d.logoImage || "",
          description: d.description || "",
          aboutTheGame: d.aboutTheGame || d.description || "",
          launcherType: "steam",
          executablePath: appId,
          steamAppId: appId,
          epicCatalogId: "",
          sizeGB:
            typeof d.sizeGB === "number" && d.sizeGB > 0
              ? Math.round(d.sizeGB)
              : undefined,
          releaseDate: d.releaseDate || "",
          developer: d.developer || "",
          publisher: d.publisher || "",
          tags: d.tags || [],
          trailerUrl: d.trailerUrl || "",
          screenshots: d.screenshots || [],
          source: "manual",
        }));
      }
      setSearchResults([]);
      setSearchQuery("");
    } finally {
      setLoading(false);
    }
  };

  const handleEpicSearch = async (query: string) => {
    if (query.length < 3) return;
    try {
      const data = await searchEpicGames(query);
      setSearchResults(data.items || []);
    } catch (e) {
      console.error(e);
    }
  };

  const handleSelectEpicGame = async (game: any) => {
    playSound("select");
    const catalogId = String(game.id);
    setLoading(true);
    try {
      const details = await fetchEpicAppDetailsResult(catalogId);
      if (details.ok) {
        const d = details.data;
        setFormData((prev) => ({
          ...prev,
          title: d.title || game.name,
          image: d.backgroundImage || "",
          cardImage: d.cardImage || "",
          backgroundImage: d.backgroundImage || "",
          logoImage: d.logoImage || "",
          description: d.description || "",
          aboutTheGame: d.aboutTheGame || d.description || "",
          launcherType: "epic",
          executablePath: catalogId,
          steamAppId: "",
          epicCatalogId: catalogId,
          sizeGB:
            typeof d.sizeGB === "number" && d.sizeGB > 0
              ? Math.round(d.sizeGB)
              : undefined,
          releaseDate: d.releaseDate || "",
          developer: d.developer || "",
          publisher: d.publisher || "",
          tags: d.tags || [],
          trailerUrl: d.trailerUrl || "",
          screenshots: d.screenshots || [],
          source: "manual",
        }));
      }
      setSearchResults([]);
      setSearchQuery("");
    } finally {
      setLoading(false);
    }
  };

  const handleExecutableSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const browserPath =
      (file as File & { path?: string }).path ||
      file.webkitRelativePath ||
      file.name;

    setFormData((prev) => ({
      ...prev,
      launcherType: "local",
      executablePath: browserPath,
      steamAppId: "",
      source: "manual",
    }));
    playSound("select");
  };

  const handleCoverSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await fileToDataUrl(file);
      setFormData((prev) => ({
        ...prev,
        cardImage: dataUrl,
        image: prev.image || dataUrl,
        source: "manual",
      }));
      playSound("select");
    } catch {
      notify("Erro ao carregar imagem.", "error");
    } finally {
      e.target.value = "";
    }
  };

  const handleWallpaperSelect = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await fileToDataUrl(file);
      setFormData((prev) => ({
        ...prev,
        backgroundImage: dataUrl,
        image: prev.image || dataUrl,
        source: "manual",
      }));
      playSound("select");
    } catch {
      notify("Erro ao carregar imagem.", "error");
    } finally {
      e.target.value = "";
    }
  };

  const handleSubmit = async () => {
    if (!user?.uid || !formData.title) return;
    setLoading(true);
    playSound("select");
    try {
      const image =
        formData.image || formData.backgroundImage || formData.cardImage || "";
      const data = removeUndefined({
        ...formData,
        image,
        updatedAt: new Date().toISOString(),
      });
      if (gameToEdit) {
        await updateDoc(userGameDocRef(user.uid, gameToEdit.id), {
          ...data,
          ...(formData.launcherType !== "steam"
            ? {
                steamPlaytimeMinutes: deleteField(),
                steamLastPlayedAt: deleteField(),
                totalAchievements: deleteField(),
                completedAchievements: deleteField(),
              }
            : {}),
        });
        notify("Jogo atualizado!", "success");
      } else {
        await addDoc(userGamesCollectionRef(user.uid), {
          ...data,
          createdAt: new Date().toISOString(),
        });
        notify("Jogo adicionado!", "success");
      }
      onClose(true);
      onSaved?.();
    } catch (e) {
      notify("Erro ao salvar jogo.", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      maxWidthClassName="max-w-4xl"
      className="p-0! border-0! bg-transparent shadow-none!"
    >
      <div className="w-full bg-[#0a0a0c]/98 backdrop-blur-3xl rounded-[40px] overflow-hidden border border-white/10 shadow-[0_32px_128px_rgba(0,0,0,0.9)]">
        <div className="flex justify-between items-center px-10 py-8 border-b border-white/5 relative bg-white/0.01">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-1 bg-white/10 rounded-full" />
          <div>
            <h2 className="text-3xl font-black tracking-tighter text-white uppercase italic">
              {gameToEdit ? copy.editInfo : copy.addGame}
            </h2>
            <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.3em] mt-1">
              Biblioteca Digital â€¢ Checkpoint v.2
            </p>
          </div>
          <button
            onClick={() => {
              playSound("back");
              onClose();
            }}
            className="w-10 h-10 flex items-center justify-center hover:bg-white/10 rounded-full transition-all border border-white/5"
          >
            <X className="text-white/40" size={20} />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[1.2fr_0.8fr] min-h-[540px]">
          <div className="p-10 space-y-8 border-r border-white/5 overflow-y-auto max-h-[600px] no-scrollbar">
            <div className="space-y-4">
              <label className="flex items-center gap-2 text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">
                <Globe size={14} className="text-white/20" /> {copy.platform}
              </label>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => {
                    playSound("navigate");
                    setFormData((prev) => ({
                      ...prev,
                      launcherType: "local",
                      steamAppId: "",
                      epicCatalogId: "",
                      executablePath:
                        prev.launcherType === "steam" || prev.launcherType === "epic"
                          ? ""
                          : prev.executablePath,
                      source: "manual",
                    }));
                  }}
                  className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border ${
                    formData.launcherType === "local"
                      ? "bg-white text-black border-white shadow-[0_0_15px_rgba(255,255,255,0.2)]"
                      : "bg-white/5 text-white/40 border-white/5 hover:bg-white/10"
                  }`}
                >
                  {copy.local}
                </button>
                <button
                  onClick={() => {
                    playSound("navigate");
                    setFormData((prev) => ({
                      ...prev,
                      launcherType: "steam",
                      executablePath: prev.steamAppId || "",
                      source: "manual",
                    }));
                  }}
                  className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border ${
                    formData.launcherType === "steam"
                      ? "bg-white text-black border-white shadow-[0_0_15px_rgba(255,255,255,0.2)]"
                      : "bg-white/5 text-white/40 border-white/5 hover:bg-white/10"
                  }`}
                >
                  {copy.steam}
                </button>
                <button
                  onClick={() => {
                    playSound("navigate");
                    setFormData((prev) => ({
                      ...prev,
                      launcherType: "epic",
                      executablePath: prev.epicCatalogId || "",
                      source: "manual",
                    }));
                  }}
                  className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border ${
                    formData.launcherType === "epic"
                      ? "bg-white text-black border-white shadow-[0_0_15px_rgba(255,255,255,0.2)]"
                      : "bg-white/5 text-white/40 border-white/5 hover:bg-white/10"
                  }`}
                >
                  {copy.epic}
                </button>
              </div>
            </div>

            {formData.launcherType === "steam" && (
              <div className="space-y-4">
                <label className="flex items-center gap-2 text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">
                  <Search size={14} className="text-white/20" /> {copy.steamSearch}
                  ({copy.optional})
                </label>
                <div className="relative">
                  <input
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      handleSteamSearch(e.target.value);
                    }}
                    placeholder={copy.searchPlaceholder}
                    className="w-full bg-white/[0.04] border border-white/[0.08] rounded-2xl p-4 text-sm text-white outline-none focus:border-white/20 focus:bg-white/[0.06] transition-all placeholder:text-white/20"
                  />
                  <AnimatePresence>
                    {searchResults.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        className="absolute left-0 right-0 top-full mt-2 z-50 bg-[#121216] border border-white/10 rounded-2xl overflow-hidden shadow-2xl max-h-60 overflow-y-auto no-scrollbar"
                      >
                        {searchResults.map((g) => (
                          <button
                            key={g.id}
                            onClick={() => handleSelectSteamGame(g)}
                            className="w-full flex items-center gap-4 p-3 hover:bg-white/5 transition-colors text-left group"
                          >
                            {g.tiny_image ? (
                              <img
                                src={g.tiny_image}
                                alt=""
                                className="w-12 h-6 object-cover rounded opacity-40 group-hover:opacity-100 transition-opacity"
                              />
                            ) : (
                              <div className="w-12 h-6 bg-white/5 rounded" />
                            )}
                            <span className="text-sm text-white/70 group-hover:text-white">
                              {g.name}
                            </span>
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            )}

            {formData.launcherType === "epic" && (
              <div className="space-y-4">
                <label className="flex items-center gap-2 text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">
                  <Search size={14} className="text-white/20" /> Buscar na Epic ({copy.optional})
                </label>
                <div className="relative">
                  <input
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      handleEpicSearch(e.target.value);
                    }}
                    placeholder={copy.searchPlaceholder}
                    className="w-full bg-white/[0.04] border border-white/[0.08] rounded-2xl p-4 text-sm text-white outline-none focus:border-white/20 focus:bg-white/[0.06] transition-all placeholder:text-white/20"
                  />
                  <AnimatePresence>
                    {searchResults.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        className="absolute left-0 right-0 top-full mt-2 z-50 bg-[#121216] border border-white/10 rounded-2xl overflow-hidden shadow-2xl max-h-60 overflow-y-auto no-scrollbar"
                      >
                        {searchResults.map((g) => (
                          <button
                            key={g.id}
                            onClick={() => handleSelectEpicGame(g)}
                            className="w-full flex items-center gap-4 p-3 hover:bg-white/5 transition-colors text-left group"
                          >
                            {g.tiny_image ? (
                              <img
                                src={g.tiny_image}
                                alt=""
                                className="w-12 h-6 object-cover rounded opacity-40 group-hover:opacity-100 transition-opacity"
                              />
                            ) : (
                              <div className="w-12 h-6 bg-white/5 rounded" />
                            )}
                            <span className="text-sm text-white/70 group-hover:text-white">
                              {g.name}
                            </span>
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <div className="h-px bg-white/5" />

                <label className="flex items-center gap-2 text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">
                  <Globe size={14} className="text-white/20" /> Epic Catalog ID ({copy.optional})
                </label>
                <input
                  value={formData.epicCatalogId || ""}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      epicCatalogId: e.target.value,
                      executablePath: e.target.value,
                    }))
                  }
                  placeholder="Ex: 963138e4ac8f49c58c149b41c2ee0491"
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-2xl p-4 text-sm text-white outline-none focus:border-white/20 focus:bg-white/[0.06] transition-all placeholder:text-white/20"
                />
                <p className="text-[10px] leading-relaxed text-white/28">
                  Você pode encontrar o Catalog ID na URL do jogo na Epic Games Store ou nas propriedades do atalho do launcher.
                </p>
              </div>
            )}

            <div className="h-px bg-white/5" />

            <div className="grid grid-cols-1 gap-6">
              <div className="space-y-4">
                <label className="flex items-center gap-2 text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">
                  <Type size={14} className="text-white/20" /> {copy.title}
                </label>
                <input
                  value={formData.title}
                  onChange={(e) =>
                    setFormData({ ...formData, title: e.target.value })
                  }
                  placeholder={copy.titlePlaceholder}
                  className="w-full bg-white/[0.03] border border-white/10 rounded-2xl p-4 text-white outline-none focus:border-white/30 transition-all"
                />
              </div>

              <div className="space-y-4">
                <label className="flex items-center gap-2 text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">
                  <Tags size={14} className="text-white/20" /> {copy.category}
                </label>
                <div className="flex flex-wrap gap-2">
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => {
                        playSound("navigate");
                        setFormData({ ...formData, category: cat.id });
                      }}
                      className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border ${
                        formData.category === cat.id
                          ? "bg-white text-black border-white shadow-[0_0_15px_rgba(255,255,255,0.2)]"
                          : "bg-white/5 text-white/40 border-white/5 hover:bg-white/10"
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-4">
                  <label className="flex items-center gap-2 text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">
                    <ImageIcon size={14} className="text-white/20" /> {copy.cover}
                    ({copy.link})
                  </label>
                  <input
                    value={formData.cardImage}
                    onChange={(e) =>
                      setFormData({ ...formData, cardImage: e.target.value })
                    }
                    placeholder="https://..."
                    className="w-full bg-white/[0.03] border border-white/10 rounded-2xl p-4 text-xs text-white/70 outline-none focus:border-white/30 transition-all"
                  />
                  {formData.launcherType === "local" && (
                    <>
                      <input
                        ref={coverInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleCoverSelect}
                      />
                      <button
                        type="button"
                        onClick={() => coverInputRef.current?.click()}
                        className="w-full px-4 py-3 rounded-2xl bg-white/8 border border-white/10 text-[10px] font-black uppercase tracking-wider text-white/70 hover:bg-white/12 hover:text-white transition-all"
                      >
                        {copy.upload}
                      </button>
                    </>
                  )}
                </div>
                <div className="space-y-4">
                  <label className="flex items-center gap-2 text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">
                    <ImageIcon size={14} className="text-white/20" /> Wallpaper
                    (Link)
                  </label>
                  <input
                    value={formData.backgroundImage}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        backgroundImage: e.target.value,
                      })
                    }
                    placeholder="https://..."
                    className="w-full bg-white/[0.03] border border-white/10 rounded-2xl p-4 text-xs text-white/70 outline-none focus:border-white/30 transition-all"
                  />
                  {formData.launcherType === "local" && (
                    <>
                      <input
                        ref={wallpaperInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleWallpaperSelect}
                      />
                      <button
                        type="button"
                        onClick={() => wallpaperInputRef.current?.click()}
                        className="w-full px-4 py-3 rounded-2xl bg-white/8 border border-white/10 text-[10px] font-black uppercase tracking-wider text-white/70 hover:bg-white/12 hover:text-white transition-all"
                      >
                        {copy.upload}
                      </button>
                    </>
                  )}
                </div>
              </div>

              {formData.launcherType === "local" && (
                <div className="space-y-4">
                  <label className="flex items-center gap-2 text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">
                    <FolderOpen size={14} className="text-white/20" />{" "}
                    {copy.executable}
                  </label>
                  <input
                    ref={executableInputRef}
                    type="file"
                    accept=".exe,application/x-msdownload"
                    className="hidden"
                    onChange={handleExecutableSelect}
                  />
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => executableInputRef.current?.click()}
                      className="shrink-0 px-4 py-3 rounded-2xl bg-white/8 border border-white/10 text-[10px] font-black uppercase tracking-wider text-white/70 hover:bg-white/12 hover:text-white transition-all"
                    >
                      {copy.chooseExe}
                    </button>
                    <div className="min-w-0 flex-1 rounded-2xl bg-white/[0.03] border border-white/10 px-4 py-3">
                      <p className="truncate text-xs text-white/70">
                        {formData.executablePath || copy.noExecutable}
                      </p>
                    </div>
                  </div>
                  <p className="text-[10px] leading-relaxed text-white/28">
                    {copy.executableHint}
                  </p>
                </div>
              )}
            </div>

            <button
              disabled={loading || !formData.title}
              onClick={handleSubmit}
              className="w-full py-5 bg-white text-black rounded-2xl font-black text-xs tracking-[0.3em] uppercase hover:bg-[#e0e0e0] active:scale-[0.98] transition-all flex items-center justify-center gap-3 mt-4 shadow-[0_20px_40px_rgba(255,255,255,0.1)] disabled:opacity-30 disabled:grayscale disabled:cursor-not-allowed group relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 pointer-events-none" />
              {loading ? (
                <RefreshCw size={18} className="animate-spin" />
              ) : (
                <>
                  <Play
                    size={16}
                    className="fill-current group-hover:scale-110 transition-transform"
                  />
                  {copy.confirmAdd}
                </>
              )}
            </button>
          </div>

          <div className="bg-black/20 flex flex-col items-center justify-center p-12 relative overflow-hidden group">
            <div className="absolute inset-0 z-0">
              {formData.backgroundImage && (
                <img
                  src={formData.backgroundImage}
                  className="w-full h-full object-cover opacity-20 blur-3xl scale-110 transition-transform duration-1000 group-hover:scale-125"
                  alt=""
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = "";
                  }}
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0c] via-transparent to-transparent" />
            </div>

            <div className="relative z-10 space-y-8 flex flex-col items-center">
              <div className="text-center space-y-1">
                <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.4em]">
                  PrÃ©via no Painel
                </p>
                <div className="h-0.5 w-8 bg-white/10 mx-auto rounded-full" />
              </div>

              <div className="scale-125 transition-transform duration-500 hover:rotate-1 hover:scale-[1.3]">
                <GameCard
                  title={formData.title || "Nome do Jogo"}
                  image={
                    formData.cardImage ||
                    "https://images.unsplash.com/photo-1612287230202-1ff1d85d1bdf?w=400&q=80"
                  }
                  isActive={true}
                />
              </div>

              <div className="pt-8 w-full max-w-[200px]">
                <div className="h-[1px] bg-white/5 w-full mb-4" />
                <div className="flex justify-between items-center px-1">
                  <div className="space-y-1">
                    <p className="text-[8px] font-black text-white/20 uppercase tracking-widest">
                      Categoria
                    </p>
                    <p className="text-[10px] font-bold text-white/60 uppercase">
                      {
                        CATEGORIES.find((c) => c.id === formData.category)
                          ?.label
                      }
                    </p>
                  </div>
                  <div className="w-8 h-8 rounded-full border border-white/5 flex items-center justify-center">
                    <Gamepad2 size={12} className="text-white/20" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </ModalShell>
  );
};

export default AddGameModal;
