import MainLayout from "@/components/layout/MainLayout";
import { useQuery } from "@tanstack/react-query";

const LOCAL_API = "http://localhost:3001";
import { supabase } from "@/integrations/supabase/client";
import DoctorDashboard from "@/components/dashboard/DoctorDashboard";
import DeanDashboard from "@/components/dashboard/DeanDashboard";
import { useAuth } from "@/hooks/useAuth";
import MetricCard from "@/components/dashboard/MetricCard";
import AttendanceChart from "@/components/dashboard/AttendanceChart";
import BehaviorPieChart from "@/components/dashboard/BehaviorPieChart";
import GradesComposition from "@/components/dashboard/GradesComposition";
import RecentCourses from "@/components/dashboard/RecentCourses";
import { BookOpen, AlertTriangle, Users, TrendingUp, GraduationCap, ClipboardCheck, Activity, History, TrendingDown, Shield, Bell, Star, Zap, Target, Award, ChevronRight, BarChart2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";

/** Maps a percentage score to a letter grade */
function toLetterGrade(pct: number): string {
  if (pct >= 90) return "A+";
  if (pct >= 80) return "A";
  if (pct >= 70) return "B";
  if (pct >= 60) return "C";
  if (pct >= 50) return "D";
  return "F";
}

/* -- Course color palette (6 variants, cycle by index) -- */
const COURSE_PALETTE = [
  { bg: "from-blue-500/20 to-cyan-500/5",     border: "border-blue-500/25",    icon: "bg-blue-500/15 text-blue-400",    bar: "bg-blue-500",   badge: "bg-blue-500/15 text-blue-400 border-blue-500/25"    },
  { bg: "from-violet-500/20 to-purple-500/5", border: "border-violet-500/25",  icon: "bg-violet-500/15 text-violet-400",bar: "bg-violet-500", badge: "bg-violet-500/15 text-violet-400 border-violet-500/25"},
  { bg: "from-emerald-500/20 to-teal-500/5",  border: "border-emerald-500/25", icon: "bg-emerald-500/15 text-emerald-400",bar:"bg-emerald-500",badge: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25"},
  { bg: "from-amber-500/20 to-orange-500/5",  border: "border-amber-500/25",   icon: "bg-amber-500/15 text-amber-400",  bar: "bg-amber-500",  badge: "bg-amber-500/15 text-amber-400 border-amber-500/25"  },
  { bg: "from-rose-500/20 to-pink-500/5",     border: "border-rose-500/25",    icon: "bg-rose-500/15 text-rose-400",    bar: "bg-rose-500",   badge: "bg-rose-500/15 text-rose-400 border-rose-500/25"    },
  { bg: "from-sky-500/20 to-indigo-500/5",    border: "border-sky-500/25",     icon: "bg-sky-500/15 text-sky-400",      bar: "bg-sky-500",    badge: "bg-sky-500/15 text-sky-400 border-sky-500/25"       },
];

/* -- Animated SVG score ring -- */
const ScoreRing = ({ score, size = 120 }: { score: number; size?: number }) => {
  const [animated, setAnimated] = useState(false);
  useEffect(() => { const t = setTimeout(() => setAnimated(true), 400); return () => clearTimeout(t); }, []);

  const r     = 44;
  const cx    = size / 2;
  const circ  = 2 * Math.PI * r;
  const offset = animated ? circ - (score / 100) * circ : circ;
  // Green ≥80%, Amber ≥60%, Red <60%
  const color  = score >= 80 ? "#22c55e" : score >= 60 ? "#f59e0b" : "#ef4444";
  const glow   = score >= 80 ? "drop-shadow(0 0 8px #22c55e80)" : score >= 60 ? "drop-shadow(0 0 8px #f59e0b80)" : "drop-shadow(0 0 8px #ef444480)";

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ filter: animated ? glow : "none", transition: "filter 0.5s" }}>
      {/* Track */}
      <circle cx={cx} cy={cx} r={r} fill="none" stroke="hsl(225 20% 14%)" strokeWidth="8" />
      {/* Progress */}
      <circle
        cx={cx} cy={cx} r={r} fill="none"
        stroke={color} strokeWidth="8"
        strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={offset}
        style={{ transform: `rotate(-90deg)`, transformOrigin: `${cx}px ${cx}px`, transition: "stroke-dashoffset 1.2s cubic-bezier(0.34,1.56,0.64,1)" }}
      />
      {/* Label */}
      <text x={cx} y={cx - 6} textAnchor="middle" fill={color} fontSize="22" fontWeight="800" fontFamily="Outfit,sans-serif">{score}</text>
      <text x={cx} y={cx + 12} textAnchor="middle" fill="hsl(218 11% 55%)" fontSize="10" fontFamily="Outfit,sans-serif">/ 100</text>
    </svg>
  );
};

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

  // Sessions = attendance history (local-api, not Supabase)
  const { data: recentSessions = [] } = useQuery<any[]>({
    queryKey: ["my-sessions-dashboard", student?.id],
    queryFn: async () => {
      if (!student?.id) return [];
      const r = await fetch(`${LOCAL_API}/api/analytics/student/${student.id}/sessions?limit=30`);
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!student?.id,
  });

  // Behavior profile (local-api): { score, history, recent }
  const { data: behaviorProfile } = useQuery<any>({
    queryKey: ["my-behavior-profile-dashboard", student?.id],
    queryFn: async () => {
      if (!student?.id) return null;
      const r = await fetch(`${LOCAL_API}/api/analytics/student/${student.id}/behavior`);
      if (!r.ok) return null;
      return r.json();
    },
    enabled: !!student?.id,
  });

  const behaviorHistory: any[] = behaviorProfile?.recent || [];

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

  const { data: notifications = [] } = useQuery<any[]>({
    queryKey: ["my-dashboard-notifications", student?.id],
    queryFn: async () => {
      if (!student?.id) return [];
      const r = await fetch(`${LOCAL_API}/api/notifications?student_id=${student.id}&limit=10`);
      if (!r.ok) return [];
      return r.json();
    },
    enabled: !!student?.id,
  });
  const score = behaviorScore?.score ?? behaviorProfile?.score?.score ?? 100;
  const endedSessions = recentSessions.filter((s: any) => s.status === "ended");
  const attendedSessions = endedSessions.filter((s: any) => s.my_status === "present" || s.my_status === "late");
  const attendanceRate = endedSessions.length > 0 ? Math.round((attendedSessions.length / endedSessions.length) * 100) : 0;

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
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/30 to-accent/20 flex items-center justify-center shadow-glow-primary">
            <GraduationCap className="w-10 h-10 text-primary" />
          </div>
          <h2 className="text-2xl font-bold text-foreground">Welcome, {user?.user_metadata?.full_name || "Student"}</h2>
          <p className="text-muted-foreground text-sm">Your student profile is not linked yet. Please contact your admin.</p>
        </motion.div>
      </MainLayout>
    );
  }

  const displayName = student.full_name || user?.user_metadata?.full_name || "Student";
  const firstWord   = displayName.split(" ")[0];
  const initials    = displayName.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase();
  const unreadCount = notifications.filter((n: any) => !n.is_read && !n.read).length;

  // Time-based greeting
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <MainLayout title="My Dashboard">
      <div className="space-y-5">

        {/* --------------- HERO BANNER --------------- */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, type: "spring", stiffness: 180, damping: 20 }}
          className="relative overflow-hidden rounded-2xl border border-black/[0.08] dark:border-white/[0.08] bg-gradient-to-br from-slate-50 via-blue-50/50 to-slate-100 dark:from-[hsl(228,35%,8%)] dark:via-[hsl(225,30%,6%)] dark:to-[hsl(230,35%,7%)]"
        >
          {/* Grid pattern */}
          <div className="absolute inset-0 pointer-events-none opacity-10 dark:opacity-30" style={{
            backgroundImage: "linear-gradient(hsl(217 91% 60% / 0.07) 1px, transparent 1px), linear-gradient(90deg, hsl(217 91% 60% / 0.07) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }} />

          {/* Glow blobs */}
          <div className="absolute -top-16 -right-16 w-72 h-72 rounded-full bg-primary/12 blur-[80px] pointer-events-none" />
          <div className="absolute -bottom-12 -left-12  w-56 h-56 rounded-full bg-accent/10  blur-[70px] pointer-events-none" />
          <div className="absolute top-0 left-1/3        w-48 h-32 rounded-full bg-neon-cyan/6 blur-[60px] pointer-events-none" />

          {/* Diagonal accent stripe */}
          <div className="absolute top-0 right-0 w-96 h-full overflow-hidden pointer-events-none">
            <div className="absolute top-0 right-0 w-64 h-full opacity-[0.025]" style={{
              background: "linear-gradient(135deg, transparent 40%, hsl(217 91% 60%) 40%, hsl(217 91% 60%) 41%, transparent 41%)",
            }} />
          </div>

          <div className="relative z-10 p-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">

              {/* Score ring � larger, more prominent */}
              <div className="flex-shrink-0 flex flex-col items-center gap-1.5">
                <div className="relative">
                  <div className="absolute inset-0 rounded-full blur-xl scale-110 pointer-events-none"
                    style={{ background: `radial-gradient(circle, ${score >= 80 ? "hsl(160 84% 39% / 0.25)" : score >= 60 ? "hsl(38 92% 50% / 0.25)" : "hsl(0 84% 60% / 0.25)"}, transparent)` }} />
                  <ScoreRing score={score} size={120} />
                </div>
                <span className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-semibold">Behavior Score</span>
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[10px] uppercase tracking-[0.15em] text-primary/80 font-bold">Student Portal</span>
                  <span className="w-1 h-1 rounded-full bg-muted-foreground/40" />
                  <span className="text-[10px] text-muted-foreground font-mono">{student.student_code}</span>
                  {student.year_level && (
                    <>
                      <span className="w-1 h-1 rounded-full bg-muted-foreground/40" />
                      <span className="text-[10px] text-muted-foreground">Year {student.year_level}</span>
                    </>
                  )}
                </div>

                <h2 className="text-2xl sm:text-[2rem] font-black text-foreground tracking-tight mb-1 leading-tight">
                  {greeting},{" "}
                  <span className="gradient-text">{firstWord}</span>
                </h2>
                <p className="text-sm text-muted-foreground mb-5 leading-relaxed">
                  {score >= 80 ? "?? You're performing excellently � keep the momentum going!" :
                   score >= 60 ? "?? Good progress. A little more effort goes a long way." :
                   "?? Let's work on improving your behavior score together."}
                </p>

                {/* Stat pills */}
                <div className="flex flex-wrap gap-2">
                  {[
                    { icon: ClipboardCheck, label: "Attendance",  value: `${attendanceRate}%`,        style: { background: "hsl(160 84% 39% / 0.12)", border: "1px solid hsl(160 84% 39% / 0.25)", color: "#4ade80" } },
                    { icon: BookOpen,       label: "Courses",     value: `${enrollments.length}`,      style: { background: "hsl(217 91% 60% / 0.12)", border: "1px solid hsl(217 91% 60% / 0.25)", color: "#60a5fa" } },
                    { icon: Award,         label: "Grades",      value: `${grades.length}`,           style: { background: "hsl(38 92% 50% / 0.12)",  border: "1px solid hsl(38 92% 50% / 0.25)",  color: "#fbbf24" } },
                  ].map(({ icon: Icon, label, value, style }) => (
                    <div key={label} className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold backdrop-blur-sm" style={style}>
                      <Icon className="w-3.5 h-3.5" style={{ color: style.color }} />
                      <span className="font-bold" style={{ color: style.color }}>{value}</span>
                      <span style={{ color: style.color, opacity: 0.6 }}>{label}</span>
                    </div>
                  ))}
                  {unreadCount > 0 && (
                    <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold"
                      style={{ background: "hsl(0 84% 60% / 0.12)", border: "1px solid hsl(0 84% 60% / 0.3)", color: "#f87171" }}>
                      <Bell className="w-3.5 h-3.5" style={{ color: "#f87171" }} />
                      <span className="font-bold" style={{ color: "#f87171" }}>{unreadCount}</span>
                      <span style={{ color: "#f87171", opacity: 0.6 }}>New alerts</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Large avatar */}
              <div className="hidden lg:flex flex-shrink-0 flex-col items-center gap-2">
                <div className="relative">
                  <div className="absolute inset-0 rounded-2xl blur-xl bg-primary/30 scale-110" />
                  <div className="relative w-20 h-20 rounded-2xl flex items-center justify-center text-3xl font-black text-white shadow-[0_0_30px_hsl(217_91%_60%/0.35)]"
                    style={{ background: "linear-gradient(135deg, hsl(217 91% 60% / 0.5), hsl(263 70% 58% / 0.4))", border: "1px solid hsl(217 91% 60% / 0.3)" }}>
                    {initials}
                  </div>
                </div>
                <span className="text-[9px] uppercase tracking-widest text-white/25">Student</span>
              </div>

            </div>
          </div>
        </motion.div>

        {/* --------------- QUICK ACTIONS --------------- */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { icon: ClipboardCheck, label: "My Attendance", color: "from-emerald-500/20 to-emerald-500/5 border-emerald-500/25 text-emerald-400", path: "/attendance" },
              { icon: Award, label: "My Grades", color: "from-amber-500/20 to-amber-500/5 border-amber-500/25 text-amber-400", path: "/courses" },
              { icon: BookOpen, label: "My Courses", color: "from-primary/20 to-primary/5 border-primary/25 text-primary", path: "/courses" },
              { icon: Bell, label: "Notifications", color: "from-violet-500/20 to-violet-500/5 border-violet-500/25 text-violet-400", path: "/alerts" },
            ].map((action, i) => (
              <motion.a
                key={action.label}
                href={action.path}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 + i * 0.05 }}
                whileHover={{ y: -3, scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={`tilt-3d quick-action relative overflow-hidden rounded-2xl bg-gradient-to-b ${action.color} border p-4 text-left no-underline block`}
              >
                <action.icon className="w-5 h-5 mb-2" />
                <p className="text-sm font-bold text-foreground">{action.label}</p>
                <ChevronRight className="absolute top-4 right-3 w-4 h-4 text-muted-foreground/30" />
              </motion.a>
            ))}
          </div>
        </motion.div>

        {/* --------------- MAIN GRID --------------- */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* LEFT: Courses (2/3 width) */}
          <div className="lg:col-span-2 space-y-6">

            {/* Course cards */}
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-primary/15 border border-primary/20 flex items-center justify-center">
                    <BookOpen className="w-3.5 h-3.5 text-primary" />
                  </div>
                  My Courses
                  <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px] font-bold">{enrollments.length}</Badge>
                </h3>
                <a href="/courses" className="text-[11px] text-primary hover:text-primary/80 flex items-center gap-0.5 transition-colors font-medium">
                  View all <ChevronRight className="w-3 h-3" />
                </a>
              </div>

              {enrollments.length === 0 ? (
                <div className="glass rounded-2xl p-8 text-center border border-border/50">
                  <BookOpen className="w-10 h-10 mx-auto mb-2 text-muted-foreground/30" />
                  <p className="text-sm text-muted-foreground">No courses enrolled yet</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {enrollments.map((enrollment: any, i: number) => {
                    const course  = enrollment.courses;
                    if (!course) return null;
                    const palette = COURSE_PALETTE[i % COURSE_PALETTE.length];
                    const progress = 65; // placeholder — replace with real course progress data
                    const courseLetter = (course.name || "?")[0].toUpperCase();
                    return (
                      <motion.div
                        key={enrollment.id}
                        initial={{ opacity: 0, y: 14, scale: 0.96 }}
                        animate={{ opacity: 1, y: 0,  scale: 1    }}
                        transition={{ delay: 0.2 + i * 0.07, type: "spring", stiffness: 300, damping: 24 }}
                        whileHover={{ y: -4, transition: { duration: 0.18 } }}
                        className={`relative overflow-hidden rounded-2xl border bg-gradient-to-br ${palette.bg} ${palette.border} p-4 cursor-pointer group`}
                        style={{ boxShadow: "0 2px 20px rgba(0,0,0,0.15)" }}
                      >
                        {/* Hover glow overlay */}
                        <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-400 pointer-events-none rounded-2xl`}
                          style={{ boxShadow: `inset 0 0 0 1px ${palette.border.replace("border-", "").replace("/25", "")} / 0.5` }} />

                        {/* Top row */}
                        <div className="flex items-start justify-between mb-3">
                          {/* Letter avatar */}
                          <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 text-lg font-black ${palette.icon}`}
                            style={{ textShadow: "0 1px 4px rgba(0,0,0,0.3)" }}>
                            {courseLetter}
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            <Badge className={`text-[10px] border font-mono ${palette.badge}`}>{course.course_code}</Badge>
                            <Badge className={`text-[10px] border ${palette.badge}`}>{course.credits} cr</Badge>
                          </div>
                        </div>

                        {/* Course name */}
                        <p className="font-bold text-foreground text-sm leading-snug mb-0.5 group-hover:text-primary transition-colors">{course.name}</p>
                        <p className="text-[11px] text-muted-foreground mb-3">{course.semester}</p>

                        {/* Progress bar */}
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Progress</span>
                            <span className={`text-[10px] font-bold ${palette.badge.split(" ")[1]}`}>{progress}%</span>
                          </div>
                          <div className="h-1.5 bg-black/25 rounded-full overflow-hidden">
                            <motion.div
                              className={`h-full rounded-full ${palette.bar} shadow-sm`}
                              initial={{ width: 0 }}
                              animate={{ width: `${progress}%` }}
                              transition={{ delay: 0.4 + i * 0.07, duration: 0.9, ease: "easeOut" }}
                            />
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </motion.div>

            {/* Attendance heatmap */}
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
              className="glass rounded-2xl p-5 border border-border/50">

              {/* Section header */}
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-emerald-500/15 border border-emerald-500/20 flex items-center justify-center">
                    <ClipboardCheck className="w-3.5 h-3.5 text-emerald-400" />
                  </div>
                  Attendance
                </h3>
                <div className="flex items-center gap-2">
                  <div className={`text-2xl font-black tabular-nums ${attendanceRate >= 80 ? "text-emerald-400" : attendanceRate >= 60 ? "text-amber-400" : "text-red-400"}`}>
                    {attendanceRate}<span className="text-sm font-semibold opacity-60">%</span>
                  </div>
                </div>
              </div>

              {endedSessions.length === 0 ? (
                <div className="text-center py-6">
                  <ClipboardCheck className="w-8 h-8 mx-auto mb-2 text-muted-foreground/20" />
                  <p className="text-sm text-muted-foreground">No records yet</p>
                </div>
              ) : (
                <>
                  {/* Progress bar summary */}
                  <div className="mb-4">
                    <div className="h-2 rounded-full bg-secondary/50 overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${attendanceRate}%` }}
                        transition={{ delay: 0.5, duration: 1, ease: "easeOut" }}
                        className={`h-full rounded-full ${attendanceRate >= 80 ? "bg-emerald-500" : attendanceRate >= 60 ? "bg-amber-500" : "bg-destructive"}`}
                        style={{ boxShadow: attendanceRate >= 80 ? "0 0 8px #22c55e60" : attendanceRate >= 60 ? "0 0 8px #f59e0b60" : "0 0 8px #ef444460" }}
                      />
                    </div>
                  </div>

                  {/* Heatmap dots — one per ended session */}
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {endedSessions.slice(0, 35).map((sess: any) => {
                      const st = sess.my_status || "absent";
                      return (
                        <div
                          key={sess.id}
                          title={`${sess.course_name || sess.course_id} — ${format(new Date(sess.started_at), "MMM dd")} — ${st}`}
                          className={`w-5 h-5 rounded-md cursor-default transition-all duration-150 hover:scale-125 hover:z-10 ${
                            st === "present" ? "bg-emerald-500/80"  :
                            st === "absent"  ? "bg-destructive/70" :
                            st === "late"    ? "bg-amber-500/70"   :
                            "bg-secondary/40"
                          }`}
                          style={st === "present" ? { boxShadow: "0 0 6px #22c55e55" } : {}}
                        />
                      );
                    })}
                  </div>

                  {/* Legend */}
                  <div className="flex items-center gap-4 text-[10px] text-muted-foreground mb-4">
                    {[
                      { color: "bg-emerald-500/80", shadow: "#22c55e55", label: "Present" },
                      { color: "bg-amber-500/70",   shadow: "",          label: "Late"    },
                      { color: "bg-destructive/70",  shadow: "",          label: "Absent"  },
                    ].map(({ color, shadow, label }) => (
                      <div key={label} className="flex items-center gap-1.5">
                        <div className={`w-3 h-3 rounded-sm ${color}`} style={shadow ? { boxShadow: `0 0 4px ${shadow}` } : {}} />
                        {label}
                      </div>
                    ))}
                  </div>

                  {/* Recent session list */}
                  <div className="space-y-1.5">
                    {endedSessions.slice(0, 5).map((sess: any, i: number) => {
                      const st = sess.my_status || "absent";
                      return (
                      <motion.div
                        key={sess.id}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.6 + i * 0.04 }}
                        className="flex items-center justify-between py-2 px-3 rounded-xl bg-secondary/15 hover:bg-secondary/30 transition-colors group"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                            st === "present" ? "bg-emerald-400" :
                            st === "absent"  ? "bg-red-400"     : "bg-amber-400"
                          }`} style={st === "present" ? { boxShadow: "0 0 6px #4ade80" } : {}} />
                          <div>
                            <p className="text-xs font-medium text-foreground">{sess.course_name || sess.course_id}</p>
                            <p className="text-[10px] text-muted-foreground">{format(new Date(sess.started_at), "MMM dd, yyyy")}</p>
                          </div>
                        </div>
                        <Badge className={`text-[10px] border capitalize ${
                          st === "present" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
                          st === "absent"  ? "bg-destructive/10 text-destructive border-destructive/20" :
                          "bg-amber-500/10 text-amber-400 border-amber-500/20"
                        }`}>{st}</Badge>
                      </motion.div>
                    );
                    })}
                  </div>
                </>
              )}
            </motion.div>

            {/* Grades */}
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
              className="glass rounded-2xl p-5 border border-border/50">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-amber-500/15 border border-amber-500/20 flex items-center justify-center">
                    <GraduationCap className="w-3.5 h-3.5 text-amber-400" />
                  </div>
                  My Grades
                </h3>
                <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20 text-[10px]">{grades.length} records</Badge>
              </div>
              {grades.length === 0 ? (
                <div className="text-center py-6">
                  <GraduationCap className="w-8 h-8 mx-auto mb-2 text-muted-foreground/20" />
                  <p className="text-sm text-muted-foreground">No grades recorded yet</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {grades.slice(0, 8).map((grade: any, i: number) => {
                    const pct = Math.round(((grade.grade_value ?? 0) / (grade.max_value ?? 100)) * 100);
                    const gradeBar   = pct >= 80 ? "bg-emerald-500"  : pct >= 60 ? "bg-amber-500"  : "bg-destructive";
                    const textColor  = pct >= 80 ? "text-emerald-400": pct >= 60 ? "text-amber-400": "text-red-400";
                    const badgeCls   = pct >= 80 ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/25"
                                     : pct >= 60 ? "bg-amber-500/15 text-amber-400 border-amber-500/25"
                                     :             "bg-red-500/15 text-red-400 border-red-500/25";
                    const letterGrade = toLetterGrade(pct);
                    return (
                      <motion.div
                        key={grade.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.45 + i * 0.05 }}
                        className="flex items-center gap-3 p-3 rounded-xl bg-secondary/15 hover:bg-secondary/30 transition-colors group"
                      >
                        {/* Letter grade badge */}
                        <div className={`w-10 h-10 rounded-xl border flex items-center justify-center text-sm font-black flex-shrink-0 ${badgeCls}`}>
                          {letterGrade}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1.5">
                            <p className="text-xs font-semibold text-foreground truncate">{grade.courses?.name || "�"}</p>
                            <span className={`text-xs font-bold tabular-nums ${textColor}`}>{grade.grade_value ?? "�"}/{grade.max_value ?? 100}</span>
                          </div>
                          <div className="h-1.5 bg-secondary/60 rounded-full overflow-hidden">
                            <motion.div
                              className={`h-full rounded-full ${gradeBar}`}
                              initial={{ width: 0 }}
                              animate={{ width: `${pct}%` }}
                              transition={{ delay: 0.5 + i * 0.05, duration: 0.8, ease: "easeOut" }}
                            />
                          </div>
                          <div className="flex items-center justify-between mt-1">
                            <span className="text-[10px] text-muted-foreground capitalize">{grade.grade_type}</span>
                            <span className="text-[10px] text-muted-foreground">{format(new Date(grade.graded_at), "MMM dd, yyyy")}</span>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          </div>

          {/* RIGHT: Behavior + Notifications (1/3 width) */}
          <div className="space-y-4">

            {/* Behavior history � timeline style */}
            <motion.div initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}
              className="glass rounded-2xl p-5 border border-border/50">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-primary/15 border border-primary/20 flex items-center justify-center">
                    <Activity className="w-3.5 h-3.5 text-primary" />
                  </div>
                  Behavior Log
                </h3>
                <span className="text-[10px] text-muted-foreground bg-secondary/50 px-2 py-1 rounded-lg">
                  {behaviorHistory.length} events
                </span>
              </div>

              {behaviorHistory.length === 0 ? (
                <div className="text-center py-8">
                  <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
                    <Shield className="w-6 h-6 text-primary/30" />
                  </div>
                  <p className="text-xs font-medium text-muted-foreground">All clear!</p>
                  <p className="text-[10px] text-muted-foreground/60 mt-0.5">No behavior records yet</p>
                </div>
              ) : (
                <div className="relative max-h-[340px] overflow-y-auto pr-1">
                  {/* Vertical timeline line */}
                  <div className="absolute left-[18px] top-2 bottom-2 w-px bg-gradient-to-b from-primary/30 via-border/50 to-transparent pointer-events-none" />
                  <div className="space-y-3">
                    {behaviorHistory.map((record: any, i: number) => {
                      const sev = record.severity || "low";
                      const isCritical = sev === "critical" || sev === "high";
                      const label = (record.behavior_type || "").charAt(0).toUpperCase() + (record.behavior_type || "").slice(1);
                      return (
                      <motion.div
                        key={record.id}
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.25 + i * 0.04 }}
                        className="flex items-start gap-3 group"
                      >
                        {/* Timeline node */}
                        <div className={`relative z-10 w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm transition-all group-hover:scale-105 ${
                          isCritical
                            ? "bg-red-500/15 border border-red-500/25"
                            : "bg-amber-500/15 border border-amber-500/25"
                        }`}>
                          <TrendingDown className={`w-4 h-4 ${isCritical ? "text-red-400" : "text-amber-400"}`} />
                        </div>

                        {/* Content */}
                        <div className={`flex-1 min-w-0 p-2.5 rounded-xl border transition-colors ${
                          isCritical
                            ? "bg-red-500/5 border-red-500/10 hover:bg-red-500/10"
                            : "bg-amber-500/5 border-amber-500/10 hover:bg-amber-500/10"
                        }`}>
                          <p className="text-xs font-semibold text-foreground truncate">{label} detected</p>
                          <div className="flex items-center justify-between mt-0.5">
                            <span className={`text-[10px] font-bold ${isCritical ? "text-red-400" : "text-amber-400"} capitalize`}>
                              {sev}
                            </span>
                            <span className="text-[9px] text-muted-foreground/50">{format(new Date(record.started_at || record.created_at), "MMM dd")}</span>
                          </div>
                        </div>
                      </motion.div>
                      );
                    })}
                  </div>
                </div>
              )}
            </motion.div>

            {/* Notifications / Alerts */}
            <motion.div initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }}
              className={`glass rounded-2xl p-5 border transition-all ${
                unreadCount > 0 ? "border-destructive/30" : "border-border/50"
              }`}
              style={unreadCount > 0 ? { boxShadow: "0 0 20px hsl(0 84% 60% / 0.06)" } : {}}>

              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center border ${
                    unreadCount > 0
                      ? "bg-destructive/15 border-destructive/25"
                      : "bg-secondary/50 border-border/50"
                  }`}>
                    <Bell className={`w-3.5 h-3.5 ${unreadCount > 0 ? "text-destructive" : "text-muted-foreground"}`} />
                  </div>
                  Alerts
                </h3>
                {unreadCount > 0 && (
                  <motion.div
                    animate={{ scale: [1, 1.1, 1] }}
                    transition={{ repeat: Infinity, duration: 2 }}
                  >
                    <Badge className="bg-destructive/15 text-destructive border-destructive/30 text-[10px] font-bold shadow-[0_0_12px_hsl(0_84%_60%/0.3)]">
                      {unreadCount} new
                    </Badge>
                  </motion.div>
                )}
              </div>

              {notifications.length === 0 ? (
                <div className="text-center py-8">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center mx-auto mb-3">
                    <Shield className="w-6 h-6 text-emerald-400/50" />
                  </div>
                  <p className="text-xs font-medium text-muted-foreground">All clear!</p>
                  <p className="text-[10px] text-muted-foreground/60 mt-0.5">No alerts at this time</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {notifications.map((notif: any, i: number) => {
                    const isRead = notif.is_read || notif.read === 1;
                    return (
                    <motion.div
                      key={notif.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.35 + i * 0.05 }}
                      className={`relative flex items-start gap-2.5 p-3 rounded-xl border transition-all ${
                        isRead
                          ? "bg-secondary/10 border-white/[0.04] hover:bg-secondary/20"
                          : "bg-destructive/5 border-destructive/20 hover:bg-destructive/8"
                      }`}
                    >
                      {/* Unread pulse dot */}
                      {!isRead && (
                        <div className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-destructive border-2 border-background shadow-[0_0_8px_#ef4444]" />
                      )}
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                        isRead ? "bg-secondary/50" : "bg-destructive/15"
                      }`}>
                        <AlertTriangle className={`w-3.5 h-3.5 ${isRead ? "text-muted-foreground" : "text-destructive"}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-foreground">{notif.title}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">{notif.message}</p>
                        <p className="text-[9px] text-muted-foreground/40 mt-1">{format(new Date(notif.created_at), "MMM dd � HH:mm")}</p>
                      </div>
                    </motion.div>
                    );
                  })}
                </div>
              )}
            </motion.div>

          </div>
        </div>
      </div>
    </MainLayout>
  );
};

const AdminDashboard = () => {
  const [insightsWeek, setInsightsWeek] = useState(1);

  const { data: ranking } = useQuery<{ disciplined: any[]; violating: any[] }>({
    queryKey: ["admin-ranking"],
    queryFn: async () => {
      const r = await fetch(`${LOCAL_API}/api/analytics/ranking?limit=5`);
      return r.ok ? r.json() : { disciplined: [], violating: [] };
    },
    refetchInterval: 60000,
  });

  const { data: insights } = useQuery<any>({
    queryKey: ["admin-insights", insightsWeek],
    queryFn: async () => {
      const r = await fetch(`${LOCAL_API}/api/analytics/insights?week_number=${insightsWeek}`);
      return r.ok ? r.json() : null;
    },
  });

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
      <div className="space-y-6">
        {/* Welcome Banner */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/10 via-accent/5 to-neon-cyan/10 p-6 neon-border"
        >
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-[80px] pointer-events-none" />
          <div className="relative z-10">
            <h2 className="text-2xl font-bold text-foreground mb-1">Welcome back ??</h2>
            <p className="text-sm text-muted-foreground">Here's what's happening across your institution today.</p>
          </div>
        </motion.div>

        {/* Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard title="Active Courses" value={coursesCount} icon={BookOpen} color="primary" index={0} linkTo="/courses" />
          <MetricCard title="Active Alerts" value={incidentsCount} icon={AlertTriangle} color="warning" index={1} linkTo="/alerts" />
          <MetricCard title="Total Students" value={studentsCount} icon={Users} color="info" index={2} linkTo="/students" />
          <MetricCard title="Attendance Records" value={attendanceCount} icon={TrendingUp} color="success" index={3} linkTo="/attendance" />
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <AttendanceChart />
          <BehaviorPieChart />
        </div>

        {/* ── Smart analytics row ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Weekly insights */}
          <div className="glass rounded-2xl p-5 border border-border/50 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-primary/15 border border-primary/20 flex items-center justify-center">
                  <BarChart2 className="w-3.5 h-3.5 text-primary" />
                </div>
                Weekly Insights
              </h3>
              <div className="flex items-center gap-1">
                {[1,2,3,4].map(w => (
                  <button key={w} onClick={() => setInsightsWeek(w)}
                    className={`text-[10px] px-2 py-1 rounded-lg border transition-colors ${
                      insightsWeek === w ? "bg-primary/20 text-primary border-primary/30" : "text-muted-foreground border-white/[0.08] hover:bg-secondary/40"
                    }`}>W{w}</button>
                ))}
              </div>
            </div>
            {insights ? (
              <div className="space-y-3">
                {/* Attendance delta */}
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Attendance Rate</span>
                  <span className="font-bold flex items-center gap-1">
                    {insights.attendance.thisRate}%
                    {insights.attendance.change !== 0 && (
                      <span className={`text-[10px] ${insights.attendance.change > 0 ? "text-emerald-400" : "text-red-400"}`}>
                        {insights.attendance.change > 0 ? "▲" : "▼"}{Math.abs(insights.attendance.change)}%
                      </span>
                    )}
                  </span>
                </div>
                <div className="h-1.5 bg-secondary/50 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${insights.attendance.thisRate >= 80 ? "bg-emerald-500" : insights.attendance.thisRate >= 60 ? "bg-amber-500" : "bg-red-500"}`}
                    style={{ width: `${insights.attendance.thisRate}%` }} />
                </div>
                {/* Top behavior issues */}
                {insights.topIssues.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Top Issues</p>
                    {insights.topIssues.map((b: any) => (
                      <div key={b.behavior_type} className="flex items-center justify-between text-[11px]">
                        <span className="capitalize text-foreground">{b.behavior_type}</span>
                        <span className="font-mono text-muted-foreground">{b.count}×</span>
                      </div>
                    ))}
                  </div>
                )}
                <div className="text-[10px] text-muted-foreground pt-1 border-t border-white/[0.05]">
                  {insights.absentStudents} students absent this week
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground text-center py-4">No data yet for Week {insightsWeek}</p>
            )}
          </div>

          {/* Most disciplined */}
          <div className="glass rounded-2xl p-5 border border-border/50 space-y-3">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-emerald-500/15 border border-emerald-500/20 flex items-center justify-center">
                <Star className="w-3.5 h-3.5 text-emerald-400" />
              </div>
              Top Disciplined
            </h3>
            {(ranking?.disciplined || []).map((s: any, i: number) => (
              <div key={s.id} className="flex items-center gap-2.5">
                <span className={`text-[11px] font-bold w-5 text-center ${i === 0 ? "text-amber-400" : "text-muted-foreground"}`}>{i + 1}</span>
                <div className="w-7 h-7 rounded-full bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center text-[10px] font-bold text-emerald-400 flex-shrink-0">
                  {s.full_name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground truncate">{s.full_name}</p>
                  <p className="text-[10px] text-muted-foreground font-mono">{s.student_code}</p>
                </div>
                <span className="text-xs font-bold text-emerald-400">{s.behavior_score}</span>
              </div>
            ))}
            {(!ranking?.disciplined?.length) && <p className="text-xs text-muted-foreground text-center py-3">No data yet</p>}
          </div>

          {/* Most violating */}
          <div className="glass rounded-2xl p-5 border border-border/50 space-y-3">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-red-500/15 border border-red-500/20 flex items-center justify-center">
                <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
              </div>
              At-Risk Students
            </h3>
            {(ranking?.violating || []).map((s: any, i: number) => (
              <div key={s.id} className="flex items-center gap-2.5">
                <span className="text-[11px] font-bold w-5 text-center text-muted-foreground">{i + 1}</span>
                <div className="w-7 h-7 rounded-full bg-red-500/15 border border-red-500/25 flex items-center justify-center text-[10px] font-bold text-red-400 flex-shrink-0">
                  {s.full_name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground truncate">{s.full_name}</p>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-muted-foreground font-mono">{s.student_code}</span>
                    {s.critical_count > 0 && (
                      <span className="text-[9px] text-red-400 font-bold">{s.critical_count} critical</span>
                    )}
                  </div>
                </div>
                <span className="text-xs font-bold text-red-400">{s.total_violations}×</span>
              </div>
            ))}
            {(!ranking?.violating?.length) && <p className="text-xs text-muted-foreground text-center py-3">No violations recorded</p>}
          </div>
        </div>

        {/* Bottom */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <RecentCourses />
          <GradesComposition />
        </div>
      </div>
    </MainLayout>
  );
};

const Dashboard = () => {
  const { role } = useAuth();

  if (role === "student") return <StudentDashboard />;
  if (role === "doctor") return <DoctorDashboard />;
  if (role === "dean") return <DeanDashboard />;
  return <AdminDashboard />;
};

export default Dashboard;
