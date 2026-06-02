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

    // F. Server-side enforcement: require the caller to actually be an admin
    // (don't rely on the client-side route guard). For non-role actions we keep
    // the existing 'users' capability check so finance/support roles still work.
    const { data: isAdmin } = await admin.rpc("has_role", {
      _user_id: actorId,
      _role: "admin",
    });
    const { data: hasCap } = await admin.rpc("has_permission", {
      _user_id: actorId,
      _permission_key: "users.view_all",
    });
    if (!isAdmin && !hasCap) return json({ error: "Forbidden" }, 403);


    const body = await req.json();
    const action: string = body.action;
    const targetId: string | undefined = body.user_id;
    if (!action) return json({ error: "missing action" }, 400);

    // --- Read-only meta lookup ---
    if (action === "get_meta") {
      if (!targetId) return json({ error: "user_id required" }, 400);
      const { data: u, error } = await admin.auth.admin.getUserById(targetId);
      if (error) return json({ error: error.message }, 400);
      return json({
        email: u.user?.email ?? null,
        email_confirmed_at: u.user?.email_confirmed_at ?? null,
        last_sign_in_at: u.user?.last_sign_in_at ?? null,
        banned_until: (u.user as any)?.banned_until ?? null,
        created_at: u.user?.created_at ?? null,
      });
    }

    if (!targetId) return json({ error: "user_id required" }, 400);
    const { data: tgt } = await admin.auth.admin.getUserById(targetId);
    const targetEmail = tgt?.user?.email ?? null;

    let auditAction = action;
    let metadata: Record<string, unknown> = {};

    switch (action) {
      case "suspend": {
        const { error } = await admin.auth.admin.updateUserById(targetId, {
          ban_duration: "876000h", // ~100 years
        } as any);
        if (error) return json({ error: error.message }, 400);
        await admin.from("profiles").update({ active: false }).eq("id", targetId);
        metadata = { reason: body.reason ?? null };
        break;
      }
      case "reactivate": {
        const { error } = await admin.auth.admin.updateUserById(targetId, {
          ban_duration: "none",
        } as any);
        if (error) return json({ error: error.message }, 400);
        await admin.from("profiles").update({ active: true }).eq("id", targetId);
        break;
      }
      case "password_reset": {
        if (!targetEmail) return json({ error: "user has no email" }, 400);
        const { error } = await admin.auth.resetPasswordForEmail(targetEmail);
        if (error) return json({ error: error.message }, 400);
        metadata = { email: targetEmail };
        break;
      }
      case "resend_verification": {
        if (!targetEmail) return json({ error: "user has no email" }, 400);
        const { error } = await admin.auth.resend({ type: "signup", email: targetEmail } as any);
        if (error) return json({ error: error.message }, 400);
        metadata = { email: targetEmail };
        break;
      }
      case "set_role": {
        // Replace ALL roles with the single chosen role (legacy single-role UI).
        const role: string = body.role;
        if (!["job_seeker", "employer", "admin"].includes(role)) {
          return json({ error: "invalid role" }, 400);
        }
        if (!isAdmin) return json({ error: "Only admins can change roles" }, 403);
        if (role !== "admin") {
          // Block removing the last admin.
          const { data: hadAdmin } = await admin.from("user_roles").select("role").eq("user_id", targetId).eq("role", "admin").maybeSingle();
          if (hadAdmin) {
            const { count } = await admin.from("user_roles").select("user_id", { count: "exact", head: true }).eq("role", "admin");
            if ((count ?? 0) <= 1) return json({ error: "Cannot remove the last admin" }, 400);
          }
        }
        await admin.from("user_roles").delete().eq("user_id", targetId);
        const { error } = await admin.from("user_roles").insert({ user_id: targetId, role });
        if (error) return json({ error: error.message }, 400);
        metadata = { role };
        auditAction = "set_role";
        break;
      }
      case "grant_role": {
        const role: string = body.role;
        if (!["job_seeker", "employer", "admin"].includes(role)) return json({ error: "invalid role" }, 400);
        if (!isAdmin) return json({ error: "Only admins can change roles" }, 403);
        const { error } = await admin.from("user_roles").upsert({ user_id: targetId, role }, { onConflict: "user_id,role" });
        if (error) return json({ error: error.message }, 400);
        metadata = { role };
        auditAction = `grant_role.${role}`;
        break;
      }
      case "revoke_role": {
        const role: string = body.role;
        if (!["job_seeker", "employer", "admin"].includes(role)) return json({ error: "invalid role" }, 400);
        if (!isAdmin) return json({ error: "Only admins can change roles" }, 403);
        if (role === "admin") {
          const { count } = await admin.from("user_roles").select("user_id", { count: "exact", head: true }).eq("role", "admin");
          if ((count ?? 0) <= 1) return json({ error: "Cannot remove the last admin" }, 400);
        }
        const { error } = await admin.from("user_roles").delete().eq("user_id", targetId).eq("role", role);
        if (error) return json({ error: error.message }, 400);
        metadata = { role };
        auditAction = `revoke_role.${role}`;
        break;
      }
      default:
        return json({ error: "unknown action" }, 400);
    }


    await admin.from("audit_log").insert({
      actor_id: actorId,
      action: `user.${auditAction}`,
      entity_type: "user",
      entity_id: targetId,
      reason: body.reason ?? null,
      metadata,
    });

    return json({ ok: true });
  } catch (e: any) {
    return json({ error: e?.message ?? "error" }, 500);
  }
});
