import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Radio,
  Gamepad2,
  Swords,
  BookOpen,
  MessageSquare,
  Lock,
  Unlock,
  KeyRound,
  X,
  Plus,
  Eye,
  EyeOff,
  Sparkles,
  Palette,
  Image as ImageIcon,
} from "lucide-react";
import type { RoomCategory, CallRoomConfig } from "../../types/voice-governance";
import type { UserProfile } from "../../types/domain";

interface CreateChannelModalProps {
  isOpen: boolean;
  onClose: () => void;
  userProfile: UserProfile | null;
  initialConfig?: Partial<CallRoomConfig> | null;
  isEditing?: boolean;
  onCreateChannel: (config: CallRoomConfig) => void;
}

const CATEGORIES: {
  id: RoomCategory;
  label: string;
  desc: string;
  icon: React.ReactNode;
}[] = [
    {
      id: "resenha_games",
      label: "Resenha & Games",
      desc: "Jogos em grupo, diversão e zoeira",
      icon: <Gamepad2 className="h-4 w-4" />,
    },
    {
      id: "gameplay_foco",
      label: "Só Gameplay",
      desc: "Foco competitivo e comunicação limpa",
      icon: <Swords className="h-4 w-4" />,
    },
    {
      id: "estudos_foco",
      label: "Foco & Estudos",
      desc: "Trabalho, programação e concentração",
      icon: <BookOpen className="h-4 w-4" />,
    },
    {
      id: "casual_chat",
      label: "Conversa Livre",
      desc: "Bate-papo aberto sobre qualquer assunto",
      icon: <MessageSquare className="h-4 w-4" />,
    },
  ];

const PRESET_ICONS = ["🎮", "🕹️", "⚔️", "🎧", "🛡️", "👑", "🚀", "👾", "⚡", "🎲", "🔥", "🌟"];

const THEME_COLORS = [
  { id: "purple", label: "Neon Purple", value: "#8B5CF6", border: "border-purple-500", bg: "bg-purple-500/20" },
  { id: "cyan", label: "Retro Cyan", value: "#06B6D4", border: "border-cyan-500", bg: "bg-cyan-500/20" },
  { id: "amber", label: "Sunset Amber", value: "#F59E0B", border: "border-amber-500", bg: "bg-amber-500/20" },
  { id: "red", label: "Crimson Red", value: "#EF4444", border: "border-rose-500", bg: "bg-rose-500/20" },
  { id: "emerald", label: "Cyber Emerald", value: "#10B981", border: "border-emerald-500", bg: "bg-emerald-500/20" },
  { id: "blue", label: "Cobalt Blue", value: "#3B82F6", border: "border-blue-500", bg: "bg-blue-500/20" },
  { id: "monochrome", label: "Monochrome Ice", value: "#F8FAFC", border: "border-white", bg: "bg-white/20" },
];

export const CreateChannelModal: React.FC<CreateChannelModalProps> = ({
  isOpen,
  onClose,
  userProfile,
  initialConfig,
  isEditing = false,
  onCreateChannel,
}) => {
  const [roomName, setRoomName] = useState("");
  const [category, setCategory] = useState<RoomCategory>("resenha_games");
  const [selectedIcon, setSelectedIcon] = useState("🎮");
  const [customAvatarUrl, setCustomAvatarUrl] = useState("");
  const [themeColor, setThemeColor] = useState(THEME_COLORS[0].value);
  const [isPrivate, setIsPrivate] = useState(false);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fallbackDefaultName = `Canal de ${userProfile?.displayName || "Voz"}`;

  useEffect(() => {
    if (isOpen) {
      if (initialConfig) {
        setRoomName(initialConfig.roomName || "");
        setCategory(initialConfig.category || "resenha_games");
        setSelectedIcon(initialConfig.icon || "🎮");
        setCustomAvatarUrl(initialConfig.avatarUrl || "");
        setThemeColor(initialConfig.themeColor || THEME_COLORS[0].value);
        setIsPrivate(Boolean(initialConfig.isPrivate));
        setPassword(initialConfig.password || "");
      } else {
        setRoomName("");
        setCategory("resenha_games");
        setSelectedIcon("🎮");
        setCustomAvatarUrl("");
        setThemeColor(THEME_COLORS[0].value);
        setIsPrivate(false);
        setPassword("");
      }
      setError(null);
    }
  }, [isOpen, initialConfig]);

  // Trava o scroll do body enquanto o modal está aberto e permite fechar com Esc.
  useEffect(() => {
    if (!isOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen, onClose]);

  const handleCreate = () => {
    const trimmedName = roomName.trim() || fallbackDefaultName;
    if (isPrivate && password.trim().length > 0 && password.trim().length < 3) {
      setError("A senha da sala deve ter pelo menos 3 caracteres.");
      return;
    }

    onCreateChannel({
      roomName: trimmedName,
      category,
      isPrivate,
      password: isPrivate && password.trim() ? password.trim() : undefined,
      icon: selectedIcon,
      avatarUrl: customAvatarUrl.trim() || undefined,
      themeColor,
    });
    onClose();
  };

  if (!isOpen) return null;

  // Portal direto pro <body>: garante que o modal fica na frente de QUALQUER coisa,
  // independente de em que parte da árvore (sidebar, painel, card) ele é chamado.
  // Sem isso, um pai com overflow:hidden ou transform pode "prender" o z-index
  // mesmo com position:fixed e z-[99999].
  return createPortal(
    <AnimatePresence>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Criar canal de voz"
        className="fixed inset-0 z-[99999] flex items-center justify-center p-4 select-none"
      >
        {/* Backdrop: escurece e borra tudo atrás, padrão de modal */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/80 backdrop-blur-2xl"
        />

        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 10 }}
          transition={{ type: "spring", stiffness: 380, damping: 28 }}
          className="relative flex flex-col w-full max-w-xl max-h-[88vh] overflow-hidden rounded-[28px] border border-white/[0.12] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#1c1d28]/98 via-[#111218]/99 to-[#08090c] shadow-[0_35px_110px_rgba(0,0,0,0.95)] backdrop-blur-2xl z-10"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/8 bg-black/35 backdrop-blur-md">
            <div className="flex items-center gap-3">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-xl border text-lg shadow-sm"
                style={{ borderColor: `${themeColor}60`, backgroundColor: `${themeColor}20` }}
              >
                {customAvatarUrl ? (
                  <img src={customAvatarUrl} alt="" className="h-full w-full rounded-xl object-cover" />
                ) : (
                  <span>{selectedIcon}</span>
                )}
              </div>
              <div>
                <h3 className="text-sm font-black text-white tracking-tight uppercase flex items-center gap-2">
                  <span>{isEditing ? "Editar Aparência do Canal" : "Criar Canal de Voz"}</span>
                  <Sparkles className="h-3.5 w-3.5 text-white/80" />
                </h3>
                <p className="text-[11px] text-white/40">
                  {isEditing
                    ? "Altere o nome, ícone, cor e visibilidade do canal"
                    : "Personalize nome, foto, cor e visibilidade do seu canal"}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="h-8 w-8 flex items-center justify-center rounded-xl bg-white/5 text-white/60 hover:text-white hover:bg-white/15 transition cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Form Content */}
          <div className="p-6 space-y-5 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10">
            {/* 1. Nome do Canal */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-white/80">Nome do Canal</label>
              <input
                type="text"
                placeholder={fallbackDefaultName}
                value={roomName}
                onChange={(e) => {
                  setRoomName(e.target.value);
                  setError(null);
                }}
                className="w-full h-11 px-4 rounded-xl bg-black/35 border border-white/10 text-xs font-semibold text-white placeholder-white/30 focus:outline-none focus:border-white/30 focus:bg-black/50 transition"
              />
            </div>

            {/* 2. Personalização Visual: Ícone / Foto e Cor */}
            <div className="space-y-3 p-4 rounded-2xl bg-black/30 border border-white/8">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-white/80 flex items-center gap-1.5">
                  <Palette className="h-3.5 w-3.5 text-white/70" />
                  <span>Personalização Visual</span>
                </label>
              </div>

              {/* Seletor de Ícones Preset */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-medium text-white/50">Escolha o Ícone do Canal</span>
                <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                  {PRESET_ICONS.map((icon) => {
                    const isSelected = selectedIcon === icon && !customAvatarUrl;
                    return (
                      <button
                        key={icon}
                        type="button"
                        onClick={() => {
                          setSelectedIcon(icon);
                          setCustomAvatarUrl("");
                        }}
                        className={`h-9 w-9 rounded-xl flex items-center justify-center text-base transition-all cursor-pointer shrink-0 border ${isSelected
                            ? "bg-white/20 border-white shadow-sm scale-110"
                            : "bg-white/5 border-white/5 hover:bg-white/10 hover:border-white/15"
                          }`}
                      >
                        {icon}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* URL de Imagem / Foto Customizada */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-medium text-white/50 flex items-center gap-1">
                  <ImageIcon className="h-3 w-3 text-white/40" />
                  <span>Ou use uma Foto / Imagem (URL)</span>
                </label>
                <input
                  type="text"
                  placeholder="https://exemplo.com/icone-sala.png"
                  value={customAvatarUrl}
                  onChange={(e) => setCustomAvatarUrl(e.target.value)}
                  className="w-full h-9 px-3 rounded-xl bg-white/5 border border-white/10 text-xs font-medium text-white placeholder-white/30 focus:outline-none focus:border-white/25 transition"
                />
              </div>

              {/* Seletor de Cor do Tema */}
              <div className="space-y-1.5 pt-1">
                <span className="text-[11px] font-medium text-white/50">Cor de Destaque</span>
                <div className="flex items-center gap-2.5">
                  {THEME_COLORS.map((c) => {
                    const isSelected = themeColor === c.value;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setThemeColor(c.value)}
                        className={`h-7 w-7 rounded-full transition-all cursor-pointer border-2 relative flex items-center justify-center ${isSelected ? "border-white scale-125 shadow-md" : "border-transparent hover:scale-110 opacity-70 hover:opacity-100"
                          }`}
                        style={{ backgroundColor: c.value }}
                        title={c.label}
                      >
                        {isSelected && <span className="h-1.5 w-1.5 rounded-full bg-black" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* 3. Categoria do Canal */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-white/80">Categoria da Conversa</label>
              <div className="grid grid-cols-2 gap-2.5">
                {CATEGORIES.map((cat) => {
                  const isSelected = category === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setCategory(cat.id)}
                      className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col gap-1.5 ${isSelected
                          ? "bg-white text-black border-white shadow-lg"
                          : "bg-black/30 hover:bg-white/[0.05] border-white/8 text-white hover:border-white/15"
                        }`}
                    >
                      <div className="flex items-center gap-2 font-black text-xs">
                        <span className={isSelected ? "text-black" : "text-white/70"}>
                          {cat.icon}
                        </span>
                        <span>{cat.label}</span>
                      </div>
                      <p
                        className={`text-[10px] leading-tight ${isSelected ? "text-black/70 font-medium" : "text-white/40"
                          }`}
                      >
                        {cat.desc}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 4. Nível de Privacidade */}
            <div className="space-y-2.5">
              <label className="text-xs font-bold text-white/80">Visibilidade & Acesso</label>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsPrivate(false)}
                  className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col gap-1 ${!isPrivate
                      ? "bg-white text-black border-white shadow-sm"
                      : "bg-black/30 hover:bg-white/[0.05] border-white/8 text-white/60"
                    }`}
                >
                  <div className={`flex items-center gap-1.5 font-black text-xs ${!isPrivate ? "text-black" : "text-white"}`}>
                    <Unlock className={`h-3.5 w-3.5 ${!isPrivate ? "text-black" : "text-white/80"}`} />
                    <span>🌐 Sala Pública</span>
                  </div>
                  <p className={`text-[10px] leading-tight ${!isPrivate ? "text-black/70 font-medium" : "text-white/50"}`}>
                    Visível na aba de Canais. Qualquer amigo pode entrar direto.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setIsPrivate(true)}
                  className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col gap-1 ${isPrivate
                      ? "bg-white text-black border-white shadow-sm"
                      : "bg-black/30 hover:bg-white/[0.05] border-white/8 text-white/60"
                    }`}
                >
                  <div className={`flex items-center gap-1.5 font-black text-xs ${isPrivate ? "text-black" : "text-white"}`}>
                    <Lock className={`h-3.5 w-3.5 ${isPrivate ? "text-amber-600" : "text-amber-400"}`} />
                    <span>🔒 Sala Privada</span>
                  </div>
                  <p className={`text-[10px] leading-tight ${isPrivate ? "text-black/70 font-medium" : "text-white/50"}`}>
                    Invisível na lista global. Apenas quem receber convite entra.
                  </p>
                </button>
              </div>
            </div>

            {/* Senha Opcional quando Privada */}
            {isPrivate && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-1.5 p-3.5 rounded-2xl bg-black/30 border border-white/8"
              >
                <label className="text-[11px] font-bold text-white/70 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <KeyRound className="h-3.5 w-3.5 text-amber-400" />
                    <span>Senha Opcional (Proteção Extra)</span>
                  </span>
                  <span className="text-[9px] text-white/40">Opcional</span>
                </label>
                <div className="relative flex items-center">
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="Deixe em branco para sem senha"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setError(null);
                    }}
                    className="w-full h-10 px-3.5 pr-10 rounded-xl bg-black/40 border border-white/10 text-xs font-semibold text-white placeholder-white/30 focus:outline-none focus:border-white/30 transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-3 text-white/40 hover:text-white transition"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </motion.div>
            )}

            {error && (
              <p className="text-xs text-rose-400 font-medium">{error}</p>
            )}
          </div>

          {/* Footer Actions */}
          <div className="px-6 py-4 border-t border-white/8 bg-black/35 backdrop-blur-md flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/8 text-white font-bold text-xs transition cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleCreate}
              className="flex-1 py-2.5 rounded-xl bg-white text-black hover:bg-white/90 font-black text-xs shadow-[0_4px_20px_rgba(255,255,255,0.15)] transition hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-1.5 cursor-pointer"
            >
              {isEditing ? (
                <>
                  <Sparkles className="h-4 w-4" />
                  <span>Salvar Alterações</span>
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4" />
                  <span>Criar Canal</span>
                </>
              )}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>,
    document.body,
  );
};