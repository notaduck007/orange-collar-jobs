// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization");
    if (!authHeader)
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...cors, "Content-Type": "application/json" },
      });

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
    const actorId = userData.user.id;
    const actorEmail = userData.user.email;

    const admin = createClient(supabaseUrl, serviceKey);

    const body = await req.json().catch(() => ({}));
    let targetId: string = actorId;
    if (body.user_id && body.user_id !== actorId) {
      const { data: hasCap } = await admin.rpc("has_permission", {
        _user_id: actorId,
        _permission_key: "users.view_all",
      });
      if (!hasCap) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }
      targetId = body.user_id;
    }

    const [
      profile,
      seeker,
      applications,
      savedJobs,
      alerts,
      reviews,
      workHistory,
      notifications,
      companies,
    ] = await Promise.all([
      admin.from("profiles").select("*").eq("id", targetId).maybeSingle(),
      admin.from("seeker_profiles").select("*").eq("user_id", targetId).maybeSingle(),
      admin.from("applications").select("*").eq("applicant_id", targetId),
      admin.from("saved_jobs").select("*").eq("user_id", targetId),
      admin.from("job_alerts").select("*").eq("applicant_id", targetId),
      admin.from("reviews").select("*").eq("author_id", targetId),
      admin.from("work_history").select("*").eq("user_id", targetId),
      admin.from("notifications").select("*").eq("user_id", targetId).limit(500),
      admin.from("companies").select("*").eq("owner_id", targetId),
    ]);

    const { data: auth } = await admin.auth.admin.getUserById(targetId);

    const dump = {
      exported_at: new Date().toISOString(),
      requested_by: { id: actorId, email: actorEmail },
      user: {
        id: targetId,
        email: auth?.user?.email ?? null,
        created_at: auth?.user?.created_at ?? null,
        last_sign_in_at: auth?.user?.last_sign_in_at ?? null,
      },
      profile: profile.data,
      seeker_profile: seeker.data,
      applications: applications.data ?? [],
      saved_jobs: savedJobs.data ?? [],
      job_alerts: alerts.data ?? [],
      reviews: reviews.data ?? [],
      work_history: workHistory.data ?? [],
      notifications: notifications.data ?? [],
      owned_companies: companies.data ?? [],
    };

    // Audit
    await admin.from("audit_log").insert({
      actor_id: actorId,
      action: "data_export",
      entity_type: "user",
      entity_id: targetId,
      metadata: { self: targetId === actorId },
    });

    const filename = `user-data-${targetId}-${new Date().toISOString().slice(0, 10)}.json`;
    return new Response(JSON.stringify(dump, null, 2), {
      status: 200,
      headers: {
        ...cors,
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (e: unknown) {
    return new Response(JSON.stringify({ error: e?.message ?? "Internal error" }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
