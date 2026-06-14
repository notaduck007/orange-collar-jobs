import { createMiddleware } from "@tanstack/react-start";
import { getAccessToken } from "@/lib/auth-session";

/** Attach NestJS JWT to server function RPCs (replaces Supabase bearer for Phase 2+). */
export const attachApiAuth = createMiddleware({ type: "function" }).client(async ({ next }) => {
  const token = getAccessToken();
  return next({
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
});
