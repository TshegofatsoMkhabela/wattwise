const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? "").trim().replace(/\/$/, "");

export function apiUrl(path: string) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE_URL}${normalizedPath}`;
}

export function wsUrl(path: string) {
  const configuredWsUrl = (import.meta.env.VITE_WS_URL ?? "").trim();
  if (configuredWsUrl) return configuredWsUrl;

  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  if (API_BASE_URL) {
    const url = new URL(API_BASE_URL);
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    url.pathname = normalizedPath;
    return url.toString();
  }

  const proto = window.location.protocol === "https:" ? "wss" : "ws";
  return `${proto}://${window.location.host}${normalizedPath}`;
}
