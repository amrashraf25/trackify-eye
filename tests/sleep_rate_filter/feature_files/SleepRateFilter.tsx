import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";

// ─── TYPES ────────────────────────────────────────────────────────────────────

export interface ClassSession {
  id: string;
  courseName: string;
  date: string;
  totalStudents: number;
  sleepingCount: number;
}

export interface StudentSleepRecord {
  studentId: string;
  studentName: string;
  sleepDurationSeconds: number;
  sessionId: string;
}

// ─── PURE FUNCTIONS (exported for testing) ────────────────────────────────────

/**
 * Calculates the sleep rate as a 0–100 percentage.
 * Returns 0 when totalStudents is 0 to avoid division by zero.
 */
export function calculateSleepRate(sleepingCount: number, totalStudents: number): number {
  if (totalStudents <= 0) return 0;
  return Math.round((sleepingCount / totalStudents) * 100);
}

/**
 * Returns true when the class sleep rate meets or exceeds the threshold.
 * threshold defaults to 20 (percent).
 */
export function isHighSleepClass(
  sleepingCount: number,
  totalStudents: number,
  threshold: number = 20
): boolean {
  return calculateSleepRate(sleepingCount, totalStudents) >= threshold;
}

/**
 * Filters sessions to only those whose sleep rate >= threshold.
 */
export function filterHighSleepClasses(
  sessions: ClassSession[],
  threshold: number = 20
): ClassSession[] {
  return sessions.filter((s) => isHighSleepClass(s.sleepingCount, s.totalStudents, threshold));
}

/**
 * Returns the top N% of student records ranked by sleepDurationSeconds descending.
 * Returns [] when topPercent is 0 or the list is empty.
 */
export function getTopSleepingStudents(
  students: StudentSleepRecord[],
  topPercent: number
): StudentSleepRecord[] {
  if (students.length === 0 || topPercent <= 0) return [];
  const sorted = [...students].sort((a, b) => b.sleepDurationSeconds - a.sleepDurationSeconds);
  const count = Math.ceil((topPercent / 100) * sorted.length);
  return sorted.slice(0, count);
}

/**
 * Sorts sessions by sleep rate ascending or descending.
 */
export function sortByRate(
  sessions: ClassSession[],
  direction: "asc" | "desc"
): ClassSession[] {
  return [...sessions].sort((a, b) => {
    const rateA = calculateSleepRate(a.sleepingCount, a.totalStudents);
    const rateB = calculateSleepRate(b.sleepingCount, b.totalStudents);
    return direction === "asc" ? rateA - rateB : rateB - rateA;
  });
}

/**
 * Builds a summary object from the provided sessions.
 */
export function buildSleepSummary(
  sessions: ClassSession[]
): { highSleepClasses: number; avgSleepRate: number; worstClass: string } {
  if (sessions.length === 0) {
    return { highSleepClasses: 0, avgSleepRate: 0, worstClass: "—" };
  }
  const highSleepClasses = filterHighSleepClasses(sessions).length;
  const rates = sessions.map((s) => calculateSleepRate(s.sleepingCount, s.totalStudents));
  const avgSleepRate = Math.round(rates.reduce((sum, r) => sum + r, 0) / rates.length);
  const worst = sessions.reduce((prev, curr) =>
    calculateSleepRate(curr.sleepingCount, curr.totalStudents) >
    calculateSleepRate(prev.sleepingCount, prev.totalStudents)
      ? curr
      : prev
  );
  return { highSleepClasses, avgSleepRate, worstClass: worst.courseName };
}

// ─── COMPONENT ────────────────────────────────────────────────────────────────

const SleepRateFilter = () => {
  const [threshold, setThreshold] = useState(20);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showTopSleepers, setShowTopSleepers] = useState(false);

  const { data: sessions = [] } = useQuery<ClassSession[]>({
    queryKey: ["class-sessions-sleep"],
    queryFn: async () => {
      const { data, error } = await supabase.from("class_sessions").select("*");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: studentRecords = [] } = useQuery<StudentSleepRecord[]>({
    queryKey: ["student-sleep-records"],
    queryFn: async () => {
      const { data, error } = await supabase.from("student_sleep_records").select("*");
      if (error) throw error;
      return data ?? [];
    },
  });

  const filtered = useMemo(
    () => filterHighSleepClasses(sessions, threshold),
    [sessions, threshold]
  );

  const sorted = useMemo(() => sortByRate(filtered, sortDir), [filtered, sortDir]);

  const summary = useMemo(() => buildSleepSummary(sessions), [sessions]);

  const topSleepers = useMemo(
    () => getTopSleepingStudents(studentRecords, 20),
    [studentRecords]
  );

  const expandedStudents = useMemo(() => {
    if (!expandedId) return [];
    return studentRecords.filter((s) => s.sessionId === expandedId);
  }, [expandedId, studentRecords]);

  return (
    <div className="min-h-screen p-6" style={{ background: "hsl(225 25% 5%)" }}>
      {/* Summary banner */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-white/[0.07] overflow-hidden mb-6"
        style={{ background: "hsl(225 25% 7%)" }}
      >
        <div
          className="px-5 py-4 border-b border-white/[0.06]"
          style={{
            background: "linear-gradient(90deg, hsl(217 91% 60% / 0.06), transparent)",
          }}
        >
          <h2 className="text-white font-semibold text-lg">High Sleep-Rate Classes</h2>
          <p className="text-white/50 text-sm mt-0.5">TP-24 — Dept Head View</p>
        </div>
        <div className="p-5 grid grid-cols-3 gap-4">
          <div className="text-center">
            <p className="text-white/50 text-xs mb-1">High-Sleep Classes</p>
            <p className="text-amber-400 font-bold text-2xl">{summary.highSleepClasses}</p>
          </div>
          <div className="text-center">
            <p className="text-white/50 text-xs mb-1">Avg Sleep Rate</p>
            <p className="text-white font-bold text-2xl">{summary.avgSleepRate}%</p>
          </div>
          <div className="text-center">
            <p className="text-white/50 text-xs mb-1">Worst Class</p>
            <p className="text-red-400 font-bold text-sm truncate">{summary.worstClass}</p>
          </div>
        </div>
      </motion.div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-4 mb-6">
        <div className="flex items-center gap-3 flex-1 min-w-[240px]">
          <label className="text-white/60 text-sm whitespace-nowrap">
            Threshold: <span className="text-white font-medium">{threshold}%</span>
          </label>
          <input
            type="range"
            min={0}
            max={100}
            value={threshold}
            onChange={(e) => setThreshold(Number(e.target.value))}
            className="flex-1 accent-blue-500"
          />
        </div>
        <button
          onClick={() => setSortDir((d) => (d === "desc" ? "asc" : "desc"))}
          className="px-4 py-2 rounded-lg border border-white/[0.1] text-white/70 text-sm hover:text-white hover:border-white/20 transition-colors"
          style={{ background: "hsl(225 25% 9%)" }}
        >
          Sort {sortDir === "desc" ? "↓ Highest" : "↑ Lowest"}
        </button>
        <button
          onClick={() => setShowTopSleepers((v) => !v)}
          className="px-4 py-2 rounded-lg border border-amber-500/30 text-amber-400 text-sm hover:border-amber-400/60 transition-colors"
          style={{ background: "hsl(225 25% 9%)" }}
        >
          {showTopSleepers ? "Hide" : "Show"} Top 20% Sleepers
        </button>
      </div>

      {/* Top sleepers panel */}
      <AnimatePresence>
        {showTopSleepers && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="rounded-2xl border border-amber-500/20 overflow-hidden mb-6"
            style={{ background: "hsl(225 25% 7%)" }}
          >
            <div
              className="px-5 py-4 border-b border-white/[0.06]"
              style={{
                background: "linear-gradient(90deg, hsl(38 100% 56% / 0.06), transparent)",
              }}
            >
              <h3 className="text-amber-400 font-semibold">Top 20% Sleeping Students</h3>
            </div>
            <div className="p-5 space-y-2">
              {topSleepers.length === 0 ? (
                <p className="text-white/40 text-sm">No records found.</p>
              ) : (
                topSleepers.map((st) => (
                  <div
                    key={st.studentId}
                    className="flex items-center justify-between py-2 px-3 rounded-lg border border-white/[0.05]"
                    style={{ background: "hsl(225 25% 9%)" }}
                  >
                    <span className="text-white text-sm">{st.studentName}</span>
                    <span className="text-amber-400 text-sm font-medium">
                      {Math.round(st.sleepDurationSeconds / 60)}m sleep
                    </span>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Class list */}
      <div className="space-y-3">
        {sorted.length === 0 && (
          <p className="text-white/40 text-sm text-center py-12">
            No classes meet the {threshold}% threshold.
          </p>
        )}
        {sorted.map((session) => {
          const rate = calculateSleepRate(session.sleepingCount, session.totalStudents);
          const isExpanded = expandedId === session.id;
          return (
            <motion.div
              key={session.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl border border-white/[0.07] overflow-hidden"
              style={{ background: "hsl(225 25% 7%)" }}
            >
              <button
                className="w-full text-left"
                onClick={() => setExpandedId(isExpanded ? null : session.id)}
              >
                <div
                  className="px-5 py-4 border-b border-white/[0.06]"
                  style={{
                    background: "linear-gradient(90deg, hsl(217 91% 60% / 0.06), transparent)",
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-white font-medium">{session.courseName}</p>
                      <p className="text-white/40 text-xs mt-0.5">{session.date}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-red-400 font-bold text-xl">{rate}%</p>
                      <p className="text-white/40 text-xs">
                        {session.sleepingCount}/{session.totalStudents} sleeping
                      </p>
                    </div>
                  </div>
                </div>
                <div className="px-5 py-3">
                  <div className="h-2 rounded-full bg-white/[0.06] overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${rate}%` }}
                      transition={{ duration: 0.6, ease: "easeOut" }}
                      className="h-full rounded-full"
                      style={{
                        background:
                          rate >= 50
                            ? "hsl(0 84% 60%)"
                            : rate >= 30
                            ? "hsl(38 100% 56%)"
                            : "hsl(217 91% 60%)",
                      }}
                    />
                  </div>
                </div>
              </button>

              {/* Drawer */}
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="border-t border-white/[0.06] px-5 py-4 space-y-2"
                  >
                    <p className="text-white/50 text-xs mb-3">Students detected sleeping</p>
                    {expandedStudents.length === 0 ? (
                      <p className="text-white/30 text-sm">No student records for this session.</p>
                    ) : (
                      expandedStudents.map((st) => (
                        <div
                          key={st.studentId}
                          className="flex justify-between items-center py-2 px-3 rounded-lg border border-white/[0.05]"
                          style={{ background: "hsl(225 25% 9%)" }}
                        >
                          <span className="text-white text-sm">{st.studentName}</span>
                          <span className="text-red-400 text-xs">
                            {Math.round(st.sleepDurationSeconds / 60)}m
                          </span>
                        </div>
                      ))
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};

export default SleepRateFilter;
