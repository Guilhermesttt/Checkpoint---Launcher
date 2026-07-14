import { useMemo } from "react";
import type { Game, SocialFriend } from "../types/domain";
import { CATEGORIES } from "../components/Sidebar";
import type { usePreferences } from "../context/PreferencesContext";

export const normalizeCategory = (v?: string) =>
  v?.toUpperCase().replace(/[^A-Z0-9]/g, "") ?? "";

export function useGameLibraryView({
  games,
  activeCategory,
  searchTerm,
  socialFriends,
  t,
}: {
  games: Game[];
  activeCategory: string;
  searchTerm: string;
  socialFriends: SocialFriend[];
  t: ReturnType<typeof usePreferences>["t"];
}) {
  const displayGames = useMemo(() => {
    const s = searchTerm.trim().toLowerCase();
    const ordered = [...games].sort((a, b) => {
      if (Boolean(a.isFavorite) === Boolean(b.isFavorite)) return 0;
      return a.isFavorite ? -1 : 1;
    });

    const categoryConfig = CATEGORIES.find((c) => c.id === activeCategory);
    const categoryLabel = categoryConfig?.label;

    const filtered =
      activeCategory === "ALL"
        ? ordered
        : activeCategory === "FAVORITES"
          ? ordered.filter((g) => g.isFavorite)
          : activeCategory === "STEAM"
            ? ordered.filter((g) => g.launcherType === "steam")
            : activeCategory === "LOCAL"
              ? ordered.filter(
                (g) => g.launcherType === "local" || !g.launcherType,
              )
              : activeCategory === "EPIC"
                ? ordered.filter((g) => g.launcherType === "epic")
                : ordered.filter((g) => {
                  const gCat = normalizeCategory(g.category);
                  return (
                    gCat === normalizeCategory(activeCategory) ||
                    gCat === normalizeCategory(categoryLabel)
                  );
                });
    return s
      ? filtered.filter(
        (g) =>
          g.title.toLowerCase().includes(s) ||
          (g.category ?? "").toLowerCase().includes(s),
      )
      : filtered;
  }, [activeCategory, games, searchTerm]);

  const continuePlayingGames = useMemo(
    () =>
      [...games]
        .filter((game) => Boolean(game.lastPlayedAt || game.steamLastPlayedAt || game.hoursPlayed))
        .sort((a, b) => {
          const aPlayed = new Date(a.lastPlayedAt || a.steamLastPlayedAt || 0).getTime();
          const bPlayed = new Date(b.lastPlayedAt || b.steamLastPlayedAt || 0).getTime();
          if (aPlayed !== bPlayed) return bPlayed - aPlayed;
          return (b.hoursPlayed || 0) - (a.hoursPlayed || 0);
        })
        .slice(0, 3),
    [games],
  );

  const favoriteShowcaseGames = useMemo(
    () =>
      [...games]
        .filter((game) => game.isFavorite)
        .sort((a, b) => (b.hoursPlayed || 0) - (a.hoursPlayed || 0))
        .slice(0, 4),
    [games],
  );

  const friendsPlayingNow = useMemo(
    () => socialFriends.filter((friend) => friend.status === "playing").slice(0, 4),
    [socialFriends],
  );

  const recentOverviewActivity = useMemo(() => {
    const items: Array<{ id: string; title: string; detail: string; tone: "accent" | "success" | "muted" }> = [];

    friendsPlayingNow.forEach((friend) => {
      items.push({
        id: `friend-${friend.id}`,
        title: `${friend.name} ${t("activityFriendPlaying")}`,
        detail: friend.playing
          ? `${t("activityFriendPlayingDetail")} ${friend.playing}.`
          : t("activityFriendOnlineDetail"),
        tone: "success",
      });
    });

    continuePlayingGames.forEach((game) => {
      items.push({
        id: `game-${game.id}`,
        title: `${t("activityReturnedTo")} ${game.title}`,
        detail: `${game.hoursPlayed || 0}${t("activityLibraryHours")}`,
        tone: "accent",
      });
    });

    favoriteShowcaseGames.slice(0, 2).forEach((game) => {
      items.push({
        id: `favorite-${game.id}`,
        title: `${game.title} ${t("activityFavoriteStill")}`,
        detail: t("activityFavoriteHint"),
        tone: "muted",
      });
    });

    return items.slice(0, 5);
  }, [continuePlayingGames, favoriteShowcaseGames, friendsPlayingNow, t]);

  return {
    displayGames,
    continuePlayingGames,
    favoriteShowcaseGames,
    friendsPlayingNow,
    recentOverviewActivity,
  };
}
