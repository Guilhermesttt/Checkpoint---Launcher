const PROD_BACKEND_URL = "https://checkpoint-backend-vgvx.onrender.com";

const resolveBackendUrl = () => {
  const configured = import.meta.env.VITE_BACKEND_URL?.replace(/\/$/, "");

  // In production builds, never use localhost even if baked in from local .env
  if (import.meta.env.PROD) {
    if (configured && !configured.includes("localhost") && !configured.includes("127.0.0.1")) {
      return configured;
    }
    if (typeof window !== "undefined" && window.location.origin && window.location.origin.startsWith("http") && !window.location.hostname.includes("localhost")) {
      return window.location.origin.replace(/\/$/, "");
    }
    return PROD_BACKEND_URL;
  }

  // Development mode
  if (configured) {
    return configured;
  }

  if (typeof window !== "undefined" && window.location.hostname === "localhost") {
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
