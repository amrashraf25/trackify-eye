import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Sparkles, ShieldCheck, Bot, Brain,
  CheckCircle2, XCircle, AlertTriangle, Loader2,
  ChevronDown, ChevronUp, TrendingUp, TrendingDown,
  ClipboardCheck, Star,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface Submission {
  id: string;
  content: string | null;
  ai_grade: number | null;
  ai_feedback: string | null;
  plagiarism_score: number | null;
  plagiarism_details: any;
  ai_detection_score: number | null;
  ai_detection_label: string | null;
  ai_detection_details: any;
  behavior_note: string | null;
  ai_processed_at: string | null;
}

interface AIPanelProps {
  submission: Submission;
  maxScore: number;
  onGradeAccepted: (grade: number, feedback: string) => void;
  onRefresh: () => void;
}

type LoadingKey = "grade" | "plagiarism" | "detection" | "behavior";

// ── Helpers ──────────────────────────────────────────────────────────────────
function scoreColor(score: number) {
  if (score >= 80) return "#22c55e";
  if (score >= 60) return "#f59e0b";
  return "#ef4444";
}

function plagiarismColor(score: number) {
  if (score <= 15) return "#22c55e";
  if (score <= 35) return "#f59e0b";
  return "#ef4444";
}

function aiDetectionColor(score: number) {
  if (score <= 20) return "#22c55e";
  if (score <= 50) return "#f59e0b";
  return "#ef4444";
}

async function callEdgeFunction(name: string, submissionId: string, token: string) {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
    ?? `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co`;

  const res = await fetch(`${supabaseUrl}/functions/v1/${name}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ submission_id: submissionId }),
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error ?? "Unknown error");
  return data.result ?? data;
}

// ── Sub-components ────────────────────────────────────────────────────────────
function ResultCard({
  title, icon, color, children, defaultOpen = true,
}: {
  title: string; icon: React.ReactNode; color: string;
  children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-xl overflow-hidden border border-white/[0.07]"
      style={{ background: "hsl(225 25% 7%)" }}>
      <button
        className="w-full flex items-center gap-2.5 px-4 py-3 text-left"
        onClick={() => setOpen(!open)}
        style={{ borderBottom: open ? "1px solid hsl(225 20% 12%)" : "none" }}
      >
        <div className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0"
          style={{ background: `${color}20` }}>
          <span style={{ color }}>{icon}</span>
        </div>
        <span className="flex-1 text-sm font-bold text-white">{title}</span>
        {open
          ? <ChevronUp className="w-3.5 h-3.5 text-white/30" />
          : <ChevronDown className="w-3.5 h-3.5 text-white/30" />}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="p-4">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ScoreRing({ value, max, color, label }: { value: number; max: number; color: string; label: string }) {
  const pct = Math.round((value / max) * 100);
  const R = 28; const C = 2 * Math.PI * R;
  const dash = C - (pct / 100) * C;
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: 72, height: 72 }}>
        <svg width="72" height="72" style={{ transform: "rotate(-90deg)" }}>
          <circle cx="36" cy="36" r={R} fill="none" stroke="hsl(225 20% 14%)" strokeWidth="5" />
          <motion.circle
            cx="36" cy="36" r={R} fill="none"
            stroke={color} strokeWidth="5" strokeLinecap="round"
            strokeDasharray={C}
            initial={{ strokeDashoffset: C }}
            animate={{ strokeDashoffset: dash }}
            transition={{ duration: 1, ease: "easeOut" }}
            style={{ filter: `drop-shadow(0 0 6px ${color}80)` }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-base font-black tabular-nums" style={{ color }}>{value}</span>
          <span className="text-[9px] text-white/30">/{max}</span>
        </div>
      </div>
      <span className="text-[10px] text-white/40 uppercase tracking-wider font-bold">{label}</span>
    </div>
  );
}

// ── Main AIPanel ──────────────────────────────────────────────────────────────
export default function AIPanel({ submission, maxScore, onGradeAccepted, onRefresh }: AIPanelProps) {
  const [loading, setLoading] = useState<Record<LoadingKey, boolean>>({
    grade: false, plagiarism: false, detection: false, behavior: false,
  });
  const [localData, setLocalData] = useState<Partial<Submission>>({});

  const merged = { ...submission, ...localData };
  const hasContent = !!submission.content?.trim();

  async function runCheck(key: LoadingKey, fnName: string) {
    if (!hasContent) {
      toast.error("This submission has no text content to analyze.");
      return;
    }
    setLoading((prev) => ({ ...prev, [key]: true }));
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");
      const result = await callEdgeFunction(fnName, submission.id, session.access_token);

      // Map result back to local state keys
      if (key === "grade") {
        setLocalData((p) => ({
          ...p,
          ai_grade: result.suggested_grade,
          ai_feedback: result.detailed_feedback,
        }));
        toast.success("AI grading complete");
      } else if (key === "plagiarism") {
        setLocalData((p) => ({
          ...p,
          plagiarism_score: result.similarity_score ?? 0,
          plagiarism_details: result,
        }));
        toast.success("Plagiarism check complete");
      } else if (key === "detection") {
        setLocalData((p) => ({
          ...p,
          ai_detection_score: result.ai_probability,
          ai_detection_label: result.classification,
          ai_detection_details: result,
        }));
        toast.success("AI detection complete");
      } else if (key === "behavior") {
        setLocalData((p) => ({ ...p, behavior_note: result.behavior_note }));
        toast.success("Behavior note generated");
      }
      onRefresh();
    } catch (err: any) {
      toast.error(`${key} check failed: ${err.message}`);
    } finally {
      setLoading((prev) => ({ ...prev, [key]: false }));
    }
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2 mb-1">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center"
          style={{ background: "hsl(263 70% 58% / 0.15)", boxShadow: "0 0 12px hsl(263 70% 58% / 0.3)" }}>
          <Sparkles className="w-3.5 h-3.5 text-violet-400" />
        </div>
        <span className="text-sm font-black text-white">AI Analysis</span>
        <span className="ml-auto text-[9px] text-white/25 uppercase tracking-wider">Doctor only • Advisory</span>
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-2 gap-2">
        {[
          { key: "grade" as LoadingKey, label: "Check with AI", icon: <Sparkles className="w-3.5 h-3.5" />, color: "#a78bfa", fn: "ai-grade" },
          { key: "plagiarism" as LoadingKey, label: "Check Plagiarism", icon: <ShieldCheck className="w-3.5 h-3.5" />, color: "#38bdf8", fn: "ai-plagiarism" },
          { key: "detection" as LoadingKey, label: "Detect AI Usage", icon: <Bot className="w-3.5 h-3.5" />, color: "#fb923c", fn: "ai-detection" },
          { key: "behavior" as LoadingKey, label: "Gen. Behavior Note", icon: <Brain className="w-3.5 h-3.5" />, color: "#4ade80", fn: "ai-behavior-feedback" },
        ].map(({ key, label, icon, color, fn }) => (
          <motion.button
            key={key}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => runCheck(key, fn)}
            disabled={loading[key] || !hasContent}
            className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-[11px] font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              background: `${color}12`,
              border: `1px solid ${color}30`,
              color,
            }}
          >
            {loading[key]
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : icon}
            {label}
          </motion.button>
        ))}
      </div>

      {!hasContent && (
        <p className="text-[10px] text-amber-400/70 text-center py-1">
          No text content — AI checks require a text submission.
        </p>
      )}

      {/* Results */}
      <div className="space-y-2.5">

        {/* ── AI Grade Result ── */}
        {merged.ai_grade != null && (
          <ResultCard title="AI Suggested Grade" icon={<Star className="w-3.5 h-3.5" />} color="#a78bfa">
            <div className="flex items-start gap-4">
              <ScoreRing
                value={merged.ai_grade}
                max={maxScore}
                color={scoreColor(Math.round((merged.ai_grade / maxScore) * 100))}
                label="Suggested"
              />
              <div className="flex-1 space-y-3">
                {merged.ai_feedback && (
                  <p className="text-xs text-white/60 leading-relaxed">{merged.ai_feedback}</p>
                )}
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="h-7 text-[10px] rounded-lg gap-1.5 flex-1"
                    style={{ background: "#22c55e20", color: "#22c55e", border: "1px solid #22c55e40" }}
                    onClick={() => merged.ai_grade != null && onGradeAccepted(merged.ai_grade, merged.ai_feedback ?? "")}
                  >
                    <CheckCircle2 className="w-3 h-3" /> Accept Grade
                  </Button>
                  <Button
                    size="sm"
                    className="h-7 text-[10px] rounded-lg gap-1.5 flex-1"
                    style={{ background: "#ef444420", color: "#ef4444", border: "1px solid #ef444440" }}
                    onClick={() => toast.info("AI suggestion ignored. Enter your own grade.")}
                  >
                    <XCircle className="w-3 h-3" /> Ignore
                  </Button>
                </div>
                <p className="text-[9px] text-white/20 italic">
                  AI grade is advisory only. You have final control.
                </p>
              </div>
            </div>
          </ResultCard>
        )}

        {/* ── Plagiarism Result ── */}
        {merged.plagiarism_score != null && (
          <ResultCard title="Plagiarism Check" icon={<ShieldCheck className="w-3.5 h-3.5" />} color="#38bdf8">
            <div className="space-y-3">
              {/* Score bar */}
              <div className="flex items-center gap-3">
                <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: "hsl(225 20% 14%)" }}>
                  <motion.div
                    className="h-full rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${merged.plagiarism_score}%` }}
                    transition={{ duration: 0.8 }}
                    style={{
                      background: plagiarismColor(merged.plagiarism_score),
                      boxShadow: `0 0 8px ${plagiarismColor(merged.plagiarism_score)}80`,
                    }}
                  />
                </div>
                <span className="text-base font-black tabular-nums w-12 text-right"
                  style={{ color: plagiarismColor(merged.plagiarism_score) }}>
                  {Math.round(merged.plagiarism_score)}%
                </span>
              </div>

              {/* Risk label */}
              <div className="flex items-center gap-2">
                {merged.plagiarism_score <= 15
                  ? <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  : merged.plagiarism_score <= 35
                  ? <AlertTriangle className="w-4 h-4 text-amber-400" />
                  : <XCircle className="w-4 h-4 text-red-400" />}
                <span className="text-xs font-semibold"
                  style={{ color: plagiarismColor(merged.plagiarism_score) }}>
                  {merged.plagiarism_score <= 15 ? "Low similarity — likely original"
                    : merged.plagiarism_score <= 35 ? "Moderate similarity — review recommended"
                    : "High similarity — potential plagiarism"}
                </span>
              </div>

              {/* Flags */}
              {merged.plagiarism_details?.flags?.length > 0 && (
                <div className="space-y-1">
                  <p className="text-[9px] uppercase tracking-widest text-white/25 font-bold">Flags</p>
                  {merged.plagiarism_details.flags.map((f: string, i: number) => (
                    <div key={i} className="flex items-start gap-2 text-[10px] text-white/50">
                      <AlertTriangle className="w-3 h-3 text-amber-400 flex-shrink-0 mt-0.5" />
                      {f}
                    </div>
                  ))}
                </div>
              )}

              {/* Provider note */}
              {merged.plagiarism_details?.note && (
                <p className="text-[9px] text-white/25 italic">{merged.plagiarism_details.note}</p>
              )}
            </div>
          </ResultCard>
        )}

        {/* ── AI Detection Result ── */}
        {merged.ai_detection_score != null && (
          <ResultCard title="AI Content Detection" icon={<Bot className="w-3.5 h-3.5" />} color="#fb923c">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: "hsl(225 20% 14%)" }}>
                  <motion.div
                    className="h-full rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${merged.ai_detection_score}%` }}
                    transition={{ duration: 0.8 }}
                    style={{
                      background: aiDetectionColor(merged.ai_detection_score),
                      boxShadow: `0 0 8px ${aiDetectionColor(merged.ai_detection_score)}80`,
                    }}
                  />
                </div>
                <span className="text-base font-black tabular-nums w-12 text-right"
                  style={{ color: aiDetectionColor(merged.ai_detection_score) }}>
                  {Math.round(merged.ai_detection_score)}%
                </span>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-bold px-2.5 py-1 rounded-lg"
                  style={{
                    background: `${aiDetectionColor(merged.ai_detection_score)}18`,
                    color: aiDetectionColor(merged.ai_detection_score),
                    border: `1px solid ${aiDetectionColor(merged.ai_detection_score)}35`,
                  }}>
                  {merged.ai_detection_label ?? "Unknown"}
                </span>
                <span className="text-[10px] text-white/35">
                  {merged.ai_detection_score <= 20 ? "Likely human-written"
                    : merged.ai_detection_score <= 50 ? "Possibly AI-assisted"
                    : "High probability of AI generation"}
                </span>
              </div>

              {/* Sentence-level breakdown */}
              {merged.ai_detection_details?.sentences?.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[9px] uppercase tracking-widest text-white/25 font-bold">Top AI-flagged sentences</p>
                  {merged.ai_detection_details.sentences
                    .filter((s: any) => s.generated_prob > 60)
                    .slice(0, 3)
                    .map((s: any, i: number) => (
                      <div key={i} className="p-2.5 rounded-lg text-[10px] text-white/50 border border-amber-500/20"
                        style={{ background: "#f59e0b08" }}>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[9px] font-bold text-amber-400">{s.generated_prob}% AI</span>
                        </div>
                        <span className="italic line-clamp-2">{s.text}</span>
                      </div>
                    ))}
                </div>
              )}

              {/* Indicators from Claude heuristic */}
              {merged.ai_detection_details?.indicators?.length > 0 && (
                <div className="space-y-1">
                  <p className="text-[9px] uppercase tracking-widest text-white/25 font-bold">Indicators</p>
                  {merged.ai_detection_details.indicators.map((ind: string, i: number) => (
                    <div key={i} className="flex items-center gap-2 text-[10px] text-white/50">
                      <Bot className="w-3 h-3 text-orange-400 flex-shrink-0" /> {ind}
                    </div>
                  ))}
                </div>
              )}

              <p className="text-[9px] text-white/20 italic">
                ⚠ AI detection is probabilistic. Do not penalize without further review.
              </p>

              {merged.ai_detection_details?.note && (
                <p className="text-[9px] text-white/25 italic">{merged.ai_detection_details.note}</p>
              )}
            </div>
          </ResultCard>
        )}

        {/* ── Behavior Note ── */}
        {merged.behavior_note && (
          <ResultCard title="Behavior Note" icon={<ClipboardCheck className="w-3.5 h-3.5" />} color="#4ade80">
            <div className="flex items-start gap-3">
              <div className="flex-1">
                <p className="text-xs text-white/60 leading-relaxed italic">"{merged.behavior_note}"</p>
                <p className="text-[9px] text-white/20 mt-2">
                  Generated based on submission timing relative to deadline.
                </p>
              </div>
              {/* Timing indicator */}
              <div className="flex flex-col items-center gap-1 flex-shrink-0">
                {merged.behavior_note.toLowerCase().includes("excellent") ||
                 merged.behavior_note.toLowerCase().includes("great") ? (
                  <TrendingUp className="w-5 h-5 text-emerald-400" />
                ) : merged.behavior_note.toLowerCase().includes("after") ||
                    merged.behavior_note.toLowerCase().includes("late") ? (
                  <TrendingDown className="w-5 h-5 text-red-400" />
                ) : (
                  <CheckCircle2 className="w-5 h-5 text-sky-400" />
                )}
              </div>
            </div>
          </ResultCard>
        )}

        {/* Empty state */}
        {!merged.ai_grade && !merged.plagiarism_score && !merged.ai_detection_score && !merged.behavior_note && (
          <div className="text-center py-6 rounded-xl border border-white/[0.05]"
            style={{ background: "hsl(225 25% 6%)" }}>
            <Sparkles className="w-7 h-7 mx-auto mb-2 text-white/15" />
            <p className="text-xs text-white/25">No AI checks run yet.</p>
            <p className="text-[10px] text-white/15 mt-1">Click a button above to start.</p>
          </div>
        )}
      </div>
    </div>
  );
}
