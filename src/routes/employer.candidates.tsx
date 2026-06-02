import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Search, MapPin, Briefcase, Award, Lock, Send, UserCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useSiteSettings } from "@/lib/site-settings";

export const Route = createFileRoute("/employer/candidates")({
  head: () => ({ meta: [{ title: "Candidate Search — WarehouseJobs" }] }),
  component: CandidatesPage,
});

type JobShift = "first" | "second" | "third" | "weekend" | "flexible";

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

type Candidate = {
  user_id: string;
  headline: string | null;
  summary: string | null;
  skills: string[] | null;
  certifications: string[] | null;
  desired_shift: JobShift | null;
  willing_to_relocate: boolean;
  display_name: string | null;
  location: string | null;
};

function CandidatesPage() {
  const { user } = useAuth();
  const [keyword, setKeyword] = useState("");
  const [cert, setCert] = useState<string>("");
  const [shift, setShift] = useState<string>("");
  const [location, setLocation] = useState("");
  const [relocateOnly, setRelocateOnly] = useState(false);
  const [inviteTarget, setInviteTarget] = useState<Candidate | null>(null);

  // Entitlement gate: signed-in employer's company must have an active package with remaining credits.
  const { data: company, isLoading: companyLoading } = useQuery({
    queryKey: ["employer-company-candidates", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data: owned } = await supabase
        .from("companies")
        .select("id, name")
        .eq("owner_id", user!.id)
        .maybeSingle();
      if (owned) return owned;
      const { data: m } = await supabase
        .from("company_members")
        .select("company_id")
        .eq("user_id", user!.id)
        .eq("status", "active")
        .limit(1)
        .maybeSingle();
      if (!m?.company_id) return null;
      const { data } = await supabase
        .from("companies")
        .select("id, name")
        .eq("id", m.company_id)
        .maybeSingle();
      return data;
    },
  });

  const { data: activePackage } = useQuery({
    queryKey: ["employer-active-package", company?.id],
    enabled: !!company?.id,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_active_package", {
        p_company_id: company!.id,
      });
      if (error) throw error;
      return Array.isArray(data) ? (data[0] ?? null) : (data ?? null);
    },
  });

  const entitled = useMemo(
    () =>
      !!activePackage &&
      ((activePackage.posts_remaining ?? 0) > 0 || (activePackage.featured_remaining ?? 0) > 0),
    [activePackage],
  );

  const {
    data: candidates = [],
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["candidate-search", { keyword, cert, shift, location, relocateOnly, entitled }],
    enabled: !!entitled,
    queryFn: async (): Promise<Candidate[]> => {
      // Fetch discoverable seeker_profiles
      let q = supabase
        .from("seeker_profiles")
        .select(
          "user_id, headline, summary, skills, certifications, desired_shift, willing_to_relocate",
        )
        .eq("discoverable" as never, true as never)
        .limit(100);
      if (shift) q = q.eq("desired_shift", shift as never);
      if (relocateOnly) q = q.eq("willing_to_relocate", true);
      if (cert) q = q.contains("certifications", [cert]);
      const { data: sp, error } = await q;
      if (error) throw error;
      const profilesRaw = (sp ?? []) as unknown as Array<{
        user_id: string;
        headline: string | null;
        summary: string | null;
        skills: string[] | null;
        certifications: string[] | null;
        desired_shift: JobShift | null;
        willing_to_relocate: boolean;
      }>;
      if (profilesRaw.length === 0) return [];

      const ids = profilesRaw.map((p) => p.user_id);
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, display_name, location")
        .in("id", ids);
      const byId = new Map((profs ?? []).map((p) => [p.id, p]));

      const kw = keyword.trim().toLowerCase();
      const loc = location.trim().toLowerCase();

      return profilesRaw
        .map((sp_) => {
          const prof = byId.get(sp_.user_id);
          return {
            user_id: sp_.user_id,
            headline: sp_.headline,
            summary: sp_.summary,
            skills: sp_.skills,
            certifications: sp_.certifications,
            desired_shift: sp_.desired_shift,
            willing_to_relocate: sp_.willing_to_relocate,
            display_name: prof?.display_name ?? null,
            location: prof?.location ?? null,
          };
        })
        .filter((c) => {
          if (kw) {
            const hay = [
              c.headline ?? "",
              c.summary ?? "",
              ...(c.skills ?? []),
              ...(c.certifications ?? []),
            ]
              .join(" ")
              .toLowerCase();
            if (!hay.includes(kw)) return false;
          }
          if (loc) {
            const hay = (c.location ?? "").toLowerCase();
            if (!hay.includes(loc)) return false;
          }
          return true;
        });
    },
  });

  const resetFilters = () => {
    setKeyword("");
    setCert("");
    setShift("");
    setLocation("");
    setRelocateOnly(false);
  };

  const { settings } = useSiteSettings();
  if (!settings.toggles.candidate_search_enabled) {
    return (
      <div className="rounded-xl border border-border bg-card p-10 text-center">
        <Lock className="mx-auto h-10 w-10 text-muted-foreground" />
        <h2 className="mt-3 text-lg font-semibold text-[color:var(--ink)]">
          Candidate search is disabled
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          An administrator has turned off candidate search site-wide.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="label-caps text-primary">Sourcing</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-[color:var(--ink)]">
          Candidate search
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Search opted-in seekers by skill, certification, shift, and location.
        </p>
      </div>

      {!companyLoading && !entitled && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-6">
          <div className="flex items-start gap-3">
            <Lock className="mt-0.5 h-5 w-5 text-amber-700" />
            <div className="flex-1">
              <h2 className="text-base font-semibold text-amber-900">
                Candidate search is a paid feature
              </h2>
              <p className="mt-1 text-sm text-amber-900/80">
                You need active posting or featured credits to search candidates. Buy a package to
                unlock sourcing.
              </p>
              <Link
                to="/pricing"
                className="mt-3 inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground"
              >
                View packages →
              </Link>
            </div>
          </div>
        </div>
      )}

      {entitled && (
        <>
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
              <div className="space-y-1.5 lg:col-span-2">
                <Label htmlFor="kw">Keyword</Label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="kw"
                    placeholder="forklift, picker, supervisor…"
                    className="pl-8"
                    value={keyword}
                    onChange={(e) => setKeyword(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Certification</Label>
                <Select
                  value={cert || undefined}
                  onValueChange={(v) => setCert(v === "__any" ? "" : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Any" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__any">Any</SelectItem>
                    {CERT_OPTIONS.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Preferred shift</Label>
                <Select
                  value={shift || undefined}
                  onValueChange={(v) => setShift(v === "__any" ? "" : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Any" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__any">Any</SelectItem>
                    {SHIFTS.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="loc">Location</Label>
                <Input
                  id="loc"
                  placeholder="City or state"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                />
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2 text-sm">
                  <Switch checked={relocateOnly} onCheckedChange={(v) => setRelocateOnly(!!v)} />
                  <span>Open to relocate</span>
                </label>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                {isLoading
                  ? "Searching…"
                  : `${candidates.length} candidate${candidates.length === 1 ? "" : "s"} match`}
              </p>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={resetFilters}>
                  Reset
                </Button>
                <Button size="sm" onClick={() => refetch()}>
                  <Search className="mr-1 h-4 w-4" /> Search
                </Button>
              </div>
            </div>
          </div>

          {!isLoading && candidates.length === 0 && (
            <div className="rounded-xl border border-dashed border-border bg-background p-12 text-center">
              <UserCheck className="mx-auto h-10 w-10 text-muted-foreground/40" />
              <p className="mt-3 text-base font-semibold text-[color:var(--ink)]">
                No candidates match
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Try broader filters or fewer keywords.
              </p>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            {candidates.map((c) => (
              <CandidateCard key={c.user_id} candidate={c} onInvite={() => setInviteTarget(c)} />
            ))}
          </div>
        </>
      )}

      <InviteDialog
        candidate={inviteTarget}
        onClose={() => setInviteTarget(null)}
        companyName={company?.name ?? ""}
        senderId={user?.id ?? ""}
      />
    </div>
  );
}

function CandidateCard({ candidate, onInvite }: { candidate: Candidate; onInvite: () => void }) {
  const initials = (candidate.display_name ?? "?")
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[color:var(--primary-tint)] text-sm font-bold text-primary">
          {initials || "?"}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-[color:var(--ink)]">
            {candidate.display_name ?? "Candidate"}
          </p>
          {candidate.headline && (
            <p className="mt-0.5 line-clamp-1 text-sm text-muted-foreground">
              {candidate.headline}
            </p>
          )}
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {candidate.location && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {candidate.location}
              </span>
            )}
            {candidate.desired_shift && (
              <span className="inline-flex items-center gap-1">
                <Briefcase className="h-3 w-3" />
                {candidate.desired_shift}
              </span>
            )}
            {candidate.willing_to_relocate && (
              <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase">
                Open to relocate
              </span>
            )}
          </div>
        </div>
      </div>

      {candidate.certifications && candidate.certifications.length > 0 && (
        <div className="mt-3">
          <p className="label-caps mb-1.5 flex items-center gap-1 text-[10px]">
            <Award className="h-3 w-3" /> Certifications
          </p>
          <div className="flex flex-wrap gap-1.5">
            {candidate.certifications.slice(0, 6).map((c) => (
              <Badge key={c} variant="secondary" className="text-[11px]">
                {c}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {candidate.skills && candidate.skills.length > 0 && (
        <div className="mt-3">
          <p className="label-caps mb-1.5 text-[10px]">Skills</p>
          <div className="flex flex-wrap gap-1.5">
            {candidate.skills.slice(0, 8).map((s) => (
              <Badge key={s} variant="outline" className="text-[11px]">
                {s}
              </Badge>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4 flex justify-end">
        <Button size="sm" onClick={onInvite} className="btn-primary">
          <Send className="mr-1 h-4 w-4" /> Invite to apply
        </Button>
      </div>
    </div>
  );
}

function InviteDialog({
  candidate,
  onClose,
  companyName,
  senderId,
}: {
  candidate: Candidate | null;
  onClose: () => void;
  companyName: string;
  senderId: string;
}) {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const send = async () => {
    if (!candidate || !senderId) return;
    setSending(true);
    const title = `${companyName || "An employer"} invited you to apply`;
    const body =
      message.trim() ||
      `${companyName || "An employer"} reviewed your profile and would like you to apply to one of their roles.`;
    const { error } = await supabase.from("notifications" as never).insert({
      user_id: candidate.user_id,
      sender_id: senderId,
      type: "candidate_invite",
      title,
      body,
      link: "/jobs",
    } as never);
    setSending(false);
    if (error) return toast.error(error.message);
    toast.success("Invite sent to candidate");
    setMessage("");
    onClose();
  };

  return (
    <Dialog open={!!candidate} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite {candidate?.display_name ?? "candidate"} to apply</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          We&apos;ll send an in-app notification and an email to this candidate inviting them to
          apply to your open roles. Your message is optional.
        </p>
        <div className="space-y-1.5">
          <Label htmlFor="msg">Personal message</Label>
          <Textarea
            id="msg"
            rows={4}
            maxLength={600}
            placeholder="Hi! I think your background is a great fit for our 1st shift forklift role…"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={send} disabled={sending} className="btn-primary">
            <Send className="mr-1 h-4 w-4" /> {sending ? "Sending…" : "Send invite"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
