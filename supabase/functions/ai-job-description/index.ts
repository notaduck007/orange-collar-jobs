// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SECTION_MARKER = "===DESCRIPTION===";
const REQ_MARKER = "===REQUIREMENTS===";

function buildPrompt(p: any) {
  const facts = [
    p.title && `Job title: ${p.title}`,
    p.category && `Category: ${p.category}`,
    p.shift && `Shift: ${p.shift}`,
    (p.pay_min || p.pay_max) &&
      `Pay: ${p.pay_min ?? "?"}–${p.pay_max ?? "?"} ${p.pay_unit ?? "hour"}`,
    p.location && `Location: ${p.location}`,
  ]
    .filter(Boolean)
    .join("\n");

  const system =
    "You write clear, honest, warehouse-industry job postings for hourly workers. " +
    "Plain language, short paragraphs, no corporate fluff, no emojis, no hype. " +
    "Tone: respectful, direct, practical. Never invent benefits, pay, or certifications " +
    "that weren't provided. US English. 8th-grade reading level.";

  const formatRule =
    `Return TWO sections separated by these exact markers on their own lines:\n` +
    `${SECTION_MARKER}\n<job description: 2–4 short paragraphs covering the role, ` +
    `day-to-day tasks, equipment, team, and schedule>\n` +
    `${REQ_MARKER}\n<bulleted requirements list, one per line starting with "- ", ` +
    `covering experience, certifications, and physical requirements>`;

  if (p.mode === "improve") {
    return {
      system,
      user:
        `Improve and tighten the employer's existing draft below. Keep their facts, ` +
        `fix grammar, remove fluff, make it scannable. Do not invent new benefits or pay.\n\n` +
        `Known facts:\n${facts}\n\n` +
        `Existing description:\n${p.draft_description ?? ""}\n\n` +
        `Existing requirements:\n${p.draft_requirements ?? ""}\n\n` +
        formatRule,
    };
  }

  return {
    system,
    user:
      `Write a complete warehouse-appropriate job posting using only the facts below.\n\n` +
      `${facts}\n\n` +
      formatRule,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const payload = await req.json().catch(() => ({}));
    const { system, user } = buildPrompt(payload);

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "Missing LOVABLE_API_KEY" }), {
        status: 500,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const upstream = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": apiKey,
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        stream: true,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });

    if (!upstream.ok || !upstream.body) {
      const text = await upstream.text();
      const status = upstream.status === 429 || upstream.status === 402 ? upstream.status : 500;
      return new Response(JSON.stringify({ error: text || "AI gateway error" }), {
        status,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // Pass through as a plain text stream of token deltas.
    const reader = upstream.body.getReader();
    const decoder = new TextDecoder();
    const encoder = new TextEncoder();
    let buf = "";

    const stream = new ReadableStream({
      async pull(controller) {
        const { done, value } = await reader.read();
        if (done) {
          controller.close();
          return;
        }
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;
          const data = trimmed.slice(5).trim();
          if (!data || data === "[DONE]") continue;
          try {
            const json = JSON.parse(data);
            const delta = json.choices?.[0]?.delta?.content ?? "";
            if (delta) controller.enqueue(encoder.encode(delta));
          } catch {
            /* skip */
          }
        }
      },
      cancel() {
        reader.cancel();
      },
    });

    return new Response(stream, {
      headers: {
        ...cors,
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (e: unknown) {
    return new Response(JSON.stringify({ error: e?.message ?? String(e) }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
