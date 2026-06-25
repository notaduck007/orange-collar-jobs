import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Megaphone, Send } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { apiClient } from "@/lib/api-client";
import { getAccessToken } from "@/lib/auth-session";
import type { CampaignChannel } from "@/lib/api/contracts/campaigns";

export const Route = createFileRoute("/admin/campaigns")({
  head: () => ({ meta: [{ title: "Marketing Campaigns — Admin" }] }),
  component: AdminCampaignsPage,
});

function AdminCampaignsPage() {
  const token = getAccessToken();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [channel, setChannel] = useState<CampaignChannel>("email");
  const [subject, setSubject] = useState("");
  const [htmlBody, setHtmlBody] = useState("");

  const listQ = useQuery({
    queryKey: ["admin-campaigns"],
    enabled: !!token,
    queryFn: () => apiClient.listCampaigns(token!, { pageSize: 20 }),
  });

  const createMut = useMutation({
    mutationFn: () =>
      apiClient.createCampaign(token!, {
        name,
        channel,
        subject: channel === "email" ? subject : undefined,
        htmlBody: channel === "email" ? htmlBody : undefined,
        textBody: channel === "sms" ? htmlBody : undefined,
        segment: { role: "seeker" },
      }),
    onSuccess: () => {
      toast.success("Campaign created.");
      setName("");
      setSubject("");
      setHtmlBody("");
      void qc.invalidateQueries({ queryKey: ["admin-campaigns"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const sendMut = useMutation({
    mutationFn: (id: string) => apiClient.sendCampaign(token!, id),
    onSuccess: () => {
      toast.success("Campaign send queued.");
      void qc.invalidateQueries({ queryKey: ["admin-campaigns"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const campaigns = listQ.data?.data ?? [];

  return (
    <div className="space-y-8" data-testid="admin-campaigns">
      <div>
        <p className="label-caps text-primary">Phase 4.5</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-[color:var(--ink)]">
          Marketing campaigns
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Create and send opt-in marketing bursts via the Nest notifications domain.
        </p>
      </div>

      <section className="rounded-xl border border-border bg-card p-6">
        <h2 className="text-lg font-semibold">New campaign</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="camp-name">Name</Label>
            <Input id="camp-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Channel</Label>
            <div className="flex gap-2">
              {(["email", "sms"] as const).map((c) => (
                <Button
                  key={c}
                  type="button"
                  variant={channel === c ? "default" : "outline"}
                  size="sm"
                  onClick={() => setChannel(c)}
                >
                  {c.toUpperCase()}
                </Button>
              ))}
            </div>
          </div>
          {channel === "email" && (
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="camp-subject">Subject</Label>
              <Input
                id="camp-subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />
            </div>
          )}
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="camp-body">{channel === "email" ? "HTML body" : "SMS text"}</Label>
            <Textarea
              id="camp-body"
              rows={4}
              value={htmlBody}
              onChange={(e) => setHtmlBody(e.target.value)}
            />
          </div>
        </div>
        <Button
          className="mt-4"
          disabled={!name.trim() || !htmlBody.trim() || createMut.isPending}
          onClick={() => createMut.mutate()}
        >
          {createMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Create campaign
        </Button>
      </section>

      <section className="rounded-xl border border-border bg-card p-6">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Megaphone className="h-5 w-5 text-primary" /> Campaigns
        </h2>
        {listQ.isLoading && (
          <p className="mt-4 text-sm text-muted-foreground">
            <Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> Loading…
          </p>
        )}
        <ul className="mt-4 divide-y divide-border">
          {campaigns.length === 0 && !listQ.isLoading && (
            <li className="py-6 text-sm text-muted-foreground">No campaigns yet.</li>
          )}
          {campaigns.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div>
                <p className="font-semibold text-[color:var(--ink)]">{c.name}</p>
                <p className="text-xs text-muted-foreground">
                  {c.channel} · {c.status} · {new Date(c.createdAt).toLocaleString()}
                </p>
              </div>
              {c.status === "draft" && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={sendMut.isPending}
                  onClick={() => sendMut.mutate(c.id)}
                >
                  <Send className="mr-2 h-4 w-4" /> Send
                </Button>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
