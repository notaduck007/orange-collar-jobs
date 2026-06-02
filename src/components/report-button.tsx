import { useState } from "react";
import { Flag } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type EntityType = "job" | "review" | "company" | "user";

const REASONS: Record<EntityType, string[]> = {
  job: ["Scam or fraud", "Misleading post", "Discriminatory", "Duplicate", "Other"],
  review: ["Harassment", "Off-topic", "False claim", "Spam", "Other"],
  company: ["Fake company", "Impersonation", "Inappropriate content", "Other"],
  user: ["Harassment", "Spam", "Impersonation", "Other"],
};

export function ReportButton({
  entityType,
  entityId,
  variant = "ghost",
  size = "sm",
  className,
  label = "Report",
}: {
  entityType: EntityType;
  entityId: string;
  variant?: "ghost" | "outline" | "secondary";
  size?: "sm" | "default" | "icon";
  className?: string;
  label?: string;
}) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState(REASONS[entityType][0]);
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    setSubmitting(true);
    const { error } = await supabase.from("reports").insert({
      reporter_id: user?.id ?? null,
      entity_type: entityType,
      entity_id: entityId,
      reason,
      details: details.trim() || null,
    });
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Report submitted — thanks. Our team will review it.");
    setDetails("");
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={variant} size={size} className={className}>
          <Flag className="mr-1.5 h-3.5 w-3.5" /> {label}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Report this {entityType}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Reason</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REASONS[entityType].map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Details (optional)</Label>
            <Textarea
              rows={4}
              value={details}
              onChange={(e) => setDetails(e.target.value.slice(0, 1000))}
              placeholder="Tell us what's wrong…"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={submitting} className="btn-primary">
            {submitting ? "Sending…" : "Submit report"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
