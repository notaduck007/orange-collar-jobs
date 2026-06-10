// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const TITLE_MARK = "===TITLE===";
const DESC_MARK = "===DESCRIPTION===";
const REQ_MARK = "===REQUIREMENTS===";

const SYSTEM = `You translate warehouse and logistics job postings from English into Latin-American Spanish for hourly workers in the United States.

Use warehouse-correct, professional vocabulary:
- forklift → montacargas
- shift → turno (1st = primer turno, 2nd = segundo turno, 3rd = tercer turno)
- warehouse → almacén
- shipping & receiving → envío y recibo
- order selector → selector de pedidos
- picker / packer → seleccionador / empacador
- warehouse associate → asociado de almacén
- full-time → tiempo completo; part-time → medio tiempo
- overtime → horas extra; weekly pay → pago semanal

Preserve numbers, currency ($/hr stays $/hora), units (lbs), brand names, certifications (OSHA, RF, etc.).
Do not invent benefits, pay, certifications, or details. Match the source's tone, paragraph breaks, and bullet structure exactly.`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "Missing LOVABLE_API_KEY" }), {
        status: 500,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const { jobId, language } = await req.json().catch(() => ({}));
    const target = language === "es" ? "es" : "es"; // only ES supported in this pass

    if (!jobId || typeof jobId !== "string") {
      return new Response(JSON.stringify({ error: "missing jobId" }), {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);

    // Return cached translation if present
    const { data: cached } = await admin
      .from("job_translations")
      .select("title, description, requirements")
      .eq("job_id", jobId)
      .eq("language", target)
      .maybeSingle();

    if (cached) {
      return new Response(JSON.stringify({ cached: true, ...cached }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const { data: job, error: jobErr } = await admin
      .from("jobs")
      .select("title, description, requirements, status")
      .eq("id", jobId)
      .maybeSingle();
    if (jobErr || !job) {
      return new Response(JSON.stringify({ error: "job_not_found" }), {
        status: 404,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const user =
      `Translate this job posting into Latin-American Spanish. ` +
      `Return three sections, each starting with its marker on its own line:\n\n` +
      `${TITLE_MARK}\n<translated title>\n` +
      `${DESC_MARK}\n<translated description, preserving paragraphs>\n` +
      `${REQ_MARK}\n<translated requirements, preserving bullet structure>\n\n` +
      `--- SOURCE ---\n` +
      `TITLE: ${job.title ?? ""}\n\n` +
      `DESCRIPTION:\n${job.description ?? ""}\n\n` +
      `REQUIREMENTS:\n${job.requirements ?? ""}`;

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": apiKey,
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: user },
        ],
      }),
    });

    if (!resp.ok) {
      const text = await resp.text();
      const status = resp.status === 429 || resp.status === 402 ? resp.status : 500;
      return new Response(JSON.stringify({ error: text || "AI gateway error" }), {
        status,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const json = await resp.json();
    const content: string = json.choices?.[0]?.message?.content ?? "";

    const titleIdx = content.indexOf(TITLE_MARK);
    const descIdx = content.indexOf(DESC_MARK);
    const reqIdx = content.indexOf(REQ_MARK);

    const slice = (start: number, end: number) =>
      start < 0 ? "" : content.slice(start, end < 0 ? undefined : end).split("\n").slice(1).join("\n").trim();

    const tTitle = slice(titleIdx, descIdx);
    const tDesc = slice(descIdx, reqIdx);
    const tReq = slice(reqIdx, -1);

    const payload = {
      title: tTitle || job.title,
      description: tDesc || job.description,
      requirements: tReq || job.requirements,
    };

    // Cache it
    await admin
      .from("job_translations")
      .upsert(
        { job_id: jobId, language: target, ...payload },
        { onConflict: "job_id,language" },
      );

    return new Response(JSON.stringify({ cached: false, ...payload }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message ?? String(e) }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
