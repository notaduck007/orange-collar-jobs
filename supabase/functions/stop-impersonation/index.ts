// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.toLowerCase().startsWith("bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) return json({ error: "Unauthorized" }, 401);
    const actorId = userData.user.id;

    const admin = createClient(supabaseUrl, serviceKey);

    const body = await req.json().catch(() => ({}));
    const targetId: string | undefined = body.target_user_id;
    const targetKind: string = body.target_kind ?? "user";
    const targetLabel: string | undefined = body.target_label;
    if (!targetId) return json({ error: "target_user_id required" }, 400);

    await admin.from("audit_log").insert({
      actor_id: actorId,
      action: "impersonate_stop",
      entity_type: targetKind,
      entity_id: targetId,
      reason: body.reason ?? null,
      metadata: {
        target_user_id: targetId,
        target_label: targetLabel ?? null,
        ended_at: new Date().toISOString(),
      },
    });


    return json({ ok: true });
  } catch (e) {
    return json({ error: (e as Error)?.message ?? "Server error" }, 500);
  }
});
