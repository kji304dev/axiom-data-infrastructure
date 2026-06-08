const DEFAULT_API_BASE_URL = "http://127.0.0.1:8000";

export function normalizeApiBaseUrl(baseUrl: string): string {
  return baseUrl.trim().replace(/\/+$/, "");
}

export function getApiBaseUrl(): string {
  const configured = import.meta.env.VITE_API_BASE_URL?.trim();
  return normalizeApiBaseUrl(configured || DEFAULT_API_BASE_URL);
}

export function buildApiUrl(path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${getApiBaseUrl()}${normalizedPath}`;
}
