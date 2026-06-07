import { supabase } from "@/integrations/supabase/client";

export type CityEntry = { city: string; state: string; slug: string };

export function citySlug(city: string, state: string): string {
  const c = city
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
  return `${c}-${state.trim().toLowerCase()}`;
}

export function parseCitySlug(slug: string): { city: string; state: string } | null {
  const idx = slug.lastIndexOf("-");
  if (idx <= 0) return null;
  const stateRaw = slug.slice(idx + 1);
  const cityRaw = slug.slice(0, idx);
  if (stateRaw.length !== 2) return null;
  const state = stateRaw.toUpperCase();
  const city = cityRaw
    .split("-")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
  return { city, state };
}

export async function fetchActiveCities(limit = 200): Promise<CityEntry[]> {
  const { data } = await supabase
    .from("jobs")
    .select("city, state")
    .in("status", ["active", "published"])
    .not("city", "is", null)
    .not("state", "is", null)
    .limit(5000);
  const seen = new Map<string, CityEntry>();
  for (const row of (data ?? []) as Array<{ city: string | null; state: string | null }>) {
    const city = (row.city ?? "").trim();
    const state = (row.state ?? "").trim();
    if (!city || !state) continue;
    const slug = citySlug(city, state);
    if (!seen.has(slug)) seen.set(slug, { city, state: state.toUpperCase(), slug });
    if (seen.size >= limit) break;
  }
  return Array.from(seen.values());
}
