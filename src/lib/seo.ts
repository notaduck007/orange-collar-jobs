export const SITE_URL = "https://warehousejobs.com";

export function canonical(path: string): string {
  return SITE_URL + path;
}
