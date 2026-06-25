/** Public client config — values from VITE_* env vars (safe for browser bundles). */

export function getApiBaseUrl(): string {
  const url = import.meta.env.VITE_API_BASE_URL;
  if (!url) {
    throw new Error("VITE_API_BASE_URL is not set. Copy .env.example to .env and configure it.");
  }
  return url;
}
