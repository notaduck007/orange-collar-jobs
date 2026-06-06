import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, X, Pause } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/admin/ads")({
  head: () => ({ meta: [{ title: "Ad approvals — WarehouseJobs.com Admin" }] }),
  component: AdminAds,
});

type AdRow = {
  id: string;
  company_id: string | null;
  slot: string;
  image_url: string;
  target_url: string;
  start_date: string | null;
  end_date: string | null;
  status: string;
  impressions: number;
  clicks: number;
  created_at: string;
};

function AdminAds() {
  const qc = useQueryClient();
  const { data: ads = [] } = useQuery({
    queryKey: ["admin-ads"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("advertisements")
        .select("*, companies(name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as (AdRow & { companies: { name: string } | null })[];
    },
  });

  const setStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("advertisements").update({ status }).eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success(`Ad ${status}`);
      qc.invalidateQueries({ queryKey: ["admin-ads"] });
      qc.invalidateQueries({ queryKey: ["ads"] });
    }
  };

  const pending = ads.filter((a) => a.status === "pending");
  const others = ads.filter((a) => a.status !== "pending");

  return (
    <div>
      <p className="label-caps">Moderation</p>
      <h1 className="mt-1 text-2xl font-bold text-[color:var(--ink)]">Ad approval queue</h1>

      <section className="mt-6">
        <h2 className="mb-3 text-sm font-semibold text-[color:var(--ink)]">
          Pending review ({pending.length})
        </h2>
        <div className="grid gap-3">
          {pending.length === 0 && (
            <p className="text-sm text-muted-foreground">No ads waiting for review.</p>
          )}
          {pending.map((ad) => (
            <AdRowItem
              key={ad.id}
              ad={ad}
              onApprove={() => setStatus(ad.id, "active")}
              onReject={() => setStatus(ad.id, "rejected")}
            />
          ))}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="mb-3 text-sm font-semibold text-[color:var(--ink)]">All ads</h2>
        <div className="grid gap-3">
          {others.map((ad) => (
            <AdRowItem
              key={ad.id}
              ad={ad}
              onApprove={ad.status !== "active" ? () => setStatus(ad.id, "active") : undefined}
              onReject={ad.status !== "rejected" ? () => setStatus(ad.id, "rejected") : undefined}
              onPause={ad.status === "active" ? () => setStatus(ad.id, "paused") : undefined}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

function AdRowItem({
  ad,
  onApprove,
  onReject,
  onPause,
}: {
  ad: AdRow & { companies: { name: string } | null };
  onApprove?: () => void;
  onReject?: () => void;
  onPause?: () => void;
}) {
  const colors: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-900",
    active: "bg-green-100 text-green-900",
    rejected: "bg-red-100 text-red-900",
    paused: "bg-gray-100 text-gray-900",
  };
  return (
    <div className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4 sm:flex-row sm:items-center">
      <img src={ad.image_url} alt="creative" className="h-20 w-32 shrink-0 rounded object-cover" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-semibold text-[color:var(--ink)]">{ad.companies?.name ?? "Unknown"}</p>
          <Badge className={`${colors[ad.status]} border-0 capitalize`}>{ad.status}</Badge>
          <span className="text-xs text-muted-foreground">{ad.slot}</span>
        </div>
        <p className="mt-1 truncate text-xs text-muted-foreground">→ {ad.target_url}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {ad.start_date ?? "Anytime"} → {ad.end_date ?? "No end"} · {ad.impressions} impressions ·{" "}
          {ad.clicks} clicks
        </p>
      </div>
      <div className="flex gap-2">
        {onApprove && (
          <Button size="sm" onClick={onApprove} className="btn-primary gap-1">
            <Check className="h-4 w-4" /> Approve
          </Button>
        )}
        {onPause && (
          <Button size="sm" variant="outline" onClick={onPause} className="gap-1">
            <Pause className="h-4 w-4" /> Pause
          </Button>
        )}
        {onReject && (
          <Button size="sm" variant="outline" onClick={onReject} className="gap-1">
            <X className="h-4 w-4" /> Reject
          </Button>
        )}
      </div>
    </div>
  );
}
