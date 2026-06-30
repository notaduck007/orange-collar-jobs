import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { QueryClient } from "@tanstack/react-query";
import { apiClient, type MeResponse, type ApiUserRole } from "@/lib/api-client";
import {
  clearAuthSession,
  getAccessToken,
  getAuthSession,
  type AuthSession,
} from "@/lib/auth-session";
import { stopImpersonation } from "@/lib/impersonation";

export type AppRole = "admin" | "employer" | "job_seeker";

/** Minimal user shape compatible with legacy Supabase `user.id` usage. */
export interface AuthUser {
  id: string;
  email: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  session: AuthSession | null;
  role: AppRole | null;
  roles: AppRole[];
  permissions: string[];
  loading: boolean;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

function mapApiRole(role: ApiUserRole): AppRole {
  if (role === "vendor") return "employer";
  if (role === "admin") return "admin";
  return "job_seeker";
}

function meToUser(me: MeResponse): AuthUser {
  return { id: me.id, email: me.email };
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({
  children,
  queryClient,
}: {
  children: ReactNode;
  queryClient: QueryClient;
}) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);

  const applyMe = (me: MeResponse, sess: AuthSession | null) => {
    const appRole = mapApiRole(me.role);
    setSession(sess);
    setUser(meToUser(me));
    setRole(appRole);
  };

  const refreshSession = useCallback(async () => {
    let token = getAccessToken();
    let sess = getAuthSession();

    if (!token && sess?.refreshToken) {
      const refreshed = await apiClient.refreshStoredSession();
      if (refreshed) {
        token = refreshed.accessToken;
        sess = getAuthSession();
      }
    }

    if (!token) {
      setSession(null);
      setUser(null);
      setRole(null);
      return;
    }

    const me = await apiClient.me(token);
    applyMe(me, sess);
  }, []);

  useEffect(() => {
    let active = true;

    void (async () => {
      try {
        await refreshSession();
      } catch {
        clearAuthSession();
        if (active) {
          setSession(null);
          setUser(null);
          setRole(null);
        }
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [refreshSession]);

  const roles = role ? [role] : [];
  const permissions = role === "admin" ? ["*"] : [];

  const value: AuthContextValue = {
    user,
    session,
    role,
    roles,
    permissions,
    loading,
    refreshSession,
    signOut: async () => {
      const session = getAuthSession();
      const token = session?.accessToken ?? null;
      try {
        if (token) await apiClient.logout(token);
      } catch {
        // Always clear local session even when the API call fails (expired token, offline, etc.)
      }
      clearAuthSession();
      await stopImpersonation();
      queryClient.clear();
      setSession(null);
      setUser(null);
      setRole(null);
      if (typeof window !== "undefined") {
        window.location.assign("/jobs");
      }
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
