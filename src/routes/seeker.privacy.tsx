import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Download, ShieldAlert, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import type { Row } from "@/lib/row-types";
import { errMsg } from "@/lib/row-types";

export const Route = createFileRoute("/seeker/privacy")({
  head: () => ({ meta: [{ title: "Privacy & Data — WarehouseJobs" }] }),
  component: PrivacyPage,
});

function PrivacyPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [reason, setReason] = useState("");

  const requestsQ = useQuery({
    queryKey: ["my-deletion-requests", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deletion_requests")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  async function handleExport() {
    if (!user) return;
    setExporting(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/export-user-data`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({}),
        },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? `Export failed (${res.status})`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `my-data-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Your data has been downloaded.");
    } catch (e: unknown) {
      toast.error(errMsg(e, "Export failed"));
    } finally {
      setExporting(false);
    }
  }

  async function handleDelete() {
    if (!user) return;
    setDeleting(true);
    try {
      const { data, error } = await supabase.functions.invoke("delete-user-account", {
        body: { mode: "soft", reason: reason || null },
      });
      if (error) throw error;
      if ((data as Row)?.error) throw new Error((data as Row).error);
      toast.success("Account deleted. Signing you out…");
      await qc.invalidateQueries();
      await supabase.auth.signOut();
      window.location.href = "/";
    } catch (e: unknown) {
      toast.error(errMsg(e, "Deletion failed"));
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-[color:var(--ink)]">
          Privacy & Data
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Export your personal data or permanently delete your account.
        </p>
      </div>

      <section className="rounded-xl border bg-card p-6 shadow-sm">
        <div className="flex items-start gap-4">
          <Download className="h-6 w-6 text-primary" />
          <div className="flex-1">
            <h2 className="text-lg font-semibold">Export my data</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Download a JSON copy of your profile, applications, saved jobs, alerts, reviews, and
              work history.
            </p>
            <Button className="mt-4" onClick={handleExport} disabled={exporting}>
              {exporting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-2 h-4 w-4" />
              )}
              {exporting ? "Preparing…" : "Download my data"}
            </Button>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-destructive/40 bg-card p-6 shadow-sm">
        <div className="flex items-start gap-4">
          <ShieldAlert className="h-6 w-6 text-destructive" />
          <div className="flex-1">
            <h2 className="text-lg font-semibold">Delete my account</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              This anonymizes your personal information (name, contact, resume, profile narrative)
              and signs you out. Your applications remain as anonymous records for our employer
              partners' history. This cannot be undone.
            </p>
            <div className="mt-4">
              <Label htmlFor="reason" className="text-sm">
                Reason (optional)
              </Label>
              <Textarea
                id="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Help us improve — why are you leaving?"
                className="mt-1"
                rows={3}
              />
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="mt-4" disabled={deleting}>
                  {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Delete my account permanently
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete your account?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Your personal data will be anonymized immediately and you'll be signed out. This
                    action cannot be reversed.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDelete}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Yes, delete my account
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </section>

      {requestsQ.data && requestsQ.data.length > 0 && (
        <section className="rounded-xl border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Request history</h2>
          <ul className="mt-3 divide-y">
            {requestsQ.data.map((r: Row) => (
              <li key={r.id} className="flex items-center justify-between py-2 text-sm">
                <span className="capitalize">{r.type}</span>
                <Badge variant="outline" className="capitalize">
                  {r.status}
                </Badge>
                <span className="text-muted-foreground">
                  {new Date(r.created_at).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
