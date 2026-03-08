import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import MainLayout from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Download, FileText, TrendingUp, Users, AlertTriangle, Activity } from "lucide-react";
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
      const { data, error } = await supabase.from("attendance_records").select("*").order("date", { ascending: false });
      if (error) throw error;
      return data;
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
    return attendance.filter((r) => isAfter(new Date(r.date), startDate));
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
    filteredAttendance.forEach((r) => {
      const name = r.course_name || "General";
      if (!byCourseName[name]) byCourseName[name] = { present: 0, absent: 0, late: 0 };
      if (r.status === "present") byCourseName[name].present++;
      else if (r.status === "absent") byCourseName[name].absent++;
      else if (r.status === "late") byCourseName[name].late++;
    });
    return Object.entries(byCourseName).map(([name, stats]) => ({ name, ...stats }));
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
    const currentData = reportType === "attendance" ? filteredAttendance : filteredIncidents;
    if (!currentData.length) { toast.error("No data to export"); return; }
    const headers = Object.keys(currentData[0]).join(",");
    const rows = currentData.map((row) => Object.values(row).join(",")).join("\n");
    const blob = new Blob([`${headers}\n${rows}`], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${reportType}-report-${dateRange}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    toast.success(`CSV exported (${currentData.length} records)`);
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
      <div className="space-y-6">
        {/* Controls */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Select value={reportType} onValueChange={setReportType}>
              <SelectTrigger className="w-48 glass rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="attendance">Attendance Report</SelectItem>
                <SelectItem value="incidents">Incidents Report</SelectItem>
                <SelectItem value="behavior">Behavior Report</SelectItem>
              </SelectContent>
            </Select>
            <Select value={dateRange} onValueChange={setDateRange}>
              <SelectTrigger className="w-40 glass rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="week">Last Week</SelectItem>
                <SelectItem value="month">Last Month</SelectItem>
                <SelectItem value="quarter">Last Quarter</SelectItem>
                <SelectItem value="year">Last Year</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={exportToCSV} className="gap-2 rounded-xl"><Download className="w-4 h-4" />CSV</Button>
            <Button onClick={exportToPDF} className="gap-2 rounded-xl bg-gradient-to-r from-primary to-accent hover:opacity-90"><FileText className="w-4 h-4" />PDF</Button>
          </div>
        </motion.div>

        <p className="text-xs text-muted-foreground">Showing: <span className="font-medium text-foreground">{getDateRangeLabel()}</span></p>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[
            { icon: Users, color: "text-primary", bg: "bg-primary/15", label: "Attendance Records", value: filteredAttendance.length },
            { icon: TrendingUp, color: "text-emerald-500", bg: "bg-emerald-500/15", label: "Avg Attendance", value: avgAttendance },
            { icon: AlertTriangle, color: "text-primary", bg: "bg-primary/15", label: "Total Incidents", value: filteredIncidents.length },
            { icon: Activity, color: "text-destructive", bg: "bg-destructive/15", label: "Low Behavior", value: lowBehaviorStudents.length },
          ].map((item, i) => (
            <motion.div key={item.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
              <Card className="glass rounded-2xl hover-lift transition-all">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-xl ${item.bg}`}><item.icon className={`w-5 h-5 ${item.color}`} /></div>
                    <div><p className="text-[10px] text-muted-foreground uppercase tracking-wider">{item.label}</p><p className="text-2xl font-bold text-foreground">{item.value}</p></div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <Card className="glass rounded-2xl">
              <CardHeader><CardTitle className="text-foreground text-base">Attendance by Course</CardTitle></CardHeader>
              <CardContent>
                {courseAttendance.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={courseAttendance}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                      <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 11 }} tickLine={false} />
                      <YAxis stroke="hsl(var(--muted-foreground))" tickLine={false} axisLine={false} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Bar dataKey="present" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} name="Present" />
                      <Bar dataKey="absent" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Absent" />
                      <Bar dataKey="late" fill="hsl(var(--chart-3))" radius={[4, 4, 0, 0]} name="Late" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[300px] text-muted-foreground">No attendance data</div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
            <Card className="glass rounded-2xl">
              <CardHeader><CardTitle className="text-foreground text-base">Incidents by Type</CardTitle></CardHeader>
              <CardContent>
                {incidentsByType.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie data={incidentsByType} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={3} dataKey="value" strokeWidth={0} label={({ name, value }) => `${name}: ${value}`}>
                        {incidentsByType.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                      </Pie>
                      <Tooltip contentStyle={tooltipStyle} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[300px] text-muted-foreground">No incidents</div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Low Behavior Alert */}
        {lowBehaviorStudents.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
            <Card className="glass rounded-2xl neon-border-purple">
              <CardHeader>
                <CardTitle className="text-foreground flex items-center gap-2 text-base">
                  <AlertTriangle className="w-5 h-5 text-destructive" />
                  Students with Low Behavior Score (&lt;60%)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {lowBehaviorStudents.map((s) => (
                    <div key={s.id} className="flex items-center justify-between p-3 rounded-xl bg-destructive/5 hover:bg-destructive/10 transition-colors">
                      <div>
                        <p className="font-semibold text-foreground text-sm">{s.full_name}</p>
                        <p className="text-[10px] text-muted-foreground font-mono">{s.student_code}</p>
                      </div>
                      <Badge className="bg-destructive/10 text-destructive">{s.score}%</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </div>
    </MainLayout>
  );
};

export default Reports;
