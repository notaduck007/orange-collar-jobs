// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const { package_id, company_id, success_url, cancel_url } = await req.json();
    if (!package_id || !company_id) {
      return new Response(JSON.stringify({ error: "package_id and company_id required" }), {
        status: 400, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: cors });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: cors });
    }
    const userId = userData.user.id;
    const userEmail = userData.user.email;

    const admin = createClient(supabaseUrl, serviceKey);

    // Verify user is owner or active member of the company
    const { data: company } = await admin.from("companies").select("id, owner_id, name").eq("id", company_id).maybeSingle();
    if (!company) return new Response(JSON.stringify({ error: "Company not found" }), { status: 404, headers: cors });

    let allowed = company.owner_id === userId;
    if (!allowed) {
      const { data: mem } = await admin
        .from("company_members")
        .select("id")
        .eq("company_id", company_id)
        .eq("user_id", userId)
        .eq("status", "active")
        .in("role", ["owner", "admin"])
        .maybeSingle();
      allowed = !!mem;
    }
    if (!allowed) return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: cors });

    const { data: pkg, error: pkgErr } = await admin
      .from("packages").select("*").eq("id", package_id).eq("active", true).maybeSingle();
    if (pkgErr || !pkg) {
      return new Response(JSON.stringify({ error: "Package not found" }), { status: 404, headers: cors });
    }

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2024-06-20" });

    const origin = req.headers.get("origin") || "";
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      customer_email: userEmail,
      line_items: [{
        price_data: {
          currency: "usd",
          product_data: { name: pkg.name, description: pkg.description ?? undefined },
          unit_amount: pkg.price_cents,
        },
        quantity: 1,
      }],
      success_url: success_url || `${origin}/employer/billing?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancel_url || `${origin}/pricing?checkout=cancelled`,
      metadata: {
        package_id: pkg.id,
        company_id,
        user_id: userId,
      },
    });

    const { error: orderErr } = await admin.from("orders").insert({
      company_id,
      package_id: pkg.id,
      amount_cents: pkg.price_cents,
      currency: "usd",
      status: "pending",
      stripe_session_id: session.id,
      posting_count_granted: pkg.posting_count ?? 0,
      featured_count_granted: pkg.featured_count ?? 0,
      package_snapshot: pkg,
    });
    if (orderErr) console.error("order insert error", orderErr);

    return new Response(JSON.stringify({ url: session.url, session_id: session.id }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("create-checkout error", e);
    return new Response(JSON.stringify({ error: e.message ?? "Server error" }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
