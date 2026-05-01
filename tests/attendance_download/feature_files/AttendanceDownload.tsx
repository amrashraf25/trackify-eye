import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { Download, FileDown, Filter, Table2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

// ─── TYPES ────────────────────────────────────────────────────────────────────

export interface AttendanceRecord {
  id: string;
  student_id: string;
  student_name: string;
  student_code: string;
  course_id: string;
  course_name: string;
  session_date: string; // ISO date string
  status: string;
}

export interface CsvColumn {
  key: keyof AttendanceRecord | string;
  label: string;
}

// ─── PURE FUNCTIONS (exported for testing) ────────────────────────────────────

/**
 * Returns a row array: [studentName, studentCode, courseName, date, statusLabel]
 */
export function formatCsvRow(record: AttendanceRecord): string[] {
  return [
    record.student_name ?? "",
    record.student_code ?? "",
    record.course_name ?? "",
    record.session_date
      ? new Date(record.session_date).toLocaleDateString("en-GB")
      : "",
    getStatusLabel(record.status),
  ];
}

/**
 * Builds a complete CSV string with a header row plus one row per record.
 * Values containing commas or quotes are properly escaped.
 */
export function buildCsvContent(
  records: AttendanceRecord[],
  columns: CsvColumn[]
): string {
  const escape = (v: string) => {
    if (v.includes(",") || v.includes('"') || v.includes("\n")) {
      return `"${v.replace(/"/g, '""')}"`;
    }
    return v;
  };

  const header = columns.map((c) => escape(c.label)).join(",");

  if (!records || records.length === 0) return header;

  const rows = records.map((r) => {
    const cells = formatCsvRow(r);
    return cells.map(escape).join(",");
  });

  return [header, ...rows].join("\n");
}

/**
 * Maps raw status string to a human-readable label.
 */
export function getStatusLabel(status: string): string {
  switch ((status ?? "").toLowerCase()) {
    case "present":
      return "Present";
    case "absent":
      return "Absent";
    case "late":
      return "Late";
    default:
      return "Unknown";
  }
}

/**
 * Filters records by course. Pass "all" to return every record.
 */
export function filterDownloadableRecords(
  records: AttendanceRecord[],
  courseId: string | "all"
): AttendanceRecord[] {
  if (!records || records.length === 0) return [];
  if (courseId === "all") return records;
  return records.filter((r) => r.course_id === courseId);
}

// ─── CONSTANTS ───────────────────────────────────────────────────────────────

const DEFAULT_COLUMNS: CsvColumn[] = [
  { key: "student_name", label: "Student Name" },
  { key: "student_code", label: "Student Code" },
  { key: "course_name", label: "Course" },
  { key: "session_date", label: "Date" },
  { key: "status", label: "Status" },
];

const STATUS_BADGE: Record<string, string> = {
  present: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  absent: "bg-red-500/20 text-red-400 border-red-500/30",
  late: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  unknown: "bg-white/10 text-white/40 border-white/10",
};

// ─── COMPONENT ────────────────────────────────────────────────────────────────

const AttendanceDownload = () => {
  const [selectedCourse, setSelectedCourse] = useState<string>("all");
  const [isDownloading, setIsDownloading] = useState(false);

  // Fetch all enriched attendance records
  const { data: records = [], isLoading } = useQuery({
    queryKey: ["attendance_download_records"],
    queryFn: async () => {
      // Join attendance_records → students + sessions + courses
      const { data, error } = await supabase
        .from("attendance_records")
        .select(
          `id,
           status,
           confirmed_at,
           student_id,
           students (name, code),
           sessions (session_date, course_id, courses (name))`
        )
        .order("confirmed_at", { ascending: false });

      if (error) throw error;

      // Flatten joined structure into AttendanceRecord[]
      return ((data ?? []) as unknown[]).map((row: unknown) => {
        const r = row as Record<string, unknown>;
        const student = (r.students ?? {}) as Record<string, string>;
        const session = (r.sessions ?? {}) as Record<string, unknown>;
        const course = (session.courses ?? {}) as Record<string, string>;
        return {
          id: r.id as string,
          student_id: r.student_id as string,
          student_name: student.name ?? "",
          student_code: student.code ?? "",
          course_id: (session.course_id as string) ?? "",
          course_name: course.name ?? "",
          session_date: (session.session_date as string) ?? r.confirmed_at as string,
          status: r.status as string,
        } satisfies AttendanceRecord;
      });
    },
  });

  // Unique courses for the filter dropdown
  const courses = useMemo(() => {
    const seen = new Map<string, string>();
    for (const r of records) {
      if (r.course_id && !seen.has(r.course_id)) {
        seen.set(r.course_id, r.course_name || r.course_id);
      }
    }
    return Array.from(seen.entries()).map(([id, name]) => ({ id, name }));
  }, [records]);

  const filteredRecords = useMemo(
    () => filterDownloadableRecords(records, selectedCourse),
    [records, selectedCourse]
  );

  // Trigger browser download
  const handleDownload = () => {
    setIsDownloading(true);
    try {
      const csv = buildCsvContent(filteredRecords, DEFAULT_COLUMNS);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      const coursePart =
        selectedCourse === "all"
          ? "all-courses"
          : courses.find((c) => c.id === selectedCourse)?.name?.replace(/\s+/g, "-") ??
            selectedCourse;
      link.download = `attendance_${coursePart}_${new Date()
        .toISOString()
        .slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } finally {
      setIsDownloading(false);
    }
  };

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
            "linear-gradient(90deg, hsl(142 71% 45% / 0.06), transparent)",
        }}
      >
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center">
            <FileDown className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-white/90">
              Attendance Report Download
            </h2>
            <p className="text-xs text-white/40 mt-0.5">
              Export filtered attendance records as CSV
            </p>
          </div>
        </div>

        <Badge className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs">
          {filteredRecords.length} records
        </Badge>
      </div>

      {/* Controls */}
      <div className="px-5 py-4 border-b border-white/[0.04] flex items-center gap-3 flex-wrap">
        {/* Course filter */}
        <div className="flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-white/40" />
          <span className="text-xs text-white/50">Course</span>
        </div>
        <Select value={selectedCourse} onValueChange={setSelectedCourse}>
          <SelectTrigger className="w-48 h-8 text-xs bg-white/[0.04] border-white/[0.08] text-white/70">
            <SelectValue placeholder="All Courses" />
          </SelectTrigger>
          <SelectContent className="bg-[hsl(225_25%_10%)] border-white/[0.08]">
            <SelectItem value="all" className="text-xs text-white/70">
              All Courses
            </SelectItem>
            {courses.map((c) => (
              <SelectItem key={c.id} value={c.id} className="text-xs text-white/70">
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Download button */}
        <Button
          size="sm"
          onClick={handleDownload}
          disabled={isDownloading || filteredRecords.length === 0}
          className="ml-auto h-8 px-4 text-xs bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30 gap-1.5"
          variant="ghost"
        >
          <Download className="w-3.5 h-3.5" />
          {isDownloading ? "Generating…" : "Download CSV"}
        </Button>
      </div>

      {/* Preview table */}
      <div className="p-5">
        <div className="flex items-center gap-2 mb-3">
          <Table2 className="w-3.5 h-3.5 text-white/30" />
          <span className="text-xs text-white/40">Preview</span>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <div className="w-6 h-6 border-2 border-emerald-400/40 border-t-emerald-400 rounded-full animate-spin" />
          </div>
        ) : filteredRecords.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 gap-2">
            <Download className="w-8 h-8 text-white/20" />
            <p className="text-sm text-white/40">No records to display</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-white/[0.05]">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-white/[0.06] bg-white/[0.02]">
                  {DEFAULT_COLUMNS.map((col) => (
                    <th
                      key={col.key}
                      className="text-left px-3 py-2.5 text-white/40 font-medium"
                    >
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredRecords.slice(0, 50).map((r, i) => {
                  const statusKey = (r.status ?? "").toLowerCase();
                  return (
                    <motion.tr
                      key={r.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.015, duration: 0.2 }}
                      className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors"
                    >
                      <td className="px-3 py-2 text-white/75">{r.student_name}</td>
                      <td className="px-3 py-2 font-mono text-white/50">{r.student_code}</td>
                      <td className="px-3 py-2 text-white/60">{r.course_name}</td>
                      <td className="px-3 py-2 text-white/50">
                        {r.session_date
                          ? new Date(r.session_date).toLocaleDateString("en-GB")
                          : "—"}
                      </td>
                      <td className="px-3 py-2">
                        <Badge
                          className={`text-xs border px-2 py-0 ${
                            STATUS_BADGE[statusKey] ?? STATUS_BADGE["unknown"]
                          }`}
                        >
                          {getStatusLabel(r.status)}
                        </Badge>
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
            {filteredRecords.length > 50 && (
              <div className="px-3 py-2 text-xs text-white/30 border-t border-white/[0.04] bg-white/[0.01]">
                Showing first 50 of {filteredRecords.length} records — full set
                will be included in the downloaded file.
              </div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default AttendanceDownload;
