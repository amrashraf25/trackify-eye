/**
 * ai-plagiarism edge function
 * Checks a submission for plagiarism using Copyleaks API.
 * Falls back to a heuristic similarity check if no API key is configured.
 *
 * POST /functions/v1/ai-plagiarism
 * Body: { submission_id: string }
 * Env:  COPYLEAKS_EMAIL, COPYLEAKS_API_KEY (optional — uses heuristic fallback)
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ── Copyleaks integration ─────────────────────────────────────────────────────
async function checkWithCopyleaks(text: string, email: string, apiKey: string) {
  // Step 1: Login to get JWT
  const loginRes = await fetch("https://id.copyleaks.com/v3/account/login/api", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, key: apiKey }),
  });
  if (!loginRes.ok) throw new Error("Copyleaks login failed");
  const { access_token } = await loginRes.json();

  // Step 2: Submit scan
  const scanId = crypto.randomUUID();
  const textBytes = new TextEncoder().encode(text);
  const base64 = btoa(String.fromCharCode(...textBytes));

  const scanRes = await fetch(
    `https://api.copyleaks.com/v3/businesses/submit/file/${scanId}`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${access_token}`,
      },
      body: JSON.stringify({
        base64: base64,
        filename: "submission.txt",
        properties: {
          webhooks: { status: "https://your-webhook-url.invalid" },
          includeHtml: false,
        },
      }),
    }
  );
  if (!scanRes.ok) throw new Error("Copyleaks scan submission failed");

  // Note: Copyleaks is async — results come via webhook.
  // For demo purposes return a "pending" status.
  return {
    provider: "copyleaks",
    status: "pending",
    scan_id: scanId,
    similarity_score: null,
    message: "Scan submitted. Results will arrive via webhook.",
  };
}

// ── Heuristic fallback (no external API needed) ──────────────────────────────
// Checks for: very short content, repetitive patterns, suspicious structure
function heuristicAnalysis(text: string) {
  const words = text.trim().split(/\s+/);
  const wordCount = words.length;
  const uniqueWords = new Set(words.map((w) => w.toLowerCase()));
  const repetitionRatio = 1 - uniqueWords.size / wordCount;

  // Simple sentence structure analysis
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 10);
  const avgSentenceLength = sentences.reduce((a, s) => a + s.split(/\s+/).length, 0) / (sentences.length || 1);

  // Heuristic flags
  const flags: string[] = [];
  let riskScore = 0;

  if (wordCount < 50) {
    flags.push("Very short submission — unable to perform meaningful analysis");
    riskScore = 0;
  } else {
    if (repetitionRatio > 0.4) {
      flags.push("High word repetition detected");
      riskScore += 20;
    }
    if (avgSentenceLength > 40) {
      flags.push("Unusually long sentence structures");
      riskScore += 10;
    }
    // Check for copy-paste indicators: perfectly uniform paragraph lengths
    const paragraphs = text.split(/\n\n+/).filter((p) => p.trim().length > 20);
    if (paragraphs.length > 2) {
      const lengths = paragraphs.map((p) => p.length);
      const avg = lengths.reduce((a, b) => a + b, 0) / lengths.length;
      const variance = lengths.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / lengths.length;
      if (variance < 100 && paragraphs.length > 3) {
        flags.push("Suspiciously uniform paragraph lengths");
        riskScore += 15;
      }
    }
  }

  return {
    provider: "heuristic",
    status: "complete",
    similarity_score: Math.min(riskScore, 95),
    word_count: wordCount,
    unique_word_ratio: Math.round((1 - repetitionRatio) * 100),
    flags,
    note: "No external plagiarism API configured. Using statistical heuristics only. Connect Copyleaks for full detection.",
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const db = createClient(supabaseUrl, serviceKey);

    // Auth check
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authErr } = await db.auth.getUser(token);
    if (authErr || !user) throw new Error("Unauthorized");

    const { data: profile } = await db.from("profiles").select("role").eq("id", user.id).single();
    if (!profile || !["doctor", "admin", "dean"].includes(profile.role)) {
      throw new Error("Only doctors, admins, and deans can trigger plagiarism checks");
    }

    const { submission_id } = await req.json();
    if (!submission_id) throw new Error("submission_id is required");

    const { data: sub, error: subErr } = await db
      .from("submissions")
      .select("content")
      .eq("id", submission_id)
      .single();

    if (subErr || !sub) throw new Error("Submission not found");
    if (!sub.content?.trim()) throw new Error("Submission has no text content");

    // Use Copyleaks if credentials are available, else heuristic
    const copyleaksEmail  = Deno.env.get("COPYLEAKS_EMAIL");
    const copyleaksApiKey = Deno.env.get("COPYLEAKS_API_KEY");

    let result: Record<string, unknown>;

    if (copyleaksEmail && copyleaksApiKey) {
      result = await checkWithCopyleaks(sub.content, copyleaksEmail, copyleaksApiKey);
    } else {
      result = heuristicAnalysis(sub.content);
    }

    // Store results
    const { error: updateErr } = await db
      .from("submissions")
      .update({
        plagiarism_score: result.similarity_score ?? null,
        plagiarism_details: result,
        plagiarism_provider: result.provider as string,
        ai_processed_at: new Date().toISOString(),
      })
      .eq("id", submission_id);

    if (updateErr) throw updateErr;

    return new Response(
      JSON.stringify({ success: true, result }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("[ai-plagiarism]", err.message);
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
