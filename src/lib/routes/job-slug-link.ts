/** Helpers for typed navigation to `/jobs/$slug` (inherits parent `/jobs` search schema). */

export function jobSlugLink(slug: string) {
  return {
    to: "/jobs/$slug" as const,
    params: { slug },
    search: {},
  };
}

/** Opens job detail with apply dialog (`?apply=1`). */
export function jobSlugApplyLink(slug: string) {
  return {
    to: "/jobs/$slug" as const,
    params: { slug },
    search: { apply: 1 as const },
  };
}

/** Clears `apply` from URL after auto-open (detail page only). */
export function jobSlugClearApplyLink(slug: string) {
  return jobSlugLink(slug);
}
