/** HTTP verbs the contract guard compares between code and the OpenAPI spec. */
export type HttpVerb = "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD" | "OPTIONS";

/**
 * A single normalized API operation (one HTTP verb on one path). Path parameters
 * are collapsed to a positional `{}` placeholder so that route identity is
 * independent of parameter naming, while the original names are preserved in
 * `params` to surface parameter-naming drift.
 */
export interface RouteSignature {
  readonly method: HttpVerb;
  /** Path with positional `{}` placeholders for params, e.g. `/api/v1/jobs/{}`. */
  readonly path: string;
  /** Ordered path-parameter names (e.g. `['id']`). */
  readonly params: readonly string[];
  /** Original path as declared (code route or spec template), for reporting. */
  readonly rawPath: string;
}

export type DriftKind = "MISSING_IN_SPEC" | "MISSING_IN_CODE" | "PARAM_MISMATCH";

/** A single divergence between the implemented routes and the documented spec. */
export interface RouteDrift {
  readonly kind: DriftKind;
  readonly method: HttpVerb;
  readonly path: string;
  readonly detail: string;
}

/** Outcome of comparing the live route surface against the OpenAPI spec. */
export interface ContractDriftReport {
  readonly hasDrift: boolean;
  /** Implemented in code but absent from `docs/api/openapi.yaml`. */
  readonly addedRoutes: readonly RouteDrift[];
  /** Documented in the spec but not implemented in code. */
  readonly removedRoutes: readonly RouteDrift[];
  /** Present in both but path-parameter names diverge. */
  readonly changedRoutes: readonly RouteDrift[];
  /** Stable fingerprint of the code route surface. */
  readonly codeFingerprint: string;
  /** Stable fingerprint of the spec route surface. */
  readonly specFingerprint: string;
}
