import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "employer" | "job_seeker";

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  /** Effective role chosen by priority: admin > employer > job_seeker. */
  role: AppRole | null;
  /** Every role row attached to the user. Admins are a superset. */
  roles: AppRole[];
  /** Effective permission keys (admins receive the full catalog). */
  permissions: string[];
  loading: boolean;
  signOut: () => Promise<void>;
}

const ROLE_PRIORITY: AppRole[] = ["admin", "employer", "job_seeker"];
function pickEffective(roles: AppRole[]): AppRole | null {
  for (const r of ROLE_PRIORITY) if (roles.includes(r)) return r;
  return null;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [role, setRole] = useState<AppRole | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const loadSessionRole = async (s: Session | null) => {
      if (!active) return;
      setSession(s);

      if (!s?.user) {
        setRoles([]);
        setRole(null);
        setPermissions([]);
        setLoading(false);
        return;
      }

      const { data: prof } = await supabase
        .from("profiles")
        .select("active")
        .eq("id", s.user.id)
        .maybeSingle();

      if (prof && prof.active === false) {
        await supabase.auth.signOut();
        if (!active) return;
        setSession(null);
        setRoles([]);
        setRole(null);
        setPermissions([]);
        setLoading(false);
        return;
      }

      // IMPORTANT: a user may hold multiple roles (UNIQUE(user_id, role)).
      // Fetch the full set and resolve effective role by priority — admin wins.
      const [{ data }, { data: perms }] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", s.user.id),
        supabase.rpc("get_my_permissions"),
      ]);

      if (!active) return;
      const list = ((data ?? []) as Array<{ role: AppRole }>).map((r) => r.role);
      const resolved = list.length > 0 ? (pickEffective(list) ?? "job_seeker") : "job_seeker";
      setRoles(list);
      setRole(resolved);
      setPermissions(Array.isArray(perms) ? (perms as string[]) : []);
      setLoading(false);
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => {
      setLoading(true);
      setTimeout(() => void loadSessionRole(s), 0);
    });

    supabase.auth.getSession().then(({ data }) => {
      void loadSessionRole(data.session);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const value: AuthContextValue = {
    user: session?.user ?? null,
    session,
    role,
    roles,
    permissions,
    loading,
    signOut: async () => {
      await supabase.auth.signOut();
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
