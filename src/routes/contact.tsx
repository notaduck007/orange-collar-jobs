import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Building2, ArrowRight, Check, Loader2, Clock, Calendar, Users } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
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
import contactHero from "@/assets/contact-hero.webp";

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
      <section className="relative isolate w-full overflow-hidden border-b border-border bg-[#14161A]">
        <img
          src={contactHero}
          alt="WarehouseJobs support team ready to help"
          width={1920}
          height={640}
          fetchPriority="high"
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover object-[70%_center] sm:object-center"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/60 to-black/10 sm:from-black/80 sm:via-black/45 sm:to-transparent"
        />
        <div className="relative z-10 mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-24 lg:py-28">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#FF6A00]">
              Talk to us
            </p>
            <h1 className="mt-3 text-4xl font-bold tracking-tight text-white drop-shadow-md sm:text-5xl lg:text-6xl">
              {page?.title ?? "Contact Us"}
            </h1>
            <span aria-hidden="true" className="mt-5 block h-1 w-16 rounded-full bg-[#FF6A00]" />
            <p className="mt-5 max-w-xl text-lg text-white/90 drop-shadow">
              Real people, real answers — usually within one business day.
            </p>
            {page?.body && (
              <div className="mt-4 max-w-xl text-white/85 [&_a]:text-[#FF6A00]">
                <Markdown>{page.body}</Markdown>
              </div>
            )}
          </div>
        </div>
      </section>

      <div className="border-b border-border bg-background">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-6 gap-y-2 px-4 py-4 text-xs text-muted-foreground sm:px-6 sm:text-sm">
          <span className="inline-flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5 text-primary" />
            Replies within 1 business day
          </span>
          <span className="hidden text-muted-foreground/50 sm:inline">·</span>
          <span className="inline-flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-primary" />
            Mon–Fri, 7am–7pm CT
          </span>
          <span className="hidden text-muted-foreground/50 sm:inline">·</span>
          <span className="inline-flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5 text-primary" />
            Real humans, no bots
          </span>
        </div>
      </div>

      <div className="mx-auto max-w-[640px] px-4 py-16 sm:px-6">
        <div className="overflow-hidden rounded-xl border border-border border-t-4 border-t-primary bg-card p-6 shadow-[var(--shadow-card)] sm:p-8">
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
              <div
                aria-hidden="true"
                className="absolute left-[-9999px] top-auto h-0 w-0 overflow-hidden"
              >
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

        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-card px-5 py-4 shadow-[var(--shadow-card)]">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Building2 className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-sm font-semibold text-[color:var(--ink)]">Looking to hire?</h2>
              <p className="text-xs text-muted-foreground">
                See posting packages and reach qualified warehouse workers fast.
              </p>
            </div>
          </div>
          <Link to="/pricing">
            <Button size="sm" variant="outline" className="gap-1.5">
              View pricing <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>

      <section className="border-t border-border bg-card/40">
        <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-20">
          <p className="label-caps text-primary">Quick answers</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-[color:var(--ink)] sm:text-4xl">
            You might not need to wait for a reply.
          </h2>
          <p className="mt-3 text-muted-foreground">
            The most common questions we get — answered right here.
          </p>

          <Accordion type="single" collapsible className="mt-8">
            <AccordionItem value="apply">
              <AccordionTrigger className="text-left text-base font-semibold text-[color:var(--ink)]">
                How do I apply for a job?
              </AccordionTrigger>
              <AccordionContent className="text-[15px] leading-relaxed text-foreground">
                Search by job title, city, or ZIP, then click any listing to see the full
                description, pay, and shift. Most jobs can be applied to in under a minute directly
                on WarehouseJobs — no separate account required on the employer's site.{" "}
                <Link to="/jobs" className="text-primary underline-offset-4 hover:underline">
                  Browse open jobs →
                </Link>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="cost">
              <AccordionTrigger className="text-left text-base font-semibold text-[color:var(--ink)]">
                How much does it cost to post a job?
              </AccordionTrigger>
              <AccordionContent className="text-[15px] leading-relaxed text-foreground">
                WarehouseJobs is always free for job seekers. Employers pay a flat rate per posting
                — no contracts, no per-applicant fees. Your first post is free so you can try us out
                before paying.{" "}
                <Link to="/pricing" className="text-primary underline-offset-4 hover:underline">
                  See posting packages →
                </Link>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="alerts">
              <AccordionTrigger className="text-left text-base font-semibold text-[color:var(--ink)]">
                How do I set up job alerts?
              </AccordionTrigger>
              <AccordionContent className="text-[15px] leading-relaxed text-foreground">
                Create a free job seeker account and we'll email you new openings that match your
                role and location as soon as they're posted. You can pause, edit, or cancel alerts
                anytime from your dashboard.{" "}
                <Link
                  to="/auth"
                  search={{ mode: "signup" } as never}
                  className="text-primary underline-offset-4 hover:underline"
                >
                  Create a free account →
                </Link>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="password">
              <AccordionTrigger className="text-left text-base font-semibold text-[color:var(--ink)]">
                I forgot my password — what do I do?
              </AccordionTrigger>
              <AccordionContent className="text-[15px] leading-relaxed text-foreground">
                Use the "Forgot password?" link on the sign-in page and we'll email you a reset
                link. If it doesn't arrive within a few minutes, check your spam folder or get in
                touch using the form above.{" "}
                <Link
                  to="/auth"
                  search={{ mode: "login" } as never}
                  className="text-primary underline-offset-4 hover:underline"
                >
                  Go to sign in →
                </Link>
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          <p className="mt-8 text-sm">
            <Link to="/faq" className="text-primary underline-offset-4 hover:underline">
              More questions? Visit the full FAQ →
            </Link>
          </p>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
