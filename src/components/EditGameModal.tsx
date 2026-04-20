import React, { useState } from "react";
import { X, Image as ImageIcon, Tags, Type, AlignLeft } from "lucide-react";
import { addDoc } from "firebase/firestore";
import { useNotification } from "./NotificationCenter";
import { useAuth } from "../auth/AuthProvider";
import { userGamesCollectionRef } from "../services/firestorePaths";
import ModalShell from "./ui/ModalShell";
import GlassButton from "./ui/GlassButton";

interface AddGameModalProps {
  isOpen: boolean;
  onClose: () => void;
  playSound: (type: "select" | "back") => void;
}

const AddGameModal: React.FC<AddGameModalProps> = ({
  isOpen,
  onClose,
  playSound,
}) => {
  const { notify } = useNotification();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    category: "ROLEPLAYING",
    image: "",
    cardImage: "",
    description: "",
  });

  const categories = ["RACING", "ROLEPLAYING", "SPORTS", "ONLINE", "SHOOTER"];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    playSound("select");

    try {
      if (!user?.uid) {
        notify("Sessão inválida. Faça login novamente.", "error");
        return;
      }
      await addDoc(userGamesCollectionRef(user.uid), {
        ...formData,
        createdAt: new Date().toISOString(),
      });
      onClose();
      setFormData({
        title: "",
        category: "ROLEPLAYING",
        image: "",
        cardImage: "",
        description: "",
      });
    } catch (error) {
      console.error("Erro ao salvar no Firestore:", error);
      notify("Erro ao salvar no banco de dados.", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalShell isOpen={isOpen} onClose={onClose} maxWidthClassName="max-w-2xl">
      <div className="max-h-[90vh] overflow-y-auto no-scrollbar">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-2xl font-black uppercase tracking-widest text-white">
              Adicionar Jogo
            </h2>
            <p className="text-white/30 text-[10px] font-bold uppercase tracking-widest mt-1">
              Salvar link direto no Banco
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-3 premium-glass rounded-full hover:bg-white/10 transition-colors group"
          >
            <X className="w-5 h-5 text-white group-hover:rotate-90 transition-all" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-white/40 flex items-center gap-2">
                    <Type className="w-3 h-3" /> Título do Jogo
                  </label>
                  <input
                    required
                    className="w-full premium-glass border border-white/10 rounded-xl px-5 py-4 text-sm focus:bg-white/10 outline-none"
                    placeholder="Ex: Silent Hill 2"
                    value={formData.title}
                    onChange={(e) =>
                      setFormData({ ...formData, title: e.target.value })
                    }
                  />
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-white/40 flex items-center gap-2">
                      <Tags className="w-3 h-3" /> Categoria
                    </label>
                    <select
                      className="w-full premium-glass border border-white/10 rounded-xl px-5 py-4 text-sm focus:bg-white/10 outline-none cursor-pointer appearance-none"
                      value={formData.category}
                      onChange={(e) =>
                        setFormData({ ...formData, category: e.target.value })
                      }
                    >
                      {categories.map((cat) => (
                        <option key={cat} value={cat} className="bg-[#050507]">
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-white/40 flex items-center gap-2">
                      <ImageIcon className="w-3 h-3" /> URL da Capa (Vertical)
                    </label>
                    <input
                      required
                      className="w-full premium-glass border border-white/10 rounded-xl px-5 py-4 text-sm focus:bg-white/10 outline-none"
                      placeholder="https://..."
                      value={formData.cardImage}
                      onChange={(e) =>
                        setFormData({ ...formData, cardImage: e.target.value })
                      }
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-white/40 flex items-center gap-2">
                    <ImageIcon className="w-3 h-3" /> URL do Wallpaper (Horizontal)
                  </label>
                  <input
                    required
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-4 text-sm focus:bg-white/10 outline-none"
                    placeholder="https://..."
                    value={formData.image}
                    onChange={(e) =>
                      setFormData({ ...formData, image: e.target.value })
                    }
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-white/40 flex items-center gap-2">
                    <AlignLeft className="w-3 h-3" /> Descrição
                  </label>
                  <textarea
                    rows={3}
                    className="w-full premium-glass border border-white/10 rounded-xl px-5 py-4 text-sm focus:bg-white/10 outline-none resize-none"
                    placeholder="Diga algo sobre o jogo..."
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                  />
                </div>

          <GlassButton
            type="submit"
            disabled={loading}
            variant="primary"
            size="md"
            className="w-full py-5"
          >
            {loading ? "Salvando..." : "Adicionar à Biblioteca"}
          </GlassButton>
        </form>
      </div>
    </ModalShell>
  );
};

export default AddGameModal;
