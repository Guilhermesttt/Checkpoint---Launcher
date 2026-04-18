import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Image as ImageIcon,
  Tags,
  Type,
  AlignLeft,
  Play,
  Folder,
  Gamepad2,
  Sparkles,
  Clock,
  HardDrive,
} from "lucide-react";
import { addDoc, updateDoc } from "firebase/firestore";
import type { Game } from "../types/domain";
import { useAuth } from "../auth/AuthProvider";
import { apiUrl } from "../services/api";
import {
  fetchSteamAppDetailsResult,
  fetchSteamAppSizeGB,
  fetchSteamAchievements,
  type SteamAppDetails,
} from "../services/steam";
import { useNotification } from "./NotificationCenter";
import { userGameDocRef, userGamesCollectionRef } from "../services/firestorePaths";

type GameFormState = {
  title: string;
  category: string;
  image: string;
  backgroundImage: string;
  cardImage: string;
  logoImage: string;
  description: string;
  trailerUrl: string;
  executablePath: string;
  hoursPlayed: number;
  sizeGB: number;
  launcherType: "steam" | "local";
  screenshots: string[];
  aboutTheGame: string;
  releaseDate: string;
  developer: string;
  publisher: string;
  tags: string[];
  steamAppId: string;
  totalAchievements?: number;
  completedAchievements?: number;
};

const omitUndefined = (obj: Record<string, unknown>) => {
  const next: Record<string, unknown> = { ...obj };
  Object.keys(next).forEach((k) => next[k] === undefined && delete next[k]);
  return next;
};

const mergeSteamStoreIntoForm = (form: GameFormState, details: SteamAppDetails) => ({
  ...form,
  title: details.title || form.title,
  image: details.backgroundImage || form.image,
  backgroundImage: details.backgroundImage || form.backgroundImage,
  cardImage: details.cardImage || form.cardImage,
  logoImage: details.logoImage || form.logoImage,
  description: details.description || form.description,
  trailerUrl: details.trailerUrl || form.trailerUrl,
  screenshots:
    details.screenshots && details.screenshots.length > 0 ? details.screenshots : form.screenshots,
  aboutTheGame: details.aboutTheGame || details.description || form.aboutTheGame,
  releaseDate: details.releaseDate || form.releaseDate,
  developer: details.developer || form.developer,
  publisher: details.publisher || form.publisher,
  tags: details.tags && details.tags.length > 0 ? details.tags : form.tags,
  steamAppId: details.appId || form.steamAppId,
});

interface AddGameModalProps {
  isOpen: boolean;
  onClose: (silent?: boolean) => void;
  playSound: (type: "select" | "back" | "navigate") => void;
  gameToEdit?: Game | null;
  onSaved?: () => void;
}

const AddGameModal: React.FC<AddGameModalProps> = ({
  isOpen,
  onClose,
  playSound,
  gameToEdit,
  onSaved,
}) => {
  const { user, userProfile } = useAuth();
  const { notify } = useNotification();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"info" | "media" | "advanced">("info");
  const [formData, setFormData] = useState({
    title: "",
    category: "ROLEPLAYING",
    image: "",
    backgroundImage: "",
    cardImage: "",
    logoImage: "",
    description: "",
    trailerUrl: "",
    executablePath: "",
    hoursPlayed: 0,
    sizeGB: 0,
    launcherType: "local" as "steam" | "local",
    screenshots: [] as string[],
    aboutTheGame: "",
    releaseDate: "",
    developer: "",
    publisher: "",
    tags: [] as string[],
    steamAppId: "",
  });
  const [steamId, setSteamId] = useState("");

  React.useEffect(() => {
    if (isOpen) {
      if (gameToEdit) {
        setFormData({
          title: gameToEdit.title || "",
          category: gameToEdit.category || "ROLEPLAYING",
          image: gameToEdit.image || "",
          backgroundImage: gameToEdit.backgroundImage || gameToEdit.image || "",
          cardImage: gameToEdit.cardImage || "",
          logoImage: gameToEdit.logoImage || "",
          description: gameToEdit.description || "",
          trailerUrl: gameToEdit.trailerUrl || "",
          executablePath: gameToEdit.executablePath || "",
          hoursPlayed: gameToEdit.hoursPlayed || 0,
          sizeGB: gameToEdit.sizeGB || 0,
          launcherType: gameToEdit.launcherType || "local",
          screenshots: gameToEdit.screenshots || [],
          aboutTheGame: gameToEdit.aboutTheGame || "",
          releaseDate: gameToEdit.releaseDate || "",
          developer: gameToEdit.developer || "",
          publisher: gameToEdit.publisher || "",
          tags: gameToEdit.tags || [],
          steamAppId: gameToEdit.steamAppId || "",
          totalAchievements: gameToEdit.totalAchievements || 0,
          completedAchievements: gameToEdit.completedAchievements || 0,
        });
        // Extract steam ID if possible from executable path
        if (gameToEdit.executablePath && /^\d+$/.test(gameToEdit.executablePath)) {
          setSteamId(gameToEdit.executablePath);
        }
      } else {
        setFormData({
          title: "",
          category: "ROLEPLAYING",
          image: "",
          backgroundImage: "",
          cardImage: "",
          logoImage: "",
          description: "",
          trailerUrl: "",
          executablePath: "",
          hoursPlayed: 0,
          sizeGB: 0,
          launcherType: "local" as "steam" | "local",
          screenshots: [],
          aboutTheGame: "",
          releaseDate: "",
          developer: "",
          publisher: "",
          tags: [],
          steamAppId: "",
          totalAchievements: 0,
          completedAchievements: 0,
        });
        setSteamId("");
      }
      setActiveTab("info");
    }
  }, [isOpen, gameToEdit]);

  const categories = ["RACING", "ROLEPLAYING", "SPORTS", "ONLINE", "SHOOTER"];

  const handleBrowse = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.onchange = (e: Event) => {
      const target = e.target as HTMLInputElement | null;
      const file = target?.files?.[0];
      if (file) {
        setFormData((prev) => ({ ...prev, executablePath: file.name }));
      }
    };
    input.click();
  };

  const handleSteamAutoFill = async () => {
    const normalizedSteamId = steamId.trim();
    if (!/^\d+$/.test(normalizedSteamId)) return;
    playSound("select");
    
    // Steam CDN Assets
    const header = `https://cdn.akamai.steamstatic.com/steam/apps/${normalizedSteamId}/library_hero.jpg`;
    const card = `https://cdn.akamai.steamstatic.com/steam/apps/${normalizedSteamId}/library_600x900_2x.jpg`;
    
    const [sizeGB, detailsResult, achievements] = await Promise.all([
      fetchSteamAppSizeGB(normalizedSteamId).catch(() => undefined),
      fetchSteamAppDetailsResult(normalizedSteamId),
      userProfile?.steamId 
        ? fetchSteamAchievements(userProfile.steamId, normalizedSteamId).catch(() => null)
        : Promise.resolve(null)
    ]);

    const details = detailsResult.ok ? detailsResult.data : null;
    if (detailsResult.ok === false) {
      notify(detailsResult.message, "info");
    }

    setFormData(prev => ({
      ...prev,
      image: details?.backgroundImage || header,
      backgroundImage: details?.backgroundImage || header,
      cardImage: details?.cardImage || card,
      logoImage: details?.logoImage || prev.logoImage,
      description: details?.description || prev.description,
      trailerUrl: details?.trailerUrl || prev.trailerUrl,
      executablePath: normalizedSteamId, // Auto-fill path as Steam ID for easy launching
      launcherType: "steam",
      sizeGB: typeof sizeGB === "number" ? Math.round(sizeGB) : prev.sizeGB,
      screenshots: details?.screenshots || prev.screenshots,
      aboutTheGame: details?.aboutTheGame || details?.description || prev.aboutTheGame,
      releaseDate: details?.releaseDate || prev.releaseDate,
      developer: details?.developer || prev.developer,
      publisher: details?.publisher || prev.publisher,
      tags: details?.tags || prev.tags,
      totalAchievements: achievements?.total ?? 0,
      completedAchievements: achievements?.unlocked ?? 0,
      steamAppId: normalizedSteamId,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    playSound("select");

    try {
      const normalizedSteamId = steamId.trim();
      const normalizedExecutablePath = formData.executablePath.trim();

      let effectiveSteamId = "";
      if (formData.launcherType === "steam") {
        effectiveSteamId = normalizedSteamId || normalizedExecutablePath;
        if (!/^\d+$/.test(effectiveSteamId)) {
          notify("Para jogo Steam, informe um App ID numérico válido.", "error");
          setLoading(false);
          return;
        }
      }

      let mergedForm: GameFormState = { ...formData };
      if (formData.launcherType === "steam") {
        const [sizeGB, storeResult, achievements] = await Promise.all([
          fetchSteamAppSizeGB(effectiveSteamId).catch(() => undefined),
          fetchSteamAppDetailsResult(effectiveSteamId),
          userProfile?.steamId 
            ? fetchSteamAchievements(userProfile.steamId, effectiveSteamId).catch(() => null)
            : Promise.resolve(null)
        ]);
        if (storeResult.ok === false) {
          notify(
            `${storeResult.message} O jogo será salvo só com os dados do formulário.`,
            "info",
          );
        } else {
          mergedForm = mergeSteamStoreIntoForm(mergedForm, storeResult.data);
        }
        if (achievements) {
          mergedForm = {
            ...mergedForm,
            totalAchievements: achievements.total,
            completedAchievements: achievements.unlocked,
          };
        }
        if (typeof sizeGB === "number") {
          mergedForm = { ...mergedForm, sizeGB: Math.max(0, Math.round(sizeGB)) };
        }
      }

      const payload = omitUndefined({
        ...mergedForm,
        executablePath:
          formData.launcherType === "steam" ? effectiveSteamId : normalizedExecutablePath,
        hoursPlayed: Math.max(0, Math.round(mergedForm.hoursPlayed)),
        sizeGB: Math.max(0, Math.round(mergedForm.sizeGB)),
        steamAppId: formData.launcherType === "steam" ? effectiveSteamId : "",
        updatedAt: new Date().toISOString(),
      }) as Record<string, unknown>;

      // Close modal immediately for "instant" feel
      onClose(true);

      if (gameToEdit) {
        if (!user?.uid) throw new Error("Sessão inválida.");
        await updateDoc(userGameDocRef(user.uid, gameToEdit.id), payload);
      } else {
        if (!user?.uid) {
          notify("Sessão inválida. Faça login novamente.", "error");
          return;
        }
        await addDoc(userGamesCollectionRef(user.uid), {
          ...payload,
          createdAt: new Date().toISOString(),
          source: "manual",
        });
      }
      onSaved?.();
    } catch (error) {
      console.error("Erro ao salvar no Firestore:", error);
      notify("Erro ao salvar no banco de dados.", "error");
    } finally {
      setLoading(false);
    }
  };

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Array<{ id: number; name: string; tiny_image?: string }>>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  React.useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (searchQuery.length > 2) {
        searchGames(searchQuery);
      } else {
        setSearchResults([]);
        setSearchError(null);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  const searchGames = async (query: string) => {
    const trimmed = query.trim();
    if (trimmed.length < 2) return;
    
    setIsSearching(true);
    setSearchError(null);
    try {
      let response = await fetch(apiUrl(`/api/steam/search?query=${encodeURIComponent(trimmed)}`));
      if (response.status === 404) {
        response = await fetch(apiUrl(`/api/steam/search-games?query=${encodeURIComponent(trimmed)}`));
      }
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error || "Falha ao buscar jogos da Steam.");
      }
      const data = (await response.json()) as { items?: Array<{ id: number; name: string; tiny_image?: string }> };
      setSearchResults(data.items || []);
    } catch (error) {
      console.error("Search error:", error);
      setSearchResults([]);
      const message =
        error instanceof TypeError
          ? "Backend Steam offline. Inicie com npm run server ou npm run dev:full."
          : error instanceof Error
            ? error.message
            : "Erro na busca da Steam.";
      setSearchError(message);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectGame = async (game: { id: number; name: string; tiny_image?: string }) => {
    playSound("select");
    const appId = String(game.id);
    
    const header = `https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/${appId}/library_hero.jpg`;
    const card = `https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/${appId}/library_600x900_2x.jpg`;

    const [sizeGB, detailsResult, achievements] = await Promise.all([
      fetchSteamAppSizeGB(appId).catch(() => undefined),
      fetchSteamAppDetailsResult(appId),
      userProfile?.steamId 
        ? fetchSteamAchievements(userProfile.steamId, appId).catch(() => null)
        : Promise.resolve(null)
    ]);
    const details = detailsResult.ok ? detailsResult.data : null;
    if (detailsResult.ok === false) {
      notify(detailsResult.message, "info");
    }

    setFormData({
      ...formData,
      title: details?.title || game.name,
      image: details?.backgroundImage || header,
      backgroundImage: details?.backgroundImage || header,
      cardImage: details?.cardImage || card,
      logoImage: details?.logoImage || formData.logoImage,
      executablePath: appId,
      description:
        details?.description ||
        `Official Steam ID: ${appId}. Experience ${game.name} in its full glory.`,
      trailerUrl: details?.trailerUrl || formData.trailerUrl,
      launcherType: "steam",
      sizeGB: sizeGB ? Math.round(sizeGB) : formData.sizeGB,
      screenshots: details?.screenshots || [],
      aboutTheGame: details?.aboutTheGame || details?.description || "",
      releaseDate: details?.releaseDate || "",
      developer: details?.developer || "",
      publisher: details?.publisher || "",
      tags: details?.tags || [],
      totalAchievements: achievements?.total ?? 0,
      completedAchievements: achievements?.unlocked ?? 0,
      steamAppId: appId,
    });
    setSteamId(appId);
    setSearchResults([]);
    setSearchQuery("");
    setActiveTab("advanced");
  };

  const tabs = [
    { id: "info", label: "Busca e Info", icon: <Type className="w-4 h-4" /> },
    { id: "media", label: "Mídia", icon: <ImageIcon className="w-4 h-4" /> },
    { id: "advanced", label: "Avançado", icon: <Gamepad2 className="w-4 h-4" /> },
  ] as const;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[150] flex items-center justify-center p-6"
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/70 backdrop-blur-2xl"
            onClick={() => {
              playSound("back");
              onClose();
            }}
          />

          {/* Modal */}
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 30 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 30 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="relative w-full max-w-3xl liquid-glass-dark rounded-[2rem] overflow-hidden shadow-2xl"
          >
            {/* Header */}
            <div className="relative px-8 pt-8 pb-6 border-b border-white/5">
              {/* Decorative Element */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-1 bg-gradient-to-r from-transparent via-white/20 to-transparent rounded-full" />
              
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 liquid-glass rounded-2xl flex items-center justify-center">
                    <Sparkles className="w-6 h-6 text-blue-400" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-semibold tracking-tight text-white">
                      {gameToEdit ? "Editar Jogo" : "Novo Jogo"}
                    </h2>
                    <p className="text-white/40 text-sm mt-0.5">
                      {gameToEdit ? "Atualize as informações do jogo" : "Adicione um novo título à biblioteca"}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    playSound("back");
                    onClose();
                  }}
                  onMouseEnter={() => playSound("navigate")}
                  className="p-3 rounded-xl hover:bg-white/10 transition-colors group"
                >
                  <X className="w-5 h-5 text-white/50 group-hover:text-white transition-colors" />
                </button>
              </div>

              {/* Tab Navigation */}
              <div className="flex items-center gap-2 mt-6">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => {
                      playSound("navigate");
                      setActiveTab(tab.id);
                    }}
                    onMouseEnter={() => playSound("navigate")}
                    className={`
                      flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium
                      transition-all duration-300
                      ${activeTab === tab.id
                        ? 'liquid-glass text-white'
                        : 'text-white/40 hover:text-white/70 hover:bg-white/5'
                      }
                    `}
                  >
                    {tab.icon}
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Content */}
            <form onSubmit={handleSubmit}>
              <div className="p-8 max-h-[60vh] overflow-y-auto no-scrollbar">
                <AnimatePresence mode="wait">
                  {activeTab === "info" && (
                    <motion.div
                      key="info"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      className="flex flex-col gap-6"
                    >
                      <div className="flex flex-col gap-4">
                        <FormField
                          label="Tipo de Jogo"
                          icon={<Gamepad2 className="w-4 h-4" />}
                        >
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                playSound("select");
                                setFormData({ ...formData, launcherType: "steam" });
                              }}
                              onMouseEnter={() => playSound("navigate")}
                              className={`px-4 py-2.5 rounded-xl text-xs font-bold tracking-[0.1em] uppercase transition-all duration-300 ${
                                formData.launcherType === "steam"
                                  ? "liquid-glass text-white"
                                  : "bg-white/5 text-white/40 hover:text-white/70 hover:bg-white/10 border border-white/5"
                              }`}
                            >
                              Steam
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                playSound("select");
                                setFormData({ ...formData, launcherType: "local" });
                              }}
                              onMouseEnter={() => playSound("navigate")}
                              className={`px-4 py-2.5 rounded-xl text-xs font-bold tracking-[0.1em] uppercase transition-all duration-300 ${
                                formData.launcherType === "local"
                                  ? "liquid-glass text-white"
                                  : "bg-white/5 text-white/40 hover:text-white/70 hover:bg-white/10 border border-white/5"
                              }`}
                            >
                              Local
                            </button>
                          </div>
                        </FormField>

                        <FormField
                          label="Procurar Jogo"
                          icon={<Sparkles className="w-4 h-4" />}
                        >
                          <div className="relative">
                            <input
                              className="form-input"
                              placeholder="Digite o nome do jogo... (ex: Elden Ring)"
                              value={searchQuery}
                              onChange={(e) => setSearchQuery(e.target.value)}
                            />
                            {isSearching && (
                              <div className="absolute right-4 top-1/2 -translate-y-1/2">
                                <div className="w-4 h-4 border-2 border-blue-400/30 border-t-blue-400 rounded-full animate-spin" />
                              </div>
                            )}

                            {/* Search Results Dropdown */}
                            <AnimatePresence>
                              {searchResults.length > 0 && (
                                <motion.div
                                  initial={{ opacity: 0, y: 10 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  exit={{ opacity: 0, y: 10 }}
                                  className="absolute left-0 right-0 top-full mt-2 z-50 liquid-glass-dark rounded-2xl overflow-hidden border border-white/10 shadow-2xl max-h-60 overflow-y-auto no-scrollbar"
                                >
                                  {searchResults.map((game) => (
                                    <button
                                      key={game.id}
                                      type="button"
                                      onClick={() => handleSelectGame(game)}
                                      onMouseEnter={() => playSound("navigate")}
                                      className="w-full flex items-center gap-4 p-3 hover:bg-white/10 transition-colors text-left border-b border-white/5 last:border-0"
                                    >
                                      <img
                                        src={game.tiny_image || `https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/${game.id}/header.jpg`}
                                        alt=""
                                        className="w-16 h-8 object-cover rounded shadow"
                                      />
                                      <div className="flex-1">
                                        <p className="text-sm font-medium text-white">{game.name}</p>
                                        <p className="text-[10px] text-white/40 uppercase tracking-widest">Steam ID: {game.id}</p>
                                      </div>
                                    </button>
                                  ))}
                                </motion.div>
                              )}
                            </AnimatePresence>
                            {searchError && (
                              <p className="mt-2 text-xs text-amber-300/90">{searchError}</p>
                            )}
                          </div>
                        </FormField>

                        <div className="grid grid-cols-2 gap-4">
                          <FormField
                            label="Título do Jogo"
                            icon={<Type className="w-4 h-4" />}
                            required
                          >
                            <input
                              required
                              className="form-input"
                              placeholder="Ex: Silent Hill 2"
                              value={formData.title}
                              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                            />
                          </FormField>
                          <FormField
                            label="Steam App ID"
                            icon={<Gamepad2 className="w-4 h-4" />}
                          >
                            <div className="flex gap-2">
                              <input
                                className="form-input"
                                placeholder="ID"
                                value={steamId}
                                onChange={(e) => setSteamId(e.target.value)}
                              />
                              <button
                                type="button"
                                onClick={handleSteamAutoFill}
                                onMouseEnter={() => playSound("navigate")}
                                className="px-4 rounded-xl liquid-glass hover:bg-white/10 transition-colors text-[10px] font-bold tracking-[0.08em] uppercase text-white/80"
                              >
                                Auto Fill
                              </button>
                            </div>
                          </FormField>
                        </div>
                      </div>

                      <FormField
                        label="Categoria"
                        icon={<Tags className="w-4 h-4" />}
                      >
                        <div className="flex flex-wrap gap-2">
                          {categories.map((cat) => (
                            <button
                              key={cat}
                              type="button"
                              onClick={() => {
                                playSound("select");
                                setFormData({ ...formData, category: cat });
                              }}
                              onMouseEnter={() => playSound("navigate")}
                              className={`
                                px-4 py-2.5 rounded-xl text-xs font-bold tracking-[0.1em] uppercase
                                transition-all duration-300
                                ${formData.category === cat
                                  ? 'liquid-glass text-white'
                                  : 'bg-white/5 text-white/40 hover:text-white/70 hover:bg-white/10 border border-white/5'
                                }
                              `}
                            >
                              {cat}
                            </button>
                          ))}
                        </div>
                      </FormField>

                      <FormField
                        label="Descrição"
                        icon={<AlignLeft className="w-4 h-4" />}
                      >
                        <textarea
                          rows={3}
                          className="form-input resize-none"
                          placeholder="Diga algo sobre o jogo..."
                          value={formData.description}
                          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        />
                      </FormField>
                    </motion.div>
                  )}

                  {activeTab === "media" && (
                    <motion.div
                      key="media"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      className="flex flex-col gap-6"
                    >
                      <div className="grid grid-cols-2 gap-6">
                        <FormField
                          label="URL da Capa (Vertical)"
                          icon={<ImageIcon className="w-4 h-4" />}
                          required
                        >
                          <input
                            required
                            className="form-input"
                            placeholder="https://..."
                            value={formData.cardImage}
                            onChange={(e) => setFormData({ ...formData, cardImage: e.target.value })}
                          />
                          {formData.cardImage && (
                            <div className="mt-3 w-24 h-32 rounded-xl overflow-hidden ring-1 ring-white/10">
                              <img 
                                src={formData.cardImage} 
                                alt="Preview" 
                                className="w-full h-full object-cover" 
                                onError={(e) => {
                                  const target = e.target as HTMLImageElement;
                                  if (steamId && !target.src.includes('header.jpg')) {
                                    target.src = `https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/${steamId}/header.jpg`;
                                  }
                                }}
                              />
                            </div>
                          )}
                        </FormField>

                        <FormField
                          label="URL do Wallpaper (Horizontal)"
                          icon={<ImageIcon className="w-4 h-4" />}
                          required
                        >
                          <input
                            required
                            className="form-input"
                            placeholder="https://..."
                            value={formData.image}
                            onChange={(e) => setFormData({ ...formData, image: e.target.value })}
                          />
                          {formData.image && (
                            <div className="mt-3 w-full h-24 rounded-xl overflow-hidden ring-1 ring-white/10">
                              <img 
                                src={formData.image} 
                                alt="Preview" 
                                className="w-full h-full object-cover" 
                                onError={(e) => {
                                  const target = e.target as HTMLImageElement;
                                  if (steamId && !target.src.includes('header.jpg')) {
                                    target.src = `https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/${steamId}/header.jpg`;
                                  }
                                }}
                              />
                            </div>
                          )}
                        </FormField>
                      </div>
                    </motion.div>
                  )}

                  {activeTab === "advanced" && (
                    <motion.div
                      key="advanced"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      className="flex flex-col gap-6"
                    >
                      <FormField
                        label="Caminho do Executável"
                        icon={<Play className="w-4 h-4" />}
                      >
                        <div className="flex gap-3">
                          <input
                            className="form-input flex-1"
                            placeholder="Caminho local ou Steam App ID"
                            value={formData.executablePath}
                            onChange={(e) => setFormData({ ...formData, executablePath: e.target.value })}
                          />
                          <button
                            type="button"
                            onClick={handleBrowse}
                            onMouseEnter={() => playSound("navigate")}
                            className="px-5 liquid-glass rounded-xl hover:bg-white/10 transition-all flex items-center gap-2 group"
                          >
                            <Folder className="w-4 h-4 text-white/50 group-hover:text-white transition-colors" />
                            <span className="text-sm font-medium text-white/50 group-hover:text-white transition-colors">
                              Upload
                            </span>
                          </button>
                        </div>
                      </FormField>

                      <div className="grid grid-cols-2 gap-6">
                        <FormField
                          label="Horas Jogadas"
                          icon={<Clock className="w-4 h-4 text-white/40" />}
                        >
                          <input
                            type="number"
                            step="0.1"
                            className="form-input"
                            value={formData.hoursPlayed}
                            onChange={(e) => setFormData({ ...formData, hoursPlayed: parseFloat(e.target.value) || 0 })}
                          />
                        </FormField>
                        <FormField
                          label="Tamanho do Jogo (GB)"
                          icon={<HardDrive className="w-4 h-4 text-white/40" />}
                        >
                          <input
                            type="number"
                            className="form-input"
                            value={formData.sizeGB}
                            onChange={(e) => setFormData({ ...formData, sizeGB: parseInt(e.target.value) || 0 })}
                          />
                        </FormField>
                      </div>

                      <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
                        <p className="text-[11px] text-blue-300/80 leading-relaxed">
                          O arquivo do jogo deve ser selecionado para permitir a abertura direta. 
                          Se for um jogo da Steam, o ID do app é suficiente para o lançamento.
                        </p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Footer */}
              <div className="px-8 py-6 border-t border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <ControlHint
                    icon="X"
                    label="CANCELAR"
                    onMouseEnter={() => playSound("navigate")}
                    onClick={() => {
                      playSound("back");
                      onClose();
                    }}
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  onMouseEnter={() => playSound("navigate")}
                  className={`
                    px-8 py-4 rounded-2xl flex items-center gap-3
                    text-sm font-bold tracking-[0.1em] uppercase transition-all
                    ${loading 
                      ? 'bg-white/10 text-white/30 cursor-not-allowed' 
                      : 'bg-white text-black hover:scale-[1.02] active:scale-98 shadow-[0_0_40px_rgba(255,255,255,0.15)]'
                    }
                  `}
                >
                  {loading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white/80 rounded-full animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 fill-current" />
                      {gameToEdit ? "Salvar Alterações" : "Adicionar Jogo"}
                    </>
                  )}
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// Sub-components
const FormField: React.FC<{
  label: string;
  icon: React.ReactNode;
  required?: boolean;
  children: React.ReactNode;
}> = ({ label, icon, required, children }) => (
  <div className="flex flex-col gap-3">
    <label className="flex items-center gap-2 text-sm font-medium text-white/60">
      {icon}
      {label}
      {required && <span className="text-blue-400">*</span>}
    </label>
    {children}
  </div>
);

const ControlHint: React.FC<{
  icon: string;
  label: string;
  onClick?: () => void;
  onMouseEnter?: () => void;
}> = ({ icon, label, onClick, onMouseEnter }) => (
  <button 
    type="button"
    onClick={onClick}
    onMouseEnter={onMouseEnter}
    className="flex items-center gap-2 text-white/40 hover:text-white/70 transition-colors"
  >
    <span className="w-6 h-6 rounded-full border border-white/20 flex items-center justify-center text-[10px]">
      {icon}
    </span>
    <span className="text-[9px] font-bold tracking-[0.15em] uppercase">{label}</span>
  </button>
);

export default AddGameModal;
