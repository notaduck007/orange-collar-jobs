import { Link } from "@tanstack/react-router";
import { HardHat, LogOut } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { useSiteSettings } from "@/lib/site-settings";
import { LanguageToggle } from "@/components/language-toggle";

export function SiteHeader() {
  const { user, role, signOut } = useAuth();
  const { settings } = useSiteSettings();
  const { t } = useTranslation();
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground shadow-[var(--shadow-orange)]">
            {settings.branding.logo_url ? (
              <img src={settings.branding.logo_url} alt="" className="h-5 w-5 object-contain" />
            ) : (
              <HardHat className="h-5 w-5" strokeWidth={2.5} />
            )}
          </div>
          <div className="flex flex-col leading-none">
            <span className="text-base font-bold tracking-tight text-[color:var(--ink)]">
              Warehouse<span className="text-primary">jobs.com</span>
            </span>

            <span className="label-caps text-[10px]">Hiring Now</span>
          </div>
        </Link>

        <nav className="hidden items-center gap-7 md:flex">
          <Link
            to="/jobs"
            className="text-sm font-medium text-[color:var(--ink)] hover:text-primary"
          >
            {t("common.findJobs")}
          </Link>
          <Link
            to="/pricing"
            className="text-sm font-medium text-[color:var(--ink)] hover:text-primary"
          >
            {t("common.forEmployers")}
          </Link>
          <Link
            to="/about"
            className="text-sm font-medium text-[color:var(--ink)] hover:text-primary"
          >
            {t("common.about")}
          </Link>
          <Link
            to="/mission"
            className="text-sm font-medium text-[color:var(--ink)] hover:text-primary"
          >
            {t("common.mission")}
          </Link>
          <Link
            to="/faq"
            className="text-sm font-medium text-[color:var(--ink)] hover:text-primary"
          >
            {t("common.faq")}
          </Link>
        </nav>

        <div className="flex items-center gap-2">
          <LanguageToggle variant="header" />
          {user ? (
            <>
              {role === "admin" ? (
                <Link to="/admin">
                  <Button
                    size="sm"
                    className="bg-primary text-primary-foreground shadow-[var(--shadow-orange)] hover:bg-[color:var(--primary-dark)]"
                  >
                    {t("common.adminDashboard")}
                  </Button>
                </Link>
              ) : (
                <>
                  {role === "employer" && (
                    <Link to="/employer">
                      <Button variant="outline" size="sm">
                        {t("common.employerDashboard")}
                      </Button>
                    </Link>
                  )}
                  {role === "job_seeker" && (
                    <Link to="/seeker">
                      <Button variant="outline" size="sm">
                        {t("common.myDashboard")}
                      </Button>
                    </Link>
                  )}
                </>
              )}
              <span className="hidden text-xs text-muted-foreground sm:inline">
                {role === "employer"
                  ? t("common.employer")
                  : role === "admin"
                    ? t("common.admin")
                    : t("common.jobSeeker")}
              </span>
              <Button variant="ghost" size="sm" onClick={() => signOut()} className="gap-1.5">
                <LogOut className="h-4 w-4" /> {t("common.signOut")}
              </Button>
            </>
          ) : (
            <>
              <Link to="/auth" search={{ mode: "login" }}>
                <Button variant="ghost" size="sm">
                  {t("common.signIn")}
                </Button>
              </Link>
              <Link
                to="/auth"
                search={{ mode: "signup", role: "employer", next: "/employer" } as never}
              >
                <Button
                  size="sm"
                  className="bg-primary text-primary-foreground shadow-[var(--shadow-orange)] hover:bg-[color:var(--primary-dark)]"
                >
                  {t("common.postJob")}
                </Button>
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
