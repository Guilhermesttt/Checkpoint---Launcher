import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/AuthProvider";

export type LauncherLanguage = "pt-BR" | "en-US" | "es-ES";
export type SoundTheme = "ps2" | "gamecube";
export type VisualTheme = "checkpoint" | "carbon" | "neon" | "sunset";

interface PreferencesContextValue {
  language: LauncherLanguage;
  effectsVolume: number;
  musicVolume: number;
  soundTheme: SoundTheme;
  visualTheme: VisualTheme;
  setLanguage: (language: LauncherLanguage) => void;
  setEffectsVolume: (volume: number) => void;
  setMusicVolume: (volume: number) => void;
  setSoundTheme: (theme: SoundTheme) => void;
  setVisualTheme: (theme: VisualTheme) => void;
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
    visualTheme: "Tema visual",
    visualThemeHint: "Skin de cores aplicada ao launcher.",
    checkpointTheme: "Checkpoint",
    carbonTheme: "Carbon",
    neonTheme: "Neon",
    sunsetTheme: "Sunset",
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
    connectedAccounts: "Contas conectadas",
    connectedAccountsHint: "Vincule sua conta Steam, Epic Games ou Discord.",
    connectEpic: "Conectar Epic",
    connectDiscord: "Conectar Discord",
    disconnectEpicTitle: "Desconectar Epic",
    disconnectEpicDescription:
      "Desvincular sua conta Epic removerá os jogos sincronizados da biblioteca.",
    disconnectDiscordTitle: "Desconectar Discord",
    disconnectDiscordDescription:
      "Desvincular sua conta Discord removerá a integração.",
    connected: "Conectado",
    notConnected: "Não conectado",
    friends: "Amigos",
    friendsHint: "Veja seus amigos de Steam, Epic e Discord.",
    steamFriends: "Amigos da Steam",
    epicFriends: "Amigos da Epic",
    discordFriends: "Amigos do Discord",
    priceAlerts: "Alertas de preço",
    priceAlertsHint: "Monitore ofertas dos jogos da sua biblioteca.",
    addAlert: "Monitorar oferta",
    noAlerts: "Nenhum alerta criado.",
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
    visualTheme: "Visual theme",
    visualThemeHint: "Color skin applied to the launcher.",
    checkpointTheme: "Checkpoint",
    carbonTheme: "Carbon",
    neonTheme: "Neon",
    sunsetTheme: "Sunset",
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
    connectedAccounts: "Connected accounts",
    connectedAccountsHint: "Link your Steam, Epic Games or Discord account.",
    connectEpic: "Connect Epic",
    connectDiscord: "Connect Discord",
    disconnectEpicTitle: "Disconnect Epic",
    disconnectEpicDescription:
      "Unlinking Epic will remove synced games from your library.",
    disconnectDiscordTitle: "Disconnect Discord",
    disconnectDiscordDescription:
      "Unlinking Discord will remove integration.",
    connected: "Connected",
    notConnected: "Not connected",
    friends: "Friends",
    friendsHint: "View your friends from Steam, Epic and Discord.",
    steamFriends: "Steam Friends",
    epicFriends: "Epic Friends",
    discordFriends: "Discord Friends",
    priceAlerts: "Price alerts",
    priceAlertsHint: "Monitor deals for games in your library.",
    addAlert: "Track deal",
    noAlerts: "No alerts created.",
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
    visualTheme: "Tema visual",
    visualThemeHint: "Skin de colores aplicada al launcher.",
    checkpointTheme: "Checkpoint",
    carbonTheme: "Carbon",
    neonTheme: "Neon",
    sunsetTheme: "Sunset",
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
    newGame: "Nuevo Jogo",
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
    connectedAccounts: "Cuentas conectadas",
    connectedAccountsHint: "Vincula tu cuenta de Steam, Epic Games o Discord.",
    connectEpic: "Conectar Epic",
    connectDiscord: "Conectar Discord",
    disconnectEpicTitle: "Desconectar Epic",
    disconnectEpicDescription:
      "Desvincular Epic eliminará los juegos sincronizados de la biblioteca.",
    disconnectDiscordTitle: "Desconectar Discord",
    disconnectDiscordDescription:
      "Desvincular Discord eliminará la integración.",
    connected: "Conectado",
    notConnected: "No conectado",
    friends: "Amigos",
    friendsHint: "Ver tus amigos de Steam, Epic y Discord.",
    steamFriends: "Amigos de Steam",
    epicFriends: "Amigos de Epic",
    discordFriends: "Amigos de Discord",
    priceAlerts: "Alertas de precio",
    priceAlertsHint: "Monitorea ofertas de los juegos de tu biblioteca.",
    addAlert: "Monitorear oferta",
    noAlerts: "Ninguna alerta creada.",
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
  const [visualTheme, setVisualTheme] = useState<VisualTheme>("checkpoint");

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
    const savedVisualTheme = localStorage.getItem(prefKey(user.uid, "visual_theme"));

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
    if (
      savedVisualTheme === "checkpoint" ||
      savedVisualTheme === "carbon" ||
      savedVisualTheme === "neon" ||
      savedVisualTheme === "sunset"
    ) {
      setVisualTheme(savedVisualTheme);
    }
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid) return;
    localStorage.setItem(prefKey(user.uid, "language"), language);
    localStorage.setItem(prefKey(user.uid, "effects_volume"), String(effectsVolume));
    localStorage.setItem(prefKey(user.uid, "music_volume"), String(musicVolume));
    localStorage.setItem(prefKey(user.uid, "sound_theme"), soundTheme);
    localStorage.setItem(prefKey(user.uid, "visual_theme"), visualTheme);
  }, [effectsVolume, language, musicVolume, soundTheme, user?.uid, visualTheme]);

  useEffect(() => {
    document.documentElement.dataset.launcherTheme = visualTheme;
  }, [visualTheme]);

  const value = useMemo<PreferencesContextValue>(
    () => ({
      language,
      effectsVolume,
      musicVolume,
      soundTheme,
      visualTheme,
      setLanguage,
      setEffectsVolume: (volume) => setEffectsVolume(clampVolume(volume)),
      setMusicVolume: (volume) => setMusicVolume(clampVolume(volume)),
      setSoundTheme,
      setVisualTheme,
      t: (key) => translations[language][key] ?? translations["pt-BR"][key],
    }),
    [effectsVolume, language, musicVolume, soundTheme, visualTheme],
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
