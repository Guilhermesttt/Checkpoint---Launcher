import React, { useRef, useState } from "react";
import { Camera, Check, LoaderCircle, Trash2, X } from "lucide-react";
import type { EditableProfile, UserProfile } from "../types/domain";
import {
  PROFILE_LIMITS,
  saveCurrentUserProfile,
} from "../services/profile";

interface ProfileEditorModalProps {
  profile: UserProfile | null;
  fallbackName: string;
  fallbackPhotoURL?: string | null;
  onClose: () => void;
  onSaved?: () => Promise<void> | void;
}

const inputClass =
  "w-full rounded-xl border border-white/10 bg-black/45 px-3.5 py-3 text-sm text-white outline-none transition focus:border-white/30 placeholder:text-white/20";

const AVAILABLE_GENRES = [
  "Ação", "Aventura", "RPG", "Estratégia", "Simulação",
  "Esportes", "Corrida", "Luta", "Shooter (FPS/TPS)",
  "Plataforma", "Puzzle", "Sobrevivência", "Terror",
  "MMO", "Indie", "Casual", "Moba"
];

const ProfileEditorModal: React.FC<ProfileEditorModalProps> = ({
  profile,
  fallbackName,
  fallbackPhotoURL,
  onClose,
  onSaved,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState<EditableProfile>({
    displayName: profile?.displayName || fallbackName,
    photoURL: profile?.photoURL || fallbackPhotoURL || "",
    bio: profile?.bio || "",
    website: profile?.website || "",
    favoriteGenres: profile?.favoriteGenres || [],
  });
  
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const setField = (field: keyof EditableProfile, value: any) =>
    setForm((current) => ({ ...current, [field]: value }));

  const handleFile = (file?: File) => {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("Use uma imagem JPG, PNG ou WebP.");
      return;
    }
    
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX_SIZE = 256;
        let width = img.width;
        let height = img.height;
        
        if (width > height) {
          if (width > MAX_SIZE) {
            height *= MAX_SIZE / width;
            width = MAX_SIZE;
          }
        } else {
          if (height > MAX_SIZE) {
            width *= MAX_SIZE / height;
            height = MAX_SIZE;
          }
        }
        
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(img, 0, 0, width, height);
        
        const dataUrl = canvas.toDataURL("image/webp", 0.8);
        setField("photoURL", dataUrl);
        setError("");
      };
      img.src = e.target?.result as string;
    };
    reader.onerror = () => setError("Erro ao ler imagem.");
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      await saveCurrentUserProfile({ profile: form });
      await onSaved?.();
      onClose();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Não foi possível salvar o perfil.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 p-5 backdrop-blur-md">
      <button type="button" aria-label="Fechar editor" className="absolute inset-0" onClick={onClose} />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="profile-editor-title"
        className="relative z-10 max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-[28px] border border-white/12 bg-[#090909] p-6 shadow-2xl thin-scrollbar"
      >
        <header className="mb-6 flex items-start justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-white/35">Conta Checkpoint</p>
            <h2 id="profile-editor-title" className="mt-1 text-2xl font-black text-white">Editar perfil</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl border border-white/10 p-2 text-white/50 hover:bg-white/10 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="mb-6 flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/[0.035] p-4 sm:flex-row sm:items-center">
          <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/15 bg-white/[0.06] text-2xl font-black text-white/50">
            {form.photoURL ? <img src={form.photoURL} alt="Prévia do avatar" className="h-full w-full object-cover" /> : form.displayName.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <p className="text-sm font-black text-white">Foto de perfil</p>
            <p className="mt-1 text-xs text-white/35">JPG, PNG ou WebP, até 5 MB.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(event) => handleFile(event.target.files?.[0])}
              />
              <button type="button" onClick={() => fileInputRef.current?.click()} className="inline-flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-xs font-black text-black hover:bg-white/85">
                <Camera className="h-4 w-4" /> Escolher foto
              </button>
              {form.photoURL && (
                <button
                  type="button"
                  onClick={() => setField("photoURL", "")}
                  className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-xs font-black text-white/55 hover:bg-white/10 hover:text-white"
                >
                  <Trash2 className="h-4 w-4" /> Remover
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="sm:col-span-2">
            <span className="mb-1.5 block text-[10px] font-black uppercase tracking-wider text-white/40">Nome público</span>
            <input className={inputClass} maxLength={PROFILE_LIMITS.displayName} value={form.displayName} onChange={(event) => setField("displayName", event.target.value)} />
          </label>
          
          <label className="sm:col-span-2">
            <span className="mb-1.5 flex justify-between text-[10px] font-black uppercase tracking-wider text-white/40">
              <span>Bio</span><span>{form.bio.length}/{PROFILE_LIMITS.bio}</span>
            </span>
            <textarea className={`${inputClass} min-h-24 resize-none`} maxLength={PROFILE_LIMITS.bio} value={form.bio} placeholder="Conte um pouco sobre você e os jogos que curte." onChange={(event) => setField("bio", event.target.value)} />
          </label>
          
          <label className="sm:col-span-2">
            <span className="mb-1.5 block text-[10px] font-black uppercase tracking-wider text-white/40">Site ou rede social</span>
            <input className={inputClass} maxLength={PROFILE_LIMITS.website} value={form.website} placeholder="https://..." onChange={(event) => setField("website", event.target.value)} />
          </label>

          <div className="sm:col-span-2 mt-2">
            <span className="mb-2 flex justify-between text-[10px] font-black uppercase tracking-wider text-white/40">
              <span>Gêneros favoritos</span>
              <span>{form.favoriteGenres.length}/{PROFILE_LIMITS.genres}</span>
            </span>
            <div className="flex flex-wrap gap-2">
              {AVAILABLE_GENRES.map((genre) => {
                const isSelected = form.favoriteGenres.includes(genre);
                return (
                  <button
                    key={genre}
                    type="button"
                    onClick={() => {
                      if (isSelected) {
                        setField("favoriteGenres", form.favoriteGenres.filter(g => g !== genre));
                      } else {
                        if (form.favoriteGenres.length < PROFILE_LIMITS.genres) {
                          setField("favoriteGenres", [...form.favoriteGenres, genre]);
                        }
                      }
                    }}
                    className={`rounded-full px-3 py-1.5 text-xs font-bold transition border ${isSelected ? "border-white bg-white text-black" : "border-white/10 bg-black/45 text-white/70 hover:border-white/30 hover:text-white"}`}
                  >
                    {genre}
                  </button>
                );
              })}
            </div>
            <span className="mt-1.5 block text-[10px] text-white/25">Selecione até {PROFILE_LIMITS.genres} gêneros.</span>
          </div>
        </div>

        {error && <p role="alert" className="mt-4 rounded-xl border border-red-400/20 bg-red-400/10 px-3 py-2 text-xs font-bold text-red-200">{error}</p>}

        <footer className="mt-6 flex justify-end gap-3">
          <button type="button" disabled={saving} onClick={onClose} className="rounded-xl border border-white/10 px-4 py-2.5 text-xs font-black text-white/55 hover:bg-white/10">Cancelar</button>
          <button type="button" disabled={saving} onClick={handleSave} className="inline-flex min-w-32 items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-xs font-black text-black hover:bg-white/85 disabled:opacity-50">
            {saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            {saving ? "Salvando..." : "Salvar perfil"}
          </button>
        </footer>
      </section>
    </div>
  );
};

export default ProfileEditorModal;

