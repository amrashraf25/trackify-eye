import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import AIPanel from "./AIPanel";
import {
  Star, MessageSquare, CheckCircle2, Clock, User,
  FileText, Sparkles, AlertCircle, Download, Paperclip,
  BookOpen, ChevronDown, ChevronUp, ClipboardList, Shield,
  GraduationCap, FolderOpen, ExternalLink,
} from "lucide-react";
import { format } from "date-fns";

interface Assignment {
  id: string;
  title: string;
  description: string | null;
  rubric: string | null;
  max_score: number;
  due_date: string | null;
}

interface Student {
  id: string;
  full_name: string;
  student_code: string;
}

interface Submission {
  id: string;
  content: string | null;
  submitted_at: string;
  status: string;
  doctor_grade: number | null;
  doctor_feedback: string | null;
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

interface Props {
  open: boolean;
  onClose: () => void;
  submission: Submission;
  assignment: Assignment;
  student: Student;
  initialTab?: "submission" | "ai";
}

// ── Helpers ────────────────────────────────────────────────────────────────

function parseAttachments(desc: string | null): { name: string; url: string }[] {
  if (!desc) return [];
  const rx = /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g;
  const out: { name: string; url: string }[] = [];
  let m: RegExpExecArray | null;
  while ((m = rx.exec(desc)) !== null) out.push({ name: m[1], url: m[2] });
  return out;
}

function cleanDesc(desc: string | null): string | null {
  if (!desc) return null;
  return desc
    .replace(/\*\*Attachments:\*\*\n?(\[.*?\]\(.*?\)\n?)+/gs, "")
    .replace(/\*\*[^*]+\*\*/g, (m) => m.slice(2, -2))
    .trim() || null;
}

// Parse file links from student submission content: [filename](url)
function parseSubmissionFiles(content: string | null): { name: string; url: string }[] {
  if (!content) return [];
  const rx = /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g;
  const out: { name: string; url: string }[] = [];
  let m: RegExpExecArray | null;
  while ((m = rx.exec(content)) !== null) out.push({ name: m[1], url: m[2] });
  return out;
}

// Strip file markdown links from submission text so only pure text shows
function cleanSubmissionContent(content: string | null): string | null {
  if (!content) return null;
  return content
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim() || null;
}

// Detect file type icon color from extension
function fileTypeColor(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (["pdf"].includes(ext)) return "#ef4444";
  if (["doc", "docx"].includes(ext)) return "#3b82f6";
  if (["xls", "xlsx"].includes(ext)) return "#22c55e";
  if (["ppt", "pptx"].includes(ext)) return "#f97316";
  if (["zip", "rar", "7z"].includes(ext)) return "#a78bfa";
  if (["jpg", "jpeg", "png", "gif", "webp"].includes(ext)) return "#ec4899";
  if (["py", "js", "ts", "cpp", "c", "java"].includes(ext)) return "#38bdf8";
  return "#94a3b8";
}

function statusColor(status: string, dueDate: string | null, submittedAt: string) {
  if (status === "graded") return "#22c55e";
  if (dueDate && new Date(submittedAt) > new Date(dueDate)) return "#ef4444";
  return "#38bdf8";
}

function statusLabel(status: string, dueDate: string | null, submittedAt: string) {
  if (status === "graded") return "Graded";
  if (dueDate && new Date(submittedAt) > new Date(dueDate)) return "Late";
  return "Submitted";
}

// ── Section collapse component ─────────────────────────────────────────────
function Section({ title, icon, color = "#38bdf8", children, defaultOpen = true }: {
  title: string; icon: React.ReactNode; color?: string;
  children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-xl overflow-hidden border border-white/[0.07]">
      <button
        className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-white/[0.03]"
        style={{ background: "hsl(225 25% 7%)", borderBottom: open ? "1px solid hsl(225 20% 12%)" : "none" }}
        onClick={() => setOpen(!open)}
      >
        <div className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0"
          style={{ background: `${color}20` }}>
          <span style={{ color, display: "flex" }}>{icon}</span>
        </div>
        <span className="flex-1 text-xs font-bold text-white/80 uppercase tracking-wide">{title}</span>
        {open
          ? <ChevronUp className="w-3 h-3 text-white/25" />
          : <ChevronDown className="w-3 h-3 text-white/25" />}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            style={{ background: "hsl(225 25% 6%)" }}
          >
            <div className="p-3">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────
export default function GradeSubmissionDialog({
  open, onClose, submission, assignment, student, initialTab = "submission",
}: Props) {
  const qc = useQueryClient();
  const [grade, setGrade] = useState(submission.doctor_grade?.toString() ?? "");
  const [feedback, setFeedback] = useState(submission.doctor_feedback ?? "");
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"submission" | "ai">(initialTab);

  const sc = statusColor(submission.status, assignment.due_date, submission.submitted_at);
  const sl = statusLabel(submission.status, assignment.due_date, submission.submitted_at);
  const attachments = parseAttachments(assignment.description);
  const cleanedDesc = cleanDesc(assignment.description);
  const submittedFiles = parseSubmissionFiles(submission.content);
  const submissionText = cleanSubmissionContent(submission.content);
  const gradePct = grade ? Math.min(100, Math.round((parseInt(grade) / assignment.max_score) * 100)) : 0;
  const gradeColor = gradePct >= 80 ? "#22c55e" : gradePct >= 60 ? "#f59e0b" : "#ef4444";

  async function handleSaveGrade() {
    const numGrade = parseInt(grade);
    if (isNaN(numGrade) || numGrade < 0 || numGrade > assignment.max_score) {
      toast.error(`Grade must be between 0 and ${assignment.max_score}`);
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase
        .from("submissions")
        .update({
          doctor_grade: numGrade,
          doctor_feedback: feedback.trim() || null,
          status: "graded",
          graded_at: new Date().toISOString(),
        })
        .eq("id", submission.id);
      if (error) throw error;
      toast.success("Grade saved successfully");
      qc.invalidateQueries({ queryKey: ["submissions"] });
      qc.invalidateQueries({ queryKey: ["all-course-submissions"] });
      onClose();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }

  function handleAcceptAIGrade(aiGrade: number, aiFeedback: string) {
    setGrade(String(aiGrade));
    setFeedback(aiFeedback);
    setActiveTab("submission");
    toast.success("AI suggestion applied — review and save when ready.");
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="glass max-w-2xl max-h-[92vh] overflow-hidden flex flex-col p-0 gap-0">

        {/* ── Top header bar ───────────────────────────────────────────── */}
        <div className="flex-shrink-0 px-4 py-3 border-b border-white/[0.07]"
          style={{ background: "hsl(225 25% 7%)" }}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{ background: "hsl(217 91% 60% / 0.15)" }}>
                <GraduationCap className="w-3.5 h-3.5 text-blue-400" />
              </div>
              <div>
                <p className="text-xs font-black text-white">{assignment.title}</p>
                <p className="text-[10px] text-white/30 font-mono">
                  {assignment.max_score} pts
                  {assignment.due_date && ` · Due ${format(new Date(assignment.due_date), "MMM dd, yyyy")}`}
                </p>
              </div>
            </div>
            {/* Doctor badge */}
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg border border-violet-500/20"
              style={{ background: "#a78bfa0a" }}>
              <Shield className="w-3 h-3 text-violet-400" />
              <span className="text-[9px] font-bold text-violet-400 uppercase tracking-wider">Doctor View</span>
            </div>
          </div>

          {/* Student row */}
          <div className="flex items-center justify-between p-2.5 rounded-xl border border-white/[0.06]"
            style={{ background: "hsl(225 25% 5%)" }}>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black text-white"
                style={{ background: "hsl(217 91% 60% / 0.2)", border: "1px solid hsl(217 91% 60% / 0.25)" }}>
                {student.full_name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-bold text-white">{student.full_name}</p>
                <p className="text-[10px] font-mono text-white/35">{student.student_code}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 text-[10px] text-white/30">
                <Clock className="w-3 h-3" />
                {format(new Date(submission.submitted_at), "MMM dd, yyyy • HH:mm")}
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg"
                style={{ background: `${sc}18`, color: sc, border: `1px solid ${sc}35` }}>
                {sl}
              </span>
            </div>
          </div>
        </div>

        {/* ── Tab switcher ─────────────────────────────────────────────── */}
        <div className="flex-shrink-0 flex gap-1 px-4 py-2 border-b border-white/[0.05]"
          style={{ background: "hsl(225 25% 6%)" }}>
          {[
            { id: "submission", label: "Submission & Grade", icon: <ClipboardList className="w-3.5 h-3.5" /> },
            { id: "ai", label: "AI Analysis", icon: <Sparkles className="w-3.5 h-3.5" /> },
          ].map(({ id, label, icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id as any)}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[11px] font-bold transition-all"
              style={activeTab === id ? {
                background: "hsl(217 91% 60% / 0.12)",
                color: "hsl(217 91% 60%)",
                border: "1px solid hsl(217 91% 60% / 0.2)",
              } : { color: "hsl(218 11% 45%)", border: "1px solid transparent" }}
            >
              {icon} {label}
            </button>
          ))}
        </div>

        {/* ── Scrollable body ───────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto space-y-2.5 p-4"
          style={{ background: "hsl(225 25% 5%)" }}>

          {activeTab === "submission" ? (
            <>
              {/* Assignment details collapsible */}
              <Section title="Assignment Details" icon={<BookOpen className="w-3 h-3" />} color="#38bdf8" defaultOpen={false}>
                {cleanedDesc ? (
                  <p className="text-xs text-white/55 leading-relaxed mb-2">{cleanedDesc}</p>
                ) : (
                  <p className="text-xs text-white/25 italic">No description provided.</p>
                )}
                {assignment.rubric && (
                  <>
                    <p className="text-[9px] uppercase tracking-widest text-white/25 font-bold mt-2 mb-1">Rubric</p>
                    <p className="text-xs text-white/45 leading-relaxed">{assignment.rubric}</p>
                  </>
                )}
              </Section>

              {/* Materials / Attachments */}
              {attachments.length > 0 && (
                <Section title={`Materials (${attachments.length})`} icon={<Paperclip className="w-3 h-3" />} color="#a78bfa" defaultOpen={true}>
                  <div className="space-y-1.5">
                    {attachments.map((att, i) => (
                      <a
                        key={i}
                        href={att.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2.5 p-2 rounded-lg border border-violet-500/15 hover:border-violet-500/35 transition-all group"
                        style={{ background: "#a78bfa09" }}
                      >
                        <div className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0"
                          style={{ background: "#a78bfa20" }}>
                          <FileText className="w-3.5 h-3.5 text-violet-400" />
                        </div>
                        <span className="flex-1 text-xs text-white/65 group-hover:text-white/90 transition-colors truncate">
                          {att.name}
                        </span>
                        <Download className="w-3.5 h-3.5 text-violet-400/50 group-hover:text-violet-400 transition-colors flex-shrink-0" />
                      </a>
                    ))}
                  </div>
                </Section>
              )}

              {/* Submitted Files — downloadable */}
              {submittedFiles.length > 0 && (
                <Section
                  title={`Submitted Files (${submittedFiles.length})`}
                  icon={<FolderOpen className="w-3 h-3" />}
                  color="#f97316"
                  defaultOpen={true}
                >
                  <div className="space-y-2">
                    {submittedFiles.map((file, i) => {
                      const color = fileTypeColor(file.name);
                      const ext = file.name.split(".").pop()?.toUpperCase() ?? "FILE";
                      return (
                        <div key={i} className="flex items-center gap-3 p-2.5 rounded-xl border transition-all group"
                          style={{ background: `${color}08`, borderColor: `${color}25` }}>
                          {/* Extension badge */}
                          <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 text-[9px] font-black"
                            style={{ background: `${color}20`, color, border: `1px solid ${color}30` }}>
                            {ext}
                          </div>
                          {/* File name */}
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-white/80 truncate">{file.name}</p>
                            <p className="text-[10px] text-white/30">Click to download</p>
                          </div>
                          {/* Download + Open buttons */}
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <a
                              href={file.url}
                              download={file.name}
                              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition-all hover:scale-105"
                              style={{ background: `${color}18`, color, border: `1px solid ${color}30` }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Download className="w-3 h-3" />
                              Download
                            </a>
                            <a
                              href={file.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-[10px] font-bold transition-all hover:scale-105"
                              style={{ background: "hsl(225 25% 10%)", color: "hsl(218 11% 50%)", border: "1px solid hsl(225 20% 15%)" }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </Section>
              )}

              {/* Student text answer */}
              <Section
                title="Student's Answer"
                icon={<FileText className="w-3 h-3" />}
                color="#34d399"
                defaultOpen={true}
              >
                {submissionText ? (
                  <div className="max-h-48 overflow-y-auto">
                    <p className="text-xs text-white/65 whitespace-pre-wrap leading-relaxed">
                      {submissionText}
                    </p>
                  </div>
                ) : submittedFiles.length > 0 ? (
                  <div className="flex items-center gap-2 py-2 text-white/30">
                    <FolderOpen className="w-4 h-4 flex-shrink-0 text-orange-400/60" />
                    <span className="text-xs italic">No written answer — student submitted file(s) above.</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 py-2 text-white/30">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span className="text-xs italic">No submission content found.</span>
                  </div>
                )}
              </Section>

              {/* Grading section */}
              <div className="rounded-xl border border-white/[0.07] overflow-hidden">
                <div className="flex items-center gap-2 px-3 py-2.5 border-b border-white/[0.07]"
                  style={{ background: "hsl(225 25% 7%)" }}>
                  <div className="w-5 h-5 rounded-md flex items-center justify-center"
                    style={{ background: "#fbbf2420" }}>
                    <Star className="w-3 h-3 text-amber-400" />
                  </div>
                  <span className="text-xs font-bold text-white/80 uppercase tracking-wide">Grade & Feedback</span>
                  {submission.doctor_grade != null && (
                    <span className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-lg"
                      style={{ background: "#22c55e18", color: "#22c55e", border: "1px solid #22c55e35" }}>
                      Currently: {submission.doctor_grade}/{assignment.max_score}
                    </span>
                  )}
                </div>
                <div className="p-3 space-y-3" style={{ background: "hsl(225 25% 6%)" }}>

                  {/* Grade input + bar */}
                  <div>
                    <Label className="text-[10px] text-white/40 uppercase tracking-wider font-bold mb-1.5 flex items-center gap-1.5">
                      <Star className="w-3 h-3 text-amber-400" />
                      Score (0 – {assignment.max_score} pts)
                    </Label>
                    <div className="flex items-center gap-3">
                      <Input
                        type="number"
                        value={grade}
                        onChange={(e) => setGrade(e.target.value)}
                        min={0} max={assignment.max_score}
                        placeholder={`0 – ${assignment.max_score}`}
                        className="rounded-xl w-28 text-center font-bold"
                      />
                      {grade && !isNaN(parseInt(grade)) && (
                        <motion.div
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          className="flex-1 flex items-center gap-2"
                        >
                          <div className="flex-1 h-1.5 rounded-full overflow-hidden"
                            style={{ background: "hsl(225 20% 14%)" }}>
                            <motion.div
                              className="h-full rounded-full"
                              initial={{ width: 0 }}
                              animate={{ width: `${gradePct}%` }}
                              transition={{ duration: 0.5 }}
                              style={{ background: gradeColor, boxShadow: `0 0 8px ${gradeColor}60` }}
                            />
                          </div>
                          <span className="text-sm font-black tabular-nums w-10 text-right"
                            style={{ color: gradeColor }}>
                            {gradePct}%
                          </span>
                        </motion.div>
                      )}
                    </div>
                  </div>

                  {/* Feedback textarea */}
                  <div>
                    <Label className="text-[10px] text-white/40 uppercase tracking-wider font-bold mb-1.5 flex items-center gap-1.5">
                      <MessageSquare className="w-3 h-3 text-blue-400" />
                      Feedback for Student
                    </Label>
                    <Textarea
                      value={feedback}
                      onChange={(e) => setFeedback(e.target.value)}
                      placeholder="Write constructive feedback visible to the student after grading..."
                      className="rounded-xl resize-none text-xs"
                      rows={3}
                    />
                  </div>

                  {/* AI suggestion banner */}
                  {submission.ai_grade != null && (
                    <div className="flex items-center gap-2.5 p-2.5 rounded-xl border border-violet-500/20"
                      style={{ background: "#a78bfa08" }}>
                      <Sparkles className="w-3.5 h-3.5 text-violet-400 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-[9px] text-violet-400 font-bold uppercase tracking-wider">AI Suggestion Available</p>
                        <p className="text-[10px] text-white/45 truncate">
                          Suggested: {submission.ai_grade}/{assignment.max_score} — Switch to AI Analysis tab to review
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          setGrade(String(submission.ai_grade));
                          if (submission.ai_feedback) setFeedback(submission.ai_feedback);
                          toast.success("AI suggestion applied");
                        }}
                        className="text-[10px] text-violet-400 font-bold px-2.5 py-1 rounded-lg border border-violet-500/30 hover:bg-violet-500/10 transition-all flex-shrink-0"
                      >
                        Apply
                      </button>
                    </div>
                  )}

                  {/* Save button */}
                  <Button
                    onClick={handleSaveGrade}
                    disabled={loading || !grade}
                    className="w-full rounded-xl gap-2 font-bold"
                    style={{ background: "linear-gradient(135deg, hsl(217 91% 55%), hsl(263 70% 55%))" }}
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    {loading ? "Saving..." : submission.doctor_grade != null ? "Update Grade" : "Save Grade"}
                  </Button>
                </div>
              </div>
            </>
          ) : (
            /* AI Analysis Tab */
            <AIPanel
              submission={submission}
              maxScore={assignment.max_score}
              onGradeAccepted={handleAcceptAIGrade}
              onRefresh={() => qc.invalidateQueries({ queryKey: ["submissions"] })}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
