import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";

// ─── INTERFACES ───────────────────────────────────────────────────────────────

export interface ReportRecord {
  id: string;
  studentId: string;
  studentName: string;
  departmentId: string;
  courseId: string;
  studentLevel: string;
  date: string; // ISO date string
}

export interface IncidentRecord {
  id: string;
  studentId: string;
  studentName: string;
  incidentType: string;
  location: string;
  timestamp: string; // ISO datetime string
  departmentId: string;
}

export interface EngagementRecord {
  id: string;
  studentId: string;
  studentName: string;
  departmentId: string;
  courseId: string;
  date: string;
  participationLevel: "high" | "medium" | "low";
  attentionScore: number; // 0–100
  interactionFrequency: number;
}

export interface EngagementSummary {
  avgAttentionScore: number;
  totalParticipants: number;
  highEngagementCount: number;
  lowEngagementCount: number;
}

// ─── PURE FUNCTIONS (exported for testing) ────────────────────────────────────

export function filterByDepartment(
  records: ReportRecord[],
  deptId: string
): ReportRecord[] {
  if (!deptId || deptId.trim() === "") return records;
  return records.filter((r) => r.departmentId === deptId);
}

export function filterByDateRange(
  records: ReportRecord[],
  from: Date,
  to: Date
): ReportRecord[] {
  const fromMs = from.getTime();
  const toMs = to.getTime();
  return records.filter((r) => {
    const d = new Date(r.date).getTime();
    return d >= fromMs && d <= toMs;
  });
}

export function filterByIncidentType(
  incidents: IncidentRecord[],
  type: string
): IncidentRecord[] {
  if (!type || type.trim() === "") return incidents;
  return incidents.filter(
    (i) => i.incidentType.toLowerCase() === type.toLowerCase()
  );
}

export function buildEngagementSummary(
  records: EngagementRecord[]
): EngagementSummary {
  if (records.length === 0) {
    return {
      avgAttentionScore: 0,
      totalParticipants: 0,
      highEngagementCount: 0,
      lowEngagementCount: 0,
    };
  }

  const totalScore = records.reduce((sum, r) => sum + r.attentionScore, 0);
  const avgAttentionScore = Math.round(totalScore / records.length);
  const totalParticipants = records.length;
  const highEngagementCount = records.filter(
    (r) => r.participationLevel === "high"
  ).length;
  const lowEngagementCount = records.filter(
    (r) => r.participationLevel === "low"
  ).length;

  return {
    avgAttentionScore,
    totalParticipants,
    highEngagementCount,
    lowEngagementCount,
  };
}

export function formatExportFilename(
  reportType: string,
  dateRange: string
): string {
  const sanitizedType = reportType
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
  const sanitizedRange = dateRange
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9\-_]/g, "");
  return `${sanitizedType}-report-${sanitizedRange}.csv`;
}

// ─── COMPONENT ────────────────────────────────────────────────────────────────

type TabId = "engagement" | "misconduct" | "attendance";

const TABS: { id: TabId; label: string }[] = [
  { id: "engagement", label: "Engagement" },
  { id: "misconduct", label: "Misconduct" },
  { id: "attendance", label: "Attendance" },
];

const DEPARTMENTS = [
  { id: "", label: "All Departments" },
  { id: "cs", label: "Computer Science" },
  { id: "eng", label: "Engineering" },
  { id: "biz", label: "Business" },
];

const INCIDENT_TYPES = [
  { id: "", label: "All Types" },
  { id: "fighting", label: "Fighting" },
  { id: "smoking", label: "Smoking" },
  { id: "phone_use", label: "Phone Use" },
  { id: "cheating", label: "Cheating" },
];

const GenerateReports = () => {
  const [activeTab, setActiveTab] = useState<TabId>("engagement");
  const [deptFilter, setDeptFilter] = useState("");
  const [fromDate, setFromDate] = useState(
    () => new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  );
  const [toDate, setToDate] = useState(
    () => new Date().toISOString().slice(0, 10)
  );
  const [incidentTypeFilter, setIncidentTypeFilter] = useState("");

  // ── Engagement data ──
  const { data: engagementRaw = [] } = useQuery({
    queryKey: ["engagement_records", deptFilter, fromDate, toDate],
    queryFn: async () => {
      let query = supabase
        .from("engagement_records")
        .select("*")
        .gte("date", fromDate)
        .lte("date", toDate);
      if (deptFilter) query = query.eq("department_id", deptFilter);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []).map((row: any) => ({
        id: row.id,
        studentId: row.student_id,
        studentName: row.student_name,
        departmentId: row.department_id,
        courseId: row.course_id,
        date: row.date,
        participationLevel: row.participation_level,
        attentionScore: row.attention_score,
        interactionFrequency: row.interaction_frequency,
      })) as EngagementRecord[];
    },
  });

  // ── Misconduct data ──
  const { data: misconductRaw = [] } = useQuery({
    queryKey: ["misconduct_records", deptFilter, fromDate, toDate],
    queryFn: async () => {
      let query = supabase
        .from("incidents")
        .select("*")
        .gte("timestamp", fromDate)
        .lte("timestamp", toDate + "T23:59:59");
      if (deptFilter) query = query.eq("department_id", deptFilter);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []).map((row: any) => ({
        id: row.id,
        studentId: row.student_id,
        studentName: row.student_name,
        incidentType: row.incident_type,
        location: row.location,
        timestamp: row.timestamp,
        departmentId: row.department_id,
      })) as IncidentRecord[];
    },
  });

  // ── Filtered data ──
  const filteredMisconduct = useMemo(
    () => filterByIncidentType(misconductRaw, incidentTypeFilter),
    [misconductRaw, incidentTypeFilter]
  );

  const engagementSummary = useMemo(
    () => buildEngagementSummary(engagementRaw),
    [engagementRaw]
  );

  // ── Export helpers ──
  const handleExportCsv = (type: string) => {
    const dateRange = `${fromDate}_${toDate}`;
    const filename = formatExportFilename(type, dateRange);

    let csvContent = "";
    if (type === "engagement") {
      csvContent =
        "Student ID,Student Name,Department,Course,Date,Participation,Attention Score,Interactions\n" +
        engagementRaw
          .map(
            (r) =>
              `${r.studentId},${r.studentName},${r.departmentId},${r.courseId},${r.date},${r.participationLevel},${r.attentionScore},${r.interactionFrequency}`
          )
          .join("\n");
    } else if (type === "misconduct") {
      csvContent =
        "Student ID,Student Name,Incident Type,Location,Timestamp\n" +
        filteredMisconduct
          .map(
            (r) =>
              `${r.studentId},${r.studentName},${r.incidentType},${r.location},${r.timestamp}`
          )
          .join("\n");
    }

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen p-6" style={{ background: "hsl(225 25% 5%)" }}>
      {/* Page header */}
      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6"
      >
        <h1 className="text-2xl font-bold text-white">Generate Reports</h1>
        <p className="text-sm text-white/50 mt-1">
          Engagement, misconduct and attendance analytics
        </p>
      </motion.div>

      {/* Filters bar */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="rounded-2xl border border-white/[0.07] overflow-hidden mb-5"
        style={{ background: "hsl(225 25% 7%)" }}
      >
        <div
          className="px-5 py-4 border-b border-white/[0.06]"
          style={{
            background:
              "linear-gradient(90deg, hsl(217 91% 60% / 0.06), transparent)",
          }}
        >
          <span className="text-sm font-semibold text-white/80 uppercase tracking-wider">
            Filters
          </span>
        </div>
        <div className="p-5 flex flex-wrap gap-4">
          {/* Department */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-white/50 uppercase tracking-wide">
              Department
            </label>
            <select
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              className="rounded-lg border border-white/[0.1] bg-white/[0.05] text-white text-sm px-3 py-2 focus:outline-none focus:border-blue-500/60"
            >
              {DEPARTMENTS.map((d) => (
                <option key={d.id} value={d.id} className="bg-gray-900">
                  {d.label}
                </option>
              ))}
            </select>
          </div>

          {/* From date */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-white/50 uppercase tracking-wide">
              From
            </label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="rounded-lg border border-white/[0.1] bg-white/[0.05] text-white text-sm px-3 py-2 focus:outline-none focus:border-blue-500/60"
            />
          </div>

          {/* To date */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-white/50 uppercase tracking-wide">
              To
            </label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="rounded-lg border border-white/[0.1] bg-white/[0.05] text-white text-sm px-3 py-2 focus:outline-none focus:border-blue-500/60"
            />
          </div>

          {/* Incident type (only relevant for misconduct tab) */}
          {activeTab === "misconduct" && (
            <div className="flex flex-col gap-1">
              <label className="text-xs text-white/50 uppercase tracking-wide">
                Incident Type
              </label>
              <select
                value={incidentTypeFilter}
                onChange={(e) => setIncidentTypeFilter(e.target.value)}
                className="rounded-lg border border-white/[0.1] bg-white/[0.05] text-white text-sm px-3 py-2 focus:outline-none focus:border-blue-500/60"
              >
                {INCIDENT_TYPES.map((t) => (
                  <option key={t.id} value={t.id} className="bg-gray-900">
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </motion.div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? "bg-blue-600/30 border border-blue-500/40 text-blue-300"
                : "bg-white/[0.04] border border-white/[0.06] text-white/60 hover:text-white/80"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "engagement" && (
        <motion.div
          key="engagement"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-white/[0.07] overflow-hidden"
          style={{ background: "hsl(225 25% 7%)" }}
        >
          <div
            className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between"
            style={{
              background:
                "linear-gradient(90deg, hsl(217 91% 60% / 0.06), transparent)",
            }}
          >
            <span className="text-sm font-semibold text-white/80 uppercase tracking-wider">
              Engagement Report
            </span>
            <button
              onClick={() => handleExportCsv("engagement")}
              className="px-3 py-1.5 rounded-lg bg-blue-600/20 border border-blue-500/30 text-blue-300 text-xs font-medium hover:bg-blue-600/30 transition-colors"
            >
              Export CSV
            </button>
          </div>
          <div className="p-5">
            {/* KPI row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
              {[
                {
                  label: "Avg Attention",
                  value: `${engagementSummary.avgAttentionScore}%`,
                },
                {
                  label: "Participants",
                  value: engagementSummary.totalParticipants,
                },
                {
                  label: "High Engagement",
                  value: engagementSummary.highEngagementCount,
                },
                {
                  label: "Low Engagement",
                  value: engagementSummary.lowEngagementCount,
                },
              ].map((kpi) => (
                <div
                  key={kpi.label}
                  className="rounded-xl border border-white/[0.06] p-3"
                  style={{ background: "hsl(225 25% 9%)" }}
                >
                  <p className="text-xs text-white/40 mb-1">{kpi.label}</p>
                  <p className="text-xl font-bold text-white">{kpi.value}</p>
                </div>
              ))}
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-white/40 text-xs uppercase tracking-wider border-b border-white/[0.06]">
                    <th className="pb-2 text-left">Student</th>
                    <th className="pb-2 text-left">Dept</th>
                    <th className="pb-2 text-left">Date</th>
                    <th className="pb-2 text-left">Participation</th>
                    <th className="pb-2 text-right">Attention</th>
                    <th className="pb-2 text-right">Interactions</th>
                  </tr>
                </thead>
                <tbody>
                  {engagementRaw.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="py-8 text-center text-white/30 text-sm"
                      >
                        No engagement records for this period
                      </td>
                    </tr>
                  ) : (
                    engagementRaw.map((r) => (
                      <tr
                        key={r.id}
                        className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors"
                      >
                        <td className="py-2.5 text-white/80">{r.studentName}</td>
                        <td className="py-2.5 text-white/50">{r.departmentId}</td>
                        <td className="py-2.5 text-white/50">{r.date}</td>
                        <td className="py-2.5">
                          <span
                            className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                              r.participationLevel === "high"
                                ? "bg-emerald-500/20 text-emerald-400"
                                : r.participationLevel === "medium"
                                ? "bg-amber-500/20 text-amber-400"
                                : "bg-red-500/20 text-red-400"
                            }`}
                          >
                            {r.participationLevel}
                          </span>
                        </td>
                        <td className="py-2.5 text-right text-white/70">
                          {r.attentionScore}%
                        </td>
                        <td className="py-2.5 text-right text-white/70">
                          {r.interactionFrequency}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </motion.div>
      )}

      {activeTab === "misconduct" && (
        <motion.div
          key="misconduct"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-white/[0.07] overflow-hidden"
          style={{ background: "hsl(225 25% 7%)" }}
        >
          <div
            className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between"
            style={{
              background:
                "linear-gradient(90deg, hsl(217 91% 60% / 0.06), transparent)",
            }}
          >
            <span className="text-sm font-semibold text-white/80 uppercase tracking-wider">
              Misconduct Report
            </span>
            <button
              onClick={() => handleExportCsv("misconduct")}
              className="px-3 py-1.5 rounded-lg bg-blue-600/20 border border-blue-500/30 text-blue-300 text-xs font-medium hover:bg-blue-600/30 transition-colors"
            >
              Export CSV
            </button>
          </div>
          <div className="p-5 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-white/40 text-xs uppercase tracking-wider border-b border-white/[0.06]">
                  <th className="pb-2 text-left">Student</th>
                  <th className="pb-2 text-left">Incident Type</th>
                  <th className="pb-2 text-left">Location</th>
                  <th className="pb-2 text-left">Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {filteredMisconduct.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="py-8 text-center text-white/30 text-sm"
                    >
                      No misconduct records found
                    </td>
                  </tr>
                ) : (
                  filteredMisconduct.map((r) => (
                    <tr
                      key={r.id}
                      className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors"
                    >
                      <td className="py-2.5 text-white/80">{r.studentName}</td>
                      <td className="py-2.5">
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-500/20 text-red-400">
                          {r.incidentType}
                        </span>
                      </td>
                      <td className="py-2.5 text-white/50">{r.location}</td>
                      <td className="py-2.5 text-white/50">
                        {new Date(r.timestamp).toLocaleString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}

      {activeTab === "attendance" && (
        <motion.div
          key="attendance"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-white/[0.07] overflow-hidden"
          style={{ background: "hsl(225 25% 7%)" }}
        >
          <div
            className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between"
            style={{
              background:
                "linear-gradient(90deg, hsl(217 91% 60% / 0.06), transparent)",
            }}
          >
            <span className="text-sm font-semibold text-white/80 uppercase tracking-wider">
              Attendance Report
            </span>
            <button
              onClick={() => handleExportCsv("attendance")}
              className="px-3 py-1.5 rounded-lg bg-blue-600/20 border border-blue-500/30 text-blue-300 text-xs font-medium hover:bg-blue-600/30 transition-colors"
            >
              Export CSV
            </button>
          </div>
          <div className="p-5">
            <p className="text-white/40 text-sm text-center py-8">
              Attendance data filtered by the department and date range above.
            </p>
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default GenerateReports;
