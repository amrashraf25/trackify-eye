import MainLayout from "@/components/layout/MainLayout";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Search, BookOpen, Users, Plus, GraduationCap, CheckCircle, XCircle, Clock, User, TrendingDown, TrendingUp, History, ChevronLeft, Sparkles, Calendar, Award, Trash2, UserPlus } from "lucide-react";
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
import { format } from "date-fns";
import SendBehaviorAlert from "@/components/SendBehaviorAlert";
import SendAttendanceAlert from "@/components/SendAttendanceAlert";

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

  // For students, first get their student record
  const { data: myStudentRecord } = useQuery({
    queryKey: ["my-student-record", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("students").select("id").eq("user_id", user?.id).single();
      if (error) return null;
      return data;
    },
    enabled: !!user?.id && role === "student",
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

  // Fetch all behavior records for the selected week + course (for all students)
  const { data: weeklyBehaviorRecords = [] } = useQuery({
    queryKey: ["weekly-behavior-records", selectedCourseId, selectedBehaviorWeek],
    queryFn: async () => {
      if (!selectedCourseId) return [];
      const { data, error } = await supabase
        .from("behavior_records")
        .select("*")
        .eq("course_id", selectedCourseId)
        .eq("week_number", selectedBehaviorWeek)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!selectedCourseId,
  });

  const { data: behaviorHistory = [] } = useQuery({
    queryKey: ["behavior-history-course", selectedCourseId, behaviorStudentId, selectedBehaviorWeek],
    queryFn: async () => {
      if (!behaviorStudentId || !selectedCourseId) return [];
      const { data, error } = await supabase
        .from("behavior_records")
        .select("*")
        .eq("student_id", behaviorStudentId)
        .eq("course_id", selectedCourseId)
        .eq("week_number", selectedBehaviorWeek)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
    enabled: !!behaviorStudentId && !!selectedCourseId,
  });

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

          <Tabs defaultValue="attendance">
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
              <TabsList className="bg-card border border-border/50 p-1 rounded-xl">
                <TabsTrigger value="attendance" className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                  <CheckCircle className="w-3.5 h-3.5 mr-1.5" />Attendance
                </TabsTrigger>
                <TabsTrigger value="behavior" className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                  <TrendingUp className="w-3.5 h-3.5 mr-1.5" />Behavior
                </TabsTrigger>
                <TabsTrigger value="students" className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                  <Users className="w-3.5 h-3.5 mr-1.5" />Students
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
                <span className="text-xs font-semibold uppercase tracking-widest text-primary">Course Management</span>
              </div>
              <h1 className="text-2xl font-bold text-foreground mb-1">Your Courses</h1>
              <p className="text-sm text-muted-foreground">
                {courses.length} course{courses.length !== 1 ? "s" : ""} • {enrollments.length} total enrollment{enrollments.length !== 1 ? "s" : ""}
              </p>
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
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Users className="w-3.5 h-3.5" />
                        <span className="font-semibold text-foreground">{enrolled}</span> students
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Award className="w-3.5 h-3.5" />
                        <span className="font-semibold text-foreground">{course.credits}</span> credits
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground ml-auto">
                        <Calendar className="w-3.5 h-3.5" />
                        {course.semester}
                      </div>
                    </div>
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
