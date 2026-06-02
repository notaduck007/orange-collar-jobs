// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

function corsHeaders(req: Request) {
  const allowed = (Deno.env.get("ALLOWED_ORIGINS") ?? "")
    .split(",").map((s) => s.trim()).filter(Boolean);
  const origin = req.headers.get("origin") ?? "";
  const allowOrigin = allowed.includes(origin) ? origin : (allowed[0] ?? "null");
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Vary": "Origin",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

const json = (req: Request, b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders(req), "Content-Type": "application/json" } });

serve(async (req) => {
  const cors = corsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json(req, { error: "Unauthorized" }, 401);

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return json(req, { error: "Unauthorized" }, 401);
    const actorId = userData.user.id;

    const admin = createClient(supabaseUrl, serviceKey);

    const { data: hasCap } = await admin.rpc("has_permission", {
      _user_id: actorId,
      _permission_key: "orders.refund",
    });
    if (!hasCap) return json(req, { error: "Forbidden — billing capability required" }, 403);

    const body = await req.json();
    const orderId: string | undefined = body.order_id;
    const reason: string = body.reason ?? "Refund issued by admin";
    if (!orderId) return json(req, { error: "order_id required" }, 400);

    const { data: order, error: oErr } = await admin
      .from("orders")
      .select("*, companies(name, owner_id), packages(name)")
      .eq("id", orderId)
      .maybeSingle();
    if (oErr || !order) return json(req, { error: "Order not found" }, 404);
    if (order.status === "refunded") return json(req, { error: "Order already refunded" }, 400);
    if (order.status !== "paid") return json(req, { error: `Cannot refund order in status '${order.status}'` }, 400);

    // Stripe refund
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    let refundId: string | null = null;
    if (stripeKey && order.stripe_payment_intent) {
      const stripe = new Stripe(stripeKey, { apiVersion: "2024-06-20" });
      try {
        const refund = await stripe.refunds.create({
          payment_intent: order.stripe_payment_intent,
          reason: "requested_by_customer",
          metadata: { order_id: order.id, actor_id: actorId, note: reason },
        });
        refundId = refund.id;
      } catch (e: any) {
        return json(req, { error: `Stripe refund failed: ${e.message}` }, 400);
      }
    }

    // Reverse credits
    const reversals: Array<{ credit_type: string; delta: number }> = [];
    const postGranted = order.posting_count_granted ?? 0;
    const featGranted = order.featured_count_granted ?? 0;
    if (order.company_id) {
      for (const [type, qty] of [["post", postGranted], ["featured", featGranted]] as const) {
        if (!qty || qty <= 0) continue;
        const { data: cc } = await admin
          .from("company_credits")
          .select("balance")
          .eq("company_id", order.company_id)
          .eq("credit_type", type)
          .maybeSingle();
        const current = cc?.balance ?? 0;
        const reverse = Math.min(qty, current); // don't go negative
        if (reverse > 0) {
          await admin
            .from("company_credits")
            .update({ balance: current - reverse, updated_at: new Date().toISOString() })
            .eq("company_id", order.company_id)
            .eq("credit_type", type);
        }
        // Always record the attempted reversal for audit trail
        await admin.from("credit_transactions").insert({
          company_id: order.company_id,
          credit_type: type,
          delta: -qty,
          reason: "refund",
          order_id: order.id,
        });
        reversals.push({ credit_type: type, delta: -qty });
      }
    }

    // Update order
    await admin
      .from("orders")
      .update({ status: "refunded" })
      .eq("id", orderId);

    // Audit
    await admin.from("audit_log").insert({
      actor_id: actorId,
      action: "order_refund",
      entity_type: "order",
      entity_id: orderId,
      reason,
      metadata: {
        amount_cents: order.amount_cents,
        stripe_refund_id: refundId,
        stripe_payment_intent: order.stripe_payment_intent,
        reversals,
        company_id: order.company_id,
      },
    });

    // Notify company owner
    const ownerId = (order as any).companies?.owner_id;
    if (ownerId) {
      await admin.from("notifications").insert({
        user_id: ownerId,
        sender_id: actorId,
        type: "billing",
        title: "Refund issued",
        body: `Your order for ${(order as any).packages?.name ?? "a package"} ($${((order.amount_cents ?? 0) / 100).toFixed(2)}) has been refunded. ${reason}`,
        link: "/employer/billing",
      });
    }

    return json(req, { ok: true, refund_id: refundId, reversals });
  } catch (e: any) {
    console.error("refund-order error", e);
    return json(req, { error: e?.message ?? "Internal error" }, 500);
  }
});
