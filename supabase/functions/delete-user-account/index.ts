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

    const body = await req.json().catch(() => ({}));
    const mode: "soft" | "hard" = body.mode === "hard" ? "hard" : "soft";
    const reason: string | null = body.reason ?? null;
    let targetId: string = actorId;
    let isAdminAction = false;

    if (body.user_id && body.user_id !== actorId) {
      const { data: hasCap } = await admin.rpc("has_admin_permission", {
        _user_id: actorId, _capability: "support",
      });
      if (!hasCap) return json({ error: "Forbidden" }, 403);
      targetId = body.user_id;
      isAdminAction = true;
    }

    // Soft-delete + anonymize (always run)
    const { error: anonErr } = await admin.rpc("anonymize_user", { _user_id: targetId });
    if (anonErr) return json({ error: anonErr.message }, 400);

    // Create / upsert deletion_request row tracking this
    await admin.from("deletion_requests").insert({
      user_id: targetId,
      requested_by: actorId,
      type: "delete",
      status: mode === "hard" ? "completed" : "approved",
      reason,
      processed_by: actorId,
      processed_at: new Date().toISOString(),
    });

    // Hard-delete (admin only) removes auth user — frees the email
    if (mode === "hard") {
      const { error: delErr } = await admin.auth.admin.deleteUser(targetId);
      if (delErr) return json({ error: delErr.message }, 400);
    } else {
      // Soft: ban the auth user so they can't sign in
      try {
        await admin.auth.admin.updateUserById(targetId, { ban_duration: "876000h" } as any);
      } catch (_) { /* ignore */ }
    }

    // Notify user (best-effort)
    if (!isAdminAction) {
      await admin.from("notifications").insert({
        user_id: targetId,
        sender_id: actorId,
        type: "account_deleted",
        title: "Account deletion processed",
        body: "Your account has been deleted and personal data anonymized.",
      });
    }

    await admin.from("audit_log").insert({
      actor_id: actorId,
      action: mode === "hard" ? "account_hard_delete" : "account_soft_delete",
      entity_type: "user",
      entity_id: targetId,
      reason,
      metadata: { self: !isAdminAction },
    });

    return json({ ok: true, mode, user_id: targetId });
  } catch (e: any) {
    return json({ error: e?.message ?? "Internal error" }, 500);
  }
});
