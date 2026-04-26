import MainLayout from "@/components/layout/MainLayout";
import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Search, User, BookOpen, Plus, Upload, Lock, Mail, Phone, Hash, Trash2, Calendar, ChevronLeft, ChevronRight, XCircle, UserPlus, Pencil, RotateCcw, GraduationCap, Shield, TrendingUp, TrendingDown, Sparkles, Activity, Download } from "lucide-react";
import { exportToCsv } from "@/lib/csv";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { Users } from "lucide-react";
import { motion } from "framer-motion";

const WEEKS = Array.from({ length: 16 }, (_, i) => i + 1);

const API_URL = (import.meta.env.VITE_SUPABASE_URL as string) || 'http://localhost:3001';

async function uploadPhoto(file: File, fileName: string): Promise<string> {
  const formData = new FormData();
  formData.append('file', file, fileName);
  const encodedName = fileName.split('/').map(encodeURIComponent).join('/');
  const res = await fetch(`${API_URL}/storage/v1/object/avatars/${encodedName}`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => res.statusText);
    throw new Error(`Photo upload failed: ${txt}`);
  }
  return `${API_URL}/storage/v1/object/public/avatars/${encodedName}`;
}

const Students = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [newStudent, setNewStudent] = useState({
    full_name: "", email: "", student_code: "", year_level: "1", phone: "", password: ""
  });
  const { role, user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedBehaviorWeek, setSelectedBehaviorWeek] = useState<number | "all">("all");
  const [selectedBehaviorCourse, setSelectedBehaviorCourse] = useState<string>("all");
  const [editOpen, setEditOpen] = useState(false);
  const [editData, setEditData] = useState({
    full_name: "", student_code: "", email: "", phone: "", year_level: "1", status: "active"
  });
  const editFileInputRef = useRef<HTMLInputElement>(null);
  const [editAvatarFile, setEditAvatarFile] = useState<File | null>(null);
  const [editAvatarPreview, setEditAvatarPreview] = useState<string | null>(null);

  const { data: students = [], refetch } = useQuery({
    queryKey: ["students"],
    queryFn: async () => {
      const { data, error } = await supabase.from("students").select("*").order("full_name");
      if (error) throw error;
      return data;
    },
  });

  const { data: enrollments = [] } = useQuery({
    queryKey: ["student-enrollments"],
    queryFn: async () => {
      const { data, error } = await supabase.from("enrollments").select("*");
      if (error) throw error;
      return data;
    },
  });

  const { data: courses = [] } = useQuery({
    queryKey: ["student-courses"],
    queryFn: async () => {
      const { data, error } = await supabase.from("courses").select("*");
      if (error) throw error;
      return data;
    },
  });

  // For doctors: only their course IDs
  const doctorCourseIds = role === "doctor"
    ? courses.filter((c: any) => c.doctor_id === user?.id).map((c: any) => c.id)
    : null;

  // Student IDs enrolled in doctor's courses
  const doctorStudentIds = doctorCourseIds
    ? new Set(enrollments.filter((e: any) => doctorCourseIds.includes(e.course_id)).map((e: any) => e.student_id))
    : null;

  const { data: behaviorScores = [] } = useQuery({
    queryKey: ["student-behavior-scores"],
    queryFn: async () => {
      const { data, error } = await supabase.from("behavior_scores").select("*");
      if (error) throw error;
      return data;
    },
    staleTime: 0,
    refetchInterval: 5000,
  });

  const severityToChange = (sev: string) =>
    sev === "critical" ? -20 : sev === "high" ? -10 : sev === "medium" ? -5 : -2;

  const { data: behaviorRecords = [] } = useQuery({
    queryKey: ["student-behavior-records"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("behavior_logs")
        .select("*")
        .order("started_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((r: any) => ({
        ...r,
        score_change: severityToChange(r.severity),
        week_number: r.week_number ?? 1,
        course_id: r.course_id,
        student_id: r.student_id,
        created_at: r.started_at,
      }));
    },
    staleTime: 0,
    refetchInterval: 5000,
  });

  const filteredStudents = students.filter((s) => {
    if (doctorStudentIds && !doctorStudentIds.has(s.id)) return false;
    return (
      s.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.student_code.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  const selectedStudent = students.find((s) => s.id === selectedStudentId) || filteredStudents[0];

  const getStudentCourses = (studentId: string) => {
    const courseIds = enrollments.filter((e) => e.student_id === studentId).map((e) => e.course_id);
    return courses.filter((c) => courseIds.includes(c.id));
  };

  // Score for a single course (or 100 if no records)
  const getCourseScore = (studentId: string, courseId: string) => {
    const records = behaviorRecords.filter(
      (r) => r.student_id === studentId && r.course_id === courseId
    );
    if (records.length === 0) return 100;
    const total = records.reduce((sum, r) => sum + r.score_change, 0);
    return Math.max(0, Math.min(100, 100 + total));
  };

  // Overall score = average of per-course scores across all enrolled courses.
  // If a specific courseId is given, return that course's score only.
  const getOverallScore = (studentId: string, courseId?: string) => {
    if (courseId && courseId !== "all") {
      return getCourseScore(studentId, courseId);
    }
    const studentCourseIds = enrollments
      .filter((e: any) => e.student_id === studentId)
      .map((e: any) => e.course_id);
    if (studentCourseIds.length === 0) {
      // No enrollments — fall back to global sum
      const records = behaviorRecords.filter((r) => r.student_id === studentId);
      if (records.length === 0) return 100;
      const total = records.reduce((sum, r) => sum + r.score_change, 0);
      return Math.max(0, Math.min(100, 100 + total));
    }
    const scores = studentCourseIds.map((cid: string) => getCourseScore(studentId, cid));
    return Math.round(scores.reduce((sum: number, s: number) => sum + s, 0) / scores.length);
  };

  const getWeeklyScore = (studentId: string, week: number, courseId?: string) => {
    let records = behaviorRecords.filter((r) => r.student_id === studentId && r.week_number === week);
    if (courseId && courseId !== "all") {
      records = records.filter((r) => r.course_id === courseId);
      if (records.length === 0) return 100;
      const total = records.reduce((sum, r) => sum + r.score_change, 0);
      return Math.max(0, Math.min(100, 100 + total));
    }
    // Average weekly score across enrolled courses
    const studentCourseIds = enrollments
      .filter((e: any) => e.student_id === studentId)
      .map((e: any) => e.course_id);
    if (studentCourseIds.length === 0) {
      if (records.length === 0) return 100;
      const total = records.reduce((sum, r) => sum + r.score_change, 0);
      return Math.max(0, Math.min(100, 100 + total));
    }
    const scores = studentCourseIds.map((cid: string) => {
      const cr = records.filter((r) => r.course_id === cid);
      if (cr.length === 0) return 100;
      const total = cr.reduce((sum, r) => sum + r.score_change, 0);
      return Math.max(0, Math.min(100, 100 + total));
    });
    return Math.round(scores.reduce((sum: number, s: number) => sum + s, 0) / scores.length);
  };

  const getWeekRecordCount = (studentId: string, week: number, courseId?: string) => {
    let records = behaviorRecords.filter((r) => r.student_id === studentId && r.week_number === week);
    if (courseId && courseId !== "all") {
      records = records.filter((r) => r.course_id === courseId);
    }
    return records.length;
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

  const handleAvatarSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error("Image must be less than 5MB");
        return;
      }
      setAvatarFile(file);
      setAvatarPreview(URL.createObjectURL(file));
    }
  };

  const handleAddStudent = async () => {
    if (!newStudent.full_name || !newStudent.student_code || !newStudent.email || !newStudent.password) {
      toast.error("Name, Student Code, Email and Password are required");
      return;
    }
    if (newStudent.password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    setLoading(true);
    try {
      // Upload avatar if provided
      let avatar_url: string | null = null;
      if (avatarFile) {
        const ext = avatarFile.name.split(".").pop();
        const fileName = `${newStudent.student_code}_${Date.now()}.${ext}`;
        avatar_url = await uploadPhoto(avatarFile, fileName);
      }

      // Call edge function to create auth user + student record
      const { data: session } = await supabase.auth.getSession();
      const res = await supabase.functions.invoke("create-student", {
        body: {
          full_name: newStudent.full_name,
          email: newStudent.email,
          password: newStudent.password,
          student_code: newStudent.student_code,
          year_level: parseInt(newStudent.year_level),
          phone: newStudent.phone || null,
          avatar_url,
        },
      });

      if (res.error) throw new Error(res.error.message);
      if (res.data?.error) throw new Error(res.data.error);

      toast.success("Student account created successfully");
      setNewStudent({ full_name: "", email: "", student_code: "", year_level: "1", phone: "", password: "" });
      setAvatarFile(null);
      setAvatarPreview(null);
      setAddOpen(false);
      refetch();
    } catch (err: any) {
      toast.error(err.message || "Failed to create student");
    } finally {
      setLoading(false);
    }
  };

  const canManage = role === "admin" || role === "dean";

  const [assignCourseOpen, setAssignCourseOpen] = useState(false);
  const [courseToAssign, setCourseToAssign] = useState("");

  const deleteStudent = useMutation({
    mutationFn: async (studentId: string) => {
      await supabase.from("enrollments").delete().eq("student_id", studentId);
      await supabase.from("attendance_records").delete().eq("student_id", studentId);
      await supabase.from("behavior_records").delete().eq("student_id", studentId);
      await supabase.from("behavior_scores").delete().eq("student_id", studentId);
      const { error } = await supabase.from("students").delete().eq("id", studentId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["students"] });
      toast.success("Student deleted successfully");
      setSelectedStudentId(null);
      refetch();
    },
    onError: (err: any) => toast.error(err.message),
  });

  const unenrollFromCourse = useMutation({
    mutationFn: async ({ studentId, courseId }: { studentId: string; courseId: string }) => {
      const { error } = await supabase.from("enrollments").delete().eq("student_id", studentId).eq("course_id", courseId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["student-enrollments"] });
      toast.success("Course removed from student");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const assignCourse = useMutation({
    mutationFn: async ({ studentId, courseId }: { studentId: string; courseId: string }) => {
      const { error } = await supabase.from("enrollments").insert({ student_id: studentId, course_id: courseId });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["student-enrollments"] });
      toast.success("Course assigned to student");
      setAssignCourseOpen(false);
      setCourseToAssign("");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const getUnenrolledCourses = (studentId: string) => {
    const enrolledCourseIds = enrollments.filter((e) => e.student_id === studentId).map((e) => e.course_id);
    return courses.filter((c) => !enrolledCourseIds.includes(c.id));
  };

  const openEditDialog = (student: any) => {
    setEditData({
      full_name: student.full_name,
      student_code: student.student_code,
      email: student.email || "",
      phone: student.phone || "",
      year_level: String(student.year_level),
      status: student.status,
    });
    setEditAvatarFile(null);
    setEditAvatarPreview(student.avatar_url || null);
    setEditOpen(true);
  };

  const handleEditAvatarSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) { toast.error("Image must be less than 5MB"); return; }
      setEditAvatarFile(file);
      setEditAvatarPreview(URL.createObjectURL(file));
    }
  };

  const updateStudent = useMutation({
    mutationFn: async () => {
      if (!selectedStudent) return;
      if (!editData.full_name.trim() || !editData.student_code.trim()) {
        throw new Error("Name and student code are required");
      }

      let avatar_url = selectedStudent.avatar_url;
      if (editAvatarFile) {
        const ext = editAvatarFile.name.split(".").pop();
        const fileName = `${editData.student_code}_${Date.now()}.${ext}`;
        avatar_url = await uploadPhoto(editAvatarFile, fileName);
      }

      const { error } = await supabase.from("students").update({
        full_name: editData.full_name.trim(),
        student_code: editData.student_code.trim(),
        email: editData.email.trim() || null,
        phone: editData.phone.trim() || null,
        year_level: parseInt(editData.year_level),
        status: editData.status,
        avatar_url,
      }).eq("id", selectedStudent.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["students"] });
      toast.success("Student updated successfully");
      setEditOpen(false);
      refetch();
    },
    onError: (err: any) => toast.error(err.message),
  });

  const scoreColor   = (s: number) => s >= 80 ? "#22c55e" : s >= 60 ? "#f59e0b" : "#ef4444";
  const scoreLabel   = (s: number) => s >= 80 ? "Excellent" : s >= 60 ? "Average" : "Poor";

  return (
    <MainLayout title="Students">
      <div className="space-y-5">

        {/* -------------- HERO HEADER -------------- */}
        <motion.div
          initial={{ opacity: 0, y: -18 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-2xl border border-border"
          style={{ background: "linear-gradient(135deg, hsl(var(--card)), hsl(var(--card)))" }}
        >
          <div className="absolute inset-0 pointer-events-none opacity-20" style={{
            backgroundImage: "linear-gradient(hsl(217 91% 60% / 0.1) 1px, transparent 1px), linear-gradient(90deg, hsl(217 91% 60% / 0.1) 1px, transparent 1px)",
            backgroundSize: "32px 32px"
          }} />
          <div className="absolute -top-16 -right-16 w-72 h-72 rounded-full bg-primary/10 blur-[80px] pointer-events-none" />
          <div className="absolute -bottom-12 -left-12 w-56 h-56 rounded-full bg-accent/8 blur-[60px] pointer-events-none" />

          <div className="relative z-10 p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Sparkles className="w-4 h-4 text-primary" />
                <span className="text-[10px] uppercase tracking-[0.2em] text-primary/80 font-bold">Student Directory</span>
              </div>
              <h1 className="text-2xl font-black text-foreground tracking-tight">{role === "doctor" ? "My Students" : "All Students"}</h1>
              <p className="text-sm text-muted-foreground mt-0.5">{filteredStudents.length} registered · {filteredStudents.filter(s => s.status === "active").length} active</p>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              {[
                { label: "Total",   value: filteredStudents.length,                                    col: "from-primary/25 to-primary/5 border-primary/25 text-primary" },
                { label: "Active",  value: filteredStudents.filter(s => s.status === "active").length, col: "from-emerald-500/25 to-emerald-500/5 border-emerald-500/25 text-emerald-400" },
                { label: "Courses", value: role === "doctor" ? (doctorCourseIds?.length ?? 0) : courses.length,                                     col: "from-amber-500/25 to-amber-500/5 border-amber-500/25 text-amber-400" },
              ].map(({ label, value, col }) => (
                <div key={label} className={`px-4 py-2.5 rounded-xl bg-gradient-to-b ${col} border text-center min-w-[64px]`} style={{ backdropFilter: "blur(12px)" }}>
                  <p className={`text-2xl font-black tabular-nums leading-none ${col.split(" ").find(c => c.startsWith("text-"))}`}>{value}</p>
                  <p className="text-[9px] text-muted-foreground uppercase tracking-widest mt-1">{label}</p>
                </div>
              ))}
              <Button
                variant="outline"
                onClick={() => exportToCsv(
                  "students",
                  filteredStudents,
                  [
                    { header: "Code", accessor: (s: any) => s.student_code },
                    { header: "Name", accessor: (s: any) => s.full_name },
                    { header: "Email", accessor: (s: any) => s.email ?? "" },
                    { header: "Phone", accessor: (s: any) => s.phone ?? "" },
                    { header: "Year", accessor: (s: any) => s.year_level },
                    { header: "Status", accessor: (s: any) => s.status },
                    { header: "Courses", accessor: (s: any) => getStudentCourses(s.id).map((c: any) => c.course_code).join("; ") },
                    { header: "Behavior Score", accessor: (s: any) => getOverallScore(s.id) },
                  ],
                )}
                className="rounded-xl h-12 px-4 border-border/50 hover:border-primary/50 hover:bg-primary/10 gap-2"
              >
                <Download className="w-4 h-4" />
                <span className="text-sm font-semibold">Export CSV</span>
              </Button>
              {canManage && (
                <Dialog open={addOpen} onOpenChange={setAddOpen}>
                  <DialogTrigger asChild>
                    <Button className="rounded-xl bg-gradient-to-r from-primary to-accent hover:opacity-90 shadow-[0_0_24px_hsl(217_91%_60%/0.35)] h-12 px-5 font-semibold">
                      <Plus className="w-4 h-4 mr-2" />Add Student
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="glass max-h-[90vh] overflow-y-auto">
                  <DialogHeader><DialogTitle>Create Student Account</DialogTitle></DialogHeader>
                  <div className="space-y-4">
                    {/* Avatar Upload */}
                    <div className="flex flex-col items-center gap-3">
                      <div
                        onClick={() => fileInputRef.current?.click()}
                        className="w-24 h-24 rounded-2xl bg-secondary/50 border-2 border-dashed border-border/50 flex items-center justify-center cursor-pointer hover:border-primary/50 transition-colors overflow-hidden"
                      >
                        {avatarPreview ? (
                          <img src={avatarPreview} alt="Preview" className="w-full h-full object-cover rounded-2xl" />
                        ) : (
                          <div className="text-center">
                            <Upload className="w-6 h-6 text-muted-foreground mx-auto mb-1" />
                            <span className="text-[10px] text-muted-foreground">Photo</span>
                          </div>
                        )}
                      </div>
                      <input ref={fileInputRef} type="file" accept="image/*" onChange={handleAvatarSelect} className="hidden" />
                      <p className="text-[10px] text-muted-foreground">Click to upload student photo</p>
                    </div>

                    <div>
                      <Label className="flex items-center gap-2 text-xs"><User className="w-3 h-3" />Full Name *</Label>
                      <Input value={newStudent.full_name} onChange={(e) => setNewStudent({ ...newStudent, full_name: e.target.value })} className="rounded-xl mt-1" placeholder="Ahmed Mohamed" />
                    </div>
                    <div>
                      <Label className="flex items-center gap-2 text-xs"><Hash className="w-3 h-3" />Student Code *</Label>
                      <Input value={newStudent.student_code} onChange={(e) => setNewStudent({ ...newStudent, student_code: e.target.value })} placeholder="e.g. STU001" className="rounded-xl mt-1" />
                    </div>
                    <div>
                      <Label className="flex items-center gap-2 text-xs"><Mail className="w-3 h-3" />Email *</Label>
                      <Input type="email" value={newStudent.email} onChange={(e) => setNewStudent({ ...newStudent, email: e.target.value })} placeholder="student@institution.edu" className="rounded-xl mt-1" />
                    </div>
                    <div>
                      <Label className="flex items-center gap-2 text-xs"><Lock className="w-3 h-3" />Password *</Label>
                      <Input type="password" value={newStudent.password} onChange={(e) => setNewStudent({ ...newStudent, password: e.target.value })} placeholder="Min 6 characters" className="rounded-xl mt-1" />
                    </div>
                    <div>
                      <Label className="flex items-center gap-2 text-xs"><Phone className="w-3 h-3" />Phone</Label>
                      <Input value={newStudent.phone} onChange={(e) => setNewStudent({ ...newStudent, phone: e.target.value })} className="rounded-xl mt-1" />
                    </div>
                    <div>
                      <Label className="text-xs">Year Level</Label>
                      <Select value={newStudent.year_level} onValueChange={(v) => setNewStudent({ ...newStudent, year_level: v })}>
                        <SelectTrigger className="rounded-xl mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {[1, 2, 3, 4, 5].map((y) => <SelectItem key={y} value={String(y)}>Year {y}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button onClick={handleAddStudent} disabled={loading} className="w-full rounded-xl bg-gradient-to-r from-primary to-accent">
                      {loading ? (
                        <span className="flex items-center gap-2">
                          <span className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                          Creating...
                        </span>
                      ) : "Create Student Account"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>
        </motion.div>

        {/* -------------- MAIN GRID -------------- */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_390px] gap-5">

          {/* -- LEFT: Student List -- */}
          <div className="space-y-3">
            {/* Search bar */}
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or student code..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-12 h-12 rounded-2xl bg-card border-border/50 text-sm"
              />
            </div>

            {filteredStudents.length === 0 ? (
              <div className="text-center py-20 rounded-2xl border border-border/30 bg-card">
                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <Users className="w-8 h-8 text-primary/40" />
                </div>
                <p className="font-semibold text-foreground">No students found</p>
                <p className="text-sm text-muted-foreground mt-1">Try adjusting your search</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {filteredStudents.map((student, index) => {
                  const studentCourses = getStudentCourses(student.id);
                  const score         = getOverallScore(student.id);
                  const sc            = scoreColor(score);
                  const sl            = scoreLabel(score);
                  const isSelected    = selectedStudent?.id === student.id;
                  const initials      = student.full_name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase();
                  const R = 22; const circumference = 2 * Math.PI * R;
                  const dash = circumference - (score / 100) * circumference;

                  return (
                    <motion.div
                      key={student.id}
                      initial={{ opacity: 0, y: 18, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ delay: index * 0.04, type: "spring", stiffness: 280, damping: 24 }}
                      whileHover={{ y: -6, scale: 1.02, transition: { type: "spring", stiffness: 400, damping: 20 } }}
                      onClick={() => setSelectedStudentId(student.id)}
                      className="relative overflow-hidden rounded-2xl cursor-pointer group bg-card"
                      style={{
                        background: isSelected
                          ? `linear-gradient(160deg, ${sc}18 0%, hsl(var(--card)) 60%)`
                          : undefined,
                        border: `1px solid ${isSelected ? sc + "55" : "hsl(var(--border))"}`,
                        boxShadow: isSelected
                          ? `0 0 0 1px ${sc}30, 0 8px 40px ${sc}20`
                          : undefined,
                      }}
                    >
                      {/* Corner glow */}
                      <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full blur-[40px] pointer-events-none"
                        style={{ background: sc, opacity: isSelected ? 0.14 : 0.05 }} />
                      {/* Top accent stripe */}
                      <div className="absolute top-0 left-8 right-8 h-[2px] rounded-b-full"
                        style={{ background: `linear-gradient(90deg, transparent, ${sc}90, transparent)` }} />

                      <div className="p-5">
                        {/* Avatar + Score ring */}
                        <div className="flex items-start justify-between mb-4">
                          <div className="relative">
                            <div className="w-16 h-16 rounded-2xl overflow-hidden"
                              style={{ boxShadow: `0 0 0 2px hsl(var(--background)), 0 0 0 3.5px ${sc}55, 0 8px 20px ${sc}25` }}>
                              {student.avatar_url ? (
                                <img src={student.avatar_url} alt={student.full_name} className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-xl font-black text-foreground"
                                  style={{ background: `linear-gradient(135deg, ${sc}60, ${sc}28)` }}>
                                  {initials}
                                </div>
                              )}
                            </div>
                            {student.status === "active" && (
                              <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-400 border-2"
                                style={{ borderColor: "hsl(var(--background))", boxShadow: "0 0 8px #22c55e80" }} />
                            )}
                          </div>

                          {/* Animated SVG score ring */}
                          <div className="relative flex items-center justify-center" style={{ width: 56, height: 56 }}>
                            <svg width="56" height="56" style={{ transform: "rotate(-90deg)" }}>
                              <circle cx="28" cy="28" r={R} fill="none" stroke="hsl(var(--border))" strokeWidth="3.5" />
                              <motion.circle
                                cx="28" cy="28" r={R} fill="none"
                                stroke={sc} strokeWidth="3.5"
                                strokeLinecap="round"
                                strokeDasharray={circumference}
                                initial={{ strokeDashoffset: circumference }}
                                animate={{ strokeDashoffset: dash }}
                                transition={{ delay: 0.2 + index * 0.03, duration: 1, ease: "easeOut" }}
                                style={{ filter: `drop-shadow(0 0 5px ${sc}cc)` }}
                              />
                            </svg>
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                              <span className="text-sm font-black tabular-nums leading-none" style={{ color: sc }}>{score}</span>
                              <span className="text-[8px] text-muted-foreground font-bold">%</span>
                            </div>
                          </div>
                        </div>

                        {/* Name & code */}
                        <div className="mb-3">
                          <p className="font-black text-foreground text-[15px] leading-snug truncate">{student.full_name}</p>
                          <p className="text-[10px] text-muted-foreground font-mono mt-0.5 truncate">{student.student_code}</p>
                        </div>

                        {/* Score label + status */}
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg"
                            style={{ background: `${sc}18`, color: sc, border: `1px solid ${sc}35` }}>
                            {sl}
                          </span>
                          <span className={`text-[9px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg border ${
                            student.status === "active"
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/25"
                              : "bg-muted/50 text-muted-foreground border-border/30"
                          }`}>
                            {student.status}
                          </span>
                        </div>

                        {/* Progress bar */}
                        <div className="h-1.5 rounded-full overflow-hidden mb-3 bg-muted">
                          <motion.div
                            className="h-full rounded-full"
                            initial={{ width: 0 }}
                            animate={{ width: `${score}%` }}
                            transition={{ delay: 0.15 + index * 0.03, duration: 0.8, ease: "easeOut" }}
                            style={{ background: `linear-gradient(90deg, ${sc}aa, ${sc})`, boxShadow: `0 0 8px ${sc}80` }}
                          />
                        </div>

                        {/* Footer stats */}
                        <div className="flex items-center gap-3 pt-2.5 border-t" style={{ borderColor: "hsl(var(--border))" }}>
                          <div className="flex items-center gap-1.5">
                            <GraduationCap className="w-3 h-3 text-muted-foreground/70" />
                            <span className="text-[10px] text-muted-foreground">Year {student.year_level}</span>
                          </div>
                          <div className="w-px h-3 bg-border/30" />
                          <div className="flex items-center gap-1.5">
                            <BookOpen className="w-3 h-3 text-muted-foreground/70" />
                            <span className="text-[10px] text-muted-foreground">{studentCourses.length} course{studentCourses.length !== 1 ? "s" : ""}</span>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>

          {/* -- RIGHT: Detail Panel -- */}
          <div className="space-y-4">
          {selectedStudent ? (
            <>
              {/* -- Profile Card -- */}
              <motion.div
                key={selectedStudent.id}
                initial={{ opacity: 0, x: 24, scale: 0.98 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                transition={{ type: "spring", stiffness: 260, damping: 22 }}
                className="rounded-2xl overflow-hidden border border-border bg-card"
              >
                {/* Banner */}
                <div className="relative h-20 overflow-hidden">
                  <div className="absolute inset-0" style={{
                    background: `linear-gradient(135deg, ${scoreColor(getOverallScore(selectedStudent.id))}30, hsl(263 70% 58% / 0.2))`,
                  }} />
                  <div className="absolute inset-0 opacity-20" style={{
                    backgroundImage: "radial-gradient(circle, hsl(217 91% 60% / 0.15) 1px, transparent 1px)",
                    backgroundSize: "18px 18px"
                  }} />
                  <div className="absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl pointer-events-none"
                    style={{ background: `${scoreColor(getOverallScore(selectedStudent.id))}20` }} />
                </div>

                {/* Profile content */}
                <div className="px-5 pb-5">
                  {/* Avatar overlapping banner */}
                  <div className="flex items-end gap-3 -mt-8 mb-4">
                    <div className="relative flex-shrink-0">
                      <div className="w-16 h-16 rounded-2xl overflow-hidden border-[3px] shadow-xl"
                        style={{
                          borderColor: "hsl(var(--background))",
                          boxShadow: `0 0 24px ${scoreColor(getOverallScore(selectedStudent.id))}40, 0 8px 32px rgba(0,0,0,0.4)`
                        }}>
                        {selectedStudent.avatar_url ? (
                          <img src={selectedStudent.avatar_url} alt={selectedStudent.full_name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-xl font-black text-foreground"
                            style={{ background: `linear-gradient(135deg, ${scoreColor(getOverallScore(selectedStudent.id))}60, ${scoreColor(getOverallScore(selectedStudent.id))}30)` }}>
                            {selectedStudent.full_name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()}
                          </div>
                        )}
                      </div>
                      {selectedStudent.status === "active" && (
                        <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-emerald-400 border-2 border-background shadow-[0_0_8px_#4ade8070]" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0 pb-1">
                      <h3 className="font-black text-foreground text-base leading-tight truncate">{selectedStudent.full_name}</h3>
                      <p className="text-[10px] text-muted-foreground font-mono mt-0.5">{selectedStudent.student_code}</p>
                      <span className={`inline-block text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border mt-1.5 ${
                        selectedStudent.status === "active"
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/25"
                          : "bg-secondary/50 text-muted-foreground border-border/50"
                      }`}>{selectedStudent.status}</span>
                    </div>
                    {canManage && (
                      <div className="flex gap-1.5 pb-1 flex-shrink-0">
                        <Button variant="outline" size="icon" className="w-8 h-8 rounded-xl border-border/40 hover:border-primary/50 hover:bg-primary/10" onClick={() => openEditDialog(selectedStudent)}>
                          <Pencil className="w-3.5 h-3.5 text-primary" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="outline" size="icon" className="w-8 h-8 rounded-xl border-destructive/25 text-destructive hover:bg-destructive/10">
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Student</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete <strong>{selectedStudent.full_name}</strong>? This will remove all their enrollments, attendance, and behavior records. This cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => deleteStudent.mutate(selectedStudent.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    )}
                  </div>

                  {/* 3D Stat Cards */}
                  <div className="grid grid-cols-2 gap-2.5 mb-4">
                    {[
                      {
                        icon: GraduationCap, label: "Year Level",
                        value: `Year ${selectedStudent.year_level}`,
                        col: "from-blue-500/15 to-blue-500/5 border-blue-500/20",
                        iconCls: "bg-blue-500/20 text-blue-400",
                      },
                      {
                        icon: Shield, label: "Behavior",
                        value: `${getOverallScore(selectedStudent.id, selectedBehaviorCourse)}%`,
                        col: `${getOverallScore(selectedStudent.id) >= 80 ? "from-emerald-500/15 to-emerald-500/5 border-emerald-500/20" : getOverallScore(selectedStudent.id) >= 60 ? "from-amber-500/15 to-amber-500/5 border-amber-500/20" : "from-red-500/15 to-red-500/5 border-red-500/20"}`,
                        iconCls: `${getOverallScore(selectedStudent.id) >= 80 ? "bg-emerald-500/20 text-emerald-400" : getOverallScore(selectedStudent.id) >= 60 ? "bg-amber-500/20 text-amber-400" : "bg-red-500/20 text-red-400"}`,
                      },
                      {
                        icon: BookOpen, label: "Courses",
                        value: getStudentCourses(selectedStudent.id).length,
                        col: "from-violet-500/15 to-violet-500/5 border-violet-500/20",
                        iconCls: "bg-violet-500/20 text-violet-400",
                      },
                      {
                        icon: Activity, label: "Records",
                        value: behaviorRecords.filter(r => r.student_id === selectedStudent.id).length,
                        col: "from-amber-500/15 to-amber-500/5 border-amber-500/20",
                        iconCls: "bg-amber-500/20 text-amber-400",
                      },
                    ].map(({ icon: Icon, label, value, col, iconCls }, i) => (
                      <motion.div
                        key={label}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 + i * 0.06 }}
                        whileHover={{ y: -2, scale: 1.02, transition: { duration: 0.15 } }}
                        className={`relative overflow-hidden p-3 rounded-xl bg-gradient-to-b ${col} border cursor-default`}
                        style={{ boxShadow: "0 4px 16px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.05)" }}
                      >
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center mb-2 ${iconCls}`}>
                          <Icon className="w-3.5 h-3.5" />
                        </div>
                        <p className="text-lg font-black text-foreground tabular-nums">{value}</p>
                        <p className="text-[9px] text-muted-foreground uppercase tracking-wider mt-0.5">{label}</p>
                      </motion.div>
                    ))}
                  </div>

                  {/* Contact info */}
                  {(selectedStudent.email || selectedStudent.phone) && (
                    <div className="space-y-1.5 p-3 rounded-xl border border-border/50 bg-background">
                      {selectedStudent.email && (
                        <div className="flex items-center gap-2 text-xs">
                          <Mail className="w-3.5 h-3.5 text-primary/60 flex-shrink-0" />
                          <span className="text-muted-foreground font-mono truncate">{selectedStudent.email}</span>
                        </div>
                      )}
                      {selectedStudent.phone && (
                        <div className="flex items-center gap-2 text-xs">
                          <Phone className="w-3.5 h-3.5 text-primary/60 flex-shrink-0" />
                          <span className="text-muted-foreground font-mono">{selectedStudent.phone}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </motion.div>

              {/* -- Behavior Panel -- */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.12 }}
                className="rounded-2xl border border-border overflow-hidden bg-card"
              >
                <div className="px-5 py-4 border-b border-border/50 flex items-center justify-between">
                  <h4 className="font-bold text-foreground flex items-center gap-2 text-sm">
                    <div className="w-6 h-6 rounded-lg bg-primary/15 flex items-center justify-center">
                      <Calendar className="w-3 h-3 text-primary" />
                    </div>
                    {selectedBehaviorCourse !== "all"
                      ? `Behavior � ${getStudentCourses(selectedStudent.id).find(c => c.id === selectedBehaviorCourse)?.name || "Course"}`
                      : "Weekly Behavior"}
                  </h4>
                  {canManage && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-7 text-xs rounded-lg text-muted-foreground/70 hover:text-foreground/70 gap-1">
                          <RotateCcw className="w-3 h-3" />Reset
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Reset Behavior Score</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will delete {selectedBehaviorCourse !== "all" ? "course-specific" : "all"} behavior records for <strong>{selectedStudent.full_name}</strong> and reset the score.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={async () => {
                              try {
                                if (selectedBehaviorCourse !== "all") {
                                  await supabase.from("behavior_records").delete().eq("student_id", selectedStudent.id).eq("course_id", selectedBehaviorCourse);
                                } else {
                                  await supabase.from("behavior_records").delete().eq("student_id", selectedStudent.id);
                                  await supabase.from("behavior_scores").update({ score: 100 }).eq("student_id", selectedStudent.id);
                                }
                                queryClient.invalidateQueries({ queryKey: ["behavior-scores"] });
                                queryClient.invalidateQueries({ queryKey: ["behavior-records"] });
                                queryClient.invalidateQueries({ queryKey: ["student-behavior-records"] });
                                toast.success("Behavior score reset");
                              } catch (err: any) { toast.error(err.message); }
                            }}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >Reset</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>

                <div className="p-4 space-y-4">
                  {/* Course filter pills */}
                  <div>
                    <p className="text-[9px] uppercase tracking-[0.18em] text-muted-foreground/70 font-bold mb-2 flex items-center gap-1.5">
                      <BookOpen className="w-3 h-3" />Filter by Course
                    </p>
                    <div className="flex gap-1.5 flex-wrap">
                      {["all", ...getStudentCourses(selectedStudent.id).map(c => c.id)].map((cid) => {
                        const course = cid === "all" ? null : getStudentCourses(selectedStudent.id).find(c => c.id === cid);
                        const isActive = selectedBehaviorCourse === cid;
                        return (
                          <button
                            key={cid}
                            onClick={() => setSelectedBehaviorCourse(cid)}
                            className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
                              isActive
                                ? "bg-primary text-primary-foreground shadow-[0_0_10px_hsl(217_91%_60%/0.4)]"
                                : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground/70"
                            }`}
                          >{cid === "all" ? "All" : course?.course_code || cid}</button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Week grid � colored heatmap */}
                  <div>
                    <p className="text-[9px] uppercase tracking-[0.18em] text-muted-foreground/70 font-bold mb-2">Week Heatmap</p>
                    <div className="grid grid-cols-8 gap-1.5">
                      {WEEKS.map((w) => {
                        const wScore = getWeeklyScore(selectedStudent.id, w, selectedBehaviorCourse);
                        const count  = getWeekRecordCount(selectedStudent.id, w, selectedBehaviorCourse);
                        const isAct  = selectedBehaviorWeek === w;
                        const sc     = scoreColor(wScore);
                        return (
                          <motion.button
                            key={w}
                            whileHover={{ scale: 1.15 }}
                            whileTap={{ scale: 0.92 }}
                            onClick={() => setSelectedBehaviorWeek(isAct ? "all" : w)}
                            className="relative aspect-square rounded-lg text-[9px] font-black transition-all flex items-center justify-center"
                            style={{
                              background: isAct
                                ? "hsl(var(--primary))"
                                : count > 0
                                  ? `${sc}22`
                                  : "hsl(var(--muted))",
                              color: isAct ? "hsl(var(--primary-foreground))" : count > 0 ? sc : "hsl(var(--muted-foreground))",
                              boxShadow: isAct ? "0 0 12px hsl(217 91% 60% / 0.6)" : count > 0 ? `0 0 8px ${sc}35` : "none",
                            }}
                          >
                            W{w}
                            {count > 0 && !isAct && (
                              <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full" style={{ background: sc }} />
                            )}
                          </motion.button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Week score detail */}
                  {selectedBehaviorWeek !== "all" && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      className="p-3 rounded-xl border border-border/50 bg-background"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs text-muted-foreground">Week {selectedBehaviorWeek}</p>
                        <p className="text-lg font-black" style={{ color: scoreColor(getWeeklyScore(selectedStudent.id, selectedBehaviorWeek, selectedBehaviorCourse)) }}>
                          {getWeeklyScore(selectedStudent.id, selectedBehaviorWeek, selectedBehaviorCourse)}%
                        </p>
                      </div>
                      <div className="h-2 rounded-full overflow-hidden" style={{ background: "hsl(var(--muted))" }}>
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${getWeeklyScore(selectedStudent.id, selectedBehaviorWeek, selectedBehaviorCourse)}%` }}
                          transition={{ duration: 0.6, ease: "easeOut" }}
                          className="h-full rounded-full"
                          style={{ background: scoreColor(getWeeklyScore(selectedStudent.id, selectedBehaviorWeek, selectedBehaviorCourse)) }}
                        />
                      </div>
                      <p className="text-[10px] text-muted-foreground/70 mt-1.5">{getWeekRecordCount(selectedStudent.id, selectedBehaviorWeek, selectedBehaviorCourse)} record(s) this week</p>
                    </motion.div>
                  )}

                  {/* Per-course breakdown */}
                  {selectedBehaviorCourse === "all" && getStudentCourses(selectedStudent.id).length > 0 && (
                    <div className="space-y-2">
                      <p className="text-[9px] uppercase tracking-[0.18em] text-muted-foreground/70 font-bold">Per Course</p>
                      {getStudentCourses(selectedStudent.id).map((course) => {
                        const cs = selectedBehaviorWeek !== "all"
                          ? getWeeklyScore(selectedStudent.id, selectedBehaviorWeek, course.id)
                          : getCourseScore(selectedStudent.id, course.id);
                        const allCourseRecords = behaviorRecords.filter(r => r.student_id === selectedStudent.id && r.course_id === course.id);
                        const displayRecords = selectedBehaviorWeek !== "all"
                          ? allCourseRecords.filter(r => r.week_number === selectedBehaviorWeek)
                          : allCourseRecords;
                        const cc = displayRecords.length;
                        const sc = scoreColor(cs);
                        return (
                          <div key={course.id} className="p-2.5 rounded-xl border border-border/30 bg-background space-y-1.5">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-bold text-foreground/60 w-14 flex-shrink-0 font-mono">{course.course_code}</span>
                              <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "hsl(var(--muted))" }}>
                                <div className="h-full rounded-full transition-all" style={{ width: `${cs}%`, background: sc }} />
                              </div>
                              <span className="text-[10px] font-black w-10 text-right flex-shrink-0" style={{ color: sc }}>{cs}%</span>
                            </div>
                            <p className="text-[9px] text-muted-foreground/70 pl-16">
                              {cc} incident{cc !== 1 ? "s" : ""}{selectedBehaviorWeek !== "all" ? ` · week ${selectedBehaviorWeek}` : " total"}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  )}                </div>
              </motion.div>

              {/* -- Enrolled Courses -- */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.18 }}
                className="rounded-2xl border border-border overflow-hidden bg-card"
              >
                <div className="px-5 py-4 border-b border-border/50 flex items-center justify-between">
                  <h4 className="font-bold text-foreground flex items-center gap-2 text-sm">
                    <div className="w-6 h-6 rounded-lg bg-blue-500/15 flex items-center justify-center">
                      <BookOpen className="w-3 h-3 text-blue-400" />
                    </div>
                    Enrolled Courses
                    <span className="text-[10px] text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded-md">{getStudentCourses(selectedStudent.id).length}</span>
                  </h4>
                  {canManage && (
                    <Dialog open={assignCourseOpen} onOpenChange={setAssignCourseOpen}>
                      <DialogTrigger asChild>
                        <Button size="sm" className="h-7 text-[10px] rounded-lg bg-primary/15 text-primary border border-primary/25 hover:bg-primary/25 gap-1">
                          <Plus className="w-3 h-3" />Assign
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="glass">
                        <DialogHeader><DialogTitle>Assign Course to {selectedStudent.full_name}</DialogTitle></DialogHeader>
                        <div className="space-y-4">
                          <Label className="text-xs uppercase tracking-wider">Select Course</Label>
                          <Select value={courseToAssign} onValueChange={setCourseToAssign}>
                            <SelectTrigger className="rounded-xl"><SelectValue placeholder="Choose a course..." /></SelectTrigger>
                            <SelectContent>
                              {getUnenrolledCourses(selectedStudent.id).map((c) => (
                                <SelectItem key={c.id} value={c.id}>{c.name} ({c.course_code})</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button onClick={() => assignCourse.mutate({ studentId: selectedStudent.id, courseId: courseToAssign })} disabled={!courseToAssign} className="w-full rounded-xl bg-gradient-to-r from-primary to-accent">Assign Course</Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  )}
                </div>
                <div className="p-4 space-y-2">
                  {getStudentCourses(selectedStudent.id).length === 0 ? (
                    <div className="text-center py-6">
                      <BookOpen className="w-8 h-8 mx-auto mb-2 text-muted-foreground/30" />
                      <p className="text-xs text-muted-foreground">Not enrolled in any courses</p>
                    </div>
                  ) : (
                    getStudentCourses(selectedStudent.id).map((course, i) => (
                      <motion.div
                        key={course.id}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.2 + i * 0.04 }}
                        className="flex items-center gap-3 p-3 rounded-xl border border-border/50 hover:border-primary/25 transition-all group bg-background"
                      >
                        <div className="w-9 h-9 rounded-lg bg-primary/15 flex items-center justify-center flex-shrink-0 text-sm font-black text-primary group-hover:scale-105 transition-transform">
                          {(course.name || "?")[0].toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-foreground text-xs leading-tight truncate">{course.name}</p>
                          <p className="text-[10px] text-muted-foreground font-mono mt-0.5">{course.course_code} � {course.credits} cr</p>
                        </div>
                        {canManage && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="sm" className="text-white/20 hover:text-destructive hover:bg-destructive/10 h-7 w-7 p-0 rounded-lg flex-shrink-0">
                                <XCircle className="w-3.5 h-3.5" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Remove Course</AlertDialogTitle>
                                <AlertDialogDescription>Remove <strong>{selectedStudent.full_name}</strong> from <strong>{course.name}</strong>?</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => unenrollFromCourse.mutate({ studentId: selectedStudent.id, courseId: course.id })} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Remove</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </motion.div>
                    ))
                  )}
                </div>
              </motion.div>

              {/* Edit Student Dialog */}
              <Dialog open={editOpen} onOpenChange={setEditOpen}>
                <DialogContent className="glass max-h-[90vh] overflow-y-auto">
                  <DialogHeader><DialogTitle>Edit Student</DialogTitle></DialogHeader>
                  <div className="space-y-4">
                    <div className="flex flex-col items-center gap-3">
                      <div
                        onClick={() => editFileInputRef.current?.click()}
                        className="w-24 h-24 rounded-2xl bg-secondary/50 border-2 border-dashed border-border/50 flex items-center justify-center cursor-pointer hover:border-primary/50 transition-colors overflow-hidden"
                      >
                        {editAvatarPreview ? (
                          <img src={editAvatarPreview} alt="Preview" className="w-full h-full object-cover rounded-2xl" />
                        ) : (
                          <div className="text-center">
                            <Upload className="w-6 h-6 text-muted-foreground mx-auto mb-1" />
                            <span className="text-[10px] text-muted-foreground">Photo</span>
                          </div>
                        )}
                      </div>
                      <input ref={editFileInputRef} type="file" accept="image/*" onChange={handleEditAvatarSelect} className="hidden" />
                    </div>
                    <div>
                      <Label className="flex items-center gap-2 text-xs"><User className="w-3 h-3" />Full Name *</Label>
                      <Input value={editData.full_name} onChange={(e) => setEditData({ ...editData, full_name: e.target.value })} className="rounded-xl mt-1" />
                    </div>
                    <div>
                      <Label className="flex items-center gap-2 text-xs"><Hash className="w-3 h-3" />Student Code *</Label>
                      <Input value={editData.student_code} onChange={(e) => setEditData({ ...editData, student_code: e.target.value })} className="rounded-xl mt-1" />
                    </div>
                    <div>
                      <Label className="flex items-center gap-2 text-xs"><Mail className="w-3 h-3" />Email</Label>
                      <Input type="email" value={editData.email} onChange={(e) => setEditData({ ...editData, email: e.target.value })} className="rounded-xl mt-1" />
                    </div>
                    <div>
                      <Label className="flex items-center gap-2 text-xs"><Phone className="w-3 h-3" />Phone</Label>
                      <Input value={editData.phone} onChange={(e) => setEditData({ ...editData, phone: e.target.value })} className="rounded-xl mt-1" />
                    </div>
                    <div>
                      <Label className="text-xs">Year Level</Label>
                      <Select value={editData.year_level} onValueChange={(v) => setEditData({ ...editData, year_level: v })}>
                        <SelectTrigger className="rounded-xl mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {[1, 2, 3, 4, 5].map((y) => <SelectItem key={y} value={String(y)}>Year {y}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Status</Label>
                      <Select value={editData.status} onValueChange={(v) => setEditData({ ...editData, status: v })}>
                        <SelectTrigger className="rounded-xl mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="inactive">Inactive</SelectItem>
                          <SelectItem value="suspended">Suspended</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button onClick={() => updateStudent.mutate()} disabled={updateStudent.isPending} className="w-full rounded-xl bg-gradient-to-r from-primary to-accent hover:opacity-90">
                      {updateStudent.isPending ? "Saving..." : "Save Changes"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="rounded-2xl border border-border/50 flex flex-col items-center justify-center py-20 text-center bg-card"
            >
              <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/15 flex items-center justify-center mx-auto mb-4"
                style={{ boxShadow: "0 0 24px hsl(217 91% 60% / 0.15)" }}>
                <User className="w-8 h-8 text-primary/40" />
              </div>
              <p className="font-semibold text-white/50 text-sm">Select a student</p>
              <p className="text-xs text-muted-foreground/70 mt-1">Click any student to view their profile</p>
            </motion.div>
          )}
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default Students;
