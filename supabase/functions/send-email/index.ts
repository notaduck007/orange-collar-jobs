// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const { to, subject, body } = await req.json();
    if (!to || !subject) {
      return new Response(JSON.stringify({ error: "missing to/subject" }), {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }
    // Stub: integrate a transactional provider here later. For now, log so the
    // moderation flow has a working send-email endpoint to invoke.
    console.log("[send-email]", { to, subject, body });
    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message ?? "error" }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
