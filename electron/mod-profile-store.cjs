const fs = require("node:fs");
const path = require("node:path");

function getStoreFilePath(userDataPath, gameId) {
  const safeGameId = String(gameId || "").replace(/[^a-zA-Z0-9_-]/g, "_");
  const profilesDir = path.join(userDataPath, "mod_profiles");
  if (!fs.existsSync(profilesDir)) {
    fs.mkdirSync(profilesDir, { recursive: true });
  }
  return path.join(profilesDir, `${safeGameId}.json`);
}

function loadModProfiles(userDataPath, gameId) {
  const filePath = getStoreFilePath(userDataPath, gameId);
  if (!fs.existsSync(filePath)) {
    return [];
  }
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function saveModProfile(userDataPath, gameId, profileName, activeInstallIds) {
  const profiles = loadModProfiles(userDataPath, gameId);
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

  const filePath = getStoreFilePath(userDataPath, gameId);
  fs.writeFileSync(filePath, JSON.stringify(profiles, null, 2), "utf-8");
  return profiles;
}

function deleteModProfile(userDataPath, gameId, profileId) {
  let profiles = loadModProfiles(userDataPath, gameId);
  profiles = profiles.filter((p) => p.id !== profileId);
  const filePath = getStoreFilePath(userDataPath, gameId);
  fs.writeFileSync(filePath, JSON.stringify(profiles, null, 2), "utf-8");
  return profiles;
}

module.exports = {
  loadModProfiles,
  saveModProfile,
  deleteModProfile,
};
