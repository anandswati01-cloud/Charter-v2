// supabase/functions/claude-chart/index.ts
// SkyVayu — Supabase Edge Function: Graphify AI Chart Intelligence
// Proxies requests to the Anthropic API so the key stays server-side.
// Deploy: supabase functions deploy claude-chart
// Secret:  supabase secrets set ANTHROPIC_API_KEY=sk-ant-...

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") ?? "";
const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-3-haiku-20240307"; // fast + cheap for chart analysis

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `You are a data visualisation assistant for SkyVayu, a private charter flight platform.
You receive arrays of booking/query data and return chart configurations.
Always respond with valid JSON in this exact shape:
{
  "summary": "One sentence describing the key insight",
  "insights": ["Insight 1", "Insight 2", "Insight 3"],
  "chartConfig": {
    "type": "bar" | "line" | "pie" | "doughnut" | "scatter",
    "data": {
      "labels": [...],
      "datasets": [{
        "label": "...",
        "data": [...],
        "backgroundColor": [...],
        "borderColor": [...],
        "borderWidth": 1
      }]
    },
    "options": {
      "responsive": true,
      "plugins": {
        "legend": { "position": "top" },
        "title": { "display": true, "text": "..." }
      }
    }
  }
}
Use SkyVayu brand colours: gold #fbbf24, cyan #17B0D6, green #22c55e, navy #0c1324.
If the data is insufficient, return a chartConfig of null and explain in summary.`;

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { data, question, chartType } = await req.json();

    if (!ANTHROPIC_API_KEY) {
      return new Response(
        JSON.stringify({ error: "ANTHROPIC_API_KEY not configured on server" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!data || !Array.isArray(data)) {
      return new Response(
        JSON.stringify({ error: "data must be a non-empty array" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Truncate data to avoid huge prompts (max 200 rows)
    const truncated = data.slice(0, 200);
    const userMessage = `Data (JSON array, ${truncated.length} rows):
${JSON.stringify(truncated, null, 2)}

Question: ${question || "Summarise this data with a chart"}
Preferred chart type: ${chartType || "auto — choose the most appropriate"}`;

    const anthropicRes = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 2048,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userMessage }],
      }),
    });

    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text();
      console.error("Anthropic API error:", anthropicRes.status, errText);
      return new Response(
        JSON.stringify({ error: "Anthropic API error", status: anthropicRes.status }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const anthropicData = await anthropicRes.json();
    const rawText = anthropicData?.content?.[0]?.text ?? "";

    // Parse JSON from Claude's response
    let parsed;
    try {
      // Claude sometimes wraps JSON in markdown code fences — strip them
      const cleaned = rawText.replace(/^```json\n?|^```\n?|```$/gm, "").trim();
      parsed = JSON.parse(cleaned);
    } catch (_) {
      // Return raw text if JSON parse fails
      parsed = { summary: rawText, chartConfig: null, insights: [] };
    }

    return new Response(JSON.stringify(parsed), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("claude-chart error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
