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

export const fetchWithTimeout = async (
  input: RequestInfo | URL,
  init?: RequestInit,
  timeoutMs: number = 10000,
): Promise<Response> => {
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort(new Error(`Timeout de requisição após ${timeoutMs}ms`));
  }, timeoutMs);

  if (init?.signal) {
    init.signal.addEventListener("abort", () => {
      controller.abort(init.signal?.reason);
    });
  }

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
};

export const getAuthHeaders = async (withJson = false): Promise<Record<string, string>> => {
  const { supabase } = await import("./supabase");
  let session = (await supabase.auth.getSession()).data.session;

  // Se o token expirar em menos de 2 minutos ou já tiver expirado, tenta renovar proativamente
  if (session && session.expires_at && session.expires_at * 1000 < Date.now() + 120_000) {
    try {
      const refreshRes = await supabase.auth.refreshSession();
      if (refreshRes?.data?.session) {
        session = refreshRes.data.session;
      }
    } catch {
      // continua com a sessão atual caso falhe
    }
  }

  const headers: Record<string, string> = {};
  if (withJson) {
    headers["Content-Type"] = "application/json";
  }
  if (session?.access_token) {
    headers["Authorization"] = `Bearer ${session.access_token}`;
  }
  return headers;
};

export const isBackendHealthy = async (timeoutMs = 3500) => {
  try {
    const response = await fetchWithTimeout(apiUrl("/health"), undefined, timeoutMs);
    return response.ok;
  } catch {
    return false;
  }
};

