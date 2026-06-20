/** URL-safe slug segments from human-readable text. */
export function slugifySegment(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function buildJobSlug(title: string, city: string, state: string): string {
  return slugifySegment(`${title}-${city}-${state}`);
}
