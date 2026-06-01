import { Link } from "@tanstack/react-router";
import { HardHat, LogOut } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";

export function SiteHeader() {
  const { user, role, signOut } = useAuth();
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground shadow-[var(--shadow-orange)]">
            <HardHat className="h-5 w-5" strokeWidth={2.5} />
          </div>
          <div className="flex flex-col leading-none">
            <span className="text-base font-bold tracking-tight text-[color:var(--ink)]">DockHire</span>
            <span className="label-caps text-[10px]">Warehouse Jobs</span>
          </div>
        </Link>

        <nav className="hidden items-center gap-7 md:flex">
          <Link to="/jobs" className="text-sm font-medium text-[color:var(--ink)] hover:text-primary">Find Jobs</Link>
          <Link to="/pricing" className="text-sm font-medium text-[color:var(--ink)] hover:text-primary">For Employers</Link>
          <Link to="/about" className="text-sm font-medium text-[color:var(--ink)] hover:text-primary">About</Link>
          <Link to="/faq" className="text-sm font-medium text-[color:var(--ink)] hover:text-primary">FAQ</Link>
        </nav>

        <div className="flex items-center gap-2">
          {user ? (
            <>
              <span className="hidden text-xs text-muted-foreground sm:inline">
                {role === "employer" ? "Employer" : role === "admin" ? "Admin" : "Job Seeker"}
              </span>
              <Button variant="ghost" size="sm" onClick={() => signOut()} className="gap-1.5">
                <LogOut className="h-4 w-4" /> Sign out
              </Button>
            </>
          ) : (
            <>
              <Link to="/auth" search={{ mode: "login" }}>
                <Button variant="ghost" size="sm">Sign in</Button>
              </Link>
              <Link to="/pricing">
                <Button size="sm" className="bg-primary text-primary-foreground shadow-[var(--shadow-orange)] hover:bg-[color:var(--primary-dark)]">
                  Post a Job
                </Button>
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
