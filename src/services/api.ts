const configuredBackendUrl = import.meta.env.VITE_BACKEND_URL?.replace(/\/$/, "");

const fallbackBackendUrl =
  typeof window !== "undefined" && window.location.hostname === "localhost"
    ? "http://localhost:8787"
    : "https://checkpoint-backend-vgvx.onrender.com";

const API_BASE_URL = configuredBackendUrl || fallbackBackendUrl;

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
