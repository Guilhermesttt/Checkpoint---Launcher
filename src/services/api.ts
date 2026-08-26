const PROD_BACKEND_URL = "https://checkpoint-launcher.onrender.com";

export const resolveBackendUrl = (
  envUrl: string | undefined = import.meta.env.VITE_BACKEND_URL,
  isProd: boolean = import.meta.env.PROD,
  origin: string = typeof window !== "undefined" && window.location ? window.location.origin : "",
  hostname: string = typeof window !== "undefined" && window.location ? window.location.hostname : "",
) => {
  const configured = envUrl?.replace(/\/$/, "");

  // Em modo de produção (bundled app, Electron packaged, ou preview)
  if (isProd) {
    // Se o usuário/CI configurou explicitamente uma URL remota diferente de localhost
    if (
      configured &&
      !configured.includes("localhost") &&
      !configured.includes("127.0.0.1") &&
      !configured.includes("0.0.0.0")
    ) {
      return configured;
    }

    // Se estiver em um navegador web com hostname próprio remoto (ex: checkpointlauncher.com)
    if (
      origin &&
      origin.startsWith("http") &&
      !hostname.includes("localhost") &&
      !hostname.includes("127.0.0.1")
    ) {
      return origin.replace(/\/$/, "");
    }

    return PROD_BACKEND_URL;
  }

  // Em modo de desenvolvimento Vite
  if (configured) {
    if (configured === "https://localhost:8787") {
      return "http://localhost:8787";
    }
    return configured;
  }

  if (hostname === "localhost" || hostname === "127.0.0.1") {
    return "http://localhost:8787";
  }

  return PROD_BACKEND_URL;
};

const API_BASE_URL = resolveBackendUrl();

export const apiUrl = (path: string) =>
  `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;

export const getApiBaseUrl = () => API_BASE_URL;

export const isBackendHealthy = async () => {
  try {
    const response = await fetch(apiUrl("/health"));
    return response.ok;
  } catch {
    return false;
  }
};
