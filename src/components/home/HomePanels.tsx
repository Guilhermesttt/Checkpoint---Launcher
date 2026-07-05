import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSpotify } from "@fortawesome/free-brands-svg-icons";
import {
  BadgeDollarSign,
  Bell,
  CheckCircle2,
  Globe,
  Languages,
  Search,
  Settings,
  Sparkles,
  Users,
  Volume2,
  X,
} from "lucide-react";
import Stepper, { Step } from "../ReactBits/Stepper";
import GlassButton from "../ui/GlassButton";
import ModalShell from "../ui/ModalShell";
import { searchCheckpointFriends } from "../../services/checkpointFriends";
import { usePreferences, type LauncherLanguage, type SoundTheme, type VisualTheme } from "../../context/PreferencesContext";
import type { SoundEffectType } from "../../hooks/useSoundEffects";
import type { Game, UserProfile } from "../../types/domain";

type TranslationFn = ReturnType<typeof usePreferences>["t"];
type BrandIcon = React.ComponentType<{ className?: string; style?: React.CSSProperties }>;

export interface HomeSocialFriend {
  id: string;
  name: string;
  status: "online" | "playing" | "offline";
  playing?: string;
  avatar?: string;
  source?: "discord" | "discord_friend" | "local" | "checkpoint";
}

export interface HomeCheckpointFriendRequest {
  uid: string;
  displayName: string;
  photoURL?: string | null;
  createdAt?: string;
}

export interface HomePriceAlert {
  id: string;
  gameId: string;
  title: string;
  source: "Steam" | "Epic" | "Manual";
}

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
}> = ({ eyebrow, title, children }) => (
  <motion.div
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

const SettingsHeader: React.FC<{
  icon: React.ReactNode;
  title: string;
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
  EpicIcon,
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
      </SystemPageShell>
    );
  };

export const FriendsPage: React.FC<{
  t: TranslationFn;
  discordConnected: boolean;
  discordUsername?: string;
  discordAvatar?: string;
  DiscordIcon: BrandIcon;
  friends: HomeSocialFriend[];
  incomingRequests: HomeCheckpointFriendRequest[];
  currentPresenceGame?: string | null;
  onConnectDiscord: () => void;
  onRemoveFriend: (id: string) => void;
  onViewFriendProfile: (friend: HomeSocialFriend) => void;
  friendProfileLoadingId?: string | null;
  onAcceptRequest: (uid: string) => void;
  onRejectRequest: (uid: string) => void;
  onAddFriendClick: () => void;
}> = ({
  t,
  discordConnected,
  discordUsername,
  discordAvatar,
  DiscordIcon,
  friends,
  incomingRequests,
  currentPresenceGame,
  onConnectDiscord,
  onRemoveFriend,
  onViewFriendProfile,
  friendProfileLoadingId,
  onAcceptRequest,
  onRejectRequest,
  onAddFriendClick,
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
                    {discordConnected ? discordUsername || "Usuario" : "Usuario"}
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

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
                className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] p-4"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl bg-[var(--launcher-accent-soft)]">
                    {friend.avatar ? (
                      <img src={friend.avatar} alt="" className="h-full w-full object-cover" />
                    ) : friend.source === "discord_friend" ? (
                      <DiscordIcon className="h-4 w-4 text-white/70" />
                    ) : (
                      <Users className="h-4 w-4 text-white/70" />
                    )}
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
                  <button
                    type="button"
                    onClick={() => onViewFriendProfile(friend)}
                    disabled={friendProfileLoadingId === friend.id}
                    className="rounded-lg px-3 py-2 text-[10px] font-black uppercase text-white/60 hover:bg-white/10 hover:text-white disabled:opacity-40"
                  >
                    {friendProfileLoadingId === friend.id ? "Abrindo..." : "Perfil"}
                  </button>
                  {!friend.source?.startsWith("discord") && (
                    <button
                      type="button"
                      onClick={() => onRemoveFriend(friend.id)}
                      className="shrink-0 rounded-lg px-3 py-2 text-[10px] font-black uppercase text-red-300/70 hover:bg-red-500/10"
                    >
                      Remover
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

    const handleSearch = async (event: React.FormEvent) => {
      event.preventDefault();
      if (!search.trim()) return;

      playSound("search");
      setSearching(true);
      setResults([]);
      setSelectedIndex(0);

      try {
        const searchResults = await searchCheckpointFriends(search.trim());
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
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="relative w-full max-w-md overflow-hidden rounded-[28px] border border-white/10 bg-[#0A0A0C] p-6 shadow-2xl"
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
      </div>
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
          title={t("priceAlerts")}
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
