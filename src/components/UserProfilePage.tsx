import React, { useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Clock, ExternalLink, Gamepad2, Pencil, Star, Trophy, TrendingUp, User } from "lucide-react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faDiscord, faSteam } from "@fortawesome/free-brands-svg-icons";
import { EPIC_GAMES_ICON_PATH } from "../constants/assets";
import type { LauncherLanguage } from "../context/PreferencesContext";
import type { Game, UserProfile } from "../types/domain";
import { useGamepadNavigation } from "../hooks/useGamepadNavigation";
import { calculateAchievementTotals } from "../utils/achievementTotals";
import {
  calculateTotalPlayedMinutes,
  formatPlayedHours,
  getGamePlayedHours,
} from "../utils/playtime";
import ProfileEditorModal from "./ProfileEditorModal";

interface UserProfilePageProps {
  userProfile: UserProfile | null;
  user: { email?: string | null; photoURL?: string | null } | null;
  games: Game[];
  onOpenGame?: (game: Game) => void;
  onProfileUpdated?: () => Promise<void> | void;
  editable?: boolean;
  playSound?: (sound: string) => void;
  language?: LauncherLanguage;
  copyFriendDiscord?: boolean;
  onNotify?: (message: string, type?: "success" | "error" | "info") => void;
}

type LegacyGameFields = {
  minutesPlayed?: number;
  imageUrl?: string;
};

type LegacyLibrarySummaryFields = {
  steamGameCount?: number;
  epicGameCount?: number;
  localGameCount?: number;
};

const profileCopy = {
  "pt-BR": {
    connected: "Conectado", disconnected: "Não conectado", player: "Jogador",
    edit: "Editar perfil", games: "Jogos", hours: "Horas", favorites: "Favoritos",
    platforms: "Plataformas", achievements: "Conquistas", library: "Biblioteca",
    mostPlayed: "Mais jogados", unlocked: "conquistas desbloqueadas",
    catalogued: "jogos catalogados", catalog: "Catálogo e atalhos",
    noFavorites: "Nenhum favorito ainda.", emptyTitle: "Perfil em construção",
    emptyBody: "Jogue e favorite jogos para preencher esta área.", copiedNickname: "Nickname do Discord copiado.", copiedId: "ID do Discord copiado.", copyError: "Não foi possível copiar o Discord.",
  },
  "en-US": {
    connected: "Connected", disconnected: "Not connected", player: "Player",
    edit: "Edit profile", games: "Games", hours: "Hours", favorites: "Favorites",
    platforms: "Platforms", achievements: "Achievements", library: "Library",
    mostPlayed: "Most played", unlocked: "achievements unlocked",
    catalogued: "games catalogued", catalog: "Catalog and shortcuts",
    noFavorites: "No favorites yet.", emptyTitle: "Profile under construction",
    emptyBody: "Play and favorite games to fill this area.", copiedNickname: "Discord nickname copied.", copiedId: "Discord ID copied.", copyError: "Could not copy Discord.",
  },
  "es-ES": {
    connected: "Conectado", disconnected: "No conectado", player: "Jugador",
    edit: "Editar perfil", games: "Juegos", hours: "Horas", favorites: "Favoritos",
    platforms: "Plataformas", achievements: "Logros", library: "Biblioteca",
    mostPlayed: "Más jugados", unlocked: "logros desbloqueados",
    catalogued: "juegos catalogados", catalog: "Catálogo y accesos directos",
    noFavorites: "Aún no hay favoritos.", emptyTitle: "Perfil en construcción",
    emptyBody: "Juega y marca juegos como favoritos para completar esta área.", copiedNickname: "Nickname de Discord copiado.", copiedId: "ID de Discord copiado.", copyError: "No se pudo copiar Discord.",
  },
  "fr-FR": {
    connected: "Connecté", disconnected: "Non connecté", player: "Joueur",
    edit: "Modifier le profil", games: "Jeux", hours: "Heures", favorites: "Favoris",
    platforms: "Plateformes", achievements: "Succès", library: "Bibliothèque",
    mostPlayed: "Les plus joués", unlocked: "succès débloqués",
    catalogued: "jeux catalogués", catalog: "Catalogue et raccourcis",
    noFavorites: "Aucun favori.", emptyTitle: "Profil en construction",
    emptyBody: "Jouez et ajoutez des jeux aux favoris pour remplir cette zone.", copiedNickname: "Pseudo Discord copié.", copiedId: "ID Discord copié.", copyError: "Impossible de copier Discord.",
  },
  "de-DE": {
    connected: "Verbunden", disconnected: "Nicht verbunden", player: "Spieler",
    edit: "Profil bearbeiten", games: "Spiele", hours: "Stunden", favorites: "Favoriten",
    platforms: "Plattformen", achievements: "Erfolge", library: "Bibliothek",
    mostPlayed: "Meistgespielt", unlocked: "Erfolge freigeschaltet",
    catalogued: "Spiele katalogisiert", catalog: "Katalog und Verknüpfungen",
    noFavorites: "Noch keine Favoriten.", emptyTitle: "Profil im Aufbau",
    emptyBody: "Spiele und markiere Favoriten, um diesen Bereich zu füllen.", copiedNickname: "Discord-Name kopiert.", copiedId: "Discord-ID kopiert.", copyError: "Discord konnte nicht kopiert werden.",
  },
  "it-IT": {
    connected: "Connesso", disconnected: "Non connesso", player: "Giocatore",
    edit: "Modifica profilo", games: "Giochi", hours: "Ore", favorites: "Preferiti",
    platforms: "Piattaforme", achievements: "Obiettivi", library: "Libreria",
    mostPlayed: "Più giocati", unlocked: "obiettivi sbloccati",
    catalogued: "giochi catalogati", catalog: "Catalogo e collegamenti",
    noFavorites: "Nessun preferito.", emptyTitle: "Profilo in costruzione",
    emptyBody: "Gioca e aggiungi giochi ai preferiti per riempire questa area.", copiedNickname: "Nickname Discord copiato.", copiedId: "ID Discord copiato.", copyError: "Impossibile copiare Discord.",
  },
} as const;

const EpicIcon: React.FC<{ className?: string }> = ({ className }) => (
  <img
    width={96}
    height={96}
    src={EPIC_GAMES_ICON_PATH}
    alt="Epic Games"
    className={className}
    style={{ filter: "invert(1)" }}
  />
);

const avatarUrl = (profile: UserProfile | null, firebasePhotoURL?: string | null) =>
  profile?.photoURL || firebasePhotoURL || profile?.discordAvatar || profile?.steamAvatar || "";

const initialsFor = (name: string) =>
  name
    .split(" ")
    .map((word) => word[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

const openExternalProfile = async (url: string) => {
  if (window.electronAPI?.openExternalUrl) {
    await window.electronAPI.openExternalUrl(url);
    return;
  }
  window.open(url, "_blank", "noopener,noreferrer");
};

const copyToClipboard = async (value: string) => {
  if (window.electronAPI?.copyToClipboard) {
    try {
      const result = await window.electronAPI.copyToClipboard(value);
      if (result?.ok !== false) return;
    } catch {
      // Builds antigos ou um preload ainda em memória podem não expor o IPC.
      // Nesse caso, continuamos com os fallbacks do Chromium abaixo.
    }
  }
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value);
      return;
    } catch {
      // O Electron pode bloquear navigator.clipboard dependendo do foco/permissão.
    }
  }
  const input = document.createElement("textarea");
  input.value = value;
  input.style.position = "fixed";
  input.style.opacity = "0";
  document.body.appendChild(input);
  input.select();
  const copied = typeof document.execCommand === "function" && document.execCommand("copy");
  input.remove();
  if (!copied) throw new Error("Clipboard unavailable");
};

const ProfileAvatar: React.FC<{
  profile: UserProfile | null;
  firebasePhotoURL?: string | null;
  displayName: string;
}> = ({ profile, firebasePhotoURL, displayName }) => {
  const src = avatarUrl(profile, firebasePhotoURL);
  return (
    <div className="relative h-[74px] w-[74px] shrink-0 overflow-hidden rounded-full border border-white/15 bg-white/[0.06]">
      {src ? (
        <img src={src} alt="" className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-xl font-black text-white/70">
          {initialsFor(displayName)}
        </div>
      )}
    </div>
  );
};

const PlatformCard: React.FC<{
  name: string;
  connected: boolean;
  username?: string;
  avatar?: string;
  icon: React.ReactNode;
  connectedLabel: string;
  disconnectedLabel: string;
}> = ({ name, connected, username, avatar, icon, connectedLabel, disconnectedLabel }) => (
  <div
    className={`flex items-center gap-3 rounded-2xl border p-3 ${connected ? "border-white/14 bg-white/[0.045]" : "border-white/8 bg-black/25"
      }`}
  >
    <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white/[0.07] text-white/75">
      {avatar ? <img src={avatar} alt="" className="h-full w-full object-cover" /> : icon}
    </div>
    <div className="min-w-0 flex-1">
      <p className="truncate text-xs font-black text-white">{name}</p>
      <p className="truncate text-[10px] text-white/40">
        {connected ? username || connectedLabel : disconnectedLabel}
      </p>
    </div>
    <span className={`h-2 w-2 shrink-0 rounded-full ${connected ? "bg-white" : "bg-white/15"}`} />
  </div>
);

const StatCard: React.FC<{ icon: React.ReactNode; label: string; value: React.ReactNode }> = ({
  icon,
  label,
  value,
}) => (
  <div className="flex min-h-[90px] flex-col items-center justify-center rounded-2xl border border-white/10 bg-white/[0.045] px-5">
    <div className="mb-2 text-white/36">{icon}</div>
    <div className="text-xl font-black text-white tabular-nums">{value}</div>
    <div className="mt-1 text-[9px] font-black uppercase tracking-widest text-white/32">{label}</div>
  </div>
);

const Section: React.FC<{ title: string; icon?: React.ReactNode; children: React.ReactNode; className?: string }> = ({
  title,
  icon,
  children,
  className = "",
}) => (
  <section className={`rounded-[26px] border border-white/10 bg-black/55 p-5 shadow-[0_20px_70px_rgba(0,0,0,0.45)] ${className}`}>
    <div className="mb-4 flex items-center gap-2">
      {icon && <span className="text-white/40">{icon}</span>}
      <p className="text-[10px] font-black uppercase tracking-[0.22em] text-white/35">{title}</p>
    </div>
    {children}
  </section>
);

const UserProfilePage: React.FC<UserProfilePageProps> = ({
  userProfile,
  user,
  games,
  onOpenGame,
  onProfileUpdated,
  editable = true,
  playSound,
  language = "pt-BR",
  copyFriendDiscord = false,
  onNotify,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isEditing, setIsEditing] = useState(false);
  useGamepadNavigation({
    scrollRef: scrollRef as React.RefObject<HTMLElement>,
    scrollSpeed: 25,
    disableX: true,
    disableO: true,
  });
  const copy = profileCopy[language];
  const displayName = userProfile?.displayName || user?.email?.split("@")[0] || copy.player;
  const email = userProfile?.email || user?.email || "";

  const normalizedGames = useMemo(() => {
    return (games || []).map((game) => {
      const legacyGame = game as Game & LegacyGameFields;
      const minutes = Math.max(
        0,
        Number(legacyGame.minutesPlayed) || 0,
        Number(game.steamPlaytimeMinutes) || 0,
        Number(game.locallyTrackedMinutes) || 0,
        Math.round((Number(game.hoursPlayed) || 0) * 60),
      );
      return {
        ...game,
        hoursPlayed: minutes / 60,
        isFavorite: Boolean(game.isFavorite),
        cardImage: game.cardImage || legacyGame.imageUrl || game.image,
        image: game.image || legacyGame.imageUrl || game.cardImage,
      } as Game;
    });
  }, [games]);

  const stats = useMemo(() => {
    const totalMinutes = userProfile?.librarySummary
      ? Math.max(0, Math.round(Number(userProfile.librarySummary.minutesPlayed) || 0))
      : calculateTotalPlayedMinutes(normalizedGames);
    const totalHours = totalMinutes / 60;
    const achievementTotals = calculateAchievementTotals(normalizedGames);
    const storedAchievementSummary = userProfile?.achievementSummary;
    const hasCanonicalSummary = Boolean(
      storedAchievementSummary?.updatedAt
      || storedAchievementSummary?.available != null
      || storedAchievementSummary?.unlocked != null
    );
    const totalAchievements = hasCanonicalSummary
      ? Number(storedAchievementSummary?.unlocked || 0)
      : achievementTotals.unlocked;
    const totalPossible = hasCanonicalSummary
      ? Math.max(Number(storedAchievementSummary?.available ?? 0), totalAchievements)
      : achievementTotals.available;
    const legacyLibrarySummary = userProfile?.librarySummary as
      | (UserProfile["librarySummary"] & LegacyLibrarySummaryFields)
      | undefined;
    const favorites = userProfile?.librarySummary?.favorites
      ?? normalizedGames.filter((game) => game.isFavorite).length;
    const steamGames = userProfile?.librarySummary?.steamGames
      ?? legacyLibrarySummary?.steamGameCount
      ?? normalizedGames.filter((game) => game.launcherType === "steam").length;
    const epicGames = userProfile?.librarySummary?.epicGames
      ?? legacyLibrarySummary?.epicGameCount
      ?? normalizedGames.filter((game) => game.launcherType === "epic").length;
    const localGames = userProfile?.librarySummary?.localGames
      ?? legacyLibrarySummary?.localGameCount
      ?? normalizedGames.filter((game) => !game.launcherType || game.launcherType === "local").length;
    const totalGames = userProfile?.librarySummary?.games ?? normalizedGames.length;
    return { totalGames, totalHours, totalAchievements, totalPossible, favorites, steamGames, epicGames, localGames };
  }, [normalizedGames, userProfile]);

  const topGames = useMemo(
    () =>
      [...normalizedGames]
        .filter((game) => getGamePlayedHours(game) > 0)
        .sort((a, b) => getGamePlayedHours(b) - getGamePlayedHours(a))
        .slice(0, 5),
    [normalizedGames],
  );

  const favoriteGames = useMemo(
    () => normalizedGames.filter((game) => game.isFavorite).slice(0, 6),
    [normalizedGames],
  );

  const achievementPercent =
    stats.totalPossible > 0 ? Math.round((stats.totalAchievements / stats.totalPossible) * 100) : 0;
  const maxHours = Math.max(topGames[0] ? getGamePlayedHours(topGames[0]) : 1, 1);
  const libraryRows = [
    { label: "Steam", value: stats.steamGames },
    { label: "Epic Games", value: stats.epicGames },
    { label: "Local", value: stats.localGames },
  ];
  const steamId = String(userProfile?.steamId || "").trim();
  const discordId = String(userProfile?.discordId || "").trim();
  const hasSteamProfile = /^\d{10,20}$/.test(steamId);
  const hasDiscordProfile = /^\d{10,24}$/.test(discordId);
  const discordDisplayName = String(userProfile?.discordUsername || discordId).trim();

  return (
    <motion.div
      ref={scrollRef}
      data-system-page
      initial={{ opacity: 0, y: 18, filter: "blur(6px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className="relative flex-1 overflow-y-auto px-8 pb-12 pt-6 thin-scrollbar"
    >
      <div
        className="pointer-events-none fixed inset-0 opacity-35"
        style={{
          backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.32) 1.4px, transparent 1.4px)",
          backgroundSize: "18px 18px",
          maskImage: "linear-gradient(120deg, black, transparent 75%)",
        }}
      />
      <div className="relative mx-auto max-w-6xl space-y-5">
        <section className="rounded-[28px] border border-white/10 bg-black/70 p-6 shadow-[0_24px_90px_rgba(0,0,0,0.55)]">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="flex min-w-0 items-center gap-5">
              <ProfileAvatar profile={userProfile} firebasePhotoURL={user?.photoURL} displayName={displayName} />
              <div className="min-w-0">
                <h1 className="truncate text-3xl font-black tracking-tight text-white">{displayName}</h1>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {hasSteamProfile && (
                    <button
                      type="button"
                      onClick={() => void openExternalProfile(`https://steamcommunity.com/profiles/${steamId}`)}
                      className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-white/15 bg-white/[0.06] px-2 py-1 text-[10px] font-black text-white transition-colors hover:bg-white/10"
                    >
                      <FontAwesomeIcon icon={faSteam} className="h-3 w-3" />
                      {userProfile?.steamUsername || "Steam"}
                    </button>
                  )}
                  {hasDiscordProfile && (
                    <button
                      type="button"
                      onClick={() => {
                        if (!copyFriendDiscord) {
                          void openExternalProfile(`https://discord.com/users/${discordId}`);
                          return;
                        }
                        void copyToClipboard(discordDisplayName).then(() => {
                          onNotify?.(
                            userProfile?.discordUsername ? copy.copiedNickname : copy.copiedId,
                            "success",
                          );
                        }).catch(() => onNotify?.(copy.copyError, "error"));
                      }}
                      className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-white/15 bg-white/[0.06] px-2 py-1 text-[10px] font-black text-white transition-colors hover:bg-white/10"
                    >
                      <FontAwesomeIcon icon={faDiscord} className="h-3 w-3" />
                      {discordDisplayName}
                    </button>
                  )}
                </div>
                {userProfile?.bio && <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/55">{userProfile.bio}</p>}
                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-semibold text-white/28">
                  {email && <span>{email}</span>}
                  {userProfile?.website && /^https:\/\//i.test(userProfile.website) && (
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 hover:text-white/65"
                      onClick={() => window.electronAPI?.openExternalUrl(userProfile.website as string)}
                    >
                      <ExternalLink className="h-3.5 w-3.5" /> Site
                    </button>
                  )}
                </div>
                {Boolean(userProfile?.favoriteGenres?.length) && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {userProfile?.favoriteGenres?.map((genre) => (
                      <span key={genre} className="rounded-lg border border-white/10 bg-white/[0.05] px-2 py-1 text-[9px] font-black uppercase tracking-wider text-white/40">
                        {genre}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col items-end gap-3">
              {editable && (
                <button
                  type="button"
                  onClick={() => {
                    setIsEditing(true);
                    playSound?.("showModal");
                  }}
                  className="inline-flex items-center gap-2 rounded-xl border border-white/12 bg-white/[0.06] px-3 py-2 text-xs font-black text-white/65 transition hover:bg-white/12 hover:text-white"
                >
                  <Pencil className="h-3.5 w-3.5" /> {copy.edit}
                </button>
              )}
              <div className="grid grid-cols-3 gap-3">
                <StatCard icon={<Gamepad2 className="h-4 w-4" />} label={copy.games} value={stats.totalGames} />
                <StatCard icon={<Clock className="h-4 w-4" />} label={copy.hours} value={`${formatPlayedHours(stats.totalHours)}h`} />
                <StatCard icon={<Star className="h-4 w-4" />} label={copy.favorites} value={stats.favorites} />
              </div>
            </div>
          </div>
        </section>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[285px_1fr]">
          <div className="space-y-5">
            <Section title={copy.platforms}>
              <div className="space-y-2">
                <PlatformCard
                  name="Steam"
                  connected={Boolean(userProfile?.steamId)}
                  avatar={userProfile?.steamAvatar}
                  username={userProfile?.steamUsername || userProfile?.steamId}
                  icon={<FontAwesomeIcon icon={faSteam} className="h-4 w-4" />}
                  connectedLabel={copy.connected}
                  disconnectedLabel={copy.disconnected}
                />
                <PlatformCard
                  name="Epic Games"
                  connected={stats.epicGames > 0}
                  username={stats.epicGames > 0 ? `${stats.epicGames} ${copy.catalogued}` : copy.catalog}
                  icon={<EpicIcon className="h-5 w-5" />}
                  connectedLabel={copy.connected}
                  disconnectedLabel={copy.disconnected}
                />
                <PlatformCard
                  name="Discord"
                  connected={Boolean(userProfile?.discordId)}
                  avatar={userProfile?.discordAvatar}
                  username={userProfile?.discordUsername}
                  icon={<FontAwesomeIcon icon={faDiscord} className="h-4 w-4" />}
                  connectedLabel={copy.connected}
                  disconnectedLabel={copy.disconnected}
                />
              </div>
            </Section>

            <Section title={copy.achievements}>
              <div className="mb-3 flex items-end justify-between">
                <div>
                  <span className="text-4xl font-black text-white">{stats.totalAchievements}</span>
                  <span className="ml-1 text-sm font-bold text-white/35">/ {stats.totalPossible}</span>
                </div>
                <span className="text-sm font-black text-white/45">{achievementPercent}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-white/8">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${achievementPercent}%` }}
                  transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                  className="h-full rounded-full bg-white"
                />
              </div>
              <p className="mt-3 flex items-center gap-1.5 text-[10px] text-white/35">
                <Trophy className="h-3 w-3" /> {stats.totalAchievements} {copy.unlocked}
              </p>
            </Section>

            <Section title={copy.library}>
              <div className="space-y-3">
                {libraryRows.map((row) => (
                  <div key={row.label}>
                    <div className="mb-1 flex items-center justify-between text-[10px] font-bold text-white/45">
                      <span>{row.label}</span>
                      <span>{row.value}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-white/8">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: stats.totalGames > 0 ? `${(row.value / stats.totalGames) * 100}%` : "0%" }}
                        transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
                        className="h-full rounded-full bg-white"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          </div>

          <div className="space-y-5">
            <Section title={copy.mostPlayed} icon={<TrendingUp className="h-4 w-4" />} className="min-h-[346px]">
              {topGames.length > 0 ? (
                <div className="space-y-4">
                  {topGames.map((game, index) => {
                    const playedHours = getGamePlayedHours(game);
                    const pct = (playedHours / maxHours) * 100;
                    return (
                      <button
                        key={game.id}
                        type="button"
                        onClick={() => onOpenGame?.(game)}
                        disabled={!onOpenGame}
                        className="grid w-full grid-cols-[20px_42px_1fr_auto] items-center gap-3 rounded-xl p-2 text-left transition-colors hover:bg-white/[0.06] disabled:cursor-default disabled:hover:bg-transparent"
                      >
                        <span className="text-right text-xs font-black text-white/25">{index + 1}</span>
                        <div className="h-12 w-9 overflow-hidden rounded-lg bg-white/8">
                          {(game.cardImage || game.image) && (
                            <img src={game.cardImage || game.image} alt="" className="h-full w-full object-cover" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-black text-white">{game.title}</p>
                          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${pct}%` }}
                              transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1], delay: index * 0.05 }}
                              className="h-full rounded-full bg-white"
                            />
                          </div>
                        </div>
                        <span className="flex items-center gap-1 text-[10px] font-semibold text-white/35">
                          <Clock className="h-3 w-3" /> {formatPlayedHours(playedHours)}h
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <EmptyProfileState title={copy.emptyTitle} body={copy.emptyBody} />
              )}
            </Section>

            <Section title={copy.favorites} icon={<Star className="h-4 w-4" />}>
              {favoriteGames.length > 0 ? (
                <div className="flex gap-4 overflow-x-auto pb-1 no-scrollbar">
                  {favoriteGames.map((game) => (
                    <button
                      key={game.id}
                      type="button"
                      onClick={() => onOpenGame?.(game)}
                      disabled={!onOpenGame}
                      className="w-[82px] shrink-0 rounded-2xl p-1 text-left transition-colors hover:bg-white/[0.07] disabled:cursor-default disabled:hover:bg-transparent"
                    >
                      <div className="h-[90px] w-[74px] overflow-hidden rounded-xl bg-white/8">
                        {(game.cardImage || game.image) && (
                          <img src={game.cardImage || game.image} alt="" className="h-full w-full object-cover" />
                        )}
                      </div>
                      <p className="mt-2 truncate text-center text-[10px] text-white/45">{game.title}</p>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="py-8 text-center text-sm font-bold text-white/35">{copy.noFavorites}</p>
              )}
            </Section>
          </div>
        </div>
      </div>
      <ProfileEditorModal
        isOpen={isEditing}
        profile={userProfile}
        fallbackName={displayName}
        fallbackPhotoURL={user?.photoURL}
        onClose={() => {
          setIsEditing(false);
          playSound?.("back");
        }}
        onSaved={onProfileUpdated}
      />
    </motion.div>
  );
};

const EmptyProfileState: React.FC<{ title: string; body: string }> = ({ title, body }) => (
  <div className="flex h-56 flex-col items-center justify-center text-center">
    <User className="mb-4 h-9 w-9 text-white/20" />
    <p className="text-sm font-black text-white/40">{title}</p>
    <p className="mt-1 text-xs text-white/25">{body}</p>
  </div>
);

export default UserProfilePage;
