import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { motion, AnimatePresence } from "framer-motion";
import MainLayout from "@/components/layout/MainLayout";
import CreateAssignmentDialog from "@/components/submissions/CreateAssignmentDialog";
import GradeSubmissionDialog from "@/components/submissions/GradeSubmissionDialog";
import SubmitAssignmentDialog from "@/components/submissions/SubmitAssignmentDialog";
import {
  BookOpen, ClipboardList, Users, Star, Clock, AlertCircle,
  CheckCircle2, FileText, ChevronRight, ChevronDown,
  User, Calendar, MessageSquare, Sparkles, ShieldCheck,
  TrendingUp, TrendingDown, Bot, Search, Filter, Download, Paperclip,
} from "lucide-react";
import { format, formatDistanceToNow, isPast } from "date-fns";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

// ── Types ─────────────────────────────────────────────────────────────────────
interface Assignment {
  id: string;
  course_id: string;
  doctor_id: string | null;
  title: string;
  description: string | null;
  rubric: string | null;
  max_score: number;
  due_date: string | null;
  week_number: number | null;
  created_at: string;
}

interface Submission {
  id: string;
  assignment_id: string;
  student_id: string;
  content: string | null;
  submitted_at: string;
  status: string;
  doctor_grade: number | null;
  doctor_feedback: string | null;
  graded_at: string | null;
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

interface Course {
  id: string;
  name: string;
  course_code: string;
}

interface Student {
  id: string;
  full_name: string;
  student_code: string;
  user_id: string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function deadlineStatus(dueDate: string | null, submittedAt?: string) {
  if (!dueDate) return { label: "No deadline", color: "#64748b", icon: null };
  const due = new Date(dueDate);
  const submitted = submittedAt ? new Date(submittedAt) : null;

  if (submitted) {
    if (submitted > due) return { label: "Late", color: "#ef4444", icon: "late" };
    const msBefore = due.getTime() - submitted.getTime();
    if (msBefore < 5 * 60 * 1000) return { label: "Last 5 min", color: "#f59e0b", icon: "warning" };
    return { label: "On Time", color: "#22c55e", icon: "ok" };
  }

  if (isPast(due)) return { label: "Overdue", color: "#ef4444", icon: "late" };
  const msLeft = due.getTime() - Date.now();
  if (msLeft < 24 * 60 * 60 * 1000) return { label: "Due soon", color: "#f59e0b", icon: "warning" };
  return { label: formatDistanceToNow(due, { addSuffix: true }), color: "#22c55e", icon: "ok" };
}

function gradeColor(grade: number, max: number) {
  const pct = (grade / max) * 100;
  return pct >= 80 ? "#22c55e" : pct >= 60 ? "#f59e0b" : "#ef4444";
}

// Parse markdown links like [filename](url) from assignment description
function parseAttachments(description: string | null): { name: string; url: string }[] {
  if (!description) return [];
  const regex = /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g;
  const results: { name: string; url: string }[] = [];
  let match;
  while ((match = regex.exec(description)) !== null) {
    results.push({ name: match[1], url: match[2] });
  }
  return results;
}

// Strip attachment markdown from description for clean display
function cleanDescription(description: string | null): string | null {
  if (!description) return null;
  return description
    .replace(/\*\*Attachments:\*\*\n(\[.*?\]\(.*?\)\n?)+/g, "")
    .replace(/\n+$/, "")
    .trim() || null;
}

// ── Doctor View ───────────────────────────────────────────────────────────────
function DoctorView({ userId }: { userId: string }) {
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);
  const [gradingSubmission, setGradingSubmission] = useState<{
    submission: Submission; student: Student;
  } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "submitted" | "graded" | "late">("all");

  // Verify Python backend is reachable when page loads
  useEffect(() => {
    fetch("http://localhost:5000/health").catch(() =>
      console.info("Python backend not running — file uploads will be unavailable")
    );
  }, []);

  // Fetch doctor profile
  const { data: doctorProfile } = useQuery({
    queryKey: ["doctor-profile", userId],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").eq("id", userId).single();
      return data;
    },
  });

  // Fetch assigned courses
  const { data: courses = [] } = useQuery<Course[]>({
    queryKey: ["doctor-courses", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("courses")
        .select("id, name, course_code")
        .eq("doctor_id", userId)
        .order("name");
      return (data as Course[]) ?? [];
    },
  });

  // Fetch assignments for selected course
  const { data: assignments = [] } = useQuery<Assignment[]>({
    queryKey: ["assignments", selectedCourse?.id],
    enabled: !!selectedCourse,
    queryFn: async () => {
      const { data } = await supabase
        .from("assignments")
        .select("*")
        .eq("course_id", selectedCourse!.id)
        .order("created_at", { ascending: false });
      return (data as Assignment[]) ?? [];
    },
  });

  // Fetch submissions for selected assignment
  const { data: submissions = [] } = useQuery<Submission[]>({
    queryKey: ["submissions", selectedAssignment?.id],
    enabled: !!selectedAssignment,
    queryFn: async () => {
      const { data } = await supabase
        .from("submissions")
        .select("*")
        .eq("assignment_id", selectedAssignment!.id)
        .order("submitted_at", { ascending: false });
      return (data as Submission[]) ?? [];
    },
  });

  // Fetch all students enrolled in the course
  const { data: enrolledStudents = [] } = useQuery<Student[]>({
    queryKey: ["course-students", selectedCourse?.id],
    enabled: !!selectedCourse,
    queryFn: async () => {
      const { data } = await supabase
        .from("student_courses")
        .select("students(id, full_name, student_code, user_id)")
        .eq("course_id", selectedCourse!.id);
      return (data?.map((r: any) => r.students).filter(Boolean) as Student[]) ?? [];
    },
  });

  function getStudentById(id: string) {
    return enrolledStudents.find((s) => s.id === id);
  }

  function getSubmissionForStudent(studentId: string) {
    return submissions.find((s) => s.student_id === studentId);
  }

  // Filter submissions view
  const filteredStudents = enrolledStudents.filter((student) => {
    const sub = getSubmissionForStudent(student.id);
    const matchSearch = student.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      student.student_code.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchSearch) return false;
    if (statusFilter === "all") return true;
    if (statusFilter === "graded") return sub?.status === "graded";
    if (statusFilter === "submitted") return sub && sub.status !== "graded";
    if (statusFilter === "late") {
      if (!sub || !selectedAssignment?.due_date) return false;
      return new Date(sub.submitted_at) > new Date(selectedAssignment.due_date);
    }
    return true;
  });

  const submittedCount = selectedAssignment
    ? submissions.length
    : 0;
  const gradedCount = submissions.filter((s) => s.status === "graded").length;
  const lateCount = submissions.filter((s) =>
    selectedAssignment?.due_date &&
    new Date(s.submitted_at) > new Date(selectedAssignment.due_date)
  ).length;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-5 h-full">
      {/* ── LEFT: Course + Assignment list ── */}
      <div className="space-y-3">
        {/* Courses */}
        <div className="rounded-2xl border border-white/[0.07] overflow-hidden"
          style={{ background: "hsl(225 25% 8%)" }}>
          <div className="px-4 py-3 border-b border-white/[0.05] flex items-center gap-2">
            <BookOpen className="w-3.5 h-3.5 text-primary" />
            <span className="text-xs font-black text-white uppercase tracking-wider">My Courses</span>
            <span className="ml-auto text-[10px] text-white/30 bg-white/[0.05] px-1.5 py-0.5 rounded-md">
              {courses.length}
            </span>
          </div>
          <div className="p-2 space-y-1">
            {courses.length === 0 ? (
              <p className="text-xs text-white/30 text-center py-4">No courses assigned</p>
            ) : courses.map((course) => (
              <button
                key={course.id}
                onClick={() => { setSelectedCourse(course); setSelectedAssignment(null); }}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition-all text-left"
                style={selectedCourse?.id === course.id ? {
                  background: "linear-gradient(90deg, hsl(217 91% 60% / 0.15), transparent)",
                  border: "1px solid hsl(217 91% 60% / 0.25)",
                } : { background: "transparent" }}
              >
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-sm font-black text-primary"
                  style={{ background: "hsl(217 91% 60% / 0.12)" }}>
                  {(course.name[0] || "?").toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-white truncate">{course.name}</p>
                  <p className="text-[10px] text-white/35 font-mono">{course.course_code}</p>
                </div>
                {selectedCourse?.id === course.id && (
                  <ChevronRight className="w-3.5 h-3.5 text-primary/60" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Assignments for selected course */}
        {selectedCourse && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-white/[0.07] overflow-hidden"
            style={{ background: "hsl(225 25% 8%)" }}
          >
            <div className="px-4 py-2.5 border-b border-white/[0.05]">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <ClipboardList className="w-3.5 h-3.5 text-violet-400 flex-shrink-0" />
                  <span className="text-xs font-black text-white uppercase tracking-wider truncate">Assignments</span>
                </div>
                <CreateAssignmentDialog courseId={selectedCourse.id} doctorId={userId} />
              </div>
            </div>
            <div className="p-2 space-y-1 max-h-72 overflow-y-auto">
              {assignments.length === 0 ? (
                <div className="text-center py-6">
                  <ClipboardList className="w-6 h-6 mx-auto mb-2 text-white/15" />
                  <p className="text-xs text-white/30">No assignments yet</p>
                  <p className="text-[10px] text-white/20 mt-1">Click "+ Add Content" to create one</p>
                </div>
              ) : assignments.map((a) => {
                const ds = deadlineStatus(a.due_date);
                return (
                  <button
                    key={a.id}
                    onClick={() => setSelectedAssignment(a)}
                    className="w-full text-left px-3 py-2.5 rounded-xl transition-all"
                    style={selectedAssignment?.id === a.id ? {
                      background: "linear-gradient(90deg, hsl(263 70% 58% / 0.12), transparent)",
                      border: "1px solid hsl(263 70% 58% / 0.22)",
                    } : { background: "hsl(225 20% 10%)" }}
                  >
                    <p className="text-xs font-bold text-white truncate">{a.title}</p>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded"
                        style={{ background: `${ds.color}18`, color: ds.color }}>
                        {ds.label}
                      </span>
                      <span className="text-[9px] text-white/30">{a.max_score} pts</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </div>

      {/* ── RIGHT: Submissions panel ── */}
      <div className="space-y-4">
        {!selectedAssignment ? (
          <div className="h-64 flex flex-col items-center justify-center rounded-2xl border border-white/[0.07]"
            style={{ background: "hsl(225 25% 8%)" }}>
            <ClipboardList className="w-10 h-10 text-white/10 mb-3" />
            <p className="text-sm font-bold text-white/30">Select an assignment</p>
            <p className="text-xs text-white/20 mt-1">to view student submissions</p>
          </div>
        ) : (
          <motion.div
            key={selectedAssignment.id}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-4"
          >
            {/* Assignment header */}
            <div className="rounded-2xl border border-white/[0.07] overflow-hidden"
              style={{ background: "hsl(225 25% 8%)" }}>
              <div className="p-4 border-b border-white/[0.05]">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-black text-white text-base">{selectedAssignment.title}</h3>
                    {selectedAssignment.description && (
                      <p className="text-xs text-white/45 mt-1 line-clamp-2">{selectedAssignment.description}</p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                    <span className="text-xs font-bold text-white/50">{selectedAssignment.max_score} pts</span>
                    {selectedAssignment.due_date && (
                      <div className="flex items-center gap-1 text-[10px] text-white/30">
                        <Calendar className="w-3 h-3" />
                        {format(new Date(selectedAssignment.due_date), "MMM dd, HH:mm")}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Stats row */}
              <div className="grid grid-cols-4 divide-x divide-white/[0.05]">
                {[
                  { label: "Enrolled", value: enrolledStudents.length, color: "#64748b" },
                  { label: "Submitted", value: submittedCount, color: "#38bdf8" },
                  { label: "Graded", value: gradedCount, color: "#22c55e" },
                  { label: "Late", value: lateCount, color: "#ef4444" },
                ].map(({ label, value, color }) => (
                  <div key={label} className="p-3 text-center">
                    <p className="text-lg font-black" style={{ color }}>{value}</p>
                    <p className="text-[9px] text-white/30 uppercase tracking-wider">{label}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Search + filter */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search students..."
                  className="pl-9 h-9 rounded-xl text-xs"
                  style={{ background: "hsl(225 25% 8%)", border: "1px solid hsl(225 20% 13%)" }}
                />
              </div>
              <div className="flex gap-1">
                {(["all", "submitted", "graded", "late"] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setStatusFilter(f)}
                    className="px-2.5 py-1.5 rounded-lg text-[10px] font-bold capitalize transition-all"
                    style={statusFilter === f
                      ? { background: "hsl(217 91% 60% / 0.18)", color: "hsl(217 91% 60%)" }
                      : { background: "hsl(225 25% 9%)", color: "hsl(218 11% 45%)" }
                    }
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            {/* Student submission rows */}
            <div className="space-y-2">
              {filteredStudents.length === 0 ? (
                <div className="text-center py-10 rounded-2xl border border-white/[0.05]"
                  style={{ background: "hsl(225 25% 8%)" }}>
                  <Users className="w-8 h-8 mx-auto mb-2 text-white/15" />
                  <p className="text-sm text-white/30">No students found</p>
                </div>
              ) : filteredStudents.map((student, i) => {
                const sub = getSubmissionForStudent(student.id);
                const ds = sub
                  ? deadlineStatus(selectedAssignment.due_date, sub.submitted_at)
                  : { label: "Missing", color: "#ef4444", icon: "late" };

                const hasSubmitted = !!sub;
                const isGraded = sub?.status === "graded";

                return (
                  <motion.div
                    key={student.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className="flex items-center gap-3 p-4 rounded-2xl border border-white/[0.06] hover:border-white/[0.1] transition-all"
                    style={{ background: "hsl(225 25% 8%)" }}
                  >
                    {/* Avatar */}
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-sm font-black text-white"
                      style={{ background: `${ds.color}20` }}>
                      {student.full_name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-white truncate">{student.full_name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-white/30 font-mono">{student.student_code}</span>
                        {sub && (
                          <span className="text-[10px] text-white/25">
                            · {format(new Date(sub.submitted_at), "MMM dd, HH:mm")}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Status badge */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-[9px] font-bold px-2 py-1 rounded-lg"
                        style={{ background: `${ds.color}15`, color: ds.color, border: `1px solid ${ds.color}30` }}>
                        {ds.label}
                      </span>

                      {/* Grade badge */}
                      {isGraded && sub?.doctor_grade != null && (
                        <span className="text-[9px] font-black px-2 py-1 rounded-lg tabular-nums"
                          style={{
                            background: `${gradeColor(sub.doctor_grade, selectedAssignment.max_score)}15`,
                            color: gradeColor(sub.doctor_grade, selectedAssignment.max_score),
                            border: `1px solid ${gradeColor(sub.doctor_grade, selectedAssignment.max_score)}30`,
                          }}>
                          {sub.doctor_grade}/{selectedAssignment.max_score}
                        </span>
                      )}

                      {/* AI flags */}
                      {sub?.ai_detection_score != null && sub.ai_detection_score > 60 && (
                        <span title="High AI detection score" className="text-[9px] flex items-center gap-0.5 text-orange-400">
                          <Bot className="w-3 h-3" />
                        </span>
                      )}
                      {sub?.plagiarism_score != null && sub.plagiarism_score > 35 && (
                        <span title="High plagiarism score" className="text-[9px] flex items-center gap-0.5 text-sky-400">
                          <ShieldCheck className="w-3 h-3" />
                        </span>
                      )}

                      {/* Grade button */}
                      {hasSubmitted ? (
                        <button
                          onClick={() => setGradingSubmission({ submission: sub!, student })}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all"
                          style={isGraded
                            ? { background: "#22c55e15", color: "#22c55e", border: "1px solid #22c55e30" }
                            : { background: "hsl(217 91% 60% / 0.12)", color: "hsl(217 91% 60%)", border: "1px solid hsl(217 91% 60% / 0.25)" }
                          }
                        >
                          <Star className="w-3 h-3" />
                          {isGraded ? "Edit Grade" : "Grade"}
                        </button>
                      ) : (
                        <span className="text-[10px] text-white/20 italic px-2">Not submitted</span>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        )}
      </div>

      {/* Grade dialog */}
      {gradingSubmission && selectedAssignment && (
        <GradeSubmissionDialog
          open={!!gradingSubmission}
          onClose={() => setGradingSubmission(null)}
          submission={gradingSubmission.submission}
          assignment={selectedAssignment}
          student={gradingSubmission.student}
        />
      )}
    </div>
  );
}

// ── Student View ──────────────────────────────────────────────────────────────
function StudentView({ userId }: { userId: string }) {
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);

  // Fetch student record
  const { data: student } = useQuery({
    queryKey: ["student-record", userId],
    queryFn: async () => {
      const { data } = await supabase.from("students").select("*").eq("user_id", userId).single();
      return data;
    },
  });

  // Fetch enrolled courses
  const { data: courses = [] } = useQuery<Course[]>({
    queryKey: ["student-courses-list", student?.id],
    enabled: !!student?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("student_courses")
        .select("courses(id, name, course_code)")
        .eq("student_id", student!.id);
      return (data?.map((r: any) => r.courses).filter(Boolean) as Course[]) ?? [];
    },
  });

  // Fetch assignments for selected course
  const { data: assignments = [] } = useQuery<Assignment[]>({
    queryKey: ["student-assignments", selectedCourse?.id],
    enabled: !!selectedCourse,
    queryFn: async () => {
      const { data } = await supabase
        .from("assignments")
        .select("*")
        .eq("course_id", selectedCourse!.id)
        .order("created_at", { ascending: false });
      return (data as Assignment[]) ?? [];
    },
  });

  // Fetch student's own submissions
  const { data: mySubmissions = [] } = useQuery<Submission[]>({
    queryKey: ["student-submissions", student?.id, selectedCourse?.id],
    enabled: !!student?.id,
    queryFn: async () => {
      const assignmentIds = assignments.map((a) => a.id);
      if (assignmentIds.length === 0) return [];
      const { data } = await supabase
        .from("submissions")
        .select("*")
        .eq("student_id", student!.id)
        .in("assignment_id", assignmentIds);
      return (data as Submission[]) ?? [];
    },
    enabled: assignments.length > 0,
  });

  function getMySubmission(assignmentId: string) {
    return mySubmissions.find((s) => s.assignment_id === assignmentId);
  }

  const totalGraded = mySubmissions.filter((s) => s.status === "graded").length;
  const avgGrade = mySubmissions.filter((s) => s.doctor_grade != null).length > 0
    ? Math.round(
        mySubmissions
          .filter((s) => s.doctor_grade != null)
          .reduce((sum, s) => {
            const assignment = assignments.find((a) => a.id === s.assignment_id);
            return sum + (s.doctor_grade! / (assignment?.max_score ?? 100)) * 100;
          }, 0) /
        mySubmissions.filter((s) => s.doctor_grade != null).length
      )
    : null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-5">
      {/* Course sidebar */}
      <div className="rounded-2xl border border-white/[0.07] overflow-hidden"
        style={{ background: "hsl(225 25% 8%)" }}>
        <div className="px-4 py-3 border-b border-white/[0.05] flex items-center gap-2">
          <BookOpen className="w-3.5 h-3.5 text-primary" />
          <span className="text-xs font-black text-white uppercase tracking-wider">My Courses</span>
        </div>
        <div className="p-2 space-y-1">
          {courses.length === 0 ? (
            <p className="text-xs text-white/30 text-center py-4">Not enrolled in any courses</p>
          ) : courses.map((course) => (
            <button
              key={course.id}
              onClick={() => setSelectedCourse(course)}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition-all text-left"
              style={selectedCourse?.id === course.id ? {
                background: "linear-gradient(90deg, hsl(217 91% 60% / 0.15), transparent)",
                border: "1px solid hsl(217 91% 60% / 0.25)",
              } : {}}
            >
              <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-black text-primary"
                style={{ background: "hsl(217 91% 60% / 0.12)" }}>
                {(course.name[0] || "?").toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-white truncate">{course.name}</p>
                <p className="text-[10px] text-white/35 font-mono">{course.course_code}</p>
              </div>
            </button>
          ))}
        </div>

        {/* Summary stats */}
        {courses.length > 0 && (
          <div className="p-3 border-t border-white/[0.05] space-y-2">
            {totalGraded > 0 && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-white/40 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" /> Graded
                </span>
                <span className="font-bold text-white">{totalGraded}</span>
              </div>
            )}
            {avgGrade != null && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-white/40 flex items-center gap-1.5">
                  <Star className="w-3 h-3 text-amber-400" /> Avg Grade
                </span>
                <span className="font-bold" style={{ color: avgGrade >= 80 ? "#22c55e" : avgGrade >= 60 ? "#f59e0b" : "#ef4444" }}>
                  {avgGrade}%
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Assignments panel */}
      <div className="space-y-3">
        {!selectedCourse ? (
          <div className="h-64 flex flex-col items-center justify-center rounded-2xl border border-white/[0.07]"
            style={{ background: "hsl(225 25% 8%)" }}>
            <BookOpen className="w-10 h-10 text-white/10 mb-3" />
            <p className="text-sm font-bold text-white/30">Select a course</p>
            <p className="text-xs text-white/20 mt-1">to view assignments and materials</p>
          </div>
        ) : assignments.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center rounded-2xl border border-white/[0.07]"
            style={{ background: "hsl(225 25% 8%)" }}>
            <ClipboardList className="w-10 h-10 text-white/10 mb-3" />
            <p className="text-sm font-bold text-white/30">No assignments yet</p>
          </div>
        ) : assignments.map((assignment, i) => {
          const mySub = getMySubmission(assignment.id);
          const ds = mySub
            ? deadlineStatus(assignment.due_date, mySub.submitted_at)
            : deadlineStatus(assignment.due_date);
          const isGraded = mySub?.status === "graded";

          return (
            <motion.div
              key={assignment.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="rounded-2xl border border-white/[0.07] overflow-hidden"
              style={{ background: "hsl(225 25% 8%)" }}
            >
              <div className="p-4">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <ClipboardList className="w-3.5 h-3.5 text-violet-400 flex-shrink-0" />
                      <h4 className="text-sm font-black text-white truncate">{assignment.title}</h4>
                    </div>
                    {cleanDescription(assignment.description) && (
                      <p className="text-xs text-white/45 line-clamp-2">{cleanDescription(assignment.description)}</p>
                    )}
                    {/* Downloadable attachments */}
                    {parseAttachments(assignment.description).length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {parseAttachments(assignment.description).map((att, idx) => (
                          <a
                            key={idx}
                            href={att.url}
                            download={att.name}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold transition-all hover:opacity-80"
                            style={{ background: "hsl(217 91% 60% / 0.12)", color: "hsl(217 91% 60%)", border: "1px solid hsl(217 91% 60% / 0.25)" }}
                          >
                            <Download className="w-2.5 h-2.5" />
                            {att.name}
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                  <SubmitAssignmentDialog
                    assignment={assignment}
                    studentId={student?.id ?? ""}
                    alreadySubmitted={!!mySub}
                    existingContent={mySub?.content ?? undefined}
                    existingSubmissionId={mySub?.id}
                  />
                </div>

                {/* Deadline + status row */}
                <div className="flex items-center gap-2 flex-wrap">
                  {assignment.due_date && (
                    <div className="flex items-center gap-1 text-[10px] text-white/30">
                      <Calendar className="w-3 h-3" />
                      {format(new Date(assignment.due_date), "MMM dd, yyyy · HH:mm")}
                    </div>
                  )}
                  <span className="text-[9px] font-bold px-2 py-0.5 rounded-lg"
                    style={{ background: `${ds.color}15`, color: ds.color, border: `1px solid ${ds.color}28` }}>
                    {ds.label}
                  </span>
                  <span className="text-[10px] text-white/25">{assignment.max_score} pts</span>
                </div>

                {/* Grade + feedback (if graded) */}
                {isGraded && mySub && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    className="mt-3 pt-3 border-t border-white/[0.06] space-y-2"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        <Star className="w-3.5 h-3.5 text-amber-400" />
                        <span className="text-sm font-black"
                          style={{ color: gradeColor(mySub.doctor_grade!, assignment.max_score) }}>
                          {mySub.doctor_grade}/{assignment.max_score}
                        </span>
                        <span className="text-xs text-white/30">
                          ({Math.round((mySub.doctor_grade! / assignment.max_score) * 100)}%)
                        </span>
                      </div>
                      {/* Progress bar */}
                      <div className="flex-1 h-1.5 rounded-full overflow-hidden"
                        style={{ background: "hsl(225 20% 14%)" }}>
                        <div className="h-full rounded-full"
                          style={{
                            width: `${(mySub.doctor_grade! / assignment.max_score) * 100}%`,
                            background: gradeColor(mySub.doctor_grade!, assignment.max_score),
                          }} />
                      </div>
                    </div>

                    {mySub.doctor_feedback && (
                      <div className="p-3 rounded-xl border border-white/[0.05]"
                        style={{ background: "hsl(225 25% 6%)" }}>
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <MessageSquare className="w-3 h-3 text-primary" />
                          <span className="text-[10px] font-bold text-white/50 uppercase tracking-wider">Doctor's Feedback</span>
                        </div>
                        <p className="text-xs text-white/60 leading-relaxed">{mySub.doctor_feedback}</p>
                      </div>
                    )}

                    {mySub.behavior_note && (
                      <div className="p-3 rounded-xl border border-emerald-500/15"
                        style={{ background: "#22c55e08" }}>
                        <div className="flex items-center gap-1.5 mb-1">
                          {mySub.behavior_note.toLowerCase().includes("late") || mySub.behavior_note.toLowerCase().includes("deadline")
                            ? <TrendingDown className="w-3 h-3 text-amber-400" />
                            : <TrendingUp className="w-3 h-3 text-emerald-400" />}
                          <span className="text-[10px] font-bold text-white/40 uppercase tracking-wider">Behavior Note</span>
                        </div>
                        <p className="text-xs text-white/55 italic leading-relaxed">"{mySub.behavior_note}"</p>
                      </div>
                    )}
                  </motion.div>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function Submissions() {
  const { user, role } = useAuth();
  const isDoctor = role === "doctor" || role === "admin" || role === "dean";

  return (
    <MainLayout title="Assignments">
      <div className="space-y-6">
        {/* Hero header */}
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-2xl p-6"
          style={{
            background: "linear-gradient(135deg, hsl(217 91% 60% / 0.12), hsl(263 70% 58% / 0.08))",
            border: "1px solid hsl(217 91% 60% / 0.2)",
          }}
        >
          {/* Grid pattern */}
          <div className="absolute inset-0 pointer-events-none opacity-20"
            style={{
              backgroundImage: "linear-gradient(hsl(217 91% 60% / 0.15) 1px, transparent 1px), linear-gradient(90deg, hsl(217 91% 60% / 0.15) 1px, transparent 1px)",
              backgroundSize: "32px 32px",
            }} />

          <div className="relative z-10 flex items-center justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] text-primary/70 font-bold mb-1">
                {isDoctor ? "Course Management" : "Student Portal"}
              </p>
              <h2 className="text-2xl font-black text-white">
                {isDoctor ? "Assignments & Grading" : "My Assignments"}
              </h2>
              <p className="text-sm text-white/45 mt-1">
                {isDoctor
                  ? "Create assignments, review submissions, and use AI-powered grading"
                  : "Submit assignments, track grades, and view feedback"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {isDoctor && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-bold border border-violet-500/25"
                  style={{ background: "hsl(263 70% 58% / 0.1)", color: "#a78bfa" }}>
                  <Sparkles className="w-3 h-3" /> AI Grading
                </div>
              )}
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-bold border border-primary/25"
                style={{ background: "hsl(217 91% 60% / 0.1)", color: "hsl(217 91% 60%)" }}>
                <ClipboardList className="w-3 h-3" />
                {isDoctor ? "Doctor View" : "Student View"}
              </div>
            </div>
          </div>
        </motion.div>

        {/* Main content */}
        {user && (
          isDoctor
            ? <DoctorView userId={user.id} />
            : <StudentView userId={user.id} />
        )}
      </div>
    </MainLayout>
  );
}
