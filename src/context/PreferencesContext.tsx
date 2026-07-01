import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/AuthProvider";

export type LauncherLanguage = "pt-BR" | "en-US" | "es-ES";
export type SoundTheme = "ps2" | "gamecube";

interface PreferencesContextValue {
  language: LauncherLanguage;
  effectsVolume: number;
  musicVolume: number;
  soundTheme: SoundTheme;
  setLanguage: (language: LauncherLanguage) => void;
  setEffectsVolume: (volume: number) => void;
  setMusicVolume: (volume: number) => void;
  setSoundTheme: (theme: SoundTheme) => void;
  t: (key: TranslationKey) => string;
}

const translations = {
  "pt-BR": {
    settings: "Ajustes",
    system: "Sistema",
    language: "Idioma",
    languageHint: "Preferência visual salva neste dispositivo.",
    soundEffects: "Efeitos sonoros",
    soundEffectsHint: "Volume de navegação, seleção e retorno.",
    music: "Música",
    musicHint: "Volume da trilha de fundo em loop.",
    soundTheme: "Tema sonoro",
    soundThemeHint: "Pacote de sons usado pela interface.",
    defaultTheme: "Padrão",
    gamecubeTheme: "GameCube",
    test: "Testar",
    mute: "Mudo",
    max: "Máximo",
    new: "Novo",
    searchPlaceholder: "Buscar jogo... (S)",
    connectSteam: "Conectar Steam",
    connecting: "Conectando...",
    unlink: "Desvincular",
    sync: "Sync",
    syncing: "Sync...",
    identity: "Identidade",
    playNow: "Jogar Agora",
    viaSteam: "Via Steam",
    favorite: "Favorito",
    emptyLibrary: "Biblioteca vazia",
    noResults: "Nenhum resultado",
    noResultsHint: "Tente buscar por outro termo.",
    emptyHintConnected: "Você não possui jogos salvos. Adicione um jogo manualmente.",
    emptyHintDisconnected: "Adicione um jogo ou conecte sua conta Steam.",
    newGame: "Novo Jogo",
    editMetadata: "Editar Metadados",
    addFavorite: "Adicionar aos Favoritos",
    removeFavorite: "Remover dos Favoritos",
    removeFromLibrary: "Remover da Biblioteca",
    cancel: "Cancelar",
    confirm: "Confirmar",
    signOutTitle: "Encerrar Sessão",
    signOutDescription: "Você será desconectado e retornará à tela de entrada.",
    signOutConfirm: "Sair Agora",
    disconnectSteamTitle: "Desconectar Steam",
    disconnectSteamDescription:
      "Desvincular sua conta Steam removerá os jogos sincronizados da biblioteca.",
    launching: "Iniciando...",
    play: "Jogar",
  },
  "en-US": {
    settings: "Settings",
    system: "System",
    language: "Language",
    languageHint: "Visual preference saved on this device.",
    soundEffects: "Sound effects",
    soundEffectsHint: "Navigation, selection and back volume.",
    music: "Music",
    musicHint: "Background loop track volume.",
    soundTheme: "Sound theme",
    soundThemeHint: "Sound pack used by the interface.",
    defaultTheme: "Default",
    gamecubeTheme: "GameCube",
    test: "Test",
    mute: "Mute",
    max: "Max",
    new: "New",
    searchPlaceholder: "Search game... (S)",
    connectSteam: "Connect Steam",
    connecting: "Connecting...",
    unlink: "Unlink",
    sync: "Sync",
    syncing: "Sync...",
    identity: "Identity",
    playNow: "Play Now",
    viaSteam: "Via Steam",
    favorite: "Favorite",
    emptyLibrary: "Empty library",
    noResults: "No results",
    noResultsHint: "Try searching for another term.",
    emptyHintConnected: "You do not have saved games. Add one manually.",
    emptyHintDisconnected: "Add a game or connect your Steam account.",
    newGame: "New Game",
    editMetadata: "Edit Metadata",
    addFavorite: "Add to Favorites",
    removeFavorite: "Remove from Favorites",
    removeFromLibrary: "Remove from Library",
    cancel: "Cancel",
    confirm: "Confirm",
    signOutTitle: "Sign Out",
    signOutDescription: "You will be signed out and returned to the login screen.",
    signOutConfirm: "Sign Out",
    disconnectSteamTitle: "Disconnect Steam",
    disconnectSteamDescription:
      "Unlinking Steam will remove synced games from your library.",
    launching: "Launching...",
    play: "Play",
  },
  "es-ES": {
    settings: "Ajustes",
    system: "Sistema",
    language: "Idioma",
    languageHint: "Preferencia visual guardada en este dispositivo.",
    soundEffects: "Efectos sonoros",
    soundEffectsHint: "Volumen de navegación, selección y retorno.",
    music: "Música",
    musicHint: "Volumen de la pista de fondo en loop.",
    soundTheme: "Tema sonoro",
    soundThemeHint: "Paquete de sonidos usado por la interfaz.",
    defaultTheme: "Predeterminado",
    gamecubeTheme: "GameCube",
    test: "Probar",
    mute: "Silencio",
    max: "Máximo",
    new: "Nuevo",
    searchPlaceholder: "Buscar juego... (S)",
    connectSteam: "Conectar Steam",
    connecting: "Conectando...",
    unlink: "Desvincular",
    sync: "Sync",
    syncing: "Sync...",
    identity: "Identidad",
    playNow: "Jugar Ahora",
    viaSteam: "Vía Steam",
    favorite: "Favorito",
    emptyLibrary: "Biblioteca vacía",
    noResults: "Sin resultados",
    noResultsHint: "Intenta buscar otro término.",
    emptyHintConnected: "No tienes juegos guardados. Añade uno manualmente.",
    emptyHintDisconnected: "Añade un juego o conecta tu cuenta de Steam.",
    newGame: "Nuevo Juego",
    editMetadata: "Editar Metadatos",
    addFavorite: "Añadir a Favoritos",
    removeFavorite: "Quitar de Favoritos",
    removeFromLibrary: "Quitar de la Biblioteca",
    cancel: "Cancelar",
    confirm: "Confirmar",
    signOutTitle: "Cerrar Sesión",
    signOutDescription: "Se cerrará tu sesión y volverás a la pantalla de entrada.",
    signOutConfirm: "Salir Ahora",
    disconnectSteamTitle: "Desconectar Steam",
    disconnectSteamDescription:
      "Desvincular Steam eliminará los juegos sincronizados de la biblioteca.",
    launching: "Iniciando...",
    play: "Jugar",
  },
} as const;

export type TranslationKey = keyof (typeof translations)["pt-BR"];

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

const clampVolume = (value: number) =>
  Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : 0;

const prefKey = (uid: string, key: string) => `checkpoint_${key}_${uid}`;

export const PreferencesProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { user } = useAuth();
  const [language, setLanguage] = useState<LauncherLanguage>("pt-BR");
  const [effectsVolume, setEffectsVolume] = useState(35);
  const [musicVolume, setMusicVolume] = useState(8);
  const [soundTheme, setSoundTheme] = useState<SoundTheme>("ps2");

  useEffect(() => {
    if (!user?.uid) return;
    const savedLanguage = localStorage.getItem(prefKey(user.uid, "language"));
    const savedEffectsVolume = Number(
      localStorage.getItem(prefKey(user.uid, "effects_volume")),
    );
    const savedMusicVolume = Number(
      localStorage.getItem(prefKey(user.uid, "music_volume")),
    );
    const savedSoundTheme = localStorage.getItem(prefKey(user.uid, "sound_theme"));

    if (
      savedLanguage === "pt-BR" ||
      savedLanguage === "en-US" ||
      savedLanguage === "es-ES"
    ) {
      setLanguage(savedLanguage);
    }
    if (Number.isFinite(savedEffectsVolume)) {
      setEffectsVolume(clampVolume(savedEffectsVolume));
    }
    if (Number.isFinite(savedMusicVolume)) {
      setMusicVolume(clampVolume(savedMusicVolume));
    }
    if (savedSoundTheme === "ps2" || savedSoundTheme === "gamecube") {
      setSoundTheme(savedSoundTheme);
    }
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid) return;
    localStorage.setItem(prefKey(user.uid, "language"), language);
    localStorage.setItem(prefKey(user.uid, "effects_volume"), String(effectsVolume));
    localStorage.setItem(prefKey(user.uid, "music_volume"), String(musicVolume));
    localStorage.setItem(prefKey(user.uid, "sound_theme"), soundTheme);
  }, [effectsVolume, language, musicVolume, soundTheme, user?.uid]);

  const value = useMemo<PreferencesContextValue>(
    () => ({
      language,
      effectsVolume,
      musicVolume,
      soundTheme,
      setLanguage,
      setEffectsVolume: (volume) => setEffectsVolume(clampVolume(volume)),
      setMusicVolume: (volume) => setMusicVolume(clampVolume(volume)),
      setSoundTheme,
      t: (key) => translations[language][key] ?? translations["pt-BR"][key],
    }),
    [effectsVolume, language, musicVolume, soundTheme],
  );

  return (
    <PreferencesContext.Provider value={value}>
      {children}
    </PreferencesContext.Provider>
  );
};

export const usePreferences = () => {
  const ctx = useContext(PreferencesContext);
  if (!ctx) {
    throw new Error("usePreferences deve ser usado dentro de PreferencesProvider");
  }
  return ctx;
};
