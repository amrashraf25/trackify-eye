import MainLayout from "@/components/layout/MainLayout";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import MetricCard from "@/components/dashboard/MetricCard";
import AttendanceChart from "@/components/dashboard/AttendanceChart";
import BehaviorPieChart from "@/components/dashboard/BehaviorPieChart";
import GradesComposition from "@/components/dashboard/GradesComposition";
import RecentCourses from "@/components/dashboard/RecentCourses";
import { BookOpen, AlertTriangle, Users, TrendingUp, GraduationCap, ClipboardCheck, Activity, History, TrendingDown } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

const StudentDashboard = () => {
  const { user } = useAuth();

  const { data: student } = useQuery({
    queryKey: ["my-student-profile"],
    queryFn: async () => {
      const { data, error } = await supabase.from("students").select("*").eq("user_id", user?.id).single();
      if (error) return null;
      return data;
    },
    enabled: !!user?.id,
  });

  const { data: behaviorScore } = useQuery({
    queryKey: ["my-behavior-score", student?.id],
    queryFn: async () => {
      if (!student?.id) return null;
      const { data, error } = await supabase.from("behavior_scores").select("*").eq("student_id", student.id).single();
      if (error) return null;
      return data;
    },
    enabled: !!student?.id,
  });

  const { data: attendance = [] } = useQuery({
    queryKey: ["my-attendance", student?.id],
    queryFn: async () => {
      if (!student?.id) return [];
      const { data, error } = await supabase.from("attendance_records").select("*").eq("student_id", student.id).order("date", { ascending: false }).limit(30);
      if (error) return [];
      return data;
    },
    enabled: !!student?.id,
  });

  const { data: behaviorHistory = [] } = useQuery({
    queryKey: ["my-behavior-history", student?.id],
    queryFn: async () => {
      if (!student?.id) return [];
      const { data, error } = await supabase.from("behavior_records").select("*").eq("student_id", student.id).order("created_at", { ascending: false }).limit(20);
      if (error) return [];
      return data;
    },
    enabled: !!student?.id,
  });

  const { data: enrollments = [] } = useQuery({
    queryKey: ["my-enrollments", student?.id],
    queryFn: async () => {
      if (!student?.id) return [];
      const { data, error } = await supabase.from("enrollments").select("*, courses(*)").eq("student_id", student.id);
      if (error) return [];
      return data;
    },
    enabled: !!student?.id,
  });

  const { data: grades = [] } = useQuery({
    queryKey: ["my-grades", student?.id],
    queryFn: async () => {
      if (!student?.id) return [];
      const { data, error } = await supabase.from("grades").select("*, courses(name)").eq("student_id", student.id).order("graded_at", { ascending: false });
      if (error) return [];
      return data;
    },
    enabled: !!student?.id,
  });

  const score = behaviorScore?.score ?? 100;
  const presentCount = attendance.filter((a) => a.status === "present").length;
  const totalAttendance = attendance.length;
  const attendanceRate = totalAttendance > 0 ? Math.round((presentCount / totalAttendance) * 100) : 0;

  const getScoreColor = (s: number) => {
    if (s >= 80) return "text-emerald-500";
    if (s >= 60) return "text-amber-500";
    return "text-destructive";
  };

  const getProgressColor = (s: number) => {
    if (s >= 80) return "bg-emerald-500";
    if (s >= 60) return "bg-amber-500";
    return "bg-destructive";
  };

  if (!student) {
    return (
      <MainLayout title="My Dashboard">
        <div className="text-center py-12">
          <GraduationCap className="w-16 h-16 mx-auto mb-4 text-primary" />
          <h2 className="text-2xl font-semibold text-foreground mb-2">Welcome, {user?.user_metadata?.full_name || "Student"}</h2>
          <p className="text-muted-foreground">Your student profile is not linked yet. Please contact admin.</p>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout title="My Dashboard">
      <div className="space-y-6">
        {/* Metric cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-card rounded-xl border border-border p-5">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/20"><Activity className="w-5 h-5 text-primary" /></div>
              <div>
                <p className="text-xs text-muted-foreground">Behavior Score</p>
                <p className={`text-2xl font-bold ${getScoreColor(score)}`}>{score}%</p>
              </div>
            </div>
            <div className="relative h-2 w-full rounded-full bg-secondary overflow-hidden mt-3">
              <div className={`h-full rounded-full transition-all ${getProgressColor(score)}`} style={{ width: `${score}%` }} />
            </div>
          </div>
          <div className="bg-card rounded-xl border border-border p-5">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/20"><ClipboardCheck className="w-5 h-5 text-emerald-500" /></div>
              <div>
                <p className="text-xs text-muted-foreground">Attendance Rate</p>
                <p className="text-2xl font-bold text-foreground">{attendanceRate}%</p>
              </div>
            </div>
          </div>
          <div className="bg-card rounded-xl border border-border p-5">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/20"><BookOpen className="w-5 h-5 text-primary" /></div>
              <div>
                <p className="text-xs text-muted-foreground">Enrolled Courses</p>
                <p className="text-2xl font-bold text-foreground">{enrollments.length}</p>
              </div>
            </div>
          </div>
          <div className="bg-card rounded-xl border border-border p-5">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/20"><TrendingUp className="w-5 h-5 text-amber-500" /></div>
              <div>
                <p className="text-xs text-muted-foreground">Total Grades</p>
                <p className="text-2xl font-bold text-foreground">{grades.length}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Attendance */}
          <div className="bg-card rounded-xl border border-border p-5">
            <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
              <ClipboardCheck className="w-4 h-4 text-primary" />
              Recent Attendance
            </h3>
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {attendance.length === 0 ? (
                <p className="text-sm text-muted-foreground">No attendance records yet</p>
              ) : (
                attendance.slice(0, 15).map((record) => (
                  <div key={record.id} className="flex items-center justify-between p-2 rounded-lg bg-secondary/30">
                    <div>
                      <p className="text-sm font-medium text-foreground">{record.course_name}</p>
                      <p className="text-xs text-muted-foreground">{format(new Date(record.date), "MMM dd, yyyy")}</p>
                    </div>
                    <Badge className={
                      record.status === "present" ? "bg-emerald-500/10 text-emerald-500" :
                      record.status === "absent" ? "bg-destructive/10 text-destructive" :
                      "bg-amber-500/10 text-amber-500"
                    }>
                      {record.status}
                    </Badge>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Behavior History */}
          <div className="bg-card rounded-xl border border-border p-5">
            <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
              <History className="w-4 h-4 text-primary" />
              Behavior History
            </h3>
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {behaviorHistory.length === 0 ? (
                <p className="text-sm text-muted-foreground">No behavior records yet</p>
              ) : (
                behaviorHistory.map((record) => (
                  <div key={record.id} className="flex items-start gap-3 p-2 rounded-lg bg-secondary/30">
                    {record.action_type === "positive" ? (
                      <TrendingUp className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                    ) : (
                      <TrendingDown className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
                    )}
                    <div className="flex-1">
                      <p className="text-sm font-medium text-foreground">{record.action_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {record.score_change > 0 ? "+" : ""}{record.score_change}% • {format(new Date(record.created_at), "MMM dd, yyyy")}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Grades */}
        <div className="bg-card rounded-xl border border-border p-5">
          <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
            <GraduationCap className="w-4 h-4 text-primary" />
            My Grades
          </h3>
          {grades.length === 0 ? (
            <p className="text-sm text-muted-foreground">No grades recorded yet</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 text-muted-foreground font-medium">Course</th>
                    <th className="text-left py-2 text-muted-foreground font-medium">Type</th>
                    <th className="text-left py-2 text-muted-foreground font-medium">Grade</th>
                    <th className="text-left py-2 text-muted-foreground font-medium">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {grades.map((grade: any) => (
                    <tr key={grade.id} className="border-b border-border/50">
                      <td className="py-2 text-foreground">{grade.courses?.name || "—"}</td>
                      <td className="py-2 text-foreground capitalize">{grade.grade_type}</td>
                      <td className="py-2 text-foreground">{grade.grade_value ?? "—"}/{grade.max_value ?? 100}</td>
                      <td className="py-2 text-muted-foreground">{format(new Date(grade.graded_at), "MMM dd, yyyy")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
};

const AdminDashboard = () => {
  const { data: studentsCount = 0 } = useQuery({
    queryKey: ["dashboard-students-count"],
    queryFn: async () => {
      const { count, error } = await supabase.from("students").select("*", { count: "exact", head: true });
      if (error) return 0;
      return count || 0;
    },
  });

  const { data: coursesCount = 0 } = useQuery({
    queryKey: ["dashboard-courses-count"],
    queryFn: async () => {
      const { count, error } = await supabase.from("courses").select("*", { count: "exact", head: true }).eq("status", "active");
      if (error) return 0;
      return count || 0;
    },
  });

  const { data: incidentsCount = 0 } = useQuery({
    queryKey: ["dashboard-incidents-count"],
    queryFn: async () => {
      const { count, error } = await supabase.from("incidents").select("*", { count: "exact", head: true }).eq("status", "active");
      if (error) return 0;
      return count || 0;
    },
  });

  const { data: attendanceCount = 0 } = useQuery({
    queryKey: ["dashboard-attendance-count"],
    queryFn: async () => {
      const { count, error } = await supabase.from("attendance_records").select("*", { count: "exact", head: true });
      if (error) return 0;
      return count || 0;
    },
  });

  return (
    <MainLayout title="Dashboard">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <MetricCard title="Active Courses" value={coursesCount} icon={BookOpen} trend={{ value: 0, isPositive: true }} color="primary" />
        <MetricCard title="Active Alerts" value={incidentsCount} icon={AlertTriangle} trend={{ value: 0, isPositive: false }} color="warning" />
        <MetricCard title="Total Students" value={studentsCount} icon={Users} trend={{ value: 0, isPositive: true }} color="info" />
        <MetricCard title="Attendance Records" value={attendanceCount} icon={TrendingUp} trend={{ value: 0, isPositive: true }} color="success" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <AttendanceChart />
        <BehaviorPieChart />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RecentCourses />
        <GradesComposition />
      </div>
    </MainLayout>
  );
};

const Dashboard = () => {
  const { role } = useAuth();

  if (role === "student") return <StudentDashboard />;
  return <AdminDashboard />;
};

export default Dashboard;
