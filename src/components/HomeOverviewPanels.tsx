import { Clock3, Flame, Heart, PlayCircle, Users2 } from "lucide-react";
import type { TranslationKey } from "../context/PreferencesContext";
import type { Game } from "../types/domain";

interface FriendPresenceSnapshot {
  id: string;
  name: string;
  status: "online" | "playing" | "offline";
  playing?: string;
  avatar?: string;
}

interface ActivityItem {
  id: string;
  title: string;
  detail: string;
}

interface HomeOverviewPanelsProps {
  continuePlaying: Game[];
  favoriteGames: Game[];
  friendsPlaying: FriendPresenceSnapshot[];
  recentActivity: ActivityItem[];
  onOpenGame: (game: Game) => void;
  onOpenFriends: () => void;
  t: (key: TranslationKey) => string;
}

const formatTimeAgo = (date: string | undefined, t: (key: TranslationKey) => string) => {
  if (!date) return t("overviewNoRecord");
  const diffMs = Date.now() - new Date(date).getTime();
  const diffMinutes = Math.max(1, Math.floor(diffMs / 60000));

  if (diffMinutes < 60) return `${diffMinutes} min`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} h`;
  return `${Math.floor(diffHours / 24)} d`;
};

const platformLabel = (game: Game) => {
  if (game.launcherType === "steam") return "Steam";
  if (game.launcherType === "epic") return "Epic";
  return "Local";
};

const panelClassName =
  "rounded-[24px] border border-white/10 bg-black/35 backdrop-blur-3xl";

export function HomeOverviewPanels({
  continuePlaying,
  favoriteGames,
  friendsPlaying,
  recentActivity,
  onOpenGame,
  onOpenFriends,
  t,
}: HomeOverviewPanelsProps) {
  const primaryGame = continuePlaying[0];
  const topFavorites = favoriteGames.slice(0, 3);
  const topFriends = friendsPlaying.slice(0, 2);
  const topActivities = recentActivity.slice(0, 2);

  return (
    <div className="px-10 pb-3">
      <div className="grid grid-cols-1 gap-2.5 xl:grid-cols-[1.15fr_0.82fr_0.9fr]">
        <section className={`${panelClassName} p-3.5`}>
          <div className="mb-2.5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-white/70">
                <PlayCircle className="h-4 w-4" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.28em] text-white/30">
                  {t("overviewContinue")}
                </p>
                <p className="text-base font-black tracking-tight text-white">
                  {t("overviewResumeSession")}
                </p>
              </div>
            </div>
          </div>

          {primaryGame ? (
            <button
              type="button"
              onClick={() => onOpenGame(primaryGame)}
              className="flex w-full items-center gap-3 rounded-[20px] border border-white/10 bg-white/[0.04] p-2.5 text-left transition-all hover:border-white/20 hover:bg-white/[0.06]"
            >
              <div className="h-16 w-28 shrink-0 overflow-hidden rounded-xl bg-white/[0.03]">
                {(primaryGame.backgroundImage || primaryGame.cardImage || primaryGame.image) ? (
                  <img
                    src={primaryGame.backgroundImage || primaryGame.cardImage || primaryGame.image}
                    alt=""
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                ) : null}
              </div>
              <div className="min-w-0 flex-1">
                <div className="mb-1.5 flex items-center gap-2">
                  <span className="rounded-full border border-white/10 px-2 py-1 text-[9px] font-black uppercase tracking-widest text-white/45">
                    {platformLabel(primaryGame)}
                  </span>
                  <span className="text-[10px] font-black uppercase tracking-wider text-white/30">
                    {formatTimeAgo(primaryGame.lastPlayedAt || primaryGame.steamLastPlayedAt, t)}
                  </span>
                </div>
                <p className="truncate text-sm font-black text-white">{primaryGame.title}</p>
                <p className="mt-0.5 text-[11px] text-white/40">
                  {primaryGame.hoursPlayed || 0}{t("overviewHoursPlayed")}
                </p>
              </div>
            </button>
          ) : (
            <div className="rounded-[20px] border border-dashed border-white/10 bg-white/[0.03] px-4 py-5 text-center">
              <p className="text-sm font-bold text-white/60">{t("overviewNextReturn")}</p>
            </div>
          )}
        </section>

        <section className={`${panelClassName} p-3.5`}>
          <div className="mb-2.5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-white/70">
                <Users2 className="h-4 w-4" />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.28em] text-white/30">
                  {t("overviewFriends")}
                </p>
                <p className="text-base font-black tracking-tight text-white">
                  {t("overviewPlayingNow")}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onOpenFriends}
              className="rounded-full border border-white/10 px-2.5 py-1.5 text-[9px] font-black uppercase tracking-widest text-white/55 transition-all hover:border-white/20 hover:text-white"
            >
              {t("overviewSocial")}
            </button>
          </div>

          <div className="space-y-2">
            {topFriends.length > 0 ? (
              topFriends.map((friend) => (
                <div
                  key={friend.id}
                  className="flex items-center gap-3 rounded-[16px] border border-white/10 bg-white/[0.04] px-3 py-2"
                >
                  <div className="relative h-9 w-9 overflow-hidden rounded-xl bg-[var(--launcher-accent-soft)]">
                    {friend.avatar ? (
                      <img src={friend.avatar} alt="" className="h-full w-full object-cover" loading="lazy" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-white/60">
                        <Users2 className="h-4 w-4" />
                      </div>
                    )}
                    <span className="absolute bottom-1 right-1 h-2.5 w-2.5 rounded-full bg-emerald-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-black text-white">{friend.name}</p>
                    <p className="truncate text-[10px] uppercase tracking-widest text-white/35">
                      {friend.playing ? friend.playing : t("overviewOnline")}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-[16px] border border-dashed border-white/10 bg-white/[0.03] px-4 py-4 text-center">
                <p className="text-sm font-bold text-white/60">{t("overviewNobodyPlaying")}</p>
              </div>
            )}
          </div>
        </section>

        <section className={`${panelClassName} p-3.5`}>
          <div className="mb-2.5 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-white/70">
              <Flame className="h-4 w-4" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.28em] text-white/30">
                {t("overviewPulse")}
              </p>
              <p className="text-base font-black tracking-tight text-white">
                {t("overviewQuickSummary")}
              </p>
            </div>
          </div>

          <div className="mb-2.5 grid grid-cols-2 gap-2">
            <div className="rounded-[16px] border border-white/10 bg-white/[0.04] px-3 py-2.5">
              <div className="mb-1 flex items-center gap-2 text-white/40">
                <Heart className="h-3.5 w-3.5" />
                <span className="text-[9px] font-black uppercase tracking-widest">{t("overviewFavorites")}</span>
              </div>
              <p className="text-xl font-black text-white">{favoriteGames.length}</p>
            </div>
            <div className="rounded-[16px] border border-white/10 bg-white/[0.04] px-3 py-2.5">
              <div className="mb-1 flex items-center gap-2 text-white/40">
                <Clock3 className="h-3.5 w-3.5" />
                <span className="text-[9px] font-black uppercase tracking-widest">{t("overviewActivity")}</span>
              </div>
              <p className="text-xl font-black text-white">{recentActivity.length}</p>
            </div>
          </div>

          <div className="space-y-2">
            {topActivities.length > 0 ? (
              topActivities.map((item) => (
                <div
                  key={item.id}
                  className="rounded-[16px] border border-white/10 bg-white/[0.04] px-3 py-2"
                >
                  <p className="truncate text-[13px] font-bold text-white">{item.title}</p>
                  <p className="truncate text-[10px] text-white/40">{item.detail}</p>
                </div>
              ))
            ) : (
              <div className="rounded-[16px] border border-dashed border-white/10 bg-white/[0.03] px-4 py-4 text-center">
                <p className="text-sm font-bold text-white/60">{t("overviewNoRecentNews")}</p>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
