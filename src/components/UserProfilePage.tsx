import React, { useMemo } from "react";
import { motion } from "framer-motion";
import { Clock, Gamepad2, Star, Trophy, TrendingUp, User } from "lucide-react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faDiscord, faSteam } from "@fortawesome/free-brands-svg-icons";
import { EPIC_GAMES_ICON_PATH } from "../constants/assets";
import type { Game, UserProfile } from "../types/domain";

interface UserProfilePageProps {
  userProfile: UserProfile | null;
  user: { email?: string | null; photoURL?: string | null } | null;
  games: Game[];
}

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
  profile?.discordAvatar || profile?.steamAvatar || profile?.photoURL || firebasePhotoURL || "";

const initialsFor = (name: string) =>
  name
    .split(" ")
    .map((word) => word[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

const ProfileAvatar: React.FC<{
  profile: UserProfile | null;
  firebasePhotoURL?: string | null;
  displayName: string;
}> = ({ profile, firebasePhotoURL, displayName }) => {
  const src = avatarUrl(profile, firebasePhotoURL);
  return (
    <div className="relative h-[74px] w-[74px] shrink-0 overflow-hidden rounded-full border border-white/15 bg-white/[0.06]">
      {src ? (
        <img src={src} alt="" className="h-full w-full object-cover grayscale" />
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
}> = ({ name, connected, username, avatar, icon }) => (
  <div
    className={`flex items-center gap-3 rounded-2xl border p-3 ${
      connected ? "border-white/14 bg-white/[0.045]" : "border-white/8 bg-black/25"
    }`}
  >
    <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white/[0.07] text-white/75">
      {avatar ? <img src={avatar} alt="" className="h-full w-full object-cover grayscale" /> : icon}
    </div>
    <div className="min-w-0 flex-1">
      <p className="truncate text-xs font-black text-white">{name}</p>
      <p className="truncate text-[10px] text-white/40">
        {connected ? username || "Conectado" : "Nao conectado"}
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

const UserProfilePage: React.FC<UserProfilePageProps> = ({ userProfile, user, games }) => {
  const displayName = userProfile?.displayName || user?.email?.split("@")[0] || "Jogador";
  const email = userProfile?.email || user?.email || "";

  const stats = useMemo(() => {
    const totalHours = games.reduce((acc, game) => acc + (game.hoursPlayed || 0), 0);
    const totalAchievements = games.reduce((acc, game) => acc + (game.completedAchievements || 0), 0);
    const totalPossible = games.reduce((acc, game) => acc + (game.totalAchievements || 0), 0);
    const favorites = games.filter((game) => game.isFavorite).length;
    const steamGames = games.filter((game) => game.launcherType === "steam").length;
    const epicGames = games.filter((game) => game.launcherType === "epic").length;
    const localGames = games.filter((game) => !game.launcherType || game.launcherType === "local").length;
    return { totalHours, totalAchievements, totalPossible, favorites, steamGames, epicGames, localGames };
  }, [games]);

  const topGames = useMemo(
    () =>
      [...games]
        .filter((game) => (game.hoursPlayed || 0) > 0)
        .sort((a, b) => (b.hoursPlayed || 0) - (a.hoursPlayed || 0))
        .slice(0, 5),
    [games],
  );

  const favoriteGames = useMemo(() => games.filter((game) => game.isFavorite).slice(0, 6), [games]);
  const achievementPercent =
    stats.totalPossible > 0 ? Math.round((stats.totalAchievements / stats.totalPossible) * 100) : 0;
  const maxHours = Math.max(topGames[0]?.hoursPlayed || 1, 1);
  const libraryRows = [
    { label: "Steam", value: stats.steamGames },
    { label: "Epic Games", value: stats.epicGames },
    { label: "Local", value: stats.localGames },
  ];

  return (
    <motion.div
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
                  {userProfile?.steamId && (
                    <span className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/[0.06] px-2 py-1 text-[10px] font-black text-white">
                      <FontAwesomeIcon icon={faSteam} className="h-3 w-3" /> Steam
                    </span>
                  )}
                  {userProfile?.discordId && (
                    <span className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/[0.06] px-2 py-1 text-[10px] font-black text-white">
                      <FontAwesomeIcon icon={faDiscord} className="h-3 w-3" />
                      {userProfile.discordUsername || "Discord"}
                    </span>
                  )}
                </div>
                {email && <p className="mt-3 text-xs font-semibold text-white/28">{email}</p>}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <StatCard icon={<Gamepad2 className="h-4 w-4" />} label="Jogos" value={games.length} />
              <StatCard icon={<Clock className="h-4 w-4" />} label="Horas" value={`${stats.totalHours}h`} />
              <StatCard icon={<Star className="h-4 w-4" />} label="Favoritos" value={stats.favorites} />
            </div>
          </div>
        </section>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[285px_1fr]">
          <div className="space-y-5">
            <Section title="Plataformas">
              <div className="space-y-2">
                <PlatformCard
                  name="Steam"
                  connected={Boolean(userProfile?.steamId)}
                  avatar={userProfile?.steamAvatar}
                  username={userProfile?.steamUsername || userProfile?.steamId}
                  icon={<FontAwesomeIcon icon={faSteam} className="h-4 w-4" />}
                />
                <PlatformCard
                  name="Epic Games"
                  connected={stats.epicGames > 0}
                  username={stats.epicGames > 0 ? `${stats.epicGames} jogos catalogados` : "Catálogo e atalhos"}
                  icon={<EpicIcon className="h-5 w-5" />}
                />
                <PlatformCard
                  name="Discord"
                  connected={Boolean(userProfile?.discordId)}
                  avatar={userProfile?.discordAvatar}
                  username={userProfile?.discordUsername}
                  icon={<FontAwesomeIcon icon={faDiscord} className="h-4 w-4" />}
                />
              </div>
            </Section>

            <Section title="Conquistas">
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
                <Trophy className="h-3 w-3" /> {stats.totalAchievements} conquistas desbloqueadas
              </p>
            </Section>

            <Section title="Biblioteca">
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
                        animate={{ width: games.length > 0 ? `${(row.value / games.length) * 100}%` : "0%" }}
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
            <Section title="Mais jogados" icon={<TrendingUp className="h-4 w-4" />} className="min-h-[346px]">
              {topGames.length > 0 ? (
                <div className="space-y-4">
                  {topGames.map((game, index) => {
                    const pct = ((game.hoursPlayed || 0) / maxHours) * 100;
                    return (
                      <div key={game.id} className="grid grid-cols-[20px_42px_1fr_auto] items-center gap-3">
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
                          <Clock className="h-3 w-3" /> {game.hoursPlayed || 0}h
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <EmptyProfileState />
              )}
            </Section>

            <Section title="Favoritos" icon={<Star className="h-4 w-4" />}>
              {favoriteGames.length > 0 ? (
                <div className="flex gap-4 overflow-x-auto pb-1 no-scrollbar">
                  {favoriteGames.map((game) => (
                    <div key={game.id} className="w-[74px] shrink-0">
                      <div className="h-[90px] w-[74px] overflow-hidden rounded-xl bg-white/8">
                        {(game.cardImage || game.image) && (
                          <img src={game.cardImage || game.image} alt="" className="h-full w-full object-cover" />
                        )}
                      </div>
                      <p className="mt-2 truncate text-center text-[10px] text-white/45">{game.title}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="py-8 text-center text-sm font-bold text-white/35">Nenhum favorito ainda.</p>
              )}
            </Section>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

const EmptyProfileState: React.FC = () => (
  <div className="flex h-56 flex-col items-center justify-center text-center">
    <User className="mb-4 h-9 w-9 text-white/20" />
    <p className="text-sm font-black text-white/40">Perfil em construcao</p>
    <p className="mt-1 text-xs text-white/25">Jogue e favorite jogos para preencher esta area.</p>
  </div>
);

export default UserProfilePage;
