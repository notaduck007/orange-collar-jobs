import { getAccessToken } from "@/lib/auth-session";

export function requireAccessToken(): string {
  const token = getAccessToken();
  if (!token) {
    throw new Error("Sign in again to continue — your session expired.");
  }
  return token;
}
