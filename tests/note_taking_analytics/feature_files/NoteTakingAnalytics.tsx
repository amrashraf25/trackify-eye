import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

// ─── TYPES ────────────────────────────────────────────────────────────────────

export interface NoteTakingRecord {
  id: string;
  studentId: string;
  studentName: string;
  sessionId: string;
  durationSeconds: number;
  detectedAt: string;
}

export interface StudentNoteSummary {
  studentId: string;
  name: string;
  totalSeconds: number;
  avgSecondsPerSession: number;
  sessionCount: number;
  engagementScore: number;
}

// ─── PURE FUNCTIONS (exported for testing) ────────────────────────────────────

/**
 * Formats a raw second count into a "Xm Ys" string.
 * Example: formatDuration(754) → "12m 34s"
 */
export function formatDuration(seconds: number): string {
  const totalSeconds = Math.max(0, Math.floor(seconds));
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}m ${String(s).padStart(2, "0")}s`;
}

/**
 * Calculates an engagement score (0–100) as the ratio of note-taking time
 * to session duration, capped at 100.
 * Returns 0 when sessionDurationSeconds is 0.
 */
export function calcEngagementScore(
  noteTakingSeconds: number,
  sessionDurationSeconds: number
): number {
  if (sessionDurationSeconds <= 0) return 0;
  const raw = (noteTakingSeconds / sessionDurationSeconds) * 100;
  return Math.min(100, Math.round(raw));
}

/**
 * Filters records to only those belonging to the given session.
 */
export function filterBySession(
  records: NoteTakingRecord[],
  sessionId: string
): NoteTakingRecord[] {
  return records.filter((r) => r.sessionId === sessionId);
}

/**
 * Aggregates per-student summaries from a flat list of records.
 * Each student's engagementScore uses their average note-taking duration
 * divided by 3600 (1-hour benchmark session) * 100, capped at 100.
 * A more realistic formula can be swapped in once session durations are available.
 */
export function buildStudentSummary(
  records: NoteTakingRecord[]
): StudentNoteSummary[] {
  const byStudent = new Map<string, NoteTakingRecord[]>();

  for (const record of records) {
    const existing = byStudent.get(record.studentId) ?? [];
    existing.push(record);
    byStudent.set(record.studentId, existing);
  }

  const summaries: StudentNoteSummary[] = [];
  for (const [studentId, studentRecords] of byStudent.entries()) {
    const totalSeconds = studentRecords.reduce((sum, r) => sum + r.durationSeconds, 0);
    const sessionCount = new Set(studentRecords.map((r) => r.sessionId)).size;
    const avgSecondsPerSession = sessionCount > 0 ? Math.round(totalSeconds / sessionCount) : 0;
    const engagementScore = calcEngagementScore(avgSecondsPerSession, 3600);

    summaries.push({
      studentId,
      name: studentRecords[0].studentName,
      totalSeconds,
      avgSecondsPerSession,
      sessionCount,
      engagementScore,
    });
  }

  return summaries;
}

/**
 * Sorts summaries by totalSeconds ascending or descending.
 */
export function sortByDuration(
  summaries: StudentNoteSummary[],
  direction: "asc" | "desc"
): StudentNoteSummary[] {
  return [...summaries].sort((a, b) =>
    direction === "asc"
      ? a.totalSeconds - b.totalSeconds
      : b.totalSeconds - a.totalSeconds
  );
}

/**
 * Returns the top N summaries ranked by engagementScore descending.
 * Returns [] when n <= 0.
 */
export function getTopEngaged(
  summaries: StudentNoteSummary[],
  n: number
): StudentNoteSummary[] {
  if (n <= 0) return [];
  return [...summaries]
    .sort((a, b) => b.engagementScore - a.engagementScore)
    .slice(0, n);
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function scoreColor(score: number): string {
  if (score >= 70) return "hsl(142 71% 45%)";  // green
  if (score >= 40) return "hsl(38 100% 56%)";   // amber
  return "hsl(0 84% 60%)";                       // red
}

// ─── COMPONENT ────────────────────────────────────────────────────────────────

const NoteTakingAnalytics = () => {
  const [selectedSession, setSelectedSession] = useState<string>("all");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const { data: allRecords = [], isLoading } = useQuery<NoteTakingRecord[]>({
    queryKey: ["note-taking-records"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("note_taking_records")
        .select("*")
        .order("detected_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((row: Record<string, unknown>) => ({
        id: String(row.id),
        studentId: String(row.student_id),
        studentName: String(row.student_name),
        sessionId: String(row.session_id),
        durationSeconds: Number(row.duration_seconds),
        detectedAt: String(row.detected_at),
      }));
    },
  });

  const sessionIds = useMemo(
    () => Array.from(new Set(allRecords.map((r) => r.sessionId))),
    [allRecords]
  );

  const filtered = useMemo(
    () =>
      selectedSession === "all"
        ? allRecords
        : filterBySession(allRecords, selectedSession),
    [allRecords, selectedSession]
  );

  const summaries = useMemo(() => buildStudentSummary(filtered), [filtered]);
  const sorted    = useMemo(() => sortByDuration(summaries, sortDir), [summaries, sortDir]);
  const topFive   = useMemo(() => getTopEngaged(summaries, 5), [summaries]);

  // Is current session live? (simple heuristic: most recent record < 10 min old)
  const isSessionLive = useMemo(() => {
    if (!allRecords.length) return false;
    const latest = new Date(allRecords[0].detectedAt).getTime();
    return Date.now() - latest < 10 * 60 * 1000;
  }, [allRecords]);

  return (
    <div className="min-h-screen p-6 space-y-6" style={{ background: "hsl(225 25% 5%)" }}>
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-white/[0.07] overflow-hidden"
        style={{ background: "hsl(225 25% 7%)" }}
      >
        <div
          className="px-5 py-4 border-b border-white/[0.06]"
          style={{
            background: "linear-gradient(90deg, hsl(217 91% 60% / 0.06), transparent)",
          }}
        >
          <div className="flex items-center gap-3">
            <h2 className="text-white font-semibold text-lg">Note-Taking Analytics</h2>
            {isSessionLive && (
              <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium text-green-400 border border-green-500/30 bg-green-500/08">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500" />
                </span>
                LIVE
              </span>
            )}
            <div className="ml-auto">
              <select
                value={selectedSession}
                onChange={(e) => setSelectedSession(e.target.value)}
                className="px-3 py-1.5 rounded-lg border border-white/[0.1] text-white text-sm bg-transparent focus:outline-none"
                style={{ background: "hsl(225 25% 9%)" }}
              >
                <option value="all">All Sessions</option>
                {sessionIds.map((sid) => (
                  <option key={sid} value={sid}>
                    Session {sid}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <p className="text-white/50 text-sm mt-0.5">TP-28 — Instructor Dashboard</p>
        </div>

        {/* Bar chart — Top 5 engaged students */}
        {!isLoading && topFive.length > 0 && (
          <div className="p-5">
            <p className="text-white/50 text-xs mb-4">Top 5 — Engagement Score</p>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={topFive} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <XAxis
                  dataKey="name"
                  tick={{ fill: "hsl(217 91% 60%)", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    background: "hsl(225 25% 9%)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: "8px",
                    color: "#fff",
                    fontSize: 12,
                  }}
                  formatter={(value: number) => [`${value}%`, "Score"]}
                />
                <Bar dataKey="engagementScore" radius={[4, 4, 0, 0]}>
                  {topFive.map((entry) => (
                    <Cell key={entry.studentId} fill={scoreColor(entry.engagementScore)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </motion.div>

      {/* Per-student table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="rounded-2xl border border-white/[0.07] overflow-hidden"
        style={{ background: "hsl(225 25% 7%)" }}
      >
        <div
          className="px-5 py-4 border-b border-white/[0.06]"
          style={{
            background: "linear-gradient(90deg, hsl(217 91% 60% / 0.06), transparent)",
          }}
        >
          <div className="flex items-center justify-between">
            <h3 className="text-white font-semibold">Student Breakdown</h3>
            <button
              onClick={() => setSortDir((d) => (d === "desc" ? "asc" : "desc"))}
              className="text-xs text-white/50 hover:text-white transition-colors border border-white/[0.1] px-3 py-1 rounded-lg"
              style={{ background: "hsl(225 25% 9%)" }}
            >
              Sort {sortDir === "desc" ? "↓ Most" : "↑ Least"} Active
            </button>
          </div>
        </div>
        <div className="p-5">
          {isLoading ? (
            <p className="text-white/40 text-sm text-center py-8">Loading…</p>
          ) : sorted.length === 0 ? (
            <p className="text-white/40 text-sm text-center py-8">
              No note-taking activity recorded.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-white/40 text-xs border-b border-white/[0.06]">
                  <th className="text-left pb-3 font-medium">Student</th>
                  <th className="text-left pb-3 font-medium">Total Duration</th>
                  <th className="text-left pb-3 font-medium">Sessions</th>
                  <th className="text-left pb-3 font-medium">Engagement</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((summary) => (
                  <tr
                    key={summary.studentId}
                    className="border-b border-white/[0.04] last:border-0"
                  >
                    <td className="py-3 text-white font-medium">{summary.name}</td>
                    <td className="py-3 text-white/70 font-mono text-xs">
                      {formatDuration(summary.totalSeconds)}
                    </td>
                    <td className="py-3 text-white/60">{summary.sessionCount}</td>
                    <td className="py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${summary.engagementScore}%` }}
                            transition={{ duration: 0.5, ease: "easeOut" }}
                            className="h-full rounded-full"
                            style={{ background: scoreColor(summary.engagementScore) }}
                          />
                        </div>
                        <span
                          className="text-xs font-semibold w-10 text-right"
                          style={{ color: scoreColor(summary.engagementScore) }}
                        >
                          {summary.engagementScore}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default NoteTakingAnalytics;
