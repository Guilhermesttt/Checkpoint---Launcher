import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSpotify } from "@fortawesome/free-brands-svg-icons";
import {
  Bell,
  Gamepad2,
  Globe,
  Languages,
  Settings,
  Sparkles,
  Volume2,
  Zap,
} from "lucide-react";
import { SystemPageShell } from "../components/ui/SystemPageShell";
import { Switch } from "../components/ui/switch";
import { AppUpdateSection, SettingsHeader } from "../components/settings/AppUpdateSection";
import { usePreferences, type LauncherLanguage, type SoundTheme, type VisualTheme } from "../context/PreferencesContext";
import { useSoundEffects } from "../hooks/useSoundEffects";
import { useGamepad } from "../context/GamepadContext";
import { useControllerLedStatus } from "../hooks/useControllerLed";

type TranslationFn = ReturnType<typeof usePreferences>["t"];
type BrandIcon = React.ComponentType<{ className?: string; style?: React.CSSProperties }>;

export interface LanguageOption {
  id: LauncherLanguage;
  label: string;
  hint: string;
}

export interface AppThemeOption {
  id: "default" | "playstation" | "ps4" | "psp" | "gamecube" | "xbox360" | "cyberpunk";
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
    onClick={onClick}
    onMouseEnter={onHover}
    className="relative cursor-pointer overflow-hidden rounded-3xl border p-4 text-left transition-all duration-200 hover:scale-[1.03] hover:border-white/30 hover:bg-white/[0.08] hover:shadow-[0_0_20px_rgba(255,255,255,0.06)] active:scale-[0.98]"
    style={{
      background: active ? "var(--launcher-accent-soft)" : "rgba(255,255,255,0.04)",
      borderColor: active
        ? "rgb(var(--launcher-accent) / 0.45)"
        : "rgba(255,255,255,0.08)",
    }}
  >
    <span className="flex items-center gap-2 text-sm font-bold text-white">
      {swatch && (
        <span
          className="h-3 w-3 rounded-full border border-white/20"
          style={{ background: swatch }}
        />
      )}
      {label}
    </span>
    {active && (
      <span
        className="pointer-events-none absolute inset-0 rounded-3xl"
        style={{
          boxShadow:
            "inset 0 0 0 1px rgb(var(--launcher-accent) / 0.28), 0 0 28px rgb(var(--launcher-accent) / 0.16)",
        }}
      />
    )}
    <span className="mt-1 block text-[10px] uppercase tracking-widest text-white/35">
      {hint}
    </span>
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
}> = React.memo(({ title, description, value, max, actionLabel, onAction, onHover, onChange, t }) => (
  <section className="rounded-3xl border border-white/10 bg-black/35 p-6 backdrop-blur-3xl">
    <SettingsHeader
      icon={<Volume2 className="h-5 w-5 text-white/70" />}
      title={title}
      description={description}
    />
    <div className="mb-5 flex items-end justify-between gap-5">
      <div>
        <span className="tabular-nums text-6xl font-light text-white">{value}</span>
        <span className="ml-1 text-sm font-bold text-white/35">%</span>
      </div>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          onMouseEnter={onHover}
          className="h-10 cursor-pointer rounded-xl bg-white px-4 text-[10px] font-black uppercase tracking-wider text-black transition-all duration-200 hover:scale-105 hover:bg-white/90 hover:shadow-[0_0_15px_rgba(255,255,255,0.4)] active:scale-95"
        >
          {actionLabel}
        </button>
      )}
    </div>
    <input
      type="range"
      min={0}
      max={max}
      step={1}
      value={value}
      onChange={(event) => onChange(Number(event.target.value))}
      onMouseEnter={onHover}
      className="w-full cursor-pointer accent-white transition-all hover:brightness-125"
    />
    <div className="mt-3 flex justify-between text-[10px] font-black uppercase tracking-widest text-white/25">
      <span>{t("mute")}</span>
      <span>{t("max")}</span>
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
  steamSyncing: boolean;
  onConnectSteam: () => void;
  onConnectDiscord: () => void;
  onDisconnectSteam: () => void;
  onDisconnectDiscord: () => void;
  onSyncSteam: () => void;
  onTestOverlayWelcome: () => void;
  onTestOverlayAchievement: () => void;
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
  steamSyncing,
  onConnectSteam,
  onConnectDiscord,
  onDisconnectSteam,
  onDisconnectDiscord,
  onSyncSteam,
  onTestOverlayWelcome,
  onTestOverlayAchievement,
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
    achievementNotificationsEnabled,
    setAchievementNotificationsEnabled,
    customAchievementNotifications,
    setCustomAchievementNotifications,
    achievementNotificationPosition,
    setAchievementNotificationPosition,
  } = usePreferences();

  const controllerCopy = CONTROLLER_COPY[language] || CONTROLLER_COPY["pt-BR"];
  const achievementNotificationCopy =
    ACHIEVEMENT_NOTIFICATION_COPY[language] || ACHIEVEMENT_NOTIFICATION_COPY["pt-BR"];
  const led = useControllerLedStatus();

  const activeAppTheme =
    visualTheme === "checkpoint"
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
      <section className="mb-5 rounded-3xl border border-white/10 bg-black/35 p-6 backdrop-blur-3xl">
        <SettingsHeader
          icon={<Globe className="h-5 w-5 text-white/70" />}
          title={t("connectedAccounts")}
          description={t("connectedAccountsHint")}
        />
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <div className="flex items-center justify-between rounded-xl border border-white/[0.05] bg-white/[0.03] p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10">
                <SteamIcon className="h-4 w-4 text-white/60" />
              </div>
              <div>
                <p className="text-sm font-bold text-white">Steam</p>
                <p className="text-[10px] text-white/40">
                  {steamConnected ? t("connected") : t("notConnected")}
                </p>
              </div>
            </div>
            {steamConnected ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onSyncSteam}
                  onMouseEnter={() => playSound("hover")}
                  disabled={steamSyncing}
                  className="cursor-pointer rounded-lg px-3 py-1.5 text-[10px] font-bold uppercase text-white/60 transition-all duration-200 hover:scale-105 hover:bg-white/10 hover:text-white active:scale-95 disabled:opacity-50"
                >
                  {steamSyncing ? t("syncing") : t("sync")}
                </button>
                <button
                  type="button"
                  onClick={onDisconnectSteam}
                  onMouseEnter={() => playSound("hover")}
                  className="cursor-pointer rounded-lg px-3 py-1.5 text-[10px] font-bold uppercase text-red-400 transition-all duration-200 hover:scale-105 hover:bg-red-500/10 hover:text-red-300 active:scale-95"
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
                className="cursor-pointer rounded-lg px-4 py-2 text-[10px] font-bold uppercase text-white/70 transition-all duration-200 hover:scale-105 hover:bg-white/10 hover:text-white active:scale-95 disabled:opacity-50"
              >
                {steamConnecting ? t("connecting") : t("connectSteam")}
              </button>
            )}
          </div>

          <div className="flex items-center justify-between rounded-xl border border-white/[0.05] bg-white/[0.03] p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10">
                <FontAwesomeIcon icon={faSpotify} className="h-4 w-4 text-white/60" />
              </div>
              <div>
                <p className="text-sm font-bold text-white">Spotify</p>
                <p className="text-[10px] text-white/40">Em breve!</p>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-white/[0.05] bg-white/[0.03] p-4">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-lg bg-white/10">
                {discordAvatar ? (
                  <img src={discordAvatar} alt="" className="h-full w-full object-cover" />
                ) : (
                  <DiscordIcon className="h-4 w-4 text-white/60" />
                )}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-white">Discord</p>
                <p className="max-w-[140px] truncate text-[10px] text-white/40">
                  {discordConnected ? discordUsername || t("connected") : t("notConnected")}
                </p>
              </div>
            </div>
            {discordConnected ? (
              <button
                type="button"
                onClick={onDisconnectDiscord}
                onMouseEnter={() => playSound("hover")}
                className="cursor-pointer rounded-lg px-3 py-1.5 text-[10px] font-bold uppercase text-red-400 transition-all duration-200 hover:scale-105 hover:bg-red-500/10 hover:text-red-300 active:scale-95"
              >
                {t("unlink")}
              </button>
            ) : (
              <button
                type="button"
                onClick={onConnectDiscord}
                onMouseEnter={() => playSound("hover")}
                disabled={discordConnecting}
                className="cursor-pointer rounded-lg px-4 py-2 text-[10px] font-bold uppercase text-white/70 transition-all duration-200 hover:scale-105 hover:bg-white/10 hover:text-white active:scale-95 disabled:opacity-50"
              >
                {discordConnecting ? t("connecting") : t("connectDiscord")}
              </button>
            )}
          </div>
        </div>
      </section>

      <section className="mb-5 rounded-3xl border border-white/10 bg-black/35 p-6 backdrop-blur-3xl">
        <SettingsHeader
          icon={<Gamepad2 className="h-5 w-5 text-white/70" />}
          title={controllerCopy[0]}
          description="Status da navegacao e da iluminacao do controle conectado."
        />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_auto]">
          <div className="flex min-w-0 items-center gap-4 rounded-3xl border border-white/[0.07] bg-white/[0.035] p-4">
            <div
              className={`h-3 w-3 shrink-0 rounded-full ${
                isGamepadConnected
                  ? "bg-emerald-400 shadow-[0_0_14px_rgba(52,211,153,.7)]"
                  : "bg-white/20"
              }`}
            />
            <div className="min-w-0">
              <p className="text-sm font-black text-white">
                {isGamepadConnected ? controllerCopy[1] : controllerCopy[2]}
              </p>
              <p className="mt-1 truncate text-xs text-white/40">
                {connectedGamepadId || controllerCopy[3]}
              </p>
            </div>
            {isGamepadConnected && (
              <span className="ml-auto rounded-lg bg-white/10 px-2.5 py-1 text-[9px] font-black uppercase tracking-widest text-white/55">
                {gamepadFamily}
              </span>
            )}
          </div>

          <div className="flex items-center gap-4 rounded-2xl border border-white/[0.07] bg-white/[0.035] p-4 lg:min-w-[360px]">
            <div
              className={`h-3 w-3 shrink-0 rounded-full ${
                led.status === "connected"
                  ? "bg-[rgb(var(--launcher-accent))] shadow-[0_0_14px_rgb(var(--launcher-accent)/.7)]"
                  : led.status === "error"
                    ? "bg-red-400"
                    : "bg-amber-300"
              }`}
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-black text-white">LED PlayStation</p>
              <p className="mt-1 text-xs text-white/40">{led.message}</p>
            </div>
            {led.status !== "unsupported" && (
              <button
                type="button"
                onClick={led.status === "connected" ? led.testLed : led.requestAccess}
                onMouseEnter={() => playSound("hover")}
                disabled={led.status === "connecting"}
                className="shrink-0 cursor-pointer rounded-xl bg-white px-4 py-2 text-[10px] font-black uppercase tracking-wider text-black transition-all duration-200 hover:scale-105 hover:bg-white/90 hover:shadow-[0_0_15px_rgba(255,255,255,0.4)] active:scale-95 disabled:cursor-not-allowed disabled:hover:scale-100"
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
        <p className="mt-4 text-[11px] leading-relaxed text-white/35">
          Direcional ou analógico esquerdo move o foco, X confirma, O volta e o analógico direito rola a pagina.
        </p>
        {led.status === "connected" && (
          <p className="mt-2 text-[11px] leading-relaxed text-white/35">
            Se o teste RGB não aparecer, feche temporariamente o Steam Input ou DS4Windows: outro processo pode sobrescrever a lightbar.
          </p>
        )}
      </section>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <section className="rounded-3xl border border-white/10 bg-black/35 p-6 backdrop-blur-3xl">
          <SettingsHeader
            icon={<Languages className="h-5 w-5 text-white/70" />}
            title={t("language")}
            description={t("languageHint")}
          />
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
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

        <section className="rounded-3xl border border-white/10 bg-black/35 p-6 backdrop-blur-3xl">
          <SettingsHeader
            icon={<Settings className="h-5 w-5 text-white/70" />}
            title={t("themes")}
            description={t("themesHint")}
          />
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
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
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-black/35 p-6 backdrop-blur-3xl">
          <SettingsHeader
            icon={<Bell className="h-5 w-5 text-white/70" />}
            title={achievementNotificationCopy.title}
            description={achievementNotificationCopy.description}
          />
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-5 rounded-xl border border-white/[0.05] bg-white/[0.03] p-4">
              <div>
                <p className="text-sm font-bold text-white">
                  {achievementNotificationCopy.enabled}
                </p>
                <p className="text-[10px] text-white/40">
                  {achievementNotificationCopy.enabledHint}
                </p>
              </div>
              <Switch
                checked={achievementNotificationsEnabled}
                onCheckedChange={setAchievementNotificationsEnabled}
              />
            </div>
            <div className="flex items-center justify-between gap-5 rounded-xl border border-white/[0.05] bg-white/[0.03] p-4">
              <div>
                <p className="text-sm font-bold text-white">{achievementNotificationCopy.custom}</p>
                <p className="text-[10px] text-white/40">
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
              <div className="grid grid-cols-2 gap-3">
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

        <VolumeSettingsCard
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
          title={t("music")}
          description={t("musicHint")}
          value={musicVolume}
          max={35}
          onHover={() => playSound("hover")}
          onChange={onMusicVolumeChange}
          t={t}
        />
      </div>

      <section className="mt-5 rounded-3xl border border-white/10 bg-black/35 p-6 backdrop-blur-3xl">
        <SettingsHeader
          icon={<Zap className="h-5 w-5 text-white/70" />}
          title={t("performance")}
          description=""
        />
        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-xl border border-white/[0.05] bg-white/[0.03] p-4">
            <div>
              <p className="text-sm font-bold text-white">{t("openAtLogin")}</p>
              <p className="text-[10px] text-white/40">{t("openAtLoginHint")}</p>
            </div>
            <Switch checked={openAtLogin} onCheckedChange={setOpenAtLogin} />
          </div>

          <div className="flex items-center justify-between rounded-xl border border-white/[0.05] bg-white/[0.03] p-4">
            <div>
              <p className="text-sm font-bold text-white">{t("lowPerformanceMode")}</p>
              <p className="text-[10px] text-white/40">{t("lowPerformanceModeHint")}</p>
            </div>
            <Switch checked={lowPerformanceMode} onCheckedChange={setLowPerformanceMode} />
          </div>

          <div className="flex items-center justify-between rounded-xl border border-white/[0.05] bg-white/[0.03] p-4">
            <div>
              <p className="text-sm font-bold text-white">{t("closeOnLaunch")}</p>
              <p className="text-[10px] text-white/40">{t("closeOnLaunchHint")}</p>
            </div>
            <Switch checked={closeOnLaunch} onCheckedChange={setCloseOnLaunch} />
          </div>
        </div>
      </section>

      <section className="mt-5 rounded-3xl border border-white/10 bg-black/35 p-6 backdrop-blur-3xl">
        <SettingsHeader
          icon={<Sparkles className="h-5 w-5 text-white/70" />}
          title="Overlay Lab"
          description="Prévia de como os overlays ficarão quando você estiver jogando."
        />
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <button
            type="button"
            onClick={onTestOverlayWelcome}
            onMouseEnter={() => playSound("hover")}
            className="cursor-pointer rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-4 text-left transition-all duration-200 hover:scale-[1.02] hover:border-white/25 hover:bg-white/[0.08] hover:shadow-[0_0_20px_rgba(255,255,255,0.08)] active:scale-[0.98]"
          >
            <span className="block text-sm font-black uppercase tracking-wider text-white">
              Testar divirta-se
            </span>
            <span className="mt-2 block text-xs text-white/45">
              Mostra o card social que aparece ao iniciar um jogo.
            </span>
          </button>
          <button
            type="button"
            onClick={onTestOverlayAchievement}
            onMouseEnter={() => playSound("hover")}
            className="cursor-pointer rounded-2xl border border-emerald-400/20 bg-emerald-500/[0.08] px-5 py-4 text-left transition-all duration-200 hover:scale-[1.02] hover:border-emerald-400/40 hover:bg-emerald-500/[0.14] hover:shadow-[0_0_20px_rgba(16,185,129,0.15)] active:scale-[0.98]"
          >
            <span className="block text-sm font-black uppercase tracking-wider text-white">
              Testar conquista
            </span>
            <span className="mt-2 block text-xs text-white/45">
              Mostra o toast completo com titulo, descricao e icone.
            </span>
          </button>
        </div>
      </section>

      <AppUpdateSection />
    </SystemPageShell>
  );
});

SettingsPageV2.displayName = "SettingsPageV2";
