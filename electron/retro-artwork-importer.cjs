const dns = require("node:dns").promises;
const net = require("node:net");

const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"]);

const isPrivateNetworkAddress = (address) => {
  if (net.isIPv4(address)) {
    const parts = address.split(".").map(Number);
    return parts[0] === 10 || parts[0] === 127 || parts[0] === 0 || (parts[0] === 169 && parts[1] === 254)
      || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) || (parts[0] === 192 && parts[1] === 168);
  }
  if (net.isIPv6(address)) {
    const normalized = address.toLowerCase();
    return normalized === "::1" || normalized === "::" || normalized.startsWith("fc") || normalized.startsWith("fd") || normalized.startsWith("fe8") || normalized.startsWith("fe9") || normalized.startsWith("fea") || normalized.startsWith("feb");
  }
  return true;
};

function createRetroArtworkImporter({ fetchImpl = globalThis.fetch, lookupImpl = dns.lookup } = {}) {
  return async function importRetroArtwork(rawUrl) {
    let current = new URL(String(rawUrl || "").trim());
    if (!['http:', 'https:'].includes(current.protocol)) throw new Error("Use uma URL HTTP ou HTTPS válida.");

    for (let redirect = 0; redirect <= 4; redirect += 1) {
      const addresses = await lookupImpl(current.hostname, { all: true, verbatim: true });
      if (!addresses.length || addresses.some(({ address }) => isPrivateNetworkAddress(address))) {
        throw new Error("A imagem não pode apontar para uma rede privada.");
      }
      const response = await fetchImpl(current.toString(), { redirect: "manual", headers: { Accept: "image/*" } });
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (!location || redirect === 4) throw new Error("A imagem possui redirecionamentos inválidos.");
        current = new URL(location, current);
        if (!['http:', 'https:'].includes(current.protocol)) throw new Error("Redirecionamento de imagem inválido.");
        continue;
      }
      if (!response.ok) throw new Error(`Não foi possível baixar a imagem (HTTP ${response.status}).`);
      const contentType = String(response.headers.get("content-type") || "").split(";")[0].toLowerCase();
      if (!ALLOWED_TYPES.has(contentType)) throw new Error("O link não aponta para uma imagem compatível.");
      const declaredSize = Number(response.headers.get("content-length") || 0);
      if (declaredSize > MAX_IMAGE_BYTES) throw new Error("A imagem deve ter no máximo 3 MB.");
      const bytes = Buffer.from(await response.arrayBuffer());
      if (bytes.length > MAX_IMAGE_BYTES) throw new Error("A imagem deve ter no máximo 3 MB.");
      return `data:${contentType};base64,${bytes.toString("base64")}`;
    }
    throw new Error("Não foi possível importar a imagem.");
  };
}

module.exports = { createRetroArtworkImporter, isPrivateNetworkAddress, MAX_IMAGE_BYTES };
