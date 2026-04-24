import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Upload, Send, Clock, AlertCircle, CheckCircle2, Calendar, Paperclip, X, FileText, Download, Star, ThumbsUp, ThumbsDown } from "lucide-react";
import { format, formatDistanceToNow, isPast } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";

interface Assignment {
  id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  max_score: number;
  course_id: string;
}

interface Props {
  assignment: Assignment;
  studentId: string;
  alreadySubmitted: boolean;
  existingContent?: string;
  existingSubmissionId?: string;
}

// Parse [name](url) markdown links from description
function parseAttachments(desc: string | null): { name: string; url: string }[] {
  if (!desc) return [];
  const rx = /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g;
  const out: { name: string; url: string }[] = [];
  let m: RegExpExecArray | null;
  while ((m = rx.exec(desc)) !== null) out.push({ name: m[1], url: m[2] });
  return out;
}

// Strip **Attachments:** block from description
function cleanDesc(desc: string | null): string | null {
  if (!desc) return null;
  return desc
    .replace(/\*\*Attachments:\*\*\n?(\[.*?\]\(.*?\)\n?)+/gs, "")
    .replace(/\*\*[^*]+\*\*/g, (m) => m.slice(2, -2)) // strip bold markers
    .trim() || null;
}

// Determine behavior outcome based on submission time vs due date
function getSubmissionBehavior(dueDate: string | null): {
  type: "positive" | "negative" | "warning" | null;
  actionName: string;
  scoreChange: number;
  advice: string;
  color: string;
  icon: "good" | "warn" | "bad";
} {
  if (!dueDate) return { type: null, actionName: "", scoreChange: 0, advice: "", color: "", icon: "good" };

  const due = new Date(dueDate).getTime();
  const now = Date.now();
  const msLeft = due - now; // positive = before deadline, negative = late
  const minLeft = msLeft / 60_000;

  if (msLeft < 0) {
    // Late submission
    const minsLate = Math.abs(minLeft);
    return {
      type: "negative",
      actionName: "Late Assignment Submission",
      scoreChange: minsLate > 60 ? -15 : -8,
      advice: "⚠️ This assignment was submitted after the deadline. Please plan ahead and submit your work on time to avoid penalties.",
      color: "#ef4444",
      icon: "bad",
    };
  } else if (minLeft <= 10) {
    // Last 10 minutes — warning
    return {
      type: "warning",
      actionName: "Last-Minute Submission",
      scoreChange: -3,
      advice: "⏰ You submitted just in time! Be careful — cutting it this close is risky. Try to submit at least a day early next time.",
      color: "#f59e0b",
      icon: "warn",
    };
  } else if (minLeft <= 60) {
    // Within the hour but okay
    return {
      type: "warning",
      actionName: "Near-Deadline Submission",
      scoreChange: 0,
      advice: "🕐 You made it, but barely! Aim to submit assignments earlier to give yourself more buffer time.",
      color: "#f59e0b",
      icon: "warn",
    };
  } else {
    // Submitted well ahead of time
    const hoursEarly = Math.floor(minLeft / 60);
    return {
      type: "positive",
      actionName: "Early Assignment Submission",
      scoreChange: hoursEarly >= 24 ? 8 : 5,
      advice: hoursEarly >= 24
        ? "🌟 Excellent! You submitted a full day or more ahead of the deadline. That shows great time management!"
        : "✅ Great job submitting on time with room to spare. Keep up this habit!",
      color: "#22c55e",
      icon: "good",
    };
  }
}

export default function SubmitAssignmentDialog({
  assignment, studentId, alreadySubmitted, existingContent, existingSubmissionId,
}: Props) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState(existingContent ?? "");
  const [loading, setLoading] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [behaviorResult, setBehaviorResult] = useState<ReturnType<typeof getSubmissionBehavior> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const attachments = parseAttachments(assignment.description);
  const cleanedDesc = cleanDesc(assignment.description);

  function addFiles(files: FileList | null) {
    if (!files) return;
    const valid = Array.from(files).filter(f => f.size < 20 * 1024 * 1024);
    setUploadedFiles(prev => [...prev, ...valid]);
  }

  function removeFile(idx: number) {
    setUploadedFiles(prev => prev.filter((_, i) => i !== idx));
  }

  async function uploadToBackend(file: File): Promise<string | null> {
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("http://localhost:5000/upload", { method: "POST", body: form });
      if (!res.ok) return null;
      const result = await res.json();
      return result.url as string;
    } catch { return null; }
  }

  const isLate = assignment.due_date ? isPast(new Date(assignment.due_date)) : false;
  const timeLeft = assignment.due_date
    ? formatDistanceToNow(new Date(assignment.due_date), { addSuffix: true })
    : null;
  const msLeft = assignment.due_date ? new Date(assignment.due_date).getTime() - Date.now() : Infinity;
  const isLastTenMinutes = msLeft > 0 && msLeft < 10 * 60 * 1000;

  async function handleSubmit() {
    if (!content.trim() && uploadedFiles.length === 0) {
      toast.error("Please write your submission or attach a file");
      return;
    }
    setLoading(true);
    try {
      // Calculate behavior BEFORE submission (use current time vs due date)
      const behavior = getSubmissionBehavior(assignment.due_date);

      // Upload files first
      let fileLinks = "";
      if (uploadedFiles.length > 0) {
        const urls = await Promise.all(uploadedFiles.map(f => uploadToBackend(f)));
        fileLinks = uploadedFiles
          .map((f, i) => urls[i] ? `[${f.name}](${urls[i]})` : null)
          .filter(Boolean)
          .join("\n");
      }

      const finalContent = [content.trim(), fileLinks].filter(Boolean).join("\n\n");
      let submissionId: string;

      if (alreadySubmitted && existingSubmissionId) {
        const { error } = await supabase
          .from("submissions")
          .update({ content: finalContent, submitted_at: new Date().toISOString() })
          .eq("id", existingSubmissionId);
        if (error) throw error;
        submissionId = existingSubmissionId;
      } else {
        const { data, error } = await supabase
          .from("submissions")
          .insert({
            assignment_id: assignment.id,
            student_id: studentId,
            content: finalContent,
            submitted_at: new Date().toISOString(),
          })
          .select("id")
          .single();
        if (error) throw error;
        submissionId = data.id;
      }

      // Record behavior based on submission timing
      if (behavior.type && !alreadySubmitted) {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          await supabase.from("behavior_records").insert({
            student_id: studentId,
            course_id: assignment.course_id,
            recorded_by: session?.user?.id ?? studentId,
            action_type: behavior.type === "warning" ? "negative" : behavior.type,
            action_name: behavior.actionName,
            score_change: behavior.scoreChange,
            notes: behavior.advice,
            week_number: null,
          });

          // Also update behavior_scores
          const { data: existing } = await supabase
            .from("behavior_scores")
            .select("id, score")
            .eq("student_id", studentId)
            .eq("course_id", assignment.course_id)
            .single();

          if (existing) {
            await supabase
              .from("behavior_scores")
              .update({ score: Math.max(0, Math.min(100, existing.score + behavior.scoreChange)) })
              .eq("id", existing.id);
          }
        } catch (_) {}
      }

      // Show behavior feedback to student
      if (behavior.type && !alreadySubmitted) {
        setBehaviorResult(behavior);
      } else {
        toast.success(alreadySubmitted ? "Submission updated!" : "Assignment submitted!");
        qc.invalidateQueries({ queryKey: ["my-course-submissions"] });
        qc.invalidateQueries({ queryKey: ["student-submissions"] });
        setOpen(false);
      }

      if (!alreadySubmitted) {
        qc.invalidateQueries({ queryKey: ["my-course-submissions"] });
        qc.invalidateQueries({ queryKey: ["student-submissions"] });
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }

  function closeBehaviorFeedback() {
    setBehaviorResult(null);
    setOpen(false);
    toast.success(alreadySubmitted ? "Submission updated!" : "Assignment submitted!");
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setBehaviorResult(null); }}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          className="h-8 text-xs rounded-xl gap-1.5"
          style={alreadySubmitted
            ? { background: "hsl(217 91% 60% / 0.12)", color: "hsl(217 91% 60%)", border: "1px solid hsl(217 91% 60% / 0.3)" }
            : { background: "linear-gradient(135deg, hsl(217 91% 60%), hsl(263 70% 58%))" }
          }
        >
          {alreadySubmitted ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Upload className="w-3.5 h-3.5" />}
          {alreadySubmitted ? "View / Edit" : "Submit"}
        </Button>
      </DialogTrigger>

      <DialogContent className="glass max-w-lg">
        <AnimatePresence mode="wait">
          {behaviorResult ? (
            /* ── Behavior Feedback Screen ── */
            <motion.div
              key="feedback"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="py-4 flex flex-col items-center gap-5 text-center"
            >
              {/* Icon ring */}
              <div className="w-20 h-20 rounded-full flex items-center justify-center"
                style={{
                  background: `${behaviorResult.color}18`,
                  border: `2px solid ${behaviorResult.color}40`,
                  boxShadow: `0 0 32px ${behaviorResult.color}20`,
                }}>
                {behaviorResult.icon === "good"
                  ? <ThumbsUp className="w-9 h-9" style={{ color: behaviorResult.color }} />
                  : behaviorResult.icon === "warn"
                  ? <Clock className="w-9 h-9" style={{ color: behaviorResult.color }} />
                  : <ThumbsDown className="w-9 h-9" style={{ color: behaviorResult.color }} />}
              </div>

              {/* Title */}
              <div>
                <p className="text-lg font-bold text-white mb-1">
                  {behaviorResult.icon === "good" ? "Assignment Submitted! 🎉" : behaviorResult.icon === "warn" ? "Submitted — Just In Time!" : "Late Submission"}
                </p>
                <p className="text-sm font-semibold" style={{ color: behaviorResult.color }}>
                  {behaviorResult.actionName}
                </p>
              </div>

              {/* Score change pill */}
              {behaviorResult.scoreChange !== 0 && (
                <div className="flex items-center gap-2 px-4 py-2 rounded-full"
                  style={{ background: `${behaviorResult.color}15`, border: `1px solid ${behaviorResult.color}30` }}>
                  <Star className="w-4 h-4" style={{ color: behaviorResult.color }} />
                  <span className="text-sm font-bold" style={{ color: behaviorResult.color }}>
                    {behaviorResult.scoreChange > 0 ? "+" : ""}{behaviorResult.scoreChange} Behavior Points
                  </span>
                </div>
              )}

              {/* Advice */}
              <div className="w-full p-4 rounded-xl text-sm text-white/70 leading-relaxed text-left"
                style={{ background: `${behaviorResult.color}08`, border: `1px solid ${behaviorResult.color}20` }}>
                {behaviorResult.advice}
              </div>

              <Button
                onClick={closeBehaviorFeedback}
                className="w-full rounded-xl"
                style={{ background: `linear-gradient(135deg, ${behaviorResult.color}, ${behaviorResult.color}cc)` }}
              >
                Got It
              </Button>
            </motion.div>
          ) : (
            /* ── Submit Form ── */
            <motion.div
              key="form"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Send className="w-4 h-4 text-primary" />
                  {alreadySubmitted ? "View Submission" : "Submit Assignment"}
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4 mt-3">
                {/* Assignment info card */}
                <div className="p-3 rounded-xl border border-border/20"
                  style={{ background: "hsl(225 25% 7%)" }}>
                  <p className="text-sm font-bold text-white mb-2">{assignment.title}</p>

                  {cleanedDesc && (
                    <p className="text-xs text-white/50 leading-relaxed mb-2">{cleanedDesc}</p>
                  )}

                  {/* Attachment download links */}
                  {attachments.length > 0 && (
                    <div className="space-y-1 pt-1 border-t border-white/5 mt-2">
                      <p className="text-[10px] text-white/30 uppercase tracking-wider mb-1">Materials</p>
                      {attachments.map((a, i) => (
                        <a
                          key={i}
                          href={a.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg transition-colors hover:bg-white/5"
                          style={{ border: "1px solid hsl(217 91% 60% / 0.15)", background: "hsl(217 91% 60% / 0.06)" }}
                        >
                          <Download className="w-3 h-3 flex-shrink-0" style={{ color: "hsl(217 91% 60%)" }} />
                          <span className="text-[11px] text-primary flex-1 truncate">{a.name}</span>
                          <span className="text-[10px] text-white/25">Download</span>
                        </a>
                      ))}
                    </div>
                  )}
                </div>

                {/* Deadline status */}
                {assignment.due_date && (
                  <div
                    className="flex items-center gap-2.5 p-3 rounded-xl border"
                    style={
                      isLate
                        ? { background: "#ef444408", borderColor: "#ef444430" }
                        : isLastTenMinutes
                        ? { background: "#f59e0b08", borderColor: "#f59e0b30" }
                        : { background: "#22c55e08", borderColor: "#22c55e30" }
                    }
                  >
                    {isLate
                      ? <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                      : isLastTenMinutes
                      ? <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0" />
                      : <Clock className="w-4 h-4 text-emerald-400 flex-shrink-0" />}
                    <div>
                      <p className="text-xs font-bold"
                        style={{ color: isLate ? "#ef4444" : isLastTenMinutes ? "#f59e0b" : "#22c55e" }}>
                        {isLate
                          ? "Past Deadline"
                          : isLastTenMinutes
                          ? "⚡ Less than 10 minutes left!"
                          : `Due ${timeLeft}`}
                      </p>
                      <div className="flex items-center gap-1 text-[10px] text-white/30 mt-0.5">
                        <Calendar className="w-3 h-3" />
                        {format(new Date(assignment.due_date), "MMM dd, yyyy · HH:mm")}
                      </div>
                    </div>
                  </div>
                )}

                {/* Warning banners */}
                {isLastTenMinutes && !isLate && (
                  <div className="p-2.5 rounded-lg border border-amber-500/20 text-[11px] text-amber-300/80"
                    style={{ background: "#f59e0b08" }}>
                    ⚠️ Submitting in the last 10 minutes will affect your behavior score. Submit earlier next time!
                  </div>
                )}
                {isLate && !alreadySubmitted && (
                  <div className="p-2.5 rounded-lg border border-red-500/20 text-[11px] text-red-300/70"
                    style={{ background: "#ef444408" }}>
                    This assignment is past due. Late submissions will negatively impact your behavior score.
                  </div>
                )}

                {/* Text area */}
                <div>
                  <Label className="text-xs mb-1.5 block">Your Answer</Label>
                  <Textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="Type your answer here... (optional if attaching a file)"
                    className="rounded-xl resize-none"
                    rows={5}
                  />
                  <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                    <span>{content.split(/\s+/).filter(Boolean).length} words</span>
                    <span>{content.length} chars</span>
                  </div>
                </div>

                {/* File upload */}
                <div>
                  <Label className="text-xs mb-1.5 flex items-center gap-1.5">
                    <Paperclip className="w-3 h-3" /> Attach Files
                  </Label>
                  <div
                    className="border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-colors hover:border-primary/50"
                    style={{ borderColor: "hsl(217 91% 60% / 0.2)", background: "hsl(217 91% 60% / 0.03)" }}
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => { e.preventDefault(); addFiles(e.dataTransfer.files); }}
                  >
                    <Upload className="w-5 h-5 mx-auto mb-1.5 text-white/25" />
                    <p className="text-[11px] text-white/35">Click or drag files here</p>
                    <p className="text-[10px] text-white/20 mt-0.5">PDF, Word, images — max 20MB each</p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      className="hidden"
                      accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png,.zip"
                      onChange={(e) => addFiles(e.target.files)}
                    />
                  </div>

                  {uploadedFiles.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {uploadedFiles.map((f, i) => (
                        <div key={i} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg"
                          style={{ background: "hsl(217 91% 60% / 0.08)", border: "1px solid hsl(217 91% 60% / 0.15)" }}>
                          <FileText className="w-3 h-3 text-primary flex-shrink-0" />
                          <span className="text-[11px] text-white/70 flex-1 truncate">{f.name}</span>
                          <span className="text-[10px] text-white/30">{(f.size / 1024).toFixed(0)} KB</span>
                          <button onClick={() => removeFile(i)} className="text-white/30 hover:text-red-400 transition-colors">
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Footer info */}
                <p className="text-[10px] text-white/25">
                  Max score: {assignment.max_score} pts · Graded by your doctor
                </p>

                {/* Submit button */}
                <Button
                  onClick={handleSubmit}
                  disabled={loading || (!content.trim() && uploadedFiles.length === 0)}
                  className="w-full rounded-xl gap-2 font-semibold"
                  style={isLate
                    ? { background: "#ef444420", color: "#ef4444", border: "1px solid #ef444430" }
                    : { background: "linear-gradient(135deg, hsl(217 91% 60%), hsl(263 70% 58%))" }
                  }
                >
                  <Send className="w-4 h-4" />
                  {loading
                    ? "Submitting..."
                    : alreadySubmitted
                    ? "Update Submission"
                    : isLate
                    ? "Submit (Late)"
                    : "Submit Assignment"}
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}
