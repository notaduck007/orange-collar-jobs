// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2024-06-20" });
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;
  const signature = req.headers.get("stripe-signature");
  if (!signature) return new Response("Missing signature", { status: 400 });

  const body = await req.text();
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
  } catch (err: unknown) {
    const msg = (err as Error)?.message ?? "Server error";
    console.error("Signature verification failed", msg);
    return new Response(`Webhook Error: ${msg}`, { status: 400 });
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;

      const { data: existing } = await admin
        .from("orders")
        .select(
          "id, status, company_id, package_id, posting_count_granted, featured_count_granted, fulfilled_at",
        )
        .eq("stripe_session_id", session.id)
        .maybeSingle();

      if (!existing) {
        console.warn("No order found for session", session.id);
        return new Response(JSON.stringify({ received: true, note: "no order" }), { status: 200 });
      }

      if (existing.status === "paid" || existing.fulfilled_at) {
        return new Response(JSON.stringify({ received: true, idempotent: true }), { status: 200 });
      }

      // Receipt URL
      let receiptUrl: string | null = null;
      const paymentIntentId =
        typeof session.payment_intent === "string"
          ? session.payment_intent
          : (session.payment_intent?.id ?? null);
      if (paymentIntentId) {
        try {
          const pi = await stripe.paymentIntents.retrieve(paymentIntentId, {
            expand: ["latest_charge"],
          });
          const charge = pi.latest_charge as Stripe.Charge | null;
          receiptUrl = charge?.receipt_url ?? null;
        } catch (e) {
          console.error("PI retrieve failed", e);
        }
      }

      const { error: updErr } = await admin
        .from("orders")
        .update({
          status: "paid",
          stripe_payment_intent: paymentIntentId,
          receipt_url: receiptUrl,
          fulfilled_at: new Date().toISOString(),
        })
        .eq("id", existing.id)
        .neq("status", "paid");
      if (updErr) console.error("order update error", updErr);

      // Look up duration from package (fallback to metadata)
      const md = (session.metadata ?? {}) as Record<string, string>;
      let durationDays = parseInt(md.duration_days ?? "0", 10);
      if (!durationDays && existing.package_id) {
        const { data: pkg } = await admin
          .from("packages")
          .select("duration_days")
          .eq("id", existing.package_id)
          .maybeSingle();
        durationDays = pkg?.duration_days ?? 30;
      }
      if (!durationDays) durationDays = 30;

      const expiresAt = new Date(Date.now() + durationDays * 86400_000).toISOString();

      const { error: cpErr } = await admin.from("company_packages").insert({
        company_id: existing.company_id,
        package_id: existing.package_id,
        order_id: existing.id,
        posts_total: existing.posting_count_granted ?? 0,
        posts_used: 0,
        featured_total: existing.featured_count_granted ?? 0,
        featured_used: 0,
        expires_at: expiresAt,
        status: "active",
      });
      if (cpErr) console.error("company_packages insert error", cpErr);

      // Send receipt email (best-effort, non-blocking on failure)
      try {
        const { data: paidOrder } = await admin
          .from("orders")
          .select("id, invoice_number, amount_cents, currency, package_snapshot, receipt_url")
          .eq("id", existing.id)
          .maybeSingle();
        const email = session.customer_details?.email || session.customer_email;
        const snap = (paidOrder?.package_snapshot ?? {}) as {
          name?: string;
          posting_count?: number;
          featured_count?: number;
        };
        const pkgName = snap?.name ?? "Posting package";
        const inv = paidOrder?.invoice_number ?? "—";
        const amount = ((paidOrder?.amount_cents ?? 0) / 100).toFixed(2);
        const validUntil = new Date(expiresAt).toLocaleDateString();

        // Resolve brand name from site_settings (fallback to WarehouseJobs).
        let brandName = "WarehouseJobs";
        try {
          const { data: branding } = await admin
            .from("site_settings")
            .select("value")
            .eq("key", "branding")
            .maybeSingle();
          const v = (branding?.value ?? {}) as { site_name?: string };
          if (v?.site_name) brandName = v.site_name;
        } catch (_) {
          /* keep fallback */
        }

        // Build absolute URLs. Prefer SITE_URL env; fall back to request origin.
        const siteUrlEnv = (Deno.env.get("SITE_URL") ?? "").replace(/\/$/, "");
        let origin = siteUrlEnv;
        if (!origin) {
          try {
            origin = new URL(req.url).origin;
          } catch (_) {
            origin = "";
          }
        }
        const billingUrl = `${origin}/employer/billing`;
        const postJobUrl = `${origin}/employer/jobs/new`;

        if (email) {
          const body = `
Thanks for your purchase — welcome aboard from the ${brandName} team.

Your ${pkgName} is ready to use. Here's what's next:

  Post your job → ${postJobUrl}

Order details
-------------
Invoice: ${inv}
Package: ${pkgName}
Posts included: ${snap?.posting_count ?? existing.posting_count_granted ?? 0}
Featured upgrades: ${snap?.featured_count ?? existing.featured_count_granted ?? 0}
Valid until: ${validUntil}
Amount charged: $${amount} ${(paidOrder?.currency ?? "usd").toUpperCase()}
${paidOrder?.receipt_url ? `Stripe receipt: ${paidOrder.receipt_url}\n` : ""}
You can review every invoice and active package any time on your billing page:
${billingUrl}

Thanks again,
The ${brandName} team
          `.trim();
          await admin.functions.invoke("send-email", {
            body: {
              to: email,
              subject: `${brandName} receipt ${inv} — ${pkgName}`,
              body,
            },
          });
        }
      } catch (e) {
        console.error("receipt email failed", e);
      }
    } else if (
      event.type === "checkout.session.expired" ||
      event.type === "checkout.session.async_payment_failed" ||
      event.type === "payment_intent.payment_failed"
    ) {
      let sessionId: string | null = null;
      let paymentIntentId: string | null = null;
      const obj = event.data.object as { id: string };
      if (event.type.startsWith("checkout.session")) {
        sessionId = obj.id;
      } else {
        paymentIntentId = obj.id;
      }
      const query = admin.from("orders").update({ status: "failed" });
      const filtered = sessionId
        ? query.eq("stripe_session_id", sessionId)
        : query.eq("stripe_payment_intent", paymentIntentId!);
      const { error: failErr } = await filtered.neq("status", "paid");
      if (failErr) console.error("order fail update error", failErr);
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e: unknown) {
    console.error("webhook handler error", e);
    return new Response(JSON.stringify({ error: (e as Error)?.message ?? "Server error" }), {
      status: 500,
    });
  }
});
