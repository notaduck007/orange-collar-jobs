import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { FileText, Upload } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ApplyDialogProps {
  jobId: string;
  jobTitle: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApplied?: () => void;
}

export function ApplyDialog({ jobId, jobTitle, open, onOpenChange, onApplied }: ApplyDialogProps) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);
  const [coverNote, setCoverNote] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [useDefault, setUseDefault] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const { data: profile } = useQuery({
    queryKey: ["seeker-profile", user?.id],
    enabled: !!user && open,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("default_resume_url, full_name")
        .eq("id", user!.id)
        .maybeSingle();
      return data;
    },
  });

  useEffect(() => {
    if (!open) {
      setCoverNote("");
      setFile(null);
      setUseDefault(true);
    }
  }, [open]);

  const submit = async () => {
    if (!user) return;
    setSubmitting(true);
    try {
      let resumePath: string | null = null;

      if (useDefault && profile?.default_resume_url) {
        resumePath = profile.default_resume_url;
      } else if (file) {
        const ext = file.name.split(".").pop() ?? "pdf";
        const path = `${user.id}/applications/${jobId}-${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("resumes")
          .upload(path, file, { contentType: file.type, upsert: false });
        if (upErr) throw upErr;
        resumePath = path;
      } else if (!profile?.default_resume_url) {
        toast.error("Please attach a resume.");
        setSubmitting(false);
        return;
      }

      const { error } = await supabase.from("applications").insert({
        job_id: jobId,
        applicant_id: user.id,
        cover_letter: coverNote || null,
        resume_url: resumePath,
      });
      if (error) {
        if (error.code === "23505") {
          toast.error("You've already applied to this job.");
        } else {
          throw error;
        }
      } else {
        toast.success("Application sent! The employer will be in touch.");
        qc.invalidateQueries({ queryKey: ["seeker-apps", user.id] });
        qc.invalidateQueries({ queryKey: ["seeker-applied-ids", user.id] });
        qc.invalidateQueries({ queryKey: ["seeker-stats", user.id] });
        onApplied?.();
        onOpenChange(false);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not submit application");
    } finally {
      setSubmitting(false);
    }
  };

  const hasDefault = !!profile?.default_resume_url;
  const defaultName = profile?.default_resume_url?.split("/").pop() ?? "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Apply to {jobTitle}</DialogTitle>
          <DialogDescription>
            Send your resume and an optional note. The employer will see your full name and any
            cover note you add.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Resume *</Label>
            {hasDefault && (
              <label className="flex items-start gap-3 rounded-lg border border-border bg-background p-3">
                <input
                  type="radio"
                  className="mt-1 accent-[color:var(--primary)]"
                  checked={useDefault}
                  onChange={() => setUseDefault(true)}
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-primary" />
                    <p className="text-sm font-semibold text-[color:var(--ink)]">
                      Use my default resume
                    </p>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">{defaultName}</p>
                </div>
              </label>
            )}
            <label className="flex items-start gap-3 rounded-lg border border-border bg-background p-3">
              {hasDefault && (
                <input
                  type="radio"
                  className="mt-1 accent-[color:var(--primary)]"
                  checked={!useDefault}
                  onChange={() => setUseDefault(false)}
                />
              )}
              <div className="flex-1">
                <p className="text-sm font-semibold text-[color:var(--ink)]">
                  {hasDefault ? "Upload a different resume" : "Upload a resume"}
                </p>
                <input
                  ref={fileInput}
                  type="file"
                  accept=".pdf,.doc,.docx"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) {
                      setFile(f);
                      setUseDefault(false);
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={() => fileInput.current?.click()}
                >
                  <Upload className="mr-1 h-4 w-4" />
                  {file ? file.name : "Choose file"}
                </Button>
                <p className="mt-1 text-xs text-muted-foreground">PDF / DOC / DOCX</p>
              </div>
            </label>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cover">Cover note (optional)</Label>
            <Textarea
              id="cover"
              rows={5}
              maxLength={2000}
              placeholder="Hi, I have 3 years of forklift experience…"
              value={coverNote}
              onChange={(e) => setCoverNote(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">{coverNote.length} / 2000</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button className="btn-primary" onClick={submit} disabled={submitting}>
            {submitting ? "Sending…" : "Send application"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
