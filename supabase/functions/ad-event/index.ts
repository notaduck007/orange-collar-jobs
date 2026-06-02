// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

async function hashIp(ip: string) {
  const data = new TextEncoder().encode(ip + (Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""));
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const { advertisement_id, type, ad_slot } = await req.json();
    if (!advertisement_id || !["impression", "click"].includes(type)) {
      return new Response(JSON.stringify({ error: "Invalid payload" }), {
        status: 400, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Verify ad exists & is active within window
    const today = new Date().toISOString().slice(0, 10);
    const { data: ad } = await admin
      .from("advertisements")
      .select("id, status, start_date, end_date")
      .eq("id", advertisement_id)
      .maybeSingle();
    if (!ad || ad.status !== "active") {
      return new Response(JSON.stringify({ ok: false }), { headers: { ...cors, "Content-Type": "application/json" } });
    }
    if (ad.start_date && ad.start_date > today) return new Response(JSON.stringify({ ok: false }), { headers: cors });
    if (ad.end_date && ad.end_date < today) return new Response(JSON.stringify({ ok: false }), { headers: cors });

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      || req.headers.get("cf-connecting-ip") || "unknown";
    const ip_hash = await hashIp(ip);

    // Debounce: dedupe identical (ad, type, ip) events within last 30s
    const since = new Date(Date.now() - 30_000).toISOString();
    const { data: recent } = await admin
      .from("ad_events")
      .select("id")
      .eq("advertisement_id", advertisement_id)
      .eq("type", type)
      .eq("ip_hash", ip_hash)
      .gte("occurred_at", since)
      .limit(1);
    if (recent && recent.length > 0) {
      return new Response(JSON.stringify({ ok: true, deduped: true }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    await admin.from("ad_events").insert({
      advertisement_id, type, ip_hash, ad_slot: ad_slot ?? null,
    });

    // Keep aggregate counters fresh
    if (type === "impression") await admin.rpc("ad_increment_impression", { _ad_id: advertisement_id });
    else await admin.rpc("ad_increment_click", { _ad_id: advertisement_id });

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("ad-event error", e);
    return new Response(JSON.stringify({ error: e.message ?? "Server error" }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
