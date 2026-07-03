import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Clock,
  Trophy,
  Star,
  Gamepad2,
  Zap,
  Globe,
  MessageCircle,
  User,
  TrendingUp,
} from 'lucide-react';
import type { Game, UserProfile } from '../types/domain';

interface UserProfilePageProps {
  userProfile: UserProfile | null;
  user: { email?: string | null; photoURL?: string | null } | null;
  games: Game[];
}

/* ─── Avatar do usuário — prioridade: discord > steam > firebase > initials ─ */
const UserAvatar: React.FC<{
  profile: UserProfile | null;
  firebasePhotoURL?: string | null;
  size?: number;
  className?: string;
}> = ({ profile, firebasePhotoURL, size = 80, className = '' }) => {
  const src =
    profile?.discordAvatar ||
    profile?.steamAvatar ||
    firebasePhotoURL ||
    null;

  const initials = (profile?.displayName || 'U')
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  if (src) {
    return (
      <img
        src={src}
        alt="Avatar"
        className={`rounded-full object-cover ${className}`}
        style={{ width: size, height: size }}
        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
      />
    );
  }

  return (
    <div
      className={`rounded-full flex items-center justify-center font-black text-white/80 ${className}`}
      style={{
        width: size,
        height: size,
        background: 'linear-gradient(135deg, rgba(255,255,255,0.12), rgba(255,255,255,0.05))',
        border: '1px solid rgba(255,255,255,0.1)',
        fontSize: size * 0.35,
      }}
    >
      {initials}
    </div>
  );
};

/* ─── Card de plataforma conectada ─────────────────────────── */
const PlatformCard: React.FC<{
  name: string;
  connected: boolean;
  avatar?: string;
  username?: string;
  color: string;
  icon: React.ReactNode;
}> = ({ name, connected, avatar, username, color, icon }) => (
  <div
    className="flex items-center gap-3 p-3 rounded-2xl border"
    style={{
      background: connected ? `${color}08` : 'rgba(255,255,255,0.02)',
      borderColor: connected ? `${color}25` : 'rgba(255,255,255,0.06)',
    }}
  >
    <div
      className="w-10 h-10 rounded-xl flex items-center justify-center overflow-hidden flex-shrink-0"
      style={{ background: connected ? `${color}18` : 'rgba(255,255,255,0.06)' }}
    >
      {avatar ? (
        <img src={avatar} alt={name} className="w-full h-full object-cover" />
      ) : (
        <span style={{ color: connected ? color : 'rgba(255,255,255,0.3)' }}>{icon}</span>
      )}
    </div>
    <div className="min-w-0">
      <p className="text-xs font-black text-white">{name}</p>
      <p className="text-[10px] truncate" style={{ color: connected ? color : 'rgba(255,255,255,0.3)' }}>
        {connected ? (username || 'Conectado') : 'Não conectado'}
      </p>
    </div>
    <div
      className="w-2 h-2 rounded-full ml-auto flex-shrink-0"
      style={{ background: connected ? '#22c55e' : 'rgba(255,255,255,0.15)' }}
    />
  </div>
);

/* ─── Componente principal ─────────────────────────────────── */
const UserProfilePage: React.FC<UserProfilePageProps> = ({ userProfile, user, games }) => {
  const displayName = userProfile?.displayName || user?.email?.split('@')[0] || 'Jogador';

  /* Estatísticas */
  const stats = useMemo(() => {
    const totalHours = games.reduce((acc, g) => acc + (g.hoursPlayed || 0), 0);
    const totalAchievements = games.reduce((acc, g) => acc + (g.completedAchievements || 0), 0);
    const totalPossible = games.reduce((acc, g) => acc + (g.totalAchievements || 0), 0);
    const favorites = games.filter((g) => g.isFavorite).length;
    const steamGames = games.filter((g) => g.launcherType === 'steam').length;
    const epicGames = games.filter((g) => g.launcherType === 'epic').length;
    const localGames = games.filter((g) => !g.launcherType || g.launcherType === 'local').length;
    return { totalHours, totalAchievements, totalPossible, favorites, steamGames, epicGames, localGames };
  }, [games]);

  /* Jogos mais jogados */
  const topGames = useMemo(
    () =>
      [...games]
        .filter((g) => (g.hoursPlayed || 0) > 0)
        .sort((a, b) => (b.hoursPlayed || 0) - (a.hoursPlayed || 0))
        .slice(0, 5),
    [games],
  );

  /* Jogos favoritos */
  const favoriteGames = useMemo(
    () => games.filter((g) => g.isFavorite).slice(0, 5),
    [games],
  );

  /* Achievement progress */
  const achievementPercent =
    stats.totalPossible > 0
      ? Math.round((stats.totalAchievements / stats.totalPossible) * 100)
      : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 18, filter: 'blur(6px)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="flex-1 px-10 pb-14 pt-6 overflow-y-auto"
      style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.1) transparent' }}
    >
      <div className="max-w-4xl mx-auto space-y-5">

        {/* ── Header do perfil ── */}
        <div
          className="relative rounded-[28px] border border-white/10 overflow-hidden p-6"
          style={{ background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(32px)' }}
        >
          {/* background decorativo */}
          <div
            className="absolute inset-0 opacity-20 pointer-events-none"
            style={{
              background: 'radial-gradient(ellipse at 20% 50%, rgba(139,92,246,0.3) 0%, transparent 60%)',
            }}
          />

          <div className="relative flex items-center gap-6">
            {/* Avatar grande */}
            <div className="relative flex-shrink-0">
              <UserAvatar
                profile={userProfile}
                firebasePhotoURL={user?.photoURL}
                size={80}
                className="ring-2 ring-white/20"
              />
              {/* Status online */}
              <div
                className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center"
                style={{ borderColor: '#0a0a0f', background: '#22c55e' }}
              />
            </div>

            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-black text-white tracking-tight mb-1">{displayName}</h1>

              {/* Badges de plataformas conectadas */}
              <div className="flex items-center gap-2 flex-wrap">
                {userProfile?.steamId && (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold bg-green-500/15 border border-green-500/25 text-green-400">
                    <Zap className="w-2.5 h-2.5" /> Steam
                  </span>
                )}
                {userProfile?.epicAccountId && (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold bg-indigo-500/15 border border-indigo-500/25 text-indigo-400">
                    <Globe className="w-2.5 h-2.5" /> Epic
                  </span>
                )}
                {userProfile?.discordId && (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold bg-violet-500/15 border border-violet-500/25 text-violet-400">
                    <MessageCircle className="w-2.5 h-2.5" />
                    {userProfile.discordUsername || 'Discord'}
                  </span>
                )}
              </div>

              {user?.email && (
                <p className="text-[11px] text-white/30 mt-2">{user.email}</p>
              )}
            </div>

            {/* Stats rápidas no lado direito */}
            <div className="hidden md:grid grid-cols-3 gap-3 flex-shrink-0">
              {[
                { label: 'Jogos', value: games.length, icon: <Gamepad2 className="w-3.5 h-3.5" /> },
                { label: 'Horas', value: `${stats.totalHours}h`, icon: <Clock className="w-3.5 h-3.5" /> },
                { label: 'Favoritos', value: stats.favorites, icon: <Star className="w-3.5 h-3.5" /> },
              ].map(({ label, value, icon }) => (
                <div
                  key={label}
                  className="flex flex-col items-center gap-1 p-3 rounded-2xl border border-white/8"
                  style={{ background: 'rgba(255,255,255,0.04)' }}
                >
                  <span className="text-white/40">{icon}</span>
                  <span className="text-lg font-black text-white tabular-nums">{value}</span>
                  <span className="text-[9px] uppercase tracking-widest text-white/35">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Grid principal ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">

          {/* Coluna esquerda — plataformas + achievements */}
          <div className="space-y-4">

            {/* Plataformas */}
            <section
              className="rounded-[24px] border border-white/10 p-5"
              style={{ background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(32px)' }}
            >
              <p className="text-[10px] font-black uppercase tracking-widest text-white/35 mb-3">Plataformas</p>
              <div className="space-y-2">
                <PlatformCard
                  name="Steam"
                  connected={Boolean(userProfile?.steamId)}
                  avatar={userProfile?.steamAvatar}
                  username={userProfile?.steamUsername || userProfile?.steamId}
                  color="#67b676"
                  icon={<Zap className="w-4 h-4" />}
                />
                <PlatformCard
                  name="Epic Games"
                  connected={Boolean(userProfile?.epicAccountId)}
                  avatar={userProfile?.epicAvatar}
                  username={userProfile?.epicUsername || userProfile?.epicAccountId?.slice(0, 12) + '...'}
                  color="#818cf8"
                  icon={<Globe className="w-4 h-4" />}
                />
                <PlatformCard
                  name="Discord"
                  connected={Boolean(userProfile?.discordId)}
                  avatar={userProfile?.discordAvatar}
                  username={userProfile?.discordUsername}
                  color="#7c3aed"
                  icon={<MessageCircle className="w-4 h-4" />}
                />
              </div>
            </section>

            {/* Achievements */}
            <section
              className="rounded-[24px] border border-white/10 p-5"
              style={{ background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(32px)' }}
            >
              <p className="text-[10px] font-black uppercase tracking-widest text-white/35 mb-3">Conquistas</p>
              <div className="flex items-end justify-between mb-2">
                <div>
                  <span className="text-3xl font-black text-white">{stats.totalAchievements}</span>
                  <span className="text-sm text-white/35 ml-1">/ {stats.totalPossible}</span>
                </div>
                <span className="text-sm font-bold text-white/50">{achievementPercent}%</span>
              </div>
              <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${achievementPercent}%` }}
                  transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
                  className="h-full rounded-full"
                  style={{ background: 'linear-gradient(90deg, #f59e0b, #fbbf24)' }}
                />
              </div>
              <div className="flex items-center gap-1 mt-2">
                <Trophy className="w-3 h-3 text-amber-400/70" />
                <span className="text-[10px] text-white/35">{stats.totalAchievements} conquistas desbloqueadas</span>
              </div>
            </section>

            {/* Distribuição por plataforma */}
            <section
              className="rounded-[24px] border border-white/10 p-5"
              style={{ background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(32px)' }}
            >
              <p className="text-[10px] font-black uppercase tracking-widest text-white/35 mb-3">Biblioteca</p>
              <div className="space-y-2">
                {[
                  { label: 'Steam', count: stats.steamGames, color: '#67b676', total: games.length },
                  { label: 'Epic Games', count: stats.epicGames, color: '#818cf8', total: games.length },
                  { label: 'Local', count: stats.localGames, color: 'rgba(255,255,255,0.4)', total: games.length },
                ].map(({ label, count, color, total }) => (
                  <div key={label}>
                    <div className="flex justify-between mb-1">
                      <span className="text-[10px] text-white/50">{label}</span>
                      <span className="text-[10px] font-bold text-white/50">{count}</span>
                    </div>
                    <div className="h-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.06)' }}>
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: total > 0 ? `${(count / total) * 100}%` : '0%' }}
                        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: 0.3 }}
                        className="h-full rounded-full"
                        style={{ background: color }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>

          {/* Coluna central/direita — jogos mais jogados */}
          <div className="md:col-span-2 space-y-4">

            {/* Jogos mais jogados */}
            {topGames.length > 0 && (
              <section
                className="rounded-[24px] border border-white/10 p-5"
                style={{ background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(32px)' }}
              >
                <div className="flex items-center gap-2 mb-4">
                  <TrendingUp className="w-4 h-4 text-white/40" />
                  <p className="text-[10px] font-black uppercase tracking-widest text-white/35">Mais jogados</p>
                </div>
                <div className="space-y-2">
                  {topGames.map((game, i) => {
                    const maxHours = topGames[0].hoursPlayed || 1;
                    const pct = ((game.hoursPlayed || 0) / maxHours) * 100;
                    return (
                      <div key={game.id} className="flex items-center gap-3">
                        {/* Rank */}
                        <span className="text-[11px] font-black text-white/25 w-4 text-right flex-shrink-0">
                          {i + 1}
                        </span>
                        {/* Capa mini */}
                        <div className="w-9 h-12 rounded-lg overflow-hidden flex-shrink-0 bg-white/5">
                          {(game.cardImage || game.image) && (
                            <img
                              src={game.cardImage || game.image}
                              alt={game.title}
                              className="w-full h-full object-cover"
                            />
                          )}
                        </div>
                        {/* Info + barra */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <p className="text-xs font-bold text-white truncate">{game.title}</p>
                            <span className="text-[10px] text-white/40 flex-shrink-0 ml-2 flex items-center gap-0.5">
                              <Clock className="w-2.5 h-2.5" />
                              {game.hoursPlayed}h
                            </span>
                          </div>
                          <div className="h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.07)' }}>
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${pct}%` }}
                              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: 0.1 * i }}
                              className="h-full rounded-full"
                              style={{
                                background: i === 0
                                  ? 'linear-gradient(90deg, #f59e0b, #fbbf24)'
                                  : 'rgba(255,255,255,0.3)',
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Favoritos */}
            {favoriteGames.length > 0 && (
              <section
                className="rounded-[24px] border border-white/10 p-5"
                style={{ background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(32px)' }}
              >
                <div className="flex items-center gap-2 mb-4">
                  <Star className="w-4 h-4 text-amber-400/70" />
                  <p className="text-[10px] font-black uppercase tracking-widest text-white/35">Favoritos</p>
                </div>
                <div className="flex gap-3 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
                  {favoriteGames.map((game) => (
                    <div key={game.id} className="flex-shrink-0">
                      <div className="w-16 h-22 rounded-xl overflow-hidden mb-1 bg-white/5">
                        {(game.cardImage || game.image) && (
                          <img
                            src={game.cardImage || game.image}
                            alt={game.title}
                            className="w-full h-full object-cover"
                            style={{ height: '88px' }}
                          />
                        )}
                      </div>
                      <p className="text-[9px] text-white/50 text-center truncate w-16">{game.title}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Estado vazio */}
            {topGames.length === 0 && favoriteGames.length === 0 && (
              <section
                className="rounded-[24px] border border-white/8 p-10 text-center"
                style={{ background: 'rgba(0,0,0,0.25)' }}
              >
                <User className="w-10 h-10 mx-auto mb-4 text-white/20" />
                <p className="text-sm font-bold text-white/40">Perfil em construção</p>
                <p className="text-xs text-white/25 mt-1">
                  Adicione e jogue jogos para ver suas estatísticas aqui.
                </p>
              </section>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default UserProfilePage;
