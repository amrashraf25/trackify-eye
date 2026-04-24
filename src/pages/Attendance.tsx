import MainLayout from "@/components/layout/MainLayout";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Search, CheckCircle, XCircle, Clock, Users, Stethoscope, BrainCircuit, ClipboardCheck } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { PageHeader } from "@/components/ui/page-header";
import { StatsGrid } from "@/components/ui/stats-grid";

const WEEKS = Array.from({ length: 16 }, (_, i) => i + 1);

// Manual attendance management page: mark students and doctors as present/absent/late per week, course, and session type.
const Attendance = () => {
  const { role, user } = useAuth();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCourse, setSelectedCourse] = useState<string>("all");
  const [selectedWeek, setSelectedWeek] = useState(1);
  const [selectedSessionType, setSelectedSessionType] = useState<string>("all");

  // Fetches all active courses for the filter dropdown.
  const { data: courses = [] } = useQuery({
    queryKey: ["attendance-courses"],
    queryFn: async () => {
      const { data, error } = await supabase.from("courses").select("*").eq("status", "active").order("name");
      if (error) throw error;
      return data;
    },
  });

  // Fetches all active students for the attendance list.
  const { data: students = [] } = useQuery({
    queryKey: ["attendance-students"],
    queryFn: async () => {
      const { data, error } = await supabase.from("students").select("*").eq("status", "active").order("full_name");
      if (error) throw error;
      return data;
    },
  });

  // Fetches all enrollments to filter students by selected course.
  const { data: enrollments = [] } = useQuery({
    queryKey: ["attendance-enrollments"],
    queryFn: async () => {
      const { data, error } = await supabase.from("enrollments").select("*");
      if (error) throw error;
      return data;
    },
  });

  // Fetches attendance records for the selected week, optionally filtered by course and session type.
  const { data: weekAttendance = [] } = useQuery({
    queryKey: ["week-attendance", selectedWeek, selectedCourse, selectedSessionType],
    queryFn: async () => {
      let query = supabase.from("attendance_records").select("*").eq("week_number", selectedWeek);
      if (selectedCourse !== "all") query = query.eq("course_id", selectedCourse);
      if (selectedSessionType !== "all") query = query.eq("session_type", selectedSessionType);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  // Fetches all doctor profiles for the doctor attendance tab.
  const { data: doctors = [] } = useQuery({
    queryKey: ["attendance-doctors"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*").eq("role", "doctor").order("full_name");
      if (error) throw error;
      return data;
    },
  });

  // Fetches doctor attendance records for the selected week.
  const { data: doctorAttendance = [] } = useQuery({
    queryKey: ["doctor-attendance", selectedWeek],
    queryFn: async () => {
      const { data, error } = await supabase.from("doctor_attendance").select("*").eq("week_number", selectedWeek);
      if (error) throw error;
      return data;
    },
  });

  // Toggles student attendance: clicking the same status deletes the record; clicking a different status updates it; no prior record creates a new one.
  const markStudentAttendance = useMutation({
    mutationFn: async ({ studentId, status, courseName, courseId }: { studentId: string; status: string; courseName: string; courseId: string | null }) => {
      const existing = weekAttendance.find(
        (a) => a.student_id === studentId && (courseId ? a.course_id === courseId : true)
      );
      if (existing) {
        if (existing.status === status) {
          // Toggle off
          const { error } = await supabase.from("attendance_records").delete().eq("id", existing.id);
          if (error) throw error;
        } else {
          const { error } = await supabase.from("attendance_records").update({ status }).eq("id", existing.id);
          if (error) throw error;
        }
      } else {
        const { error } = await supabase.from("attendance_records").insert({
          student_id: studentId,
          course_name: courseName,
          course_id: courseId,
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
      queryClient.invalidateQueries({ queryKey: ["week-attendance"] });
      toast.success("Attendance updated");
    },
    onError: (err: any) => toast.error(err.message),
  });

  // Toggles doctor attendance using the same toggle logic as student attendance.
  const markDoctorAttendance = useMutation({
    mutationFn: async ({ doctorId, status, courseId }: { doctorId: string; status: string; courseId: string | null }) => {
      const existing = doctorAttendance.find(
        (a) => a.doctor_id === doctorId && (courseId ? a.course_id === courseId : true)
      );
      if (existing) {
        if (existing.status === status) {
          const { error } = await supabase.from("doctor_attendance").delete().eq("id", existing.id);
          if (error) throw error;
        } else {
          const { error } = await supabase.from("doctor_attendance").update({ status }).eq("id", existing.id);
          if (error) throw error;
        }
      } else {
        const { error } = await supabase.from("doctor_attendance").insert({
          doctor_id: doctorId,
          course_id: courseId,
          date: new Date().toISOString().split("T")[0],
          status,
          week_number: selectedWeek,
          marked_by: user?.id,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["doctor-attendance"] });
      toast.success("Doctor attendance updated");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const filteredStudents = students.filter((s) => {
    const matchesSearch = s.full_name.toLowerCase().includes(searchQuery.toLowerCase()) || s.student_code.toLowerCase().includes(searchQuery.toLowerCase());
    if (selectedCourse === "all") return matchesSearch;
    const enrolled = enrollments.some((e) => e.student_id === s.id && e.course_id === selectedCourse);
    return matchesSearch && enrolled;
  });

  const filteredDoctors = doctors.filter((d) =>
    (d.full_name || "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStudentStatus = (studentId: string) => {
    const record = weekAttendance.find((a) => a.student_id === studentId);
    return record?.status || null;
  };

  const getDoctorStatus = (doctorId: string) => {
    const record = doctorAttendance.find((a) => a.doctor_id === doctorId);
    return record?.status || null;
  };

  const getStatusBadge = (status: string | null) => {
    if (!status) return <Badge variant="secondary" className="text-xs">Not Marked</Badge>;
    if (status === "present") return <Badge className="bg-emerald-500/10 text-emerald-500 text-xs">Present</Badge>;
    if (status === "absent") return <Badge className="bg-destructive/10 text-destructive text-xs">Absent</Badge>;
    if (status === "late") return <Badge className="bg-amber-500/10 text-amber-500 text-xs">Late</Badge>;
    return null;
  };

  const selectedCourseName = selectedCourse === "all" ? "General" : courses.find((c) => c.id === selectedCourse)?.name || "General";

  const presentCount = filteredStudents.filter((s) => getStudentStatus(s.id) === "present").length;
  const absentCount = filteredStudents.filter((s) => getStudentStatus(s.id) === "absent").length;
  const lateCount = filteredStudents.filter((s) => getStudentStatus(s.id) === "late").length;

  const attendanceRate = filteredStudents.length > 0 ? Math.round((presentCount / filteredStudents.length) * 100) : 0;

  return (
    <MainLayout title="Attendance">
      <div className="space-y-6">
        {/* Page Header */}
        <PageHeader
          icon={ClipboardCheck}
          label="Attendance Tracking"
          title="Attendance Management"
          description={`Week ${selectedWeek} · ${selectedCourseName} · ${filteredStudents.length} students`}
          iconColor="text-emerald-400"
          glowColor="bg-emerald-500/12"
        />

        {/* Stats Cards */}
        <StatsGrid items={[
          { icon: Users, label: "Total Students", value: filteredStudents.length, color: "primary" },
          { icon: CheckCircle, label: "Present", value: presentCount, color: "emerald" },
          { icon: XCircle, label: "Absent", value: absentCount, color: "red" },
          { icon: Clock, label: "Late", value: lateCount, color: "amber" },
        ]} />

        {/* Attendance Rate Bar */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass rounded-2xl p-4 border border-border/50"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-muted-foreground">Attendance Rate</span>
            <span className={`text-sm font-black tabular-nums ${attendanceRate >= 80 ? "text-emerald-400" : attendanceRate >= 60 ? "text-amber-400" : "text-red-400"}`}>
              {attendanceRate}%
            </span>
          </div>
          <div className="h-2 bg-secondary/50 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${attendanceRate}%` }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className={`h-full rounded-full ${attendanceRate >= 80 ? "bg-emerald-500" : attendanceRate >= 60 ? "bg-amber-500" : "bg-red-500"}`}
              style={{ boxShadow: attendanceRate >= 80 ? "0 0 8px #22c55e60" : attendanceRate >= 60 ? "0 0 8px #f59e0b60" : "0 0 8px #ef444460" }}
            />
          </div>
        </motion.div>

        {/* Filters */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass rounded-2xl p-4 border border-border/50 space-y-4"
        >
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Search by name or ID..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-12 h-11 rounded-xl bg-secondary/40 border-white/[0.08]" />
            </div>
            <Select value={selectedCourse} onValueChange={setSelectedCourse}>
              <SelectTrigger className="w-48 bg-secondary/40 border-white/[0.08] rounded-xl h-11">
                <SelectValue placeholder="Select Course" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Courses</SelectItem>
                {courses.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedSessionType} onValueChange={setSelectedSessionType}>
              <SelectTrigger className="w-44 bg-secondary/40 border-white/[0.08] rounded-xl h-11">
                <SelectValue placeholder="Session Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="lecture">Lecture</SelectItem>
                <SelectItem value="problem_solving">Problem Solving</SelectItem>
                <SelectItem value="lab">Lab</SelectItem>
                <SelectItem value="tutorial">Tutorial</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Week selector */}
          <div className="flex items-center gap-3 flex-wrap">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Week</p>
            <div className="flex flex-wrap gap-1.5">
              {WEEKS.map((w) => (
                <button
                  key={w}
                  onClick={() => setSelectedWeek(w)}
                  className={`h-8 w-8 rounded-lg text-xs font-semibold transition-all ${
                    selectedWeek === w
                      ? "bg-primary text-primary-foreground shadow-[0_0_12px_hsl(217_91%_60%/0.3)]"
                      : "bg-secondary/40 text-muted-foreground hover:bg-secondary/60 hover:text-foreground border border-white/[0.06]"
                  }`}
                >
                  {w}
                </button>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Tabs */}
        <Tabs defaultValue="students">
          <TabsList className="bg-secondary/30 border border-white/[0.06] rounded-xl p-1">
            <TabsTrigger value="students" className="gap-2 rounded-lg data-[state=active]:bg-primary/15 data-[state=active]:text-primary">
              <Users className="w-4 h-4" />Students ({filteredStudents.length})
            </TabsTrigger>
            <TabsTrigger value="doctors" className="gap-2 rounded-lg data-[state=active]:bg-primary/15 data-[state=active]:text-primary">
              <Stethoscope className="w-4 h-4" />Doctors ({filteredDoctors.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="students" className="mt-4">
            <div className="space-y-2">
              {filteredStudents.length === 0 ? (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-16 rounded-2xl border border-border/30 bg-card/50">
                  <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
                    <Users className="w-6 h-6 text-primary/40" />
                  </div>
                  <p className="font-semibold text-foreground text-sm">No students found</p>
                  <p className="text-xs text-muted-foreground mt-1">Try adjusting filters or selecting a different course</p>
                </motion.div>
              ) : (
                filteredStudents.map((student, idx) => {
                  const status = getStudentStatus(student.id);
                  const initials = student.full_name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase();
                  return (
                    <motion.div
                      key={student.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.02 }}
                      className={`flex items-center gap-4 rounded-2xl border p-4 transition-all hover:bg-secondary/20 ${
                        status === "present" ? "bg-emerald-500/[0.03] border-emerald-500/15" :
                        status === "absent" ? "bg-red-500/[0.03] border-red-500/15" :
                        status === "late" ? "bg-amber-500/[0.03] border-amber-500/15" :
                        "bg-card border-white/[0.06]"
                      }`}
                    >
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 overflow-hidden border-2 ${
                        status === "present" ? "border-emerald-500/30" : status === "absent" ? "border-red-500/30" : status === "late" ? "border-amber-500/30" : "border-primary/20"
                      }`}>
                        {student.avatar_url ? (
                          <img src={student.avatar_url} alt={student.full_name} className="w-full h-full object-cover rounded-xl" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-primary/10 text-primary text-xs font-bold">
                            {initials}
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-foreground text-sm truncate">{student.full_name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] text-muted-foreground font-mono">{student.student_code}</span>
                          <span className="text-[10px] text-muted-foreground">Year {student.year_level}</span>
                          {(() => {
                            const rec = weekAttendance.find(a => a.student_id === student.id);
                            if (!rec) return null;
                            return (
                              <>
                                {(rec.method === "face_recognition" || rec.method === "ai") && (
                                  <span className="text-[10px] flex items-center gap-0.5 text-violet-400">
                                    <BrainCircuit className="w-3 h-3" />AI
                                  </span>
                                )}
                              </>
                            );
                          })()}
                        </div>
                      </div>
                      <Badge className={`text-[10px] border font-semibold ${
                        status === "present" ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" :
                        status === "absent" ? "bg-red-500/15 text-red-400 border-red-500/30" :
                        status === "late" ? "bg-amber-500/15 text-amber-400 border-amber-500/30" :
                        "bg-secondary/50 text-muted-foreground border-border/50"
                      }`}>
                        {status ? status.charAt(0).toUpperCase() + status.slice(1) : "Not Marked"}
                      </Badge>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => markStudentAttendance.mutate({ studentId: student.id, status: "present", courseName: selectedCourseName, courseId: selectedCourse === "all" ? null : selectedCourse })}
                          className={`h-8 px-3 rounded-xl text-[11px] font-semibold border transition-all ${
                            status === "present"
                              ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-[0_0_8px_#22c55e30]"
                              : "text-muted-foreground border-white/[0.08] hover:bg-emerald-500/10 hover:text-emerald-400 hover:border-emerald-500/25"
                          }`}
                        >P</button>
                        <button
                          onClick={() => markStudentAttendance.mutate({ studentId: student.id, status: "late", courseName: selectedCourseName, courseId: selectedCourse === "all" ? null : selectedCourse })}
                          className={`h-8 px-3 rounded-xl text-[11px] font-semibold border transition-all ${
                            status === "late"
                              ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                              : "text-muted-foreground border-white/[0.08] hover:bg-amber-500/10 hover:text-amber-400 hover:border-amber-500/25"
                          }`}
                        >L</button>
                        <button
                          onClick={() => markStudentAttendance.mutate({ studentId: student.id, status: "absent", courseName: selectedCourseName, courseId: selectedCourse === "all" ? null : selectedCourse })}
                          className={`h-8 px-3 rounded-xl text-[11px] font-semibold border transition-all ${
                            status === "absent"
                              ? "bg-red-500/20 text-red-300 border-red-500/40"
                              : "text-muted-foreground border-white/[0.08] hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/25"
                          }`}
                        >A</button>
                      </div>
                    </motion.div>
                  );
                })
              )}
            </div>
          </TabsContent>

          <TabsContent value="doctors" className="mt-4">
            <div className="space-y-2">
              {filteredDoctors.length === 0 ? (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-16 rounded-2xl border border-border/30 bg-card/50">
                  <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
                    <Stethoscope className="w-6 h-6 text-primary/40" />
                  </div>
                  <p className="font-semibold text-foreground text-sm">No doctors found</p>
                </motion.div>
              ) : (
                filteredDoctors.map((doctor, idx) => {
                  const status = getDoctorStatus(doctor.id);
                  const initials = (doctor.full_name || "?").split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase();
                  return (
                    <motion.div
                      key={doctor.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.03 }}
                      className={`flex items-center gap-4 rounded-2xl border p-4 transition-all hover:bg-secondary/20 ${
                        status === "present" ? "bg-emerald-500/[0.03] border-emerald-500/15" :
                        status === "absent" ? "bg-red-500/[0.03] border-red-500/15" :
                        "bg-card border-white/[0.06]"
                      }`}
                    >
                      <div className="w-10 h-10 rounded-xl bg-primary/15 border border-primary/20 flex items-center justify-center shrink-0 text-xs font-bold text-primary">
                        {initials}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-foreground text-sm truncate">{doctor.full_name || "Unnamed"}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{doctor.email}</p>
                      </div>
                      <Badge className={`text-[10px] border font-semibold ${
                        status === "present" ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" :
                        status === "absent" ? "bg-red-500/15 text-red-400 border-red-500/30" :
                        status === "late" ? "bg-amber-500/15 text-amber-400 border-amber-500/30" :
                        "bg-secondary/50 text-muted-foreground border-border/50"
                      }`}>
                        {status ? status.charAt(0).toUpperCase() + status.slice(1) : "Not Marked"}
                      </Badge>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => markDoctorAttendance.mutate({ doctorId: doctor.id, status: "present", courseId: selectedCourse === "all" ? null : selectedCourse })}
                          className={`h-8 px-3 rounded-xl text-[11px] font-semibold border transition-all ${
                            status === "present"
                              ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                              : "text-muted-foreground border-white/[0.08] hover:bg-emerald-500/10 hover:text-emerald-400"
                          }`}
                        >P</button>
                        <button
                          onClick={() => markDoctorAttendance.mutate({ doctorId: doctor.id, status: "late", courseId: selectedCourse === "all" ? null : selectedCourse })}
                          className={`h-8 px-3 rounded-xl text-[11px] font-semibold border transition-all ${
                            status === "late"
                              ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                              : "text-muted-foreground border-white/[0.08] hover:bg-amber-500/10 hover:text-amber-400"
                          }`}
                        >L</button>
                        <button
                          onClick={() => markDoctorAttendance.mutate({ doctorId: doctor.id, status: "absent", courseId: selectedCourse === "all" ? null : selectedCourse })}
                          className={`h-8 px-3 rounded-xl text-[11px] font-semibold border transition-all ${
                            status === "absent"
                              ? "bg-red-500/20 text-red-300 border-red-500/40"
                              : "text-muted-foreground border-white/[0.08] hover:bg-red-500/10 hover:text-red-400"
                          }`}
                        >A</button>
                      </div>
                    </motion.div>
                  );
                })
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
};

export default Attendance;
