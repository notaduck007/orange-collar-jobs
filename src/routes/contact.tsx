import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Mail, Phone, MapPin, Building2, ArrowRight, Check, Loader2 } from "lucide-react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Markdown } from "@/components/markdown";
import { canonical } from "@/lib/seo";

export const Route = createFileRoute("/contact")({
  loader: async () => {
    const { data } = await supabase
      .from("site_pages")
      .select("title, body")
      .eq("slug", "contact")
      .eq("published", true)
      .maybeSingle();
    return { page: data ?? null };
  },
  head: () => ({
    meta: [
      { title: "Contact — WarehouseJobs.com" },
      {
        name: "description",
        content:
          "Get in touch with the WarehouseJobs team — support for job seekers and employers.",
      },
    ],
    links: [{ rel: "canonical", href: canonical("/contact") }],
  }),
  component: Contact,
});

const schema = z.object({
  name: z.string().trim().min(1).max(120),
  company: z.string().trim().max(120).optional(),
  email: z.string().trim().email().max(255),
  subject: z.string().trim().min(3).max(200),
  body: z.string().trim().min(5).max(4000),
});

function Contact() {
  const { user } = useAuth();
  const [sending, setSending] = useState(false);
  const { page } = Route.useLoaderData();

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const parsed = schema.safeParse({
      name: fd.get("name"),
      company: fd.get("company") || undefined,
      email: fd.get("email"),
      subject: fd.get("subject"),
      body: fd.get("body"),
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Please check the form");
      return;
    }
    setSending(true);
    const subject = parsed.data.subject;
    const bodyText = `From: ${parsed.data.name}${parsed.data.company ? ` (${parsed.data.company})` : ""}\n\n${parsed.data.body}`;
    const { error } = await supabase.from("support_tickets").insert({
      user_id: user?.id ?? null,
      email: parsed.data.email,
      subject,
      body: bodyText,
    });
    setSending(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Message sent — we'll be back to you within one business day.");
    form.reset();
  };

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <section className="border-b border-border bg-card/40">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20 lg:py-24">
          <p className="label-caps text-primary">Talk to us</p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight text-[color:var(--ink)] sm:text-5xl lg:text-6xl">
            {page?.title ?? "Contact Us"}
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
            Real people, real answers — usually within one business day.
          </p>
          {page?.body && (
            <div className="mt-4 max-w-2xl text-foreground">
              <Markdown>{page.body}</Markdown>
            </div>
          )}
        </div>
      </section>

      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-16 sm:px-6 lg:grid-cols-5 lg:gap-10">
        <aside className="space-y-6 lg:col-span-2">
          <div className="rounded-xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
            <ul className="space-y-6 text-sm">
              <li className="flex items-start gap-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Phone className="h-5 w-5" />
                </span>
                <span>
                  <strong className="block text-[color:var(--ink)]">(555) 480-DOCK</strong>
                  <span className="text-muted-foreground">Mon–Fri, 7am–7pm CT</span>
                </span>
              </li>
              <li className="flex items-start gap-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Mail className="h-5 w-5" />
                </span>
                <span>
                  <strong className="block text-[color:var(--ink)]">hiring@dockhire.example</strong>
                </span>
              </li>
              <li className="flex items-start gap-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <MapPin className="h-5 w-5" />
                </span>
                <span className="text-[color:var(--ink)]">
                  2400 Industrial Pkwy
                  <br />
                  Indianapolis, IN 46241
                </span>
              </li>
            </ul>
          </div>

          <div className="rounded-xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Building2 className="h-4 w-4" />
              </span>
              <div>
                <h2 className="text-base font-semibold text-[color:var(--ink)]">Looking to hire?</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  See posting packages and reach qualified warehouse workers fast.
                </p>
                <Link to="/pricing" className="mt-3 inline-block">
                  <Button size="sm" variant="outline" className="gap-1.5">
                    View pricing <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </aside>

        <form
          onSubmit={submit}
          className="space-y-4 overflow-hidden rounded-xl border border-border border-t-4 border-t-primary bg-card p-6 shadow-[var(--shadow-card)] sm:p-8 lg:col-span-3"
        >
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input name="name" required maxLength={120} />
          </div>
          <div className="space-y-1.5">
            <Label>Company</Label>
            <Input name="company" maxLength={120} />
          </div>
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input
              name="email"
              type="email"
              required
              maxLength={255}
              defaultValue={user?.email ?? ""}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Subject</Label>
            <Input name="subject" required maxLength={200} placeholder="What's this about?" />
          </div>
          <div className="space-y-1.5">
            <Label>How can we help?</Label>
            <Textarea name="body" required rows={6} maxLength={4000} />
          </div>
          <Button type="submit" disabled={sending} className="btn-primary w-full">
            {sending ? "Sending…" : "Send message"}
          </Button>
        </form>
      </div>
      <SiteFooter />
    </div>
  );
}
