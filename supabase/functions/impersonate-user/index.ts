// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return json({ error: "Unauthorized" }, 401);
    const actorId = userData.user.id;

    const admin = createClient(supabaseUrl, serviceKey);

    // Allowed: app_role 'admin' OR admin_permissions level super_admin/support
    const [{ data: roleRow }, { data: perm }] = await Promise.all([
      admin.from("user_roles").select("role").eq("user_id", actorId).eq("role", "admin").maybeSingle(),
      admin.from("admin_permissions").select("level").eq("user_id", actorId).maybeSingle(),
    ]);
    const allowed = !!roleRow || (perm && ["super_admin", "support"].includes(perm.level));
    if (!allowed) return json({ error: "Forbidden" }, 403);

    const body = await req.json().catch(() => ({}));
    const targetId: string | undefined = body.user_id;
    const reason: string | undefined = body.reason;
    const targetLabel: string | undefined = body.target_label;
    const targetKind: string = body.target_kind ?? "user";
    const entityId: string = body.entity_id ?? targetId ?? "";
    if (!targetId) return json({ error: "user_id required" }, 400);
    if (targetId === actorId) return json({ error: "Cannot impersonate self" }, 400);

    const { data: tgt, error: tgtErr } = await admin.auth.admin.getUserById(targetId);
    if (tgtErr || !tgt.user?.email) return json({ error: "Target not found or has no email" }, 404);

    const { data: link, error: linkErr } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email: tgt.user.email,
    });
    if (linkErr || !link.properties?.hashed_token) {
      return json({ error: linkErr?.message ?? "Failed to mint session" }, 500);
    }

    await admin.from("audit_log").insert({
      actor_id: actorId,
      action: "impersonate_start",
      entity_type: targetKind,
      entity_id: entityId,
      reason: reason ?? null,
      metadata: {
        target_user_id: targetId,
        target_email: tgt.user.email,
        target_label: targetLabel ?? null,
      },
    });

    return json({
      token_hash: link.properties.hashed_token,
      target_user_id: targetId,
      target_email: tgt.user.email,
      actor_id: actorId,
    });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
