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
    const body = await req.json().catch(() => ({}));
    const package_id: string | undefined = body.package_id;
    const intent: string = body.intent ?? "purchase";
    const pending_job_id: string | null = body.pending_job_id ?? null;

    if (!package_id) {
      return new Response(JSON.stringify({ error: "package_id required" }), {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id;
    const userEmail = userData.user.email ?? undefined;

    const admin = createClient(supabaseUrl, serviceKey);

    // Resolve the company owned by (or actively administered by) this user
    let companyId: string | null = null;
    const { data: owned } = await admin
      .from("companies")
      .select("id")
      .eq("owner_id", userId)
      .limit(1)
      .maybeSingle();
    if (owned?.id) {
      companyId = owned.id;
    } else {
      const { data: mem } = await admin
        .from("company_members")
        .select("company_id")
        .eq("user_id", userId)
        .eq("status", "active")
        .in("role", ["owner", "admin"])
        .limit(1)
        .maybeSingle();
      companyId = mem?.company_id ?? null;
    }
    if (!companyId) {
      return new Response(JSON.stringify({ error: "No company found for this user" }), {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // Look up the package server-side — never trust client price
    const { data: pkg, error: pkgErr } = await admin
      .from("packages")
      .select("*")
      .eq("id", package_id)
      .eq("active", true)
      .maybeSingle();
    if (pkgErr || !pkg) {
      return new Response(JSON.stringify({ error: "Package not found" }), {
        status: 404,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2024-06-20" });

    const origin = req.headers.get("origin") || "";

    // Allow-list of internal paths the client may target for success/cancel.
    const ALLOWED_REDIRECT_PATHS = new Set([
      "/employer/ads",
      "/employer/billing",
      "/employer/jobs/new",
      "/pricing",
    ]);
    const toInternalPath = (raw: unknown): string | null => {
      if (typeof raw !== "string" || raw.length === 0) return null;
      let pathname: string;
      try {
        // Accept either a full URL (same origin) or a bare path.
        const url = raw.startsWith("/") ? new URL(raw, origin || "http://x") : new URL(raw);
        pathname = url.pathname;
      } catch {
        return null;
      }
      return ALLOWED_REDIRECT_PATHS.has(pathname) ? pathname : null;
    };

    const requestedSuccessPath = toInternalPath(body.success_url);
    const requestedCancelPath = toInternalPath(body.cancel_url);

    const successPath =
      requestedSuccessPath ?? (pending_job_id ? "/employer/jobs/new" : "/employer/billing");
    const cancelPath = requestedCancelPath ?? (pending_job_id ? "/employer/jobs/new" : "/pricing");

    const successQuery = new URLSearchParams({
      checkout: "success",
      session_id: "{CHECKOUT_SESSION_ID}",
    });
    const cancelQuery = new URLSearchParams({ checkout: "cancelled" });
    if (pending_job_id && successPath === "/employer/jobs/new") {
      successQuery.set("draft", pending_job_id);
    }
    if (pending_job_id && cancelPath === "/employer/jobs/new") {
      cancelQuery.set("draft", pending_job_id);
    }

    // Stripe requires the unescaped {CHECKOUT_SESSION_ID} placeholder.
    const successBase = `${origin}${successPath}?${successQuery.toString()}`.replace(
      "session_id=%7BCHECKOUT_SESSION_ID%7D",
      "session_id={CHECKOUT_SESSION_ID}",
    );
    const cancelBase = `${origin}${cancelPath}?${cancelQuery.toString()}`;

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      customer_email: userEmail,
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: { name: pkg.name, description: pkg.description ?? undefined },
            unit_amount: pkg.price_cents,
          },
          quantity: 1,
        },
      ],
      success_url: successBase,
      cancel_url: cancelBase,
      metadata: {
        company_id: companyId,
        package_id: pkg.id,
        posting_count: String(pkg.posting_count ?? 0),
        featured_count: String(pkg.featured_count ?? 0),
        duration_days: String(pkg.duration_days ?? 30),
        pending_job_id: pending_job_id ?? "",
        intent,
        user_id: userId,
      },
    });

    const { error: orderErr } = await admin.from("orders").insert({
      company_id: companyId,
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
  } catch (e: unknown) {
    console.error("create-checkout error", e);
    return new Response(JSON.stringify({ error: (e as Error)?.message ?? "Server error" }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
