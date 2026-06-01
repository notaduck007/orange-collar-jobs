import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Search, ShieldCheck, ShieldOff, Eye, Ban, Play } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/admin/companies")({
  head: () => ({ meta: [{ title: "Companies — DockHire Admin" }] }),
  component: AdminCompanies,
});

function AdminCompanies() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");

  const { data: companies = [] } = useQuery({
    queryKey: ["admin-companies", q],
    queryFn: async () => {
      let query = supabase.from("companies").select("*").order("created_at", { ascending: false });
      if (q) query = query.ilike("name", `%${q}%`);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });

  const updateCompany = async (id: string, patch: Record<string, unknown>) => {
    const { error } = await supabase.from("companies").update(patch).eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Updated");
      qc.invalidateQueries({ queryKey: ["admin-companies"] });
    }
  };

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="label-caps">Companies</p>
          <h1 className="mt-1 text-2xl font-bold text-[color:var(--ink)]">All companies</h1>
        </div>
        <div className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name…" className="w-56 bg-transparent focus:outline-none text-sm" />
        </div>
      </div>

      <div className="grid gap-3">
        {companies.map((c) => (
          <div key={c.id} className="rounded-lg border border-border bg-card p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                {c.logo_url ? (
                  <img src={c.logo_url} alt={c.name} className="h-12 w-12 rounded object-cover" />
                ) : (
                  <div className="h-12 w-12 rounded bg-muted" />
                )}
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-[color:var(--ink)]">{c.name}</p>
                    {c.verified && <Badge className="border-0 bg-blue-100 text-blue-900">Verified</Badge>}
                    {c.status === "suspended" && <Badge className="border-0 bg-red-100 text-red-900">Suspended</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {[c.industry, c.hq_city, c.hq_state].filter(Boolean).join(" · ") || "—"}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {c.posting_credits} post · {c.featured_credits} featured credits
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link to="/admin/jobs" search={{ company: c.id } as never}>
                  <Button size="sm" variant="outline" className="gap-1"><Eye className="h-3.5 w-3.5" /> View jobs</Button>
                </Link>
                <Button size="sm" variant="outline" onClick={() => updateCompany(c.id, { verified: !c.verified })} className="gap-1">
                  {c.verified ? <><ShieldOff className="h-3.5 w-3.5" /> Unverify</> : <><ShieldCheck className="h-3.5 w-3.5" /> Verify</>}
                </Button>
                {c.status === "suspended" ? (
                  <Button size="sm" variant="outline" onClick={() => updateCompany(c.id, { status: "active" })} className="gap-1">
                    <Play className="h-3.5 w-3.5" /> Reactivate
                  </Button>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => updateCompany(c.id, { status: "suspended" })} className="gap-1">
                    <Ban className="h-3.5 w-3.5" /> Suspend
                  </Button>
                )}
                <CreditsDialog company={c} onSave={(patch) => updateCompany(c.id, patch)} />
              </div>
            </div>
          </div>
        ))}
        {companies.length === 0 && <p className="text-sm text-muted-foreground">No companies match.</p>}
      </div>
    </div>
  );
}

function CreditsDialog({ company, onSave }: { company: { id: string; name: string; posting_credits: number; featured_credits: number }; onSave: (patch: Record<string, unknown>) => void }) {
  const [open, setOpen] = useState(false);
  const [posting, setPosting] = useState(company.posting_credits);
  const [featured, setFeatured] = useState(company.featured_credits);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">Adjust credits</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Adjust credits — {company.name}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Posting credits</Label>
            <Input type="number" value={posting} onChange={(e) => setPosting(Number(e.target.value))} className="mt-1" />
          </div>
          <div>
            <Label>Featured credits</Label>
            <Input type="number" value={featured} onChange={(e) => setFeatured(Number(e.target.value))} className="mt-1" />
          </div>
          <Button onClick={() => { onSave({ posting_credits: posting, featured_credits: featured }); setOpen(false); }} className="btn-primary w-full">
            Save
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
