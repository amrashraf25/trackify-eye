import MainLayout from "@/components/layout/MainLayout";
import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Search, User, BookOpen, Plus, Upload, Lock, Mail, Phone, Hash, Trash2, Calendar, ChevronLeft, ChevronRight, XCircle, UserPlus } from "lucide-react";
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
  const { role } = useAuth();
  const queryClient = useQueryClient();
  const [selectedBehaviorWeek, setSelectedBehaviorWeek] = useState<number | "all">("all");

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

  const { data: behaviorScores = [] } = useQuery({
    queryKey: ["student-behavior-scores"],
    queryFn: async () => {
      const { data, error } = await supabase.from("behavior_scores").select("*");
      if (error) throw error;
      return data;
    },
  });

  const { data: behaviorRecords = [] } = useQuery({
    queryKey: ["student-behavior-records"],
    queryFn: async () => {
      const { data, error } = await supabase.from("behavior_records").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const filteredStudents = students.filter((s) =>
    s.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.student_code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectedStudent = students.find((s) => s.id === selectedStudentId) || filteredStudents[0];

  const getStudentCourses = (studentId: string) => {
    const courseIds = enrollments.filter((e) => e.student_id === studentId).map((e) => e.course_id);
    return courses.filter((c) => courseIds.includes(c.id));
  };

  const getOverallScore = (studentId: string) => {
    // Average of all 16 weekly scores
    let totalScore = 0;
    for (const w of WEEKS) {
      totalScore += getWeeklyScore(studentId, w);
    }
    return Math.round(totalScore / 16);
  };

  const getWeeklyScore = (studentId: string, week: number) => {
    const records = behaviorRecords.filter((r) => r.student_id === studentId && r.week_number === week);
    if (records.length === 0) return 100;
    const total = records.reduce((sum, r) => sum + r.score_change, 0);
    return Math.max(0, Math.min(100, 100 + total));
  };

  const getWeekRecordCount = (studentId: string, week: number) =>
    behaviorRecords.filter((r) => r.student_id === studentId && r.week_number === week).length;

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
        const { error: uploadError } = await supabase.storage
          .from("avatars")
          .upload(fileName, avatarFile, { upsert: true });
        if (uploadError) throw uploadError;
        const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(fileName);
        avatar_url = urlData.publicUrl;
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

  return (
    <MainLayout title="Students">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 glass rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Search students..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10 rounded-xl bg-secondary/50 border-border/50" />
            </div>
            {canManage && (
              <Dialog open={addOpen} onOpenChange={setAddOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="rounded-xl bg-gradient-to-r from-primary to-accent hover:opacity-90"><Plus className="w-4 h-4 mr-2" />Add Student</Button>
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

          {filteredStudents.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No students found.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredStudents.map((student, index) => {
                const studentCourses = getStudentCourses(student.id);
                const score = getOverallScore(student.id);
                return (
                  <motion.div
                    key={student.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.03 }}
                    onClick={() => setSelectedStudentId(student.id)}
                    className={`p-4 rounded-xl cursor-pointer transition-all duration-200 ${
                      selectedStudent?.id === student.id
                        ? "bg-primary/10 ring-1 ring-primary/30"
                        : "bg-secondary/30 hover:bg-secondary/50"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 overflow-hidden">
                          {student.avatar_url ? (
                            <img src={student.avatar_url} alt={student.full_name} className="w-full h-full rounded-xl object-cover" />
                          ) : (
                            <User className="w-5 h-5 text-primary" />
                          )}
                        </div>
                        <div>
                          <p className="font-semibold text-foreground text-sm">{student.full_name}</p>
                          <p className="text-[10px] text-muted-foreground font-mono">
                            {student.student_code} • Year {student.year_level} • {studentCourses.length} courses
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-bold ${getScoreColor(score)}`}>{score}%</span>
                        <Badge variant={student.status === "active" ? "default" : "secondary"} className={`text-[10px] ${student.status === "active" ? "bg-emerald-500/10 text-emerald-500" : ""}`}>
                          {student.status}
                        </Badge>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>

        {/* Detail Panel */}
        <div className="space-y-4">
          {selectedStudent ? (
            <>
              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="glass rounded-2xl p-5">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center overflow-hidden ring-2 ring-primary/20">
                    {selectedStudent.avatar_url ? (
                      <img src={selectedStudent.avatar_url} alt={selectedStudent.full_name} className="w-full h-full rounded-2xl object-cover" />
                    ) : (
                      <User className="w-8 h-8 text-primary" />
                    )}
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-foreground">{selectedStudent.full_name}</h3>
                    <p className="text-xs text-muted-foreground font-mono">{selectedStudent.student_code}</p>
                    <Badge variant={selectedStudent.status === "active" ? "default" : "secondary"} className="mt-1 text-[10px]">
                      {selectedStudent.status}
                    </Badge>
                  </div>
                  {canManage && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" size="icon" className="rounded-xl border-destructive/30 text-destructive hover:bg-destructive/10 shrink-0">
                          <Trash2 className="w-4 h-4" />
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
                          <AlertDialogAction onClick={() => deleteStudent.mutate(selectedStudent.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-secondary/30 rounded-xl p-3">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Year Level</p>
                    <p className="text-xl font-bold text-foreground">{selectedStudent.year_level}</p>
                  </div>
                  <div className="bg-secondary/30 rounded-xl p-3">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Overall Behavior</p>
                    <p className={`text-xl font-bold ${getScoreColor(getOverallScore(selectedStudent.id))}`}>{getOverallScore(selectedStudent.id)}%</p>
                  </div>
                </div>

                {/* 16-Week Behavior Breakdown */}
                <div className="mt-4">
                  <h4 className="font-bold text-foreground flex items-center gap-2 text-xs mb-3">
                    <Calendar className="w-3.5 h-3.5 text-primary" />
                    Weekly Behavior Score
                  </h4>
                  <div className="grid grid-cols-8 gap-1.5 mb-3">
                    {WEEKS.map((w) => {
                      const weekScore = getWeeklyScore(selectedStudent.id, w);
                      const count = getWeekRecordCount(selectedStudent.id, w);
                      const isActive = selectedBehaviorWeek === w;
                      return (
                        <button
                          key={w}
                          onClick={() => setSelectedBehaviorWeek(isActive ? "all" : w)}
                          className={`relative p-1.5 rounded-lg text-[10px] font-bold transition-all ${
                            isActive
                              ? "bg-primary text-primary-foreground shadow-glow-primary"
                              : count > 0
                              ? weekScore >= 80
                                ? "bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20"
                                : weekScore >= 60
                                ? "bg-amber-500/10 text-amber-500 hover:bg-amber-500/20"
                                : "bg-destructive/10 text-destructive hover:bg-destructive/20"
                              : "bg-secondary/30 text-muted-foreground hover:bg-secondary/50"
                          }`}
                        >
                          W{w}
                          {count > 0 && !isActive && (
                            <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-primary" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                  {selectedBehaviorWeek !== "all" && (
                    <div className="bg-secondary/30 rounded-xl p-3">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs text-muted-foreground">Week {selectedBehaviorWeek} Score</p>
                        <p className={`text-lg font-bold ${getScoreColor(getWeeklyScore(selectedStudent.id, selectedBehaviorWeek))}`}>
                          {getWeeklyScore(selectedStudent.id, selectedBehaviorWeek)}%
                        </p>
                      </div>
                      <div className="relative h-2 w-full rounded-full bg-secondary overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${getProgressColor(getWeeklyScore(selectedStudent.id, selectedBehaviorWeek))}`}
                          style={{ width: `${getWeeklyScore(selectedStudent.id, selectedBehaviorWeek)}%` }}
                        />
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {getWeekRecordCount(selectedStudent.id, selectedBehaviorWeek)} record(s) this week
                      </p>
                    </div>
                  )}
                </div>

                {selectedStudent.email && (
                  <div className="mt-4 text-sm">
                    <span className="text-muted-foreground">Email: </span>
                    <span className="text-foreground font-mono text-xs">{selectedStudent.email}</span>
                  </div>
                )}
                {selectedStudent.phone && (
                  <div className="mt-1 text-sm">
                    <span className="text-muted-foreground">Phone: </span>
                    <span className="text-foreground font-mono text-xs">{selectedStudent.phone}</span>
                  </div>
                )}
              </motion.div>

              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }} className="glass rounded-2xl p-5">
                <h4 className="font-bold text-foreground mb-4 flex items-center gap-2 text-sm">
                  <BookOpen className="w-4 h-4 text-primary" />
                  Enrolled Courses ({getStudentCourses(selectedStudent.id).length})
                </h4>
                <div className="space-y-2">
                  {getStudentCourses(selectedStudent.id).length > 0 ? (
                    getStudentCourses(selectedStudent.id).map((course) => (
                      <div key={course.id} className="flex items-center gap-3 p-3 bg-secondary/30 rounded-xl hover:bg-secondary/50 transition-colors">
                        <BookOpen className="w-5 h-5 text-primary shrink-0" />
                        <div>
                          <p className="font-medium text-foreground text-sm">{course.name}</p>
                          <p className="text-[10px] text-muted-foreground font-mono">{course.course_code} • {course.credits} credits</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">Not enrolled in any courses</p>
                  )}
                </div>
              </motion.div>
            </>
          ) : (
            <div className="glass rounded-2xl p-5 text-center text-muted-foreground">
              Select a student to view details
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
};

export default Students;
