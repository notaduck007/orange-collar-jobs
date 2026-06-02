import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Mail, Phone, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Markdown } from "@/components/markdown";

export const Route = createFileRoute("/contact")({
  head: () => ({ meta: [{ title: "Contact — WarehouseJobs" }] }),
  component: Contact,
});

function Contact() {
  const [sending, setSending] = useState(false);
  const { data: page } = useQuery({
    queryKey: ["site-page", "contact"],
    queryFn: async () => {
      const { data } = await supabase
        .from("site_pages")
        .select("title, body")
        .eq("slug", "contact")
        .eq("published", true)
        .maybeSingle();
      return data;
    },
  });
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setTimeout(() => {
      setSending(false);
      toast.success("Message sent — we'll be back to you within one business day.");
      (e.target as HTMLFormElement).reset();
    }, 600);
  };
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 md:grid-cols-2">
        <div>
          <p className="label-caps text-primary">Talk to us</p>
          <h1 className="mt-3 text-4xl font-bold text-[color:var(--ink)]">{page?.title ?? "Get in touch."}</h1>
          {page?.body && <div className="mt-3 text-foreground"><Markdown>{page.body}</Markdown></div>}
          <ul className="mt-8 space-y-4 text-sm">
            <li className="flex items-start gap-3"><Phone className="mt-0.5 h-5 w-5 text-primary" /> <span><strong>(555) 480-DOCK</strong><br /><span className="text-muted-foreground">Mon–Fri, 7am–7pm CT</span></span></li>
            <li className="flex items-start gap-3"><Mail className="mt-0.5 h-5 w-5 text-primary" /> <span><strong>hiring@dockhire.example</strong></span></li>
            <li className="flex items-start gap-3"><MapPin className="mt-0.5 h-5 w-5 text-primary" /> <span>2400 Industrial Pkwy<br />Indianapolis, IN 46241</span></li>
          </ul>
        </div>
        <form onSubmit={submit} className="space-y-4 rounded-xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
          <div className="space-y-1.5"><Label>Name</Label><Input required /></div>
          <div className="space-y-1.5"><Label>Company</Label><Input /></div>
          <div className="space-y-1.5"><Label>Email</Label><Input type="email" required /></div>
          <div className="space-y-1.5"><Label>How can we help?</Label><Textarea required rows={5} /></div>
          <Button type="submit" disabled={sending} className="btn-primary w-full">{sending ? "Sending…" : "Send message"}</Button>
        </form>
      </div>
      <SiteFooter />
    </div>
  );
}
