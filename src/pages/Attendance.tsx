import MainLayout from "@/components/layout/MainLayout";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Search, User, CheckCircle, XCircle, Clock, Camera, Users, Stethoscope } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { format } from "date-fns";

const Attendance = () => {
  const { role, user } = useAuth();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCourse, setSelectedCourse] = useState<string>("all");
  const [selectedDate, setSelectedDate] = useState(format(new Date(), "yyyy-MM-dd"));

  const { data: courses = [] } = useQuery({
    queryKey: ["attendance-courses"],
    queryFn: async () => {
      const { data, error } = await supabase.from("courses").select("*").eq("status", "active").order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: students = [] } = useQuery({
    queryKey: ["attendance-students"],
    queryFn: async () => {
      const { data, error } = await supabase.from("students").select("*").eq("status", "active").order("full_name");
      if (error) throw error;
      return data;
    },
  });

  const { data: enrollments = [] } = useQuery({
    queryKey: ["attendance-enrollments"],
    queryFn: async () => {
      const { data, error } = await supabase.from("enrollments").select("*");
      if (error) throw error;
      return data;
    },
  });

  const { data: todayAttendance = [] } = useQuery({
    queryKey: ["today-attendance", selectedDate, selectedCourse],
    queryFn: async () => {
      let query = supabase.from("attendance_records").select("*").eq("date", selectedDate);
      if (selectedCourse !== "all") {
        query = query.eq("course_id", selectedCourse);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const { data: doctors = [] } = useQuery({
    queryKey: ["attendance-doctors"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*").eq("role", "doctor").order("full_name");
      if (error) throw error;
      return data;
    },
  });

  const { data: doctorAttendance = [] } = useQuery({
    queryKey: ["doctor-attendance", selectedDate],
    queryFn: async () => {
      const { data, error } = await supabase.from("doctor_attendance").select("*").eq("date", selectedDate);
      if (error) throw error;
      return data;
    },
  });

  const markStudentAttendance = useMutation({
    mutationFn: async ({ studentId, status, courseName, courseId }: { studentId: string; status: string; courseName: string; courseId: string | null }) => {
      // Check if already marked
      const existing = todayAttendance.find(
        (a) => a.student_id === studentId && (courseId ? a.course_id === courseId : true)
      );
      if (existing) {
        const { error } = await supabase
          .from("attendance_records")
          .update({ status })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("attendance_records").insert({
          student_id: studentId,
          course_name: courseName,
          course_id: courseId,
          date: selectedDate,
          status,
          marked_by: user?.id,
          recognition_method: "manual",
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["today-attendance"] });
      toast.success("Attendance updated");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const markDoctorAttendance = useMutation({
    mutationFn: async ({ doctorId, status, courseId }: { doctorId: string; status: string; courseId: string | null }) => {
      const existing = doctorAttendance.find(
        (a) => a.doctor_id === doctorId && (courseId ? a.course_id === courseId : true)
      );
      if (existing) {
        const { error } = await supabase.from("doctor_attendance").update({ status }).eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("doctor_attendance").insert({
          doctor_id: doctorId,
          course_id: courseId,
          date: selectedDate,
          status,
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
    const record = todayAttendance.find((a) => a.student_id === studentId);
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

  return (
    <MainLayout title="Attendance">
      <div className="space-y-6">
        {/* Controls */}
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search by name or ID..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
          </div>
          <Select value={selectedCourse} onValueChange={setSelectedCourse}>
            <SelectTrigger className="w-48 bg-card border-border">
              <SelectValue placeholder="Select Course" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Courses</SelectItem>
              {courses.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="w-44 bg-card border-border" />
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-card rounded-xl border border-border p-4">
            <p className="text-xs text-muted-foreground">Total Students</p>
            <p className="text-2xl font-bold text-foreground">{filteredStudents.length}</p>
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

        <Tabs defaultValue="students">
          <TabsList>
            <TabsTrigger value="students" className="gap-2"><Users className="w-4 h-4" />Students</TabsTrigger>
            <TabsTrigger value="doctors" className="gap-2"><Stethoscope className="w-4 h-4" />Doctors</TabsTrigger>
          </TabsList>

          <TabsContent value="students" className="mt-4">
            <div className="space-y-2">
              {filteredStudents.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No students found for selected course</p>
                </div>
              ) : (
                filteredStudents.map((student) => {
                  const status = getStudentStatus(student.id);
                  return (
                    <div key={student.id} className="flex items-center gap-4 bg-card rounded-xl border border-border p-4">
                      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        {student.avatar_url ? (
                          <img src={student.avatar_url} alt={student.full_name} className="w-full h-full rounded-full object-cover" />
                        ) : (
                          <User className="w-6 h-6 text-primary" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground truncate">{student.full_name}</p>
                        <p className="text-xs text-muted-foreground">{student.student_code} • Year {student.year_level}</p>
                      </div>
                      {getStatusBadge(status)}
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          size="sm"
                          variant={status === "present" ? "default" : "outline"}
                          className="h-8 px-3 text-xs"
                          onClick={() => markStudentAttendance.mutate({ studentId: student.id, status: "present", courseName: selectedCourseName, courseId: selectedCourse === "all" ? null : selectedCourse })}
                        >
                          <CheckCircle className="w-3.5 h-3.5 mr-1" />Present
                        </Button>
                        <Button
                          size="sm"
                          variant={status === "absent" ? "destructive" : "outline"}
                          className="h-8 px-3 text-xs"
                          onClick={() => markStudentAttendance.mutate({ studentId: student.id, status: "absent", courseName: selectedCourseName, courseId: selectedCourse === "all" ? null : selectedCourse })}
                        >
                          <XCircle className="w-3.5 h-3.5 mr-1" />Absent
                        </Button>
                        <Button
                          size="sm"
                          variant={status === "late" ? "secondary" : "outline"}
                          className="h-8 px-3 text-xs"
                          onClick={() => markStudentAttendance.mutate({ studentId: student.id, status: "late", courseName: selectedCourseName, courseId: selectedCourse === "all" ? null : selectedCourse })}
                        >
                          <Clock className="w-3.5 h-3.5 mr-1" />Late
                        </Button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </TabsContent>

          <TabsContent value="doctors" className="mt-4">
            <div className="space-y-2">
              {filteredDoctors.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Stethoscope className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No doctors found</p>
                </div>
              ) : (
                filteredDoctors.map((doctor) => {
                  const status = getDoctorStatus(doctor.id);
                  return (
                    <div key={doctor.id} className="flex items-center gap-4 bg-card rounded-xl border border-border p-4">
                      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <Stethoscope className="w-6 h-6 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground truncate">{doctor.full_name || "Unnamed"}</p>
                        <p className="text-xs text-muted-foreground">{doctor.email}</p>
                      </div>
                      {getStatusBadge(status)}
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          size="sm"
                          variant={status === "present" ? "default" : "outline"}
                          className="h-8 px-3 text-xs"
                          onClick={() => markDoctorAttendance.mutate({ doctorId: doctor.id, status: "present", courseId: selectedCourse === "all" ? null : selectedCourse })}
                        >
                          <CheckCircle className="w-3.5 h-3.5 mr-1" />Present
                        </Button>
                        <Button
                          size="sm"
                          variant={status === "absent" ? "destructive" : "outline"}
                          className="h-8 px-3 text-xs"
                          onClick={() => markDoctorAttendance.mutate({ doctorId: doctor.id, status: "absent", courseId: selectedCourse === "all" ? null : selectedCourse })}
                        >
                          <XCircle className="w-3.5 h-3.5 mr-1" />Absent
                        </Button>
                        <Button
                          size="sm"
                          variant={status === "late" ? "secondary" : "outline"}
                          className="h-8 px-3 text-xs"
                          onClick={() => markDoctorAttendance.mutate({ doctorId: doctor.id, status: "late", courseId: selectedCourse === "all" ? null : selectedCourse })}
                        >
                          <Clock className="w-3.5 h-3.5 mr-1" />Late
                        </Button>
                      </div>
                    </div>
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
