import MainLayout from "@/components/layout/MainLayout";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import MetricCard from "@/components/dashboard/MetricCard";
import AttendanceChart from "@/components/dashboard/AttendanceChart";
import BehaviorPieChart from "@/components/dashboard/BehaviorPieChart";
import GradesComposition from "@/components/dashboard/GradesComposition";
import RecentCourses from "@/components/dashboard/RecentCourses";
import { BookOpen, AlertTriangle, Users, TrendingUp, GraduationCap } from "lucide-react";

const Dashboard = () => {
  const { role, user } = useAuth();

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

  // Student-specific dashboard
  if (role === "student") {
    return (
      <MainLayout title="My Dashboard">
        <div className="text-center py-12">
          <GraduationCap className="w-16 h-16 mx-auto mb-4 text-primary" />
          <h2 className="text-2xl font-semibold text-foreground mb-2">Welcome, {user?.user_metadata?.full_name || "Student"}</h2>
          <p className="text-muted-foreground">Your academic overview will appear here once data is available.</p>
        </div>
      </MainLayout>
    );
  }

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

export default Dashboard;
