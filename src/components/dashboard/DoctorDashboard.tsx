import MainLayout from "@/components/layout/MainLayout";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import MetricCard from "@/components/dashboard/MetricCard";
import { BookOpen, Users, ClipboardCheck, AlertTriangle, GraduationCap, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const DoctorDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Get doctor's courses
  const { data: myCourses = [] } = useQuery({
    queryKey: ["doctor-my-courses", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("courses")
        .select("*")
        .eq("doctor_id", user?.id)
        .eq("status", "active");
      if (error) return [];
      return data;
    },
    enabled: !!user?.id,
  });

  const courseIds = myCourses.map((c) => c.id);

  // Get students enrolled in doctor's courses
  const { data: myStudents = [] } = useQuery({
    queryKey: ["doctor-my-students", courseIds],
    queryFn: async () => {
      if (courseIds.length === 0) return [];
      const { data, error } = await supabase
        .from("enrollments")
        .select("student_id, course_id, students(id, full_name, student_code, email, avatar_url, status)")
        .in("course_id", courseIds);
      if (error) return [];
      return data;
    },
    enabled: courseIds.length > 0,
  });

  // Get attendance records for doctor's courses
  const { data: attendanceRecords = [] } = useQuery({
    queryKey: ["doctor-attendance", courseIds],
    queryFn: async () => {
      if (courseIds.length === 0) return [];
      const { data, error } = await supabase
        .from("attendance_records")
        .select("*")
        .in("course_id", courseIds);
      if (error) return [];
      return data;
    },
    enabled: courseIds.length > 0,
  });

  // Get incidents count
  const { data: incidentsCount = 0 } = useQuery({
    queryKey: ["doctor-incidents-count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("incidents")
        .select("*", { count: "exact", head: true })
        .eq("status", "active");
      if (error) return 0;
      return count || 0;
    },
  });

  // Deduplicate students
  const uniqueStudents = Array.from(
    new Map(
      myStudents
        .filter((e: any) => e.students)
        .map((e: any) => [e.students.id, { ...e.students, course_id: e.course_id }])
    ).values()
  ) as any[];

  // Build student-course mapping for display
  const studentCourseMap = new Map<string, string[]>();
  myStudents.forEach((e: any) => {
    if (!e.students) return;
    const existing = studentCourseMap.get(e.students.id) || [];
    const course = myCourses.find((c) => c.id === e.course_id);
    if (course) existing.push(course.name);
    studentCourseMap.set(e.students.id, existing);
  });

  const totalAttendance = attendanceRecords.length;
  const presentCount = attendanceRecords.filter((a) => a.status === "present").length;
  const attendanceRate = totalAttendance > 0 ? Math.round((presentCount / totalAttendance) * 100) : 0;

  return (
    <MainLayout title="Dashboard">
      <div className="space-y-6">
        {/* Welcome Banner */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/10 via-accent/5 to-neon-cyan/10 p-6 neon-border"
        >
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-[80px] pointer-events-none" />
          <div className="relative z-10">
            <h2 className="text-2xl font-bold text-foreground mb-1">
              Welcome back, {user?.user_metadata?.full_name || "Doctor"} 👋
            </h2>
            <p className="text-sm text-muted-foreground">
              You have {myCourses.length} active course{myCourses.length !== 1 ? "s" : ""} with {uniqueStudents.length} student{uniqueStudents.length !== 1 ? "s" : ""}.
            </p>
          </div>
        </motion.div>

        {/* Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard title="My Courses" value={myCourses.length} icon={BookOpen} color="primary" index={0} linkTo="/courses" />
          <MetricCard title="My Students" value={uniqueStudents.length} icon={Users} color="info" index={1} linkTo="/students" />
          <MetricCard title="Attendance Rate" value={`${attendanceRate}%`} icon={ClipboardCheck} color="success" index={2} linkTo="/attendance" />
          <MetricCard title="Active Alerts" value={incidentsCount} icon={AlertTriangle} color="warning" index={3} linkTo="/alerts" />
        </div>

        {/* My Courses */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="glass rounded-2xl p-5"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold text-foreground flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-primary" />
              My Courses
            </h3>
            <span
              onClick={() => navigate("/courses")}
              className="text-xs text-primary cursor-pointer hover:underline font-medium flex items-center gap-1"
            >
              View All <ArrowRight className="w-3 h-3" />
            </span>
          </div>
          {myCourses.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No courses assigned to you yet.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {myCourses.map((course, i) => {
                const courseStudents = myStudents.filter((e: any) => e.course_id === course.id).length;
                const courseAttendance = attendanceRecords.filter((a) => a.course_id === course.id);
                const coursePresent = courseAttendance.filter((a) => a.status === "present").length;
                const courseRate = courseAttendance.length > 0 ? Math.round((coursePresent / courseAttendance.length) * 100) : 0;

                return (
                  <motion.div
                    key={course.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.4 + i * 0.1 }}
                    onClick={() => navigate("/courses")}
                    className="p-4 rounded-xl bg-secondary/40 hover:bg-secondary/70 transition-all duration-200 cursor-pointer group hover-lift"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="font-semibold text-foreground text-sm">{course.name}</p>
                        <p className="text-xs text-muted-foreground">{course.course_code} • {course.semester}</p>
                      </div>
                      <Badge className="bg-primary/10 text-primary text-[10px]">{course.credits} cr</Badge>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Users className="w-3 h-3" /> {courseStudents} students
                      </span>
                      <span className="flex items-center gap-1">
                        <ClipboardCheck className="w-3 h-3" /> {courseRate}% attendance
                      </span>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </motion.div>

        {/* My Students */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="glass rounded-2xl p-5"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold text-foreground flex items-center gap-2">
              <GraduationCap className="w-4 h-4 text-primary" />
              My Students ({uniqueStudents.length})
            </h3>
            <span
              onClick={() => navigate("/students")}
              className="text-xs text-primary cursor-pointer hover:underline font-medium flex items-center gap-1"
            >
              View All <ArrowRight className="w-3 h-3" />
            </span>
          </div>
          {uniqueStudents.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No students enrolled in your courses yet.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[400px] overflow-y-auto">
              {uniqueStudents.map((student: any, i: number) => {
                const courses = studentCourseMap.get(student.id) || [];
                return (
                  <motion.div
                    key={student.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.6 + i * 0.03 }}
                    onClick={() => navigate("/students")}
                    className="flex items-center gap-3 p-3 rounded-xl bg-secondary/30 hover:bg-secondary/50 transition-colors cursor-pointer"
                  >
                    <Avatar className="w-9 h-9">
                      <AvatarImage src={student.avatar_url} />
                      <AvatarFallback className="bg-primary/10 text-primary text-xs">
                        {student.full_name?.split(" ").map((n: string) => n[0]).join("").slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{student.full_name}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{student.student_code} • {courses.join(", ")}</p>
                    </div>
                    <Badge
                      className={
                        student.status === "active"
                          ? "bg-emerald-500/10 text-emerald-500 text-[10px]"
                          : "bg-destructive/10 text-destructive text-[10px]"
                      }
                    >
                      {student.status}
                    </Badge>
                  </motion.div>
                );
              })}
            </div>
          )}
        </motion.div>
      </div>
    </MainLayout>
  );
};

export default DoctorDashboard;
