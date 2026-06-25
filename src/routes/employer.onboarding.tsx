import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Upload, Building2 } from "lucide-react";
import { z } from "zod";
import { useAuth } from "@/lib/auth";
import { apiClient, ApiError } from "@/lib/api-client";
import { getAccessToken } from "@/lib/auth-session";
import type { CompanyProfile } from "@/lib/api-client";
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
import { startCheckout } from "@/lib/checkout";
import crewImage from "@/assets/crew-productive.webp";

export const Route = createFileRoute("/employer/onboarding")({
  validateSearch: z
    .object({
      next: z.string().optional(),
      pkg: z.string().optional(),
    })
    .catch({}),
  head: () => ({ meta: [{ title: "Company Profile — WarehouseJobs.com Employers" }] }),
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

  const { data: existing } = useQuery<CompanyProfile | null>({
    queryKey: ["employer-company", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const token = getAccessToken();
      if (!token) return null;
      try {
        return await apiClient.getMyCompany(token);
      } catch (err) {
        if (err instanceof ApiError && err.statusCode === 404) return null;
        throw err;
      }
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
        hq_city: existing.hqCity ?? "",
        hq_state: existing.hqState ?? "",
        description: existing.description ?? "",
      });
      setLogoUrl(existing.logoUrl ?? null);
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
      const token = getAccessToken();
      if (!token) throw new Error("Sign in before uploading a logo.");
      const { url } = await apiClient.uploadLogo(token, file);
      setLogoUrl(url);
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
    const token = getAccessToken();
    if (!token) {
      toast.error("Session expired — please sign in again.");
      return;
    }
    setSaving(true);
    try {
      const body = {
        name: form.name,
        website: form.website || null,
        industry: form.industry,
        hqCity: form.hq_city,
        hqState: form.hq_state,
        description: form.description || null,
        logoUrl: logoUrl ?? null,
      };

      if (existing) {
        await apiClient.updateCompany(token, existing.id, body);
        toast.success("Company profile updated");
      } else {
        await apiClient.createCompany(token, body);
        toast.success("Company created — your first job post is free and ready. Let's post it.", {
          action: {
            label: "Post your free job",
            onClick: () => navigate({ to: "/employer/jobs/new" }),
          },
        });
      }
      await qc.invalidateQueries({ queryKey: ["employer-company", user.id] });
      if (pkg && !existing) {
        const checkoutResult = await startCheckout(pkg, "purchase");
        if (checkoutResult?.error) {
          toast.error(checkoutResult.error);
          navigate({ to: "/employer" });
        }
        return;
      }
      navigate({ to: (next ?? "/employer") as never });
    } catch (err) {
      if (err instanceof ApiError && err.statusCode === 401) {
        toast.error("Session expired — please sign out and sign back in.");
      } else if (err instanceof ApiError && err.statusCode === 409) {
        toast.error("A company already exists for your account. Refresh the page.");
      } else {
        toast.error(err instanceof Error ? err.message : "Save failed");
      }
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
              alt="A strong, diverse warehouse crew collaborating at a conveyor pick station — the kind of team you'll reach on WarehouseJobs.com."
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
