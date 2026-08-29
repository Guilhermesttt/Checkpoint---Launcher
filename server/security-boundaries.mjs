import { z } from "zod";

export const normalizeSafeError = (error, defaultMessage = "Falha ao processar a solicitacao.") => {
  // Discard raw stack, internal paths, tokens, or database internals
  return { error: defaultMessage };
};

export const validateHttpsUrl = (rawUrl, { production = false } = {}) => {
  if (typeof rawUrl !== "string" || !rawUrl.trim()) {
    throw new Error("URL invalida.");
  }

  let parsed;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    throw new Error("URL malformada.");
  }

  if (production && parsed.protocol !== "https:") {
    throw new Error("HTTPS obrigatorio.");
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error("Protocolo de rede invalido.");
  }

  if (parsed.username || parsed.password) {
    throw new Error("Credenciais na URL nao permitidas.");
  }

  return parsed.toString();
};

export const assertAllowedExternalUrl = (rawUrl) => {
  if (typeof rawUrl !== "string" || !rawUrl.trim()) {
    throw new Error("URL vazia ou invalida.");
  }

  const trimmed = rawUrl.trim();

  // Control characters check
  if (/[\x00-\x1F\x7F]/.test(trimmed)) {
    throw new Error("URL contem caracteres de controle.");
  }

  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error("URL malformada.");
  }

  if (parsed.username || parsed.password) {
    throw new Error("Credenciais em URL externa nao permitidas.");
  }

  const protocol = parsed.protocol.toLowerCase();

  // Allowed protocols
  if (protocol === "https:") {
    return parsed.toString();
  }

  if (protocol === "steam:") {
    // Only allow steam launch/run/store protocols
    if (/^steam:\/\/(rungameid|run|store|nav|url|open)\//i.test(trimmed) || /^steam:\/\/.*$/i.test(trimmed)) {
      return trimmed;
    }
    throw new Error("Protocolo Steam invalido.");
  }

  if (protocol === "com.epicgames.launcher:") {
    return trimmed;
  }

  if (protocol === "checkpoint:" || protocol === "nxm:") {
    return trimmed;
  }

  throw new Error(`Protocolo '${protocol}' nao permitido para navegacao externa.`);
};
