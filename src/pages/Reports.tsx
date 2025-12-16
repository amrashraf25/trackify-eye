import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import MainLayout from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, FileText, TrendingUp, Users, AlertTriangle, Calendar } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from "recharts";
import { toast } from "sonner";
import { subDays, subMonths, subYears, isAfter, format } from "date-fns";

const Reports = () => {
  const [dateRange, setDateRange] = useState("week");
  const [reportType, setReportType] = useState("attendance");

  // Calculate date range start
  const getDateRangeStart = () => {
    const now = new Date();
    switch (dateRange) {
      case "week":
        return subDays(now, 7);
      case "month":
        return subMonths(now, 1);
      case "quarter":
        return subMonths(now, 3);
      case "year":
        return subYears(now, 1);
      default:
        return subDays(now, 7);
    }
  };

  const { data: incidents } = useQuery({
    queryKey: ["incidents-report"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("incidents")
        .select("*")
        .order("detected_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: attendance } = useQuery({
    queryKey: ["attendance-report"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendance_records")
        .select("*")
        .order("date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Filter data based on date range
  const filteredIncidents = useMemo(() => {
    if (!incidents) return [];
    const now = new Date();
    let startDate: Date;
    switch (dateRange) {
      case "week":
        startDate = subDays(now, 7);
        break;
      case "month":
        startDate = subMonths(now, 1);
        break;
      case "quarter":
        startDate = subMonths(now, 3);
        break;
      case "year":
        startDate = subYears(now, 1);
        break;
      default:
        startDate = subDays(now, 7);
    }
    return incidents.filter((incident) => 
      isAfter(new Date(incident.detected_at), startDate)
    );
  }, [incidents, dateRange]);

  const filteredAttendance = useMemo(() => {
    if (!attendance) return [];
    const now = new Date();
    let startDate: Date;
    switch (dateRange) {
      case "week":
        startDate = subDays(now, 7);
        break;
      case "month":
        startDate = subMonths(now, 1);
        break;
      case "quarter":
        startDate = subMonths(now, 3);
        break;
      case "year":
        startDate = subYears(now, 1);
        break;
      default:
        startDate = subDays(now, 7);
    }
    return attendance.filter((record) => 
      isAfter(new Date(record.date), startDate)
    );
  }, [attendance, dateRange]);

  // Get current data based on report type and filtered by date
  const currentData = reportType === "attendance" ? filteredAttendance : filteredIncidents;

  // Calculate attendance stats from filtered data
  const attendanceStats = useMemo(() => {
    if (!filteredAttendance.length) return { present: 0, absent: 0, late: 0 };
    const present = filteredAttendance.filter(r => r.status === "present").length;
    const absent = filteredAttendance.filter(r => r.status === "absent").length;
    const late = filteredAttendance.filter(r => r.status === "late").length;
    return { present, absent, late };
  }, [filteredAttendance]);

  // Calculate average attendance percentage
  const avgAttendance = useMemo(() => {
    const total = attendanceStats.present + attendanceStats.absent + attendanceStats.late;
    if (total === 0) return "N/A";
    return ((attendanceStats.present / total) * 100).toFixed(1) + "%";
  }, [attendanceStats]);

  // Group incidents by type for pie chart
  const incidentsByType = useMemo(() => {
    if (!filteredIncidents.length) return [];
    const grouped = filteredIncidents.reduce((acc, incident) => {
      acc[incident.incident_type] = (acc[incident.incident_type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const colors = ["hsl(var(--primary))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))"];
    return Object.entries(grouped).map(([name, value], index) => ({
      name,
      value,
      color: colors[index % colors.length],
    }));
  }, [filteredIncidents]);

  // Group incidents by date for bar chart
  const incidentsByDate = useMemo(() => {
    if (!filteredIncidents.length) return [];
    const grouped = filteredIncidents.reduce((acc, incident) => {
      const date = format(new Date(incident.detected_at), "MMM dd");
      acc[date] = (acc[date] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    return Object.entries(grouped)
      .map(([date, count]) => ({ date, count }))
      .slice(0, 10);
  }, [filteredIncidents]);

  // Attendance trends (weekly breakdown)
  const attendanceTrends = useMemo(() => {
    if (!filteredAttendance.length) {
      return [
        { week: "Week 1", present: 0, absent: 0, late: 0 },
      ];
    }
    // Group by week or use actual data
    return [
      { week: "Present", present: attendanceStats.present, absent: 0, late: 0 },
      { week: "Absent", present: 0, absent: attendanceStats.absent, late: 0 },
      { week: "Late", present: 0, absent: 0, late: attendanceStats.late },
    ];
  }, [filteredAttendance, attendanceStats]);

  const getDateRangeLabel = () => {
    const now = new Date();
    const start = getDateRangeStart();
    return `${format(start, "MMM dd, yyyy")} - ${format(now, "MMM dd, yyyy")}`;
  };

  const exportToCSV = () => {
    if (!currentData || currentData.length === 0) {
      toast.error("No data to export for selected date range");
      return;
    }

    const headers = Object.keys(currentData[0]).join(",");
    const rows = currentData.map((row) => Object.values(row).join(",")).join("\n");
    const csv = `${headers}\n${rows}`;
    
    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${reportType}-report-${dateRange}-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    toast.success(`CSV exported successfully (${currentData.length} records)`);
  };

  const exportToPDF = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      toast.error("Please allow popups to export PDF");
      return;
    }

    const title = reportType === "attendance" ? "Attendance Report" : "Incidents Report";
    const dateLabel = getDateRangeLabel();

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${title} - Trackify</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            h1 { color: #1a1a2e; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #dc2626; color: white; }
            tr:nth-child(even) { background-color: #f9f9f9; }
            .header { display: flex; justify-content: space-between; align-items: center; }
            .date { color: #666; }
            .summary { margin: 20px 0; padding: 15px; background: #f5f5f5; border-radius: 8px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Trackify - ${title}</h1>
          </div>
          <p class="date">Report Period: ${dateLabel}</p>
          <p class="date">Generated: ${new Date().toLocaleDateString()}</p>
          <div class="summary">
            <strong>Total Records:</strong> ${currentData?.length || 0}
          </div>
          <table>
            <thead>
              <tr>
                ${currentData && currentData.length > 0 ? Object.keys(currentData[0]).map((key) => `<th>${key}</th>`).join("") : "<th>No data</th>"}
              </tr>
            </thead>
            <tbody>
              ${currentData?.map((row) => `<tr>${Object.values(row).map((val) => `<td>${val}</td>`).join("")}</tr>`).join("") || "<tr><td>No records found for selected date range</td></tr>"}
            </tbody>
          </table>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
    toast.success(`PDF export opened (${currentData?.length || 0} records)`);
  };

  return (
    <MainLayout title="Reports & Analytics">
      <div className="space-y-6">
        {/* Controls */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Select value={reportType} onValueChange={setReportType}>
              <SelectTrigger className="w-48 bg-card border-border">
                <SelectValue placeholder="Report Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="attendance">Attendance Report</SelectItem>
                <SelectItem value="incidents">Incidents Report</SelectItem>
              </SelectContent>
            </Select>

            <Select value={dateRange} onValueChange={setDateRange}>
              <SelectTrigger className="w-40 bg-card border-border">
                <SelectValue placeholder="Date Range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="week">Last Week</SelectItem>
                <SelectItem value="month">Last Month</SelectItem>
                <SelectItem value="quarter">Last Quarter</SelectItem>
                <SelectItem value="year">Last Year</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={exportToCSV} className="gap-2">
              <Download className="w-4 h-4" />
              Export CSV
            </Button>
            <Button onClick={exportToPDF} className="gap-2">
              <FileText className="w-4 h-4" />
              Export PDF
            </Button>
          </div>
        </div>

        {/* Date Range Display */}
        <p className="text-sm text-muted-foreground">
          Showing data for: <span className="font-medium text-foreground">{getDateRangeLabel()}</span>
        </p>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/20">
                  <Users className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Attendance Records</p>
                  <p className="text-2xl font-bold text-foreground">{filteredAttendance.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-500/20">
                  <TrendingUp className="w-5 h-5 text-green-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Avg Attendance</p>
                  <p className="text-2xl font-bold text-foreground">{avgAttendance}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/20">
                  <AlertTriangle className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Incidents</p>
                  <p className="text-2xl font-bold text-foreground">{filteredIncidents.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/20">
                  <Calendar className="w-5 h-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Report Period</p>
                  <p className="text-2xl font-bold text-foreground capitalize">{dateRange}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Attendance Trends */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-foreground">Attendance Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={attendanceTrends}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="week" stroke="hsl(var(--muted-foreground))" />
                  <YAxis stroke="hsl(var(--muted-foreground))" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      color: "hsl(var(--foreground))",
                    }}
                    itemStyle={{ color: "hsl(var(--foreground))" }}
                    labelStyle={{ color: "hsl(var(--foreground))" }}
                  />
                  <Bar dataKey="present" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="absent" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="late" fill="hsl(var(--chart-4))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Incidents by Type */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-foreground">Incidents by Type</CardTitle>
            </CardHeader>
            <CardContent>
              {incidentsByType.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={incidentsByType}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={2}
                      dataKey="value"
                      label={({ name, value }) => `${name}: ${value}`}
                    >
                      {incidentsByType.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                        color: "hsl(var(--foreground))",
                      }}
                      itemStyle={{ color: "hsl(var(--foreground))" }}
                      labelStyle={{ color: "hsl(var(--foreground))" }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                  No incidents in selected date range
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </MainLayout>
  );
};

export default Reports;
