import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Mail, Phone, MapPin } from "lucide-react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 md:grid-cols-2">
        <div>
          <p className="label-caps text-primary">Talk to us</p>
          <h1 className="mt-3 text-4xl font-bold text-[color:var(--ink)]">
            {page?.title ?? "Get in touch."}
          </h1>
          {page?.body && (
            <div className="mt-3 text-foreground">
              <Markdown>{page.body}</Markdown>
            </div>
          )}
          <ul className="mt-8 space-y-4 text-sm">
            <li className="flex items-start gap-3">
              <Phone className="mt-0.5 h-5 w-5 text-primary" />{" "}
              <span>
                <strong>(555) 480-DOCK</strong>
                <br />
                <span className="text-muted-foreground">Mon–Fri, 7am–7pm CT</span>
              </span>
            </li>
            <li className="flex items-start gap-3">
              <Mail className="mt-0.5 h-5 w-5 text-primary" />{" "}
              <span>
                <strong>hiring@dockhire.example</strong>
              </span>
            </li>
            <li className="flex items-start gap-3">
              <MapPin className="mt-0.5 h-5 w-5 text-primary" />{" "}
              <span>
                2400 Industrial Pkwy
                <br />
                Indianapolis, IN 46241
              </span>
            </li>
          </ul>
        </div>
        <form
          onSubmit={submit}
          className="space-y-4 rounded-xl border border-border bg-card p-6 shadow-[var(--shadow-card)]"
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
            <Textarea name="body" required rows={5} maxLength={4000} />
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
