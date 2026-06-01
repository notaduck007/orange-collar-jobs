import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, useRef } from "react";
import { toast } from "sonner";
import { FileText, Upload, Trash2, FileDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/seeker/profile")({
  head: () => ({ meta: [{ title: "Profile & Resume — WarehouseJobs" }] }),
  component: ProfilePage,
});

function ProfilePage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({ full_name: "", phone: "", location: "" });

  const { data: profile } = useQuery({
    queryKey: ["seeker-profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").eq("id", user!.id).maybeSingle();
      return data;
    },
  });

  useEffect(() => {
    if (profile) {
      setForm({
        full_name: profile.full_name ?? profile.display_name ?? "",
        phone: profile.phone ?? "",
        location: profile.location ?? "",
      });
    }
  }, [profile]);

  const saveProfile = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: form.full_name, phone: form.phone, location: form.location })
      .eq("id", user.id);
    setSaving(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Profile saved");
      qc.invalidateQueries({ queryKey: ["seeker-profile", user.id] });
    }
  };

  const uploadResume = async (file: File) => {
    if (!user) return;
    const ext = file.name.split(".").pop() ?? "pdf";
    const path = `${user.id}/default-${Date.now()}.${ext}`;
    setUploading(true);
    const { error: upErr } = await supabase.storage
      .from("resumes")
      .upload(path, file, { upsert: true, contentType: file.type });
    if (upErr) {
      setUploading(false);
      toast.error(upErr.message);
      return;
    }
    // Remove old default if any
    if (profile?.default_resume_url && profile.default_resume_url !== path) {
      await supabase.storage.from("resumes").remove([profile.default_resume_url]);
    }
    const { error } = await supabase
      .from("profiles")
      .update({ default_resume_url: path })
      .eq("id", user.id);
    setUploading(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Default resume saved");
      qc.invalidateQueries({ queryKey: ["seeker-profile", user.id] });
    }
  };

  const downloadResume = async () => {
    if (!profile?.default_resume_url) return;
    const { data } = await supabase.storage
      .from("resumes")
      .createSignedUrl(profile.default_resume_url, 60);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  };

  const removeResume = async () => {
    if (!user || !profile?.default_resume_url) return;
    await supabase.storage.from("resumes").remove([profile.default_resume_url]);
    await supabase.from("profiles").update({ default_resume_url: null }).eq("id", user.id);
    toast.success("Resume removed");
    qc.invalidateQueries({ queryKey: ["seeker-profile", user.id] });
  };

  const resumeName = profile?.default_resume_url?.split("/").pop() ?? "";

  return (
    <div className="space-y-6">
      <div>
        <p className="label-caps text-primary">Profile</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-[color:var(--ink)]">
          Profile & resume
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload a default resume to enable one-click apply across the site.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card p-6 sm:p-8">
        <h2 className="text-lg font-semibold text-[color:var(--ink)]">Your details</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="full_name">Full name</Label>
            <Input
              id="full_name"
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              type="tel"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </div>
          <div className="sm:col-span-2 space-y-1.5">
            <Label htmlFor="loc">Location</Label>
            <Input
              id="loc"
              placeholder="City, State"
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
            />
          </div>
        </div>
        <div className="mt-5 flex justify-end">
          <Button onClick={saveProfile} disabled={saving} className="btn-primary">
            {saving ? "Saving…" : "Save profile"}
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-6 sm:p-8">
        <h2 className="text-lg font-semibold text-[color:var(--ink)]">Default resume</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          PDF, DOC, or DOCX — used automatically when you apply.
        </p>
        <input
          ref={fileInput}
          type="file"
          accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) uploadResume(f);
          }}
        />
        {profile?.default_resume_url ? (
          <div className="mt-4 flex items-center justify-between rounded-lg border border-border bg-background p-4">
            <div className="flex items-center gap-3">
              <FileText className="h-6 w-6 text-primary" />
              <div>
                <p className="text-sm font-semibold text-[color:var(--ink)]">{resumeName}</p>
                <p className="text-xs text-muted-foreground">Default resume on file</p>
              </div>
            </div>
            <div className="flex gap-1.5">
              <Button variant="outline" size="sm" onClick={downloadResume}>
                <FileDown className="mr-1 h-4 w-4" /> View
              </Button>
              <Button variant="outline" size="sm" onClick={() => fileInput.current?.click()}>
                <Upload className="mr-1 h-4 w-4" /> Replace
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={removeResume}
                className="text-muted-foreground hover:text-rose-600"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            disabled={uploading}
            className="mt-4 flex w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border bg-background py-10 text-sm text-muted-foreground transition hover:border-primary hover:bg-[color:var(--primary-tint)]"
          >
            <Upload className="h-7 w-7 text-primary" />
            <span className="font-semibold text-[color:var(--ink)]">
              {uploading ? "Uploading…" : "Upload your resume"}
            </span>
            <span className="text-xs">PDF / DOC / DOCX, max 10MB</span>
          </button>
        )}
      </div>
    </div>
  );
}
