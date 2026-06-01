import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { FileText, Upload, Trash2, FileDown, Plus, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/seeker/profile")({
  head: () => ({ meta: [{ title: "Profile & Resume — WarehouseJobs" }] }),
  component: ProfilePage,
});

type JobShift = "first" | "second" | "third" | "weekend" | "flexible";
type EmploymentType =
  | "full_time"
  | "part_time"
  | "temp"
  | "temp_to_hire"
  | "seasonal"
  | "contract";

const CERT_OPTIONS = [
  "Forklift",
  "OSHA-10",
  "OSHA-30",
  "CDL Class A",
  "CDL Class B",
  "Reach Truck",
  "Pallet Jack",
  "HAZMAT",
  "First Aid / CPR",
  "Powered Industrial Truck",
];

const SHIFTS: { value: JobShift; label: string }[] = [
  { value: "first", label: "1st shift" },
  { value: "second", label: "2nd shift" },
  { value: "third", label: "3rd shift" },
  { value: "weekend", label: "Weekend" },
  { value: "flexible", label: "Flexible" },
];

const EMPLOYMENT: { value: EmploymentType; label: string }[] = [
  { value: "full_time", label: "Full time" },
  { value: "part_time", label: "Part time" },
  { value: "temp", label: "Temp" },
  { value: "temp_to_hire", label: "Temp to hire" },
  { value: "seasonal", label: "Seasonal" },
  { value: "contract", label: "Contract" },
];

type SeekerForm = {
  headline: string;
  summary: string;
  desired_pay_min: string;
  desired_shift: JobShift | "";
  desired_employment_type: EmploymentType | "";
  willing_to_relocate: boolean;
  discoverable: boolean;
  certifications: string[];
  skills: string[];
};

type WorkRow = {
  id: string;
  employer_name: string;
  title: string;
  start_date: string | null;
  end_date: string | null;
  current: boolean;
  description: string | null;
  _isNew?: boolean;
  _dirty?: boolean;
};

function ProfilePage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [savingBasics, setSavingBasics] = useState(false);
  const [savingSeeker, setSavingSeeker] = useState(false);
  const [basics, setBasics] = useState({ full_name: "", phone: "", location: "" });
  const [skillInput, setSkillInput] = useState("");
  const [seeker, setSeeker] = useState<SeekerForm>({
    headline: "",
    summary: "",
    desired_pay_min: "",
    desired_shift: "",
    desired_employment_type: "",
    willing_to_relocate: false,
    discoverable: false,
    certifications: [],
    skills: [],
  });
  const [work, setWork] = useState<WorkRow[]>([]);

  const { data: profile } = useQuery({
    queryKey: ["seeker-profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user!.id)
        .maybeSingle();
      return data;
    },
  });

  const { data: seekerRow } = useQuery({
    queryKey: ["seeker-extended", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("seeker_profiles")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data;
    },
  });

  const { data: workRows } = useQuery({
    queryKey: ["seeker-work", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("work_history")
        .select("*")
        .eq("user_id", user!.id)
        .order("current", { ascending: false })
        .order("start_date", { ascending: false, nullsFirst: false });
      return data ?? [];
    },
  });

  useEffect(() => {
    if (profile) {
      setBasics({
        full_name: profile.full_name ?? profile.display_name ?? "",
        phone: profile.phone ?? "",
        location: profile.location ?? "",
      });
    }
  }, [profile]);

  useEffect(() => {
    if (seekerRow) {
      setSeeker({
        headline: seekerRow.headline ?? "",
        summary: seekerRow.summary ?? "",
        desired_pay_min:
          seekerRow.desired_pay_min != null ? String(seekerRow.desired_pay_min) : "",
        desired_shift: (seekerRow.desired_shift as JobShift | null) ?? "",
        desired_employment_type:
          (seekerRow.desired_employment_type as EmploymentType | null) ?? "",
        willing_to_relocate: !!seekerRow.willing_to_relocate,
        discoverable: !!(seekerRow as { discoverable?: boolean }).discoverable,
        certifications: seekerRow.certifications ?? [],
        skills: seekerRow.skills ?? [],
      });
    }
  }, [seekerRow]);

  useEffect(() => {
    if (workRows) {
      setWork(
        workRows.map((r) => ({
          id: r.id,
          employer_name: r.employer_name,
          title: r.title,
          start_date: r.start_date,
          end_date: r.end_date,
          current: !!r.current,
          description: r.description,
        })),
      );
    }
  }, [workRows]);

  const completeness = useMemo(() => {
    const checks = [
      !!profile?.default_resume_url,
      seeker.headline.trim().length > 0,
      (workRows?.length ?? 0) >= 1,
      seeker.skills.length >= 3,
      seeker.certifications.length >= 1,
    ];
    const done = checks.filter(Boolean).length;
    return Math.round((done / checks.length) * 100);
  }, [profile, seeker, workRows]);

  const saveBasics = async () => {
    if (!user) return;
    setSavingBasics(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: basics.full_name,
        phone: basics.phone,
        location: basics.location,
      })
      .eq("id", user.id);
    setSavingBasics(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Details saved");
      qc.invalidateQueries({ queryKey: ["seeker-profile", user.id] });
    }
  };

  const saveSeeker = async () => {
    if (!user) return;
    setSavingSeeker(true);
    const payload = {
      user_id: user.id,
      headline: seeker.headline || null,
      summary: seeker.summary || null,
      desired_pay_min: seeker.desired_pay_min ? Number(seeker.desired_pay_min) : null,
      desired_shift: seeker.desired_shift || null,
      desired_employment_type: seeker.desired_employment_type || null,
      willing_to_relocate: seeker.willing_to_relocate,
      discoverable: seeker.discoverable,
      certifications: seeker.certifications,
      skills: seeker.skills,
    };
    const { error } = await supabase
      .from("seeker_profiles")
      .upsert(payload as never, { onConflict: "user_id" });
    setSavingSeeker(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Profile saved");
      qc.invalidateQueries({ queryKey: ["seeker-extended", user.id] });
    }
  };

  const toggleCert = (cert: string) => {
    setSeeker((s) => ({
      ...s,
      certifications: s.certifications.includes(cert)
        ? s.certifications.filter((c) => c !== cert)
        : [...s.certifications, cert],
    }));
  };

  const addSkill = () => {
    const v = skillInput.trim();
    if (!v || seeker.skills.includes(v)) {
      setSkillInput("");
      return;
    }
    setSeeker((s) => ({ ...s, skills: [...s.skills, v] }));
    setSkillInput("");
  };

  const removeSkill = (s: string) => {
    setSeeker((cur) => ({ ...cur, skills: cur.skills.filter((x) => x !== s) }));
  };

  const addWorkRow = () => {
    setWork((w) => [
      {
        id: `new-${crypto.randomUUID()}`,
        employer_name: "",
        title: "",
        start_date: null,
        end_date: null,
        current: false,
        description: "",
        _isNew: true,
        _dirty: true,
      },
      ...w,
    ]);
  };

  const updateWork = (id: string, patch: Partial<WorkRow>) => {
    setWork((w) =>
      w.map((r) => (r.id === id ? { ...r, ...patch, _dirty: true } : r)),
    );
  };

  const removeWork = async (row: WorkRow) => {
    if (row._isNew) {
      setWork((w) => w.filter((r) => r.id !== row.id));
      return;
    }
    const { error } = await supabase.from("work_history").delete().eq("id", row.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Entry removed");
      qc.invalidateQueries({ queryKey: ["seeker-work", user!.id] });
    }
  };

  const saveWork = async (row: WorkRow) => {
    if (!user) return;
    if (!row.employer_name.trim() || !row.title.trim()) {
      toast.error("Employer and title are required");
      return;
    }
    const payload = {
      user_id: user.id,
      employer_name: row.employer_name,
      title: row.title,
      start_date: row.start_date || null,
      end_date: row.current ? null : row.end_date || null,
      current: row.current,
      description: row.description || null,
    };
    if (row._isNew) {
      const { error } = await supabase.from("work_history").insert(payload);
      if (error) return toast.error(error.message);
    } else {
      const { error } = await supabase
        .from("work_history")
        .update(payload)
        .eq("id", row.id);
      if (error) return toast.error(error.message);
    }
    toast.success("Saved");
    qc.invalidateQueries({ queryKey: ["seeker-work", user.id] });
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
          Your seeker profile
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          A complete profile helps employers find you and powers one-click apply.
        </p>
      </div>

      {/* Completeness */}
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Profile completeness
          </h2>
          <span className="text-2xl font-bold text-[color:var(--ink)]">
            {completeness}%
          </span>
        </div>
        <Progress value={completeness} className="mt-3" />
        <ul className="mt-3 grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
          <li className={profile?.default_resume_url ? "text-emerald-600" : ""}>
            • Default resume uploaded
          </li>
          <li className={seeker.headline.trim() ? "text-emerald-600" : ""}>
            • Headline written
          </li>
          <li className={(workRows?.length ?? 0) >= 1 ? "text-emerald-600" : ""}>
            • At least 1 work history entry
          </li>
          <li className={seeker.skills.length >= 3 ? "text-emerald-600" : ""}>
            • 3+ skills added
          </li>
          <li className={seeker.certifications.length >= 1 ? "text-emerald-600" : ""}>
            • 1+ certification selected
          </li>
        </ul>
      </div>

      {/* Basics */}
      <div className="rounded-xl border border-border bg-card p-6 sm:p-8">
        <h2 className="text-lg font-semibold text-[color:var(--ink)]">Your details</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="full_name">Full name</Label>
            <Input
              id="full_name"
              value={basics.full_name}
              onChange={(e) => setBasics({ ...basics, full_name: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              type="tel"
              value={basics.phone}
              onChange={(e) => setBasics({ ...basics, phone: e.target.value })}
            />
          </div>
          <div className="sm:col-span-2 space-y-1.5">
            <Label htmlFor="loc">Location</Label>
            <Input
              id="loc"
              placeholder="City, State"
              value={basics.location}
              onChange={(e) => setBasics({ ...basics, location: e.target.value })}
            />
          </div>
        </div>
        <div className="mt-5 flex justify-end">
          <Button onClick={saveBasics} disabled={savingBasics} className="btn-primary">
            {savingBasics ? "Saving…" : "Save details"}
          </Button>
        </div>
      </div>

      {/* Headline + summary */}
      <div className="rounded-xl border border-border bg-card p-6 sm:p-8">
        <h2 className="text-lg font-semibold text-[color:var(--ink)]">About you</h2>
        <div className="mt-4 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="headline">Headline</Label>
            <Input
              id="headline"
              placeholder="Experienced forklift operator, 5+ yrs"
              maxLength={120}
              value={seeker.headline}
              onChange={(e) => setSeeker({ ...seeker, headline: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="summary">Summary</Label>
            <Textarea
              id="summary"
              rows={4}
              maxLength={1000}
              placeholder="A short pitch about your background and what you're looking for."
              value={seeker.summary}
              onChange={(e) => setSeeker({ ...seeker, summary: e.target.value })}
            />
          </div>
        </div>
      </div>

      {/* Certifications */}
      <div className="rounded-xl border border-border bg-card p-6 sm:p-8">
        <h2 className="text-lg font-semibold text-[color:var(--ink)]">Certifications</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Tap any that apply.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {CERT_OPTIONS.map((cert) => {
            const active = seeker.certifications.includes(cert);
            return (
              <button
                key={cert}
                type="button"
                onClick={() => toggleCert(cert)}
                className={`rounded-full border px-3 py-1.5 text-sm transition ${
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background text-muted-foreground hover:border-primary/40"
                }`}
              >
                {cert}
              </button>
            );
          })}
        </div>
      </div>

      {/* Skills */}
      <div className="rounded-xl border border-border bg-card p-6 sm:p-8">
        <h2 className="text-lg font-semibold text-[color:var(--ink)]">Skills</h2>
        <div className="mt-4 flex gap-2">
          <Input
            placeholder="e.g. Inventory management"
            value={skillInput}
            maxLength={40}
            onChange={(e) => setSkillInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addSkill();
              }
            }}
          />
          <Button type="button" variant="outline" onClick={addSkill}>
            <Plus className="mr-1 h-4 w-4" /> Add
          </Button>
        </div>
        {seeker.skills.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {seeker.skills.map((s) => (
              <Badge
                key={s}
                variant="secondary"
                className="flex items-center gap-1 px-2.5 py-1 text-xs"
              >
                {s}
                <button
                  type="button"
                  onClick={() => removeSkill(s)}
                  className="text-muted-foreground hover:text-rose-600"
                  aria-label={`Remove ${s}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Preferences */}
      <div className="rounded-xl border border-border bg-card p-6 sm:p-8">
        <h2 className="text-lg font-semibold text-[color:var(--ink)]">Job preferences</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="pay">Minimum pay ($/hr)</Label>
            <Input
              id="pay"
              type="number"
              min={0}
              step="0.5"
              value={seeker.desired_pay_min}
              onChange={(e) =>
                setSeeker({ ...seeker, desired_pay_min: e.target.value })
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label>Preferred shift</Label>
            <Select
              value={seeker.desired_shift || undefined}
              onValueChange={(v) =>
                setSeeker({ ...seeker, desired_shift: v as JobShift })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Any" />
              </SelectTrigger>
              <SelectContent>
                {SHIFTS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Employment type</Label>
            <Select
              value={seeker.desired_employment_type || undefined}
              onValueChange={(v) =>
                setSeeker({
                  ...seeker,
                  desired_employment_type: v as EmploymentType,
                })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Any" />
              </SelectTrigger>
              <SelectContent>
                {EMPLOYMENT.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border bg-background px-4 py-3">
            <div>
              <p className="text-sm font-medium text-[color:var(--ink)]">
                Willing to relocate
              </p>
              <p className="text-xs text-muted-foreground">
                Show me jobs outside my area too.
              </p>
            </div>
            <Switch
              checked={seeker.willing_to_relocate}
              onCheckedChange={(v) =>
                setSeeker({ ...seeker, willing_to_relocate: !!v })
              }
            />
          </div>
        </div>
        <div className="mt-5 flex justify-end">
          <Button onClick={saveSeeker} disabled={savingSeeker} className="btn-primary">
            {savingSeeker ? "Saving…" : "Save profile"}
          </Button>
        </div>
      </div>

      {/* Discoverability */}
      <div className="rounded-xl border border-border bg-card p-6 sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-[color:var(--ink)]">
              Let employers find you
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              When on, employers searching for candidates can see your profile, skills,
              certifications, and work history, and invite you to apply. Your contact
              details stay private.
            </p>
          </div>
          <Switch
            checked={seeker.discoverable}
            onCheckedChange={(v) => setSeeker({ ...seeker, discoverable: !!v })}
          />
        </div>
        <div className="mt-4 flex justify-end">
          <Button onClick={saveSeeker} disabled={savingSeeker} className="btn-primary">
            {savingSeeker ? "Saving…" : "Save discoverability"}
          </Button>
        </div>
      </div>

      {/* Work history */}
      <div className="rounded-xl border border-border bg-card p-6 sm:p-8">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-[color:var(--ink)]">
              Work history
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Add your past roles — most recent first.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={addWorkRow}>
            <Plus className="mr-1 h-4 w-4" /> Add role
          </Button>
        </div>

        <div className="mt-5 space-y-4">
          {work.length === 0 && (
            <p className="rounded-lg border border-dashed border-border bg-background p-6 text-center text-sm text-muted-foreground">
              No work history yet. Add your first role to boost your profile.
            </p>
          )}
          {work.map((row) => (
            <div
              key={row.id}
              className="rounded-lg border border-border bg-background p-4 sm:p-5"
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Employer</Label>
                  <Input
                    value={row.employer_name}
                    onChange={(e) =>
                      updateWork(row.id, { employer_name: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Title</Label>
                  <Input
                    value={row.title}
                    onChange={(e) => updateWork(row.id, { title: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Start date</Label>
                  <Input
                    type="date"
                    value={row.start_date ?? ""}
                    onChange={(e) =>
                      updateWork(row.id, { start_date: e.target.value || null })
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>End date</Label>
                  <Input
                    type="date"
                    disabled={row.current}
                    value={row.end_date ?? ""}
                    onChange={(e) =>
                      updateWork(row.id, { end_date: e.target.value || null })
                    }
                  />
                </div>
                <div className="sm:col-span-2 space-y-1.5">
                  <Label>Description</Label>
                  <Textarea
                    rows={2}
                    value={row.description ?? ""}
                    onChange={(e) =>
                      updateWork(row.id, { description: e.target.value })
                    }
                  />
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <label className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Switch
                    checked={row.current}
                    onCheckedChange={(v) =>
                      updateWork(row.id, { current: !!v, end_date: v ? null : row.end_date })
                    }
                  />
                  I currently work here
                </label>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeWork(row)}
                    className="text-muted-foreground hover:text-rose-600"
                  >
                    <Trash2 className="mr-1 h-4 w-4" /> Remove
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => saveWork(row)}
                    disabled={!row._dirty && !row._isNew}
                  >
                    Save
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Resume */}
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
                <p className="text-sm font-semibold text-[color:var(--ink)]">
                  {resumeName}
                </p>
                <p className="text-xs text-muted-foreground">Default resume on file</p>
              </div>
            </div>
            <div className="flex gap-1.5">
              <Button variant="outline" size="sm" onClick={downloadResume}>
                <FileDown className="mr-1 h-4 w-4" /> View
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInput.current?.click()}
              >
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
