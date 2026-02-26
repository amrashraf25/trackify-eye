import MainLayout from "@/components/layout/MainLayout";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Search, BookOpen, Users, Plus, GraduationCap, CheckCircle, XCircle, Clock, User, TrendingDown, TrendingUp, History, ChevronLeft } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";

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
  const [behaviorDialogOpen, setBehaviorDialogOpen] = useState(false);
  const [behaviorStudentId, setBehaviorStudentId] = useState<string | null>(null);
  const [actionType, setActionType] = useState<"positive" | "negative">("negative");
  const [selectedAction, setSelectedAction] = useState("");
  const [behaviorNotes, setBehaviorNotes] = useState("");
  const { role, user } = useAuth();
  const queryClient = useQueryClient();

  const canManage = role === "admin" || role === "dean";
  const canRecord = role === "admin" || role === "dean" || role === "doctor";

  const { data: courses = [], refetch } = useQuery({
    queryKey: ["courses"],
    queryFn: async () => {
      const { data, error } = await supabase.from("courses").select("*").order("name");
      if (error) throw error;
      return data;
    },
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

  const { data: behaviorHistory = [] } = useQuery({
    queryKey: ["behavior-history-course", selectedCourseId, behaviorStudentId],
    queryFn: async () => {
      if (!behaviorStudentId || !selectedCourseId) return [];
      const { data, error } = await supabase
        .from("behavior_records")
        .select("*")
        .eq("student_id", behaviorStudentId)
        .eq("course_id", selectedCourseId)
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
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["behavior-scores"] });
      queryClient.invalidateQueries({ queryKey: ["behavior-history-course"] });
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
          {/* Header */}
          <div className="flex items-center gap-4">
            <Button variant="outline" size="sm" onClick={() => setSelectedCourseId(null)}>
              <ChevronLeft className="w-4 h-4 mr-1" />Back
            </Button>
            <div>
              <h2 className="text-xl font-bold text-foreground">{selectedCourse.name}</h2>
              <p className="text-sm text-muted-foreground">{selectedCourse.course_code} • {selectedCourse.credits} credits • {selectedCourse.semester}</p>
            </div>
            <Badge className="ml-auto">{enrolledStudents.length} Students</Badge>
          </div>

          <Tabs defaultValue="attendance">
            <TabsList>
              <TabsTrigger value="attendance">Attendance (16 Weeks)</TabsTrigger>
              <TabsTrigger value="behavior">Behavior</TabsTrigger>
              <TabsTrigger value="students">Enrolled Students</TabsTrigger>
            </TabsList>

            {/* ATTENDANCE TAB */}
            <TabsContent value="attendance" className="mt-4 space-y-4">
              {/* Week selector */}
              <div className="flex items-center gap-3 flex-wrap">
                <p className="text-sm font-medium text-foreground">Week:</p>
                <div className="flex flex-wrap gap-1">
                  {WEEKS.map((w) => (
                    <Button
                      key={w}
                      size="sm"
                      variant={selectedWeek === w ? "default" : "outline"}
                      className="h-8 w-8 p-0 text-xs"
                      onClick={() => setSelectedWeek(w)}
                    >
                      {w}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Summary */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-card rounded-xl border border-border p-4">
                  <p className="text-xs text-muted-foreground">Total</p>
                  <p className="text-2xl font-bold text-foreground">{enrolledStudents.length}</p>
                </div>
                <div className="bg-card rounded-xl border border-border p-4">
                  <p className="text-xs text-muted-foreground">Present</p>
                  <p className="text-2xl font-bold text-emerald-500">{presentCount}</p>
                </div>
                <div className="bg-card rounded-xl border border-border p-4">
                  <p className="text-xs text-muted-foreground">Absent</p>
                  <p className="text-2xl font-bold text-destructive">{absentCount}</p>
                </div>
                <div className="bg-card rounded-xl border border-border p-4">
                  <p className="text-xs text-muted-foreground">Late</p>
                  <p className="text-2xl font-bold text-amber-500">{lateCount}</p>
                </div>
              </div>

              {/* Student list */}
              <div className="space-y-2">
                {enrolledStudents.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>No students enrolled in this course</p>
                  </div>
                ) : (
                  enrolledStudents.map((student) => {
                    const status = getStudentStatus(student.id);
                    return (
                      <div key={student.id} className="flex items-center gap-4 bg-card rounded-xl border border-border p-4">
                        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0 overflow-hidden">
                          {student.avatar_url ? (
                            <img src={student.avatar_url} alt={student.full_name} className="w-full h-full rounded-full object-cover" />
                          ) : (
                            <User className="w-6 h-6 text-primary" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-foreground truncate">{student.full_name}</p>
                          <p className="text-xs text-muted-foreground">{student.student_code}</p>
                        </div>
                        {getStatusBadge(status)}
                        {canRecord && (
                          <div className="flex items-center gap-1 shrink-0">
                            <Button size="sm" variant={status === "present" ? "default" : "outline"} className="h-8 px-3 text-xs"
                              onClick={() => markAttendance.mutate({ studentId: student.id, status: "present" })}>
                              <CheckCircle className="w-3.5 h-3.5 mr-1" />Present
                            </Button>
                            <Button size="sm" variant={status === "absent" ? "destructive" : "outline"} className="h-8 px-3 text-xs"
                              onClick={() => markAttendance.mutate({ studentId: student.id, status: "absent" })}>
                              <XCircle className="w-3.5 h-3.5 mr-1" />Absent
                            </Button>
                            <Button size="sm" variant={status === "late" ? "secondary" : "outline"} className="h-8 px-3 text-xs"
                              onClick={() => markAttendance.mutate({ studentId: student.id, status: "late" })}>
                              <Clock className="w-3.5 h-3.5 mr-1" />Late
                            </Button>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </TabsContent>

            {/* BEHAVIOR TAB */}
            <TabsContent value="behavior" className="mt-4 space-y-4">
              <div className="space-y-3">
                {enrolledStudents.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">No enrolled students</div>
                ) : (
                  enrolledStudents.map((student) => {
                    const score = getScore(student.id);
                    return (
                      <div key={student.id} className="bg-card rounded-xl border border-border p-4">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0 overflow-hidden">
                            {student.avatar_url ? (
                              <img src={student.avatar_url} alt={student.full_name} className="w-full h-full rounded-full object-cover" />
                            ) : (
                              <User className="w-6 h-6 text-primary" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-foreground truncate">{student.full_name}</p>
                            <p className="text-xs text-muted-foreground">{student.student_code}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <div className="relative h-2 flex-1 rounded-full bg-secondary overflow-hidden">
                                <div className={`h-full rounded-full transition-all ${getProgressColor(score)}`} style={{ width: `${score}%` }} />
                              </div>
                              <span className={`text-sm font-bold ${getScoreColor(score)}`}>{score}%</span>
                            </div>
                          </div>
                          {canRecord && (
                            <div className="flex gap-1 shrink-0">
                              <Button size="sm" variant="outline" className="h-8 text-xs"
                                onClick={() => { setBehaviorStudentId(student.id); setBehaviorDialogOpen(true); }}>
                                <Plus className="w-3.5 h-3.5 mr-1" />Record
                              </Button>
                              <Button size="sm" variant="ghost" className="h-8 text-xs"
                                onClick={() => setBehaviorStudentId(behaviorStudentId === student.id ? null : student.id)}>
                                <History className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          )}
                        </div>
                        {/* Inline history */}
                        {behaviorStudentId === student.id && !behaviorDialogOpen && (
                          <div className="mt-3 border-t border-border pt-3 space-y-2 max-h-[200px] overflow-y-auto">
                            {behaviorHistory.length === 0 ? (
                              <p className="text-xs text-muted-foreground">No behavior records for this course</p>
                            ) : (
                              behaviorHistory.map((record) => (
                                <div key={record.id} className="flex items-start gap-2 text-xs p-2 rounded bg-secondary/30">
                                  {record.action_type === "positive" ? (
                                    <TrendingUp className="w-3.5 h-3.5 text-emerald-500 mt-0.5 shrink-0" />
                                  ) : (
                                    <TrendingDown className="w-3.5 h-3.5 text-destructive mt-0.5 shrink-0" />
                                  )}
                                  <div>
                                    <p className="font-medium text-foreground">{record.action_name} ({record.score_change > 0 ? "+" : ""}{record.score_change}%)</p>
                                    <p className="text-muted-foreground">{format(new Date(record.created_at), "MMM dd, yyyy HH:mm")}</p>
                                    {record.notes && <p className="text-muted-foreground mt-0.5">{record.notes}</p>}
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              {/* Behavior Record Dialog */}
              <Dialog open={behaviorDialogOpen} onOpenChange={setBehaviorDialogOpen}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Record Behavior - {students.find((s) => s.id === behaviorStudentId)?.full_name}</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label>Type</Label>
                      <div className="flex gap-2 mt-1">
                        <Button size="sm" variant={actionType === "negative" ? "destructive" : "outline"}
                          onClick={() => { setActionType("negative"); setSelectedAction(""); }} className="flex-1">
                          <TrendingDown className="w-4 h-4 mr-1" />Negative
                        </Button>
                        <Button size="sm" variant={actionType === "positive" ? "default" : "outline"}
                          onClick={() => { setActionType("positive"); setSelectedAction(""); }} className="flex-1">
                          <TrendingUp className="w-4 h-4 mr-1" />Positive
                        </Button>
                      </div>
                    </div>
                    <div>
                      <Label>Action</Label>
                      <Select value={selectedAction} onValueChange={setSelectedAction}>
                        <SelectTrigger><SelectValue placeholder="Select action..." /></SelectTrigger>
                        <SelectContent>
                          {(actionType === "positive" ? positiveActions : negativeActions).map((a) => (
                            <SelectItem key={a.name} value={a.name}>{a.name} ({a.change > 0 ? "+" : ""}{a.change}%)</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Notes (optional)</Label>
                      <Textarea value={behaviorNotes} onChange={(e) => setBehaviorNotes(e.target.value)} placeholder="Add notes..." />
                    </div>
                    <Button onClick={() => recordBehavior.mutate()} disabled={!selectedAction} className="w-full">Submit</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </TabsContent>

            {/* ENROLLED STUDENTS TAB */}
            <TabsContent value="students" className="mt-4">
              <div className="space-y-3">
                {enrolledStudents.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>No students enrolled in this course</p>
                  </div>
                ) : (
                  enrolledStudents.map((student) => (
                    <div key={student.id} className="flex items-center gap-4 bg-card rounded-xl border border-border p-4">
                      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0 overflow-hidden">
                        {student.avatar_url ? (
                          <img src={student.avatar_url} alt={student.full_name} className="w-full h-full rounded-full object-cover" />
                        ) : (
                          <User className="w-6 h-6 text-primary" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground truncate">{student.full_name}</p>
                        <p className="text-xs text-muted-foreground">{student.student_code} • Year {student.year_level}</p>
                        {student.email && <p className="text-xs text-muted-foreground">{student.email}</p>}
                      </div>
                      <Badge variant={student.status === "active" ? "default" : "secondary"} className={student.status === "active" ? "bg-emerald-500/10 text-emerald-500" : ""}>
                        {student.status}
                      </Badge>
                    </div>
                  ))
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </MainLayout>
    );
  }

  // Course list view
  return (
    <MainLayout title="Courses">
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search courses..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
          </div>
          {canManage && (
            <Dialog open={addOpen} onOpenChange={setAddOpen}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="w-4 h-4 mr-2" />Add Course</Button>
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

        {filteredCourses.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <GraduationCap className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No courses found. {canManage && "Add your first course to get started."}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredCourses.map((course) => {
              const enrolled = getEnrolledStudents(course.id).length;
              return (
                <div
                  key={course.id}
                  onClick={() => setSelectedCourseId(course.id)}
                  className="p-5 rounded-xl cursor-pointer transition-all bg-card border border-border hover:border-primary/30 hover:shadow-md"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-11 h-11 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <BookOpen className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-foreground truncate">{course.name}</p>
                      <p className="text-xs text-muted-foreground">{course.course_code}</p>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-2">
                        <span className="flex items-center gap-1"><Users className="w-3 h-3" />{enrolled} students</span>
                        <span>{course.credits} credits</span>
                      </div>
                    </div>
                  </div>
                  <Badge className="mt-3" variant="secondary">{course.status}</Badge>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </MainLayout>
  );
};

export default Courses;
