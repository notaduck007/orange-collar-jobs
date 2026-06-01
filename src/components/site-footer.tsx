import { Link } from "@tanstack/react-router";
import { HardHat } from "lucide-react";

export function SiteFooter() {
  return (
    <footer className="mt-24 bg-[color:var(--charcoal)] text-white">
      <div className="hazard-stripes h-2 w-full" />
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <HardHat className="h-5 w-5" strokeWidth={2.5} />
            </div>
            <span className="text-base font-bold tracking-tight">WarehouseJobs</span>
          </div>
          <p className="mt-3 max-w-xs text-sm text-white/60">
            The job board built for warehouse workers and the companies that hire them.
          </p>
        </div>
        <div>
          <p className="label-caps mb-3 text-white/50">For Workers</p>
          <ul className="space-y-2 text-sm text-white/80">
            <li><Link to="/jobs" className="hover:text-primary">Browse jobs</Link></li>
            <li><Link to="/auth" search={{ mode: "signup" }} className="hover:text-primary">Create alerts</Link></li>
            <li><Link to="/faq" className="hover:text-primary">FAQ</Link></li>
          </ul>
        </div>
        <div>
          <p className="label-caps mb-3 text-white/50">For Employers</p>
          <ul className="space-y-2 text-sm text-white/80">
            <li><Link to="/pricing" className="hover:text-primary">Post a job</Link></li>
            <li><Link to="/pricing" className="hover:text-primary">Packages</Link></li>
            <li><Link to="/contact" className="hover:text-primary">Talk to sales</Link></li>
          </ul>
        </div>
        <div>
          <p className="label-caps mb-3 text-white/50">Company</p>
          <ul className="space-y-2 text-sm text-white/80">
            <li><Link to="/about" className="hover:text-primary">About</Link></li>
            <li><Link to="/contact" className="hover:text-primary">Contact</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 py-5 text-xs text-white/50 sm:flex-row sm:px-6">
          <p>© {new Date().getFullYear()} WarehouseJobs. All rights reserved.</p>
          <p>Built for the dock — boots-on-the-ground hiring.</p>
        </div>
      </div>
    </footer>
  );
}
