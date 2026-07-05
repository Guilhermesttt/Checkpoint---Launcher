const express = require("express");
const fs = require("node:fs");
const path = require("node:path");

const DEFAULT_PORT = 3000;
const MAX_PORT = 3010;
const LOCAL_HOST = "127.0.0.1";
const progressWriteQueues = new Map();

const sanitizeId = (value, label) => {
  const id = String(value || "").trim();
  if (!id) {
    throw new Error(`${label} ausente.`);
  }

  if (!/^[a-zA-Z0-9._-]+$/.test(id)) {
    throw new Error(`${label} invalido.`);
  }

  return id;
};

const readJsonFile = async (filePath) => {
  const raw = await fs.promises.readFile(filePath, "utf8");
  const normalized = raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw;
  return JSON.parse(normalized);
};

const ensureDir = async (dirPath) => {
  await fs.promises.mkdir(dirPath, { recursive: true });
};

const writeJsonAtomic = async (filePath, payload) => {
  const directory = path.dirname(filePath);
  const tempFilePath = path.join(
    directory,
    `.${path.basename(filePath)}.${process.pid}.${Date.now()}.tmp`,
  );
  const serialized = `${JSON.stringify(payload, null, 2)}\n`;

  await ensureDir(directory);
  await fs.promises.writeFile(tempFilePath, serialized, "utf8");
  await fs.promises.rename(tempFilePath, filePath);
};

const withQueuedProgressWrite = async (filePath, writer) => {
  const previousJob = progressWriteQueues.get(filePath) || Promise.resolve();
  const nextJob = previousJob
    .catch(() => undefined)
    .then(writer)
    .finally(() => {
      if (progressWriteQueues.get(filePath) === nextJob) {
        progressWriteQueues.delete(filePath);
      }
    });

  progressWriteQueues.set(filePath, nextJob);
  return nextJob;
};

const normalizeAchievementRecord = (achievementId, record) => {
  if (!record || typeof record !== "object") {
    return null;
  }

  const resolvedId = String(record.id || achievementId).trim();
  if (!resolvedId) {
    return null;
  }

  return {
    id: resolvedId,
    name: String(record.name || record.title || resolvedId),
    description: String(record.description || record.desc || ""),
    icon: String(record.icon || record.iconPath || ""),
  };
};

const findAchievementDefinition = (definitionFile, achievementId) => {
  if (Array.isArray(definitionFile?.achievements)) {
    const matched = definitionFile.achievements.find(
      (achievement) => String(achievement?.id || "").trim() === achievementId,
    );
    return normalizeAchievementRecord(achievementId, matched);
  }

  if (definitionFile?.achievements && typeof definitionFile.achievements === "object") {
    return normalizeAchievementRecord(achievementId, definitionFile.achievements[achievementId]);
  }

  if (definitionFile && typeof definitionFile === "object") {
    return normalizeAchievementRecord(achievementId, definitionFile[achievementId]);
  }

  return null;
};

const createAchievementBridge = ({
  userDataPath,
  logger = console,
  onAchievementUnlocked,
}) => {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "32kb" }));

  app.get("/health", (_request, response) => {
    response.json({ ok: true });
  });

  app.post("/unlock", async (request, response) => {
    try {
      const gameId = sanitizeId(request.body?.gameId, "gameId");
      const achievementId = sanitizeId(request.body?.achievementId, "achievementId");
      const achievementsDir = path.join(userDataPath, "achievements");
      const definitionsPath = path.join(achievementsDir, `${gameId}.json`);
      const progressPath = path.join(userDataPath, `user_progress_${gameId}.json`);

      const definitionFile = await readJsonFile(definitionsPath);
      const achievement = findAchievementDefinition(definitionFile, achievementId);
      if (!achievement) {
        response.status(404).json({ error: "Achievement nao encontrada." });
        return;
      }

      const unlockedAt = new Date().toISOString();
      const updatedProgress = await withQueuedProgressWrite(progressPath, async () => {
        let existingProgress = {
          gameId,
          unlockedAchievements: {},
          updatedAt: unlockedAt,
        };

        try {
          const current = await readJsonFile(progressPath);
          if (current && typeof current === "object") {
            existingProgress = {
              gameId,
              unlockedAchievements:
                current.unlockedAchievements && typeof current.unlockedAchievements === "object"
                  ? current.unlockedAchievements
                  : {},
              updatedAt: String(current.updatedAt || unlockedAt),
            };
          }
        } catch (error) {
          if (error && error.code !== "ENOENT") {
            throw error;
          }
        }

        const wasAlreadyUnlocked = Boolean(existingProgress.unlockedAchievements[achievementId]);
        existingProgress.unlockedAchievements[achievementId] = {
          ...achievement,
          unlockedAt,
        };
        existingProgress.updatedAt = unlockedAt;

        await writeJsonAtomic(progressPath, existingProgress);
        return { progress: existingProgress, duplicate: wasAlreadyUnlocked };
      });

      onAchievementUnlocked({
        gameId,
        achievementId,
        achievement,
        unlockedAt,
        duplicate: updatedProgress.duplicate,
      });

      response.json({
        ok: true,
        duplicate: updatedProgress.duplicate,
        port: bridge.address?.port,
      });
    } catch (error) {
      logger.error?.("[achievement-bridge] unlock failed", error);
      response.status(400).json({
        error: error instanceof Error ? error.message : "Falha ao desbloquear achievement.",
      });
    }
  });

  let bridge = null;

  const start = async () => {
    for (let port = DEFAULT_PORT; port <= MAX_PORT; port += 1) {
      try {
        const server = await new Promise((resolve, reject) => {
          const httpServer = app.listen(port, LOCAL_HOST, () => resolve(httpServer));
          httpServer.once("error", reject);
        });

        bridge = {
          address: {
            host: LOCAL_HOST,
            port,
          },
          server,
        };

        logger.info?.(`[achievement-bridge] listening on http://${LOCAL_HOST}:${port}`);
        return bridge.address;
      } catch (error) {
        if (error && error.code === "EADDRINUSE" && port < MAX_PORT) {
          continue;
        }
        throw error;
      }
    }

    throw new Error("Nenhuma porta livre encontrada para a achievement bridge.");
  };

  const stop = async () => {
    if (!bridge?.server) {
      return;
    }

    const server = bridge.server;
    bridge = null;

    await new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  };

  return {
    start,
    stop,
    getAddress: () => bridge?.address || null,
  };
};

module.exports = {
  DEFAULT_PORT,
  MAX_PORT,
  createAchievementBridge,
};
