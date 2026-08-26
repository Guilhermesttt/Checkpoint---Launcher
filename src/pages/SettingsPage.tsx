import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSpotify } from "@fortawesome/free-brands-svg-icons";
import {
  Activity,
  Bell,
  Camera,
  Check,
  CheckCircle2,
  Gamepad2,
  Globe,
  Headphones,
  KeyRound,
  Languages,
  Lock,
  LogOut,
  Mic,
  MicOff,
  MonitorUp,
  Palette,
  Radio,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  User,
  Volume2,
  VolumeX,
  Zap,
} from "lucide-react";
import { SystemPageShell } from "../components/ui/SystemPageShell";
import { Switch } from "../components/ui/switch";
import { AppUpdateSection, SettingsHeader } from "../components/settings/AppUpdateSection";
import { usePreferences, type LauncherLanguage, type SoundTheme, type VisualTheme } from "../context/PreferencesContext";
import { useVoiceCallContext } from "../context/VoiceCallContext";
import { useSoundEffects } from "../hooks/useSoundEffects";
import { useGamepad } from "../context/GamepadContext";
import { useControllerLedStatus } from "../hooks/useControllerLed";
import { useAuth } from "../auth/AuthProvider";
import { supabase } from "../services/supabase";
import { saveProfileVisibility } from "../services/profilePrivacy";
import type { SettingsTab } from "../services/launcherNavigation";
import type { ProfileVisibility } from "../types/domain";

type TranslationFn = ReturnType<typeof usePreferences>["t"];
type BrandIcon = React.ComponentType<{ className?: string; style?: React.CSSProperties }>;

export interface LanguageOption {
  id: LauncherLanguage;
  label: string;
  hint: string;
}

export interface AppThemeOption {
  id: "default" | "ps5" | "playstation" | "ps4" | "psp" | "gamecube" | "xbox360" | "cyberpunk";
  label: string;
  hint: string;
  swatch: string;
  soundTheme: SoundTheme;
  visualTheme: VisualTheme;
}

const CONTROLLER_COPY = {
  "pt-BR": ["Controle", "Controle conectado", "Nenhum controle conectado", "Conecte via USB ou Bluetooth para navegar pelo launcher.", "Testar LED", "Autorizar"],
  "en-US": ["Controller", "Controller connected", "No controller connected", "Connect through USB or Bluetooth to navigate the launcher.", "Test LED", "Authorize"],
  "es-ES": ["Mando", "Mando conectado", "Ningún mando conectado", "Conecta por USB o Bluetooth para navegar por el launcher.", "Probar LED", "Autorizar"],
  "fr-FR": ["Manette", "Manette connectée", "Aucune manette connectée", "Connectez-la en USB ou Bluetooth pour naviguer.", "Tester la LED", "Autoriser"],
  "de-DE": ["Controller", "Controller verbunden", "Kein Controller verbunden", "Über USB oder Bluetooth verbinden, um den Launcher zu steuern.", "LED testen", "Autorisieren"],
  "it-IT": ["Controller", "Controller collegato", "Nessun controller collegato", "Collega tramite USB o Bluetooth per navigare.", "Prova LED", "Autorizza"],
} as const;

const SETTINGS_SHELL_COPY = {
  "pt-BR": { preferences: "Preferências do Launcher", general: "Geral", personalization: "Personalização", account: "Conta & Segurança", connections: "Contas & Privacidade", controller: "Controle & Hardware", voice: "Voz & Vídeo", notifications: "Notificações & Overlay", quit: "Sair do Aplicativo", encrypted: "Sessão Encriptada", encryptedHint: "Conexão protegida com token Supabase JWT de alta segurança.", spotifyDock: "Player disponível na aba Spotify", privacy: "Privacidade do Perfil", privacyHint: "Escolha o que outros jogadores podem ver ao encontrar seu perfil.", public: "Perfil Público", publicHint: "Todos podem abrir seus detalhes, jogos e atividade.", private: "Perfil Privado", privateHint: "Somente você e amigos aceitos veem os detalhes.", saving: "Salvando privacidade...", saved: "Privacidade atualizada.", controllerHint: "Status da navegação e iluminação do controle conectado." },
  "en-US": { preferences: "Launcher preferences", general: "General", personalization: "Personalization", account: "Account & Security", connections: "Accounts & Privacy", controller: "Controller & Hardware", voice: "Voice & Video", notifications: "Notifications & Overlay", quit: "Quit Application", encrypted: "Encrypted session", encryptedHint: "Connection protected with a secure Supabase JWT.", spotifyDock: "Player available in the Spotify tab", privacy: "Profile Privacy", privacyHint: "Choose what other players can see when they find your profile.", public: "Public Profile", publicHint: "Anyone can open your details, games, and activity.", private: "Private Profile", privateHint: "Only you and accepted friends can see the details.", saving: "Saving privacy...", saved: "Privacy updated.", controllerHint: "Navigation and lighting status for the connected controller." },
  "es-ES": { preferences: "Preferencias del launcher", general: "General", personalization: "Personalización", account: "Cuenta y seguridad", connections: "Cuentas y privacidad", controller: "Mando y hardware", voice: "Voz y vídeo", notifications: "Notificaciones y overlay", quit: "Salir de la aplicación", encrypted: "Sesión cifrada", encryptedHint: "Conexión protegida con un JWT seguro de Supabase.", spotifyDock: "Player disponible en la pestaña Spotify", privacy: "Privacidad del perfil", privacyHint: "Elige qué pueden ver otros jugadores al encontrar tu perfil.", public: "Perfil público", publicHint: "Todos pueden abrir tus detalles, juegos y actividad.", private: "Perfil privado", privateHint: "Solo tú y tus amigos aceptados pueden ver los detalles.", saving: "Guardando privacidad...", saved: "Privacidad actualizada.", controllerHint: "Estado de navegación e iluminación del mando conectado." },
  "fr-FR": { preferences: "Préférences du launcher", general: "Général", personalization: "Personnalisation", account: "Compte et sécurité", connections: "Comptes et confidentialité", controller: "Manette et matériel", voice: "Voix & vidéo", notifications: "Notifications et overlay", quit: "Quitter l'application", encrypted: "Session chiffrée", encryptedHint: "Connexion protégée par un JWT Supabase sécurisé.", spotifyDock: "Lecteur disponible dans l'onglet Spotify", privacy: "Confidentialité du profil", privacyHint: "Choisissez ce que les autres joueurs voient en trouvant votre profil.", public: "Profil public", publicHint: "Tout le monde peut ouvrir vos détails, jeux et activité.", private: "Profil privé", privateHint: "Seuls vous et vos amis acceptés voyez les détails.", saving: "Enregistrement...", saved: "Confidentialité mise à jour.", controllerHint: "État de navigation et d'éclairage de la manette connectée." },
  "de-DE": { preferences: "Launcher-Einstellungen", general: "Allgemein", personalization: "Personnalierung", account: "Konto und Sicherheit", connections: "Konten und Datenschutz", controller: "Controller und Hardware", voice: "Sprache & Video", notifications: "Benachrichtigungen und Overlay", quit: "Anwendung beenden", encrypted: "Verschlüsselte Sitzung", encryptedHint: "Verbindung durch ein sicheres Supabase-JWT geschützt.", spotifyDock: "Player im Spotify-Tab verfügbar", privacy: "Profil-Datenschutz", privacyHint: "Lege fest, was andere Spieler in deinem Profil sehen.", public: "Öffentliches Profil", publicHint: "Alle können Details, Spiele und Aktivitäten öffnen.", private: "Privates Profil", privateHint: "Nur du und bestätigte Freunde sehen die Details.", saving: "Datenschutz wird gespeichert...", saved: "Datenschutz aktualisiert.", controllerHint: "Navigations- und Beleuchtungsstatus des verbundenen Controllers." },
  "it-IT": { preferences: "Preferenze del launcher", general: "Generale", personalization: "Personalizzazione", account: "Account e sicurezza", connections: "Account e privacy", controller: "Controller e hardware", voice: "Voce & Video", notifications: "Notifiche e overlay", quit: "Esci dall'applicazione", encrypted: "Sessione crittografata", encryptedHint: "Connessione protetta da un JWT Supabase sicuro.", spotifyDock: "Player disponibile nella scheda Spotify", privacy: "Privacy del profilo", privacyHint: "Scegli cosa possono vedere gli altri giocatori nel tuo profilo.", public: "Profilo pubblico", publicHint: "Tutti possono aprire dettagli, giochi e attività.", private: "Profilo privato", privateHint: "Solo tu e gli amici accettati vedete i dettagli.", saving: "Salvataggio privacy...", saved: "Privacy aggiornata.", controllerHint: "Stato di navigazione e illuminazione del controller collegato." },
} as const;

const SETTINGS_DETAIL_COPY = {
  "pt-BR": { moreThemes: "Mais temas", comingSoon: "Novos pacotes em breve", audioTitle: "Efeitos Sonoros & Áudio", audioHint: "Ajuste o volume dos sons de navegação, música e alertas do launcher.", performanceTitle: "Modo de Desempenho", performanceHint: "Reduza animações e desative o desfoque em computadores mais antigos.", playerProfile: "Perfil do Jogador", playerProfileHint: "Informações da sua conta sincronizada com a nuvem.", playerFallback: "Jogador Phelierium", noEmail: "Sem e-mail vinculado", activeAccount: "Conta Ativa", security: "Segurança da Conta", securityHint: "Gerencie sua senha de acesso e opções de recuperação.", resetPassword: "Redefinir Senha", resetPasswordHint: "Envia um e-mail de segurança para alterar sua senha atual.", emailSent: "E-mail enviado!", sending: "Enviando...", sendEmail: "Enviar E-mail", overlayLab: "Overlay Lab", overlayLabHint: "Prévia de como os overlays ficarão quando você estiver jogando.", testWelcome: "Testar Divirta-se", testWelcomeHint: "Mostra o card social ao iniciar um jogo.", testAchievement: "Testar Conquista", testAchievementHint: "Mostra o toast completo com conquista." },
  "en-US": { moreThemes: "More themes", comingSoon: "New packs coming soon", audioTitle: "Sound Effects & Audio", audioHint: "Adjust navigation, music, and launcher alert volumes.", performanceTitle: "Performance Mode", performanceHint: "Reduce animations and blur on older computers.", playerProfile: "Player Profile", playerProfileHint: "Information from your cloud-synced account.", playerFallback: "Phelierium Player", noEmail: "No email linked", activeAccount: "Active Account", security: "Account Security", securityHint: "Manage your password and recovery options.", resetPassword: "Reset Password", resetPasswordHint: "Sends a security email to change your current password.", emailSent: "Email sent!", sending: "Sending...", sendEmail: "Send Email", overlayLab: "Overlay Lab", overlayLabHint: "Preview how overlays will look while you play.", testWelcome: "Test Welcome", testWelcomeHint: "Shows the social card when a game starts.", testAchievement: "Test Achievement", testAchievementHint: "Shows the complete achievement toast." },
  "es-ES": { moreThemes: "Más temas", comingSoon: "Nuevos paquetes próximamente", audioTitle: "Efectos de sonido y audio", audioHint: "Ajusta el volumen de navegación, música y alertas.", performanceTitle: "Modo de rendimiento", performanceHint: "Reduce animaciones y desenfoque en equipos antiguos.", playerProfile: "Perfil del jugador", playerProfileHint: "Información de tu cuenta sincronizada en la nube.", playerFallback: "Jugador Phelierium", noEmail: "Sin correo vinculado", activeAccount: "Cuenta activa", security: "Seguridad de la cuenta", securityHint: "Gestiona tu contraseña y opciones de recuperación.", resetPassword: "Restablecer contraseña", resetPasswordHint: "Envía un correo de seguridad para cambiar tu contraseña.", emailSent: "¡Correo enviado!", sending: "Enviando...", sendEmail: "Enviar correo", overlayLab: "Laboratorio de overlay", overlayLabHint: "Vista previa de los overlays mientras juegas.", testWelcome: "Probar bienvenida", testWelcomeHint: "Muestra la tarjeta social al iniciar un juego.", testAchievement: "Probar logro", testAchievementHint: "Muestra la notificación completa del logro." },
  "fr-FR": { moreThemes: "Plus de thèmes", comingSoon: "Nouveaux packs bientôt disponibles", audioTitle: "Effets sonores et audio", audioHint: "Réglez le volume de navigation, musique et alertes.", performanceTitle: "Mode performance", performanceHint: "Réduisez les animations et le flou sur les anciens PC.", playerProfile: "Profil du joueur", playerProfileHint: "Informations de votre compte synchronisé dans le cloud.", playerFallback: "Joueur Phelierium", noEmail: "Aucun e-mail associé", activeAccount: "Compte actif", security: "Sécurité du compte", securityHint: "Gérez votre mot de passe et les options de récupération.", resetPassword: "Réinitialiser le mot de passe", resetPasswordHint: "Envoie un e-mail de sécurité pour modifier votre mot de passe.", emailSent: "E-mail envoyé !", sending: "Envoi...", sendEmail: "Envoyer l'e-mail", overlayLab: "Laboratoire overlay", overlayLabHint: "Prévisualisez les overlays pendant vos parties.", testWelcome: "Tester la bienvenue", testWelcomeHint: "Affiche la carte sociale au lancement d'un jeu.", testAchievement: "Tester le succès", testAchievementHint: "Affiche la notification complète du succès." },
  "de-DE": { moreThemes: "Weitere Themes", comingSoon: "Neue Pakete folgen bald", audioTitle: "Soundeffekte und Audio", audioHint: "Passe Navigation, Musik und Hinweislautstärke an.", performanceTitle: "Leistungsmodus", performanceHint: "Reduziert Animationen und Unschärfe auf älteren PCs.", playerProfile: "Spielerprofil", playerProfileHint: "Informationen deines cloud-synchronisierten Kontos.", playerFallback: "Phelierium-Spieler", noEmail: "Keine E-Mail verknüpft", activeAccount: "Aktives Konto", security: "Kontosicherheit", securityHint: "Verwalte Passwort und Wiederherstellungsoptionen.", resetPassword: "Passwort zurücksetzen", resetPasswordHint: "Sendet eine Sicherheits-E-Mail zum Ändern des Passworts.", emailSent: "E-Mail gesendet!", sending: "Wird gesendet...", sendEmail: "E-Mail senden", overlayLab: "Overlay-Labor", overlayLabHint: "Vorschau der Overlays während des Spielens.", testWelcome: "Willkommen testen", testWelcomeHint: "Zeigt die Social-Karte beim Spielstart.", testAchievement: "Erfolg testen", testAchievementHint: "Zeigt die vollständige Erfolgsbenachrichtigung." },
  "it-IT": { moreThemes: "Altri temi", comingSoon: "Nuovi pacchetti in arrivo", audioTitle: "Effetti sonori e audio", audioHint: "Regola il volume di navigazione, musica e avvisi.", performanceTitle: "Modalità prestazioni", performanceHint: "Riduce animazioni e sfocatura sui computer più datati.", playerProfile: "Profilo giocatore", playerProfileHint: "Informazioni dell'account sincronizzato nel cloud.", playerFallback: "Giocatore Phelierium", noEmail: "Nessuna e-mail collegata", activeAccount: "Account attivo", security: "Sicurezza account", securityHint: "Gestisci password e opzioni di recupero.", resetPassword: "Reimposta password", resetPasswordHint: "Invia un'e-mail di sicurezza per modificare la password.", emailSent: "E-mail inviata!", sending: "Invio...", sendEmail: "Invia e-mail", overlayLab: "Laboratorio overlay", overlayLabHint: "Anteprima degli overlay durante il gioco.", testWelcome: "Prova benvenuto", testWelcomeHint: "Mostra la scheda social all'avvio di un gioco.", testAchievement: "Prova obiettivo", testAchievementHint: "Mostra la notifica completa dell'obiettivo." },
} as const;

const RetroAchievementsSettingsCard: React.FC<{
  username?: string;
  connected?: boolean;
  busy?: boolean;
  error?: string;
  onConnect?: (username: string) => Promise<void>;
  onDisconnect?: () => Promise<void>;
}> = () => {
  return (
    <article
      aria-label="RetroAchievements"
      className="rounded-2xl border border-white/10 bg-white/5 p-4 flex items-center justify-between"
    >
      <div>
        <h4 className="text-sm font-semibold text-white">RetroAchievements</h4>
        <p className="text-xs text-white/50">Integre conquistas retrô à sua conta.</p>
      </div>
      <span className="text-xs font-mono text-purple-400">Em Breve</span>
    </article>
  );
};

const ACHIEVEMENT_NOTIFICATION_COPY = {
  "pt-BR": {
    title: "Notificações de conquistas",
    description: "Escolha como e onde os desbloqueios aparecem durante o jogo.",
    enabled: "Notificar ao desbloquear",
    enabledHint: "Desliga completamente o aviso visual e o som de conquistas.",
    custom: "Notificação customizada",
    customHint: "Desligada, usa a notificação nativa do Windows — inclusive em tela cheia exclusiva.",
    position: "Posição da notificação customizada",
    positions: ["Superior esquerda", "Superior direita", "Inferior esquerda", "Inferior direita"],
  },
  "en-US": {
    title: "Achievement notifications",
    description: "Choose how and where unlocks appear while you play.",
    enabled: "Notify when unlocked",
    enabledHint: "Turns off both the achievement visual alert and its sound.",
    custom: "Custom notification",
    customHint: "When off, uses the native Windows notification, including exclusive fullscreen.",
    position: "Custom notification position",
    positions: ["Top left", "Top right", "Bottom left", "Bottom right"],
  },
  "es-ES": {
    title: "Notificaciones de logros",
    description: "Elige cómo y dónde aparecen los desbloqueos durante el juego.",
    enabled: "Notificar al desbloquear",
    enabledHint: "Desactiva por completo el aviso visual y el sonido.",
    custom: "Notificación personalizada",
    customHint: "Desactivada, usa la notificación nativa de Windows, incluso en pantalla completa exclusiva.",
    position: "Posición de la notificación",
    positions: ["Arriba izquierda", "Arriba derecha", "Abajo izquierda", "Abajo derecha"],
  },
  "fr-FR": {
    title: "Notifications de succès",
    description: "Choisissez comment et où les succès apparaissent pendant le jeu.",
    enabled: "Notifier au déverrouillage",
    enabledHint: "Désactive entièrement l’alerte visuelle et le son.",
    custom: "Notification personnalisée",
    customHint: "Désactivée, utilise la notification native de Windows, même en plein écran exclusif.",
    position: "Position de la notification",
    positions: ["Haut gauche", "Haut droite", "Bas gauche", "Bas droite"],
  },
  "de-DE": {
    title: "Erfolgsbenachrichtigungen",
    description: "Lege fest, wie und wo Freischaltungen im Spiel erscheinen.",
    enabled: "Bei Freischaltung benachrichtigen",
    enabledHint: "Schaltet den visuellen Hinweis und den Ton vollständig aus.",
    custom: "Benutzerdefinierte Benachrichtigung",
    customHint: "Ausgeschaltet wird die native Windows-Benachrichtigung verwendet, auch im exklusiven Vollbild.",
    position: "Position der Benachrichtigung",
    positions: ["Oben links", "Oben rechts", "Unten links", "Unten rechts"],
  },
  "it-IT": {
    title: "Notifiche degli obiettivi",
    description: "Scegli come e dove mostrare gli sblocchi durante il gioco.",
    enabled: "Notifica allo sblocco",
    enabledHint: "Disattiva completamente l’avviso visivo e il suono.",
    custom: "Notifica personalizzata",
    customHint: "Se disattivata usa la notifica nativa di Windows, anche a schermo intero esclusivo.",
    position: "Posizione della notifica",
    positions: ["In alto a sinistra", "In alto a destra", "In basso a sinistra", "In basso a destra"],
  },
} as const;

const ACHIEVEMENT_POSITIONS = [
  "top-left",
  "top-right",
  "bottom-left",
  "bottom-right",
] as const;

export const SettingsChoice: React.FC<{
  active: boolean;
  label: string;
  hint: string;
  swatch?: string;
  onClick: () => void;
  onHover?: () => void;
}> = React.memo(({ active, label, hint, swatch, onClick, onHover }) => (
  <button
    type="button"
    aria-pressed={active}
    onClick={onClick}
    onMouseEnter={onHover}
    className="relative flex flex-col justify-between cursor-pointer overflow-hidden rounded-2xl border px-4 py-3 text-left transition-all duration-200 hover:scale-[1.015] hover:border-white/30 hover:bg-white/8 hover:shadow-[0_0_20px_rgba(255,255,255,0.06)] active:scale-[0.985]"
    style={{
      background: active ? "var(--launcher-accent-soft)" : "rgba(255,255,255,0.035)",
      borderColor: active
        ? "rgb(var(--launcher-accent) / 0.45)"
        : "rgba(255,255,255,0.07)",
    }}
  >
    <div className="flex items-center gap-2 min-w-0 mb-1">
      {swatch && (
        <span
          className="h-3 w-3 shrink-0 rounded-full border border-white/20 shadow-sm"
          style={{ background: swatch }}
        />
      )}
      <span className="text-xs font-bold text-white whitespace-nowrap truncate min-w-0">
        {label}
      </span>
    </div>
    {hint && (
      <span className="text-[10px] font-medium uppercase tracking-wider text-white/40 whitespace-nowrap truncate block min-w-0">
        {hint}
      </span>
    )}
    {active && (
      <span
        className="pointer-events-none absolute inset-0 rounded-2xl"
        style={{
          boxShadow:
            "inset 0 0 0 1px rgb(var(--launcher-accent) / 0.28), 0 0 28px rgb(var(--launcher-accent) / 0.16)",
        }}
      />
    )}
  </button>
));
SettingsChoice.displayName = "SettingsChoice";

export const VolumeSettingsCard: React.FC<{
  title: string;
  description: string;
  value: number;
  max: number;
  actionLabel?: string;
  onAction?: () => void;
  onHover?: () => void;
  onChange: (volume: number) => void;
  t: TranslationFn;
  gamepadId: string;
  gamepadNavUp?: string;
  gamepadNavDown?: string;
}> = React.memo(({ title, description, value, max, actionLabel, onAction, onHover, onChange, t, gamepadId, gamepadNavUp, gamepadNavDown }) => (
  <section className="flex min-h-47.5 flex-col justify-between rounded-2xl border border-white/10 bg-black/40 p-4 backdrop-blur-3xl shadow-[0_20px_70px_rgba(0,0,0,0.45)]">
    <div>
      <div className="mb-3 flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/10 text-white/75 shadow-sm">
          <Volume2 className="h-4 w-4 text-white/70" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-bold text-white leading-tight">{title}</h2>
          {description && <p className="mt-1 text-[11px] font-medium leading-snug text-white/40 line-clamp-2">{description}</p>}
        </div>
      </div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <span className="tabular-nums text-3xl font-light text-white">{value}</span>
          <span className="ml-1 text-xs font-bold text-white/35">%</span>
        </div>
        {actionLabel && onAction && (
          <button
            type="button"
            data-gamepad-id={`${gamepadId}-action`}
            data-gamepad-nav-up={gamepadNavUp?.replace("-slider", "-action")}
            data-gamepad-nav-down={gamepadNavDown?.replace("-slider", "-action")}
            onClick={onAction}
            onMouseEnter={onHover}
            className="h-8 cursor-pointer rounded-xl bg-white px-3 text-[10px] font-black uppercase tracking-wider text-black transition-all duration-200 hover:scale-105 hover:bg-white/90 hover:shadow-[0_0_15px_rgba(255,255,255,0.4)] active:scale-95"
          >
            {actionLabel}
          </button>
        )}
      </div>
    </div>
    <div>
      <input
        type="range"
        data-gamepad-id={`${gamepadId}-slider`}
        data-gamepad-nav-up={gamepadNavUp}
        data-gamepad-nav-down={gamepadNavDown}
        min={0}
        max={max}
        step={1}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        onMouseEnter={onHover}
        className="w-full cursor-pointer accent-white transition-all hover:brightness-125"
      />
      <div className="mt-2 flex justify-between text-[9px] font-black uppercase tracking-wider text-white/30">
        <span>{t("mute")}</span>
        <span>{t("max")}</span>
      </div>
    </div>
  </section>
));
VolumeSettingsCard.displayName = "VolumeSettingsCard";

export interface SettingsPageV2Props {
  language: LauncherLanguage;
  effectsVolume: number;
  achievementVolume: number;
  notificationVolume: number;
  musicVolume: number;
  soundTheme: SoundTheme;
  visualTheme: VisualTheme;
  languageOptions: LanguageOption[];
  appThemeOptions: AppThemeOption[];
  SteamIcon: BrandIcon;
  DiscordIcon: BrandIcon;
  EpicIcon: BrandIcon;
  onLanguageChange: (language: LauncherLanguage) => void;
  onEffectsVolumeChange: (volume: number) => void;
  onAchievementVolumeChange: (volume: number) => void;
  onNotificationVolumeChange: (volume: number) => void;
  onMusicVolumeChange: (volume: number) => void;
  onSoundThemeChange: (theme: SoundTheme) => void;
  onVisualThemeChange: (theme: VisualTheme) => void;
  onPreviewSound: () => void;
  onTestNotificationSound: () => void;
  t: TranslationFn;
  steamConnected: boolean;
  discordConnected: boolean;
  discordUsername?: string;
  discordAvatar?: string;
  steamConnecting: boolean;
  discordConnecting: boolean;
  retroAchievementsConnected: boolean;
  retroAchievementsUsername?: string;
  retroAchievementsConnecting: boolean;
  retroAchievementsError?: string;
  onConnectSteam: () => void;
  onConnectDiscord: () => void;
  onConnectRetroAchievements: (username: string) => Promise<void>;
  onDisconnectSteam: () => void;
  onDisconnectDiscord: () => void;
  onDisconnectRetroAchievements: () => Promise<void>;
  onTestOverlayWelcome: () => void;
  onTestOverlayAchievement: () => void;
  initialTab: SettingsTab;
  onTabChange: (tab: SettingsTab) => void;
}

export const SettingsPageV2: React.FC<SettingsPageV2Props> = React.memo(({
  language,
  effectsVolume,
  achievementVolume,
  notificationVolume,
  musicVolume,
  soundTheme,
  visualTheme,
  languageOptions,
  appThemeOptions,
  SteamIcon,
  DiscordIcon,
  onLanguageChange,
  onEffectsVolumeChange,
  onAchievementVolumeChange,
  onNotificationVolumeChange,
  onMusicVolumeChange,
  onSoundThemeChange,
  onVisualThemeChange,
  onPreviewSound,
  onTestNotificationSound,
  t,
  steamConnected,
  discordConnected,
  discordUsername,
  discordAvatar,
  steamConnecting,
  discordConnecting,
  retroAchievementsConnected,
  retroAchievementsUsername,
  retroAchievementsConnecting,
  retroAchievementsError,
  onConnectSteam,
  onConnectDiscord,
  onConnectRetroAchievements,
  onDisconnectSteam,
  onDisconnectDiscord,
  onDisconnectRetroAchievements,
  onTestOverlayWelcome,
  onTestOverlayAchievement,
  initialTab,
  onTabChange,
}) => {
  const { playSound } = useSoundEffects(
    effectsVolume / 100,
    soundTheme,
    notificationVolume / 100,
  );
  const { isGamepadConnected, gamepadFamily, connectedGamepadId } = useGamepad();
  const {
    openAtLogin,
    setOpenAtLogin,
    lowPerformanceMode,
    setLowPerformanceMode,
    closeOnLaunch,
    setCloseOnLaunch,
    minimizeToTrayOnClose,
    setMinimizeToTrayOnClose,
    restoreLastScreen,
    setRestoreLastScreen,
    confirmBeforeExit,
    setConfirmBeforeExit,
    achievementNotificationsEnabled,
    setAchievementNotificationsEnabled,
    customAchievementNotifications,
    setCustomAchievementNotifications,
    achievementNotificationPosition,
    setAchievementNotificationPosition,
  } = usePreferences();

  const { user, userProfile } = useAuth();
  const [activeTab, setActiveTab] = React.useState<SettingsTab>(initialTab);
  const [passwordResetSent, setPasswordResetSent] = React.useState(false);
  const [isResettingPassword, setIsResettingPassword] = React.useState(false);
  const [profileVisibility, setProfileVisibility] = React.useState<ProfileVisibility>(
    userProfile?.profileVisibility ?? "public",
  );
  const [privacyStatus, setPrivacyStatus] = React.useState<"idle" | "saving" | "saved" | "error">("idle");
  const [privacyError, setPrivacyError] = React.useState("");

  const voiceCallContext = useVoiceCallContext();
  const [isRecordingPttKey, setIsRecordingPttKey] = React.useState(false);
  const [isTestingMic, setIsTestingMic] = React.useState(false);
  const [testMicVolume, setTestMicVolume] = React.useState(0);
  const [isVideoPreviewOn, setIsVideoPreviewOn] = React.useState(false);
  const videoPreviewRef = React.useRef<HTMLVideoElement | null>(null);
  const videoPreviewStreamRef = React.useRef<MediaStream | null>(null);

  // Live mic test with complete AudioContext and MediaStream lifecycle cleanup
  React.useEffect(() => {
    if (!isTestingMic || activeTab !== "voice") {
      setTestMicVolume(0);
      return;
    }

    let isCancelled = false;
    let ctx: AudioContext | null = null;
    let source: MediaStreamAudioSourceNode | null = null;
    let analyser: AnalyserNode | null = null;
    let stream: MediaStream | null = null;
    let animId: number | null = null;

    const startTest = async () => {
      try {
        const targetId = voiceCallContext?.selectedAudioInput;
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            deviceId: targetId && targetId !== "default" ? { exact: targetId } : undefined,
            echoCancellation: voiceCallContext?.echoCancellation ?? true,
            noiseSuppression: voiceCallContext?.noiseSuppression ?? true,
            autoGainControl: voiceCallContext?.autoGainControl ?? true,
            channelCount: { ideal: 1 },
            sampleRate: { ideal: 48000 },
            sampleSize: { ideal: 16 },
          },
          video: false,
        });

        if (isCancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioCtx) return;

        ctx = new AudioCtx();
        source = ctx.createMediaStreamSource(stream);
        analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.25;
        source.connect(analyser);

        const data = new Float32Array(analyser.fftSize);

        const tick = () => {
          if (isCancelled || !analyser) return;
          analyser.getFloatTimeDomainData(data);
          let sumSquares = 0;
          for (let i = 0; i < data.length; i += 1) {
            sumSquares += data[i] * data[i];
          }
          const rms = Math.sqrt(sumSquares / data.length);
          const gainMultiplier = (voiceCallContext?.micGain ?? 100) / 100;
          const level = Math.min(100, Math.round(rms * 700 * gainMultiplier));
          setTestMicVolume(level);
          animId = requestAnimationFrame(tick);
        };

        animId = requestAnimationFrame(tick);
      } catch (err) {
        console.warn("[SettingsPage] Mic test failed:", err);
        setIsTestingMic(false);
      }
    };

    void startTest();

    return () => {
      isCancelled = true;
      if (animId) cancelAnimationFrame(animId);
      if (source) {
        try { source.disconnect(); } catch { }
      }
      if (analyser) {
        try { analyser.disconnect(); } catch { }
      }
      if (ctx && ctx.state !== "closed") {
        void ctx.close().catch(() => { });
      }
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }
      setTestMicVolume(0);
    };
  }, [activeTab, isTestingMic, voiceCallContext?.autoGainControl, voiceCallContext?.echoCancellation, voiceCallContext?.noiseSuppression, voiceCallContext?.selectedAudioInput]);

  // Video preview with lifecycle cleanup
  React.useEffect(() => {
    if (!isVideoPreviewOn || activeTab !== "voice") {
      if (videoPreviewStreamRef.current) {
        videoPreviewStreamRef.current.getTracks().forEach((t) => t.stop());
        videoPreviewStreamRef.current = null;
      }
      if (videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = null;
      }
      return;
    }

    let isCancelled = false;
    const startVideo = async () => {
      try {
        const targetId = voiceCallContext?.selectedVideoInput;
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            deviceId: targetId && targetId !== "default" ? { exact: targetId } : undefined,
            width: { ideal: 640 },
            height: { ideal: 480 },
            frameRate: { ideal: 30 },
          },
          audio: false,
        });

        if (isCancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        videoPreviewStreamRef.current = stream;
        if (videoPreviewRef.current) {
          videoPreviewRef.current.srcObject = stream;
        }
      } catch {
        setIsVideoPreviewOn(false);
      }
    };

    void startVideo();

    return () => {
      isCancelled = true;
      if (videoPreviewStreamRef.current) {
        videoPreviewStreamRef.current.getTracks().forEach((t) => t.stop());
        videoPreviewStreamRef.current = null;
      }
      if (videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = null;
      }
    };
  }, [activeTab, isVideoPreviewOn, voiceCallContext?.selectedVideoInput]);

  React.useEffect(() => {
    setProfileVisibility(userProfile?.profileVisibility ?? "public");
  }, [userProfile?.profileVisibility]);

  const handleProfileVisibilityChange = async (nextVisibility: ProfileVisibility) => {
    if (!user || nextVisibility === profileVisibility || privacyStatus === "saving") return;
    const previousVisibility = profileVisibility;
    setProfileVisibility(nextVisibility);
    setPrivacyStatus("saving");
    setPrivacyError("");
    try {
      const savedVisibility = await saveProfileVisibility(nextVisibility);
      setProfileVisibility(savedVisibility);
      setPrivacyStatus("saved");
    } catch (error) {
      setProfileVisibility(previousVisibility);
      setPrivacyStatus("error");
      setPrivacyError(error instanceof Error ? error.message : "Não foi possível alterar a privacidade.");
    }
  };

  const handlePasswordReset = async () => {
    if (!user?.email || isResettingPassword) return;
    setIsResettingPassword(true);
    try {
      await supabase.auth.resetPasswordForEmail(user.email, {
        redirectTo: window.location.origin,
      });
      setPasswordResetSent(true);
    } catch {
      // Ignore fallback
    } finally {
      setIsResettingPassword(false);
    }
  };

  const controllerCopy = CONTROLLER_COPY[language] || CONTROLLER_COPY["pt-BR"];
  const shellCopy = SETTINGS_SHELL_COPY[language] || SETTINGS_SHELL_COPY["pt-BR"];
  const detailCopy = SETTINGS_DETAIL_COPY[language] || SETTINGS_DETAIL_COPY["pt-BR"];
  const achievementNotificationCopy =
    ACHIEVEMENT_NOTIFICATION_COPY[language] || ACHIEVEMENT_NOTIFICATION_COPY["pt-BR"];
  const led = useControllerLedStatus();

  const selectTab = React.useCallback((tab: SettingsTab) => {
    setActiveTab(tab);
    onTabChange(tab);
    playSound("hover");
  }, [onTabChange, playSound]);

  const behaviorOptions = [
    {
      label: t("openAtLogin"),
      hint: t("openAtLoginHint"),
      checked: openAtLogin,
      onChange: setOpenAtLogin,
    },
    {
      label: t("closeOnLaunch"),
      hint: t("closeOnLaunchHint"),
      checked: closeOnLaunch,
      onChange: setCloseOnLaunch,
    },
    {
      label: t("minimizeToTray"),
      hint: t("minimizeToTrayHint"),
      checked: minimizeToTrayOnClose,
      onChange: setMinimizeToTrayOnClose,
    },
    {
      label: t("restoreLastScreen"),
      hint: t("restoreLastScreenHint"),
      checked: restoreLastScreen,
      onChange: setRestoreLastScreen,
    },
    {
      label: t("confirmBeforeExit"),
      hint: t("confirmBeforeExitHint"),
      checked: confirmBeforeExit,
      onChange: setConfirmBeforeExit,
    },
  ];

  const activeAppTheme =
    visualTheme === "ps5" || soundTheme === "ps5"
      ? "ps5"
      : visualTheme === "phelierium" || visualTheme === "checkpoint" || soundTheme === "default"
        ? "default"
        : soundTheme === "cyberpunk" || visualTheme === "cyberpunk"
          ? "cyberpunk"
          : soundTheme === "ps4" || visualTheme === "ps4"
            ? "ps4"
            : soundTheme === "psp" || visualTheme === "psp"
              ? "psp"
              : soundTheme === "gamecube" || visualTheme === "gamecube"
                ? "gamecube"
                : soundTheme === "xbox360" || visualTheme === "xbox360"
                  ? "xbox360"
                  : "playstation";

  return (
    <SystemPageShell eyebrow={t("system")} title={t("settings")}>
      <div className="flex flex-col lg:flex-row gap-6 items-start">
        {/* Left Sub-Navigation Menu */}
        <aside className="w-full lg:w-64 shrink-0 rounded-[28px] border border-white/10 bg-black/40 p-4 backdrop-blur-3xl shadow-[0_20px_70px_rgba(0,0,0,0.45)]">
          <div className="flex items-center gap-3 px-3 py-2.5 mb-3 border-b border-white/8">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-white">
              <Settings className="h-4.5 w-4.5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">{t("settings")}</h3>
              <p className="text-[10px] font-medium text-white/40">{shellCopy.preferences}</p>
            </div>
          </div>

          <nav className="space-y-1">
            <button
              type="button"
              onClick={() => selectTab("general")}
              className={`flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-xs font-bold transition-all cursor-pointer ${activeTab === "general"
                ? "bg-white text-black shadow-lg"
                : "text-white/60 hover:bg-white/6 hover:text-white"
                }`}
            >
              <SlidersHorizontal className="h-4 w-4 shrink-0" /> {shellCopy.general}
            </button>

            <button
              type="button"
              onClick={() => selectTab("personalization")}
              className={`flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-xs font-bold transition-all cursor-pointer ${activeTab === "personalization"
                ? "bg-white text-black shadow-lg"
                : "text-white/60 hover:bg-white/6 hover:text-white"
                }`}
            >
              <Palette className="h-4 w-4 shrink-0" /> {shellCopy.personalization}
            </button>

            <button
              type="button"
              onClick={() => selectTab("account")}
              className={`flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-xs font-bold transition-all cursor-pointer ${activeTab === "account"
                ? "bg-white text-black shadow-lg"
                : "text-white/60 hover:bg-white/6 hover:text-white"
                }`}
            >
              <ShieldCheck className="h-4 w-4 shrink-0" /> {shellCopy.account}
            </button>

            <button
              type="button"
              onClick={() => selectTab("connections")}
              className={`flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-xs font-bold transition-all cursor-pointer ${activeTab === "connections"
                ? "bg-white text-black shadow-lg"
                : "text-white/60 hover:bg-white/6 hover:text-white"
                }`}
            >
              <Globe className="h-4 w-4 shrink-0" /> {shellCopy.connections}
            </button>

            <button
              type="button"
              onClick={() => selectTab("controller")}
              className={`flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-xs font-bold transition-all cursor-pointer ${activeTab === "controller"
                ? "bg-white text-black shadow-lg"
                : "text-white/60 hover:bg-white/6 hover:text-white"
                }`}
            >
              <Gamepad2 className="h-4 w-4 shrink-0" /> {shellCopy.controller}
            </button>

            <button
              type="button"
              onClick={() => selectTab("voice")}
              className={`flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-xs font-bold transition-all cursor-pointer ${activeTab === "voice"
                ? "bg-white text-black shadow-lg"
                : "text-white/60 hover:bg-white/6 hover:text-white"
                }`}
            >
              <Mic className="h-4 w-4 shrink-0" /> {shellCopy.voice}
            </button>

            <button
              type="button"
              onClick={() => selectTab("notifications")}
              className={`flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-xs font-bold transition-all cursor-pointer ${activeTab === "notifications"
                ? "bg-white text-black shadow-lg"
                : "text-white/60 hover:bg-white/6 hover:text-white"
                }`}
            >
              <Bell className="h-4 w-4 shrink-0" /> {shellCopy.notifications}
            </button>
          </nav>

          {user && (
            <div className="pt-3 mt-3 border-t border-white/8">
              <button
                type="button"
                onClick={() => {
                  playSound("back");
                  void window.electronAPI?.requestAppQuit?.();
                }}
                className="flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-xs font-bold text-red-400 transition-all hover:bg-red-500/10 hover:text-red-300 cursor-pointer"
              >
                <LogOut className="h-4 w-4 shrink-0" /> {shellCopy.quit}
              </button>
            </div>
          )}
        </aside>

        {/* Right Active Content Panel */}
        <main className="flex-1 w-full min-w-0">
          {/* TAB 1: GERAL */}
          {activeTab === "general" && (
            <div className="space-y-6">
              <section className="rounded-[28px] border border-white/10 bg-black/40 p-6 md:p-7 backdrop-blur-3xl shadow-[0_20px_70px_rgba(0,0,0,0.45)]">
                <SettingsHeader
                  icon={<Languages className="h-5 w-5 text-white/70" />}
                  title={t("language")}
                  description={t("languageHint")}
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                  {languageOptions.map((option) => (
                    <SettingsChoice
                      key={option.id}
                      active={language === option.id}
                      label={option.label}
                      hint={option.hint}
                      onHover={() => playSound("hover")}
                      onClick={() => onLanguageChange(option.id)}
                    />
                  ))}
                </div>
              </section>

              <section className="rounded-[28px] border border-white/10 bg-black/40 p-6 md:p-7 backdrop-blur-3xl shadow-[0_20px_70px_rgba(0,0,0,0.45)]">
                <SettingsHeader
                  icon={<SlidersHorizontal className="h-5 w-5 text-white/70" />}
                  title={t("appBehavior")}
                  description={t("appBehaviorHint")}
                />
                <div className="space-y-3.5">
                  {behaviorOptions.map((option) => (
                    <div
                      key={option.label}
                      className="flex items-center justify-between gap-5 rounded-2xl border border-white/6 bg-white/[0.035] p-4"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-white">{option.label}</p>
                        <p className="mt-1 text-[10px] font-medium leading-relaxed text-white/40">{option.hint}</p>
                      </div>
                      <Switch
                        aria-label={option.label}
                        checked={option.checked}
                        onCheckedChange={option.onChange}
                      />
                    </div>
                  ))}
                </div>
              </section>

              <AppUpdateSection />
            </div>
          )}

          {/* TAB 2: PERSONALIZAÇÃO */}
          {activeTab === "personalization" && (
            <div className="space-y-6">
              <section className="rounded-[28px] border border-white/10 bg-black/40 p-6 md:p-7 backdrop-blur-3xl shadow-[0_20px_70px_rgba(0,0,0,0.45)]">
                <SettingsHeader
                  icon={<Palette className="h-5 w-5 text-white/70" />}
                  title={t("themes")}
                  description={t("themesHint")}
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3.5">
                  {appThemeOptions.map((option) => (
                    <SettingsChoice
                      key={option.id}
                      active={activeAppTheme === option.id}
                      label={option.label}
                      hint={option.hint}
                      swatch={option.swatch}
                      onHover={() => playSound("hover")}
                      onClick={() => {
                        onVisualThemeChange(option.visualTheme);
                        onSoundThemeChange(option.soundTheme);
                      }}
                    />
                  ))}
                  <div className="flex flex-col justify-between rounded-2xl border border-dashed border-white/10 bg-white/2 px-4 py-3 text-left opacity-60">
                    <div className="flex items-center gap-2 min-w-0 mb-1">
                      <Sparkles className="h-3.5 w-3.5 text-amber-300/80 shrink-0" />
                      <span className="text-xs font-bold text-white/80 whitespace-nowrap truncate min-w-0">
                        {detailCopy.moreThemes}
                      </span>
                    </div>
                    <span className="text-[10px] font-medium text-white/40 whitespace-nowrap truncate block min-w-0">
                      {detailCopy.comingSoon}
                    </span>
                  </div>
                </div>
              </section>

              <section className="rounded-[28px] border border-white/10 bg-black/40 p-6 md:p-7 backdrop-blur-3xl shadow-[0_20px_70px_rgba(0,0,0,0.45)]">
                <SettingsHeader
                  icon={<Volume2 className="h-5 w-5 text-white/70" />}
                  title={detailCopy.audioTitle}
                  description={detailCopy.audioHint}
                />
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <VolumeSettingsCard
                    gamepadId="audio-effects"
                    gamepadNavDown="audio-notification-slider"
                    title={t("soundEffects")}
                    description={t("soundEffectsHint")}
                    value={effectsVolume}
                    max={100}
                    actionLabel={t("test")}
                    onAction={onPreviewSound}
                    onHover={() => playSound("hover")}
                    onChange={onEffectsVolumeChange}
                    t={t}
                  />

                  <VolumeSettingsCard
                    gamepadId="audio-achievement"
                    gamepadNavDown="audio-music-slider"
                    title={t("achievementSound")}
                    description={t("achievementSoundHint")}
                    value={achievementVolume}
                    max={100}
                    actionLabel={t("test")}
                    onAction={achievementNotificationsEnabled ? onTestOverlayAchievement : undefined}
                    onHover={() => playSound("hover")}
                    onChange={onAchievementVolumeChange}
                    t={t}
                  />

                  <VolumeSettingsCard
                    gamepadId="audio-notification"
                    gamepadNavUp="audio-effects-slider"
                    title={t("notificationSound")}
                    description={t("notificationSoundHint")}
                    value={notificationVolume}
                    max={100}
                    actionLabel={t("test")}
                    onAction={onTestNotificationSound}
                    onHover={() => playSound("hover")}
                    onChange={onNotificationVolumeChange}
                    t={t}
                  />

                  <VolumeSettingsCard
                    gamepadId="audio-music"
                    gamepadNavUp="audio-achievement-slider"
                    title={t("music")}
                    description={t("musicHint")}
                    value={musicVolume}
                    max={35}
                    onHover={() => playSound("hover")}
                    onChange={onMusicVolumeChange}
                    t={t}
                  />
                </div>
              </section>

              <section className="rounded-[28px] border border-white/10 bg-black/40 p-6 md:p-7 backdrop-blur-3xl shadow-[0_20px_70px_rgba(0,0,0,0.45)]">
                <SettingsHeader
                  icon={<Zap className="h-5 w-5 text-white/70" />}
                  title={detailCopy.performanceTitle}
                  description={detailCopy.performanceHint}
                />
                <div className="flex items-center justify-between gap-5 rounded-2xl border border-white/6 bg-white/[0.035] p-4">
                  <div>
                    <p className="text-xs font-bold text-white whitespace-nowrap">{t("lowPerformanceMode")}</p>
                    <p className="text-[10px] font-medium text-white/40 mt-0.5">{t("lowPerformanceModeHint")}</p>
                  </div>
                  <Switch checked={lowPerformanceMode} onCheckedChange={setLowPerformanceMode} />
                </div>
              </section>
            </div>
          )}

          {/* TAB 3: CONTA & SEGURANÇA */}
          {activeTab === "account" && (
            <div className="space-y-6">
              <section className="rounded-[28px] border border-white/10 bg-black/40 p-6 md:p-7 backdrop-blur-3xl shadow-[0_20px_70px_rgba(0,0,0,0.45)]">
                <SettingsHeader
                  icon={<User className="h-5 w-5 text-white/70" />}
                  title={detailCopy.playerProfile}
                  description={detailCopy.playerProfileHint}
                />
                <div className="flex items-center gap-4 rounded-2xl border border-white/6 bg-white/[0.035] p-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white/10 border border-white/10">
                    {userProfile?.photoURL ? (
                      <img src={userProfile.photoURL} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <User className="h-6 w-6 text-white/70" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-white">
                      {userProfile?.displayName || user?.displayName || detailCopy.playerFallback}
                    </p>
                    <p className="text-xs font-medium text-white/40 mt-0.5">
                      {user?.email || detailCopy.noEmail}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-lg bg-emerald-500/10 border border-emerald-400/20 px-3 py-1 text-[10px] font-bold text-emerald-300 uppercase">
                    {detailCopy.activeAccount}
                  </span>
                </div>
              </section>

              <section className="rounded-[28px] border border-white/10 bg-black/40 p-6 md:p-7 backdrop-blur-3xl shadow-[0_20px_70px_rgba(0,0,0,0.45)]">
                <SettingsHeader
                  icon={<Lock className="h-5 w-5 text-white/70" />}
                  title={detailCopy.security}
                  description={detailCopy.securityHint}
                />
                <div className="space-y-3.5">
                  <div className="flex items-center justify-between gap-4 rounded-2xl border border-white/6 bg-white/[0.035] p-4">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10">
                        <KeyRound className="h-4.5 w-4.5 text-white/70" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-white whitespace-nowrap">{detailCopy.resetPassword}</p>
                        <p className="text-[10px] font-medium text-white/40 mt-0.5">
                          {detailCopy.resetPasswordHint}
                        </p>
                      </div>
                    </div>
                    {passwordResetSent ? (
                      <span className="flex shrink-0 items-center gap-1.5 rounded-lg bg-emerald-500/20 border border-emerald-400/30 px-3 py-1.5 text-[9px] font-bold text-emerald-300 uppercase">
                        <CheckCircle2 className="h-3.5 w-3.5" /> {detailCopy.emailSent}
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={handlePasswordReset}
                        disabled={isResettingPassword || !user?.email}
                        className="shrink-0 cursor-pointer rounded-lg bg-white px-3.5 py-1.5 text-[9px] font-bold uppercase text-black transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
                      >
                        {isResettingPassword ? detailCopy.sending : detailCopy.sendEmail}
                      </button>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-4 rounded-2xl border border-white/6 bg-white/[0.035] p-4">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10">
                        <ShieldCheck className="h-4.5 w-4.5 text-emerald-400" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-white whitespace-nowrap">{shellCopy.encrypted}</p>
                        <p className="text-[10px] font-medium text-white/40 mt-0.5">
                          {shellCopy.encryptedHint}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            </div>
          )}

          {/* TAB 4: CONTAS & PRIVACIDADE */}
          {activeTab === "connections" && (
            <div className="space-y-6">
              <section className="rounded-[28px] border border-white/10 bg-black/40 p-6 md:p-7 backdrop-blur-3xl shadow-[0_20px_70px_rgba(0,0,0,0.45)]">
                <SettingsHeader
                  icon={<Globe className="h-5 w-5 text-white/70" />}
                  title={t("connectedAccounts")}
                  description={t("connectedAccountsHint")}
                />
                <div className="grid grid-cols-1 gap-3.5 md:grid-cols-3">
                  <article aria-label="Steam" className="grid min-h-19 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border border-white/6 bg-white/[0.035] p-4">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10">
                        <SteamIcon className="h-4.5 w-4.5 text-white/70" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-white whitespace-nowrap">Steam</p>
                        <p className="text-[10px] font-medium text-white/40 mt-0.5 whitespace-nowrap">
                          {steamConnected ? t("connected") : t("notConnected")}
                        </p>
                      </div>
                    </div>
                    {steamConnected ? (
                      <div role="group" aria-label={`${t("unlink")} Steam`} className="flex shrink-0 flex-col items-end gap-1">
                        <button
                          type="button"
                          onClick={onDisconnectSteam}
                          onMouseEnter={() => playSound("hover")}
                          className="cursor-pointer rounded-lg px-2.5 py-1 text-[9px] font-bold uppercase text-red-400 transition-all duration-200 hover:scale-105 hover:bg-red-500/10 hover:text-red-300 active:scale-95"
                        >
                          {t("unlink")}
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={onConnectSteam}
                        onMouseEnter={() => playSound("hover")}
                        disabled={steamConnecting}
                        className="shrink-0 cursor-pointer rounded-lg px-3 py-1.5 text-[9px] font-bold uppercase text-white/70 transition-all duration-200 hover:scale-105 hover:bg-white/10 hover:text-white active:scale-95 disabled:opacity-50"
                      >
                        {steamConnecting ? t("connecting") : t("connectSteam")}
                      </button>
                    )}
                  </article>

                  <article aria-label="Discord" className="grid min-h-19 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border border-white/6 bg-white/[0.035] p-4">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white/10">
                        {discordAvatar ? (
                          <img src={discordAvatar} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <DiscordIcon className="h-4.5 w-4.5 text-white/70" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-white whitespace-nowrap">Discord</p>
                        <p className="max-w-27.5 truncate text-[10px] font-medium text-white/40 mt-0.5">
                          {discordConnected ? discordUsername || t("connected") : t("notConnected")}
                        </p>
                      </div>
                    </div>
                    {discordConnected ? (
                      <button
                        type="button"
                        onClick={onDisconnectDiscord}
                        onMouseEnter={() => playSound("hover")}
                        className="shrink-0 cursor-pointer rounded-lg px-2.5 py-1 text-[9px] font-bold uppercase text-red-400 transition-all duration-200 hover:scale-105 hover:bg-red-500/10 hover:text-red-300 active:scale-95"
                      >
                        {t("unlink")}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={onConnectDiscord}
                        onMouseEnter={() => playSound("hover")}
                        disabled={discordConnecting}
                        className="shrink-0 cursor-pointer rounded-lg px-3 py-1.5 text-[9px] font-bold uppercase text-white/70 transition-all duration-200 hover:scale-105 hover:bg-white/10 hover:text-white active:scale-95 disabled:opacity-50"
                      >
                        {discordConnecting ? t("connecting") : t("connectDiscord")}
                      </button>
                    )}
                  </article>
                </div>
                <div className="mt-3.5">
                  <RetroAchievementsSettingsCard
                    username={retroAchievementsUsername}
                    connected={retroAchievementsConnected}
                    busy={retroAchievementsConnecting}
                    error={retroAchievementsError}
                    onConnect={onConnectRetroAchievements}
                    onDisconnect={onDisconnectRetroAchievements}
                  />
                </div>
              </section>
              <section className="rounded-[28px] border border-white/10 bg-black/40 p-6 md:p-7 backdrop-blur-3xl shadow-[0_20px_70px_rgba(0,0,0,0.45)]">
                <SettingsHeader
                  icon={<ShieldCheck className="h-5 w-5 text-white/70" />}
                  title={shellCopy.privacy}
                  description={shellCopy.privacyHint}
                />
                <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
                  <SettingsChoice
                    active={profileVisibility === "public"}
                    label={shellCopy.public}
                    hint={shellCopy.publicHint}
                    onHover={() => playSound("hover")}
                    onClick={() => void handleProfileVisibilityChange("public")}
                  />
                  <SettingsChoice
                    active={profileVisibility === "private"}
                    label={shellCopy.private}
                    hint={shellCopy.privateHint}
                    onHover={() => playSound("hover")}
                    onClick={() => void handleProfileVisibilityChange("private")}
                  />
                </div>
                <div aria-live="polite" className="mt-3 min-h-4 text-[10px] font-medium text-white/40">
                  {privacyStatus === "saving" && shellCopy.saving}
                  {privacyStatus === "saved" && shellCopy.saved}
                  {privacyStatus === "error" && privacyError}
                </div>
              </section>
            </div>
          )}

          {/* TAB 5: CONTROLE & HARDWARE */}
          {activeTab === "controller" && (
            <section className="rounded-[28px] border border-white/10 bg-black/40 p-6 md:p-7 backdrop-blur-3xl shadow-[0_20px_70px_rgba(0,0,0,0.45)]">
              <SettingsHeader
                icon={<Gamepad2 className="h-5 w-5 text-white/70" />}
                title={controllerCopy[0]}
                description={shellCopy.controllerHint}
              />
              <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
                <div className="flex min-w-0 items-center gap-3.5 rounded-2xl border border-white/6 bg-white/[0.035] p-4">
                  <div
                    className={`h-2.5 w-2.5 shrink-0 rounded-full ${isGamepadConnected
                      ? "bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,.7)]"
                      : "bg-white/20"
                      }`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-white whitespace-nowrap">
                      {isGamepadConnected ? controllerCopy[1] : controllerCopy[2]}
                    </p>
                    <p className="mt-0.5 truncate text-[10px] font-medium text-white/40">
                      {connectedGamepadId || controllerCopy[3]}
                    </p>
                  </div>
                  {isGamepadConnected && (
                    <span className="ml-auto shrink-0 rounded-md bg-white/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-white/55">
                      {gamepadFamily}
                    </span>
                  )}
                </div>

                <div className="flex min-w-0 items-center gap-3.5 rounded-2xl border border-white/6 bg-white/[0.035] p-4">
                  <div
                    className={`h-2.5 w-2.5 shrink-0 rounded-full ${led.status === "connected"
                      ? "bg-[rgb(var(--launcher-accent))] shadow-[0_0_12px_rgb(var(--launcher-accent)/.7)]"
                      : led.status === "error"
                        ? "bg-red-400"
                        : "bg-amber-300"
                      }`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-white whitespace-nowrap">LED PlayStation</p>
                    <p className="mt-0.5 truncate text-[10px] font-medium text-white/40">{led.message}</p>
                  </div>
                  {led.status !== "unsupported" && (
                    <button
                      type="button"
                      onClick={led.status === "connected" ? led.testLed : led.requestAccess}
                      onMouseEnter={() => playSound("hover")}
                      disabled={led.status === "connecting"}
                      className="shrink-0 cursor-pointer rounded-lg bg-white px-3 py-1.5 text-[9px] font-bold uppercase tracking-wider text-black transition-all duration-200 hover:scale-105 hover:bg-white/90 hover:shadow-[0_0_15px_rgba(255,255,255,0.4)] active:scale-95 disabled:cursor-not-allowed disabled:hover:scale-100"
                    >
                      {led.status === "connected"
                        ? controllerCopy[4]
                        : led.status === "connecting"
                          ? "..."
                          : controllerCopy[5]}
                    </button>
                  )}
                </div>
              </div>
            </section>
          )}

          {/* TAB: VOZ & VÍDEO */}
          {activeTab === "voice" && (
            <div className="space-y-6">
              {/* Dispositivos de Áudio */}
              <section className="rounded-[28px] border border-white/10 bg-black/40 p-6 md:p-7 backdrop-blur-3xl shadow-[0_20px_70px_rgba(0,0,0,0.45)]">
                {(() => {
                  const defaultInputLabel =
                    voiceCallContext?.audioInputDevices.find((d) => d.deviceId === "default" && d.label)?.label ||
                    voiceCallContext?.audioInputDevices[0]?.label ||
                    "";
                  const defaultOutputLabel =
                    voiceCallContext?.audioOutputDevices.find((d) => d.deviceId === "default" && d.label)?.label ||
                    voiceCallContext?.audioOutputDevices[0]?.label ||
                    "";
                  const defaultVideoLabel =
                    voiceCallContext?.videoInputDevices.find((d) => d.deviceId === "default" && d.label)?.label ||
                    voiceCallContext?.videoInputDevices[0]?.label ||
                    "";

                  return (
                    <>
                      <SettingsHeader
                        icon={<Mic className="h-5 w-5 text-white/70" />}
                        title="Dispositivos de Entrada e Saída"
                        description="Selecione seus dispositivos de microfone, fones e câmera para chamadas e transmissões."
                      />
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        {/* Microfone */}
                        <div className="rounded-2xl border border-white/6 bg-white/[0.035] p-4 space-y-3">
                          <label className="text-xs font-bold text-white flex items-center gap-2">
                            <Mic className="h-4 w-4 text-white/70" />
                            Microfone de Entrada
                          </label>
                          <select
                            value={voiceCallContext?.selectedAudioInput || "default"}
                            onChange={(e) => voiceCallContext?.changeAudioInputDevice(e.target.value)}
                            className="w-full rounded-xl border border-white/10 bg-[#161720] px-3 py-2 text-xs font-medium text-white focus:outline-none focus:ring-1 focus:ring-white/30 cursor-pointer"
                          >
                            <option value="default">
                              {defaultInputLabel && defaultInputLabel !== "default"
                                ? `Padrão do Sistema (${defaultInputLabel.replace(/^Padrão - /i, "")})`
                                : "Padrão do Sistema (Detectado)"}
                            </option>
                            {voiceCallContext?.audioInputDevices.map((d) => (
                              <option key={d.deviceId} value={d.deviceId}>
                                {d.label || `Microfone (${d.deviceId.slice(0, 8)}...)`}
                              </option>
                            ))}
                          </select>

                          {/* Teste de Microfone com VU Meter e Marcador de Limiar */}
                          <div className="pt-2 border-t border-white/6 space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-bold text-white/60 flex items-center gap-1">
                                <Activity className="h-3.5 w-3.5 text-white/70" />
                                Nível de Entrada (VU Meter)
                              </span>
                              <button
                                type="button"
                                onClick={() => setIsTestingMic((prev) => !prev)}
                                className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${isTestingMic
                                    ? "bg-rose-500 text-white shadow-md"
                                    : "bg-white text-black hover:bg-white/90"
                                  }`}
                              >
                                {isTestingMic ? "Parar Teste" : "Testar Microfone"}
                              </button>
                            </div>
                            <div className="relative h-3 w-full overflow-hidden rounded-full bg-white/10">
                              <div
                                className="h-full bg-white shadow-[0_0_12px_rgba(255,255,255,0.6)] transition-all duration-75"
                                style={{ width: `${testMicVolume}%` }}
                              />
                              {/* Marcador de Limiar de Ativação do VAD */}
                              {(() => {
                                const sens = voiceCallContext?.voiceSensitivity ?? 35;
                                const thresholdRms = Math.max(1, Math.round(1 + 29 * Math.pow((100 - sens) / 100, 1.8)));
                                const markerPos = Math.min(95, Math.max(5, thresholdRms * 3.3));
                                return (
                                  <div
                                    className="absolute top-0 bottom-0 w-0.5 bg-amber-400 z-10 shadow-[0_0_6px_rgba(245,158,11,0.9)]"
                                    style={{ left: `${markerPos}%` }}
                                    title="Ponto de Ativação por Voz (Limiar)"
                                  />
                                );
                              })()}
                            </div>
                            <p className="text-[9px] text-white/40 flex items-center justify-between">
                              <span>0%</span>
                              <span className="text-amber-400 font-bold">| Ponto de Ativação</span>
                              <span>100%</span>
                            </p>
                          </div>

                          {/* Retorno de Microfone (Ouvir própria voz) */}
                          <label className="flex items-center justify-between pt-2 border-t border-white/6 cursor-pointer">
                            <span className="text-xs font-bold text-white/80 flex items-center gap-1.5">
                              <Headphones className="h-3.5 w-3.5 text-white/70" />
                              Ouvir minha própria voz (Retorno)
                            </span>
                            <input
                              type="checkbox"
                              checked={Boolean(voiceCallContext?.isMicMonitoring)}
                              onChange={(e) => voiceCallContext?.setIsMicMonitoring(e.target.checked)}
                              className="h-4 w-4 rounded accent-white cursor-pointer"
                            />
                          </label>
                        </div>

                        {/* Alto-Falante */}
                        <div className="rounded-2xl border border-white/6 bg-white/[0.035] p-4 space-y-3">
                          <label className="text-xs font-bold text-white flex items-center gap-2">
                            <Headphones className="h-4 w-4 text-white/70" />
                            Dispositivo de Saída (Alto-Falante)
                          </label>
                          <select
                            value={voiceCallContext?.selectedAudioOutput || "default"}
                            onChange={(e) => voiceCallContext?.changeAudioOutputDevice(e.target.value)}
                            className="w-full rounded-xl border border-white/10 bg-[#161720] px-3 py-2 text-xs font-medium text-white focus:outline-none focus:ring-1 focus:ring-white/30 cursor-pointer"
                          >
                            <option value="default">
                              {defaultOutputLabel && defaultOutputLabel !== "default"
                                ? `Padrão do Sistema (${defaultOutputLabel.replace(/^Padrão - /i, "")})`
                                : "Padrão do Sistema (Detectado)"}
                            </option>
                            {voiceCallContext?.audioOutputDevices.map((d) => (
                              <option key={d.deviceId} value={d.deviceId}>
                                {d.label || `Alto-Falante (${d.deviceId.slice(0, 8)}...)`}
                              </option>
                            ))}
                          </select>

                          <div className="pt-2 border-t border-white/6 flex items-center justify-between">
                            <span className="text-[11px] font-bold text-white/60">Teste de Saída</span>
                            <button
                              type="button"
                              onClick={() => playSound("select")}
                              className="px-3 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer"
                            >
                              Testar Som
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Câmera & Preview */}
                      <div className="mt-4 rounded-2xl border border-white/6 bg-white/[0.035] p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-bold text-white flex items-center gap-2">
                            <Camera className="h-4 w-4 text-white/70" />
                            Câmera de Vídeo
                          </label>
                          <button
                            type="button"
                            onClick={() => setIsVideoPreviewOn((prev) => !prev)}
                            className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${isVideoPreviewOn
                                ? "bg-white text-black shadow-md font-black"
                                : "bg-white/10 text-white hover:bg-white/20"
                              }`}
                          >
                            {isVideoPreviewOn ? "Fechar Preview" : "Testar Vídeo"}
                          </button>
                        </div>

                        <select
                          value={voiceCallContext?.selectedVideoInput || "default"}
                          onChange={(e) => voiceCallContext?.changeVideoInputDevice(e.target.value)}
                          className="w-full rounded-xl border border-white/10 bg-[#161720] px-3 py-2 text-xs font-medium text-white focus:outline-none focus:ring-1 focus:ring-white/30 cursor-pointer"
                        >
                          <option value="default">
                            {defaultVideoLabel && defaultVideoLabel !== "default"
                              ? `Padrão do Sistema (${defaultVideoLabel.replace(/^Padrão - /i, "")})`
                              : "Padrão do Sistema (Detectado)"}
                          </option>
                          {voiceCallContext?.videoInputDevices.map((d) => (
                            <option key={d.deviceId} value={d.deviceId}>
                              {d.label || `Câmera (${d.deviceId.slice(0, 8)}...)`}
                            </option>
                          ))}
                        </select>

                        {isVideoPreviewOn && (
                          <div className="relative aspect-video w-full max-w-sm rounded-xl overflow-hidden bg-black/80 border border-white/10 mt-2">
                            <video
                              ref={videoPreviewRef}
                              autoPlay
                              playsInline
                              muted
                              className="h-full w-full object-cover"
                            />
                          </div>
                        )}
                      </div>
                    </>
                  );
                })()}
              </section>

              {/* Sensibilidade, Calibração e Processamento */}
              <section className="rounded-[28px] border border-white/10 bg-black/40 p-6 md:p-7 backdrop-blur-3xl shadow-[0_20px_70px_rgba(0,0,0,0.45)]">
                <SettingsHeader
                  icon={<Activity className="h-5 w-5 text-white/70" />}
                  title="Sensibilidade e Processamento de Áudio"
                  description="Calibre o ruído ambiente automaticamente e ajuste filtros de cancelamento e ganho."
                />
                <div className="space-y-4">
                  {/* Calibração Automática de Ruído Ambiente */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-2xl border border-white/8 bg-white/[0.02]">
                    <div className="space-y-0.5">
                      <p className="text-xs font-bold text-white flex items-center gap-2">
                        <span>Calibração de Ruído Ambiente</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-white/80">
                          Piso medido: {voiceCallContext?.currentNoiseFloor ?? 5}%
                        </span>
                      </p>
                      <p className="text-[11px] text-white/50">
                        Mede 2 segundos de silêncio para ajustar o limiar de ativação ideal para o seu quarto/ambiente.
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={voiceCallContext?.isCalibratingNoise}
                      onClick={() => void voiceCallContext?.calibrateNoiseFloor()}
                      className="px-4 py-2 rounded-xl bg-white text-black font-black text-xs uppercase tracking-wider hover:bg-white/90 shadow-md transition disabled:opacity-50 cursor-pointer shrink-0"
                    >
                      {voiceCallContext?.isCalibratingNoise ? "Medindo Ruído (2s)..." : "Calibrar Microfone"}
                    </button>
                  </div>

                  {/* Slider de Sensibilidade */}
                  <div className="rounded-2xl border border-white/6 bg-white/[0.035] p-4 space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold text-white">
                      <span>Sensibilidade da Atividade de Voz</span>
                      <span className="font-mono text-white/80">{voiceCallContext?.voiceSensitivity ?? 35}%</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={voiceCallContext?.voiceSensitivity ?? 35}
                      onChange={(e) => voiceCallContext?.setVoiceSensitivity(Number(e.target.value))}
                      className="w-full accent-white cursor-pointer"
                    />
                    <div className="flex justify-between text-[9px] font-bold uppercase tracking-wider text-white/30">
                      <span>Menos Sensível (Corta ruídos)</span>
                      <span>Mais Sensível (Sussurros)</span>
                    </div>
                  </div>

                  {/* Slider de Ganho Manual de Microfone (Gain Boost) */}
                  <div className="rounded-2xl border border-white/6 bg-white/[0.035] p-4 space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold text-white">
                      <span>Ganho do Microfone (Volume de Entrada)</span>
                      <span className="font-mono text-white/80">{voiceCallContext?.micGain ?? 100}%</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={200}
                      value={voiceCallContext?.micGain ?? 100}
                      onChange={(e) => voiceCallContext?.setMicGain(Number(e.target.value))}
                      className="w-full accent-white cursor-pointer"
                    />
                    <div className="flex justify-between text-[9px] font-bold uppercase tracking-wider text-white/30">
                      <span>0% (Mudo)</span>
                      <span>100% (Padrão)</span>
                      <span>200% (Boost Máximo)</span>
                    </div>
                  </div>

                  {/* Toggles de Processamento */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    <div className="flex items-center justify-between rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.04] p-3.5 col-span-1 sm:col-span-2 lg:col-span-3">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-bold text-white">Supressão de Ruído Avançada (IA)</p>
                          <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            RNNoise WASM
                          </span>
                        </div>
                        <p className="text-[10px] font-medium text-white/40">Filtra teclado mecânico, ruídos de fundo e ventiladores via rede neural em tempo real</p>
                      </div>
                      <Switch
                        checked={voiceCallContext?.advancedNoiseSuppression ?? true}
                        onCheckedChange={(checked) => void voiceCallContext?.setAdvancedNoiseSuppression?.(checked)}
                      />
                    </div>

                    <div className="flex items-center justify-between rounded-2xl border border-white/6 bg-white/[0.035] p-3.5">
                      <div>
                        <p className="text-xs font-bold text-white">Cancelamento de Eco</p>
                        <p className="text-[10px] font-medium text-white/40">Evita retorno dos alto-falantes</p>
                      </div>
                      <Switch
                        checked={voiceCallContext?.echoCancellation ?? true}
                        onCheckedChange={(checked) => voiceCallContext?.setEchoCancellation(checked)}
                      />
                    </div>

                    <div className="flex items-center justify-between rounded-2xl border border-white/6 bg-white/[0.035] p-3.5">
                      <div>
                        <p className="text-xs font-bold text-white">Supressão Nativa</p>
                        <p className="text-[10px] font-medium text-white/40">Filtro padrão do Chromium</p>
                      </div>
                      <Switch
                        checked={voiceCallContext?.noiseSuppression ?? true}
                        onCheckedChange={(checked) => voiceCallContext?.setNoiseSuppression(checked)}
                      />
                    </div>

                    <div className="flex items-center justify-between rounded-2xl border border-white/6 bg-white/[0.035] p-3.5">
                      <div>
                        <p className="text-xs font-bold text-white">Gate de Ruído</p>
                        <p className="text-[10px] font-medium text-white/40">Corta áudio no silêncio</p>
                      </div>
                      <Switch
                        checked={voiceCallContext?.noiseGateEnabled ?? true}
                        onCheckedChange={(checked) => voiceCallContext?.setNoiseGateEnabled(checked)}
                      />
                    </div>

                    <div className="flex items-center justify-between rounded-2xl border border-white/6 bg-white/[0.035] p-3.5">
                      <div>
                        <p className="text-xs font-bold text-white">Ganho Automático</p>
                        <p className="text-[10px] font-medium text-white/40">Nivela volume da voz</p>
                      </div>
                      <Switch
                        checked={voiceCallContext?.autoGainControl ?? true}
                        onCheckedChange={(checked) => voiceCallContext?.setAutoGainControl(checked)}
                      />
                    </div>
                  </div>
                </div>
              </section>

              {/* Modo de Entrada, Rede & Auto-Teste Echo */}
              <section className="rounded-[28px] border border-white/10 bg-black/40 p-6 md:p-7 backdrop-blur-3xl shadow-[0_20px_70px_rgba(0,0,0,0.45)]">
                <SettingsHeader
                  icon={<Mic className="h-5 w-5 text-white/70" />}
                  title="Voz & Comunicação"
                  description="Configure o modo de captura do microfone, atalhos de Push-to-Talk e status de rede."
                />
                <div className="space-y-4">
                  {/* Modo de Entrada */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-white/6 bg-white/[0.035] p-4">
                    <div>
                      <p className="text-xs font-bold text-white">Modo de Entrada de Áudio</p>
                      <p className="mt-0.5 text-[10px] font-medium text-white/40">
                        {voiceCallContext?.inputMode === "push-to-talk"
                          ? "O microfone só transmite áudio enquanto a tecla configurada estiver pressionada."
                          : "O microfone transmite automaticamente ao detectar sua voz."}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => voiceCallContext?.setInputMode("voice-activity")}
                        className={`cursor-pointer px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${voiceCallContext?.inputMode !== "push-to-talk"
                            ? "bg-white text-black font-black shadow-[0_0_15px_rgba(255,255,255,0.2)]"
                            : "bg-white/5 text-white/60 hover:text-white hover:bg-white/10"
                          }`}
                      >
                        Atividade de Voz
                      </button>
                      <button
                        type="button"
                        onClick={() => voiceCallContext?.setInputMode("push-to-talk")}
                        className={`cursor-pointer px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${voiceCallContext?.inputMode === "push-to-talk"
                            ? "bg-white text-black font-black shadow-[0_0_15px_rgba(255,255,255,0.2)]"
                            : "bg-white/5 text-white/60 hover:text-white hover:bg-white/10"
                          }`}
                      >
                        Push-to-Talk
                      </button>
                    </div>
                  </div>

                  {voiceCallContext?.inputMode === "push-to-talk" && (
                    <div className="flex items-center justify-between gap-4 p-4 rounded-2xl border border-white/6 bg-white/[0.035]">
                      <div>
                        <p className="text-xs font-bold text-white">Atalho Global de Push-to-Talk</p>
                        <p className="text-[10px] font-medium text-white/40">
                          Funciona mesmo durante jogos em tela cheia via atalho nativo do Windows.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setIsRecordingPttKey(true);
                          const onKey = (e: KeyboardEvent) => {
                            e.preventDefault();
                            e.stopPropagation();
                            const key = e.key === " " ? "Space" : e.key.length === 1 ? e.key.toUpperCase() : e.key;
                            voiceCallContext?.setPushToTalkKey(key);
                            setIsRecordingPttKey(false);
                            window.removeEventListener("keydown", onKey, true);
                          };
                          window.addEventListener("keydown", onKey, true);
                        }}
                        className={`min-w-[100px] px-3.5 py-1.5 rounded-xl border text-xs font-mono font-bold transition-all cursor-pointer ${isRecordingPttKey
                            ? "bg-amber-500/30 text-amber-300 border-amber-500 animate-pulse"
                            : "bg-white/10 text-white border-white/15 hover:bg-white/20"
                          }`}
                      >
                        {isRecordingPttKey ? "Pressione uma tecla..." : voiceCallContext?.pushToTalkKey || "F8"}
                      </button>
                    </div>
                  )}

                  {/* Status Conexão ICE / TURN */}
                  <div className="flex items-center justify-between gap-4 rounded-2xl border border-white/6 bg-white/[0.035] p-4">
                    <div>
                      <p className="text-xs font-bold text-white">Conexão ICE / TURN (NAT & CGNAT)</p>
                      <p className="mt-0.5 text-[10px] font-medium text-white/40">
                        Roteamento WebRTC resiliente com suporte a redes residenciais e provedores locais.
                      </p>
                    </div>
                    <span className="text-[11px] font-bold text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-1 rounded-xl">
                      Metered.ca TURN Ativo
                    </span>
                  </div>

                  {/* Auto Teste Echo Bot */}
                  <div className="pt-3 border-t border-white/6 flex items-center justify-between gap-4">
                    <div>
                      <p className="text-xs font-bold text-white">Auto-Teste de Chamada (Echo Bot)</p>
                      <p className="text-[10px] font-medium text-white/40">
                        Inicie uma sessão de teste local para verificar áudio, vídeo e compartilhamento de tela.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => voiceCallContext?.startTestCall()}
                      className="px-4 py-2 rounded-xl bg-white text-black font-black text-xs uppercase tracking-wider hover:bg-white/90 hover:scale-105 active:scale-95 transition-all shadow-lg shadow-white/10 cursor-pointer shrink-0"
                    >
                      Iniciar Auto-Teste
                    </button>
                  </div>
                </div>
              </section>
            </div>
          )}

          {/* TAB 6: NOTIFICAÇÕES & OVERLAY */}
          {activeTab === "notifications" && (
            <div className="space-y-6">
              <section className="rounded-[28px] border border-white/10 bg-black/40 p-6 md:p-7 backdrop-blur-3xl shadow-[0_20px_70px_rgba(0,0,0,0.45)]">
                <SettingsHeader
                  icon={<Bell className="h-5 w-5 text-white/70" />}
                  title={achievementNotificationCopy.title}
                  description={achievementNotificationCopy.description}
                />
                <div className="space-y-3.5">
                  <div className="flex items-center justify-between gap-5 rounded-2xl border border-white/6 bg-white/[0.035] p-4">
                    <div>
                      <p className="text-xs font-bold text-white whitespace-nowrap">
                        {achievementNotificationCopy.enabled}
                      </p>
                      <p className="text-[10px] font-medium text-white/40 mt-0.5">
                        {achievementNotificationCopy.enabledHint}
                      </p>
                    </div>
                    <Switch
                      checked={achievementNotificationsEnabled}
                      onCheckedChange={setAchievementNotificationsEnabled}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-5 rounded-2xl border border-white/6 bg-white/[0.035] p-4">
                    <div>
                      <p className="text-xs font-bold text-white whitespace-nowrap">{achievementNotificationCopy.custom}</p>
                      <p className="text-[10px] font-medium text-white/40 mt-0.5">
                        {achievementNotificationCopy.customHint}
                      </p>
                    </div>
                    <Switch
                      checked={customAchievementNotifications}
                      disabled={!achievementNotificationsEnabled}
                      onCheckedChange={setCustomAchievementNotifications}
                    />
                  </div>
                  <div
                    className={
                      !achievementNotificationsEnabled || !customAchievementNotifications
                        ? "pointer-events-none opacity-40"
                        : ""
                    }
                  >
                    <p className="mb-3 text-[10px] font-black uppercase tracking-widest text-white/40">
                      {achievementNotificationCopy.position}
                    </p>
                    <div className="grid grid-cols-2 gap-3.5">
                      {ACHIEVEMENT_POSITIONS.map((position, index) => (
                        <SettingsChoice
                          key={position}
                          active={achievementNotificationPosition === position}
                          label={achievementNotificationCopy.positions[index]}
                          hint=""
                          onHover={() => playSound("hover")}
                          onClick={() => setAchievementNotificationPosition(position)}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </section>

              <section className="rounded-[28px] border border-white/10 bg-black/40 p-6 md:p-7 backdrop-blur-3xl shadow-[0_20px_70px_rgba(0,0,0,0.45)]">
                <SettingsHeader
                  icon={<Sparkles className="h-5 w-5 text-white/70" />}
                  title={detailCopy.overlayLab}
                  description={detailCopy.overlayLabHint}
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <button
                    type="button"
                    onClick={onTestOverlayWelcome}
                    onMouseEnter={() => playSound("hover")}
                    className="cursor-pointer rounded-2xl border border-white/10 bg-white/4 p-4 text-left transition-all duration-200 hover:scale-[1.02] hover:border-white/25 hover:bg-white/8 active:scale-[0.98]"
                  >
                    <span className="block text-xs font-bold text-white whitespace-nowrap">
                      {detailCopy.testWelcome}
                    </span>
                    <span className="mt-1 block text-[10px] font-medium text-white/40">
                      {detailCopy.testWelcomeHint}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={onTestOverlayAchievement}
                    onMouseEnter={() => playSound("hover")}
                    className="cursor-pointer rounded-2xl border border-emerald-400/20 bg-emerald-500/8 p-4 text-left transition-all duration-200 hover:scale-[1.02] hover:border-emerald-400/40 hover:bg-emerald-500/[0.14] active:scale-[0.98]"
                  >
                    <span className="block text-xs font-bold text-white whitespace-nowrap">
                      {detailCopy.testAchievement}
                    </span>
                    <span className="mt-1 block text-[10px] font-medium text-white/40">
                      {detailCopy.testAchievementHint}
                    </span>
                  </button>
                </div>
              </section>
            </div>
          )}
        </main>
      </div>
    </SystemPageShell>
  );
});

SettingsPageV2.displayName = "SettingsPageV2";
