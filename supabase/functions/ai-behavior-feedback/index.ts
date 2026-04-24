/**
 * ai-behavior-feedback edge function
 * Uses Claude to generate behavior notes based on submission timing.
 * Also triggered automatically when a student submits (via the frontend).
 *
 * POST /functions/v1/ai-behavior-feedback
 * Body: { submission_id: string }
 * Env:  ANTHROPIC_API_KEY
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type SubmissionTiming = "very_early" | "early" | "on_time" | "last_5_minutes" | "late";

function getTimingCategory(submittedAt: Date, dueDate: Date | null): SubmissionTiming {
  if (!dueDate) return "on_time";
  const msBeforeDue = dueDate.getTime() - submittedAt.getTime();
  const minutesBeforeDue = msBeforeDue / 60000;

  if (minutesBeforeDue < 0)           return "late";
  if (minutesBeforeDue <= 5)          return "last_5_minutes";
  if (minutesBeforeDue <= 60)         return "on_time";
  if (minutesBeforeDue <= 60 * 24)    return "early";
  return "very_early";
}

function getScoreChange(timing: SubmissionTiming): number {
  switch (timing) {
    case "very_early":     return  5;
    case "early":          return  3;
    case "on_time":        return  0;
    case "last_5_minutes": return -5;
    case "late":           return -10;
  }
}

function buildPrompt(timing: SubmissionTiming, studentName: string, assignmentTitle: string): string {
  const scenarios: Record<SubmissionTiming, string> = {
    very_early:
      `The student "${studentName}" submitted the assignment "${assignmentTitle}" more than 24 hours before the deadline. ` +
      `Write a short, warm, encouraging note (2-3 sentences) praising their excellent time management and dedication.`,
    early:
      `The student "${studentName}" submitted the assignment "${assignmentTitle}" several hours before the deadline. ` +
      `Write a short, positive note (2-3 sentences) acknowledging their good time management.`,
    on_time:
      `The student "${studentName}" submitted the assignment "${assignmentTitle}" on time. ` +
      `Write a brief, neutral-positive note (1-2 sentences) acknowledging timely submission.`,
    last_5_minutes:
      `The student "${studentName}" submitted the assignment "${assignmentTitle}" in the last 5 minutes before the deadline. ` +
      `Write a constructive note (2-3 sentences) that gently encourages better time management without being harsh. ` +
      `Acknowledge they still submitted on time but suggest planning ahead.`,
    late:
      `The student "${studentName}" submitted the assignment "${assignmentTitle}" after the deadline. ` +
      `Write an encouraging note (2-3 sentences) that is firm but supportive. ` +
      `Acknowledge the late submission, encourage improvement, and remind them punctuality matters. ` +
      `Do NOT be discouraging or harsh.`,
  };

  return `${scenarios[timing]}

Rules:
- Keep it concise (2-3 sentences max)
- Professional academic tone
- Never use the word "unfortunately"
- Always end on an encouraging note
- Write in second person addressing the student directly
- Do not start with "Dear student" or any greeting`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl  = Deno.env.get("SUPABASE_URL")!;
    const serviceKey   = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
    const db = createClient(supabaseUrl, serviceKey);

    // Auth — doctors, admins, deans, AND students can trigger this
    const authHeader = req.headers.get("Authorization")!;
    const { data: { user }, error: authErr } = await db.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authErr || !user) throw new Error("Unauthorized");

    const { submission_id } = await req.json();
    if (!submission_id) throw new Error("submission_id is required");

    // Fetch submission + assignment + student
    const { data: sub, error: subErr } = await db
      .from("submissions")
      .select(`
        *,
        assignments (title, due_date, course_id),
        students (full_name)
      `)
      .eq("id", submission_id)
      .single();

    if (subErr || !sub) throw new Error("Submission not found");

    const assignment   = (sub as any).assignments;
    const student      = (sub as any).students;
    const studentName  = student?.full_name ?? "Student";
    const submittedAt  = new Date(sub.submitted_at);
    const dueDate      = assignment?.due_date ? new Date(assignment.due_date) : null;
    const timing       = getTimingCategory(submittedAt, dueDate);
    const scoreChange  = getScoreChange(timing);

    // Generate note — use Claude if available, else use built-in template
    let behaviorNote: string;

    if (anthropicKey) {
      const prompt = buildPrompt(timing, studentName, assignment?.title ?? "the assignment");

      const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": anthropicKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001", // Fast + cheap for short notes
          max_tokens: 200,
          messages: [{ role: "user", content: prompt }],
        }),
      });

      if (!claudeRes.ok) throw new Error(`Claude API error: ${claudeRes.status}`);
      const claudeData = await claudeRes.json();
      behaviorNote = claudeData.content?.[0]?.text?.trim() ?? "";
    } else {
      // Built-in fallback notes
      const fallbacks: Record<SubmissionTiming, string> = {
        very_early:
          "Excellent time management! Submitting this early shows great dedication and planning. Keep up this outstanding work habit.",
        early:
          "Great job submitting ahead of the deadline! Your time management is commendable. Keep up the good work.",
        on_time:
          "Submitted on time. Good job staying on track with your deadlines.",
        last_5_minutes:
          "You submitted just before the deadline. While you made it on time, try to plan ahead and give yourself more time for future assignments — it will reduce stress and improve quality.",
        late:
          "This assignment was submitted after the deadline. Punctuality is an important skill — try to start your work earlier next time. You still have the opportunity to improve, and I believe you can do it.",
      };
      behaviorNote = fallbacks[timing];
    }

    // Update submission with behavior note
    const { error: updateErr } = await db
      .from("submissions")
      .update({ behavior_note: behaviorNote })
      .eq("id", submission_id);

    if (updateErr) throw updateErr;

    // Apply behavior score change to behavior_scores table if it exists
    if (scoreChange !== 0 && sub.student_id) {
      try {
        const { data: scoreRow } = await db
          .from("behavior_scores")
          .select("score")
          .eq("student_id", sub.student_id)
          .single();

        if (scoreRow) {
          const newScore = Math.max(0, Math.min(100, (scoreRow.score ?? 100) + scoreChange));
          await db
            .from("behavior_scores")
            .update({ score: newScore })
            .eq("student_id", sub.student_id);
        }
      } catch (_) {
        // behavior_scores table may not exist — skip silently
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        timing,
        score_change: scoreChange,
        behavior_note: behaviorNote,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("[ai-behavior-feedback]", err.message);
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
