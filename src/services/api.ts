const PROD_BACKEND_URL = "https://checkpoint-backend-vgvx.onrender.com";

const resolveBackendUrl = () => {
  const configured = import.meta.env.VITE_BACKEND_URL?.replace(/\/$/, "");

  // Se VITE_BACKEND_URL foi explicitamente definido no .env ou ambiente, deve ser respeitado
  if (configured) {
    if (configured === "https://localhost:8787") {
      return "http://localhost:8787";
    }
    return configured;
  }

  // Em modo de desenvolvimento Vite
  if (!import.meta.env.PROD) {
    if (typeof window !== "undefined" && window.location.hostname === "localhost") {
      return "http://localhost:8787";
    }
  }

  // Se estiver em um navegador web com hostname proprio que nao seja localhost
  if (typeof window !== "undefined" && window.location.origin && window.location.origin.startsWith("http") && !window.location.hostname.includes("localhost")) {
    return window.location.origin.replace(/\/$/, "");
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
