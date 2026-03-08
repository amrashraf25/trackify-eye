import MainLayout from "@/components/layout/MainLayout";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import MetricCard from "@/components/dashboard/MetricCard";
import AttendanceChart from "@/components/dashboard/AttendanceChart";
import BehaviorPieChart from "@/components/dashboard/BehaviorPieChart";
import GradesComposition from "@/components/dashboard/GradesComposition";
import RecentCourses from "@/components/dashboard/RecentCourses";
import { BookOpen, AlertTriangle, Users, TrendingUp, Stethoscope } from "lucide-react";
import { motion } from "framer-motion";

const DeanDashboard = () => {
  const { user } = useAuth();

  const { data: studentsCount = 0 } = useQuery({
    queryKey: ["dean-students-count"],
    queryFn: async () => {
      const { count } = await supabase.from("students").select("*", { count: "exact", head: true });
      return count || 0;
    },
  });

  const { data: coursesCount = 0 } = useQuery({
    queryKey: ["dean-courses-count"],
    queryFn: async () => {
      const { count } = await supabase.from("courses").select("*", { count: "exact", head: true }).eq("status", "active");
      return count || 0;
    },
  });

  const { data: doctorsCount = 0 } = useQuery({
    queryKey: ["dean-doctors-count"],
    queryFn: async () => {
      const { count } = await supabase.from("profiles").select("*", { count: "exact", head: true }).eq("role", "doctor");
      return count || 0;
    },
  });

  const { data: incidentsCount = 0 } = useQuery({
    queryKey: ["dean-incidents-count"],
    queryFn: async () => {
      const { count } = await supabase.from("incidents").select("*", { count: "exact", head: true }).eq("status", "active");
      return count || 0;
    },
  });

  return (
    <MainLayout title="Dashboard">
      <div className="space-y-6">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/10 via-accent/5 to-neon-cyan/10 p-6 neon-border"
        >
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-[80px] pointer-events-none" />
          <div className="relative z-10">
            <h2 className="text-2xl font-bold text-foreground mb-1">
              Welcome back, {user?.user_metadata?.full_name || "Dean"} 👋
            </h2>
            <p className="text-sm text-muted-foreground">Here's what's happening across your institution today.</p>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard title="Active Courses" value={coursesCount} icon={BookOpen} color="primary" index={0} linkTo="/courses" />
          <MetricCard title="Total Doctors" value={doctorsCount} icon={Stethoscope} color="info" index={1} linkTo="/doctors" />
          <MetricCard title="Total Students" value={studentsCount} icon={Users} color="success" index={2} linkTo="/students" />
          <MetricCard title="Active Alerts" value={incidentsCount} icon={AlertTriangle} color="warning" index={3} linkTo="/alerts" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <AttendanceChart />
          <BehaviorPieChart />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <RecentCourses />
          <GradesComposition />
        </div>
      </div>
    </MainLayout>
  );
};

export default DeanDashboard;
