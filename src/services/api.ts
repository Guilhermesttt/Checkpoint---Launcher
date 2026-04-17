const API_BASE_URL =
  import.meta.env.VITE_BACKEND_URL?.replace(/\/$/, "") ?? "http://localhost:8787";

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
