/**
 * ai-grade edge function
 * Calls Claude (Anthropic) to suggest a grade and generate detailed feedback.
 * The doctor always has final control — this is advisory only.
 *
 * POST /functions/v1/ai-grade
 * Body: { submission_id: string }
 * Env:  ANTHROPIC_API_KEY
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ANTHROPIC_API = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-opus-4-5-20251101"; // Highest quality for grading

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // ── Auth ────────────────────────────────────────────────────────────────
    const supabaseUrl  = Deno.env.get("SUPABASE_URL")!;
    const serviceKey   = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");

    if (!anthropicKey) throw new Error("ANTHROPIC_API_KEY is not configured");

    const db = createClient(supabaseUrl, serviceKey);

    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authErr } = await db.auth.getUser(token);
    if (authErr || !user) throw new Error("Unauthorized");

    const { data: profile } = await db.from("profiles").select("role").eq("id", user.id).single();
    if (!profile || !["doctor", "admin", "dean"].includes(profile.role)) {
      throw new Error("Only doctors, admins, and deans can trigger AI grading");
    }

    // ── Fetch submission + assignment ────────────────────────────────────────
    const { submission_id } = await req.json();
    if (!submission_id) throw new Error("submission_id is required");

    const { data: sub, error: subErr } = await db
      .from("submissions")
      .select(`
        *,
        assignments (title, description, rubric, max_score)
      `)
      .eq("id", submission_id)
      .single();

    if (subErr || !sub) throw new Error("Submission not found");
    if (!sub.content?.trim()) throw new Error("Submission has no text content to grade");

    const assignment = (sub as any).assignments;

    // ── Build Claude prompt ──────────────────────────────────────────────────
    const systemPrompt = `You are an expert academic grader assisting a university professor.
Your role is ADVISORY only — you suggest grades and provide feedback, but the professor makes the final decision.
Be fair, constructive, and specific. Never be harsh or discouraging.
Always respond with valid JSON matching the schema exactly.`;

    const userPrompt = `Grade the following student submission.

ASSIGNMENT: ${assignment.title}
DESCRIPTION: ${assignment.description || "No description provided."}
RUBRIC: ${assignment.rubric || "No rubric provided — grade holistically on quality, completeness, and understanding."}
MAX SCORE: ${assignment.max_score}

STUDENT SUBMISSION:
"""
${sub.content}
"""

Respond with this JSON schema exactly:
{
  "suggested_grade": <integer 0 to ${assignment.max_score}>,
  "percentage": <number 0 to 100>,
  "grade_label": <"Excellent" | "Good" | "Satisfactory" | "Needs Improvement" | "Unsatisfactory">,
  "strengths": [<string>, ...],
  "weaknesses": [<string>, ...],
  "detailed_feedback": <string, 2-4 paragraphs of constructive feedback>,
  "improvement_suggestions": [<string>, ...],
  "confidence": <"high" | "medium" | "low">
}`;

    // ── Call Claude API ──────────────────────────────────────────────────────
    const claudeRes = await fetch(ANTHROPIC_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });

    if (!claudeRes.ok) {
      const errText = await claudeRes.text();
      throw new Error(`Claude API error ${claudeRes.status}: ${errText}`);
    }

    const claudeData = await claudeRes.json();
    const rawContent = claudeData.content?.[0]?.text ?? "";

    // Extract JSON from response (Claude sometimes wraps in markdown)
    const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("Claude returned no valid JSON");
    const result = JSON.parse(jsonMatch[0]);

    // ── Store results ────────────────────────────────────────────────────────
    const { error: updateErr } = await db
      .from("submissions")
      .update({
        ai_grade: result.suggested_grade,
        ai_feedback: result.detailed_feedback,
        ai_grade_model: MODEL,
        ai_processed_at: new Date().toISOString(),
      })
      .eq("id", submission_id);

    if (updateErr) throw updateErr;

    return new Response(
      JSON.stringify({ success: true, result }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("[ai-grade]", err.message);
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
