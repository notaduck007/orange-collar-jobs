import { useEffect, useMemo, useRef } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Megaphone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export type AdSlotName = "home_banner" | "search_inline" | "job_sidebar";

type Ad = {
  id: string;
  title?: string | null;
  image_url: string;
  target_url: string;
  slot: string;
};

const FALLBACKS: Record<AdSlotName, React.ReactNode> = {
  home_banner: (
    <Link
      to="/pricing"
      className="relative block overflow-hidden rounded-2xl border border-border bg-[color:var(--ink)] p-6 text-white sm:p-8"
    >
      <div className="hazard-stripes absolute left-0 top-0 h-1.5 w-full" />
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="label-caps text-white/50">Sponsored slot — yours for $299/month</p>
          <p className="mt-1 text-xl font-bold">
            Put your warehouse brand on the WarehouseJobs homepage.
          </p>
          <p className="mt-1 text-sm text-white/70">
            Reach thousands of forklift-certified workers each week.
          </p>
        </div>
        <span className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
          See packages →
        </span>
      </div>
    </Link>
  ),
  search_inline: (
    <Link
      to="/pricing"
      className="group relative block overflow-hidden rounded-lg border border-border bg-[color:var(--ink)] p-5 text-white"
    >
      <div className="hazard-stripes absolute left-0 top-0 h-1 w-full" />
      <div className="flex items-start gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <Megaphone className="h-5 w-5" />
        </div>
        <div>
          <p className="label-caps text-white/50">Sponsored</p>
          <p className="mt-0.5 text-base font-semibold">
            Hire warehouse workers faster — see posting packages
          </p>
          <p className="mt-1 text-sm text-white/60">
            From $49 a post. Featured upgrades and ZIP-targeted reach.
          </p>
        </div>
      </div>
    </Link>
  ),
  job_sidebar: (
    <Link
      to="/pricing"
      className="block overflow-hidden rounded-xl border border-border bg-[color:var(--ink)] p-5 text-white"
    >
      <div className="hazard-stripes mb-3 h-1.5 w-12 rounded-sm" />
      <p className="text-sm font-semibold leading-snug">
        Hiring? Get this same placement for your jobs.
      </p>
      <p className="mt-1 text-xs text-white/60">Featured upgrades start at $39 per post.</p>
      <p className="mt-3 text-xs font-semibold text-primary">See packages →</p>
    </Link>
  ),
};

export function AdSlot({ slot, className }: { slot: AdSlotName; className?: string }) {
  const { data: ads = [] } = useQuery({
    queryKey: ["ads", slot],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const today = new Date().toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from("advertisements")
        .select("id, image_url, target_url, slot, company_id")
        .eq("slot", slot)
        .eq("status", "active")
        .or(`start_date.is.null,start_date.lte.${today}`)
        .or(`end_date.is.null,end_date.gte.${today}`);
      if (error) throw error;
      return (data ?? []) as Ad[];
    },
  });

  // Pick one ad per mount for rotation across page loads
  const ad = useMemo(() => {
    if (!ads.length) return null;
    return ads[Math.floor(Math.random() * ads.length)];
  }, [ads]);

  // Count impression once per mounted ad (via edge function with debounce)
  const impressionFiredFor = useRef<string | null>(null);
  useEffect(() => {
    if (!ad || impressionFiredFor.current === ad.id) return;
    impressionFiredFor.current = ad.id;
    void supabase.functions.invoke("ad-event", {
      body: { advertisement_id: ad.id, type: "impression", ad_slot: slot },
    });
  }, [ad, slot]);

  if (!ad) {
    return <div className={className}>{FALLBACKS[slot]}</div>;
  }

  const handleClick = () => {
    void supabase.functions.invoke("ad-event", {
      body: { advertisement_id: ad.id, type: "click", ad_slot: slot },
    });
  };

  const sizeClass =
    slot === "home_banner"
      ? "aspect-[4/1] sm:aspect-[6/1]"
      : slot === "job_sidebar"
        ? "aspect-[4/5]"
        : "aspect-[5/1]";

  return (
    <a
      href={ad.target_url}
      target="_blank"
      rel="noopener noreferrer sponsored"
      onClick={handleClick}
      className={`group relative block overflow-hidden rounded-xl border border-border bg-card ${className ?? ""}`}
    >
      <span className="pointer-events-none absolute left-2 top-2 z-10 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white">
        Sponsored
      </span>
      <img
        src={ad.image_url}
        alt="Advertisement"
        loading="lazy"
        className={`w-full object-cover ${sizeClass} transition-transform group-hover:scale-[1.02]`}
      />
    </a>
  );
}
