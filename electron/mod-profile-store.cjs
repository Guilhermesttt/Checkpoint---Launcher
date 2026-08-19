"use strict";

const fs = require("node:fs");
const path = require("node:path");

async function getStoreFilePath(userDataPath, gameId) {
  const safeGameId = String(gameId || "").replace(/[^a-zA-Z0-9_-]/g, "_");
  const profilesDir = path.join(userDataPath, "mod_profiles");
  await fs.promises.mkdir(profilesDir, { recursive: true });
  return path.join(profilesDir, `${safeGameId}.json`);
}

async function loadModProfiles(userDataPath, gameId) {
  const filePath = await getStoreFilePath(userDataPath, gameId);
  try {
    const raw = await fs.promises.readFile(filePath, "utf-8");
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

async function saveModProfile(userDataPath, gameId, profileName, activeInstallIds) {
  const profiles = await loadModProfiles(userDataPath, gameId);
  const now = new Date().toISOString();
  const cleanName = String(profileName || "").trim() || "Perfil Personalizado";

  const existingIndex = profiles.findIndex((p) => String(p.name).toLowerCase() === cleanName.toLowerCase());
  if (existingIndex >= 0) {
    profiles[existingIndex].activeInstallIds = activeInstallIds;
    profiles[existingIndex].updatedAt = now;
  } else {
    profiles.push({
      id: `profile_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      name: cleanName,
      gameId,
      activeInstallIds,
      createdAt: now,
      updatedAt: now,
    });
  }

  const filePath = await getStoreFilePath(userDataPath, gameId);
  const tmpPath = `${filePath}.tmp`;
  await fs.promises.writeFile(tmpPath, JSON.stringify(profiles, null, 2), "utf-8");
  await fs.promises.rename(tmpPath, filePath);
  return profiles;
}

async function deleteModProfile(userDataPath, gameId, profileId) {
  let profiles = await loadModProfiles(userDataPath, gameId);
  profiles = profiles.filter((p) => p.id !== profileId);
  const filePath = await getStoreFilePath(userDataPath, gameId);
  const tmpPath = `${filePath}.tmp`;
  await fs.promises.writeFile(tmpPath, JSON.stringify(profiles, null, 2), "utf-8");
  await fs.promises.rename(tmpPath, filePath);
  return profiles;
}

module.exports = {
  loadModProfiles,
  saveModProfile,
  deleteModProfile,
};
