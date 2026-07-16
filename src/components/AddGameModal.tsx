import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  ImageIcon,
  Type,
  Search,
  Tags,
  Globe,
  Gamepad2,
  RefreshCw,
  FolderOpen,
  HardDrive,
  Check,
  CheckCircle2,
  ChevronDown,
  LibraryBig,
  Sparkles,
  Upload,
} from "lucide-react";
import { addDoc, updateDoc, deleteField } from "firebase/firestore";
import ModalShell from "./ui/ModalShell";
import { useAuth } from "../auth/AuthProvider";
import { usePreferences } from "../context/PreferencesContext";
import { EPIC_GAMES_ICON_PATH } from "../constants/assets";
import { useNotification } from "./NotificationCenter";
import {
  userGamesCollectionRef,
  userGameDocRef,
} from "../services/firestorePaths";
import { fetchSteamAppDetailsResult } from "../services/steam";
import {
  fetchEpicAppDetailsResult,
  searchEpicGames,
} from "../services/epic";
import { apiUrl } from "../services/api";
import type { SoundEffectType } from "../hooks/useSoundEffects";

interface AddGameModalProps {
  isOpen: boolean;
  onClose: (silent?: boolean) => void;
  playSound: (type: SoundEffectType) => void;
  gameToEdit?: any | null;
  onSaved?: () => void;
}

const EpicIcon: React.FC<{ className?: string }> = ({ className }) => (
  <img
    width={96}
    height={96}
    src={EPIC_GAMES_ICON_PATH}
    alt="Epic Games"
    className={className}
    style={{ filter: "invert(1)" }}
  />
);

const CATEGORIES = [
  { id: "ACTION", label: "Ação" },
  { id: "ADVENTURE", label: "Aventura" },
  { id: "RACING", label: "Corrida" },
  { id: "RPG", label: "RPG" },
  { id: "SHOOTER", label: "FPS" },
  { id: "ARCADE", label: "Arcade" },
  { id: "FIGHTING", label: "Luta" },
  { id: "ROLE_PLAYING", label: "Role Playing" },
  { id: "Multiplayer", label: "Multiplayer" },
  { id: "SPORTS", label: "Esportes" },
  { id: "HORROR", label: "Terror" },
  { id: "STRATEGY", label: "Estratégia" },
  { id: "SIMULATION", label: "Simulação" },
  { id: "PUZZLE", label: "Quebra-Cabeça" },
  { id: "CASUAL", label: "Casual" },
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
  epicLaunchId?: string;
  epicStoreUrl?: string;
  sizeGB?: number;
  releaseDate?: string;
  developer?: string;
  publisher?: string;
  tags?: string[];
  trailerUrl?: string;
  screenshots?: string[];
  source?: "manual" | "steam" | "epic";
  hasGame?: boolean;
};

const removeUndefined = (data: Record<string, unknown>) =>
  Object.fromEntries(
    Object.entries(data).filter(([, value]) => value !== undefined),
  );

const isWindowsExecutablePath = (value: string) =>
  /^(?:[a-zA-Z]:[\\/]|\\\\).+\.exe$/i.test(String(value || "").trim());

// Dropdown de busca reutilizado entre Steam e Epic — antes era duplicado
// quase inteiro em dois blocos JSX separados.
const GameSearchDropdown: React.FC<{
  id: string;
  results: any[];
  isSearching: boolean;
  hasQuery: boolean;
  noResultsLabel: string;
  onSelect: (game: any) => void;
}> = ({ id, results, isSearching, hasQuery, noResultsLabel, onSelect }) => {
  const showEmptyState =
    hasQuery && !isSearching && results.length === 0;

  if (!isSearching && !showEmptyState && results.length === 0) return null;

  return (
    <AnimatePresence>
      <motion.div
        id={id}
        role="listbox"
        aria-label="Resultados da busca"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 10 }}
        className="absolute left-0 right-0 top-full mt-2 z-50 bg-[#121216] border border-white/10 rounded-2xl overflow-hidden shadow-2xl max-h-60 overflow-y-auto no-scrollbar"
      >
        {isSearching && (
          <div className="flex items-center gap-3 p-4 text-white/40">
            <RefreshCw size={14} className="animate-spin" />
            <span className="text-xs">Buscando...</span>
          </div>
        )}
        {!isSearching && showEmptyState && (
          <div className="p-4 text-xs text-white/40">{noResultsLabel}</div>
        )}
        {!isSearching &&
          results.map((g) => (
            <button
              type="button"
              role="option"
              aria-selected="false"
              key={g.id}
              onClick={() => onSelect(g)}
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
    </AnimatePresence>
  );
};

const AddGameModal: React.FC<AddGameModalProps> = ({
  isOpen,
  onClose,
  playSound,
  gameToEdit,
  onSaved,
}) => {
  const { user } = useAuth();
  const { language } = usePreferences();
  const copy = {
    "pt-BR": {
      editInfo: "Editar informações",
      addGame: "Adicionar Jogo",
      steamSearch: "Buscar na Steam",
      epicSearch: "Buscar na Epic",
      optional: "Opcional",
      searchPlaceholder: "Pesquisar jogo para auto-preenchimento...",
      title: "Título",
      titlePlaceholder: "Nome do seu jogo",
      category: "Categoria",
      cover: "Capa",
      link: "Link",
      platform: "Plataforma",
      steam: "Steam",
      local: "Local",
      epic: "Epic Games",
      upload: "Upload",
      confirmAdd: "Confirmar Adição",
      saving: "Salvando...",
      executable: "Executável",
      chooseExe: "Selecionar .exe",
      executableHint:
        "No navegador, o sistema não expõe o caminho completo. Em runtime desktop, o caminho local pode ser usado para iniciar o jogo.",
      noExecutable: "Nenhum executável selecionado",
      noSearchResults: "Nenhum resultado encontrado.",
      searchError: "Erro ao buscar jogos. Tente novamente.",
      sizeGB: "Tamanho (GB)",
      sizePlaceholder: "Ex: 42",
      missingCoverOrExe:
        "Adicione uma capa ou selecione um executável antes de salvar.",
      viewOnEpicStore: "Ver na Epic Games Store",
      ownGameConfirmed: "Tenho esse jogo",
      ownGameConfirm: "Confirmar que possuo este jogo",
      previewPanel: "Prévia no Painel",
      wallpaper: "Wallpaper",
      libraryKicker: "Biblioteca Checkpoint",
      addSubtitle: "Adicione, organize e prepare um novo jogo para iniciar pelo launcher.",
      editSubtitle: "Atualize os dados, as artes e a forma de inicialização deste jogo.",
      localDescription: "Jogos instalados no PC e executáveis personalizados.",
      steamDescription: "Metadados, biblioteca e inicialização pela Steam.",
      epicDescription: "Catálogo da Epic com inicialização local opcional.",
      automaticFill: "Preenchimento automático",
      automaticFillHint: "Busque o jogo para importar capa, descrição e metadados.",
      gameDetails: "Identidade do jogo",
      gameDetailsHint: "Revise como o jogo será exibido na sua biblioteca.",
      visualAssets: "Artes da biblioteca",
      visualAssetsHint: "Use links ou envie arquivos locais para personalizar o card.",
      description: "Descrição",
      descriptionPlaceholder: "Uma breve descrição do jogo...",
      cancel: "Cancelar",
      saveChanges: "Salvar alterações",
      ready: "Pronto para salvar",
      missingFields: "Complete os itens necessários",
      setupStatus: "Status do cadastro",
      sourceReady: "Plataforma definida",
      titleReady: "Título informado",
      launchReady: "Jogo confirmado",
      selected: "Selecionado",
      imageTooLarge: "A imagem ficou grande demais. Escolha uma arte menor ou use um link.",
    },
    "en-US": {
      editInfo: "Edit information",
      addGame: "Add Game",
      steamSearch: "Search Steam",
      epicSearch: "Search Epic",
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
      noSearchResults: "No results found.",
      searchError: "Error searching games. Please try again.",
      sizeGB: "Size (GB)",
      sizePlaceholder: "E.g. 42",
      missingCoverOrExe:
        "Add a cover image or select an executable before saving.",
      viewOnEpicStore: "View on Epic Games Store",
      ownGameConfirmed: "I own this game",
      ownGameConfirm: "Confirm you own this game",
      previewPanel: "Dashboard Preview",
      wallpaper: "Wallpaper",
      libraryKicker: "Checkpoint Library",
      addSubtitle: "Add, organize and prepare a new game to launch from Checkpoint.",
      editSubtitle: "Update this game's details, artwork and launch method.",
      localDescription: "Installed PC games and custom executables.",
      steamDescription: "Steam metadata, library ownership and launch support.",
      epicDescription: "Epic catalog metadata with optional local launching.",
      automaticFill: "Automatic details",
      automaticFillHint: "Search for a game to import artwork, description and metadata.",
      gameDetails: "Game identity",
      gameDetailsHint: "Review how the game will appear in your library.",
      visualAssets: "Library artwork",
      visualAssetsHint: "Use links or local files to customize the game card.",
      description: "Description",
      descriptionPlaceholder: "A short description of the game...",
      cancel: "Cancel",
      saveChanges: "Save changes",
      ready: "Ready to save",
      missingFields: "Complete the required items",
      setupStatus: "Setup status",
      sourceReady: "Platform selected",
      titleReady: "Title provided",
      launchReady: "Game confirmed",
      selected: "Selected",
      imageTooLarge: "The image is too large. Choose a smaller file or use an image URL.",
    },
    "es-ES": {
      editInfo: "Editar información",
      addGame: "Añadir juego",
      steamSearch: "Buscar en Steam",
      epicSearch: "Buscar en Epic",
      optional: "Opcional",
      searchPlaceholder: "Buscar juego para autocompletar...",
      title: "Título",
      titlePlaceholder: "Nombre de tu juego",
      category: "Categoría",
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
      noExecutable: "Ningún ejecutable seleccionado",
      noSearchResults: "No se encontraron resultados.",
      searchError: "Error al buscar juegos. Inténtalo de nuevo.",
      sizeGB: "Tamaño (GB)",
      sizePlaceholder: "Ej: 42",
      missingCoverOrExe:
        "Añade una portada o selecciona un ejecutable antes de guardar.",
      viewOnEpicStore: "Ver en Epic Games Store",
      ownGameConfirmed: "Tengo este juego",
      ownGameConfirm: "Confirmar que posees este juego",
      previewPanel: "Vista previa del panel",
      wallpaper: "Fondo",
      libraryKicker: "Biblioteca Checkpoint",
      addSubtitle: "Añade, organiza y prepara un nuevo juego para iniciarlo desde Checkpoint.",
      editSubtitle: "Actualiza los datos, las imágenes y el método de inicio del juego.",
      localDescription: "Juegos instalados en PC y ejecutables personalizados.",
      steamDescription: "Metadatos, biblioteca e inicio mediante Steam.",
      epicDescription: "Catálogo de Epic con inicio local opcional.",
      automaticFill: "Relleno automático",
      automaticFillHint: "Busca el juego para importar imágenes, descripción y metadatos.",
      gameDetails: "Identidad del juego",
      gameDetailsHint: "Revisa cómo aparecerá el juego en tu biblioteca.",
      visualAssets: "Imágenes de la biblioteca",
      visualAssetsHint: "Usa enlaces o archivos locales para personalizar la tarjeta.",
      description: "Descripción",
      descriptionPlaceholder: "Una breve descripción del juego...",
      cancel: "Cancelar",
      saveChanges: "Guardar cambios",
      ready: "Listo para guardar",
      missingFields: "Completa los elementos necesarios",
      setupStatus: "Estado del registro",
      sourceReady: "Plataforma definida",
      titleReady: "Título informado",
      launchReady: "Juego confirmado",
      selected: "Seleccionado",
      imageTooLarge: "La imagen es demasiado grande. Elige un archivo menor o usa un enlace.",
    },
  }[language];
  const { notify } = useNotification();
  const executableInputRef = React.useRef<HTMLInputElement>(null);
  const coverInputRef = React.useRef<HTMLInputElement>(null);
  const wallpaperInputRef = React.useRef<HTMLInputElement>(null);
  const searchDebounceRef = React.useRef<number | null>(null);
  const searchRequestRef = React.useRef(0);
  const detailsRequestRef = React.useRef(0);
  const [loading, setLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

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
      searchRequestRef.current += 1;
      detailsRequestRef.current += 1;
      if (searchDebounceRef.current) {
        window.clearTimeout(searchDebounceRef.current);
        searchDebounceRef.current = null;
      }
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
          epicLaunchId: gameToEdit.epicLaunchId || "",
          epicStoreUrl: gameToEdit.epicStoreUrl || "",
          sizeGB: gameToEdit.sizeGB,
          releaseDate: gameToEdit.releaseDate || "",
          developer: gameToEdit.developer || "",
          publisher: gameToEdit.publisher || "",
          tags: gameToEdit.tags || [],
          trailerUrl: gameToEdit.trailerUrl || "",
          screenshots: gameToEdit.screenshots || [],
          source: gameToEdit.source || "manual",
          hasGame:
            gameToEdit.hasGame ??
            Boolean(gameToEdit.steamAppId || gameToEdit.epicCatalogId),
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
          hasGame: false,
          epicLaunchId: "",
        });
      }
      setSearchQuery("");
      setSearchResults([]);
      setIsSearching(false);
      setLoading(false);
      setIsSaving(false);
    }
  }, [isOpen, gameToEdit]);

  useEffect(
    () => () => {
      if (searchDebounceRef.current) {
        window.clearTimeout(searchDebounceRef.current);
      }
      searchRequestRef.current += 1;
      detailsRequestRef.current += 1;
    },
    [],
  );

  const fileToDataUrl = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("Falha ao ler arquivo."));
      reader.onload = () => resolve(String(reader.result || ""));
      reader.readAsDataURL(file);
    });

  const optimizeArtwork = async (
    file: File,
    maxWidth: number,
    maxHeight: number,
  ) => {
    const MAX_ART_DATA_URL_LENGTH = 230_000;
    const MAX_ART_FILE_BYTES = 12 * 1024 * 1024;
    const MAX_SOURCE_PIXELS = 32_000_000;
    const supportedMimeType = /^(?:image\/(?:jpeg|png|webp|gif))$/i.test(file.type);
    const supportedExtension = /\.(?:jpe?g|png|webp|gif)$/i.test(file.name);
    if (
      file.size <= 0
      || file.size > MAX_ART_FILE_BYTES
      || (!supportedMimeType && !supportedExtension)
    ) {
      throw new Error(copy.imageTooLarge);
    }

    const original = await fileToDataUrl(file);
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const nextImage = new Image();
      nextImage.onload = () => resolve(nextImage);
      nextImage.onerror = () => reject(new Error(copy.imageTooLarge));
      nextImage.src = original;
    });

    if (
      image.naturalWidth <= 0
      || image.naturalHeight <= 0
      || image.naturalWidth > 10_000
      || image.naturalHeight > 10_000
      || image.naturalWidth * image.naturalHeight > MAX_SOURCE_PIXELS
    ) {
      throw new Error(copy.imageTooLarge);
    }

    if (
      original.length <= MAX_ART_DATA_URL_LENGTH
      && image.naturalWidth <= maxWidth
      && image.naturalHeight <= maxHeight
    ) {
      return original;
    }

    const initialScale = Math.min(
      1,
      maxWidth / Math.max(1, image.naturalWidth),
      maxHeight / Math.max(1, image.naturalHeight),
    );
    let scale = initialScale;

    for (let attempt = 0; attempt < 10; attempt += 1) {
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const context = canvas.getContext("2d");
      if (!context) break;
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const quality = Math.max(0.48, 0.84 - (attempt % 3) * 0.14);
      const optimized = canvas.toDataURL("image/webp", quality);
      if (optimized.length <= MAX_ART_DATA_URL_LENGTH) return optimized;
      if (attempt % 3 === 2) scale *= 0.78;
    }

    throw new Error(copy.imageTooLarge);
  };

  const handleSteamSearch = async (query: string) => {
    const requestId = ++searchRequestRef.current;
    if (query.length < 3) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }
    setIsSearching(true);
    try {
      const resp = await fetch(
        apiUrl(`/api/steam/search?query=${encodeURIComponent(query)}`),
      );
      const data = await resp.json();
      if (requestId === searchRequestRef.current) {
        setSearchResults(data.items || []);
      }
    } catch (error) {
      console.error(error);
      if (requestId === searchRequestRef.current) {
        setSearchResults([]);
        notify(copy.searchError, "error");
      }
    } finally {
      if (requestId === searchRequestRef.current) {
        setIsSearching(false);
      }
    }
  };

  const handleSelectSteamGame = async (game: any) => {
    playSound("select");
    resetSearch();
    const requestId = ++detailsRequestRef.current;
    const appId = String(game.id);
    setLoading(true);
    try {
      const details = await fetchSteamAppDetailsResult(appId);
      if (requestId !== detailsRequestRef.current) return;
      if (details.ok) {
        const d = details.data;
        const steamCover =
          d.cardImage ||
          `https://cdn.akamai.steamstatic.com/steam/apps/${appId}/library_600x900_2x.jpg`;
        const steamWallpaper =
          d.backgroundImage ||
          `https://cdn.akamai.steamstatic.com/steam/apps/${appId}/library_hero.jpg`;
        setFormData((prev) => ({
          ...prev,
          title: d.title || game.name,
          image: steamCover,
          cardImage: steamCover,
          backgroundImage: steamWallpaper,
          logoImage: d.logoImage || "",
          description: d.description || "",
          aboutTheGame: d.aboutTheGame || d.description || "",
          launcherType: prev.launcherType === "local" ? "local" : "steam",
          executablePath:
            prev.launcherType === "local" ? prev.executablePath : appId,
          steamAppId: appId,
          sizeGB:
            typeof d.sizeGB === "number" && d.sizeGB > 0
              ? Math.round(d.sizeGB)
              : prev.sizeGB,
          releaseDate: d.releaseDate || "",
          developer: d.developer || "",
          publisher: d.publisher || "",
          tags: d.tags || [],
          trailerUrl: d.trailerUrl || "",
          screenshots: d.screenshots || [],
          source: "manual",
        }));
      } else {
        notify(copy.searchError, "error");
      }
    } catch (error) {
      console.error(error);
      if (requestId === detailsRequestRef.current) {
        notify(copy.searchError, "error");
      }
    } finally {
      if (requestId === detailsRequestRef.current) {
        setLoading(false);
      }
    }
  };

  const handleEpicSearch = async (query: string) => {
    const requestId = ++searchRequestRef.current;
    if (query.length < 3) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }
    setIsSearching(true);
    try {
      const data = await searchEpicGames(query);
      if (requestId === searchRequestRef.current) {
        setSearchResults(data.items || []);
      }
    } catch (e) {
      console.error(e);
      if (requestId === searchRequestRef.current) {
        setSearchResults([]);
        notify(copy.searchError, "error");
      }
    } finally {
      if (requestId === searchRequestRef.current) {
        setIsSearching(false);
      }
    }
  };

  const scheduleSearch = (query: string, platform: "steam" | "epic") => {
    searchRequestRef.current += 1;
    setSearchQuery(query);
    if (searchDebounceRef.current) {
      window.clearTimeout(searchDebounceRef.current);
      searchDebounceRef.current = null;
    }
    if (query.length < 3) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }
    searchDebounceRef.current = window.setTimeout(() => {
      searchDebounceRef.current = null;
      if (platform === "steam") {
        handleSteamSearch(query);
        return;
      }
      handleEpicSearch(query);
    }, 350);
  };

  const handleSelectEpicGame = async (game: any) => {
    playSound("select");
    resetSearch();
    const requestId = ++detailsRequestRef.current;
    setLoading(true);
    try {
      const catalogId = String(game.id || game.catalogId || "").trim();
      const namespace = String(game.namespace || "").trim();
      let launchId = namespace && catalogId ? `${namespace}:${catalogId}` : catalogId;
      const details =
        catalogId && namespace
          ? await fetchEpicAppDetailsResult(catalogId, namespace).catch(() => null)
          : null;
      const d = details?.ok ? details.data : null;
      if (requestId !== detailsRequestRef.current) return;

      const appName = String(d?.appName || game.appName || "").trim();
      if (namespace && catalogId && appName) {
        launchId = `${namespace}:${catalogId}:${appName}`;
      }

      const gameTitle = d?.title || game.title || game.name || "";
      let resolvedSteamAppId = "";

      // Buscar equivalência na Steam em segundo plano para obter as conquistas
      if (gameTitle) {
        try {
          const resp = await fetch(
            apiUrl(`/api/steam/search?query=${encodeURIComponent(gameTitle)}`),
          );
          if (resp.ok) {
            const data = await resp.json();
            const items = data.items || [];
            const match = items.find(
              (item: any) =>
                String(item.name || "").toLowerCase() === gameTitle.toLowerCase(),
            ) || items[0];
            if (match) {
              resolvedSteamAppId = String(match.id);
            }
          }
        } catch (err) {
          console.error("Erro ao buscar conquistas equivalentes na Steam:", err);
        }
      }

      if (requestId !== detailsRequestRef.current) return;
      setFormData((prev) => ({
        ...prev,
        title: gameTitle,
        image: d?.cardImage || game.cardImage || game.tiny_image || game.image || "",
        cardImage: d?.cardImage || game.cardImage || game.tiny_image || game.image || "",
        backgroundImage: d?.backgroundImage || game.backgroundImage || game.image || "",
        logoImage: d?.logoImage || game.logoImage || "",
        description: d?.description || game.description || "",
        aboutTheGame: d?.aboutTheGame || game.aboutTheGame || game.description || "",
        launcherType: "epic",
        executablePath: isWindowsExecutablePath(prev.executablePath) ? prev.executablePath : "",
        steamAppId: resolvedSteamAppId || prev.steamAppId || "",
        epicCatalogId: catalogId,
        epicLaunchId: launchId,
        epicStoreUrl: game.productUrl || "",
        sizeGB: d?.sizeGB ?? prev.sizeGB,
        releaseDate: d?.releaseDate || game.releaseDate || "",
        developer: d?.developer || game.developer || "",
        publisher: d?.publisher || game.publisher || "",
        tags: d?.tags || game.tags || [],
        trailerUrl: d?.trailerUrl || "",
        screenshots: d?.screenshots || game.screenshots || [],
        source: "epic",
        hasGame: false,
      }));
    } catch (e) {
      console.error(e);
      if (requestId === detailsRequestRef.current) {
        notify(copy.searchError, "error");
      }
    } finally {
      if (requestId === detailsRequestRef.current) {
        setLoading(false);
      }
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
      epicCatalogId: "",
      epicLaunchId: "",
      epicStoreUrl: "",
      source: "manual",
    }));
    playSound("select");
  };

  const handleEpicExecutableSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const browserPath =
      (file as File & { path?: string }).path ||
      file.webkitRelativePath ||
      file.name;

    setFormData((prev) => ({
      ...prev,
      launcherType: "epic",
      executablePath: browserPath,
      source: prev.epicCatalogId ? "epic" : "manual",
    }));
    playSound("select");
  };

  const handleCoverSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await optimizeArtwork(file, 720, 1080);
      setFormData((prev) => ({
        ...prev,
        cardImage: dataUrl,
        image: prev.image || dataUrl,
        source: "manual",
      }));
      playSound("select");
    } catch (error) {
      notify(error instanceof Error ? error.message : copy.imageTooLarge, "error");
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
      const dataUrl = await optimizeArtwork(file, 1600, 900);
      setFormData((prev) => ({
        ...prev,
        backgroundImage: dataUrl,
        image: prev.image || dataUrl,
        source: "manual",
      }));
      playSound("select");
    } catch (error) {
      notify(error instanceof Error ? error.message : copy.imageTooLarge, "error");
    } finally {
      e.target.value = "";
    }
  };

  const handleSizeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    if (raw === "") {
      setFormData((prev) => ({ ...prev, sizeGB: undefined }));
      return;
    }
    const parsed = Number(raw);
    if (!Number.isNaN(parsed) && parsed >= 0) {
      setFormData((prev) => ({ ...prev, sizeGB: parsed }));
    }
  };

  const resetSearch = () => {
    searchRequestRef.current += 1;
    if (searchDebounceRef.current) {
      window.clearTimeout(searchDebounceRef.current);
      searchDebounceRef.current = null;
    }
    setSearchQuery("");
    setSearchResults([]);
    setIsSearching(false);
  };

  const handleClose = (silent?: boolean) => {
    detailsRequestRef.current += 1;
    setLoading(false);
    resetSearch();
    onClose(silent);
  };

  const selectLauncherType = (launcherType: GameFormData["launcherType"]) => {
    playSound("navigate");
    detailsRequestRef.current += 1;
    setLoading(false);
    resetSearch();
    setFormData((prev) => {
      const platformChanged = prev.launcherType !== launcherType;
      if (launcherType === "local") {
        return {
          ...prev,
          launcherType,
          executablePath: platformChanged ? "" : prev.executablePath,
          steamAppId: "",
          epicCatalogId: "",
          epicLaunchId: "",
          epicStoreUrl: "",
          hasGame: false,
          source: "manual",
        };
      }
      if (launcherType === "steam") {
        return {
          ...prev,
          launcherType,
          executablePath: platformChanged ? "" : prev.steamAppId || prev.executablePath,
          steamAppId: platformChanged ? "" : prev.steamAppId,
          epicCatalogId: "",
          epicLaunchId: "",
          epicStoreUrl: "",
          hasGame: platformChanged ? false : prev.hasGame,
          source: "manual",
        };
      }
      return {
        ...prev,
        launcherType,
        executablePath: platformChanged ? "" : prev.executablePath,
        steamAppId: platformChanged ? "" : prev.steamAppId,
        epicCatalogId: platformChanged ? "" : prev.epicCatalogId,
        epicLaunchId: platformChanged ? "" : prev.epicLaunchId,
        epicStoreUrl: platformChanged ? "" : prev.epicStoreUrl,
        hasGame: platformChanged ? false : prev.hasGame,
        source: "manual",
      };
    });
  };

  const isFormValid = () => {
    if (!formData.title.trim()) return false;
    if (
      (formData.launcherType === "epic" || formData.launcherType === "steam") &&
      !formData.hasGame
    ) {
      return false;
    }
    if (formData.launcherType === "local") {
      const hasCover = Boolean(formData.cardImage || formData.image);
      const hasExecutable = Boolean(formData.executablePath);
      if (!hasCover && !hasExecutable) return false;
    }
    return true;
  };

  const previewImage = formData.cardImage || formData.image || formData.backgroundImage || "";
  const previewWallpaper = formData.backgroundImage || formData.cardImage || formData.image || "";
  const platformLabel =
    formData.launcherType === "steam"
      ? copy.steam
      : formData.launcherType === "epic"
        ? copy.epic
        : copy.local;
  const launchRequirementReady = formData.launcherType === "local"
    ? Boolean(formData.executablePath || formData.cardImage || formData.image)
    : Boolean(formData.hasGame);
  const setupChecks = [
    { label: copy.sourceReady, ready: true },
    { label: copy.titleReady, ready: Boolean(formData.title.trim()) },
    { label: copy.launchReady, ready: launchRequirementReady },
  ];
  const completedSetupChecks = setupChecks.filter((item) => item.ready).length;
  const setupProgress = Math.round((completedSetupChecks / setupChecks.length) * 100);

  const handleSubmit = async () => {
    if (isSaving || loading) return;
    if (!user?.uid || !isFormValid()) {
      if (formData.title && formData.launcherType === "local") {
        notify(copy.missingCoverOrExe, "error");
      }
      return;
    }
    setIsSaving(true);
    playSound("select");
    try {
      const image =
        formData.cardImage || formData.image || formData.backgroundImage || "";
      const data = removeUndefined({
        ...formData,
        image,
        updatedAt: new Date().toISOString(),
      });
      if (new Blob([JSON.stringify(data)]).size > 850_000) {
        notify(copy.imageTooLarge, "error");
        return;
      }
      if (gameToEdit) {
        await updateDoc(userGameDocRef(user.uid, gameToEdit.id), {
          ...data,
          ...(!formData.steamAppId
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
      handleClose(true);
      onSaved?.();
    } catch {
      notify("Erro ao salvar jogo.", "error");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={handleClose}
      maxWidthClassName="max-w-6xl"
      className="p-0! border-0! bg-transparent shadow-none!"
      backdropClassName="bg-black/80 backdrop-blur-xl"
      ariaLabel={gameToEdit ? copy.editInfo : copy.addGame}
    >
      <div
        aria-busy={isSaving || loading}
        className="relative flex h-[calc(100dvh-2rem)] max-h-[860px] w-full flex-col overflow-hidden rounded-[28px] border border-white/10 bg-[#08080b]/98 shadow-[0_36px_140px_rgba(0,0,0,0.92)] backdrop-blur-3xl md:h-[calc(100dvh-4rem)] md:rounded-[32px]"
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-56 bg-[radial-gradient(circle_at_22%_-15%,rgba(255,255,255,0.12),transparent_44%)]" />
        <header className="relative flex shrink-0 items-center justify-between gap-4 border-b border-white/[0.07] bg-white/[0.015] px-5 py-4 md:px-7 md:py-5">
          <div className="flex min-w-0 items-center gap-4">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-white/12 bg-white/[0.06] shadow-[inset_0_1px_rgba(255,255,255,0.08)]">
              <LibraryBig size={20} className="text-white/80" />
            </div>
            <div className="min-w-0">
              <p className="mb-1 text-[9px] font-black uppercase tracking-[0.24em] text-white/32">
                {copy.libraryKicker}
              </p>
              <h2 className="truncate text-xl font-black tracking-[-0.035em] text-white md:text-2xl">
                {gameToEdit ? copy.editInfo : copy.addGame}
              </h2>
              <p className="mt-1 hidden max-w-xl truncate text-[11px] text-white/38 sm:block">
                {gameToEdit ? copy.editSubtitle : copy.addSubtitle}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <div className="hidden items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.035] px-3 py-2 sm:flex">
              <span className="text-[9px] font-bold uppercase tracking-wider text-white/42">
                {completedSetupChecks}/3
              </span>
              <div className="h-1.5 w-16 overflow-hidden rounded-full bg-white/[0.07]">
                <div className="h-full rounded-full bg-white transition-all duration-300" style={{ width: `${setupProgress}%` }} />
              </div>
            </div>
            <button
              type="button"
              onClick={() => handleClose()}
              aria-label={copy.cancel}
              className="grid h-10 w-10 place-items-center rounded-xl border border-white/[0.08] bg-white/[0.025] text-white/42 transition-all hover:border-white/15 hover:bg-white/[0.08] hover:text-white"
            >
              <X size={18} />
            </button>
          </div>
        </header>

        <div className="add-game-scrollbar grid min-h-0 flex-1 grid-cols-1 overflow-y-auto overscroll-contain lg:grid-cols-[minmax(0,1fr)_360px] lg:overflow-hidden">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void handleSubmit();
            }}
            className="add-game-scrollbar min-h-0 space-y-5 border-white/[0.07] p-5 lg:overflow-y-auto lg:border-r lg:p-7"
          >
            <section className="rounded-3xl border border-white/[0.08] bg-white/[0.025] p-4 md:p-5">
              <div className="mb-4 flex items-center gap-3">
                <span className="grid h-7 w-7 place-items-center rounded-lg border border-white/10 bg-white/[0.05] text-[9px] font-black text-white/52">01</span>
                <div>
                  <h3 className="text-sm font-extrabold text-white">{copy.platform}</h3>
                  <p className="mt-0.5 text-[10px] text-white/34">{copy.addSubtitle}</p>
                </div>
              </div>
              <div role="radiogroup" aria-label={copy.platform} className="grid gap-2 sm:grid-cols-3">
                {([
                  { id: "local" as const, label: copy.local, description: copy.localDescription, icon: <HardDrive size={17} /> },
                  { id: "steam" as const, label: copy.steam, description: copy.steamDescription, icon: <Globe size={17} /> },
                  { id: "epic" as const, label: copy.epic, description: copy.epicDescription, icon: <EpicIcon className="h-[17px] w-[17px] opacity-80" /> },
                ]).map((option) => {
                  const selected = formData.launcherType === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => selectLauncherType(option.id)}
                      className={"group relative min-h-[104px] rounded-2xl border p-3.5 text-left transition-all " + (selected
                        ? "border-white/45 bg-white text-black shadow-[0_14px_36px_rgba(0,0,0,0.32)]"
                        : "border-white/[0.07] bg-black/20 text-white hover:border-white/16 hover:bg-white/[0.045]")}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <span className={"grid h-8 w-8 place-items-center rounded-xl border " + (selected ? "border-black/10 bg-black/[0.06]" : "border-white/[0.08] bg-white/[0.04] text-white/58")}>
                          {option.icon}
                        </span>
                        {selected && <CheckCircle2 size={17} className="text-black/70" />}
                      </div>
                      <strong className="mt-3 block text-[12px] font-black">{option.label}</strong>
                      <span className={"mt-1 block text-[9px] leading-relaxed " + (selected ? "text-black/55" : "text-white/34")}>{option.description}</span>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="relative rounded-3xl border border-white/[0.08] bg-white/[0.025] p-4 md:p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="grid h-7 w-7 place-items-center rounded-lg border border-white/10 bg-white/[0.05] text-[9px] font-black text-white/52">02</span>
                  <div>
                    <h3 className="text-sm font-extrabold text-white">{copy.automaticFill}</h3>
                    <p className="mt-0.5 text-[10px] text-white/34">{copy.automaticFillHint}</p>
                  </div>
                </div>
                {loading && <RefreshCw size={15} className="shrink-0 animate-spin text-white/45" />}
              </div>

              <label htmlFor="game-metadata-search" className="mb-2 block text-[9px] font-black uppercase tracking-[0.16em] text-white/38">
                {formData.launcherType === "epic" ? copy.epicSearch : copy.steamSearch}
                {formData.launcherType === "local" ? ` · ${copy.optional}` : ""}
              </label>
              <div className="relative">
                <Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-white/24" />
                <input
                  id="game-metadata-search"
                  role="combobox"
                  aria-autocomplete="list"
                  aria-controls="game-search-results"
                  aria-expanded={searchQuery.length >= 3}
                  value={searchQuery}
                  onChange={(event) => scheduleSearch(event.target.value, formData.launcherType === "epic" ? "epic" : "steam")}
                  placeholder={copy.searchPlaceholder}
                  className="w-full rounded-2xl border border-white/[0.09] bg-black/25 py-3.5 pl-11 pr-11 text-[12px] text-white outline-none transition-all placeholder:text-white/22 focus:border-white/24 focus:bg-white/[0.045]"
                />
                {isSearching && <RefreshCw size={14} className="absolute right-4 top-1/2 -translate-y-1/2 animate-spin text-white/32" />}
                <GameSearchDropdown
                  id="game-search-results"
                  results={searchResults}
                  isSearching={isSearching}
                  hasQuery={searchQuery.length >= 3}
                  noResultsLabel={copy.noSearchResults}
                  onSelect={formData.launcherType === "epic" ? handleSelectEpicGame : handleSelectSteamGame}
                />
              </div>

              {formData.epicStoreUrl && (
                <a
                  href={formData.epicStoreUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.16em] text-white/38 transition-colors hover:text-white/70"
                >
                  <EpicIcon className="h-3.5 w-3.5 opacity-60" /> {copy.viewOnEpicStore}
                </a>
              )}

              {formData.launcherType === "epic" && (
                <div className="mt-4 border-t border-white/[0.06] pt-4">
                  <input ref={executableInputRef} type="file" accept=".exe,application/x-msdownload" className="hidden" onChange={handleEpicExecutableSelect} />
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <button type="button" onClick={() => executableInputRef.current?.click()} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.055] px-4 py-3 text-[9px] font-black uppercase tracking-wider text-white/68 transition-all hover:bg-white/10 hover:text-white">
                      <FolderOpen size={14} /> {copy.chooseExe}
                    </button>
                    <div className="min-w-0 flex-1 rounded-xl border border-white/[0.07] bg-black/20 px-4 py-3">
                      <p className="truncate text-[10px] text-white/52">{formData.executablePath || copy.noExecutable}</p>
                    </div>
                  </div>
                  <p className="mt-2 text-[9px] leading-relaxed text-white/26">{copy.executableHint}</p>
                </div>
              )}
            </section>

            {formData.launcherType !== "local" &&
              (formData.epicCatalogId || formData.steamAppId) && (
              <div>
                <button
                  type="button"
                  aria-pressed={Boolean(formData.hasGame)}
                  onClick={() => {
                    playSound("select");
                    setFormData((prev) => ({ ...prev, hasGame: !prev.hasGame }));
                  }}
                  className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-3.5 text-left transition-all ${formData.hasGame
                    ? "border-white/40 bg-white text-black shadow-[0_12px_30px_rgba(0,0,0,0.25)]"
                    : "border-white/[0.08] bg-white/[0.025] text-white/48 hover:border-white/16 hover:bg-white/[0.055]"
                    }`}
                >
                  <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl border ${formData.hasGame ? "border-black/10 bg-black/[0.06]" : "border-white/10 bg-white/[0.04]"}`}>
                    <Check size={15} strokeWidth={3} />
                  </span>
                  <span>
                    <strong className="block text-[10px] font-black uppercase tracking-[0.12em]">{formData.hasGame ? copy.ownGameConfirmed : copy.ownGameConfirm}</strong>
                    <small className={`mt-1 block text-[9px] ${formData.hasGame ? "text-black/50" : "text-white/28"}`}>{platformLabel}</small>
                  </span>
                </button>
              </div>
            )}

            <section className="rounded-3xl border border-white/[0.08] bg-white/[0.025] p-4 md:p-5">
              <div className="mb-5 flex items-center gap-3">
                <span className="grid h-7 w-7 place-items-center rounded-lg border border-white/10 bg-white/[0.05] text-[9px] font-black text-white/52">03</span>
                <div>
                  <h3 className="text-sm font-extrabold text-white">{copy.gameDetails}</h3>
                  <p className="mt-0.5 text-[10px] text-white/34">{copy.gameDetailsHint}</p>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <div className="space-y-2">
                <label htmlFor="game-title" className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.16em] text-white/40">
                  <Type size={14} className="text-white/20" /> {copy.title}
                </label>
                <input
                  id="game-title"
                  value={formData.title}
                  onChange={(e) =>
                    setFormData({ ...formData, title: e.target.value })
                  }
                  placeholder={copy.titlePlaceholder}
                  className="w-full rounded-xl border border-white/[0.09] bg-black/20 px-4 py-3.5 text-[12px] text-white outline-none transition-all placeholder:text-white/22 focus:border-white/24 focus:bg-white/[0.04]"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="game-category" className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.16em] text-white/40">
                  <Tags size={14} className="text-white/20" /> {copy.category}
                </label>
                <div className="relative">
                  <select
                    id="game-category"
                    value={formData.category}
                    onChange={(event) => {
                      playSound("navigate");
                      setFormData({ ...formData, category: event.target.value });
                    }}
                    className="w-full appearance-none rounded-xl border border-white/[0.09] bg-[#0d0d11] px-4 py-3.5 pr-10 text-[12px] text-white/78 outline-none transition-all focus:border-white/24"
                  >
                    {CATEGORIES.map((category) => <option key={category.id} value={category.id}>{category.label}</option>)}
                  </select>
                  <ChevronDown size={15} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-white/30" />
                </div>
              </div>

              <div className="space-y-2 md:col-span-2">
                <label htmlFor="game-description" className="text-[9px] font-black uppercase tracking-[0.16em] text-white/40">{copy.description}</label>
                <textarea
                  id="game-description"
                  rows={3}
                  value={formData.description}
                  onChange={(event) => setFormData({ ...formData, description: event.target.value })}
                  placeholder={copy.descriptionPlaceholder}
                  className="w-full resize-none rounded-xl border border-white/[0.09] bg-black/20 px-4 py-3.5 text-[11px] leading-relaxed text-white/72 outline-none transition-all placeholder:text-white/22 focus:border-white/24 focus:bg-white/[0.04]"
                />
              </div>

              <div className="mt-1 border-t border-white/[0.06] pt-5 md:col-span-2">
                <div className="mb-4 flex items-center gap-3">
                  <span className="grid h-8 w-8 place-items-center rounded-xl border border-white/[0.08] bg-white/[0.04]"><Sparkles size={14} className="text-white/44" /></span>
                  <div><h4 className="text-[11px] font-extrabold text-white/82">{copy.visualAssets}</h4><p className="mt-0.5 text-[9px] text-white/28">{copy.visualAssetsHint}</p></div>
                </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-3 rounded-2xl border border-white/[0.07] bg-black/15 p-3.5">
                  <label htmlFor="game-cover-url" className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.14em] text-white/40">
                    <ImageIcon size={14} className="text-white/20" /> {copy.cover}
                  </label>
                  <div
                    className="h-24 rounded-xl border border-white/[0.07] bg-[#111116] bg-cover bg-center"
                    style={formData.cardImage || formData.image ? { backgroundImage: "linear-gradient(to top, rgba(0,0,0,.35), transparent), url(" + JSON.stringify(formData.cardImage || formData.image) + ")" } : undefined}
                  />
                  <input
                    id="game-cover-url"
                    value={formData.cardImage}
                    onChange={(e) =>
                      setFormData({ ...formData, cardImage: e.target.value })
                    }
                    placeholder="https://..."
                    className="w-full rounded-xl border border-white/[0.08] bg-white/[0.025] px-3 py-2.5 text-[9px] text-white/60 outline-none placeholder:text-white/20 focus:border-white/20"
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
                        className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/[0.09] bg-white/[0.05] px-3 py-2.5 text-[9px] font-black uppercase tracking-wider text-white/58 transition-all hover:bg-white/10 hover:text-white"
                      >
                        <Upload size={13} /> {copy.upload}
                      </button>
                    </>
                  )}
                </div>
                <div className="space-y-3 rounded-2xl border border-white/[0.07] bg-black/15 p-3.5">
                  <label htmlFor="game-wallpaper-url" className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.14em] text-white/40">
                    <ImageIcon size={14} className="text-white/20" /> {copy.wallpaper}
                  </label>
                  <div
                    className="h-24 rounded-xl border border-white/[0.07] bg-[#111116] bg-cover bg-center"
                    style={formData.backgroundImage ? { backgroundImage: "linear-gradient(to top, rgba(0,0,0,.35), transparent), url(" + JSON.stringify(formData.backgroundImage) + ")" } : undefined}
                  />
                  <input
                    id="game-wallpaper-url"
                    value={formData.backgroundImage}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        backgroundImage: e.target.value,
                      })
                    }
                    placeholder="https://..."
                    className="w-full rounded-xl border border-white/[0.08] bg-white/[0.025] px-3 py-2.5 text-[9px] text-white/60 outline-none placeholder:text-white/20 focus:border-white/20"
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
                        className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/[0.09] bg-white/[0.05] px-3 py-2.5 text-[9px] font-black uppercase tracking-wider text-white/58 transition-all hover:bg-white/10 hover:text-white"
                      >
                        <Upload size={13} /> {copy.upload}
                      </button>
                    </>
                  )}
                </div>
              </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="game-size" className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.16em] text-white/40">
                  <HardDrive size={14} className="text-white/20" /> {copy.sizeGB}
                  ({copy.optional})
                </label>
                <input
                  id="game-size"
                  type="number"
                  min={0}
                  value={formData.sizeGB ?? ""}
                  onChange={handleSizeChange}
                  placeholder={copy.sizePlaceholder}
                  className="w-full rounded-xl border border-white/[0.09] bg-black/20 px-4 py-3.5 text-[11px] text-white/70 outline-none transition-all placeholder:text-white/22 focus:border-white/24"
                />
              </div>

              {formData.launcherType === "local" && (
                <div className="space-y-3 md:col-span-2">
                  <label className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.16em] text-white/40">
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
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <button
                      type="button"
                      onClick={() => executableInputRef.current?.click()}
                      className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.055] px-4 py-3 text-[9px] font-black uppercase tracking-wider text-white/68 transition-all hover:bg-white/10 hover:text-white"
                    >
                      <FolderOpen size={14} /> {copy.chooseExe}
                    </button>
                    <div className="min-w-0 flex-1 rounded-xl border border-white/[0.07] bg-black/20 px-4 py-3">
                      <p className="truncate text-[10px] text-white/52">
                        {formData.executablePath || copy.noExecutable}
                      </p>
                    </div>
                  </div>
                  <p className="text-[9px] leading-relaxed text-white/26">
                    {copy.executableHint}
                  </p>
                </div>
              )}
            </div>
            </section>

            <footer className="sticky bottom-0 z-20 -mx-5 -mb-5 border-t border-white/[0.08] bg-[#08080b]/92 px-5 pb-5 pt-4 shadow-[0_-20px_50px_rgba(0,0,0,0.45)] backdrop-blur-xl lg:-mx-7 lg:-mb-7 lg:px-7 lg:pb-7">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div aria-live="polite" className="flex min-w-0 items-center gap-3">
                  <span
                    className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl border ${isFormValid()
                      ? "border-white/18 bg-white/[0.09] text-white"
                      : "border-white/[0.08] bg-white/[0.025] text-white/28"
                      }`}
                  >
                    {isFormValid() ? <CheckCircle2 size={17} /> : <Sparkles size={17} />}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-[10px] font-extrabold text-white/72">
                      {isFormValid() ? copy.ready : copy.missingFields}
                    </p>
                    <p className="mt-0.5 text-[9px] text-white/30">
                      {completedSetupChecks}/{setupChecks.length} · {copy.setupStatus}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    onClick={() => handleClose()}
                    className="rounded-xl border border-white/[0.09] bg-white/[0.025] px-4 py-3 text-[9px] font-black uppercase tracking-[0.14em] text-white/48 transition-all hover:border-white/18 hover:bg-white/[0.06] hover:text-white"
                  >
                    {copy.cancel}
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving || loading || !isFormValid()}
                    className="group relative inline-flex min-w-40 items-center justify-center gap-2 overflow-hidden rounded-xl bg-white px-5 py-3 text-[9px] font-black uppercase tracking-[0.14em] text-black shadow-[0_14px_34px_rgba(255,255,255,0.09)] transition-all hover:bg-white/90 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-white/25 disabled:text-black/50 disabled:shadow-none"
                  >
                    <span className="pointer-events-none absolute inset-y-0 left-0 w-12 -translate-x-full skew-x-[-18deg] bg-white/60 blur-md transition-transform duration-700 group-hover:translate-x-[260px]" />
                    {isSaving ? (
                      <RefreshCw size={14} className="animate-spin" />
                    ) : (
                      <Check size={14} strokeWidth={3} />
                    )}
                    <span className="relative">
                      {isSaving
                        ? copy.saving
                        : gameToEdit
                          ? copy.saveChanges
                          : copy.confirmAdd}
                    </span>
                  </button>
                </div>
              </div>
            </footer>
          </form>

          <aside
            aria-label={copy.previewPanel}
            className="relative flex min-h-[520px] flex-col overflow-hidden bg-[#060608] p-5 lg:min-h-0 lg:p-6"
          >
            <div className="pointer-events-none absolute inset-0">
              {previewWallpaper ? (
                <img
                  src={previewWallpaper}
                  alt=""
                  className="h-full w-full scale-110 object-cover opacity-[0.16] blur-2xl"
                />
              ) : null}
              <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(6,6,8,0.58),rgba(6,6,8,0.88)_48%,#060608_82%)]" />
              <div className="absolute inset-x-8 top-8 h-36 rounded-full bg-white/[0.035] blur-3xl" />
            </div>

            <div className="relative z-10 flex items-center justify-between gap-3">
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.22em] text-white/30">
                  {copy.previewPanel}
                </p>
                <p className="mt-1 text-[10px] text-white/46">{copy.libraryKicker}</p>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.09] bg-black/30 px-2.5 py-1.5 text-[8px] font-black uppercase tracking-[0.12em] text-white/48 backdrop-blur-md">
                <Globe size={11} /> {platformLabel}
              </span>
            </div>

            <div className="relative z-10 mx-auto mt-6 w-full max-w-[230px]">
              <div className="group relative aspect-[3/4] overflow-hidden rounded-[24px] border border-white/14 bg-[#101014] shadow-[0_28px_65px_rgba(0,0,0,0.62)]">
                {previewImage ? (
                  <img
                    src={previewImage}
                    alt=""
                    className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.035]"
                  />
                ) : (
                  <div className="grid h-full w-full place-items-center bg-[radial-gradient(circle_at_50%_28%,rgba(255,255,255,0.1),transparent_42%),linear-gradient(160deg,#15151a,#08080b)]">
                    <div className="grid h-20 w-20 place-items-center rounded-[24px] border border-white/10 bg-white/[0.04] text-white/20">
                      <Gamepad2 size={34} strokeWidth={1.4} />
                    </div>
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/5 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-5">
                  <span className="mb-2 inline-flex rounded-md border border-white/12 bg-black/45 px-2 py-1 text-[7px] font-black uppercase tracking-[0.16em] text-white/55 backdrop-blur-md">
                    {CATEGORIES.find((category) => category.id === formData.category)?.label || copy.category}
                  </span>
                  <h3 className="line-clamp-2 text-xl font-black leading-[1.05] tracking-[-0.035em] text-white drop-shadow-lg">
                    {formData.title.trim() || copy.titlePlaceholder}
                  </h3>
                  <p className="mt-2 text-[9px] font-semibold text-white/45">
                    {platformLabel}
                    {formData.sizeGB != null ? ` · ${formData.sizeGB} GB` : ""}
                  </p>
                </div>
              </div>
            </div>

            <div className="relative z-10 mt-6 rounded-2xl border border-white/[0.08] bg-black/30 p-4 backdrop-blur-xl">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-[9px] font-black uppercase tracking-[0.16em] text-white/38">
                    {copy.setupStatus}
                  </p>
                  <p className="mt-1 text-[10px] text-white/55">
                    {isFormValid() ? copy.ready : copy.missingFields}
                  </p>
                </div>
                <strong className="text-sm font-black text-white/72">{setupProgress}%</strong>
              </div>
              <div
                className="mb-4 h-1.5 overflow-hidden rounded-full bg-white/[0.07]"
                role="progressbar"
                aria-label={copy.setupStatus}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={setupProgress}
              >
                <div
                  className="h-full rounded-full bg-white transition-[width] duration-300"
                  style={{ width: `${setupProgress}%` }}
                />
              </div>
              <ul className="space-y-2.5">
                {setupChecks.map((item) => (
                  <li key={item.label} className="flex items-center gap-2.5 text-[9px] text-white/45">
                    <CheckCircle2
                      size={14}
                      className={item.ready ? "text-white/80" : "text-white/16"}
                    />
                    <span className={item.ready ? "text-white/62" : undefined}>{item.label}</span>
                  </li>
                ))}
              </ul>
            </div>
          </aside>
        </div>
      </div>
    </ModalShell>
  );
};

export default AddGameModal;
