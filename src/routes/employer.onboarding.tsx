import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Upload, Building2 } from "lucide-react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { slugify, uniqueSlug } from "@/lib/slug";
import { startCheckout } from "@/lib/checkout";
import crewImage from "@/assets/crew-productive.webp";

export const Route = createFileRoute("/employer/onboarding")({
  validateSearch: (search: Record<string, unknown>) => ({
    next: typeof search.next === "string" ? search.next : undefined,
    pkg: typeof search.pkg === "string" ? search.pkg : undefined,
  }),
  head: () => ({ meta: [{ title: "Company Profile — WarehouseJobs Employers" }] }),
  component: OnboardingPage,
});

const INDUSTRIES = [
  "3PL / Logistics",
  "Manufacturing",
  "Distribution",
  "E-commerce / Fulfillment",
  "Cold Storage",
  "Retail",
  "Food & Beverage",
  "Automotive",
  "Other",
];

const schema = z.object({
  name: z.string().trim().min(2, "Company name is required").max(120),
  website: z.string().trim().url("Must be a valid URL").or(z.literal("")),
  industry: z.string().min(1, "Pick an industry"),
  hq_city: z.string().trim().min(1, "City is required").max(80),
  hq_state: z.string().trim().min(2, "State is required").max(40),
  description: z.string().trim().max(2000).optional(),
});

function OnboardingPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { next, pkg } = Route.useSearch();
  const qc = useQueryClient();

  const { data: existing } = useQuery({
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

  const [form, setForm] = useState({
    name: "",
    website: "",
    industry: "",
    hq_city: "",
    hq_state: "",
    description: "",
  });
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (existing) {
      setForm({
        name: existing.name ?? "",
        website: existing.website ?? "",
        industry: existing.industry ?? "",
        hq_city: existing.hq_city ?? "",
        hq_state: existing.hq_state ?? "",
        description: existing.description ?? "",
      });
      setLogoUrl(existing.logo_url);
    }
  }, [existing]);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Logo must be under 2 MB");
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() ?? "png";
      const path = `${user.id}/logo-${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from("company-logos")
        .upload(path, file, { upsert: true });
      if (error) throw error;
      const { data } = supabase.storage.from("company-logos").getPublicUrl(path);
      setLogoUrl(data.publicUrl);
      toast.success("Logo uploaded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const result = schema.safeParse(form);
    if (!result.success) {
      toast.error(result.error.issues[0].message);
      return;
    }
    setSaving(true);
    try {
      if (existing) {
        const { error } = await supabase
          .from("companies")
          .update({
            name: form.name,
            website: form.website || null,
            industry: form.industry,
            hq_city: form.hq_city,
            hq_state: form.hq_state,
            location: `${form.hq_city}, ${form.hq_state}`,
            description: form.description || null,
            logo_url: logoUrl,
          })
          .eq("id", existing.id);
        if (error) throw error;
        toast.success("Company profile updated");
      } else {
        const slug = uniqueSlug(form.name);
        const { data: created, error } = await supabase
          .from("companies")
          .insert({
            owner_id: user.id,
            name: form.name,
            slug,
            website: form.website || null,
            industry: form.industry,
            hq_city: form.hq_city,
            hq_state: form.hq_state,
            location: `${form.hq_city}, ${form.hq_state}`,
            description: form.description || null,
            logo_url: logoUrl,
          })
          .select("id")
          .single();
        if (error) throw error;
        // Free Starter package: 1 post, 30 days, $0 order — best-effort, idempotent
        if (created?.id) {
          const { error: grantErr } = await supabase.rpc("grant_starter_package", {
            _company_id: created.id,
          });
          if (grantErr) console.warn("starter grant failed", grantErr.message);
        }
        toast.success("Company created — your free Starter package is ready (1 post, 30 days)");
      }
      await qc.invalidateQueries({ queryKey: ["employer-company", user.id] });
      navigate({ to: (next ?? "/employer") as never });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0">
          <p className="label-caps text-primary">{existing ? "Edit company" : "Step 1 of 1"}</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-[color:var(--ink)]">
            {existing ? "Company profile" : "Set up your company"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This is what job seekers see at the top of every listing. Make it count.
          </p>

          <form
            onSubmit={save}
            className="mt-8 space-y-6 rounded-xl border border-border bg-card p-6 sm:p-8"
          >
            <div>
              <Label>Company logo</Label>
              <div className="mt-2 flex items-center gap-4">
                <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted">
                  {logoUrl ? (
                    <img src={logoUrl} alt="Logo" className="h-full w-full object-cover" />
                  ) : (
                    <Building2 className="h-8 w-8 text-muted-foreground" />
                  )}
                </div>
                <label className="cursor-pointer">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    className="hidden"
                  />
                  <span className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm font-medium hover:bg-muted">
                    <Upload className="h-4 w-4" /> {uploading ? "Uploading…" : "Upload logo"}
                  </span>
                </label>
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">PNG or JPG, max 2 MB.</p>
            </div>

            <Field
              id="name"
              label="Company name"
              value={form.name}
              onChange={(v) => setForm({ ...form, name: v })}
              required
            />

            <Field
              id="website"
              label="Website"
              type="url"
              placeholder="https://acme.com"
              value={form.website}
              onChange={(v) => setForm({ ...form, website: v })}
            />

            <div className="space-y-1.5">
              <Label>Industry</Label>
              <Select
                value={form.industry}
                onValueChange={(v) => setForm({ ...form, industry: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pick one" />
                </SelectTrigger>
                <SelectContent>
                  {INDUSTRIES.map((i) => (
                    <SelectItem key={i} value={i}>
                      {i}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-4 sm:grid-cols-[1fr_120px]">
              <Field
                id="hq_city"
                label="HQ city"
                value={form.hq_city}
                onChange={(v) => setForm({ ...form, hq_city: v })}
                required
              />
              <Field
                id="hq_state"
                label="State"
                placeholder="OH"
                value={form.hq_state}
                onChange={(v) => setForm({ ...form, hq_state: v.toUpperCase().slice(0, 2) })}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="description">About your warehouse</Label>
              <Textarea
                id="description"
                rows={5}
                placeholder="Briefly describe your operation — what you ship, shift culture, perks like climate-controlled, on-site break room, etc."
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                maxLength={2000}
              />
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-border pt-5">
              <Button type="submit" disabled={saving || uploading} className="btn-primary">
                {saving ? "Saving…" : existing ? "Save changes" : "Create company → Dashboard"}
              </Button>
            </div>
          </form>
        </div>

        <aside className="hidden lg:block">
          <div className="sticky top-20 overflow-hidden rounded-xl border border-border bg-card">
            <img
              src={crewImage}
              alt="A strong, diverse warehouse crew collaborating at a conveyor pick station — the kind of team you'll reach on WarehouseJobs."
              width={1600}
              height={1067}
              loading="lazy"
              decoding="async"
              className="aspect-[4/5] w-full object-cover"
            />
            <div className="border-t border-border p-4">
              <p className="label-caps text-primary">The crew you'll reach</p>
              <p className="mt-1 text-sm text-muted-foreground">
                18k+ active warehouse workers — forklift-certified, ready to start, in your ZIP.
              </p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  type = "text",
  required,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>
        {label}
        {required && <span className="text-destructive"> *</span>}
      </Label>
      <Input
        id={id}
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
      />
    </div>
  );
}

// Manual slugify left for future use
void slugify;
