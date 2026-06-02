// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function resolveRecipientEmail(value: string): Promise<string | null> {
  if (!value) return null;
  if (!UUID_RE.test(value)) return value; // already an email (or other string)

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) return null;

  const admin = createClient(supabaseUrl, serviceKey);

  // Try profiles table first (may have an email column on some projects)
  try {
    const { data: prof } = await admin
      .from("profiles")
      .select("email")
      .eq("id", value)
      .maybeSingle();
    const profEmail = (prof as any)?.email;
    if (profEmail && typeof profEmail === "string") return profEmail;
  } catch (_) {
    // ignore — fall through to auth lookup
  }

  // Fall back to auth.users via admin API
  const { data, error } = await admin.auth.admin.getUserById(value);
  if (error || !data?.user?.email) return null;
  return data.user.email;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const { to, subject, body, from } = await req.json();
    if (!to || !subject) {
      return new Response(JSON.stringify({ error: "missing to/subject" }), {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const recipient = await resolveRecipientEmail(String(to));
    if (!recipient) {
      return new Response(
        JSON.stringify({ error: "could not resolve recipient email" }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } },
      );
    }

    const sender = from ?? "WarehouseJobs <no-reply@warehousejobs.app>";
    const resendKey = Deno.env.get("RESEND_API_KEY");

    if (!resendKey) {
      console.log("[send-email] RESEND_API_KEY not set; skipping send", {
        from: sender, to: recipient, subject,
      });
      return new Response(
        JSON.stringify({ ok: false, skipped: true, reason: "email_provider_not_configured" }),
        { headers: { ...cors, "Content-Type": "application/json" } },
      );
    }

    const html = typeof body === "string" && body.length > 0
      ? body
      : `<p>${subject}</p>`;

    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: sender,
        to: [recipient],
        subject,
        html,
      }),
    });

    const respBody = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      console.error("[send-email] resend error", resp.status, respBody);
      return new Response(
        JSON.stringify({ error: "send_failed", status: resp.status, details: respBody }),
        { status: 502, headers: { ...cors, "Content-Type": "application/json" } },
      );
    }

    return new Response(JSON.stringify({ ok: true, id: (respBody as any)?.id ?? null }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message ?? "error" }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
