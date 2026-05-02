import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { Calendar, Users, TrendingUp, Camera } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

// ─── TYPES ────────────────────────────────────────────────────────────────────

export interface AttendanceRecord {
  id: string;
  student_id: string;
  session_id: string;
  status: "present" | "absent" | "late";
  confirmed_at: string; // ISO date string
}

export interface Student {
  id: string;
  name: string;
  code: string;
}

export interface WeeklySummaryRow {
  studentId: string;
  name: string;
  code: string;
  sessions: number;
  present: number;
  absent: number;
  late: number;
  pct: number;
}

// ─── PURE FUNCTIONS (exported for testing) ────────────────────────────────────

/**
 * Returns records whose confirmed_at falls within [weekStart, weekEnd] (inclusive).
 */
export function filterByWeek(
  records: AttendanceRecord[],
  weekStart: Date,
  weekEnd: Date
): AttendanceRecord[] {
  if (!records || records.length === 0) return [];
  if (weekEnd < weekStart) return [];

  const start = weekStart.getTime();
  const end = weekEnd.getTime();

  return records.filter((r) => {
    const ts = new Date(r.confirmed_at).getTime();
    return ts >= start && ts <= end;
  });
}

/**
 * Aggregates attendance records per student into WeeklySummaryRow[].
 * Students with no records in the filtered set still appear with zero counts.
 */
export function buildWeeklySummary(
  records: AttendanceRecord[],
  students: Student[]
): WeeklySummaryRow[] {
  if (!students || students.length === 0) return [];

  const map = new Map<string, WeeklySummaryRow>();

  for (const s of students) {
    map.set(s.id, {
      studentId: s.id,
      name: s.name,
      code: s.code,
      sessions: 0,
      present: 0,
      absent: 0,
      late: 0,
      pct: 0,
    });
  }

  for (const r of records ?? []) {
    const row = map.get(r.student_id);
    if (!row) continue;
    row.sessions += 1;
    if (r.status === "present") row.present += 1;
    else if (r.status === "absent") row.absent += 1;
    else if (r.status === "late") row.late += 1;
  }

  for (const row of map.values()) {
    row.pct =
      row.sessions === 0
        ? 0
        : Math.round(((row.present + row.late) / row.sessions) * 100);
  }

  return Array.from(map.values());
}

/**
 * Categorizes an attendance percentage.
 * ≥75 → "good", ≥50 → "warning", <50 → "danger"
 */
export function categorizePct(pct: number): "good" | "warning" | "danger" {
  if (pct >= 75) return "good";
  if (pct >= 50) return "warning";
  return "danger";
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function getWeekBounds(offset: 0 | -1): { start: Date; end: Date } {
  const now = new Date();
  const day = now.getDay(); // 0 = Sunday
  const diffToMonday = (day === 0 ? -6 : 1 - day) + offset * 7;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return { start: monday, end: sunday };
}

const PCT_COLORS: Record<"good" | "warning" | "danger", string> = {
  good: "hsl(142 71% 45%)",
  warning: "hsl(38 92% 50%)",
  danger: "hsl(0 84% 60%)",
};

const BADGE_CLASSES: Record<"good" | "warning" | "danger", string> = {
  good: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  warning: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  danger: "bg-red-500/20 text-red-400 border-red-500/30",
};

// ─── COMPONENT ────────────────────────────────────────────────────────────────

const WeeklyAttendanceSummary = () => {
  const [weekOffset, setWeekOffset] = useState<0 | -1>(0);
  const { start: weekStart, end: weekEnd } = getWeekBounds(weekOffset);

  // Fetch attendance records
  const { data: records = [], isLoading: loadingRecords } = useQuery({
    queryKey: ["attendance_records", "weekly"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendance_records")
        .select("id, student_id, session_id, status, confirmed_at")
        .order("confirmed_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as AttendanceRecord[];
    },
  });

  // Fetch students
  const { data: students = [], isLoading: loadingStudents } = useQuery({
    queryKey: ["students", "weekly"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("students")
        .select("id, name, code")
        .order("name");
      if (error) throw error;
      return (data ?? []) as Student[];
    },
  });

  const summaryRows = useMemo(() => {
    const filtered = filterByWeek(records, weekStart, weekEnd);
    return buildWeeklySummary(filtered, students);
  }, [records, students, weekStart, weekEnd]);

  const isLoading = loadingRecords || loadingStudents;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="rounded-2xl border border-white/[0.07] overflow-hidden"
      style={{ background: "hsl(225 25% 7%)" }}
    >
      {/* Header */}
      <div
        className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between"
        style={{
          background:
            "linear-gradient(90deg, hsl(217 91% 60% / 0.06), transparent)",
        }}
      >
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
            <Calendar className="w-4 h-4 text-blue-400" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-white/90">
              Weekly Attendance Summary
            </h2>
            <p className="text-xs text-white/40 mt-0.5">
              {weekStart.toLocaleDateString()} – {weekEnd.toLocaleDateString()}
            </p>
          </div>
        </div>

        {/* Week toggle */}
        <div className="flex items-center gap-1.5 p-1 rounded-lg bg-white/[0.04] border border-white/[0.06]">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setWeekOffset(0)}
            className={`h-7 px-3 text-xs rounded-md transition-all ${
              weekOffset === 0
                ? "bg-blue-500/20 text-blue-400"
                : "text-white/50 hover:text-white/80"
            }`}
          >
            Current Week
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setWeekOffset(-1)}
            className={`h-7 px-3 text-xs rounded-md transition-all ${
              weekOffset === -1
                ? "bg-blue-500/20 text-blue-400"
                : "text-white/50 hover:text-white/80"
            }`}
          >
            Previous Week
          </Button>
        </div>
      </div>

      {/* Stats bar */}
      <div className="px-5 py-3 border-b border-white/[0.04] flex items-center gap-6">
        <div className="flex items-center gap-2">
          <Users className="w-3.5 h-3.5 text-white/40" />
          <span className="text-xs text-white/50">
            {summaryRows.length} students
          </span>
        </div>
        <div className="flex items-center gap-2">
          <TrendingUp className="w-3.5 h-3.5 text-emerald-400/60" />
          <span className="text-xs text-white/50">
            Avg:{" "}
            {summaryRows.length
              ? Math.round(
                  summaryRows.reduce((s, r) => s + r.pct, 0) /
                    summaryRows.length
                )
              : 0}
            %
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Camera className="w-3.5 h-3.5 text-white/40" />
          <span className="text-xs text-white/50">AI-detected</span>
        </div>
      </div>

      {/* Table */}
      <div className="p-5">
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <div className="w-6 h-6 border-2 border-blue-400/40 border-t-blue-400 rounded-full animate-spin" />
          </div>
        ) : summaryRows.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 gap-2">
            <Calendar className="w-8 h-8 text-white/20" />
            <p className="text-sm text-white/40">No records for this week</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  {["Student", "Code", "Sessions", "Present", "Absent", "Late", "Attendance"].map(
                    (h) => (
                      <th
                        key={h}
                        className="text-left pb-3 text-xs font-medium text-white/40 pr-4"
                      >
                        {h}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {summaryRows.map((row, i) => {
                  const cat = categorizePct(row.pct);
                  return (
                    <motion.tr
                      key={row.studentId}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.03, duration: 0.25 }}
                      className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors"
                    >
                      <td className="py-3 pr-4 text-white/80 font-medium">
                        {row.name}
                      </td>
                      <td className="py-3 pr-4 text-white/50 font-mono text-xs">
                        {row.code}
                      </td>
                      <td className="py-3 pr-4 text-white/60">{row.sessions}</td>
                      <td className="py-3 pr-4 text-emerald-400">{row.present}</td>
                      <td className="py-3 pr-4 text-red-400">{row.absent}</td>
                      <td className="py-3 pr-4 text-amber-400">{row.late}</td>
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-2.5">
                          {/* percentage bar */}
                          <div className="w-20 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{
                                width: `${row.pct}%`,
                                background: PCT_COLORS[cat],
                              }}
                            />
                          </div>
                          <Badge
                            className={`text-xs border px-2 py-0 ${BADGE_CLASSES[cat]}`}
                          >
                            {row.pct}%
                          </Badge>
                        </div>
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default WeeklyAttendanceSummary;
