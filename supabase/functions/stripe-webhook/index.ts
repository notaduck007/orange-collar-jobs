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
  } catch (err: any) {
    console.error("Signature verification failed", err.message);
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;

      // Idempotency: only update if not already paid/fulfilled
      const { data: existing } = await admin
        .from("orders")
        .select("id, status, fulfilled_at")
        .eq("stripe_session_id", session.id)
        .maybeSingle();

      if (!existing) {
        console.warn("No order found for session", session.id);
        return new Response(JSON.stringify({ received: true, note: "no order" }), { status: 200 });
      }

      if (existing.fulfilled_at) {
        return new Response(JSON.stringify({ received: true, idempotent: true }), { status: 200 });
      }

      let receiptUrl: string | null = null;
      const paymentIntentId = typeof session.payment_intent === "string"
        ? session.payment_intent
        : session.payment_intent?.id ?? null;
      if (paymentIntentId) {
        try {
          const pi = await stripe.paymentIntents.retrieve(paymentIntentId, { expand: ["latest_charge"] });
          const charge = pi.latest_charge as Stripe.Charge | null;
          receiptUrl = charge?.receipt_url ?? null;
        } catch (e) { console.error("PI retrieve failed", e); }
      }

      const { error: updErr } = await admin
        .from("orders")
        .update({
          status: "paid",
          stripe_payment_intent: paymentIntentId,
          receipt_url: receiptUrl,
        })
        .eq("id", existing.id)
        .neq("status", "paid");
      if (updErr) console.error("order update error", updErr);

      // Grant credits (function is itself idempotent via fulfilled_at check)
      const { error: grantErr } = await admin.rpc("grant_credits_for_order", { _order_id: existing.id });
      if (grantErr) console.error("grant_credits_for_order error", grantErr);
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200, headers: { "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("webhook handler error", e);
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
});
