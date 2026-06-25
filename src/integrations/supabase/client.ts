/**
 * Supabase has been removed. This module exports a stub client that returns
 * empty data for reads and surfaces clear errors for writes / edge functions.
 * All 52 consumer files keep their existing imports unchanged.
 *
 * Data migration status: all reads/writes now route through the NestJS API
 * at VITE_API_BASE_URL. Features that relied on Supabase Edge Functions or
 * Supabase Storage are disabled until Nest equivalents are built.
 */

const EMPTY_RESULT = { data: [] as unknown[], error: null };
const NULL_RESULT = { data: null as null, error: null };

/** Returns a chainable Proxy that resolves to empty data when awaited. */
function makeQueryBuilder(): unknown {
  const resolved = Promise.resolve(EMPTY_RESULT);

  const handler: ProxyHandler<object> = {
    get(_target, prop: string | symbol) {
      const key = String(prop);

      // Make the builder thenable (awaitable)
      if (key === "then") return resolved.then.bind(resolved);
      if (key === "catch") return resolved.catch.bind(resolved);
      if (key === "finally") return resolved.finally.bind(resolved);

      // .single() / .maybeSingle() → resolve to null row
      if (key === "single" || key === "maybeSingle") {
        return () => Promise.resolve(NULL_RESULT);
      }

      // Every other method (select, insert, update, delete, upsert,
      // eq, neq, gt, lt, in, ilike, order, limit, range, …) is chainable.
      return (..._args: unknown[]) => proxy;
    },
  };

  const proxy = new Proxy({} as object, handler);
  return proxy;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const supabase: any = {
  /** PostgREST-style query builder — returns empty data. */
  from: (_table: string) => makeQueryBuilder(),

  /** RPC stub — returns null data. */
  rpc: (_fn: string, _params?: unknown) => makeQueryBuilder(),

  auth: {
    getSession: () => Promise.resolve({ data: { session: null }, error: null }),
    getUser: () => Promise.resolve({ data: { user: null }, error: null }),
    signOut: () => Promise.resolve({ error: null }),
    onAuthStateChange: (_cb: unknown) => ({
      data: { subscription: { unsubscribe: () => undefined } },
    }),
    setSession: (_session: unknown) =>
      Promise.resolve({ data: { session: null, user: null }, error: null }),
    verifyOtp: (_params: unknown) =>
      Promise.resolve({ data: {}, error: new Error("Supabase auth has been removed.") }),
    exchangeCodeForSession: (_code: string) =>
      Promise.resolve({ data: { session: null, user: null }, error: null }),
  },

  storage: {
    from: (_bucket: string) => ({
      upload: () =>
        Promise.resolve({ data: null, error: new Error("Storage: use POST /api/v1/uploads") }),
      getPublicUrl: (_path: string) => ({ data: { publicUrl: "" } }),
      createSignedUrl: () =>
        Promise.resolve({ data: null, error: new Error("Storage: use POST /api/v1/uploads") }),
      remove: () =>
        Promise.resolve({ data: null, error: new Error("Storage: use POST /api/v1/uploads") }),
    }),
  },

  functions: {
    invoke: (_name: string, _opts?: unknown) =>
      Promise.resolve({
        data: null,
        error: new Error(
          `Edge function "${String(_name)}" has been removed. Use the NestJS API instead.`,
        ),
      }),
  },

  channel: (_name: string) => ({
    on: (..._args: unknown[]) => ({ subscribe: () => undefined }),
  }),
};
