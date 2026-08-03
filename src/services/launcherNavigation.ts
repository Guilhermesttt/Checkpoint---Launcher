export const RESTORABLE_CATEGORIES = [
  "ALL",
  "FAVORITES",
  "FRIENDS",
  "FEED",
  "MODS",
  "STEAM",
  "EPIC",
  "EA",
  "UBISOFT",
  "GOG",
  "XBOX",
  "RIOT",
  "BATTLENET",
  "ROCKSTAR",
  "LOCAL",
  "PROFILE",
  "RACING",
  "ROLEPLAYING",
  "SPORTS",
  "ONLINE",
  "SHOOTER",
  "ACTION",
  "ADVENTURE",
  "HORROR",
  "STRATEGY",
  "FIGHTING",
  "SETTINGS",
] as const;

export const SETTINGS_TABS = [
  "general",
  "personalization",
  "account",
  "connections",
  "controller",
  "notifications",
] as const;

export const SIDEBAR_NAVIGATION_GROUPS = [
  { key: "filters", ids: ["ALL", "FAVORITES"] },
  { key: "platforms", ids: ["STEAM", "EPIC", "EA", "UBISOFT", "GOG", "XBOX", "RIOT", "BATTLENET", "ROCKSTAR", "LOCAL"] },
  { key: "community", ids: ["FRIENDS", "FEED"] },
  { key: "music", ids: ["SPOTIFY"] },
  { key: "mods", ids: ["MODS"] },
] as const;

export const SIDEBAR_NAVIGATION_ORDER = [
  ...SIDEBAR_NAVIGATION_GROUPS.flatMap((group) => group.ids),
  "PROFILE",
] as const;

export const getAdjacentSidebarCategory = (
  activeCategory: string,
  direction: -1 | 1,
): string | null => {
  const currentIndex = SIDEBAR_NAVIGATION_ORDER.findIndex(
    (category) => category === activeCategory,
  );
  if (currentIndex < 0) return null;
  return SIDEBAR_NAVIGATION_ORDER[currentIndex + direction] ?? null;
};

export type RestorableCategory = (typeof RESTORABLE_CATEGORIES)[number];
export type SettingsTab = (typeof SETTINGS_TABS)[number];

const categoryKey = (uid: string) => `checkpoint_last_category_${uid}`;
const settingsTabKey = (uid: string) => `checkpoint_last_settings_tab_${uid}`;

const isRestorableCategory = (value: unknown): value is RestorableCategory =>
  RESTORABLE_CATEGORIES.includes(value as RestorableCategory);

const isSettingsTab = (value: unknown): value is SettingsTab =>
  SETTINGS_TABS.includes(value as SettingsTab);

const readStored = (key: string) => {
  try {
    return localStorage.getItem(key);
  } catch (error) {
    console.warn(`[navigation] Falha ao ler ${key}.`, error);
    return null;
  }
};

const writeStored = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch (error) {
    console.warn(`[navigation] Falha ao salvar ${key}.`, error);
  }
};

export const readLastNavigation = (uid: string): {
  category: RestorableCategory;
  settingsTab: SettingsTab;
} => {
  const category = readStored(categoryKey(uid));
  const settingsTab = readStored(settingsTabKey(uid));
  return {
    category: isRestorableCategory(category) ? category : "ALL",
    settingsTab: isSettingsTab(settingsTab) ? settingsTab : "general",
  };
};

export const writeLastCategory = (uid: string, category: string) => {
  if (isRestorableCategory(category)) writeStored(categoryKey(uid), category);
};

export const writeLastSettingsTab = (uid: string, settingsTab: string) => {
  if (isSettingsTab(settingsTab)) writeStored(settingsTabKey(uid), settingsTab);
};
