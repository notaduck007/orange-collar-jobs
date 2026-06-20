/**
 * Shared route-path normalization used by both the live introspection
 * (`:param` segments) and the OpenAPI spec loader (`{param}` segments) so that
 * code and spec produce identical signatures for the same operation.
 */

export interface NormalizedPath {
  /** Path with each parameter segment replaced by a positional `{}` token. */
  readonly path: string;
  /** Ordered parameter names as they appear in the original path. */
  readonly params: readonly string[];
}

/** Join path fragments into a single leading-slash path, collapsing empty segments. */
export function joinRoutePath(...parts: readonly string[]): string {
  const segments = parts
    .join("/")
    .split("/")
    .filter((segment) => segment.length > 0);
  return `/${segments.join("/")}`;
}

/**
 * Collapse `:name` (NestJS) and `{name}` (OpenAPI) parameter segments to a
 * positional `{}` placeholder, capturing the parameter names in order.
 */
export function normalizeRoutePath(rawPath: string): NormalizedPath {
  const params: string[] = [];
  const segments = rawPath
    .split("/")
    .filter((segment) => segment.length > 0)
    .map((segment) => {
      if (segment.startsWith(":")) {
        params.push(segment.slice(1));
        return "{}";
      }
      const braceMatch = /^\{(.+)\}$/.exec(segment);
      if (braceMatch) {
        params.push(braceMatch[1]);
        return "{}";
      }
      return segment;
    });
  return { path: `/${segments.join("/")}`, params };
}
