import React, { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSpotify } from "@fortawesome/free-brands-svg-icons";
import {
  BadgeDollarSign,
  Bell,
  CheckCircle2,
  Globe,
  Gamepad2,
  Languages,
  Search,
  Settings,
  Sparkles,
  Trash2,
  User,
  Users,
  Volume2,
  X,
  Send,
  MessageSquare,
} from "lucide-react";
import Stepper, { Step } from "../ReactBits/Stepper";
import GlassButton from "../ui/GlassButton";
import ModalShell from "../ui/ModalShell";
import { useNotification } from "../NotificationCenter";
import { searchCheckpointFriends } from "../../services/checkpointFriends";
import {
  cleanupExpiredChatMessages,
  markMessagesAsRead,
  sendChatMessage,
  setChatTyping,
  subscribeToChatMessages,
  subscribeToFriendTyping,
} from "../../services/chat";
import { usePreferences, type LauncherLanguage, type SoundTheme, type VisualTheme } from "../../context/PreferencesContext";
import type { SoundEffectType } from "../../hooks/useSoundEffects";
import type {
  ChatMessage,
  CheckpointFriendRequest,
  Game,
  PriceAlert,
  SocialFriend,
  UserProfile,
} from "../../types/domain";
import { useGamepadNavigation } from "../../hooks/useGamepadNavigation";
import { useControllerLedStatus } from "../../hooks/useControllerLed";
import { useGamepad } from "../../context/GamepadContext";

type TranslationFn = ReturnType<typeof usePreferences>["t"];
type BrandIcon = React.ComponentType<{ className?: string; style?: React.CSSProperties }>;

type HomeSocialFriend = SocialFriend;
type HomeCheckpointFriendRequest = CheckpointFriendRequest;
type HomePriceAlert = PriceAlert;

export interface LanguageOption {
  id: LauncherLanguage;
  label: string;
  hint: string;
}

export interface AppThemeOption {
  id: "default" | "playstation" | "gamecube" | "xbox360";
  label: string;
  hint: string;
  swatch: string;
  soundTheme: SoundTheme;
  visualTheme: VisualTheme;
}

const SystemPageShell: React.FC<{
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}> = ({ eyebrow, title, children }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useGamepadNavigation({
    scrollRef: scrollRef as React.RefObject<HTMLElement>,
    scrollSpeed: 25,
    disableX: true, // Let Home.tsx or other hooks handle X
    disableO: true, // Let Home.tsx handle O
  });

  return (
    <motion.div
      ref={scrollRef}
      data-system-page
      initial={{ opacity: 0, y: 24, filter: "blur(8px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="flex-1 overflow-y-auto px-10 pb-14 pt-8 thin-scrollbar"
    >
      <div className="mx-auto flex min-h-full max-w-6xl flex-col">
        <div className="mx-auto mb-8 w-full max-w-5xl text-right">
          <p className="mb-3 text-[10px] font-black uppercase tracking-[0.32em] text-white/25">
            {eyebrow}
          </p>
          <h1
            className="text-5xl font-black uppercase tracking-tight text-white"
            style={{ textShadow: "0 0 28px rgb(var(--launcher-accent) / 0.28)" }}
          >
            {title}
          </h1>
        </div>
        <div className="mx-auto w-full max-w-5xl">{children}</div>
      </div>
    </motion.div>
  );
};

const SettingsHeader: React.FC<{
  icon: React.ReactNode;
  title: React.ReactNode;
  description: string;
}> = ({ icon, title, description }) => (
  <div className="mb-6 flex items-center gap-3">
    <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/10">
      {icon}
    </div>
    <div>
      <h2 className="text-lg font-bold text-white">{title}</h2>
      <p className="text-xs text-white/40">{description}</p>
    </div>
  </div>
);

const SettingsChoice: React.FC<{
  active: boolean;
  label: string;
  hint: string;
  swatch?: string;
  onClick: () => void;
}> = ({ active, label, hint, swatch, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="relative overflow-hidden rounded-2xl border p-4 text-left transition-all"
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
        className="pointer-events-none absolute inset-0 rounded-2xl"
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
);

const VolumeSettingsCard: React.FC<{
  title: string;
  description: string;
  value: number;
  max: number;
  actionLabel?: string;
  onAction?: () => void;
  onChange: (volume: number) => void;
  t: TranslationFn;
}> = ({ title, description, value, max, actionLabel, onAction, onChange, t }) => (
  <section className="rounded-[28px] border border-white/10 bg-black/35 p-6 backdrop-blur-3xl">
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
          className="h-10 rounded-xl bg-white px-4 text-[10px] font-black uppercase tracking-wider text-black"
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
      className="w-full accent-white"
    />
    <div className="mt-3 flex justify-between text-[10px] font-black uppercase tracking-widest text-white/25">
      <span>{t("mute")}</span>
      <span>{t("max")}</span>
    </div>
  </section>
);

export const SettingsPageV2: React.FC<{
  language: LauncherLanguage;
  effectsVolume: number;
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
  onMusicVolumeChange: (volume: number) => void;
  onSoundThemeChange: (theme: SoundTheme) => void;
  onVisualThemeChange: (theme: VisualTheme) => void;
  onPreviewSound: () => void;
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
}> = ({
  language,
  effectsVolume,
  musicVolume,
  soundTheme,
  visualTheme,
  languageOptions,
  appThemeOptions,
  SteamIcon,
  DiscordIcon,
  onLanguageChange,
  onEffectsVolumeChange,
  onMusicVolumeChange,
  onSoundThemeChange,
  onVisualThemeChange,
  onPreviewSound,
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
    const { isGamepadConnected, gamepadFamily, connectedGamepadId } = useGamepad();
    const led = useControllerLedStatus();
    const activeAppTheme =
      visualTheme === "checkpoint"
        ? "default"
        : soundTheme === "gamecube" || visualTheme === "gamecube"
          ? "gamecube"
          : soundTheme === "xbox360" || visualTheme === "xbox360"
            ? "xbox360"
            : "playstation";

    return (
      <SystemPageShell eyebrow={t("system")} title={t("settings")}>
        <section className="mb-5 rounded-[28px] border border-white/10 bg-black/35 p-6 backdrop-blur-3xl">
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
                    onClick={onSyncSteam}
                    disabled={steamSyncing}
                    className="rounded-lg px-3 py-1.5 text-[10px] font-bold uppercase text-white/60 transition-all hover:bg-white/10 hover:text-white disabled:opacity-50"
                  >
                    {steamSyncing ? t("syncing") : t("sync")}
                  </button>
                  <button
                    onClick={onDisconnectSteam}
                    className="rounded-lg px-3 py-1.5 text-[10px] font-bold uppercase text-red-400 transition-all hover:bg-red-500/10 hover:text-red-300"
                  >
                    {t("unlink")}
                  </button>
                </div>
              ) : (
                <button
                  onClick={onConnectSteam}
                  disabled={steamConnecting}
                  className="rounded-lg px-4 py-2 text-[10px] font-bold uppercase text-white/70 transition-all hover:bg-white/10 hover:text-white disabled:opacity-50"
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
                  <p className="text-[10px] text-white/40">
                    Em breve!
                  </p>
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
                  onClick={onDisconnectDiscord}
                  className="rounded-lg px-3 py-1.5 text-[10px] font-bold uppercase text-red-400 transition-all hover:bg-red-500/10 hover:text-red-300"
                >
                  {t("unlink")}
                </button>
              ) : (
                <button
                  onClick={onConnectDiscord}
                  disabled={discordConnecting}
                  className="rounded-lg px-4 py-2 text-[10px] font-bold uppercase text-white/70 transition-all hover:bg-white/10 hover:text-white disabled:opacity-50"
                >
                  {discordConnecting ? t("connecting") : t("connectDiscord")}
                </button>
              )}
            </div>
          </div>
        </section>

        <section className="mb-5 rounded-[28px] border border-white/10 bg-black/35 p-6 backdrop-blur-3xl">
          <SettingsHeader
            icon={<Gamepad2 className="h-5 w-5 text-white/70" />}
            title="Controle"
            description="Status da navegacao e da iluminacao do controle conectado."
          />
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_auto]">
            <div className="flex min-w-0 items-center gap-4 rounded-2xl border border-white/[0.07] bg-white/[0.035] p-4">
              <div className={`h-3 w-3 shrink-0 rounded-full ${isGamepadConnected ? "bg-emerald-400 shadow-[0_0_14px_rgba(52,211,153,.7)]" : "bg-white/20"}`} />
              <div className="min-w-0">
                <p className="text-sm font-black text-white">
                  {isGamepadConnected ? "Controle conectado" : "Nenhum controle conectado"}
                </p>
                <p className="mt-1 truncate text-xs text-white/40">
                  {connectedGamepadId || "Conecte via USB ou Bluetooth para navegar pelo launcher."}
                </p>
              </div>
              {isGamepadConnected && (
                <span className="ml-auto rounded-lg bg-white/10 px-2.5 py-1 text-[9px] font-black uppercase tracking-widest text-white/55">
                  {gamepadFamily}
                </span>
              )}
            </div>

            <div className="flex items-center gap-4 rounded-2xl border border-white/[0.07] bg-white/[0.035] p-4 lg:min-w-[360px]">
              <div className={`h-3 w-3 shrink-0 rounded-full ${led.status === "connected" ? "bg-[rgb(var(--launcher-accent))] shadow-[0_0_14px_rgb(var(--launcher-accent)/.7)]" : led.status === "error" ? "bg-red-400" : "bg-amber-300"}`} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-black text-white">LED PlayStation</p>
                <p className="mt-1 text-xs text-white/40">{led.message}</p>
              </div>
              {led.status !== "unsupported" && (
                <button
                  type="button"
                  onClick={led.status === "connected" ? led.testLed : led.requestAccess}
                  disabled={led.status === "connecting"}
                  className="shrink-0 rounded-xl bg-white px-4 py-2 text-[10px] font-black uppercase tracking-wider text-black transition hover:bg-white/85"
                >
                  {led.status === "connected" ? "Testar LED" : led.status === "connecting" ? "Enviando" : "Autorizar"}
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
          <section className="rounded-[28px] border border-white/10 bg-black/35 p-6 backdrop-blur-3xl">
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
                  onClick={() => onLanguageChange(option.id)}
                />
              ))}
            </div>
          </section>

          <section className="rounded-[28px] border border-white/10 bg-black/35 p-6 backdrop-blur-3xl">
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
                  onClick={() => {
                    onVisualThemeChange(option.visualTheme);
                    onSoundThemeChange(option.soundTheme);
                  }}
                />
              ))}
            </div>
          </section>

          <VolumeSettingsCard
            title={t("soundEffects")}
            description={t("soundEffectsHint")}
            value={effectsVolume}
            max={100}
            actionLabel={t("test")}
            onAction={onPreviewSound}
            onChange={onEffectsVolumeChange}
            t={t}
          />

          <VolumeSettingsCard
            title={t("music")}
            description={t("musicHint")}
            value={musicVolume}
            max={35}
            onChange={onMusicVolumeChange}
            t={t}
          />
        </div>

        <section className="mt-5 rounded-[28px] border border-white/10 bg-black/35 p-6 backdrop-blur-3xl">
          <SettingsHeader
            icon={<Sparkles className="h-5 w-5 text-white/70" />}
            title="Overlay Lab"
            description="Dispare os dois overlays manualmente para validar o visual antes de estilizar."
          />
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <button
              type="button"
              onClick={onTestOverlayWelcome}
              className="rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-4 text-left transition-all hover:bg-white/[0.08]"
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
              className="rounded-2xl border border-emerald-400/20 bg-emerald-500/[0.08] px-5 py-4 text-left transition-all hover:bg-emerald-500/[0.14]"
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
  };

const AppUpdateSection: React.FC = () => {
  const [currentVersion, setCurrentVersion] = useState<string>("0.0.0");
  const [updateStatus, setUpdateStatus] = useState<"idle" | "checking" | "available" | "not-available" | "downloading" | "downloaded" | "error" | "dev">("idle");
  const [downloadProgress, setDownloadProgress] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [newVersionInfo, setNewVersionInfo] = useState<any>(null);

  useEffect(() => {
    // Busca versão inicial
    if ((window as any).electronAPI?.getVersion) {
      (window as any).electronAPI.getVersion().then(setCurrentVersion).catch(console.error);
    }

    if ((window as any).electronAPI?.onUpdateMessage) {
      const unsubscribe = (window as any).electronAPI.onUpdateMessage((msg: string, data: any) => {
        console.log("[Update UI] Mensagem recebida:", msg, data);
        if (msg === "checking-for-update") {
          setUpdateStatus("checking");
        } else if (msg === "update-available") {
          setUpdateStatus("available");
          setNewVersionInfo(data);
        } else if (msg === "update-not-available") {
          setUpdateStatus("not-available");
        } else if (msg === "update-downloaded") {
          setUpdateStatus("downloaded");
          setNewVersionInfo(data);
        } else if (msg === "error") {
          setUpdateStatus("error");
          setErrorMessage(data || "Erro desconhecido ao atualizar.");
        }
      });
      return unsubscribe;
    }
  }, []);

  useEffect(() => {
    if ((window as any).electronAPI?.onDownloadProgress) {
      const unsubscribe = (window as any).electronAPI.onDownloadProgress((progressInfo: any) => {
        setUpdateStatus("downloading");
        if (progressInfo && typeof progressInfo.percent === "number") {
          setDownloadProgress(Math.round(progressInfo.percent));
        }
      });
      return unsubscribe;
    }
  }, []);

  const handleCheckForUpdates = async () => {
    if (!(window as any).electronAPI?.checkForUpdates) return;
    setUpdateStatus("checking");
    setErrorMessage("");
    try {
      const res = await (window as any).electronAPI.checkForUpdates();
      if (res && res.status === "development") {
        setUpdateStatus("dev");
      }
    } catch (err: any) {
      setUpdateStatus("error");
      setErrorMessage(err.message || "Não foi possível buscar atualizações.");
    }
  };

  const handleDownload = async () => {
    if (!(window as any).electronAPI?.startDownload) return;
    setUpdateStatus("downloading");
    setDownloadProgress(0);
    try {
      await (window as any).electronAPI.startDownload();
    } catch (err: any) {
      setUpdateStatus("error");
      setErrorMessage(err.message || "Erro ao baixar atualização.");
    }
  };

  const handleInstall = () => {
    if ((window as any).electronAPI?.quitAndInstallUpdate) {
      (window as any).electronAPI.quitAndInstallUpdate();
    }
  };

  return (
    <section className="mt-5 rounded-[28px] border border-white/10 bg-black/35 p-6 backdrop-blur-3xl">
      <SettingsHeader
        icon={<Sparkles className="h-5 w-5 text-white/70" />}
        title="Atualizações do Sistema"
        description={`Versão instalada atualmente: v${currentVersion}`}
      />
      <div className="flex flex-col gap-4 rounded-2xl border border-white/[0.05] bg-white/[0.03] p-5">
        <div className="flex items-center justify-between">
          <div>
            {updateStatus === "idle" && (
              <p className="text-xs text-white/50">Mantenha seu Checkpoint Launcher na versão mais recente para novos recursos.</p>
            )}
            {updateStatus === "checking" && (
              <p className="text-xs text-amber-300 flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-amber-300 animate-pulse" />
                Buscando atualizações no GitHub...
              </p>
            )}
            {updateStatus === "available" && (
              <p className="text-xs text-emerald-400">
                Nova versão {newVersionInfo?.version ? `v${newVersionInfo.version}` : ""} disponível!
              </p>
            )}
            {updateStatus === "not-available" && (
              <p className="text-xs text-white/70">Você já está usando a versão mais recente do launcher.</p>
            )}
            {updateStatus === "downloading" && (
              <div className="space-y-2">
                <p className="text-xs text-sky-400">Baixando atualização... {downloadProgress}%</p>
                <div className="h-1.5 w-48 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full bg-sky-400 transition-all duration-300" style={{ width: `${downloadProgress}%` }} />
                </div>
              </div>
            )}
            {updateStatus === "downloaded" && (
              <p className="text-xs text-emerald-400">Atualização baixada com sucesso! Pronto para instalar.</p>
            )}
            {updateStatus === "dev" && (
              <p className="text-xs text-amber-300/80">Você está rodando em ambiente de desenvolvimento local (código-fonte).</p>
            )}
            {updateStatus === "error" && (
              <p className="text-xs text-red-400">Erro: {errorMessage}</p>
            )}
          </div>

          <div className="shrink-0">
            {updateStatus === "idle" || updateStatus === "not-available" || updateStatus === "dev" || updateStatus === "error" ? (
              <button
                type="button"
                onClick={handleCheckForUpdates}
                className="rounded-xl bg-white px-4 py-2 text-[10px] font-black uppercase text-black hover:bg-white/90 active:scale-95 transition-all cursor-pointer"
              >
                Buscar Atualizações
              </button>
            ) : null}

            {updateStatus === "available" ? (
              <button
                type="button"
                onClick={handleDownload}
                className="rounded-xl bg-sky-500 px-4 py-2 text-[10px] font-black uppercase text-white hover:bg-sky-400 active:scale-95 transition-all shadow-[0_0_15px_rgba(14,165,233,0.3)] cursor-pointer"
              >
                Baixar Agora
              </button>
            ) : null}

            {updateStatus === "downloaded" ? (
              <button
                type="button"
                onClick={handleInstall}
                className="rounded-xl bg-emerald-500 px-4 py-2 text-[10px] font-black uppercase text-white hover:bg-emerald-400 active:scale-95 transition-all shadow-[0_0_15px_rgba(16,185,129,0.3)] cursor-pointer"
              >
                Reiniciar e Instalar
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
};

export const FriendsPage: React.FC<{
  t: TranslationFn;
  discordConnected: boolean;
  userDisplay: string;
  discordUsername?: string;
  discordAvatar?: string;
  DiscordIcon: BrandIcon;
  friends: HomeSocialFriend[];
  unreadMessagesByFriend: Record<string, number>;
  incomingRequests: HomeCheckpointFriendRequest[];
  currentPresenceGame?: string | null;
  onConnectDiscord: () => void;
  onRemoveFriend: (friend: HomeSocialFriend) => void;
  onViewFriendProfile: (friend: HomeSocialFriend) => void;
  friendProfileLoadingId?: string | null;
  onAcceptRequest: (uid: string) => void;
  onRejectRequest: (uid: string) => void;
  onAddFriendClick: () => void;
  onOpenChat: (friend: HomeSocialFriend) => void;
}> = ({
  t,
  discordConnected,
  userDisplay,
  discordUsername,
  discordAvatar,
  DiscordIcon,
  friends,
  unreadMessagesByFriend,
  incomingRequests,
  currentPresenceGame,
  onConnectDiscord,
  onRemoveFriend,
  onViewFriendProfile,
  friendProfileLoadingId,
  onAcceptRequest,
  onRejectRequest,
  onAddFriendClick,
  onOpenChat,
}) => {
    const [friendSearch, setFriendSearch] = useState("");
    const presenceFriends = friends.filter((friend) => friend.source === "checkpoint");
    const onlineCount = presenceFriends.filter((friend) => friend.status !== "offline").length;
    const playingCount = presenceFriends.filter((friend) => friend.status === "playing").length;
    const normalizedSearch = friendSearch.trim().toLowerCase();
    const visibleFriends = normalizedSearch
      ? friends.filter(
        (friend) =>
          friend.name.toLowerCase().includes(normalizedSearch) ||
          friend.playing?.toLowerCase().includes(normalizedSearch),
      )
      : friends;

    return (
      <SystemPageShell eyebrow="Social" title={t("friends")}>
        <section className="mb-5 rounded-[28px] border border-white/10 bg-black/35 p-6 backdrop-blur-3xl">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="relative flex h-14 w-14 items-center justify-center overflow-hidden rounded-xl border-2 border-white/20 bg-white/10">
                {discordAvatar ? (
                  <img src={discordAvatar} alt="" className="h-full w-full object-cover" />
                ) : (
                  <DiscordIcon className="h-6 w-6 text-white/60" />
                )}
                <div className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-[#0A0A0C]">
                  <div className="h-3 w-3 rounded-full bg-green-500" />
                </div>
              </div>
              <div className="flex-1">
                <div className="mb-1 flex items-center gap-2">
                  <p className="text-base font-black text-white">
                    {discordConnected ? discordUsername || userDisplay : userDisplay}
                  </p>
                  {discordConnected && (
                    <div className="flex h-4 w-4 items-center justify-center rounded bg-white/10">
                      <DiscordIcon className="h-2.5 w-2.5 text-white/70" />
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-white/70">
                    {currentPresenceGame ? `Jogando ${currentPresenceGame}` : "Online"}
                  </p>
                </div>
                <p className="mt-1 text-[10px] text-white/40">
                  {discordConnected
                    ? "Perfil conectado ao Discord"
                    : "Conecte o Discord para usar avatar e nome"}
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={onAddFriendClick}
                className="h-10 rounded-xl bg-white px-5 text-[10px] font-black uppercase tracking-wider text-black transition-all hover:bg-white/90"
              >
                + {t("addFriendTitle")}
              </button>
              {!discordConnected && (
                <button
                  type="button"
                  onClick={onConnectDiscord}
                  className="h-8 rounded-lg bg-indigo-500/20 px-4 text-[9px] font-bold uppercase tracking-wider text-indigo-400 transition-all hover:bg-indigo-500/30"
                >
                  Conectar Discord
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {[
              { label: "Online", value: onlineCount },
              { label: "Jogando", value: playingCount },
              { label: "Total", value: friends.length },
            ].map((item) => (
              <div key={item.label} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-white/35">
                  {item.label}
                </p>
                <p className="mt-2 text-3xl font-black tabular-nums text-white">{item.value}</p>
              </div>
            ))}
          </div>
        </section>

        {incomingRequests.length > 0 && (
          <section className="mb-5 rounded-[28px] border border-white/10 bg-black/35 p-6 backdrop-blur-3xl">
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-black text-white">Solicitacoes recebidas</p>
                <p className="mt-0.5 text-[10px] text-white/40">
                  Aceite ou rejeite quem quer adicionar voce no Checkpoint.
                </p>
              </div>
              <span className="flex h-8 min-w-8 items-center justify-center rounded-xl bg-white/10 px-3 text-xs font-black text-white">
                {incomingRequests.length}
              </span>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {incomingRequests.map((request) => (
                <div
                  key={request.uid}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl bg-[var(--launcher-accent-soft)]">
                      {request.photoURL ? (
                        <img src={request.photoURL} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <Users className="h-4 w-4 text-white/70" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-white">
                        {request.displayName || "Usuario"}
                      </p>
                      <p className="text-[10px] uppercase tracking-widest text-white/35">
                        Quer ser seu amigo
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onRejectRequest(request.uid)}
                      className="h-9 rounded-lg px-3 text-[10px] font-black uppercase text-red-300/80 hover:bg-red-500/10"
                    >
                      Rejeitar
                    </button>
                    <button
                      type="button"
                      onClick={() => onAcceptRequest(request.uid)}
                      className="h-9 rounded-lg bg-white px-3 text-[10px] font-black uppercase text-black hover:bg-white/90"
                    >
                      Aceitar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {friends.length > 0 && (
          <div className="mb-5">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
              <input
                value={friendSearch}
                onChange={(event) => setFriendSearch(event.target.value)}
                placeholder="Pesquisar amigos..."
                className="h-12 w-full rounded-2xl border border-white/10 bg-black/35 pl-11 pr-4 text-sm font-bold text-white outline-none transition-all placeholder:text-white/25 focus:border-white/25"
              />
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {visibleFriends.length === 0 ? (
            <div className="rounded-[28px] border border-white/10 bg-black/35 p-8 text-center md:col-span-2">
              <Users className="mx-auto mb-4 h-8 w-8 text-white/35" />
              <p className="text-sm font-bold text-white/70">
                {!discordConnected
                  ? "Conecte o Discord para usar nome e avatar no perfil social."
                  : friends.length === 0
                    ? "Nenhum amigo do Checkpoint ainda."
                    : "Nenhum amigo corresponde a busca."}
              </p>
              {discordConnected && friends.length === 0 && (
                <p className="mt-2 text-xs text-white/35">{t("addFriendEmptyHint")}</p>
              )}
            </div>
          ) : (
            visibleFriends.map((friend) => (
              <div
                key={friend.id}
                className="flex min-h-[108px] flex-col justify-between gap-4 rounded-[22px] border border-white/10 bg-gradient-to-br from-white/[0.055] to-white/[0.02] p-4 sm:flex-row sm:items-center"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl bg-[var(--launcher-accent-soft)]">
                    {friend.avatar ? (
                      <img src={friend.avatar} alt="" className="h-full w-full object-cover" />
                    ) : friend.source === "discord_friend" ? (
                      <DiscordIcon className="h-4 w-4 text-white/70" />
                    ) : (
                      <Users className="h-4 w-4 text-white/70" />
                    )}
                    <span
                      className={`absolute bottom-0.5 right-0.5 h-2.5 w-2.5 rounded-full border border-[#0A0A0C] ${
                        friend.status === "offline" ? "bg-red-500" : "bg-green-500"
                      }`}
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-white">{friend.name}</p>
                    <p className="truncate text-[10px] uppercase tracking-widest text-white/35">
                      {friend.source === "discord_friend"
                        ? "Discord conectado"
                        : friend.source === "checkpoint"
                          ? friend.status === "playing"
                            ? `Jogando ${friend.playing || "um jogo"}`
                            : friend.status === "online"
                              ? "Online"
                              : "Offline"
                          : friend.status === "playing"
                            ? `Jogando ${friend.playing || "agora"}`
                            : friend.status === "online"
                              ? "Online"
                              : "Offline"}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {friend.source === "checkpoint" && (
                    <button
                      type="button"
                      onClick={() => onOpenChat(friend)}
                      aria-label="Abrir chat"
                      title="Abrir chat"
                      className="relative flex h-10 items-center gap-2 rounded-xl bg-white px-3.5 text-[10px] font-black uppercase tracking-wider text-black transition hover:bg-white/85"
                    >
                      <MessageSquare className="h-4 w-4" />
                      Chat
                      {Number(unreadMessagesByFriend[friend.id.split(":")[1]] || 0) > 0 && (
                        <span className="absolute -right-1 -top-1 flex min-h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-black leading-none text-white shadow-[0_0_12px_rgba(239,68,68,0.35)]">
                          {Math.min(unreadMessagesByFriend[friend.id.split(":")[1]], 99)}
                        </span>
                      )}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => onViewFriendProfile(friend)}
                    disabled={friendProfileLoadingId === friend.id}
                    aria-label={
                      friendProfileLoadingId === friend.id
                        ? "Abrindo perfil"
                        : "Ver perfil"
                    }
                    title={
                      friendProfileLoadingId === friend.id
                        ? "Abrindo perfil"
                        : "Ver perfil"
                    }
                    className="flex h-10 items-center gap-2 rounded-xl border border-white/10 px-3.5 text-[10px] font-black uppercase tracking-wider text-white/65 transition hover:bg-white/10 hover:text-white disabled:opacity-40"
                  >
                    <User className="h-4 w-4" />
                    Perfil
                  </button>
                  {!friend.source?.startsWith("discord") && (
                    <button
                      type="button"
                      onClick={() => onRemoveFriend(friend)}
                      aria-label="Remover amigo"
                      title="Remover amigo"
                      className="flex h-10 shrink-0 items-center justify-center rounded-xl border border-red-400/10 px-3 text-red-300/70 hover:bg-red-500/10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </SystemPageShell>
    );
  };

export const AddFriendModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onAddFriend: (profile: UserProfile) => void;
  currentUserUid: string;
  friendIds: Set<string>;
  outgoingRequestIds: Set<string>;
  incomingRequestIds: Set<string>;
  playSound: (type: SoundEffectType) => void;
  t: TranslationFn;
}> = ({
  isOpen,
  onClose,
  onAddFriend,
  currentUserUid,
  friendIds,
  outgoingRequestIds,
  incomingRequestIds,
  playSound,
  t,
}) => {
    const [search, setSearch] = useState("");
    const [results, setResults] = useState<UserProfile[]>([]);
    const [searching, setSearching] = useState(false);
    const [recentSearches, setRecentSearches] = useState<string[]>([]);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [sendingUid, setSendingUid] = useState<string | null>(null);

    const getProfileAction = (profile: UserProfile) => {
      if (profile.uid === currentUserUid) return { label: t("addFriendYou"), disabled: true };
      if (friendIds.has(profile.uid)) return { label: t("addFriendAlreadyFriend"), disabled: true };
      if (outgoingRequestIds.has(profile.uid)) return { label: t("addFriendPending"), disabled: true };
      if (incomingRequestIds.has(profile.uid)) return { label: t("addFriendRespond"), disabled: true };
      if (sendingUid === profile.uid) return { label: "...", disabled: true };
      return { label: t("addFriendSend"), disabled: false };
    };

    const handleSendRequest = async (profile: UserProfile) => {
      const action = getProfileAction(profile);
      if (action.disabled) return;
      playSound("select");
      setSendingUid(profile.uid);
      try {
        await onAddFriend(profile);
        setResults((current) => current.filter((item) => item.uid !== profile.uid));
        setSelectedIndex(0);
      } finally {
        setSendingUid(null);
      }
    };

    useEffect(() => {
      if (!isOpen) {
        setSearch("");
        setResults([]);
        setSelectedIndex(0);
        return;
      }

      const stored = localStorage.getItem("checkpoint_recent_friend_searches");
      if (!stored) {
        setRecentSearches([]);
        return;
      }

      try {
        setRecentSearches(JSON.parse(stored).slice(0, 5));
      } catch {
        setRecentSearches([]);
      }
    }, [isOpen]);

    const abortControllerRef = React.useRef<AbortController | null>(null);

    const handleSearch = async (event: React.FormEvent) => {
      event.preventDefault();
      if (!search.trim()) return;

      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();
      const currentSignal = abortControllerRef.current.signal;

      playSound("search");
      setSearching(true);
      setResults([]);
      setSelectedIndex(0);

      try {
        const searchResults = await searchCheckpointFriends(search.trim(), currentSignal);
        if (currentSignal.aborted) return;
        const uniqueResults = searchResults
          .filter((profile) => profile.uid && profile.uid !== currentUserUid)
          .filter(
            (profile, index, profiles) =>
              profiles.findIndex((item) => item.uid === profile.uid) === index,
          );
        setResults(uniqueResults);

        const newRecent = [search.trim(), ...recentSearches.filter((item) => item !== search.trim())].slice(0, 5);
        setRecentSearches(newRecent);
        localStorage.setItem("checkpoint_recent_friend_searches", JSON.stringify(newRecent));
      } catch (error) {
        console.error(error);
      } finally {
        setSearching(false);
      }
    };

    const handleKeyDown = (event: React.KeyboardEvent) => {
      if (!results.length) return;

      if (event.key === "ArrowDown") {
        event.preventDefault();
        playSound("navigate");
        setSelectedIndex((current) => Math.min(current + 1, results.length - 1));
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        playSound("navigate");
        setSelectedIndex((current) => Math.max(current - 1, 0));
      } else if (event.key === "Enter" && results[selectedIndex]) {
        event.preventDefault();
        void handleSendRequest(results[selectedIndex]);
      }
    };

    const clearRecentSearches = () => {
      playSound("back");
      setRecentSearches([]);
      localStorage.removeItem("checkpoint_recent_friend_searches");
    };

    const handleClose = () => {
      playSound("back");
      onClose();
    };

    if (!isOpen) return null;

    return (
      <ModalShell
        isOpen={isOpen}
        onClose={handleClose}
        maxWidthClassName="max-w-md"
        className="rounded-[28px] border border-white/10 bg-[#0A0A0C] shadow-2xl"
        ariaLabel={t("addFriendTitle")}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="relative w-full overflow-hidden rounded-[28px] p-6"
        >
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/[0.02] to-transparent" />
          <div className="relative mb-6 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-black text-white">{t("addFriendTitle")}</h2>
              <p className="mt-1 text-xs text-white/40">{t("addFriendHint")}</p>
            </div>
            <button
              type="button"
              onClick={handleClose}
              onMouseEnter={() => playSound("hover")}
              className="rounded-xl p-2 text-white/50 transition-colors hover:bg-white/10 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <form onSubmit={handleSearch} className="relative mb-4">
            <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-white/30" />
            <input
              autoFocus
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t("addFriendSearchPlaceholder")}
              className="h-14 w-full rounded-2xl border border-white/10 bg-white/[0.03] pl-12 pr-24 text-sm font-bold text-white outline-none transition-all placeholder:text-white/25 focus:border-white/25 focus:bg-white/[0.05]"
            />
            <button
              type="submit"
              disabled={searching || !search.trim()}
              onMouseEnter={() => playSound("hover")}
              className="absolute bottom-2 right-2 top-2 rounded-xl bg-white px-4 text-[10px] font-black uppercase tracking-wider text-black transition-all hover:bg-white/90 disabled:opacity-50 disabled:hover:bg-white"
            >
              {searching ? "..." : t("addFriendSearchButton")}
            </button>
          </form>

          {recentSearches.length > 0 && !search && !results.length && (
            <div className="mb-4 rounded-2xl border border-white/5 bg-white/[0.02] p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-bold text-white/70">{t("addFriendRecentSearches")}</h3>
                <button
                  type="button"
                  onClick={clearRecentSearches}
                  onMouseEnter={() => playSound("hover")}
                  className="text-[10px] uppercase tracking-wider text-white/40 hover:text-white/60"
                >
                  {t("addFriendClear")}
                </button>
              </div>
              <div className="space-y-2">
                {recentSearches.map((recentSearch, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => {
                      playSound("navigate");
                      setSearch(recentSearch);
                    }}
                    onMouseEnter={() => playSound("hover")}
                    className="w-full rounded-lg p-2 text-left text-sm text-white/60 transition-colors hover:bg-white/5 hover:text-white"
                  >
                    <Search className="mr-2 inline h-3 w-3 text-white/30" />
                    {recentSearch}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="custom-scrollbar min-h-[100px] max-h-[300px] space-y-3 overflow-y-auto pr-2">
            {searching ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white/60" />
                  <div className="text-sm text-white/40">{t("addFriendSearching")}</div>
                </div>
              </div>
            ) : results.length > 0 ? (
              results.map((profile, index) => {
                const action = getProfileAction(profile);
                return (
                  <div
                    key={profile.uid}
                    onMouseEnter={() => playSound("hover")}
                    className={`flex items-center justify-between rounded-2xl border p-4 transition-all ${index === selectedIndex
                      ? "border-white/20 bg-white/[0.08]"
                      : "border-white/5 bg-white/[0.03] hover:bg-white/[0.06]"
                      }`}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="h-12 w-12 shrink-0 overflow-hidden rounded-full border border-white/10 bg-white/10">
                        {profile.photoURL ? (
                          <img src={profile.photoURL} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center">
                            <Users className="h-6 w-6 text-white/50" />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-bold text-white">
                          {profile.displayName || "Usuario"}
                        </div>
                        <div className="truncate text-[11px] text-white/40">{profile.email}</div>
                        {profile.status && (
                          <div className="mt-1 text-[10px] uppercase tracking-wider text-white/30">
                            {profile.status === "online"
                              ? t("addFriendOnline")
                              : profile.status === "playing"
                                ? `${t("addFriendPlaying")} ${profile.playing || ""}`
                                : t("addFriendOffline")}
                          </div>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleSendRequest(profile)}
                      onMouseEnter={() => playSound("hover")}
                      disabled={action.disabled}
                      className="h-10 min-w-[94px] rounded-xl bg-white/10 px-5 text-[11px] font-black uppercase tracking-wider text-white transition-all enabled:hover:scale-105 enabled:hover:bg-white/20 enabled:active:scale-95 disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      {action.label}
                    </button>
                  </div>
                );
              })
            ) : search.trim() ? (
              <div className="py-12 text-center">
                <Users className="mx-auto mb-4 h-12 w-12 text-white/20" />
                <div className="mb-2 text-sm text-white/40">{t("addFriendNoResults")}</div>
                <div className="text-xs text-white/30">{t("addFriendNoResultsHint")}</div>
              </div>
            ) : (
              <div className="py-12 text-center">
                <Search className="mx-auto mb-4 h-12 w-12 text-white/20" />
                <div className="mb-2 text-sm text-white/40">{t("addFriendEmpty")}</div>
                <div className="text-xs text-white/30">{t("addFriendEmptyHint")}</div>
              </div>
            )}
          </div>

          {results.length > 0 && (
            <div className="mt-4 border-t border-white/5 pt-4">
              <div className="text-center text-[10px] text-white/30">
                {t("addFriendKeyboardHint")}
              </div>
            </div>
          )}
        </motion.div>
      </ModalShell>
    );
  };

export const PriceAlertsPage: React.FC<{
  t: TranslationFn;
  games: Game[];
  alerts: HomePriceAlert[];
  onAddAlert: (game: Game) => void;
  onRemoveAlert: (id: string) => void;
}> = ({ t, games, alerts, onAddAlert, onRemoveAlert }) => {
  const [selectedGameId, setSelectedGameId] = useState("");
  const selectedGame = games.find((game) => game.id === selectedGameId) || games[0];

  return (
    <SystemPageShell eyebrow="Deals" title={t("priceAlerts")}>
      <section className="mb-5 rounded-[28px] border border-white/10 bg-black/35 p-6 backdrop-blur-3xl">
        <SettingsHeader
          icon={<Bell className="h-5 w-5 text-white/70" />}
          title={
            <div className="flex items-center gap-2">
              {t("priceAlerts")}
              <span className="rounded-md bg-amber-500/10 px-2 py-0.5 text-[8px] font-black uppercase tracking-widest text-amber-500">
                Em breve
              </span>
            </div>
          }
          description={t("priceAlertsHint")}
        />
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto]">
          <select
            value={selectedGame?.id ?? ""}
            onChange={(event) => setSelectedGameId(event.target.value)}
            className="h-11 rounded-xl border border-white/10 bg-black/40 px-3 text-sm text-white outline-none"
          >
            {games.map((game) => (
              <option key={game.id} value={game.id} className="bg-black">
                {game.title}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={!selectedGame}
            onClick={() => selectedGame && onAddAlert(selectedGame)}
            className="h-11 rounded-xl bg-white px-5 text-[10px] font-black uppercase tracking-wider text-black disabled:opacity-40"
          >
            {t("addAlert")}
          </button>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {alerts.length === 0 ? (
          <div className="rounded-[28px] border border-white/10 bg-black/35 p-8 text-center md:col-span-2">
            <BadgeDollarSign className="mx-auto mb-4 h-8 w-8 text-white/35" />
            <p className="text-sm font-bold text-white/70">{t("noAlerts")}</p>
          </div>
        ) : (
          alerts.map((alert) => (
            <div key={alert.id} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-bold text-white">{alert.title}</p>
                  <p className="mt-1 text-[10px] uppercase tracking-widest text-white/35">
                    {alert.source}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onRemoveAlert(alert.id)}
                  className="rounded-lg px-3 py-2 text-[10px] font-black uppercase text-red-300/70 hover:bg-red-500/10"
                >
                  Remover
                </button>
              </div>
              <p className="mt-5 text-xs font-bold text-white/50">
                Avisaremos quando encontrarmos uma oferta relevante para este jogo.
              </p>
            </div>
          ))
        )}
      </div>
    </SystemPageShell>
  );
};

export const EmptyState: React.FC<{
  searchTerm: string;
  onAddGame: () => void;
  onConnect: () => void;
  steamConnected: boolean;
}> = ({ searchTerm, onAddGame, onConnect, steamConnected }) => (
  <div
    className="w-full max-w-md rounded-3xl p-8 text-center"
    style={{
      background: "rgba(255,255,255,0.04)",
      border: "1px solid rgba(255,255,255,0.08)",
      backdropFilter: "blur(24px)",
    }}
  >
    <h3 className="mb-2 text-2xl font-black text-white">
      {searchTerm ? "Nenhum resultado" : "Biblioteca vazia"}
    </h3>
    <p className="mb-6 text-sm" style={{ color: "rgba(255,255,255,0.45)" }}>
      {searchTerm
        ? "Tente buscar por outro termo."
        : steamConnected
          ? "Voce nao possui jogos salvos. Adicione um jogo manualmente."
          : "Adicione um jogo ou conecte sua conta Steam."}
    </p>
    {!searchTerm && (
      <div className="flex justify-center gap-3">
        {!steamConnected && (
          <button
            onClick={onConnect}
            className="h-10 rounded-full px-5 text-[11px] font-black uppercase tracking-wider transition-all hover:scale-[1.02]"
            style={{
              background: "rgba(103,182,118,0.1)",
              border: "1px solid rgba(103,182,118,0.3)",
              color: "#67b676",
            }}
          >
            Conectar Steam
          </button>
        )}
        <button
          onClick={onAddGame}
          className="h-10 rounded-full bg-white px-5 text-[11px] font-black uppercase tracking-wider text-black transition-all hover:scale-[1.02]"
        >
          Novo Jogo
        </button>
      </div>
    )}
  </div>
);

export const EmptyLibraryOnboarding: React.FC<{
  onConnectSteam: () => void;
  onOpenAddGame: () => void;
  onComplete: () => void | Promise<void>;
  playSound: (type: SoundEffectType) => void;
}> = ({ onConnectSteam, onOpenAddGame, onComplete, playSound }) => (
  <div
    className="w-full max-w-2xl rounded-3xl p-8"
    style={{
      background: "rgba(255,255,255,0.04)",
      border: "1px solid rgba(255,255,255,0.09)",
      backdropFilter: "blur(32px)",
    }}
  >
    <p className="mb-4 text-[10px] uppercase tracking-[0.28em]" style={{ color: "rgba(255,255,255,0.3)" }}>
      Primeiros passos
    </p>
    <Stepper
      stepCircleContainerClassName="bg-transparent border-0 shadow-none"
      stepContainerClassName="pt-2"
      contentClassName="pb-2"
      footerClassName="pt-2"
      backButtonText="Voltar"
      nextButtonText="Proximo"
      onStepChange={() => playSound("navigate")}
      onFinalStepCompleted={() => {
        playSound("select");
        void onComplete();
      }}
      resetOnComplete
    >
      <Step>
        <h3 className="mb-2 text-2xl font-black text-white">Sua biblioteca esta vazia</h3>
        <p className="text-sm" style={{ color: "rgba(255,255,255,0.55)" }}>
          Adicione um jogo manualmente ou conecte sua conta Steam.
        </p>
      </Step>
      <Step>
        <h3 className="mb-2 text-2xl font-black text-white">Conecte com a Steam</h3>
        <p className="mb-5 text-sm" style={{ color: "rgba(255,255,255,0.55)" }}>
          Vincule sua conta para importar jogos automaticamente.
        </p>
        <button
          type="button"
          onClick={onConnectSteam}
          className="h-10 rounded-full px-5 text-[11px] font-black uppercase tracking-wider transition-all"
          style={{
            background: "rgba(103,182,118,0.1)",
            border: "1px solid rgba(103,182,118,0.35)",
            color: "#67b676",
          }}
        >
          Conectar Steam
        </button>
      </Step>
      <Step>
        <h3 className="mb-2 text-2xl font-black text-white">Adicione manualmente</h3>
        <p className="mb-5 text-sm" style={{ color: "rgba(255,255,255,0.55)" }}>
          Cadastre seu primeiro jogo manualmente agora.
        </p>
        <button
          type="button"
          onClick={() => {
            playSound("select");
            onOpenAddGame();
          }}
          className="h-10 rounded-full bg-white px-5 text-[11px] font-black uppercase tracking-wider text-black transition-all hover:scale-[1.02]"
        >
          Novo Jogo
        </button>
      </Step>
    </Stepper>
    <p className="mt-5 flex items-center gap-2 text-[11px]" style={{ color: "rgba(255,255,255,0.35)" }}>
      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
      Depois da primeira sincronizacao, seus jogos aparecem automaticamente.
    </p>
  </div>
);

export const ConfirmationModal: React.FC<{
  isOpen: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
  playSound: (type: SoundEffectType) => void;
}> = ({ isOpen, title, description, confirmLabel, onClose, onConfirm, playSound }) => (
  <ModalShell
    isOpen={isOpen}
    onClose={() => {
      playSound("back");
      onClose();
    }}
    maxWidthClassName="max-w-md"
    zIndexClassName="z-[170]"
    className="rounded-[32px] border border-white/10 bg-[#0a0a0c]/95 p-8 shadow-2xl backdrop-blur-3xl"
  >
    <h3 className="mb-2 text-xl font-semibold text-white">{title}</h3>
    <p className="text-sm" style={{ color: "rgba(255,255,255,0.55)" }}>
      {description}
    </p>
    <div className="mt-6 flex items-center justify-end gap-2">
      <GlassButton
        type="button"
        onClick={() => {
          playSound("back");
          onClose();
        }}
        onMouseEnter={() => playSound("hover")}
        variant="outline"
      >
        Cancelar
      </GlassButton>
      <GlassButton
        type="button"
        onClick={() => {
          playSound("select");
          void onConfirm();
        }}
        onMouseEnter={() => playSound("hover")}
        variant="white"
      >
        {confirmLabel}
      </GlassButton>
    </div>
  </ModalShell>
);

export const ChatModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  friend: HomeSocialFriend | null;
  playSound: (type: SoundEffectType) => void;
}> = ({ isOpen, onClose, friend, playSound }) => {
  const { notify } = useNotification();
  const [displayMessages, setDisplayMessages] = useState<ChatMessage[]>([]);
  const optimisticRef = useRef<Map<string, ChatMessage>>(new Map());
  const [inputText, setInputText] = useState("");
  const [friendTyping, setFriendTyping] = useState(false);
  const [spamLockedUntil, setSpamLockedUntil] = useState<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const recentSendTimestampsRef = useRef<number[]>([]);
  const lastTypingSentRef = useRef(false);
  // Ref para o friendUid — evita que o useEffect re-execute quando apenas o
  // objeto friend (status/avatar) muda, mas o UID permanece o mesmo.
  const friendUidRef = useRef<string | null>(null);

  const friendUid = friend?.id.split(":")[1] ?? null;

  // ── Subscrições Firebase ──────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen || !friendUid) {
      // Chat fechado — limpa tudo
      setDisplayMessages([]);
      optimisticRef.current.clear();
      setInputText("");
      setFriendTyping(false);
      setSpamLockedUntil(null);
      recentSendTimestampsRef.current = [];
      lastTypingSentRef.current = false;
      friendUidRef.current = null;
      return;
    }

    // Evita re-criar listeners se o UID não mudou
    if (friendUidRef.current === friendUid) return;
    friendUidRef.current = friendUid;

    void cleanupExpiredChatMessages(friendUid).catch(() => undefined);
    // markMessagesAsRead é chamado uma vez ao abrir, não dentro do callback do snapshot
    void markMessagesAsRead(friendUid);

    const lastMsgCountRef = { current: 0 };

    const unsubscribeMessages = subscribeToChatMessages(friendUid, (serverMsgs) => {
      // Remove mensagens otimistas que o servidor já confirmou
      const serverIds = new Set(serverMsgs.map((m) => m.id));
      optimisticRef.current.forEach((_, key) => {
        if (serverIds.has(key)) optimisticRef.current.delete(key);
      });

      const pending = Array.from(optimisticRef.current.values());
      const merged = [...serverMsgs, ...pending].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      );

      // Se o número de mensagens aumentou e a última foi enviada pelo amigo, reproduz o som
      if (merged.length > lastMsgCountRef.current && lastMsgCountRef.current > 0) {
        const lastMsg = merged[merged.length - 1];
        if (lastMsg && lastMsg.senderId === friendUid) {
          playSound("friendRequest");
        }
      }
      lastMsgCountRef.current = merged.length;
      setDisplayMessages(merged);
    });

    const unsubscribeTyping = subscribeToFriendTyping(friendUid, (typing) => {
      setFriendTyping(typing);
    });

    return () => {
      void setChatTyping(friendUid, false);
      unsubscribeMessages();
      unsubscribeTyping();
      friendUidRef.current = null;
    };
  }, [isOpen, friendUid]);

  // ── Scroll automático ────────────────────────────────────────────────────
  useEffect(() => {
    const el = messagesEndRef.current;
    if (!el) return;
    const timer = setTimeout(() => el.scrollIntoView({ behavior: "smooth" }), 60);
    return () => clearTimeout(timer);
  }, [displayMessages, friendTyping]);

  // ── Anti-spam cooldown ───────────────────────────────────────────────────
  useEffect(() => {
    if (!spamLockedUntil) return;
    const remaining = spamLockedUntil - Date.now();
    if (remaining <= 0) { setSpamLockedUntil(null); return; }
    const timer = window.setTimeout(() => setSpamLockedUntil(null), remaining);
    return () => window.clearTimeout(timer);
  }, [spamLockedUntil]);

  // ── Indicador de "está digitando" (enviado para o amigo) ─────────────────
  useEffect(() => {
    if (!isOpen || !friendUid) return;
    const shouldSendTyping = inputText.trim().length > 0;
    if (lastTypingSentRef.current === shouldSendTyping) return;
    lastTypingSentRef.current = shouldSendTyping;
    const timer = window.setTimeout(() => {
      void setChatTyping(friendUid, shouldSendTyping);
    }, shouldSendTyping ? 150 : 0);
    return () => window.clearTimeout(timer);
  }, [friendUid, inputText, isOpen]);

  if (!isOpen || !friend) return null;

  const linkPattern = /(https?:\/\/[^\s]+)|(www\.[^\s]+)/gi;
  const imageLinkPattern = /^https?:\/\/[^\s]+\.(png|jpe?g|gif|webp|bmp|svg)(\?[^\s]*)?$/i;

  const renderMessageText = (text: string) => {
    if (!text) return null;

    return text.split(linkPattern).filter(Boolean).map((part, index) => {
      const isLink = /^(https?:\/\/|www\.)/i.test(part);
      if (!isLink) {
        return (
          <React.Fragment key={`${part}-${index}`}>
            {part}
          </React.Fragment>
        );
      }

      const href = part.startsWith("http") ? part : `https://${part}`;
      return (
        <a
          key={`${href}-${index}`}
          href={href}
          target="_blank"
          rel="noreferrer"
          className="break-all text-sky-300 underline underline-offset-2 transition-colors hover:text-sky-200"
        >
          {part}
        </a>
      );
    });
  };

  const extractImageLinks = (text: string) =>
    Array.from(new Set((text.match(linkPattern) ?? [])
      .map((part) => (part.startsWith("http") ? part : `https://${part}`))
      .filter((part) => imageLinkPattern.test(part))));

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = inputText.trim();
    if (!text) return;
    if (!friendUid) return;

    const now = Date.now();
    const recentWindow = now - 8000;
    const freshTimestamps = recentSendTimestampsRef.current.filter(
      (timestamp) => timestamp > recentWindow,
    );

    if (spamLockedUntil && spamLockedUntil > now) {
      notify("DEVAGAR PAE: Você está enviando mensaagens rápido demais!", "error");
      return;
    }

    if (freshTimestamps.length >= 4) {
      const cooldownEnd = now + 6000;
      recentSendTimestampsRef.current = freshTimestamps;
      setSpamLockedUntil(cooldownEnd);
      notify("DEVAGAR PAE: Você está enviando mensaagens rápido demais!", "error");
      return;
    }

    try {
      playSound("select");
      const optimisticId = `local-${now}`;
      const optimisticMessage: ChatMessage = {
        id: optimisticId,
        chatId: friendUid,
        senderId: "me",
        receiverId: friendUid,
        text,
        createdAt: new Date(now).toISOString(),
        read: true,
      };

      recentSendTimestampsRef.current = [...freshTimestamps, now];
      optimisticRef.current.set(optimisticId, optimisticMessage);
      setDisplayMessages((current) => [...current, optimisticMessage]);
      setInputText("");
      lastTypingSentRef.current = false;
      void setChatTyping(friendUid, false);
      await sendChatMessage(friendUid, text);
    } catch (error) {
      console.error("Erro ao enviar mensagem:", error);
      const localId = `local-${now}`;
      optimisticRef.current.delete(localId);
      setDisplayMessages((current) =>
        current.filter((message) => message.id !== localId),
      );
      notify("Nao foi possivel enviar a mensagem.", "error");
    }
  };

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={() => {
        playSound("back");
        onClose();
      }}
      maxWidthClassName="max-w-md"
      zIndexClassName="z-[180]"
      className="p-0 border-0 overflow-hidden rounded-[24px]"
    >
      <div className="flex h-[550px] w-[450px] flex-col bg-[#050507]">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-white/5 bg-white/[0.02] px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="relative">
              <img
                src={friend.avatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=256"}
                alt={friend.name}
                className="h-10 w-10 rounded-full object-cover ring-2 ring-white/10"
              />
              <span
                className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-[#050507] ${
                  friend.status === "playing"
                    ? "bg-green-500 animate-pulse"
                    : friend.status === "online"
                      ? "bg-green-400"
                      : "bg-white/20"
                }`}
              />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white leading-none">{friend.name}</h4>
              <span className="text-[10px] text-white/40 uppercase tracking-wider block mt-1">
                {friend.status === "playing" ? `Jogando ${friend.playing}` : friend.status}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              playSound("back");
              onClose();
            }}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-white/5 bg-white/[0.02] text-white/60 hover:bg-white/10 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Messages */}
        <div className="chat-scrollbar flex-1 overflow-y-auto p-6 pr-3 space-y-4">
          {displayMessages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center text-white/20 space-y-2">
              <MessageSquare className="h-8 w-8" />
              <p className="text-xs uppercase tracking-wider">Nenhuma mensagem ainda</p>
            </div>
          ) : (
            displayMessages.map((msg, index) => {
              const isMe = msg.senderId !== friendUid;
              const inlineImageLinks = extractImageLinks(msg.text);
              return (
                <div key={msg.id || index} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[70%] rounded-[18px] px-4 py-2.5 text-xs ${
                      isMe
                        ? "bg-white/10 text-white rounded-tr-none"
                        : "bg-white/5 text-white/80 rounded-tl-none border border-white/5"
                    }`}
                  >
                    {inlineImageLinks.length > 0 ? (
                      <div className="mb-2 space-y-2">
                        {inlineImageLinks.map((imageUrl) => (
                          <a
                            key={imageUrl}
                            href={imageUrl}
                            target="_blank"
                            rel="noreferrer"
                            className={`block rounded-2xl border px-3 py-3 transition-all ${
                              isMe
                                ? "border-white/10 bg-black/25 hover:bg-black/35"
                                : "border-white/8 bg-white/[0.03] hover:bg-white/[0.06]"
                            }`}
                          >
                          <img
                            src={imageUrl}
                            alt="Imagem compartilhada"
                            className="max-h-48 w-full rounded-xl object-cover"
                          />
                          </a>
                        ))}
                      </div>
                    ) : null}
                    {msg.text ? (
                      <p className="break-words leading-relaxed">{renderMessageText(msg.text)}</p>
                    ) : null}
                    <span className="mt-1 block text-[8px] text-white/30 text-right uppercase tracking-wider">
                      {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                </div>
              );
            })
          )}
          {friendTyping && (
            <div className="flex justify-start">
              <div className="rounded-[18px] rounded-tl-none border border-white/5 bg-white/[0.04] px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="text-[9px] uppercase tracking-[0.28em] text-white/30">
                    digitando
                  </span>
                  <div className="flex items-center gap-1">
                    {[0, 1, 2].map((dot) => (
                      <motion.span
                        key={dot}
                        animate={{ opacity: [0.25, 1, 0.25], y: [0, -2, 0] }}
                        transition={{
                          duration: 0.8,
                          repeat: Infinity,
                          delay: dot * 0.12,
                          ease: "easeInOut",
                        }}
                        className="h-1.5 w-1.5 rounded-full bg-emerald-400"
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Footer / Input */}
        <form onSubmit={handleSend} className="shrink-0 border-t border-white/5 bg-white/[0.01] p-4">
          <div className="mb-2 flex min-h-[16px] items-center justify-between px-1">
            <span className="text-[10px] uppercase tracking-[0.24em] text-white/25">
              {friendTyping ? `${friend.name} está digitando...` : "Chat em tempo real"}
            </span>
            {spamLockedUntil && spamLockedUntil > Date.now() ? (
              <span className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-300">
                DEVAGAR PAE
              </span>
            ) : null}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Digite sua mensagem..."
              className="flex-1 rounded-xl border border-white/10 bg-black/40 px-4 py-2 text-xs text-white placeholder-white/20 focus:border-white/20 focus:outline-none"
            />
            <button
              type="submit"
              disabled={Boolean(spamLockedUntil && spamLockedUntil > Date.now())}
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-black transition-transform hover:bg-white/90 active:scale-95 disabled:cursor-not-allowed disabled:bg-white/30 disabled:text-black/50"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </form>
      </div>
    </ModalShell>
  );
};
