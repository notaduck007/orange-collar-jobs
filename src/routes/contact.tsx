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

const SUBJECTS = [
  "I'm a job seeker and need help",
  "I'm an employer / want to post jobs",
  "Billing question",
  "Partnerships",
  "Press",
  "Something else",
] as const;
type Subject = (typeof SUBJECTS)[number];

const MAX_BODY = 1000;

const baseSchema = z.object({
  name: z.string().trim().min(1, "Please enter your name").max(120),
  email: z.string().trim().email("Please enter a valid email address").max(255),
  subject: z.enum(SUBJECTS, { errorMap: () => ({ message: "Please choose a topic" }) }),
  company: z.string().trim().max(120).optional().or(z.literal("")),
  body: z
    .string()
    .trim()
    .min(20, "Please write at least 20 characters")
    .max(MAX_BODY, `Please keep it under ${MAX_BODY} characters`),
  website: z.string().max(0, "Spam detected"),
});

type Errors = Partial<Record<"name" | "email" | "subject" | "company" | "body", string>>;

function Contact() {
  const { user } = useAuth();
  const { page } = Route.useLoaderData();
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [errors, setErrors] = useState<Errors>({});

  const [name, setName] = useState("");
  const [email, setEmail] = useState(user?.email ?? "");
  const [subject, setSubject] = useState<Subject | "">("");
  const [company, setCompany] = useState("");
  const [body, setBody] = useState("");
  const [website, setWebsite] = useState("");

  const isEmployer = subject === "I'm an employer / want to post jobs";

  const schema = useMemo(
    () =>
      isEmployer
        ? baseSchema.extend({
            company: z.string().trim().min(1, "Please enter your company name").max(120),
          })
        : baseSchema,
    [isEmployer],
  );

  const validate = () => {
    const parsed = schema.safeParse({ name, email, subject, company, body, website });
    if (parsed.success) {
      setErrors({});
      return parsed.data;
    }
    const next: Errors = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0] as keyof Errors;
      if (key && !next[key]) next[key] = issue.message;
    }
    setErrors(next);
    return null;
  };

  const validateField = (field: keyof Errors) => {
    const parsed = schema.safeParse({ name, email, subject, company, body, website });
    if (parsed.success) {
      setErrors((e) => ({ ...e, [field]: undefined }));
      return;
    }
    const issue = parsed.error.issues.find((i) => i.path[0] === field);
    setErrors((e) => ({ ...e, [field]: issue?.message }));
  };

  const resetForm = () => {
    setName("");
    setEmail(user?.email ?? "");
    setSubject("");
    setCompany("");
    setBody("");
    setWebsite("");
    setErrors({});
    setSent(false);
  };

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = validate();
    if (!data) return;
    setSending(true);
    const bodyText = `From: ${data.name}${data.company ? ` (${data.company})` : ""}\n\n${data.body}`;
    const { error } = await supabase.from("support_tickets").insert({
      user_id: user?.id ?? null,
      email: data.email,
      subject: data.subject,
      body: bodyText,
    });
    setSending(false);
    if (error) {
      setErrors({ body: error.message });
      return;
    }
    setSent(true);
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

        <div className="overflow-hidden rounded-xl border border-border border-t-4 border-t-primary bg-card p-6 shadow-[var(--shadow-card)] sm:p-8 lg:col-span-3">
          {sent ? (
            <div className="py-6 text-center">
              <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Check className="h-7 w-7" strokeWidth={2.5} />
              </span>
              <h2 className="mt-5 text-2xl font-bold text-[color:var(--ink)]">Message sent!</h2>
              <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
                We'll reply within one business day to <strong>{email}</strong>.
              </p>
              <div className="mt-6 flex flex-col items-center gap-3">
                <Link to="/jobs">
                  <Button variant="outline" className="gap-1.5">
                    Browse jobs while you wait <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
                <button
                  type="button"
                  onClick={resetForm}
                  className="text-sm text-primary underline-offset-4 hover:underline"
                >
                  Send another message
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4" noValidate>
              {/* Honeypot — hidden from real users */}
              <div aria-hidden="true" className="absolute left-[-9999px] top-auto h-0 w-0 overflow-hidden">
                <label>
                  Website
                  <input
                    type="text"
                    name="website"
                    tabIndex={-1}
                    autoComplete="off"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                  />
                </label>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="contact-name">Name</Label>
                <Input
                  id="contact-name"
                  name="name"
                  maxLength={120}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onBlur={() => validateField("name")}
                  aria-invalid={!!errors.name}
                />
                {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="contact-company">
                  {isEmployer ? "Company" : "Company (optional)"}
                </Label>
                <Input
                  id="contact-company"
                  name="company"
                  maxLength={120}
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  onBlur={() => validateField("company")}
                  aria-invalid={!!errors.company}
                />
                {errors.company && <p className="text-xs text-destructive">{errors.company}</p>}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="contact-email">Email</Label>
                <Input
                  id="contact-email"
                  name="email"
                  type="email"
                  maxLength={255}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onBlur={() => validateField("email")}
                  aria-invalid={!!errors.email}
                />
                {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="contact-subject">What's this about?</Label>
                <Select
                  value={subject}
                  onValueChange={(v) => {
                    setSubject(v as Subject);
                    setErrors((e) => ({ ...e, subject: undefined }));
                  }}
                >
                  <SelectTrigger id="contact-subject" aria-invalid={!!errors.subject}>
                    <SelectValue placeholder="Choose a topic" />
                  </SelectTrigger>
                  <SelectContent>
                    {SUBJECTS.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.subject && <p className="text-xs text-destructive">{errors.subject}</p>}
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="contact-body">How can we help?</Label>
                  <span
                    className={
                      body.length > MAX_BODY
                        ? "text-xs text-destructive"
                        : "text-xs text-muted-foreground"
                    }
                  >
                    {body.length} / {MAX_BODY}
                  </span>
                </div>
                <Textarea
                  id="contact-body"
                  name="body"
                  rows={6}
                  maxLength={MAX_BODY}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  onBlur={() => validateField("body")}
                  aria-invalid={!!errors.body}
                />
                {errors.body && <p className="text-xs text-destructive">{errors.body}</p>}
              </div>

              <Button type="submit" disabled={sending} className="btn-primary w-full">
                {sending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Sending…
                  </>
                ) : (
                  "Send message"
                )}
              </Button>
            </form>
          )}
        </div>
      </div>
      <SiteFooter />
    </div>
  );
}
