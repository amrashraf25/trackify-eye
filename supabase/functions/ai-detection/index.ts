/**
 * ai-detection edge function
 * Detects whether a submission was AI-generated using GPTZero API.
 * Falls back to Claude-based heuristic if no GPTZero key is set.
 *
 * POST /functions/v1/ai-detection
 * Body: { submission_id: string }
 * Env:  GPTZERO_API_KEY, ANTHROPIC_API_KEY (fallback)
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ── GPTZero integration ───────────────────────────────────────────────────────
async function checkWithGPTZero(text: string, apiKey: string) {
  const res = await fetch("https://api.gptzero.me/v2/predict/text", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
    },
    body: JSON.stringify({ document: text }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`GPTZero error ${res.status}: ${errText}`);
  }

  const data = await res.json();
  const doc = data.documents?.[0] ?? {};

  const aiProbability   = Math.round((doc.average_generated_prob ?? 0) * 100);
  const humanProbability = 100 - aiProbability;
  const classification  = doc.completely_generated_prob > 0.7
    ? "AI-generated"
    : doc.completely_generated_prob > 0.4
    ? "Mixed (AI-assisted)"
    : "Human-written";

  return {
    provider: "gptzero",
    ai_probability: aiProbability,
    human_probability: humanProbability,
    classification,
    completely_generated_prob: Math.round((doc.completely_generated_prob ?? 0) * 100),
    sentences: (doc.sentences ?? []).slice(0, 10).map((s: any) => ({
      text: s.sentence,
      generated_prob: Math.round((s.generated_prob ?? 0) * 100),
    })),
    perplexity: doc.average_perplexity,
    burstiness: doc.overall_burstiness,
  };
}

// ── Claude-based heuristic fallback ──────────────────────────────────────────
async function checkWithClaude(text: string, apiKey: string) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 512,
      system: "You are an expert at detecting AI-generated academic text. Respond with valid JSON only.",
      messages: [{
        role: "user",
        content: `Analyze this text and determine if it is AI-generated or human-written.
Look for: unnaturally perfect grammar, lack of personal voice, overly structured paragraphs,
formulaic transitions, absence of specific examples, and AI-typical phrasing patterns.

TEXT:
"""
${text.slice(0, 2000)}
"""

Respond with exactly this JSON:
{
  "ai_probability": <0-100 integer>,
  "human_probability": <0-100 integer>,
  "classification": <"AI-generated" | "Mixed (AI-assisted)" | "Human-written">,
  "indicators": [<string>, ...],
  "reasoning": <string, 1-2 sentences>
}`,
      }],
    }),
  });

  if (!res.ok) throw new Error(`Claude detection error: ${res.status}`);

  const data = await res.json();
  const raw = data.content?.[0]?.text ?? "";
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("No valid JSON from Claude detection");

  const result = JSON.parse(jsonMatch[0]);
  return { provider: "claude-heuristic", ...result };
}

// ── Statistical fallback (no API keys needed) ─────────────────────────────────
function statisticalAnalysis(text: string) {
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 5);
  if (sentences.length < 3) {
    return {
      provider: "statistical",
      ai_probability: 0,
      human_probability: 100,
      classification: "Insufficient text",
      note: "Text too short for meaningful analysis",
    };
  }

  // Metrics that correlate with AI text
  const words = text.split(/\s+/);
  const uniqueWords = new Set(words.map((w) => w.toLowerCase().replace(/[^a-z]/g, "")));
  const typeTokenRatio = uniqueWords.size / words.length;

  // AI text tends to have higher TTR and uniform sentence length
  const sentenceLengths = sentences.map((s) => s.split(/\s+/).length);
  const avgLen = sentenceLengths.reduce((a, b) => a + b, 0) / sentenceLengths.length;
  const variance = sentenceLengths.reduce((a, b) => a + Math.pow(b - avgLen, 2), 0) / sentenceLengths.length;
  const burstiness = Math.sqrt(variance) / avgLen; // Low burstiness = AI-like

  // Common AI patterns
  const aiPhrases = [
    "in conclusion", "furthermore", "it is worth noting", "in summary",
    "it is important to", "plays a crucial role", "in today's world",
    "overall", "on the other hand", "as a result", "this essay will",
    "to sum up", "in addition to", "when it comes to",
  ];
  const lowerText = text.toLowerCase();
  const phraseMatches = aiPhrases.filter((p) => lowerText.includes(p)).length;
  const phraseDensity = phraseMatches / sentences.length;

  let aiScore = 0;
  if (burstiness < 0.3) aiScore += 30;
  if (typeTokenRatio > 0.65) aiScore += 20;
  if (phraseDensity > 0.3) aiScore += 25;
  if (avgLen > 18 && avgLen < 25) aiScore += 15; // AI prefers 18-25 word sentences

  aiScore = Math.min(aiScore, 90);

  return {
    provider: "statistical",
    ai_probability: aiScore,
    human_probability: 100 - aiScore,
    classification: aiScore >= 60 ? "AI-generated" : aiScore >= 35 ? "Mixed (AI-assisted)" : "Human-written",
    metrics: {
      sentence_count: sentences.length,
      burstiness: Math.round(burstiness * 100) / 100,
      type_token_ratio: Math.round(typeTokenRatio * 100) / 100,
      ai_phrase_density: Math.round(phraseDensity * 100) / 100,
    },
    note: "No GPTZero API key configured. Using statistical analysis only.",
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl  = Deno.env.get("SUPABASE_URL")!;
    const serviceKey   = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const gptzeroKey   = Deno.env.get("GPTZERO_API_KEY");
    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
    const db = createClient(supabaseUrl, serviceKey);

    // Auth
    const authHeader = req.headers.get("Authorization")!;
    const { data: { user }, error: authErr } = await db.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authErr || !user) throw new Error("Unauthorized");

    const { data: profile } = await db.from("profiles").select("role").eq("id", user.id).single();
    if (!profile || !["doctor", "admin", "dean"].includes(profile.role)) {
      throw new Error("Only doctors, admins, and deans can trigger AI detection");
    }

    const { submission_id } = await req.json();
    if (!submission_id) throw new Error("submission_id is required");

    const { data: sub } = await db
      .from("submissions")
      .select("content")
      .eq("id", submission_id)
      .single();

    if (!sub?.content?.trim()) throw new Error("Submission has no text content");

    // Pick the best available method
    let result: Record<string, unknown>;
    if (gptzeroKey) {
      result = await checkWithGPTZero(sub.content, gptzeroKey);
    } else if (anthropicKey) {
      result = await checkWithClaude(sub.content, anthropicKey);
    } else {
      result = statisticalAnalysis(sub.content);
    }

    const label = result.classification as string;

    await db.from("submissions").update({
      ai_detection_score:    result.ai_probability as number,
      ai_detection_label:    label,
      ai_detection_details:  result,
      ai_detection_provider: result.provider as string,
      ai_processed_at:       new Date().toISOString(),
    }).eq("id", submission_id);

    return new Response(
      JSON.stringify({ success: true, result }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("[ai-detection]", err.message);
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
