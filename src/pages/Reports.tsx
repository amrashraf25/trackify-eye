import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import MainLayout from "@/components/layout/MainLayout";

const LOCAL_API = "http://localhost:3001";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Download, FileText, TrendingUp, Users, AlertTriangle, Activity, BarChart3, Sparkles, CalendarDays, ShieldAlert } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { toast } from "sonner";
import { subDays, subMonths, subYears, isAfter, format } from "date-fns";
import { motion } from "framer-motion";

const Reports = () => {
  const [dateRange, setDateRange] = useState("month");
  const [reportType, setReportType] = useState("attendance");

  const getDateRangeStart = () => {
    const now = new Date();
    switch (dateRange) {
      case "week": return subDays(now, 7);
      case "month": return subMonths(now, 1);
      case "quarter": return subMonths(now, 3);
      case "year": return subYears(now, 1);
      default: return subDays(now, 7);
    }
  };

  const { data: incidents = [] } = useQuery({
    queryKey: ["incidents-report"],
    queryFn: async () => {
      const { data, error } = await supabase.from("incidents").select("*").order("detected_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: attendance = [] } = useQuery({
    queryKey: ["attendance-report"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendance_records")
        .select("*, courses(name, code)")
        .order("confirmed_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  // Course-level attendance breakdown from analytics
  const { data: analyticsInsights } = useQuery({
    queryKey: ["reports-insights"],
    queryFn: async () => {
      const r = await fetch(`${LOCAL_API}/api/analytics/insights`);
      return r.ok ? r.json() : null;
    },
  });

  // Course list for course attendance chart
  const { data: courseSessions = [] } = useQuery({
    queryKey: ["reports-course-sessions"],
    queryFn: async () => {
      const r = await fetch(`${LOCAL_API}/rest/v1/sessions?select=course_id,status&status=eq.ended&limit=200`);
      if (!r.ok) return [];
      const sessions = await r.json();
      // Fetch courses separately
      const r2 = await fetch(`${LOCAL_API}/rest/v1/courses?select=id,name,code`);
      const courses = r2.ok ? await r2.json() : [];
      return { sessions, courses };
    },
  });

  const { data: students = [] } = useQuery({
    queryKey: ["report-students"],
    queryFn: async () => {
      const { data, error } = await supabase.from("students").select("*");
      if (error) throw error;
      return data;
    },
  });

  const { data: behaviorScores = [] } = useQuery({
    queryKey: ["report-behavior-scores"],
    queryFn: async () => {
      const { data, error } = await supabase.from("behavior_scores").select("*");
      if (error) throw error;
      return data;
    },
  });

  const filteredAttendance = useMemo(() => {
    const startDate = getDateRangeStart();
    return attendance.filter((r) => {
      const ts = r.confirmed_at || r.date;
      return ts && isAfter(new Date(ts), startDate);
    });
  }, [attendance, dateRange]);

  const filteredIncidents = useMemo(() => {
    const startDate = getDateRangeStart();
    return incidents.filter((i) => isAfter(new Date(i.detected_at), startDate));
  }, [incidents, dateRange]);

  const attendanceStats = useMemo(() => {
    const present = filteredAttendance.filter((r) => r.status === "present").length;
    const absent = filteredAttendance.filter((r) => r.status === "absent").length;
    const late = filteredAttendance.filter((r) => r.status === "late").length;
    return { present, absent, late };
  }, [filteredAttendance]);

  const avgAttendance = useMemo(() => {
    const total = attendanceStats.present + attendanceStats.absent + attendanceStats.late;
    if (total === 0) return "N/A";
    return ((attendanceStats.present / total) * 100).toFixed(1) + "%";
  }, [attendanceStats]);

  const lowBehaviorStudents = useMemo(() => {
    return students.filter((s) => {
      const score = behaviorScores.find((b) => b.student_id === s.id);
      return (score?.score ?? 100) < 60;
    }).map((s) => ({
      ...s,
      score: behaviorScores.find((b) => b.student_id === s.id)?.score ?? 100,
    }));
  }, [students, behaviorScores]);

  const courseAttendance = useMemo(() => {
    const byCourseName: Record<string, { present: number; absent: number; late: number }> = {};
    filteredAttendance.forEach((r: any) => {
      // courses may be joined as object (REST join) or flat field
      const name = r.courses?.name || r.course_name || "General";
      if (!byCourseName[name]) byCourseName[name] = { present: 0, absent: 0, late: 0 };
      if (r.status === "present") byCourseName[name].present++;
      else if (r.status === "absent") byCourseName[name].absent++;
      else if (r.status === "late") byCourseName[name].late++;
    });
    return Object.entries(byCourseName).map(([name, stats]) => ({
      name: name.length > 18 ? name.slice(0, 16) + "…" : name,
      ...stats,
    }));
  }, [filteredAttendance]);

  const incidentsByType = useMemo(() => {
    const grouped = filteredIncidents.reduce((acc, i) => {
      acc[i.incident_type] = (acc[i.incident_type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    const colors = ["hsl(var(--primary))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))"];
    return Object.entries(grouped).map(([name, value], i) => ({ name, value, color: colors[i % colors.length] }));
  }, [filteredIncidents]);

  const getDateRangeLabel = () => {
    const now = new Date();
    return `${format(getDateRangeStart(), "MMM dd, yyyy")} - ${format(now, "MMM dd, yyyy")}`;
  };

  const exportToCSV = () => {
    // Use the proper local-api CSV report endpoints
    let url: string;
    if (reportType === "behavior") {
      url = `${LOCAL_API}/api/reports/behavior`;
    } else {
      url = `${LOCAL_API}/api/reports/attendance`;
    }
    // Trigger download by navigating to the endpoint
    const a = document.createElement("a");
    a.href = url;
    a.download = `${reportType}-report-${dateRange}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast.success(`CSV download started`);
  };

  const exportToPDF = () => {
    const currentData = reportType === "attendance" ? filteredAttendance : filteredIncidents;
    const printWindow = window.open("", "_blank");
    if (!printWindow) { toast.error("Allow popups to export PDF"); return; }
    const title = reportType === "attendance" ? "Attendance Report" : "Incidents Report";
    printWindow.document.write(`<!DOCTYPE html><html><head><title>${title}</title><style>body{font-family:Arial;padding:20px}h1{color:#1a1a2e}table{width:100%;border-collapse:collapse;margin-top:20px}th,td{border:1px solid #ddd;padding:8px;text-align:left}th{background:#3b82f6;color:white}tr:nth-child(even){background:#f9f9f9}.summary{margin:20px 0;padding:15px;background:#f5f5f5;border-radius:8px}</style></head><body><h1>Trackify - ${title}</h1><p>Period: ${getDateRangeLabel()}</p><div class="summary"><strong>Total Records:</strong> ${currentData.length}</div><table><thead><tr>${currentData.length ? Object.keys(currentData[0]).map((k) => `<th>${k}</th>`).join("") : "<th>No data</th>"}</tr></thead><tbody>${currentData.map((row) => `<tr>${Object.values(row).map((v) => `<td>${v}</td>`).join("")}</tr>`).join("")}</tbody></table></body></html>`);
    printWindow.document.close();
    printWindow.print();
    toast.success("PDF export opened");
  };

  const tooltipStyle = {
    backgroundColor: "hsl(var(--card))",
    border: "1px solid hsl(var(--border))",
    borderRadius: "12px",
    color: "hsl(var(--foreground))",
    boxShadow: "0 8px 30px hsl(0 0% 0% / 0.2)",
  };

  return (
    <MainLayout title="Reports & Analytics">
      <div className="space-y-5">

        {/* -------------- HERO HEADER -------------- */}
        <motion.div
          initial={{ opacity: 0, y: -18 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-2xl border border-black/[0.08] dark:border-white/[0.07] bg-gradient-to-br from-slate-50 via-violet-50/50 to-slate-100 dark:from-[hsl(263,70%,6%)] dark:to-[hsl(220,35%,5%)]"
        >
          <div className="absolute inset-0 pointer-events-none opacity-10 dark:opacity-20" style={{
            backgroundImage: "linear-gradient(hsl(263 70% 58% / 0.12) 1px, transparent 1px), linear-gradient(90deg, hsl(263 70% 58% / 0.12) 1px, transparent 1px)",
            backgroundSize: "32px 32px"
          }} />
          <div className="absolute -top-16 -right-16 w-72 h-72 rounded-full bg-violet-500/10 blur-[80px] pointer-events-none" />
          <div className="absolute -bottom-12 -left-12 w-56 h-56 rounded-full bg-primary/8 blur-[60px] pointer-events-none" />

          <div className="relative z-10 p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Sparkles className="w-4 h-4 text-violet-400" />
                <span className="text-[10px] uppercase tracking-[0.2em] text-violet-400/80 font-bold">Analytics Center</span>
              </div>
              <h1 className="text-2xl font-black text-white tracking-tight">Reports & Analytics</h1>
              <p className="text-sm text-white/35 mt-0.5 flex items-center gap-1.5">
                <CalendarDays className="w-3.5 h-3.5" />
                {getDateRangeLabel()}
              </p>
            </div>

            {/* Controls */}
            <div className="flex flex-wrap items-center gap-3">
              <Select value={reportType} onValueChange={setReportType}>
                <SelectTrigger className="w-44 rounded-xl h-10 text-xs border-white/[0.1]" style={{ background: "hsl(225 25% 10%)" }}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="attendance">Attendance Report</SelectItem>
                  <SelectItem value="incidents">Incidents Report</SelectItem>
                  <SelectItem value="behavior">Behavior Report</SelectItem>
                </SelectContent>
              </Select>
              <Select value={dateRange} onValueChange={setDateRange}>
                <SelectTrigger className="w-36 rounded-xl h-10 text-xs border-white/[0.1]" style={{ background: "hsl(225 25% 10%)" }}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="week">Last Week</SelectItem>
                  <SelectItem value="month">Last Month</SelectItem>
                  <SelectItem value="quarter">Last Quarter</SelectItem>
                  <SelectItem value="year">Last Year</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" onClick={exportToCSV}
                className="gap-2 rounded-xl h-10 text-xs border-white/[0.1] text-white/60 hover:text-white hover:bg-white/[0.06]">
                <Download className="w-3.5 h-3.5" />CSV
              </Button>
              <Button onClick={exportToPDF} className="gap-2 rounded-xl h-10 text-xs"
                style={{ background: "linear-gradient(135deg, hsl(263 70% 58%), hsl(217 91% 60%))", boxShadow: "0 0 20px hsl(263 70% 58% / 0.35)" }}>
                <FileText className="w-3.5 h-3.5" />Export PDF
              </Button>
            </div>
          </div>
        </motion.div>

        {/* -------------- SUMMARY CARDS -------------- */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              icon: <Users className="w-5 h-5 text-primary" />,
              label: "Attendance Records", value: filteredAttendance.length,
              from: "hsl(217 91% 60% / 0.12)", border: "hsl(217 91% 60% / 0.2)", glow: "hsl(217 91% 60% / 0.2)",
            },
            {
              icon: <TrendingUp className="w-5 h-5 text-emerald-400" />,
              label: "Avg Attendance", value: avgAttendance,
              from: "hsl(160 84% 39% / 0.12)", border: "hsl(160 84% 39% / 0.2)", glow: "hsl(160 84% 39% / 0.2)",
            },
            {
              icon: <AlertTriangle className="w-5 h-5 text-amber-400" />,
              label: "Total Incidents", value: filteredIncidents.length,
              from: "hsl(38 92% 50% / 0.12)", border: "hsl(38 92% 50% / 0.2)", glow: "hsl(38 92% 50% / 0.2)",
            },
            {
              icon: <ShieldAlert className="w-5 h-5 text-red-400" />,
              label: "Low Behavior", value: lowBehaviorStudents.length,
              from: "hsl(0 84% 60% / 0.12)", border: "hsl(0 84% 60% / 0.2)", glow: "hsl(0 84% 60% / 0.2)",
            },
          ].map((item, i) => (
            <motion.div
              key={item.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.07, type: "spring", stiffness: 300 }}
              whileHover={{ y: -3, scale: 1.02 }}
              className="relative overflow-hidden rounded-2xl p-4 cursor-default"
              style={{ background: item.from, border: `1px solid ${item.border}`, boxShadow: `0 4px 20px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.05)` }}
            >
              <div className="absolute top-0 right-0 w-24 h-24 rounded-full blur-[40px] pointer-events-none opacity-30"
                style={{ background: item.glow, transform: "translate(30%, -30%)" }} />
              <div className="relative">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3"
                  style={{ background: item.from, border: `1px solid ${item.border}` }}>
                  {item.icon}
                </div>
                <p className="text-[10px] uppercase tracking-widest text-white/35 font-semibold">{item.label}</p>
                <p className="text-3xl font-black text-white mt-0.5 tabular-nums">{item.value}</p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* -------------- CHARTS -------------- */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Bar Chart */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="rounded-2xl border border-white/[0.07] overflow-hidden"
            style={{ background: "hsl(225 25% 7%)" }}
          >
            <div className="px-5 py-4 border-b border-white/[0.06] flex items-center gap-2.5"
              style={{ background: "linear-gradient(90deg, hsl(217 91% 60% / 0.06), transparent)" }}>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ background: "hsl(217 91% 60% / 0.12)", boxShadow: "0 0 10px hsl(217 91% 60% / 0.2)" }}>
                <BarChart3 className="w-4 h-4 text-primary" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white/90">Attendance by Course</h3>
                <p className="text-[10px] text-white/30">{courseAttendance.length} courses tracked</p>
              </div>
            </div>
            <div className="p-5">
              {courseAttendance.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={courseAttendance} barGap={3}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(225 25% 12%)" vertical={false} />
                    <XAxis dataKey="name" stroke="hsl(225 15% 40%)" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                    <YAxis stroke="hsl(225 15% 40%)" tickLine={false} axisLine={false} tick={{ fontSize: 10 }} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar dataKey="present" fill="hsl(160 84% 39%)" radius={[4, 4, 0, 0]} name="Present" />
                    <Bar dataKey="absent"  fill="hsl(0 84% 60%)"   radius={[4, 4, 0, 0]} name="Absent" />
                    <Bar dataKey="late"    fill="hsl(38 92% 50%)"  radius={[4, 4, 0, 0]} name="Late" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex flex-col items-center justify-center h-[280px] gap-3">
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: "hsl(225 25% 10%)" }}>
                    <BarChart3 className="w-7 h-7 text-white/15" />
                  </div>
                  <p className="text-sm text-white/30">No attendance data for this period</p>
                </div>
              )}
            </div>
          </motion.div>

          {/* Pie Chart */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="rounded-2xl border border-white/[0.07] overflow-hidden"
            style={{ background: "hsl(225 25% 7%)" }}
          >
            <div className="px-5 py-4 border-b border-white/[0.06] flex items-center gap-2.5"
              style={{ background: "linear-gradient(90deg, hsl(38 92% 50% / 0.06), transparent)" }}>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ background: "hsl(38 92% 50% / 0.12)", boxShadow: "0 0 10px hsl(38 92% 50% / 0.2)" }}>
                <Activity className="w-4 h-4 text-amber-400" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white/90">Incidents by Type</h3>
                <p className="text-[10px] text-white/30">{filteredIncidents.length} total incidents</p>
              </div>
            </div>
            <div className="p-5">
              {incidentsByType.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie data={incidentsByType} cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={4} dataKey="value" strokeWidth={0}>
                        {incidentsByType.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                      </Pie>
                      <Tooltip contentStyle={tooltipStyle} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex flex-wrap gap-2 justify-center mt-3">
                    {incidentsByType.map((entry) => (
                      <div key={entry.name} className="flex items-center gap-1.5 text-[10px] text-white/50">
                        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: entry.color }} />
                        {entry.name}: <span className="text-white/70 font-semibold">{entry.value}</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center h-[280px] gap-3">
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: "hsl(225 25% 10%)" }}>
                    <Activity className="w-7 h-7 text-white/15" />
                  </div>
                  <p className="text-sm text-white/30">No incidents in this period</p>
                </div>
              )}
            </div>
          </motion.div>
        </div>

        {/* -------------- LOW BEHAVIOR ALERT -------------- */}
        {lowBehaviorStudents.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="rounded-2xl border border-red-500/20 overflow-hidden"
            style={{ background: "hsl(225 25% 7%)" }}
          >
            <div className="px-5 py-4 border-b border-red-500/15 flex items-center gap-2.5"
              style={{ background: "linear-gradient(90deg, hsl(0 84% 60% / 0.08), transparent)" }}>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ background: "hsl(0 84% 60% / 0.12)", boxShadow: "0 0 10px hsl(0 84% 60% / 0.2)" }}>
                <ShieldAlert className="w-4 h-4 text-red-400" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white/90">Low Behavior Alert</h3>
                <p className="text-[10px] text-white/30">{lowBehaviorStudents.length} student{lowBehaviorStudents.length !== 1 ? "s" : ""} below 60%</p>
              </div>
              <span className="ml-auto flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full"
                style={{ background: "hsl(0 84% 60% / 0.12)", color: "hsl(0 84% 65%)", border: "1px solid hsl(0 84% 60% / 0.25)" }}>
                <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
                Needs Attention
              </span>
            </div>
            <div className="p-4 space-y-2">
              {lowBehaviorStudents.map((s, i) => (
                <motion.div
                  key={s.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.55 + i * 0.04 }}
                  className="flex items-center justify-between p-3 rounded-xl border border-red-500/10 transition-all hover:border-red-500/20"
                  style={{ background: "hsl(0 84% 60% / 0.05)" }}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-black text-white/80"
                      style={{ background: "hsl(0 84% 60% / 0.15)", border: "1px solid hsl(0 84% 60% / 0.2)" }}>
                      {(s.full_name || "?")[0].toUpperCase()}
                    </div>
                    <div>
                      <p className="font-semibold text-white/85 text-sm">{s.full_name}</p>
                      <p className="text-[10px] text-white/30 font-mono">{s.student_code}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-20 h-1.5 rounded-full overflow-hidden" style={{ background: "hsl(225 25% 14%)" }}>
                      <div className="h-full rounded-full" style={{ width: `${s.score}%`, background: "hsl(0 84% 60%)" }} />
                    </div>
                    <span className="text-sm font-black text-red-400 tabular-nums w-10 text-right">{s.score}%</span>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </div>
    </MainLayout>
  );
};

export default Reports;
