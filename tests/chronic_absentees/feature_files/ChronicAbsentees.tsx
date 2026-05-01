import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import { UserX, AlertTriangle, BookOpen, SlidersHorizontal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";

// ─── TYPES ────────────────────────────────────────────────────────────────────

export interface AttendanceRecord {
  id: string;
  student_id: string;
  session_id: string;
  status: "present" | "absent" | "late";
  confirmed_at: string;
}

export interface Student {
  id: string;
  name: string;
  code: string;
}

export interface Enrollment {
  student_id: string;
  course_id: string;
  course_name: string;
}

export interface StudentRow {
  studentId: string;
  name: string;
  code: string;
  courses: string[];
  totalClasses: number;
  attended: number;
  absences: number;
  pct: number;
}

// ─── PURE FUNCTIONS (exported for testing) ────────────────────────────────────

/**
 * Returns true when attended / totalClasses < threshold / 100.
 * If totalClasses is 0, the student is NOT considered a chronic absentee
 * (no data is not the same as being absent).
 */
export function isChronicAbsentee(
  totalClasses: number,
  attended: number,
  threshold: number
): boolean {
  if (totalClasses <= 0) return false;
  return attended / totalClasses < threshold / 100;
}

/**
 * Filters rows to only those where isChronicAbsentee is true.
 */
export function filterChronicAbsentees(
  rows: StudentRow[],
  threshold: number
): StudentRow[] {
  if (!rows || rows.length === 0) return [];
  return rows.filter((r) =>
    isChronicAbsentee(r.totalClasses, r.attended, threshold)
  );
}

/**
 * Sorts rows ascending by pct (worst first).
 * Does not mutate the original array.
 */
export function sortByAttendance(rows: StudentRow[]): StudentRow[] {
  if (!rows || rows.length === 0) return [];
  return [...rows].sort((a, b) => a.pct - b.pct);
}

/**
 * Aggregates raw attendance records and enrollments into StudentRow[].
 * Each student gets: list of enrolled course names, total sessions counted,
 * attended (present + late), absences, and pct.
 */
export function buildAbsenteeRows(
  records: AttendanceRecord[],
  students: Student[],
  enrollments: Enrollment[]
): StudentRow[] {
  if (!students || students.length === 0) return [];

  const map = new Map<string, StudentRow>();

  for (const s of students) {
    map.set(s.id, {
      studentId: s.id,
      name: s.name,
      code: s.code,
      courses: [],
      totalClasses: 0,
      attended: 0,
      absences: 0,
      pct: 0,
    });
  }

  // Attach course names from enrollments
  for (const e of enrollments ?? []) {
    const row = map.get(e.student_id);
    if (row && !row.courses.includes(e.course_name)) {
      row.courses.push(e.course_name);
    }
  }

  // Tally attendance records
  for (const r of records ?? []) {
    const row = map.get(r.student_id);
    if (!row) continue;
    row.totalClasses += 1;
    if (r.status === "present" || r.status === "late") {
      row.attended += 1;
    } else {
      row.absences += 1;
    }
  }

  // Compute pct
  for (const row of map.values()) {
    row.pct =
      row.totalClasses === 0
        ? 100 // no classes → treat as 100% so they don't appear as absentees
        : Math.round((row.attended / row.totalClasses) * 100);
  }

  return Array.from(map.values());
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────

const SEVERITY_BADGE = (pct: number) => {
  if (pct < 30)
    return "bg-red-500/20 text-red-400 border-red-500/30";
  if (pct < 50)
    return "bg-orange-500/20 text-orange-400 border-orange-500/30";
  return "bg-amber-500/20 text-amber-400 border-amber-500/30";
};

const SEVERITY_LABEL = (pct: number) => {
  if (pct < 30) return "Critical";
  if (pct < 50) return "High Risk";
  return "At Risk";
};

// ─── COMPONENT ────────────────────────────────────────────────────────────────

const ChronicAbsentees = () => {
  const [threshold, setThreshold] = useState(60);

  // Fetch students
  const { data: students = [], isLoading: loadingStudents } = useQuery({
    queryKey: ["students", "absentees"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("students")
        .select("id, name, code");
      if (error) throw error;
      return (data ?? []) as Student[];
    },
  });

  // Fetch attendance records
  const { data: records = [], isLoading: loadingRecords } = useQuery({
    queryKey: ["attendance_records", "absentees"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendance_records")
        .select("id, student_id, session_id, status, confirmed_at");
      if (error) throw error;
      return (data ?? []) as AttendanceRecord[];
    },
  });

  // Fetch enrollments
  const { data: enrollments = [], isLoading: loadingEnrollments } = useQuery({
    queryKey: ["enrollments", "absentees"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("enrollments")
        .select("student_id, course_id, course_name");
      if (error) throw error;
      return (data ?? []) as Enrollment[];
    },
  });

  const absenteeList = useMemo(() => {
    const allRows = buildAbsenteeRows(records, students, enrollments);
    const filtered = filterChronicAbsentees(allRows, threshold);
    return sortByAttendance(filtered);
  }, [records, students, enrollments, threshold]);

  const isLoading = loadingStudents || loadingRecords || loadingEnrollments;

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
            "linear-gradient(90deg, hsl(0 84% 60% / 0.06), transparent)",
        }}
      >
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-red-500/20 flex items-center justify-center">
            <UserX className="w-4 h-4 text-red-400" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-white/90">
              Chronic Absentees
            </h2>
            <p className="text-xs text-white/40 mt-0.5">
              Students below attendance threshold
            </p>
          </div>
        </div>

        <Badge className="bg-red-500/20 text-red-400 border border-red-500/30 text-xs">
          {absenteeList.length} flagged
        </Badge>
      </div>

      {/* Threshold control */}
      <div className="px-5 py-4 border-b border-white/[0.04]">
        <div className="flex items-center gap-3">
          <SlidersHorizontal className="w-3.5 h-3.5 text-white/40 shrink-0" />
          <span className="text-xs text-white/50 shrink-0">Threshold</span>
          <div className="flex-1">
            <Slider
              min={10}
              max={90}
              step={5}
              value={[threshold]}
              onValueChange={([v]) => setThreshold(v)}
              className="w-full"
            />
          </div>
          <span className="text-xs font-mono text-amber-400 w-10 text-right shrink-0">
            {threshold}%
          </span>
        </div>
        <p className="text-xs text-white/30 mt-1.5 ml-6">
          Students attending fewer than {threshold}% of sessions are flagged
        </p>
      </div>

      {/* List */}
      <div className="p-5">
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <div className="w-6 h-6 border-2 border-red-400/40 border-t-red-400 rounded-full animate-spin" />
          </div>
        ) : absenteeList.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 gap-2">
            <AlertTriangle className="w-8 h-8 text-white/20" />
            <p className="text-sm text-white/40">
              No students below {threshold}% threshold
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <AnimatePresence mode="popLayout">
              {absenteeList.map((row, i) => (
                <motion.div
                  key={row.studentId}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ delay: i * 0.04, duration: 0.25 }}
                  className="flex items-center gap-4 px-4 py-3 rounded-xl border border-white/[0.05] hover:border-white/[0.09] hover:bg-white/[0.02] transition-all"
                >
                  {/* Avatar */}
                  <div className="w-9 h-9 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center shrink-0">
                    <span className="text-xs font-semibold text-red-400">
                      {row.name.charAt(0).toUpperCase()}
                    </span>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-white/85 truncate">
                        {row.name}
                      </span>
                      <span className="text-xs text-white/40 font-mono">
                        {row.code}
                      </span>
                    </div>
                    {row.courses.length > 0 && (
                      <div className="flex items-center gap-1 mt-1 flex-wrap">
                        <BookOpen className="w-3 h-3 text-white/30 shrink-0" />
                        {row.courses.map((c) => (
                          <span
                            key={c}
                            className="text-xs text-white/40 bg-white/[0.04] px-1.5 py-0.5 rounded"
                          >
                            {c}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Stats */}
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <p className="text-xs text-white/40">Absences</p>
                      <p className="text-sm font-semibold text-red-400">
                        {row.absences}
                      </p>
                    </div>
                    <Badge
                      className={`text-xs border px-2.5 py-0.5 ${SEVERITY_BADGE(row.pct)}`}
                    >
                      {row.pct}% · {SEVERITY_LABEL(row.pct)}
                    </Badge>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default ChronicAbsentees;
