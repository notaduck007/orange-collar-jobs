import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Settings as SettingsIcon, Save, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAdminPermissions } from "@/lib/admin-permissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import type { BrandingSettings, DefaultsSettings, ToggleSettings } from "@/lib/site-settings";

export const Route = createFileRoute("/admin/settings")({
  component: AdminSettingsPage,
});

type FlagRow = {
  key: string;
  enabled: boolean;
  rollout_pct: number;
  description: string | null;
};

function AdminSettingsPage() {
  const { level, loading: permLoading } = useAdminPermissions();
  const qc = useQueryClient();
  const isSuper = level === "super_admin";

  const { data: settingsRows, isLoading: sLoading } = useQuery({
    queryKey: ["admin-site-settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("site_settings").select("*");
      if (error) throw error;
      return data;
    },
  });

  const { data: flagRows, isLoading: fLoading } = useQuery({
    queryKey: ["admin-feature-flags"],
    queryFn: async () => {
      const { data, error } = await supabase.from("feature_flags").select("*").order("key");
      if (error) throw error;
      return (data ?? []) as FlagRow[];
    },
  });

  const [branding, setBranding] = useState<BrandingSettings>({
    site_name: "",
    logo_url: "",
    support_email: "",
  });
  const [defaults, setDefaults] = useState<DefaultsSettings>({
    job_duration_days: 30,
    free_post_allowance: 1,
  });
  const [toggles, setToggles] = useState<ToggleSettings>({
    reviews_enabled: true,
    candidate_search_enabled: true,
    require_email_verification: false,
  });
  const [flags, setFlags] = useState<FlagRow[]>([]);
  const [newFlagKey, setNewFlagKey] = useState("");

  useEffect(() => {
    if (!settingsRows) return;
    const get = (k: string) =>
      (settingsRows.find((r) => r.key === k)?.value ?? {}) as Record<string, unknown>;
    setBranding({ ...branding, ...(get("branding") as Partial<BrandingSettings>) });
    setDefaults({ ...defaults, ...(get("defaults") as Partial<DefaultsSettings>) });
    setToggles({ ...toggles, ...(get("toggles") as Partial<ToggleSettings>) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settingsRows]);

  useEffect(() => {
    if (flagRows) setFlags(flagRows);
  }, [flagRows]);

  async function saveKey(key: string, value: unknown) {
    const { error } = await supabase
      .from("site_settings")
      .update({ value: value as never, updated_at: new Date().toISOString() })
      .eq("key", key);
    if (error) {
      toast.error(`Failed to save ${key}: ${error.message}`);
      return false;
    }
    return true;
  }

  async function handleSaveAll() {
    const r1 = await saveKey("branding", branding);
    const r2 = await saveKey("defaults", defaults);
    const r3 = await saveKey("toggles", toggles);
    if (r1 && r2 && r3) {
      toast.success("Settings saved");
      qc.invalidateQueries({ queryKey: ["public-site-settings"] });
      qc.invalidateQueries({ queryKey: ["admin-site-settings"] });
    }
  }

  async function handleSaveFlag(f: FlagRow) {
    const { error } = await supabase
      .from("feature_flags")
      .update({
        enabled: f.enabled,
        rollout_pct: f.rollout_pct,
        description: f.description,
        updated_at: new Date().toISOString(),
      })
      .eq("key", f.key);
    if (error) toast.error(error.message);
    else {
      toast.success(`Flag "${f.key}" saved`);
      qc.invalidateQueries({ queryKey: ["public-site-settings"] });
    }
  }

  async function handleAddFlag() {
    const k = newFlagKey
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, "_");
    if (!k) return;
    const { error } = await supabase
      .from("feature_flags")
      .insert({ key: k, enabled: false, rollout_pct: 0, description: "" });
    if (error) toast.error(error.message);
    else {
      setNewFlagKey("");
      qc.invalidateQueries({ queryKey: ["admin-feature-flags"] });
    }
  }

  async function handleDeleteFlag(key: string) {
    if (!confirm(`Delete flag "${key}"?`)) return;
    const { error } = await supabase.from("feature_flags").delete().eq("key", key);
    if (error) toast.error(error.message);
    else qc.invalidateQueries({ queryKey: ["admin-feature-flags"] });
  }

  if (permLoading || sLoading || fLoading) {
    return <div className="p-6 text-sm text-muted-foreground">Loading settings…</div>;
  }

  if (!isSuper) {
    return (
      <div className="rounded-lg border border-border bg-card p-10 text-center">
        <SettingsIcon className="mx-auto h-10 w-10 text-muted-foreground" />
        <h2 className="mt-3 text-lg font-semibold">Super admin only</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Only super admins can edit site settings and feature flags.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Site Settings</h1>
          <p className="text-sm text-muted-foreground">
            Edit branding, defaults, toggles, and feature flags. Changes take effect immediately.
          </p>
        </div>
      </div>

      <Tabs defaultValue="branding" className="space-y-4">
        <TabsList>
          <TabsTrigger value="branding">Branding</TabsTrigger>
          <TabsTrigger value="defaults">Defaults</TabsTrigger>
          <TabsTrigger value="toggles">Toggles</TabsTrigger>
          <TabsTrigger value="flags">Feature Flags</TabsTrigger>
        </TabsList>

        <TabsContent value="branding">
          <Card>
            <CardHeader>
              <CardTitle>Branding</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Site name</Label>
                <Input
                  value={branding.site_name}
                  onChange={(e) => setBranding({ ...branding, site_name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Logo URL</Label>
                <Input
                  value={branding.logo_url}
                  onChange={(e) => setBranding({ ...branding, logo_url: e.target.value })}
                  placeholder="https://…"
                />
              </div>
              <div className="space-y-2">
                <Label>Support email</Label>
                <Input
                  type="email"
                  value={branding.support_email}
                  onChange={(e) => setBranding({ ...branding, support_email: e.target.value })}
                />
              </div>
              <Button onClick={handleSaveAll}>
                <Save className="mr-2 h-4 w-4" /> Save
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="defaults">
          <Card>
            <CardHeader>
              <CardTitle>Defaults</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Default job duration (days)</Label>
                <Input
                  type="number"
                  min={1}
                  max={365}
                  value={defaults.job_duration_days}
                  onChange={(e) =>
                    setDefaults({ ...defaults, job_duration_days: Number(e.target.value) || 30 })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Free post allowance per company</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={defaults.free_post_allowance}
                  onChange={(e) =>
                    setDefaults({ ...defaults, free_post_allowance: Number(e.target.value) || 0 })
                  }
                />
              </div>
              <Button onClick={handleSaveAll}>
                <Save className="mr-2 h-4 w-4" /> Save
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="toggles">
          <Card>
            <CardHeader>
              <CardTitle>Site Toggles</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <ToggleRow
                label="Reviews enabled"
                description="Allow workers to submit and view company reviews."
                checked={toggles.reviews_enabled}
                onChange={(v) => setToggles({ ...toggles, reviews_enabled: v })}
              />
              <ToggleRow
                label="Candidate search enabled"
                description="Allow employers to search the candidate database."
                checked={toggles.candidate_search_enabled}
                onChange={(v) => setToggles({ ...toggles, candidate_search_enabled: v })}
              />
              <ToggleRow
                label="Require email verification"
                description="New accounts must verify email before signing in."
                checked={toggles.require_email_verification}
                onChange={(v) => setToggles({ ...toggles, require_email_verification: v })}
              />
              <Button onClick={handleSaveAll}>
                <Save className="mr-2 h-4 w-4" /> Save
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="flags">
          <Card>
            <CardHeader>
              <CardTitle>Feature Flags</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  placeholder="new_flag_key"
                  value={newFlagKey}
                  onChange={(e) => setNewFlagKey(e.target.value)}
                />
                <Button onClick={handleAddFlag}>
                  <Plus className="mr-2 h-4 w-4" /> Add
                </Button>
              </div>
              <div className="space-y-3">
                {flags.map((f, i) => (
                  <div
                    key={f.key}
                    className="rounded-md border border-border bg-card p-4 space-y-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <code className="text-sm font-semibold">{f.key}</code>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={f.enabled}
                          onCheckedChange={(v) => {
                            const next = [...flags];
                            next[i] = { ...f, enabled: v };
                            setFlags(next);
                          }}
                        />
                        <Button size="sm" variant="ghost" onClick={() => handleDeleteFlag(f.key)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <div className="space-y-1">
                        <Label className="text-xs">Rollout %</Label>
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          value={f.rollout_pct}
                          onChange={(e) => {
                            const next = [...flags];
                            next[i] = { ...f, rollout_pct: Number(e.target.value) || 0 };
                            setFlags(next);
                          }}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Description</Label>
                        <Input
                          value={f.description ?? ""}
                          onChange={(e) => {
                            const next = [...flags];
                            next[i] = { ...f, description: e.target.value };
                            setFlags(next);
                          }}
                        />
                      </div>
                    </div>
                    <Button size="sm" onClick={() => handleSaveFlag(f)}>
                      <Save className="mr-2 h-4 w-4" /> Save flag
                    </Button>
                  </div>
                ))}
                {flags.length === 0 && (
                  <p className="text-sm text-muted-foreground">No feature flags yet.</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-md border border-border p-3">
      <div>
        <p className="text-sm font-semibold">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
