import MainLayout from "@/components/layout/MainLayout";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Search, BookOpen, Users, Plus, GraduationCap, CheckCircle, XCircle, Clock, User, TrendingDown, TrendingUp, History, ChevronLeft, Sparkles, Calendar, Award, Trash2, UserPlus, BarChart2, Activity, ShieldCheck, ClipboardList, Download, Send, FileText, Star, MessageSquare, Paperclip, Pencil, Bot, ChevronDown, ChevronUp, CheckCircle2, AlertTriangle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { format, isPast, formatDistanceToNow } from "date-fns";
import SendBehaviorAlert from "@/components/SendBehaviorAlert";
import SendAttendanceAlert from "@/components/SendAttendanceAlert";
import CreateAssignmentDialog from "@/components/submissions/CreateAssignmentDialog";
import SubmitAssignmentDialog from "@/components/submissions/SubmitAssignmentDialog";
import GradeSubmissionDialog from "@/components/submissions/GradeSubmissionDialog";
import CourseMaterialsTab from "@/components/courses/CourseMaterialsTab";


function parseAttachments(desc: string | null) {
  if (!desc) return [];
  const rx = /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g;
  const out: { name: string; url: string }[] = [];
  let m;
  while ((m = rx.exec(desc)) !== null) out.push({ name: m[1], url: m[2] });
  return out;
}
function cleanDesc(desc: string | null) {
  if (!desc) return null;
  return desc.replace(/\*\*Attachments:\*\*\n(\[.*?\]\(.*?\)\n?)+/g, "").trim() || null;
}
function deadlineBadge(due: string | null) {
  if (!due) return { label: "No deadline", color: "#64748b" };
  if (isPast(new Date(due))) return { label: "Overdue", color: "#ef4444" };
  const ms = new Date(due).getTime() - Date.now();
  if (ms < 24 * 60 * 60 * 1000) return { label: "Due soon", color: "#f59e0b" };
  return { label: formatDistanceToNow(new Date(due), { addSuffix: true }), color: "#22c55e" };
}

const negativeActions = [
  { name: "Smoking during lecture", change: -15 },
  { name: "Disrespectful behavior", change: -10 },
  { name: "Skipping class", change: -5 },
  { name: "Using phone in class", change: -5 },
  { name: "Cheating", change: -20 },
  { name: "Fighting", change: -25 },
  { name: "Sleeping in class", change: -5 },
];

const positiveActions = [
  { name: "Writing notes", change: 5 },
  { name: "Participating in class", change: 5 },
  { name: "Helping classmates", change: 10 },
  { name: "Excellent homework", change: 5 },
  { name: "Leadership in project", change: 10 },
];

const WEEKS = Array.from({ length: 16 }, (_, i) => i + 1);

const Courses = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [newCourse, setNewCourse] = useState({ course_code: "", name: "", description: "", credits: "3", semester: "Fall 2024" });
  const [selectedWeek, setSelectedWeek] = useState(1);
  const [selectedBehaviorWeek, setSelectedBehaviorWeek] = useState(1);
  const [behaviorDialogOpen, setBehaviorDialogOpen] = useState(false);
  const [behaviorStudentId, setBehaviorStudentId] = useState<string | null>(null);
  const [actionType, setActionType] = useState<"positive" | "negative">("negative");
  const [selectedAction, setSelectedAction] = useState("");
  const [behaviorNotes, setBehaviorNotes] = useState("");
  const [enrollDialogOpen, setEnrollDialogOpen] = useState(false);
  const [studentToEnroll, setStudentToEnroll] = useState("");
  const { role, user } = useAuth();
  const queryClient = useQueryClient();

  const canManage = role === "admin" || role === "dean";
  const canRecord = role === "admin" || role === "dean" || role === "doctor";
  const canAddAssignment = role === "doctor" || canManage;

  // Doctor grading state
  const [gradeTarget, setGradeTarget] = useState<{
    submission: any; assignment: any; student: any; initialTab: "submission" | "ai";
  } | null>(null);
  const [expandedAssignments, setExpandedAssignments] = useState<Set<string>>(new Set());
  const [editAssignment, setEditAssignment] = useState<any | null>(null);
  const [editForm, setEditForm] = useState({ title: "", description: "", max_score: "100", due_date: "" });

  function toggleAssignmentExpand(id: string) {
    setExpandedAssignments(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function handleDeleteAssignment(id: string) {
    await supabase.from("assignments").delete().eq("id", id);
    queryClient.invalidateQueries({ queryKey: ["course-assignments"] });
    toast.success("Assignment deleted");
  }

  async function handleEditAssignment() {
    if (!editAssignment) return;
    await supabase.from("assignments").update({
      title: editForm.title.trim(),
      description: editForm.description.trim() || null,
      max_score: parseInt(editForm.max_score) || 100,
      due_date: editForm.due_date ? new Date(editForm.due_date).toISOString() : null,
    }).eq("id", editAssignment.id);
    queryClient.invalidateQueries({ queryKey: ["course-assignments"] });
    setEditAssignment(null);
    toast.success("Assignment updated");
  }

  // For students, resolve their student record via the /api/student/me endpoint.
  // The endpoint matches by user_id → email → full_name and auto-links for future calls.
  const { data: myStudentRecord } = useQuery({
    queryKey: ["my-student-record", user?.id],
    queryFn: async () => {
      const r = await fetch(`http://localhost:3001/api/student/me?user_id=${user!.id}`);
      if (!r.ok) return null;
      return r.json();
    },
    enabled: !!user?.id && role === "student",
    staleTime: 0,
  });

  // Assignments for selected course
  const { data: courseAssignments = [] } = useQuery({
    queryKey: ["course-assignments", selectedCourseId],
    enabled: !!selectedCourseId,
    queryFn: async () => {
      const { data } = await supabase.from("assignments").select("*").eq("course_id", selectedCourseId!).order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  // Student's own submissions for this course's assignments
  const { data: mySubmissions = [] } = useQuery({
    queryKey: ["my-course-submissions", myStudentRecord?.id, selectedCourseId],
    queryFn: async () => {
      const ids = courseAssignments.map((a: any) => a.id);
      if (ids.length === 0) return [];
      const { data } = await supabase.from("submissions").select("*").eq("student_id", myStudentRecord!.id).in("assignment_id", ids);
      return data ?? [];
    },
    enabled: courseAssignments.length > 0 && !!myStudentRecord?.id && role === "student",
  });

  // Doctor/admin: ALL submissions for this course's assignments
  const { data: allSubmissions = [], refetch: refetchAllSubmissions } = useQuery({
    queryKey: ["all-course-submissions", selectedCourseId, courseAssignments.map((a: any) => a.id).join(",")],
    enabled: !!selectedCourseId && (role === "doctor" || canManage) && courseAssignments.length > 0,
    queryFn: async () => {
      const ids = courseAssignments.map((a: any) => a.id);
      const { data } = await supabase.from("submissions").select("*").in("assignment_id", ids);
      return data ?? [];
    },
  });

  // Doctor/admin: students enrolled in this course
  const { data: courseStudents = [] } = useQuery({
    queryKey: ["course-students", selectedCourseId],
    enabled: !!selectedCourseId && (role === "doctor" || canManage),
    queryFn: async () => {
      const { data: enroll } = await supabase.from("enrollments").select("student_id").eq("course_id", selectedCourseId!);
      if (!enroll?.length) return [];
      const ids = enroll.map((e: any) => e.student_id);
      const { data } = await supabase.from("students").select("id, full_name, student_code, user_id").in("id", ids);
      return data ?? [];
    },
  });

  const { data: courses = [], refetch } = useQuery({
    queryKey: ["courses", role, user?.id, myStudentRecord?.id],
    queryFn: async () => {
      if (role === "student" && myStudentRecord?.id) {
        // Get enrolled course IDs first
        const { data: myEnrollments, error: enrollError } = await supabase
          .from("enrollments")
          .select("course_id")
          .eq("student_id", myStudentRecord.id);
        if (enrollError) throw enrollError;
        const courseIds = myEnrollments.map((e) => e.course_id);
        if (courseIds.length === 0) return [];
        const { data, error } = await supabase.from("courses").select("*").in("id", courseIds).order("name");
        if (error) throw error;
        return data;
      }
      let query = supabase.from("courses").select("*").order("name");
      if (role === "doctor" && user?.id) {
        query = query.eq("doctor_id", user.id);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: role !== "student" || !!myStudentRecord?.id,
  });

  const { data: enrollments = [] } = useQuery({
    queryKey: ["enrollments"],
    queryFn: async () => {
      const { data, error } = await supabase.from("enrollments").select("*");
      if (error) throw error;
      return data;
    },
  });

  const { data: students = [] } = useQuery({
    queryKey: ["all-students"],
    queryFn: async () => {
      const { data, error } = await supabase.from("students").select("*").eq("status", "active").order("full_name");
      if (error) throw error;
      return data;
    },
  });

  const { data: attendanceRecords = [] } = useQuery({
    queryKey: ["course-attendance", selectedCourseId, selectedWeek],
    queryFn: async () => {
      if (!selectedCourseId) return [];
      const { data, error } = await supabase
        .from("attendance_records")
        .select("*")
        .eq("course_id", selectedCourseId)
        .eq("week_number", selectedWeek);
      if (error) throw error;
      return data;
    },
    enabled: !!selectedCourseId,
  });

  const { data: behaviorScores = [] } = useQuery({
    queryKey: ["behavior-scores"],
    queryFn: async () => {
      const { data, error } = await supabase.from("behavior_scores").select("*");
      if (error) throw error;
      return data;
    },
  });

  // severity → score_change mapping (matches Behavior Tracking page logic)
  const severityToChange = (sev: string) =>
    sev === "critical" ? -20 : sev === "high" ? -10 : sev === "medium" ? -5 : -2;

  // Fetch behavior logs for the selected week + course (single source of truth = behavior_logs)
  const { data: weeklyBehaviorRecords = [] } = useQuery({
    queryKey: ["weekly-behavior-records", selectedCourseId, selectedBehaviorWeek],
    queryFn: async () => {
      if (!selectedCourseId) return [];
      const { data, error } = await supabase
        .from("behavior_logs")
        .select("*")
        .eq("course_id", selectedCourseId)
        .eq("week_number", selectedBehaviorWeek)
        .order("started_at", { ascending: false });
      if (error) throw error;
      // Normalise to the shape the rest of the UI expects
      return (data ?? []).map((r: any) => ({
        ...r,
        score_change: severityToChange(r.severity),
        created_at: r.started_at,
        action_name: r.behavior_type,
      }));
    },
    enabled: !!selectedCourseId,
    staleTime: 0,
    refetchInterval: 5000,
  });

  const { data: behaviorHistory = [] } = useQuery({
    queryKey: ["behavior-history-course", selectedCourseId, behaviorStudentId, selectedBehaviorWeek],
    queryFn: async () => {
      if (!behaviorStudentId || !selectedCourseId) return [];
      const { data, error } = await supabase
        .from("behavior_logs")
        .select("*")
        .eq("student_id", behaviorStudentId)
        .eq("course_id", selectedCourseId)
        .eq("week_number", selectedBehaviorWeek)
        .order("started_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []).map((r: any) => ({
        ...r,
        action_type: "negative",
        action_name: r.behavior_type,
        score_change: severityToChange(r.severity),
        created_at: r.started_at,
      }));
    },
    enabled: !!behaviorStudentId && !!selectedCourseId,
  });

  // Student's personal attendance across all courses
  const { data: myAttendanceRecords = [] } = useQuery({
    queryKey: ["my-all-attendance", myStudentRecord?.id],
    queryFn: async () => {
      if (!myStudentRecord?.id) return [];
      const { data, error } = await supabase
        .from("attendance_records")
        .select("*")
        .eq("student_id", myStudentRecord.id);
      if (error) return [];
      return data;
    },
    enabled: !!myStudentRecord?.id && role === "student",
  });

  // Student's global behavior score
  const { data: myBehaviorScore } = useQuery({
    queryKey: ["my-behavior-score-courses", myStudentRecord?.id],
    queryFn: async () => {
      if (!myStudentRecord?.id) return null;
      const { data, error } = await supabase
        .from("behavior_scores")
        .select("*")
        .eq("student_id", myStudentRecord.id)
        .single();
      if (error) return null;
      return data;
    },
    enabled: !!myStudentRecord?.id && role === "student",
  });

  // Student's behavior history for selected course
  const { data: myCourseBehaviorHistory = [] } = useQuery({
    queryKey: ["my-course-behavior", myStudentRecord?.id, selectedCourseId],
    queryFn: async () => {
      if (!myStudentRecord?.id || !selectedCourseId) return [];
      const { data, error } = await supabase
        .from("behavior_logs")
        .select("*")
        .eq("student_id", myStudentRecord.id)
        .eq("course_id", selectedCourseId)
        .order("started_at", { ascending: false })
        .limit(30);
      if (error) return [];
      return (data ?? []).map((r: any) => ({
        ...r,
        action_type: "negative",
        action_name: r.behavior_type,
        score_change: severityToChange(r.severity),
        created_at: r.started_at,
      }));
    },
    enabled: !!myStudentRecord?.id && !!selectedCourseId && role === "student",
    staleTime: 0,
    refetchInterval: 5000,
  });

  const getMyAttendanceRate = (courseId: string) => {
    const records = myAttendanceRecords.filter((r) => r.course_id === courseId);
    if (records.length === 0) return null;
    const present = records.filter((r) => r.status === "present").length;
    return { rate: Math.round((present / records.length) * 100), total: records.length, present };
  };

  const filteredCourses = courses.filter((c) =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.course_code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectedCourse = courses.find((c) => c.id === selectedCourseId);

  const getEnrolledStudents = (courseId: string) => {
    const enrolledIds = enrollments.filter((e) => e.course_id === courseId).map((e) => e.student_id);
    return students.filter((s) => enrolledIds.includes(s.id));
  };

  const getStudentStatus = (studentId: string) => {
    const record = attendanceRecords.find((a) => a.student_id === studentId);
    return record?.status || null;
  };

  const getScore = (studentId: string) => behaviorScores.find((s) => s.student_id === studentId)?.score ?? 100;

  // Weekly score: starts at 100, apply all changes for that week
  const getWeeklyScore = (studentId: string) => {
    const records = weeklyBehaviorRecords.filter((r) => r.student_id === studentId);
    if (records.length === 0) return 100;
    const total = records.reduce((sum, r) => sum + r.score_change, 0);
    return Math.max(0, Math.min(100, 100 + total));
  };

  const getWeeklyRecordCount = (studentId: string) => {
    return weeklyBehaviorRecords.filter((r) => r.student_id === studentId).length;
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-emerald-500";
    if (score >= 60) return "text-amber-500";
    return "text-destructive";
  };

  const getProgressColor = (score: number) => {
    if (score >= 80) return "bg-emerald-500";
    if (score >= 60) return "bg-amber-500";
    return "bg-destructive";
  };

  const markAttendance = useMutation({
    mutationFn: async ({ studentId, status }: { studentId: string; status: string }) => {
      if (!selectedCourseId || !selectedCourse) return;
      const existing = attendanceRecords.find((a) => a.student_id === studentId);
      if (existing) {
        if (existing.status === status) {
          // Toggle off - delete the record
          const { error } = await supabase.from("attendance_records").delete().eq("id", existing.id);
          if (error) throw error;
        } else {
          const { error } = await supabase.from("attendance_records").update({ status }).eq("id", existing.id);
          if (error) throw error;
        }
      } else {
        const { error } = await supabase.from("attendance_records").insert({
          student_id: studentId,
          course_name: selectedCourse.name,
          course_id: selectedCourseId,
          date: new Date().toISOString().split("T")[0],
          status,
          week_number: selectedWeek,
          marked_by: user?.id,
          recognition_method: "manual",
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["course-attendance"] });
      toast.success("Attendance updated");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const recordBehavior = useMutation({
    mutationFn: async () => {
      if (!behaviorStudentId || !selectedAction || !selectedCourseId) throw new Error("Missing data");
      const actions = actionType === "positive" ? positiveActions : negativeActions;
      const action = actions.find((a) => a.name === selectedAction);
      if (!action) throw new Error("Invalid action");
      const { error } = await supabase.from("behavior_records").insert({
        student_id: behaviorStudentId,
        course_id: selectedCourseId,
        recorded_by: user?.id!,
        action_type: actionType,
        action_name: action.name,
        score_change: action.change,
        notes: behaviorNotes || null,
        week_number: selectedBehaviorWeek,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["behavior-scores"] });
      queryClient.invalidateQueries({ queryKey: ["behavior-history-course"] });
      queryClient.invalidateQueries({ queryKey: ["weekly-behavior-records"] });
      toast.success("Behavior recorded");
      setBehaviorDialogOpen(false);
      setSelectedAction("");
      setBehaviorNotes("");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const handleAddCourse = async () => {
    if (!newCourse.course_code || !newCourse.name) {
      toast.error("Course code and name are required");
      return;
    }
    const { error } = await supabase.from("courses").insert({
      course_code: newCourse.course_code,
      name: newCourse.name,
      description: newCourse.description || null,
      credits: parseInt(newCourse.credits),
      semester: newCourse.semester,
    });
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Course added successfully");
      setNewCourse({ course_code: "", name: "", description: "", credits: "3", semester: "Fall 2024" });
      setAddOpen(false);
      refetch();
    }
  };

  const deleteCourse = useMutation({
    mutationFn: async (courseId: string) => {
      await supabase.from("enrollments").delete().eq("course_id", courseId);
      await supabase.from("attendance_records").delete().eq("course_id", courseId);
      await supabase.from("behavior_records").delete().eq("course_id", courseId);
      const { error } = await supabase.from("courses").delete().eq("id", courseId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["courses"] });
      queryClient.invalidateQueries({ queryKey: ["enrollments"] });
      toast.success("Course deleted successfully");
      setSelectedCourseId(null);
      refetch();
    },
    onError: (err: any) => toast.error(err.message),
  });

  const enrollStudent = useMutation({
    mutationFn: async ({ studentId, courseId }: { studentId: string; courseId: string }) => {
      const { error } = await supabase.from("enrollments").insert({ student_id: studentId, course_id: courseId });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["enrollments"] });
      toast.success("Student enrolled successfully");
      setEnrollDialogOpen(false);
      setStudentToEnroll("");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const unenrollStudent = useMutation({
    mutationFn: async ({ studentId, courseId }: { studentId: string; courseId: string }) => {
      const { error } = await supabase.from("enrollments").delete().eq("student_id", studentId).eq("course_id", courseId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["enrollments"] });
      toast.success("Student unenrolled");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const getUnenrolledStudents = (courseId: string) => {
    const enrolledIds = enrollments.filter((e) => e.course_id === courseId).map((e) => e.student_id);
    return students.filter((s) => !enrolledIds.includes(s.id));
  };

  const getStatusBadge = (status: string | null) => {
    if (!status) return <Badge variant="secondary" className="text-xs">Not Marked</Badge>;
    if (status === "present") return <Badge className="bg-emerald-500/10 text-emerald-500 text-xs">Present</Badge>;
    if (status === "absent") return <Badge className="bg-destructive/10 text-destructive text-xs">Absent</Badge>;
    if (status === "late") return <Badge className="bg-amber-500/10 text-amber-500 text-xs">Late</Badge>;
    return null;
  };

  // Course detail view
  if (selectedCourse) {
    const enrolledStudents = getEnrolledStudents(selectedCourse.id);
    const presentCount = enrolledStudents.filter((s) => getStudentStatus(s.id) === "present").length;
    const absentCount = enrolledStudents.filter((s) => getStudentStatus(s.id) === "absent").length;
    const lateCount = enrolledStudents.filter((s) => getStudentStatus(s.id) === "late").length;

    return (
      <MainLayout title={selectedCourse.name}>
        <div className="space-y-6">
          {/* Enhanced Header */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-primary/10 via-accent/5 to-neon-cyan/10 border border-border/50 p-6"
          >
            <div className="absolute -top-16 -right-16 w-48 h-48 bg-primary/10 rounded-full blur-[60px]" />
            <div className="absolute -bottom-12 -left-12 w-36 h-36 bg-accent/10 rounded-full blur-[50px]" />
            <div className="relative z-10 flex items-center gap-4">
              <Button variant="outline" size="icon" onClick={() => setSelectedCourseId(null)} className="shrink-0 rounded-xl border-border/50 hover:border-primary/40">
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg shadow-primary/25 shrink-0">
                <BookOpen className="w-5 h-5 text-primary-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-xl font-bold text-foreground truncate">{selectedCourse.name}</h2>
                <p className="text-sm text-muted-foreground flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-xs bg-secondary/50 px-2 py-0.5 rounded">{selectedCourse.course_code}</span>
                  <span>•</span>
                  <span>{selectedCourse.credits} credits</span>
                  <span>•</span>
                  <span>{selectedCourse.semester}</span>
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Badge className="bg-primary/10 text-primary border border-primary/20 text-sm px-3 py-1">
                  <Users className="w-3.5 h-3.5 mr-1.5" />{enrolledStudents.length} Students
                </Badge>
                {canManage && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" size="icon" className="rounded-xl border-destructive/30 text-destructive hover:bg-destructive/10">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Course</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to delete <strong>{selectedCourse.name}</strong>? This will also remove all enrollments, attendance records, and behavior records for this course. This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => deleteCourse.mutate(selectedCourse.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
            </div>
          </motion.div>

          {/* ── Student Personal Stats Panel ── */}
          {role === "student" && (() => {
            const att = getMyAttendanceRate(selectedCourse.id);
            const bScore = myBehaviorScore?.score ?? 100;
            const scoreColor = bScore >= 80 ? "#22c55e" : bScore >= 60 ? "#f59e0b" : "#ef4444";
            const attRate = att?.rate ?? 0;
            const attColor = attRate >= 80 ? "text-emerald-400" : attRate >= 60 ? "text-amber-400" : "text-red-400";
            return (
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="grid grid-cols-3 gap-4"
              >
                {/* Attendance Rate */}
                <div className="glass rounded-2xl p-5 border border-border/50 hover:border-primary/30 transition-all">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center">
                      <CheckCircle className="w-4 h-4 text-primary" />
                    </div>
                    <span className="text-xs uppercase tracking-wider text-muted-foreground font-medium">My Attendance</span>
                  </div>
                  {att ? (
                    <>
                      <p className={`text-3xl font-bold tabular-nums ${attColor}`}>{att.rate}<span className="text-lg">%</span></p>
                      <p className="text-xs text-muted-foreground mt-1">{att.present} present / {att.total} sessions</p>
                      <div className="mt-3 h-1.5 rounded-full bg-border/50 overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${att.rate}%` }}
                          transition={{ duration: 1.2, ease: "easeOut", delay: 0.4 }}
                          className={`h-full rounded-full ${att.rate >= 80 ? "bg-emerald-500" : att.rate >= 60 ? "bg-amber-500" : "bg-destructive"}`}
                        />
                      </div>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground mt-1">No records yet</p>
                  )}
                </div>

                {/* Behavior Score */}
                <div className="glass rounded-2xl p-5 border border-border/50 hover:border-primary/30 transition-all">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/15 flex items-center justify-center">
                      <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    </div>
                    <span className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Behavior Score</span>
                  </div>
                  <p className="text-3xl font-bold tabular-nums" style={{ color: scoreColor }}>{bScore}<span className="text-lg text-muted-foreground">/100</span></p>
                  <div className="mt-3 h-1.5 rounded-full bg-border/50 overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${bScore}%` }}
                      transition={{ duration: 1.2, ease: "easeOut", delay: 0.5 }}
                      className={`h-full rounded-full ${bScore >= 80 ? "bg-emerald-500" : bScore >= 60 ? "bg-amber-500" : "bg-destructive"}`}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{bScore >= 80 ? "Excellent" : bScore >= 60 ? "Average" : "Needs improvement"}</p>
                </div>

                {/* Behavior Events */}
                <div className="glass rounded-2xl p-5 border border-border/50 hover:border-primary/30 transition-all">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded-lg bg-amber-500/15 flex items-center justify-center">
                      <Activity className="w-4 h-4 text-amber-400" />
                    </div>
                    <span className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Events This Course</span>
                  </div>
                  <p className="text-3xl font-bold tabular-nums text-foreground">{myCourseBehaviorHistory.length}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {myCourseBehaviorHistory.filter(r => r.action_type === "positive").length} positive ·{" "}
                    {myCourseBehaviorHistory.filter(r => r.action_type === "negative").length} negative
                  </p>
                  {myCourseBehaviorHistory.length > 0 && (
                    <div className="mt-3 space-y-1 max-h-[48px] overflow-hidden">
                      {myCourseBehaviorHistory.slice(0, 2).map((r) => (
                        <div key={r.id} className="flex items-center gap-1.5 text-[10px]">
                          {r.action_type === "positive"
                            ? <TrendingUp className="w-3 h-3 text-emerald-400 shrink-0" />
                            : <TrendingDown className="w-3 h-3 text-red-400 shrink-0" />}
                          <span className="text-muted-foreground truncate">{r.action_name}</span>
                          <span className={`ml-auto font-semibold ${r.score_change > 0 ? "text-emerald-400" : "text-red-400"}`}>
                            {r.score_change > 0 ? "+" : ""}{r.score_change}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })()}

          <Tabs defaultValue="attendance">
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
              <TabsList className="bg-card border border-border/50 p-1 rounded-xl">
                <TabsTrigger value="attendance" className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                  <CheckCircle className="w-3.5 h-3.5 mr-1.5" />Attendance
                </TabsTrigger>
                <TabsTrigger value="behavior" className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                  <TrendingUp className="w-3.5 h-3.5 mr-1.5" />Behavior
                </TabsTrigger>
                {role !== "student" && (
                  <TabsTrigger value="students" className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                    <Users className="w-3.5 h-3.5 mr-1.5" />Students
                  </TabsTrigger>
                )}
                {role === "student" && (
                  <TabsTrigger value="my-history" className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                    <BarChart2 className="w-3.5 h-3.5 mr-1.5" />My History
                  </TabsTrigger>
                )}
                <TabsTrigger value="assignments" className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                  <ClipboardList className="w-3.5 h-3.5 mr-1.5" />Assignments
                </TabsTrigger>
                <TabsTrigger value="materials" className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                  <BookOpen className="w-3.5 h-3.5 mr-1.5" />Materials
                </TabsTrigger>
              </TabsList>
            </motion.div>

            {/* ATTENDANCE TAB */}
            <TabsContent value="attendance" className="mt-6 space-y-6">
              {/* Week selector */}
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }}
                className="bg-card rounded-2xl border border-border/50 p-5">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Select Week</p>
                <div className="flex flex-wrap gap-1.5">
                  {WEEKS.map((w) => (
                    <motion.div key={w} whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}>
                      <Button
                        size="sm"
                        variant={selectedWeek === w ? "default" : "outline"}
                        className={`h-9 w-9 p-0 text-xs rounded-xl font-bold transition-all ${
                          selectedWeek === w
                            ? "bg-gradient-to-br from-primary to-accent shadow-lg shadow-primary/25"
                            : "border-border/50 hover:border-primary/40"
                        }`}
                        onClick={() => setSelectedWeek(w)}
                      >
                        {w}
                      </Button>
                    </motion.div>
                  ))}
                </div>
              </motion.div>

              {/* Summary stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: "Total", value: enrolledStudents.length, gradient: "from-primary/15 to-primary/5", border: "border-primary/20", icon: Users, iconColor: "text-primary" },
                  { label: "Present", value: presentCount, gradient: "from-emerald-500/15 to-emerald-500/5", border: "border-emerald-500/20", icon: CheckCircle, iconColor: "text-emerald-500" },
                  { label: "Absent", value: absentCount, gradient: "from-destructive/15 to-destructive/5", border: "border-destructive/20", icon: XCircle, iconColor: "text-destructive" },
                  { label: "Late", value: lateCount, gradient: "from-amber-500/15 to-amber-500/5", border: "border-amber-500/20", icon: Clock, iconColor: "text-amber-500" },
                ].map((stat, i) => (
                  <motion.div
                    key={stat.label}
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 + i * 0.05 }}
                    className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${stat.gradient} border ${stat.border} p-5`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <stat.icon className={`w-5 h-5 ${stat.iconColor}`} />
                    </div>
                    <p className="text-3xl font-bold text-foreground">{stat.value}</p>
                    <p className="text-xs text-muted-foreground mt-1">{stat.label}</p>
                  </motion.div>
                ))}
              </div>

              {/* Student attendance list */}
              <div className="space-y-2">
                {enrolledStudents.length === 0 ? (
                  <div className="text-center py-16 text-muted-foreground">
                    <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                      <Users className="w-8 h-8 text-primary/50" />
                    </div>
                    <p className="font-medium">No students enrolled</p>
                  </div>
                ) : (
                  enrolledStudents.map((student, i) => {
                    const status = getStudentStatus(student.id);
                    return (
                      <motion.div
                        key={student.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.1 + i * 0.03 }}
                        className={`group flex items-center gap-4 rounded-xl border p-4 transition-all hover:shadow-md ${
                          status === "present"
                            ? "bg-emerald-500/5 border-emerald-500/20"
                            : status === "absent"
                              ? "bg-destructive/5 border-destructive/20"
                              : status === "late"
                                ? "bg-amber-500/5 border-amber-500/20"
                                : "bg-card border-border/50 hover:border-primary/30"
                        }`}
                      >
                        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center shrink-0 overflow-hidden">
                          {student.avatar_url ? (
                            <img src={student.avatar_url} alt={student.full_name} className="w-full h-full rounded-xl object-cover" />
                          ) : (
                            <User className="w-5 h-5 text-primary" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-foreground truncate text-sm">{student.full_name}</p>
                          <p className="text-[11px] text-muted-foreground font-mono">{student.student_code}</p>
                        </div>
                        {getStatusBadge(status)}
                        {canRecord && (
                          <div className="flex items-center gap-1 shrink-0">
                            <Button size="sm" variant={status === "present" ? "default" : "outline"}
                              className={`h-8 px-3 text-xs rounded-lg ${status === "present" ? "bg-emerald-500 hover:bg-emerald-600 shadow-sm" : "border-border/50"}`}
                              onClick={() => markAttendance.mutate({ studentId: student.id, status: "present" })}>
                              <CheckCircle className="w-3.5 h-3.5 mr-1" />Present
                            </Button>
                            <Button size="sm" variant={status === "absent" ? "destructive" : "outline"}
                              className={`h-8 px-3 text-xs rounded-lg ${status !== "absent" ? "border-border/50" : ""}`}
                              onClick={() => markAttendance.mutate({ studentId: student.id, status: "absent" })}>
                              <XCircle className="w-3.5 h-3.5 mr-1" />Absent
                            </Button>
                            <Button size="sm" variant={status === "late" ? "secondary" : "outline"}
                              className={`h-8 px-3 text-xs rounded-lg ${status === "late" ? "bg-amber-500/20 text-amber-500 border-amber-500/30" : "border-border/50"}`}
                              onClick={() => markAttendance.mutate({ studentId: student.id, status: "late" })}>
                              <Clock className="w-3.5 h-3.5 mr-1" />Late
                            </Button>
                            {(status === "absent" || status === "late") && (
                              <SendAttendanceAlert
                                studentId={student.id}
                                studentName={student.full_name}
                                courseName={selectedCourse?.name}
                              />
                            )}
                          </div>
                        )}
                      </motion.div>
                    );
                  })
                )}
              </div>
            </TabsContent>

            {/* BEHAVIOR TAB */}
            <TabsContent value="behavior" className="mt-6 space-y-6">
              {/* Week selector */}
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }}
                className="bg-card rounded-2xl border border-border/50 p-5">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Select Week</p>
                <div className="flex flex-wrap gap-1.5">
                  {WEEKS.map((w) => (
                    <motion.div key={w} whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}>
                      <Button
                        size="sm"
                        variant={selectedBehaviorWeek === w ? "default" : "outline"}
                        className={`h-9 w-9 p-0 text-xs rounded-xl font-bold transition-all ${
                          selectedBehaviorWeek === w
                            ? "bg-gradient-to-br from-accent to-primary shadow-lg shadow-accent/25"
                            : "border-border/50 hover:border-accent/40"
                        }`}
                        onClick={() => setSelectedBehaviorWeek(w)}
                      >
                        {w}
                      </Button>
                    </motion.div>
                  ))}
                </div>
              </motion.div>

              <div className="space-y-3">
                {enrolledStudents.length === 0 ? (
                  <div className="text-center py-16 text-muted-foreground">
                    <div className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto mb-4">
                      <TrendingUp className="w-8 h-8 text-accent/50" />
                    </div>
                    <p className="font-medium">No enrolled students</p>
                  </div>
                ) : (
                  enrolledStudents.map((student, i) => {
                    const score = getWeeklyScore(student.id);
                    const recordCount = getWeeklyRecordCount(student.id);
                    return (
                      <motion.div
                        key={student.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.1 + i * 0.03 }}
                        className="group bg-card rounded-2xl border border-border/50 p-5 hover:border-primary/30 hover:shadow-md transition-all"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center shrink-0 overflow-hidden">
                            {student.avatar_url ? (
                              <img src={student.avatar_url} alt={student.full_name} className="w-full h-full rounded-xl object-cover" />
                            ) : (
                              <User className="w-5 h-5 text-primary" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-semibold text-foreground truncate text-sm">{student.full_name}</p>
                              {recordCount > 0 && (
                                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{recordCount} record{recordCount !== 1 ? "s" : ""}</Badge>
                              )}
                            </div>
                            <p className="text-[11px] text-muted-foreground font-mono">{student.student_code}</p>
                            <div className="flex items-center gap-3 mt-2">
                              <div className="relative h-2.5 flex-1 rounded-full bg-secondary/50 overflow-hidden">
                                <motion.div
                                  initial={{ width: 0 }}
                                  animate={{ width: `${score}%` }}
                                  transition={{ duration: 0.8, ease: "easeOut", delay: 0.2 + i * 0.05 }}
                                  className={`h-full rounded-full ${getProgressColor(score)}`}
                                />
                              </div>
                              <span className={`text-sm font-bold min-w-[3rem] text-right ${getScoreColor(score)}`}>{score}%</span>
                            </div>
                          </div>
                          {canRecord && (
                            <div className="flex gap-1.5 shrink-0">
                              {getScore(student.id) < 60 && (
                                <SendBehaviorAlert
                                  studentId={student.id}
                                  studentName={student.full_name}
                                  score={getScore(student.id)}
                                />
                              )}
                              <Button size="sm" variant="outline" className="h-9 text-xs rounded-xl border-border/50 hover:border-primary/40 hover:bg-primary/10"
                                onClick={() => { setBehaviorStudentId(student.id); setBehaviorDialogOpen(true); }}>
                                <Plus className="w-3.5 h-3.5 mr-1" />Record
                              </Button>
                              <Button size="sm" variant="ghost" className="h-9 text-xs rounded-xl hover:bg-secondary/80"
                                onClick={() => setBehaviorStudentId(behaviorStudentId === student.id ? null : student.id)}>
                                <History className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          )}
                        </div>
                        {/* Inline history */}
                        {behaviorStudentId === student.id && !behaviorDialogOpen && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            transition={{ duration: 0.3 }}
                            className="mt-4 border-t border-border/30 pt-4 space-y-2 max-h-[200px] overflow-y-auto"
                          >
                            {behaviorHistory.length === 0 ? (
                              <p className="text-xs text-muted-foreground text-center py-3">No behavior records for this course</p>
                            ) : (
                              behaviorHistory.map((record) => (
                                <div key={record.id} className={`flex items-start gap-2.5 text-xs p-3 rounded-xl ${
                                  record.action_type === "positive" ? "bg-emerald-500/5 border border-emerald-500/10" : "bg-destructive/5 border border-destructive/10"
                                }`}>
                                  {record.action_type === "positive" ? (
                                    <TrendingUp className="w-3.5 h-3.5 text-emerald-500 mt-0.5 shrink-0" />
                                  ) : (
                                    <TrendingDown className="w-3.5 h-3.5 text-destructive mt-0.5 shrink-0" />
                                  )}
                                  <div>
                                    <p className="font-semibold text-foreground">{record.action_name} <span className={record.score_change > 0 ? "text-emerald-500" : "text-destructive"}>({record.score_change > 0 ? "+" : ""}{record.score_change}%)</span></p>
                                    <p className="text-muted-foreground mt-0.5">{format(new Date(record.created_at), "MMM dd, yyyy HH:mm")}</p>
                                    {record.notes && <p className="text-muted-foreground/80 mt-0.5 italic">{record.notes}</p>}
                                  </div>
                                </div>
                              ))
                            )}
                          </motion.div>
                        )}
                      </motion.div>
                    );
                  })
                )}
              </div>

              {/* Behavior Record Dialog */}
              <Dialog open={behaviorDialogOpen} onOpenChange={setBehaviorDialogOpen}>
                <DialogContent className="rounded-2xl">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                        <TrendingUp className="w-4 h-4 text-primary-foreground" />
                      </div>
                      Record Behavior
                    </DialogTitle>
                    <p className="text-sm text-muted-foreground">{students.find((s) => s.id === behaviorStudentId)?.full_name}</p>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label className="text-xs uppercase tracking-wider">Type</Label>
                      <div className="flex gap-2 mt-2">
                        <Button size="sm" variant={actionType === "negative" ? "destructive" : "outline"}
                          onClick={() => { setActionType("negative"); setSelectedAction(""); }} className="flex-1 rounded-xl h-10">
                          <TrendingDown className="w-4 h-4 mr-1.5" />Negative
                        </Button>
                        <Button size="sm" variant={actionType === "positive" ? "default" : "outline"}
                          onClick={() => { setActionType("positive"); setSelectedAction(""); }} className="flex-1 rounded-xl h-10">
                          <TrendingUp className="w-4 h-4 mr-1.5" />Positive
                        </Button>
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs uppercase tracking-wider">Action</Label>
                      <Select value={selectedAction} onValueChange={setSelectedAction}>
                        <SelectTrigger className="rounded-xl mt-1"><SelectValue placeholder="Select action..." /></SelectTrigger>
                        <SelectContent>
                          {(actionType === "positive" ? positiveActions : negativeActions).map((a) => (
                            <SelectItem key={a.name} value={a.name}>{a.name} ({a.change > 0 ? "+" : ""}{a.change}%)</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs uppercase tracking-wider">Notes (optional)</Label>
                      <Textarea value={behaviorNotes} onChange={(e) => setBehaviorNotes(e.target.value)} placeholder="Add notes..." className="rounded-xl mt-1" />
                    </div>
                    <Button onClick={() => recordBehavior.mutate()} disabled={!selectedAction}
                      className="w-full rounded-xl bg-gradient-to-r from-primary to-accent hover:opacity-90">Submit</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </TabsContent>

            {/* ENROLLED STUDENTS TAB */}
            <TabsContent value="students" className="mt-6 space-y-4">
              {/* Enroll button */}
              {canManage && (
                <div className="flex justify-end">
                  <Dialog open={enrollDialogOpen} onOpenChange={setEnrollDialogOpen}>
                    <DialogTrigger asChild>
                      <Button className="rounded-xl bg-gradient-to-r from-primary to-accent hover:opacity-90">
                        <UserPlus className="w-4 h-4 mr-2" />Enroll Student
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="rounded-2xl">
                      <DialogHeader>
                        <DialogTitle>Enroll Student in {selectedCourse.name}</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div>
                          <Label className="text-xs uppercase tracking-wider">Select Student</Label>
                          <Select value={studentToEnroll} onValueChange={setStudentToEnroll}>
                            <SelectTrigger className="rounded-xl mt-1"><SelectValue placeholder="Choose a student..." /></SelectTrigger>
                            <SelectContent>
                              {getUnenrolledStudents(selectedCourse.id).map((s) => (
                                <SelectItem key={s.id} value={s.id}>{s.full_name} ({s.student_code})</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <Button
                          onClick={() => enrollStudent.mutate({ studentId: studentToEnroll, courseId: selectedCourse.id })}
                          disabled={!studentToEnroll}
                          className="w-full rounded-xl bg-gradient-to-r from-primary to-accent hover:opacity-90"
                        >
                          Enroll
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              )}

              <div className="space-y-3">
                {enrolledStudents.length === 0 ? (
                  <div className="text-center py-16 text-muted-foreground">
                    <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                      <Users className="w-8 h-8 text-primary/50" />
                    </div>
                    <p className="font-medium">No students enrolled in this course</p>
                  </div>
                ) : (
                  enrolledStudents.map((student, i) => (
                    <motion.div
                      key={student.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.05 + i * 0.03 }}
                      className="flex items-center gap-4 bg-card rounded-2xl border border-border/50 p-5 hover:border-primary/30 hover:shadow-md transition-all group"
                    >
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center shrink-0 overflow-hidden group-hover:shadow-lg transition-shadow">
                        {student.avatar_url ? (
                          <img src={student.avatar_url} alt={student.full_name} className="w-full h-full rounded-xl object-cover" />
                        ) : (
                          <User className="w-5 h-5 text-primary" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-foreground truncate">{student.full_name}</p>
                        <p className="text-xs text-muted-foreground">
                          <span className="font-mono">{student.student_code}</span> • Year {student.year_level}
                        </p>
                        {student.email && <p className="text-xs text-muted-foreground/70 mt-0.5">{student.email}</p>}
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={student.status === "active" ? "default" : "secondary"}
                          className={student.status === "active"
                            ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                            : ""}
                        >
                          {student.status}
                        </Badge>
                        {canManage && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10 h-8 rounded-lg text-xs">
                                <XCircle className="w-3.5 h-3.5 mr-1" />Remove
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Remove Student</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Remove <strong>{student.full_name}</strong> from <strong>{selectedCourse.name}</strong>?
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => unenrollStudent.mutate({ studentId: student.id, courseId: selectedCourse.id })} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                  Remove
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </div>
                    </motion.div>
                  ))
                )}
              </div>
            </TabsContent>

            {/* MY HISTORY TAB (student only) */}
            {role === "student" && (
              <TabsContent value="my-history" className="mt-6">
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-3"
                >
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                      <BarChart2 className="w-4 h-4 text-primary" />
                      My Behavior Timeline
                    </h3>
                    <span className="text-xs text-muted-foreground bg-secondary/50 px-2 py-1 rounded-lg">
                      {myCourseBehaviorHistory.length} record{myCourseBehaviorHistory.length !== 1 ? "s" : ""}
                    </span>
                  </div>

                  {myCourseBehaviorHistory.length === 0 ? (
                    <div className="text-center py-16 text-muted-foreground">
                      <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                        <Activity className="w-8 h-8 text-primary/40" />
                      </div>
                      <p className="font-medium">No behavior records yet</p>
                      <p className="text-sm text-muted-foreground/60 mt-1">Your behavior events for this course will appear here</p>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {myCourseBehaviorHistory.map((record, i) => (
                        <motion.div
                          key={record.id}
                          initial={{ opacity: 0, x: -12 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.04 }}
                          className={`flex items-start gap-3 p-4 rounded-xl border transition-all ${
                            record.action_type === "positive"
                              ? "bg-emerald-500/5 border-emerald-500/15 hover:border-emerald-500/30"
                              : "bg-red-500/5 border-red-500/15 hover:border-red-500/30"
                          }`}
                        >
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                            record.action_type === "positive" ? "bg-emerald-500/15" : "bg-red-500/15"
                          }`}>
                            {record.action_type === "positive"
                              ? <TrendingUp className="w-4 h-4 text-emerald-400" />
                              : <TrendingDown className="w-4 h-4 text-red-400" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-semibold text-sm text-foreground">{record.action_name}</p>
                              <span className={`text-xs font-bold px-2 py-0.5 rounded-lg ${
                                record.score_change > 0
                                  ? "bg-emerald-500/15 text-emerald-400"
                                  : "bg-red-500/15 text-red-400"
                              }`}>
                                {record.score_change > 0 ? "+" : ""}{record.score_change} pts
                              </span>
                              <span className="text-[10px] text-muted-foreground bg-secondary/40 px-1.5 py-0.5 rounded">
                                Week {record.week_number}
                              </span>
                            </div>
                            <p className="text-[11px] text-muted-foreground mt-1">
                              {format(new Date(record.created_at), "MMM dd, yyyy · HH:mm")}
                            </p>
                            {record.notes && (
                              <p className="text-xs text-muted-foreground/80 mt-1.5 italic border-l-2 border-border/50 pl-2">
                                {record.notes}
                              </p>
                            )}
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </motion.div>
              </TabsContent>
            )}
          {/* ASSIGNMENTS TAB */}
          <TabsContent value="assignments" className="mt-6">
            <div className="space-y-3">
              {/* Header */}
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-bold text-white/50 uppercase tracking-widest">Course Assignments</p>
                {canAddAssignment && <CreateAssignmentDialog courseId={selectedCourse.id} doctorId={user?.id ?? ""} />}
              </div>

              {courseAssignments.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 rounded-2xl border border-white/[0.07]"
                  style={{ background: "hsl(225 25% 8%)" }}>
                  <ClipboardList className="w-10 h-10 text-white/10 mb-3" />
                  <p className="text-sm font-bold text-white/30">No assignments yet</p>
                  {canAddAssignment && <p className="text-xs text-white/20 mt-1">Click the button above to create one</p>}
                </div>
              ) : courseAssignments.map((assignment: any, i: number) => {
                const ds = deadlineBadge(assignment.due_date);
                const attachments = parseAttachments(assignment.description);
                const desc = cleanDesc(assignment.description);
                const isExpanded = expandedAssignments.has(assignment.id);

                // ── DOCTOR / ADMIN VIEW ──────────────────────────────────
                if (canAddAssignment) {
                  const assignSubs = allSubmissions.filter((s: any) => s.assignment_id === assignment.id);
                  const submittedCount = assignSubs.length;
                  const gradedCount = assignSubs.filter((s: any) => s.status === "graded").length;
                  const totalStudents = courseStudents.length;

                  return (
                    <motion.div key={assignment.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                      className="rounded-2xl border border-white/[0.07] overflow-hidden"
                      style={{ background: "hsl(225 25% 8%)" }}>

                      {/* Assignment header row */}
                      <div className="p-4">
                        <div className="flex items-start gap-3">
                          <ClipboardList className="w-4 h-4 text-violet-400 flex-shrink-0 mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="text-sm font-black text-white">{assignment.title}</h4>
                              {assignment.rubric && (
                                <span className="text-[9px] px-1.5 py-0.5 rounded font-bold"
                                  style={{ background: "hsl(263 70% 58% / 0.15)", color: "hsl(263 70% 68%)", border: "1px solid hsl(263 70% 58% / 0.2)" }}>
                                  Rubric
                                </span>
                              )}
                            </div>
                            {desc && <p className="text-xs text-white/45 mt-0.5 line-clamp-2">{desc}</p>}
                            {attachments.length > 0 && (
                              <div className="flex flex-wrap gap-1.5 mt-2">
                                {attachments.map((att, idx) => (
                                  <a key={idx} href={att.url} download={att.name} target="_blank" rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold hover:opacity-80 transition-all"
                                    style={{ background: "hsl(217 91% 60% / 0.12)", color: "hsl(217 91% 60%)", border: "1px solid hsl(217 91% 60% / 0.25)" }}>
                                    <Download className="w-2.5 h-2.5" />{att.name}
                                  </a>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Edit + Delete actions */}
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <button
                              onClick={() => { setEditAssignment(assignment); setEditForm({ title: assignment.title, description: cleanDesc(assignment.description) ?? "", max_score: String(assignment.max_score), due_date: assignment.due_date ? assignment.due_date.slice(0, 16) : "" }); }}
                              className="w-7 h-7 rounded-lg flex items-center justify-center transition-all hover:bg-white/10"
                              title="Edit assignment">
                              <Pencil className="w-3.5 h-3.5 text-white/40" />
                            </button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <button className="w-7 h-7 rounded-lg flex items-center justify-center transition-all hover:bg-red-500/10" title="Delete assignment">
                                  <Trash2 className="w-3.5 h-3.5 text-red-400/60" />
                                </button>
                              </AlertDialogTrigger>
                              <AlertDialogContent className="glass">
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Assignment?</AlertDialogTitle>
                                  <AlertDialogDescription>This will permanently delete "{assignment.title}" and all its submissions. This cannot be undone.</AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction className="bg-red-500 hover:bg-red-600" onClick={() => handleDeleteAssignment(assignment.id)}>Delete</AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </div>

                        {/* Meta row */}
                        <div className="flex items-center gap-2 flex-wrap mt-3">
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
                          <span className="ml-auto text-[10px] text-white/40">
                            {gradedCount} graded · {submittedCount}/{totalStudents} submitted
                          </span>
                        </div>

                        {/* Expand/collapse submissions */}
                        <button
                          onClick={() => toggleAssignmentExpand(assignment.id)}
                          className="mt-3 w-full flex items-center justify-center gap-1.5 py-1.5 rounded-xl text-[11px] font-bold transition-all hover:bg-white/5"
                          style={{ color: "hsl(217 91% 60%)", border: "1px solid hsl(217 91% 60% / 0.15)" }}>
                          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                          {isExpanded ? "Hide" : "View"} Student Submissions ({submittedCount})
                        </button>
                      </div>

                      {/* Submissions list */}
                      {isExpanded && (
                        <div className="border-t border-white/[0.07]" style={{ background: "hsl(225 25% 6%)" }}>
                          {courseStudents.length === 0 ? (
                            <p className="text-xs text-white/30 text-center py-6">No students enrolled</p>
                          ) : courseStudents.map((student: any, si: number) => {
                            const sub = assignSubs.find((s: any) => s.student_id === student.id);
                            const isLateSubmit = sub && assignment.due_date && new Date(sub.submitted_at) > new Date(assignment.due_date);
                            const isGraded = sub?.status === "graded";

                            return (
                              <div key={student.id}
                                className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.04] last:border-0">
                                {/* Avatar */}
                                <div className="w-8 h-8 rounded-xl flex items-center justify-center text-[11px] font-black flex-shrink-0"
                                  style={{ background: "hsl(217 91% 60% / 0.12)", color: "hsl(217 91% 60%)" }}>
                                  {student.full_name?.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()}
                                </div>

                                {/* Name + code */}
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-bold text-white truncate">{student.full_name}</p>
                                  <p className="text-[10px] text-white/30 font-mono">{student.student_code}</p>
                                </div>

                                {/* Status badge */}
                                {!sub ? (
                                  <span className="text-[10px] px-2 py-0.5 rounded-lg font-semibold"
                                    style={{ background: "#64748b15", color: "#94a3b8", border: "1px solid #64748b28" }}>
                                    Not Submitted
                                  </span>
                                ) : isGraded ? (
                                  <span className="text-[10px] px-2 py-0.5 rounded-lg font-bold"
                                    style={{ background: "#22c55e15", color: "#22c55e", border: "1px solid #22c55e28" }}>
                                    ✓ {sub.doctor_grade}/{assignment.max_score}
                                  </span>
                                ) : isLateSubmit ? (
                                  <span className="text-[10px] px-2 py-0.5 rounded-lg font-bold"
                                    style={{ background: "#ef444415", color: "#ef4444", border: "1px solid #ef444428" }}>
                                    ⚠ Late
                                  </span>
                                ) : (
                                  <span className="text-[10px] px-2 py-0.5 rounded-lg font-bold"
                                    style={{ background: "#3b82f615", color: "#60a5fa", border: "1px solid #3b82f628" }}>
                                    ✓ Submitted
                                  </span>
                                )}

                                {/* Action buttons — only if submitted */}
                                {sub && (
                                  <div className="flex items-center gap-1.5 flex-shrink-0">
                                    {/* Grade button */}
                                    <button
                                      onClick={() => setGradeTarget({ submission: sub, assignment, student, initialTab: "submission" })}
                                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all hover:opacity-80"
                                      style={{ background: "hsl(217 91% 60% / 0.15)", color: "hsl(217 91% 60%)", border: "1px solid hsl(217 91% 60% / 0.3)" }}>
                                      <Star className="w-3 h-3" /> Grade
                                    </button>
                                    {/* AI Detect button */}
                                    <button
                                      onClick={() => setGradeTarget({ submission: sub, assignment, student, initialTab: "ai" })}
                                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all hover:opacity-80"
                                      style={{ background: "#fb923c15", color: "#fb923c", border: "1px solid #fb923c30" }}>
                                      <Bot className="w-3 h-3" /> AI Detect
                                    </button>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </motion.div>
                  );
                }

                // ── STUDENT VIEW ─────────────────────────────────────────
                const mySub = mySubmissions.find((s: any) => s.assignment_id === assignment.id);
                const isGraded = mySub?.status === "graded";
                return (
                  <motion.div key={assignment.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                    className="rounded-2xl border border-white/[0.07] p-4"
                    style={{ background: "hsl(225 25% 8%)" }}>
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <ClipboardList className="w-3.5 h-3.5 text-violet-400 flex-shrink-0" />
                          <h4 className="text-sm font-black text-white truncate">{assignment.title}</h4>
                        </div>
                        {desc && <p className="text-xs text-white/45 line-clamp-2">{desc}</p>}
                        {attachments.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {attachments.map((att, idx) => (
                              <a key={idx} href={att.url} download={att.name} target="_blank" rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold transition-all hover:opacity-80"
                                style={{ background: "hsl(217 91% 60% / 0.12)", color: "hsl(217 91% 60%)", border: "1px solid hsl(217 91% 60% / 0.25)" }}>
                                <Download className="w-2.5 h-2.5" />{att.name}
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                      {myStudentRecord?.id && (
                        <SubmitAssignmentDialog assignment={assignment} studentId={myStudentRecord.id}
                          alreadySubmitted={!!mySub} existingContent={mySub?.content ?? undefined} existingSubmissionId={mySub?.id} />
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap mt-1">
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
                      {mySub && (
                        <span className="text-[9px] font-bold px-2 py-0.5 rounded-lg"
                          style={{ background: isGraded ? "#22c55e15" : "#3b82f615", color: isGraded ? "#22c55e" : "#60a5fa", border: `1px solid ${isGraded ? "#22c55e28" : "#3b82f628"}` }}>
                          {isGraded ? "Graded" : "Submitted"}
                        </span>
                      )}
                    </div>
                    {isGraded && mySub && (
                      <div className="mt-3 pt-3 border-t border-white/[0.06] space-y-2">
                        <div className="flex items-center gap-3">
                          <Star className="w-3.5 h-3.5 text-amber-400" />
                          <span className="text-sm font-black"
                            style={{ color: (mySub.doctor_grade / assignment.max_score) >= 0.8 ? "#22c55e" : (mySub.doctor_grade / assignment.max_score) >= 0.6 ? "#f59e0b" : "#ef4444" }}>
                            {mySub.doctor_grade}/{assignment.max_score}
                          </span>
                          <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "hsl(225 20% 14%)" }}>
                            <div className="h-full rounded-full" style={{ width: `${(mySub.doctor_grade / assignment.max_score) * 100}%`, background: "#22c55e" }} />
                          </div>
                        </div>
                        {mySub.doctor_feedback && (
                          <div className="p-3 rounded-xl border border-white/[0.05]" style={{ background: "hsl(225 25% 6%)" }}>
                            <div className="flex items-center gap-1.5 mb-1">
                              <MessageSquare className="w-3 h-3 text-primary" />
                              <span className="text-[10px] font-bold text-white/40 uppercase tracking-wider">Doctor's Feedback</span>
                            </div>
                            <p className="text-xs text-white/60 leading-relaxed">{mySub.doctor_feedback}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </div>
          </TabsContent>

          {/* MATERIALS TAB */}
          <TabsContent value="materials" className="mt-6">
            <CourseMaterialsTab
              courseId={selectedCourse.id}
              doctorId={user?.id}
              isDoctor={canAddAssignment}
            />
          </TabsContent>

          {/* Edit Assignment Dialog */}
          <Dialog open={!!editAssignment} onOpenChange={(v) => !v && setEditAssignment(null)}>
            <DialogContent className="glass max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2"><Pencil className="w-4 h-4 text-primary" /> Edit Assignment</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-2">
                <div>
                  <Label className="text-xs mb-1.5 block">Title</Label>
                  <Input value={editForm.title} onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))} className="rounded-xl" />
                </div>
                <div>
                  <Label className="text-xs mb-1.5 block">Description</Label>
                  <Textarea value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} className="rounded-xl resize-none" rows={3} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs mb-1.5 block">Max Score</Label>
                    <Input type="number" value={editForm.max_score} onChange={e => setEditForm(f => ({ ...f, max_score: e.target.value }))} className="rounded-xl" />
                  </div>
                  <div>
                    <Label className="text-xs mb-1.5 block">Due Date & Time</Label>
                    <Input type="datetime-local" value={editForm.due_date} onChange={e => setEditForm(f => ({ ...f, due_date: e.target.value }))} className="rounded-xl text-xs" />
                  </div>
                </div>
                <Button onClick={handleEditAssignment} className="w-full rounded-xl gap-2"
                  style={{ background: "linear-gradient(135deg, hsl(217 91% 60%), hsl(263 70% 58%))" }}>
                  <CheckCircle2 className="w-4 h-4" /> Save Changes
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* Grade Submission Dialog */}
          {gradeTarget && (
            <GradeSubmissionDialog
              open={!!gradeTarget}
              onClose={() => { setGradeTarget(null); refetchAllSubmissions(); }}
              submission={gradeTarget.submission}
              assignment={gradeTarget.assignment}
              student={gradeTarget.student}
              initialTab={gradeTarget.initialTab}
            />
          )}

          </Tabs>
        </div>
      </MainLayout>
    );
  }

  const cardGradients = [
    "from-primary/20 via-primary/5 to-transparent",
    "from-accent/20 via-accent/5 to-transparent",
    "from-neon-cyan/20 via-neon-cyan/5 to-transparent",
    "from-emerald-500/20 via-emerald-500/5 to-transparent",
    "from-amber-500/20 via-amber-500/5 to-transparent",
    "from-rose-500/20 via-rose-500/5 to-transparent",
  ];

  const iconBgs = [
    "from-primary to-primary/60",
    "from-accent to-accent/60",
    "from-neon-cyan to-neon-cyan/60",
    "from-emerald-500 to-emerald-600",
    "from-amber-500 to-amber-600",
    "from-rose-500 to-rose-600",
  ];

  // Course list view
  return (
    <MainLayout title="Courses">
      <div className="space-y-8">
        {/* Hero header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-primary/10 via-accent/10 to-neon-cyan/10 border border-border/50 p-8"
        >
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/4" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-accent/10 rounded-full blur-[60px] translate-y-1/2 -translate-x-1/4" />
          <div className="relative z-10 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-5 h-5 text-primary" />
                <span className="text-xs font-semibold uppercase tracking-widest text-primary">
                  {role === "student" ? "My Learning" : "Course Management"}
                </span>
              </div>
              <h1 className="text-2xl font-bold text-foreground mb-1">
                {role === "student" ? "My Enrolled Courses" : "Your Courses"}
              </h1>
              <p className="text-sm text-muted-foreground">
                {role === "student"
                  ? `${courses.length} course${courses.length !== 1 ? "s" : ""} enrolled · Behavior score: ${myBehaviorScore?.score ?? 100}/100`
                  : `${courses.length} course${courses.length !== 1 ? "s" : ""} • ${enrollments.length} total enrollment${enrollments.length !== 1 ? "s" : ""}`}
              </p>
              {role === "student" && myBehaviorScore && (
                <div className="flex items-center gap-3 mt-3">
                  <div className="h-1.5 w-32 rounded-full bg-white/10 overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${myBehaviorScore.score}%` }}
                      transition={{ duration: 1.4, ease: "easeOut", delay: 0.3 }}
                      className={`h-full rounded-full ${myBehaviorScore.score >= 80 ? "bg-emerald-400" : myBehaviorScore.score >= 60 ? "bg-amber-400" : "bg-red-400"}`}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground">Overall behavior</span>
                </div>
              )}
            </div>
            {canManage && (
              <Dialog open={addOpen} onOpenChange={setAddOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-gradient-to-r from-primary to-accent hover:opacity-90 shadow-lg shadow-primary/25">
                    <Plus className="w-4 h-4 mr-2" />Add Course
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Add New Course</DialogTitle></DialogHeader>
                  <div className="space-y-3">
                    <div><Label>Course Code *</Label><Input value={newCourse.course_code} onChange={(e) => setNewCourse({ ...newCourse, course_code: e.target.value })} placeholder="e.g. CS101" /></div>
                    <div><Label>Name *</Label><Input value={newCourse.name} onChange={(e) => setNewCourse({ ...newCourse, name: e.target.value })} /></div>
                    <div><Label>Description</Label><Input value={newCourse.description} onChange={(e) => setNewCourse({ ...newCourse, description: e.target.value })} /></div>
                    <div><Label>Credits</Label>
                      <Select value={newCourse.credits} onValueChange={(v) => setNewCourse({ ...newCourse, credits: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {[1, 2, 3, 4, 5].map((c) => <SelectItem key={c} value={String(c)}>{c} Credits</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div><Label>Semester</Label><Input value={newCourse.semester} onChange={(e) => setNewCourse({ ...newCourse, semester: e.target.value })} /></div>
                    <Button onClick={handleAddCourse} className="w-full">Add Course</Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </motion.div>

        {/* Search */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="relative"
        >
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search courses by name or code..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-11 h-12 rounded-xl bg-card border-border/50 text-base"
          />
        </motion.div>

        {filteredCourses.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-20"
          >
            <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <GraduationCap className="w-10 h-10 text-primary/50" />
            </div>
            <p className="text-lg font-medium text-muted-foreground">No courses found</p>
            <p className="text-sm text-muted-foreground/70 mt-1">{canManage && "Add your first course to get started."}</p>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredCourses.map((course, index) => {
              const enrolled = getEnrolledStudents(course.id).length;
              const gradientIdx = index % cardGradients.length;
              return (
                <motion.div
                  key={course.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05, duration: 0.4 }}
                  whileHover={{ y: -4, transition: { duration: 0.2 } }}
                  onClick={() => setSelectedCourseId(course.id)}
                  className="group relative p-6 rounded-2xl cursor-pointer transition-all bg-card border border-border/50 hover:border-primary/40 hover:shadow-xl hover:shadow-primary/10 overflow-hidden"
                >
                  {/* Gradient overlay */}
                  <div className={`absolute inset-0 bg-gradient-to-br ${cardGradients[gradientIdx]} opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
                  
                  {/* Decorative corner glow */}
                  <div className="absolute -top-12 -right-12 w-32 h-32 bg-primary/5 rounded-full blur-2xl group-hover:bg-primary/15 transition-all duration-500" />

                  <div className="relative z-10">
                    {/* Icon & status */}
                    <div className="flex items-start justify-between mb-4">
                      <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${iconBgs[gradientIdx]} flex items-center justify-center shadow-lg`}>
                        <BookOpen className="w-5 h-5 text-primary-foreground" />
                      </div>
                      <Badge
                        variant="secondary"
                        className={`text-[10px] uppercase tracking-wider font-bold ${
                          course.status === "active"
                            ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {course.status}
                      </Badge>
                    </div>

                    {/* Course info */}
                    <h3 className="font-bold text-foreground text-lg mb-1 group-hover:text-primary transition-colors truncate">
                      {course.name}
                    </h3>
                    <p className="text-xs font-mono text-muted-foreground mb-4">{course.course_code}</p>

                    {course.description && (
                      <p className="text-xs text-muted-foreground/80 line-clamp-2 mb-4">{course.description}</p>
                    )}

                    {/* Stats row */}
                    <div className="flex items-center gap-4 pt-4 border-t border-border/50">
                      {role !== "student" && (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Users className="w-3.5 h-3.5" />
                          <span className="font-semibold text-foreground">{enrolled}</span> students
                        </div>
                      )}
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Award className="w-3.5 h-3.5" />
                        <span className="font-semibold text-foreground">{course.credits}</span> credits
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground ml-auto">
                        <Calendar className="w-3.5 h-3.5" />
                        {course.semester}
                      </div>
                    </div>

                    {/* Student-specific progress section */}
                    {role === "student" && (() => {
                      const att = getMyAttendanceRate(course.id);
                      const bScore = myBehaviorScore?.score ?? 100;
                      const attColor = att ? (att.rate >= 80 ? "bg-emerald-500" : att.rate >= 60 ? "bg-amber-500" : "bg-destructive") : "bg-muted";
                      const attText  = att ? (att.rate >= 80 ? "text-emerald-400" : att.rate >= 60 ? "text-amber-400" : "text-red-400") : "text-muted-foreground";
                      const bColor   = bScore >= 80 ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/25" : bScore >= 60 ? "text-amber-400 bg-amber-500/10 border-amber-500/25" : "text-red-400 bg-red-500/10 border-red-500/25";
                      return (
                        <div className="mt-4 pt-4 border-t border-border/30 space-y-3">
                          {/* Attendance bar */}
                          <div>
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium flex items-center gap-1">
                                <CheckCircle className="w-3 h-3" />Attendance
                              </span>
                              <span className={`text-xs font-bold ${attText}`}>
                                {att ? `${att.rate}% (${att.present}/${att.total})` : "No records yet"}
                              </span>
                            </div>
                            <div className="h-1.5 rounded-full bg-border/50 overflow-hidden">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: att ? `${att.rate}%` : "0%" }}
                                transition={{ duration: 1, ease: "easeOut", delay: 0.3 + index * 0.05 }}
                                className={`h-full rounded-full ${attColor}`}
                              />
                            </div>
                          </div>
                          {/* Behavior score badge */}
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium flex items-center gap-1">
                              <ShieldCheck className="w-3 h-3" />Behavior Score
                            </span>
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-lg border ${bColor}`}>
                              {bScore}/100
                            </span>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </MainLayout>
  );
};

export default Courses;
