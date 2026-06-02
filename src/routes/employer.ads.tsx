import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Upload, Plus, MousePointerClick, Eye, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/employer/ads")({
  head: () => ({ meta: [{ title: "Advertising — WarehouseJobs Employer" }] }),
  validateSearch: (s: Record<string, unknown>) => ({
    checkout: typeof s.checkout === "string" ? s.checkout : undefined,
  }),
  component: EmployerAds,
});

const SLOTS = [
  { value: "home_banner", label: "Homepage Banner" },
  { value: "search_inline", label: "Search Results Inline" },
  { value: "job_sidebar", label: "Job Detail Sidebar" },
];

function EmployerAds() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const { checkout } = Route.useSearch();

  const { data: company } = useQuery({
    queryKey: ["employer-company", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("companies")
        .select("*")
        .eq("owner_id", user!.id)
        .maybeSingle();
      return data;
    },
  });

  const { data: ads = [], refetch } = useQuery({
    queryKey: ["employer-ads", company?.id],
    enabled: !!company,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("advertisements")
        .select("*")
        .eq("company_id", company!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const deleteAd = async (id: string) => {
    if (!confirm("Delete this ad?")) return;
    const { error } = await supabase.from("advertisements").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Ad deleted");
      refetch();
    }
  };

  return (
    <div>
      {checkout === "success" && (
        <div className="mb-4 rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-900">
          Payment received — your ad is queued for admin approval.
        </div>
      )}
      {checkout === "cancelled" && (
        <div className="mb-4 rounded-md border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-900">
          Checkout cancelled. Your ad is saved as pending; complete payment to activate.
        </div>
      )}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="label-caps">Advertising</p>
          <h1 className="mt-1 text-2xl font-bold text-[color:var(--ink)]">Your ad campaigns</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Upload a creative, set your dates, and we'll review for approval within 1 business day.
          </p>
        </div>
        <div className="flex gap-2">
          <Link to="/pricing">
            <Button variant="outline">Buy ad package</Button>
          </Link>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="btn-primary gap-1.5">
                <Plus className="h-4 w-4" /> New ad
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Create advertisement</DialogTitle>
              </DialogHeader>
              {company ? (
                <NewAdForm
                  companyId={company.id}
                  ownerId={user!.id}
                  onCreated={() => {
                    setOpen(false);
                    qc.invalidateQueries({ queryKey: ["employer-ads", company.id] });
                  }}
                />
              ) : (
                <p className="text-sm text-muted-foreground">
                  Complete your company profile first.
                </p>
              )}
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid gap-3">
        {ads.length === 0 && (
          <div className="rounded-lg border border-dashed border-border bg-card p-10 text-center">
            <p className="text-base font-semibold text-[color:var(--ink)]">No ads yet.</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Create your first ad to promote your jobs across WarehouseJobs.
            </p>
          </div>
        )}
        {ads.map((ad) => (
          <div
            key={ad.id}
            className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4 sm:flex-row sm:items-center"
          >
            <img
              src={ad.image_url}
              alt="ad creative"
              className="h-20 w-32 shrink-0 rounded object-cover"
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold text-[color:var(--ink)]">
                  {SLOTS.find((s) => s.value === ad.slot)?.label ?? ad.slot}
                </p>
                <StatusBadge status={ad.status} />
              </div>
              <p className="mt-1 truncate text-xs text-muted-foreground">→ {ad.target_url}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {ad.start_date ?? "Anytime"} → {ad.end_date ?? "No end"}
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Eye className="h-3.5 w-3.5" /> {ad.impressions}
              </span>
              <span className="inline-flex items-center gap-1">
                <MousePointerClick className="h-3.5 w-3.5" /> {ad.clicks}
              </span>
              <Button size="icon" variant="ghost" onClick={() => deleteAd(ad.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-900",
    active: "bg-green-100 text-green-900",
    rejected: "bg-red-100 text-red-900",
    paused: "bg-gray-100 text-gray-900",
  };
  return <Badge className={`${map[status] ?? "bg-gray-100"} border-0 capitalize`}>{status}</Badge>;
}

function NewAdForm({
  companyId,
  ownerId,
  onCreated,
}: {
  companyId: string;
  ownerId: string;
  onCreated: () => void;
}) {
  const [slot, setSlot] = useState<string>("search_inline");
  const [targetUrl, setTargetUrl] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return toast.error("Upload a creative image.");
    if (!targetUrl) return toast.error("Add a target URL.");
    setSubmitting(true);
    try {
      // Find a matching ad package for this slot to charge for
      const { data: pkg } = await supabase
        .from("packages")
        .select("id, name, price_cents")
        .eq("kind", "ad")
        .eq("active", true)
        .eq("ad_slot", slot)
        .order("price_cents", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (!pkg) {
        toast.error("No ad package available for this slot. Visit Pricing.");
        setSubmitting(false);
        return;
      }

      const ext = file.name.split(".").pop();
      const path = `${ownerId}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("ad-creatives")
        .upload(path, file, { upsert: false });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("ad-creatives").getPublicUrl(path);

      const { error } = await supabase.from("advertisements").insert({
        company_id: companyId,
        slot,
        image_url: pub.publicUrl,
        target_url: targetUrl,
        start_date: startDate || null,
        end_date: endDate || null,
        status: "pending",
      });
      if (error) throw error;

      // Kick off Stripe checkout for the ad package
      const origin = window.location.origin;
      const { data: checkout, error: ckErr } = await supabase.functions.invoke("create-checkout", {
        body: {
          package_id: pkg.id,
          company_id: companyId,
          success_url: `${origin}/employer/ads?checkout=success`,
          cancel_url: `${origin}/employer/ads?checkout=cancelled`,
        },
      });
      if (ckErr) throw ckErr;
      if (checkout?.url) {
        window.location.href = checkout.url;
        return;
      }

      toast.success("Submitted for review.");
      onCreated();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to create ad");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <Label>Placement slot</Label>
        <Select value={slot} onValueChange={setSlot}>
          <SelectTrigger className="mt-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SLOTS.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>Creative image</Label>
        <label className="mt-1 flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-border bg-muted/30 p-3 text-sm hover:border-primary">
          <Upload className="h-4 w-4 text-primary" />
          <span className="truncate">{file ? file.name : "Click to upload (PNG, JPG)"}</span>
          <input
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </label>
        <p className="mt-1 text-xs text-muted-foreground">
          Recommended: banner 1200×300 · sidebar 400×500 · inline 1000×200.
        </p>
      </div>
      <div>
        <Label>Target URL</Label>
        <Input
          value={targetUrl}
          onChange={(e) => setTargetUrl(e.target.value)}
          placeholder="https://yourcompany.com/careers"
          className="mt-1"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Start date</Label>
          <Input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="mt-1"
          />
        </div>
        <div>
          <Label>End date</Label>
          <Input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="mt-1"
          />
        </div>
      </div>
      <Button type="submit" disabled={submitting} className="btn-primary w-full">
        {submitting ? "Submitting…" : "Submit for review"}
      </Button>
    </form>
  );
}
