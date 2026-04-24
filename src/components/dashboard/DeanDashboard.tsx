// Dean/admin dashboard: institution-wide overview with metrics, quick actions, charts, and live session status.
import MainLayout from "@/components/layout/MainLayout";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import MetricCard from "@/components/dashboard/MetricCard";
import AttendanceChart from "@/components/dashboard/AttendanceChart";
import BehaviorPieChart from "@/components/dashboard/BehaviorPieChart";
import GradesComposition from "@/components/dashboard/GradesComposition";
import RecentCourses from "@/components/dashboard/RecentCourses";
import { BookOpen, AlertTriangle, Users, Stethoscope, Camera, CalendarDays, BarChart2, Bell, Play, Eye, ShieldAlert, ChevronRight, Activity } from "lucide-react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";

// Base URL for the local AI/session API server
const LOCAL_API = "http://localhost:3001";

const DeanDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Total registered students
  const { data: studentsCount = 0 } = useQuery({
    queryKey: ["dean-students-count"],
    queryFn: async () => {
      const { count } = await supabase.from("students").select("*", { count: "exact" }).limit(0);
      return count || 0;
    },
  });

  // Number of currently active courses
  const { data: coursesCount = 0 } = useQuery({
    queryKey: ["dean-courses-count"],
    queryFn: async () => {
      const { count } = await supabase.from("courses").select("*", { count: "exact" }).eq("status", "active").limit(0);
      return count || 0;
    },
  });

  // Number of doctor-role users in the system
  const { data: doctorsCount = 0 } = useQuery({
    queryKey: ["dean-doctors-count"],
    queryFn: async () => {
      const { count } = await supabase.from("profiles").select("*", { count: "exact" }).eq("role", "doctor").limit(0);
      return count || 0;
    },
  });

  // Count of unresolved (active) incidents/alerts
  const { data: incidentsCount = 0 } = useQuery({
    queryKey: ["dean-incidents-count"],
    queryFn: async () => {
      const { count } = await supabase.from("incidents").select("*", { count: "exact" }).eq("status", "active").limit(0);
      return count || 0;
    },
  });

  // Poll the local session API every 10 s for the number of live camera sessions
  const { data: activeSessionsCount = 0 } = useQuery({
    queryKey: ["dean-active-sessions"],
    queryFn: async () => {
      try {
        const r = await fetch(`${LOCAL_API}/api/session/list?status=active&limit=100`);
        if (!r.ok) return 0;
        const data = await r.json();
        return Array.isArray(data) ? data.length : 0;
      } catch { return 0; }
    },
    refetchInterval: 10000,
  });

  // Quick-action buttons rendered in the dashboard hero area
  const quickActions = [
    { icon: Camera, label: "Live Camera", desc: "Monitor rooms", color: "from-primary/20 to-cyan-500/10 border-primary/25 text-primary", onClick: () => navigate("/camera") },
    { icon: CalendarDays, label: "Schedules", desc: "View timetable", color: "from-violet-500/20 to-purple-500/10 border-violet-500/25 text-violet-400", onClick: () => navigate("/schedules") },
    { icon: ShieldAlert, label: "Alerts", desc: "Check incidents", color: "from-red-500/20 to-orange-500/10 border-red-500/25 text-red-400", onClick: () => navigate("/alerts") },
    { icon: BarChart2, label: "Reports", desc: "Analytics", color: "from-emerald-500/20 to-teal-500/10 border-emerald-500/25 text-emerald-400", onClick: () => navigate("/reports") },
  ];

  // Choose a time-appropriate greeting for the banner
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <MainLayout title="Dashboard">
      <div className="space-y-6">
        {/* Hero Banner */}
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 200, damping: 22 }}
          className="relative overflow-hidden rounded-2xl border border-black/[0.08] dark:border-white/[0.08] bg-gradient-to-br from-slate-50 via-blue-50/50 to-slate-100 dark:from-[hsl(228,35%,8%)] dark:via-[hsl(225,30%,6%)] dark:to-[hsl(230,35%,7%)]"
        >
          <div className="absolute inset-0 pointer-events-none opacity-10 dark:opacity-25" style={{
            backgroundImage: "linear-gradient(hsl(217 91% 60% / 0.07) 1px, transparent 1px), linear-gradient(90deg, hsl(217 91% 60% / 0.07) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }} />
          <div className="absolute -top-16 -right-16 w-72 h-72 rounded-full bg-primary/12 blur-[80px] pointer-events-none" />
          <div className="absolute -bottom-12 -left-12 w-56 h-56 rounded-full bg-accent/10 blur-[60px] pointer-events-none" />

          <div className="relative z-10 p-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <span className="text-[10px] uppercase tracking-[0.15em] text-primary/80 font-bold">Administration Panel</span>
                <h2 className="text-2xl font-black text-foreground tracking-tight mt-1">
                  {greeting}, <span className="gradient-text">{user?.user_metadata?.full_name?.split(" ")[0] || "Dean"}</span>
                </h2>
                <p className="text-sm text-muted-foreground mt-1">Here's what's happening across your institution today.</p>
              </div>
              <div className="flex items-center gap-3">
                {activeSessionsCount > 0 && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-500/12 border border-emerald-500/25 text-emerald-400 text-xs font-semibold">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    {activeSessionsCount} Live Session{activeSessionsCount !== 1 ? "s" : ""}
                  </div>
                )}
              </div>
            </div>
          </div>
        </motion.div>

        {/* Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard title="Active Courses" value={coursesCount} icon={BookOpen} color="primary" index={0} linkTo="/courses" />
          <MetricCard title="Total Doctors" value={doctorsCount} icon={Stethoscope} color="info" index={1} linkTo="/doctors" />
          <MetricCard title="Total Students" value={studentsCount} icon={Users} color="success" index={2} linkTo="/students" />
          <MetricCard title="Active Alerts" value={incidentsCount} icon={AlertTriangle} color="warning" index={3} linkTo="/alerts" />
        </div>

        {/* Quick Actions */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
            <Activity className="w-3.5 h-3.5" /> Quick Actions
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {quickActions.map((action, i) => (
              <motion.button
                key={action.label}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 + i * 0.05 }}
                whileHover={{ y: -2, scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={action.onClick}
                className={`quick-action relative overflow-hidden rounded-2xl bg-gradient-to-b ${action.color} border p-4 text-left`}
              >
                <action.icon className="w-5 h-5 mb-2.5" />
                <p className="text-sm font-bold text-foreground">{action.label}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{action.desc}</p>
                <ChevronRight className="absolute top-4 right-3 w-4 h-4 text-muted-foreground/30" />
              </motion.button>
            ))}
          </div>
        </motion.div>

        {/* Charts */}
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
