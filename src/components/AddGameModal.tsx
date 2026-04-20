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
} from "lucide-react";
import { addDoc, updateDoc } from "firebase/firestore";
import ModalShell from "./ui/ModalShell";
import GameCard from "./GameCard";
import { useAuth } from "../auth/AuthProvider";
import { useNotification } from "./NotificationCenter";
import {
  userGamesCollectionRef,
  userGameDocRef,
} from "../services/firestorePaths";
import {
  fetchSteamAppDetailsResult,
  fetchSteamAppSizeGB,
  type SteamAppDetails,
} from "../services/steam";
import { apiUrl } from "../services/api";

interface AddGameModalProps {
  isOpen: boolean;
  onClose: (silent?: boolean) => void;
  playSound: (type: "select" | "back" | "navigate") => void;
  gameToEdit?: any | null;
  onSaved?: () => void;
}

const CATEGORIES = [
  { id: "ACTION", label: "Ação" },
  { id: "ADVENTURE", label: "Aventura" },
  { id: "RACING", label: "Corrida" },
  { id: "RPG", label: "RPG" },
  { id: "SHOOTER", label: "FPS" },
  { id: "SPORTS", label: "Esportes" },
  { id: "HORROR", label: "Terror" },
];

const AddGameModal: React.FC<AddGameModalProps> = ({
  isOpen,
  onClose,
  playSound,
  gameToEdit,
  onSaved,
}) => {
  const { user } = useAuth();
  const { notify } = useNotification();
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);

  const [formData, setFormData] = useState({
    title: "",
    cardImage: "",
    backgroundImage: "",
    category: "ACTION",
    description: "",
    launcherType: "local" as "steam" | "local",
    executablePath: "",
  });

  useEffect(() => {
    if (isOpen) {
      if (gameToEdit) {
        setFormData({
          title: gameToEdit.title || "",
          cardImage: gameToEdit.cardImage || "",
          backgroundImage: gameToEdit.backgroundImage || gameToEdit.image || "",
          category: gameToEdit.category || "ACTION",
          description: gameToEdit.description || "",
          launcherType: gameToEdit.launcherType || "local",
          executablePath: gameToEdit.executablePath || "",
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
        });
      }
    }
  }, [isOpen, gameToEdit]);

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
        setFormData({
          ...formData,
          title: d.title || game.name,
          cardImage:
            d.cardImage ||
            `https://cdn.akamai.steamstatic.com/steam/apps/${appId}/library_600x900_2x.jpg`,
          backgroundImage:
            d.backgroundImage ||
            `https://cdn.akamai.steamstatic.com/steam/apps/${appId}/library_hero.jpg`,
          description: d.description || "",
          launcherType: "steam",
          executablePath: appId,
        });
      }
      setSearchResults([]);
      setSearchQuery("");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!user?.uid || !formData.title) return;
    setLoading(true);
    playSound("select");
    try {
      const data = {
        ...formData,
        updatedAt: new Date().toISOString(),
      };
      if (gameToEdit) {
        await updateDoc(userGameDocRef(user.uid, gameToEdit.id), data);
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
        {/* Header */}
        <div className="flex justify-between items-center px-10 py-8 border-b border-white/5 relative bg-white/0.01">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-1 bg-white/10 rounded-full" />
          <div>
            <h2 className="text-3xl font-black tracking-tighter text-white uppercase italic">
              {gameToEdit ? "Editar informações" : "Adicionar Jogo"}
            </h2>
            <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.3em] mt-1">
              Biblioteca Digital • Checkpoint v.2
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
          {/* Form Side */}
          <div className="p-10 space-y-8 border-r border-white/5 overflow-y-auto max-h-[600px] no-scrollbar">
            {/* Steam Search */}
            <div className="space-y-4">
              <label className="flex items-center gap-2 text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">
                <Search size={14} className="text-white/20" /> Buscar na Steam
                (Opcional)
              </label>
              <div className="relative">
                <input
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    handleSteamSearch(e.target.value);
                  }}
                  placeholder="Pesquisar jogo para auto-preenchimento..."
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

            <div className="h-px bg-white/5" />

            {/* Inputs Grid */}
            <div className="grid grid-cols-1 gap-6">
              <div className="space-y-4">
                <label className="flex items-center gap-2 text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">
                  <Type size={14} className="text-white/20" /> Título
                </label>
                <input
                  value={formData.title}
                  onChange={(e) =>
                    setFormData({ ...formData, title: e.target.value })
                  }
                  placeholder="Nome do seu jogo"
                  className="w-full bg-white/[0.03] border border-white/10 rounded-2xl p-4 text-white outline-none focus:border-white/30 transition-all"
                />
              </div>

              <div className="space-y-4">
                <label className="flex items-center gap-2 text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">
                  <Tags size={14} className="text-white/20" /> Categoria
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
                    <ImageIcon size={14} className="text-white/20" /> Capa
                    (Link)
                  </label>
                  <input
                    value={formData.cardImage}
                    onChange={(e) =>
                      setFormData({ ...formData, cardImage: e.target.value })
                    }
                    placeholder="https://..."
                    className="w-full bg-white/[0.03] border border-white/10 rounded-2xl p-4 text-xs text-white/70 outline-none focus:border-white/30 transition-all"
                  />
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
                </div>
              </div>
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
                  Confirmar Adição
                </>
              )}
            </button>
          </div>

          {/* Preview Side */}
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
                  Prévia no Painel
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
