import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { HardHat } from "lucide-react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSiteSettings } from "@/lib/site-settings";

const searchSchema = z.object({
  mode: z.enum(["login", "signup"]).default("login").catch("login"),
  role: z.enum(["job_seeker", "employer"]).optional(),
  next: z.string().optional(),
});

export const Route = createFileRoute("/auth")({
  validateSearch: searchSchema,
  head: () => ({ meta: [{ title: "Sign in — WarehouseJobs.com" }] }),
  component: AuthPage,
});

const ALLOWED_NEXT_PREFIXES = [
  "about",
  "admin",
  "auth",
  "billing",
  "companies",
  "contact",
  "employer",
  "faq",
  "jobs",
  "pricing",
  "privacy",
  "seeker",
];

function safeNext(next: string | undefined): string {
  if (!next || typeof next !== "string") return "/";
  if (!next.startsWith("/") || next.startsWith("//")) return "/";
  if (next === "/") return "/";
  const seg = next.slice(1).split(/[/?#]/, 1)[0];
  return ALLOWED_NEXT_PREFIXES.includes(seg) ? next : "/";
}

function AuthPage() {
  const { mode, role, next } = Route.useSearch();
  const navigate = useNavigate();
  const { settings } = useSiteSettings();
  const { t } = useTranslation();
  const brandName = settings.branding.site_name;
  const isSignup = mode === "signup";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [selectedRole, setSelectedRole] = useState<"job_seeker" | "employer">(role ?? "job_seeker");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isSignup) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
            data: { display_name: displayName, role: selectedRole },
          },
        });
        if (error) throw error;
        const fallback = selectedRole === "employer" ? "/employer" : "/seeker";
        const dest = safeNext(next) === "/" ? fallback : safeNext(next);
        if (data.session) {
          toast.success("Account created.");
          navigate({ to: dest as never });
        } else {
          toast.success("Account created! Check your inbox to confirm your email, then sign in.");
          navigate({ to: "/auth", search: { mode: "login", next: dest } as never });
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Signed in.");
        navigate({ to: safeNext(next) as never });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid min-h-screen grid-cols-1 lg:grid-cols-2">
      <div className="relative hidden bg-[color:var(--ink)] p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="hazard-stripes absolute left-0 top-0 h-2 w-full" />
        <Link to="/" className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <HardHat className="h-5 w-5" strokeWidth={2.5} />
          </div>
          <span className="text-lg font-bold tracking-tight">{brandName}</span>
        </Link>
        <div className="max-w-md">
          <p className="label-caps text-primary">Built for the floor</p>
          <h2 className="mt-3 text-4xl font-bold leading-tight">Hire the dock, not the cubicle.</h2>
          <p className="mt-4 text-white/70">
            Forklift operators, pickers, packers, dock workers — qualified, in your ZIP, ready to
            start this week.
          </p>
        </div>
        <p className="text-xs text-white/40">© {new Date().getFullYear()} {brandName}</p>
      </div>

      <div className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-sm">
          <Link
            to="/"
            className="mb-8 flex items-center gap-2 text-sm text-muted-foreground hover:text-primary lg:hidden"
          >
            ← {t("common.backHome")}
          </Link>
          <p className="label-caps text-primary">{isSignup ? t("auth.getStarted") : t("auth.welcomeBack")}</p>
          <h1 className="mt-2 text-3xl font-bold text-[color:var(--ink)]">
            {isSignup ? t("auth.signUpTitle") : t("auth.signInTitle", { brand: brandName })}
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {isSignup
              ? selectedRole === "employer"
                ? t("auth.employerSub")
                : t("auth.seekerSub")
              : t("auth.loginSub")}
          </p>

          <form onSubmit={submit} className="mt-7 space-y-4">
            {isSignup && (
              <>
                <div className="space-y-1.5">
                  <Label>{t("auth.iAm")}</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {(["job_seeker", "employer"] as const).map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setSelectedRole(r)}
                        className={`rounded-md border px-3 py-2.5 text-sm font-semibold transition-colors ${
                          selectedRole === r
                            ? "border-primary bg-[color:var(--primary-tint)] text-[color:var(--ink)]"
                            : "border-border bg-card text-foreground hover:border-primary/40"
                        }`}
                      >
                        {r === "job_seeker" ? t("auth.jobSeeker") : t("auth.employer")}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="name">
                    {selectedRole === "employer" ? t("auth.yourName") : t("auth.fullName")}
                  </Label>
                  <Input
                    id="name"
                    required
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                  />
                </div>
              </>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="email">{t("auth.email")}</Label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">{t("auth.password")}</Label>
              <Input
                id="password"
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <Button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? t("auth.workingBtn") : isSignup ? t("auth.createAccount") : t("auth.signIn")}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            {isSignup ? t("auth.alreadyHave") : t("auth.newHere", { brand: brandName })}{" "}
            <Link
              to="/auth"
              search={{ mode: isSignup ? "login" : "signup", next } as never}
              className="font-semibold text-primary hover:underline"
            >
              {isSignup ? t("auth.signIn") : t("auth.createOne")}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
