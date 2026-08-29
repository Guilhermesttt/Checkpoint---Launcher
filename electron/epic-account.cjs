const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { z } = require("zod");

const authRequestSchema = z
  .object({
    code: z.string().trim().min(8).max(2048).regex(/^[^\r\n]+$/),
  })
  .strict();

const achievementRequestSchema = z
  .object({
    sandboxId: z.string().trim().max(300).optional(),
    appName: z.string().trim().max(300).optional(),
  })
  .strict();

const createEpicAccount = ({ legendary, emitProgress }) => {
  if (!legendary || typeof legendary.run !== "function") {
    throw new Error("LegendaryManager e obrigatorio para createEpicAccount.");
  }

  const getStatus = async () => {
    try {
      const output = await legendary.run(["status", "--json"]);
      const parsed = JSON.parse(output);
      const account = parsed?.account || parsed?.account_id || parsed?.display_name || parsed?.displayName;
      if (
        account &&
        typeof account === "string" &&
        account.trim().length > 0 &&
        account.toLowerCase() !== "none" &&
        account.toLowerCase() !== "null" &&
        !account.toLowerCase().includes("not logged in") &&
        !account.toLowerCase().includes("<not logged in>")
      ) {
        let accountId = String(parsed?.account_id || "").trim();
        let displayName = String(parsed?.display_name || parsed?.displayName || "").trim();

        if ((!accountId || !displayName) && parsed?.config_directory) {
          try {
            const userJsonPath = path.join(parsed.config_directory, "user.json");
            if (fs.existsSync(userJsonPath)) {
              const userData = JSON.parse(fs.readFileSync(userJsonPath, "utf8"));
              if (!accountId && userData?.account_id) accountId = String(userData.account_id).trim();
              if (!displayName && userData?.displayName) displayName = String(userData.displayName).trim();
            }
          } catch {}
        }

        return {
          authenticated: true,
          accountId: accountId || String(account).trim(),
          displayName: displayName || String(account).trim(),
        };
      }
      return { authenticated: false };
    } catch {
      return { authenticated: false };
    }
  };

  const authenticate = async (payload) => {
    const validated = authRequestSchema.parse(payload);
    emitProgress?.({ phase: "authenticating" });

    await legendary.run(["auth", "--code", validated.code, "-y"]);
    return { success: true };
  };

  const listLibrary = async () => {
    emitProgress?.({ phase: "reading-library" });

    try {
      const output = await legendary.run(["list-games", "--json"]);
      let rawGames = [];
      try {
        rawGames = JSON.parse(output);
      } catch {
        return [];
      }

      if (!Array.isArray(rawGames)) {
        return [];
      }

      return rawGames.slice(0, 10000).map((item) => {
        const metadata = item.metadata || {};
        const keyImages = Array.isArray(metadata.keyImages)
          ? metadata.keyImages.slice(0, 20).map((img) => ({
              type: String(img.type || ""),
              url: String(img.url || ""),
              md5: img.md5 ? String(img.md5) : undefined,
              width: typeof img.width === "number" ? img.width : undefined,
              height: typeof img.height === "number" ? img.height : undefined,
            }))
          : [];

        return {
          appName: String(item.app_name || "").trim(),
          title: String(item.app_title || metadata.title || item.app_name || "").trim(),
          catalogId: String(metadata.id || item.app_name || "").trim(),
          namespace: String(metadata.namespace || "").trim(),
          description: String(metadata.description || "").trim(),
          keyImages,
        };
      });
    } catch {
      return [];
    }
  };

  const getAchievements = async (payload = {}) => {
    const validated = achievementRequestSchema.parse(payload);
    emitProgress?.({ phase: "reading-achievements" });

    if (!validated.appName) {
      return { total: 0, completed: 0, list: [] };
    }

    try {
      const output = await legendary.run([
        "list-achievements",
        validated.appName,
        "--json",
      ]);
      const data = JSON.parse(output);
      if (!data) return { total: 0, completed: 0, list: [] };

      const rawList = Array.isArray(data.achievements)
        ? data.achievements
        : [
            ...(data.completed || []).map((a) => ({ ...a, unlocked: true })),
            ...(data.uncompleted || []),
            ...(data.in_progress || []),
            ...(data.uninitiated || []),
            ...(data.hidden || []),
          ];

      const seen = new Set();
      const list = [];

      for (const ach of rawList) {
        const apiName = String(ach.name || ach.id || ach.api_name || "").trim();
        if (!apiName || seen.has(apiName)) continue;
        seen.add(apiName);

        const achieved = Boolean(ach.unlocked || ach.achieved);
        const unlockTime = ach.unlock_date
          ? Math.round(new Date(ach.unlock_date).getTime() / 1000)
          : ach.unlockTime || 0;

        list.push({
          apiName,
          name: String(ach.display_name || ach.name || "Conquista").trim(),
          description: String(ach.description || (ach.hidden ? "Conquista oculta" : "")).trim(),
          achieved,
          unlockTime,
          icon: String(ach.icon_url || ach.icon_link || ach.icon || "").trim(),
          iconGray: String(ach.icon_url || ach.icon_link || ach.iconGray || "").trim(),
          hidden: Boolean(ach.hidden),
        });
      }

      const total = typeof data.total_achievements === "number"
        ? data.total_achievements
        : list.length;
      const completed = typeof data.user_unlocked === "number"
        ? data.user_unlocked
        : list.filter((a) => a.achieved).length;

      return { total, completed, list };
    } catch {
      return { total: 0, completed: 0, list: [] };
    }
  };

  const logout = async () => {
    await legendary.logout();
    return { success: true };
  };

  return {
    getStatus,
    authenticate,
    listLibrary,
    getAchievements,
    logout,
  };
};

module.exports = {
  createEpicAccount,
};
