import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/AuthProvider";

export type LauncherLanguage = "pt-BR" | "en-US" | "es-ES";
export type SoundTheme = "ps5" | "ps2" | "gamecube" | "xbox360";
export type VisualTheme = "playstation" | "gamecube" | "xbox360" | "checkpoint" | "carbon" | "neon" | "sunset";

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
    themes: "Temas",
    themesHint: "Cada tema aplica visual e sons do mesmo pacote.",
    playstationTheme: "PlayStation",
    xbox360Theme: "Xbox 360",
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
    overviewContinue: "Continuar",
    overviewResumeSession: "Retomar sessão",
    overviewNextReturn: "Seu próximo retorno aparece aqui.",
    overviewFriends: "Amigos",
    overviewPlayingNow: "Jogando agora",
    overviewSocial: "Social",
    overviewNobodyPlaying: "Ninguém em jogo agora.",
    overviewPulse: "Pulso",
    overviewQuickSummary: "Resumo rápido",
    overviewFavorites: "Favoritos",
    overviewActivity: "Atividade",
    overviewNoRecentNews: "Sem novidades recentes.",
    overviewNoRecord: "sem registro",
    overviewHoursPlayed: "h jogadas",
    overviewOnline: "Online",
    activityFriendPlaying: "entrou em jogo",
    activityFriendPlayingDetail: "Agora está jogando",
    activityFriendOnlineDetail: "Está online no Checkpoint.",
    activityReturnedTo: "Você voltou para",
    activityLibraryHours: "h registradas na biblioteca.",
    activityFavoriteStill: "segue entre seus favoritos",
    activityFavoriteHint: "Bom candidato para voltar a jogar em uma sessão rápida.",
    addFriendTitle: "Adicionar amigo",
    addFriendHint: "Busque por nome de usuário ou email",
    addFriendSearchPlaceholder: "Digite o nome ou email do usuário...",
    addFriendSearchButton: "Buscar",
    addFriendSearching: "Buscando usuários...",
    addFriendRecentSearches: "Pesquisas recentes",
    addFriendClear: "Limpar",
    addFriendEmpty: "Busque por amigos",
    addFriendEmptyHint: "Digite o nome ou email para encontrar usuários",
    addFriendNoResults: "Nenhum usuário encontrado",
    addFriendNoResultsHint: "Verifique se o nome ou email está correto",
    addFriendKeyboardHint: "Use ↑↓ para navegar, Enter para enviar solicitação",
    addFriendSend: "Enviar",
    addFriendYou: "Você",
    addFriendAlreadyFriend: "Amigo",
    addFriendPending: "Pendente",
    addFriendRespond: "Responder",
    addFriendOnline: "Online",
    addFriendOffline: "Offline",
    addFriendPlaying: "Jogando",
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
    themes: "Themes",
    themesHint: "Each theme applies matching visuals and sounds.",
    playstationTheme: "PlayStation",
    xbox360Theme: "Xbox 360",
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
    overviewContinue: "Continue",
    overviewResumeSession: "Resume session",
    overviewNextReturn: "Your next return appears here.",
    overviewFriends: "Friends",
    overviewPlayingNow: "Playing now",
    overviewSocial: "Social",
    overviewNobodyPlaying: "Nobody is playing right now.",
    overviewPulse: "Pulse",
    overviewQuickSummary: "Quick summary",
    overviewFavorites: "Favorites",
    overviewActivity: "Activity",
    overviewNoRecentNews: "No recent updates.",
    overviewNoRecord: "no record",
    overviewHoursPlayed: "h played",
    overviewOnline: "Online",
    activityFriendPlaying: "started playing",
    activityFriendPlayingDetail: "Now playing",
    activityFriendOnlineDetail: "Is online on Checkpoint.",
    activityReturnedTo: "You returned to",
    activityLibraryHours: "h recorded in your library.",
    activityFavoriteStill: "is still one of your favorites",
    activityFavoriteHint: "A good candidate for a quick session.",
    addFriendTitle: "Add friend",
    addFriendHint: "Search by username or email",
    addFriendSearchPlaceholder: "Type the user's name or email...",
    addFriendSearchButton: "Search",
    addFriendSearching: "Searching users...",
    addFriendRecentSearches: "Recent searches",
    addFriendClear: "Clear",
    addFriendEmpty: "Search for friends",
    addFriendEmptyHint: "Type a name or email to find users",
    addFriendNoResults: "No users found",
    addFriendNoResultsHint: "Check if the name or email is correct",
    addFriendKeyboardHint: "Use ↑↓ to navigate, Enter to send request",
    addFriendSend: "Send",
    addFriendYou: "You",
    addFriendAlreadyFriend: "Friend",
    addFriendPending: "Pending",
    addFriendRespond: "Respond",
    addFriendOnline: "Online",
    addFriendOffline: "Offline",
    addFriendPlaying: "Playing",
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
    themes: "Temas",
    themesHint: "Cada tema aplica visual y sonidos del mismo paquete.",
    playstationTheme: "PlayStation",
    xbox360Theme: "Xbox 360",
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
    overviewContinue: "Continuar",
    overviewResumeSession: "Retomar sesión",
    overviewNextReturn: "Tu próximo regreso aparece aquí.",
    overviewFriends: "Amigos",
    overviewPlayingNow: "Jugando ahora",
    overviewSocial: "Social",
    overviewNobodyPlaying: "Nadie está jugando ahora.",
    overviewPulse: "Pulso",
    overviewQuickSummary: "Resumen rápido",
    overviewFavorites: "Favoritos",
    overviewActivity: "Actividad",
    overviewNoRecentNews: "Sin novedades recientes.",
    overviewNoRecord: "sin registro",
    overviewHoursPlayed: "h jugadas",
    overviewOnline: "Online",
    activityFriendPlaying: "empezó a jugar",
    activityFriendPlayingDetail: "Ahora está jugando",
    activityFriendOnlineDetail: "Está online en Checkpoint.",
    activityReturnedTo: "Volviste a",
    activityLibraryHours: "h registradas en la biblioteca.",
    activityFavoriteStill: "sigue entre tus favoritos",
    activityFavoriteHint: "Buen candidato para volver en una sesión rápida.",
    addFriendTitle: "Añadir amigo",
    addFriendHint: "Busca por nombre de usuario o email",
    addFriendSearchPlaceholder: "Escribe el nombre o email del usuario...",
    addFriendSearchButton: "Buscar",
    addFriendSearching: "Buscando usuarios...",
    addFriendRecentSearches: "Búsquedas recientes",
    addFriendClear: "Limpiar",
    addFriendEmpty: "Busca amigos",
    addFriendEmptyHint: "Escribe un nombre o email para encontrar usuarios",
    addFriendNoResults: "No se encontraron usuarios",
    addFriendNoResultsHint: "Verifica si el nombre o email es correcto",
    addFriendKeyboardHint: "Usa ↑↓ para navegar, Enter para enviar solicitud",
    addFriendSend: "Enviar",
    addFriendYou: "Tú",
    addFriendAlreadyFriend: "Amigo",
    addFriendPending: "Pendiente",
    addFriendRespond: "Responder",
    addFriendOnline: "Online",
    addFriendOffline: "Offline",
    addFriendPlaying: "Jugando",
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
  const [effectsVolume, setEffectsVolume] = useState(30);
  const [musicVolume, setMusicVolume] = useState(9);
  const [soundTheme, setSoundTheme] = useState<SoundTheme>("ps5");
  const [visualTheme, setVisualTheme] = useState<VisualTheme>("checkpoint");

  useEffect(() => {
    if (!user?.uid) return;
    const savedLanguage = localStorage.getItem(prefKey(user.uid, "language"));
    const savedEffectsVolumeRaw = localStorage.getItem(prefKey(user.uid, "effects_volume"));
    const savedMusicVolumeRaw = localStorage.getItem(prefKey(user.uid, "music_volume"));
    const savedEffectsVolume =
      savedEffectsVolumeRaw == null ? null : Number(savedEffectsVolumeRaw);
    const savedMusicVolume =
      savedMusicVolumeRaw == null ? null : Number(savedMusicVolumeRaw);
    const savedSoundTheme = localStorage.getItem(prefKey(user.uid, "sound_theme"));
    const savedVisualTheme = localStorage.getItem(prefKey(user.uid, "visual_theme"));

    if (
      savedLanguage === "pt-BR" ||
      savedLanguage === "en-US" ||
      savedLanguage === "es-ES"
    ) {
      setLanguage(savedLanguage);
    }
    if (savedEffectsVolume != null && Number.isFinite(savedEffectsVolume)) {
      setEffectsVolume(clampVolume(savedEffectsVolume));
    }
    if (savedMusicVolume != null && Number.isFinite(savedMusicVolume)) {
      setMusicVolume(clampVolume(savedMusicVolume));
    }
    if (savedSoundTheme === "ps5" || savedSoundTheme === "ps2" || savedSoundTheme === "gamecube" || savedSoundTheme === "xbox360") {
      setSoundTheme(savedSoundTheme);
    }
    if (
      savedVisualTheme === "checkpoint" ||
      savedVisualTheme === "playstation" ||
      savedVisualTheme === "gamecube" ||
      savedVisualTheme === "xbox360" ||
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
