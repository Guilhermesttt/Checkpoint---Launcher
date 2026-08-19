"use strict";

const fs = require("node:fs");
const path = require("node:path");

const CREDENTIAL_FILE_NAME = "nexus-credentials.json";

const createNexusCredentialStore = ({
  userDataPath,
  safeStorage,
  fileSystem = fs,
}) => {
  if (!userDataPath || typeof userDataPath !== "string") {
    throw new TypeError("Diretorio de dados do usuario invalido.");
  }
  if (!safeStorage) {
    throw new TypeError("Armazenamento seguro indisponivel.");
  }

  const credentialPath = path.join(userDataPath, CREDENTIAL_FILE_NAME);

  const encryptionAvailable = () =>
    Boolean(safeStorage.isEncryptionAvailable?.());

  /** Lê e valida o envelope de credenciais de forma assíncrona. */
  const readEnvelope = async () => {
    try {
      const raw = await fileSystem.promises.readFile(credentialPath, "utf8");
      const envelope = JSON.parse(raw);
      if (envelope?.version !== 1 || typeof envelope?.encryptedKey !== "string") {
        return null;
      }
      return envelope;
    } catch {
      return null;
    }
  };

  /** Lê e descriptografa a chave Nexus. Retorna null se indisponível. */
  const read = async () => {
    if (!encryptionAvailable()) return null;
    const envelope = await readEnvelope();
    if (!envelope) return null;
    try {
      const encrypted = Buffer.from(envelope.encryptedKey, "base64");
      const key = safeStorage.decryptString(encrypted).trim();
      return key || null;
    } catch {
      return null;
    }
  };

  /** Criptografa e persiste a chave Nexus de forma assíncrona com escrita atômica. */
  const save = async (apiKey) => {
    const normalized = String(apiKey || "").trim();
    if (!normalized) throw new Error("Informe uma chave Nexus valida.");
    if (!encryptionAvailable()) {
      throw new Error("A criptografia do sistema operacional nao esta disponivel.");
    }

    await fileSystem.promises.mkdir(userDataPath, { recursive: true });
    const encryptedKey = safeStorage.encryptString(normalized).toString("base64");
    const envelope = JSON.stringify({
      version: 1,
      encryptedKey,
      savedAt: new Date().toISOString(),
    });
    const temporaryPath = `${credentialPath}.tmp`;
    await fileSystem.promises.writeFile(temporaryPath, envelope, { encoding: "utf8", mode: 0o600 });
    try { await fileSystem.promises.rm(credentialPath, { force: true }); } catch { /* ignore */ }
    await fileSystem.promises.rename(temporaryPath, credentialPath);
  };

  const clear = async () => {
    try { await fileSystem.promises.rm(credentialPath, { force: true }); } catch { /* ignore */ }
  };

  const getStatus = async () => ({
    connected: Boolean(await read()),
    encryptionAvailable: encryptionAvailable(),
  });

  return {
    clear,
    getStatus,
    read,
    save,
    credentialPath,
  };
};

module.exports = {
  CREDENTIAL_FILE_NAME,
  createNexusCredentialStore,
};
