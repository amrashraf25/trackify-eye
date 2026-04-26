import MainLayout from "@/components/layout/MainLayout";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import {
  CalendarDays, Clock, Users,
  ChevronRight, BookOpen, BrainCircuit, UserCheck,
  RefreshCw, Play, Square, Activity, ClipboardCheck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { PageHeader } from "@/components/ui/page-header";
import { StatsGrid } from "@/components/ui/stats-grid";

const LOCAL_API = "http://localhost:3001";

type Session = {
  id: string;
  course_id: string;
  course_name?: string;
  course_code?: string;
  doctor_name?: string;
  week_number: number;
  session_type: string;
  status: "active" | "ended";
  started_at: string;
  ended_at?: string;
  scheduled_end_at?: string;
  sched_start?: string;
  sched_end?: string;
  total_present: number;
  total_enrolled: number;
  // student-only field
  my_attendance?: { status: string; is_late: number; confirmed_at: string; method: string } | null;
};

type AttendanceRecord = {
  id: string;
  student_id: string;
  student_code: string;
  full_name: string;
  avatar_url?: string;
  status: "present" | "absent" | "late";
  is_late: number;
  confirmed_at: string;
  method: string;
  confidence: number;
};

type BehaviorSummaryItem = {
  behavior_type: string;
  severity: string;
  occurrences: number;
  count?: number;
  total_duration: number;
  avg_confidence: number;
};

const BEHAVIOR_COLOR: Record<string, string> = {
  phone:    "text-orange-400",
  sleeping: "text-blue-400",
  talking:  "text-yellow-400",
  fighting: "text-red-500",
  cheating: "text-rose-400",
  drowsy:   "text-purple-400",
};

const TYPE_LABEL: Record<string, string> = {
  lecture: "Lecture",
  problem_solving: "Problem Solving",
  lab: "Lab",
  tutorial: "Tutorial",
};

const STATUS_BADGE = {
  present: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  late:    "bg-amber-500/15   text-amber-400   border-amber-500/30",
  absent:  "bg-red-500/15     text-red-400     border-red-500/30",
};

function fmtTime(iso?: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
function fmtDate(iso?: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}

// ── Attendance panel for a single session ───────────────────────────
function SessionAttendancePanel({ session, canEdit }: { session: Session; canEdit: boolean }) {
  const qc = useQueryClient();

  // Fetches per-session analytics (attendance + behavior events); polls every 5s while session is active.
  const { data: analytics, isLoading } = useQuery<any>({
    queryKey: ["session-analytics", session.id],
    queryFn: async () => {
      const r = await fetch(`${LOCAL_API}/api/analytics/session/${session.id}`);
      if (!r.ok) return null;
      return r.json();
    },
    refetchInterval: session.status === "active" ? 5000 : false,
  });

  const records: (AttendanceRecord & { behaviors?: BehaviorSummaryItem[]; totalBehaviorEvents?: number; riskLevel?: string })[] =
    analytics?.attendance ?? [];

  // Manually overrides a student's attendance status via the local API (PATCH request).
  const override = useMutation({
    mutationFn: async ({ student_id, status }: { student_id: string; status: string }) => {
      const r = await fetch(`${LOCAL_API}/api/session/${session.id}/attendance/${student_id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!r.ok) throw new Error((await r.json()).error);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["session-analytics", session.id] });
      qc.invalidateQueries({ queryKey: ["sessions-list"] });
      toast.success("Attendance updated");
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (isLoading) return <p className="text-xs text-muted-foreground py-4 text-center">Loading…</p>;
  if (!records.length) return <p className="text-xs text-muted-foreground py-4 text-center">No attendance records yet</p>;

  const present = records.filter(r => r.status !== "absent").length;
  const absent  = records.filter(r => r.status === "absent").length;
  const stats   = analytics?.stats;

  return (
    <div className="mt-3 space-y-2">
      {/* mini summary */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground pb-1">
        <span className="text-emerald-400 font-medium">{present} present</span>
        <span className="text-red-400 font-medium">{absent} absent</span>
        {stats?.late > 0 && <span className="text-amber-400 font-medium">{stats.late} late</span>}
        <span>{records.length} total</span>
      </div>

      {records.map(rec => {
        const risk = rec.riskLevel || "low";
        const riskBorder = risk === "critical" ? "border-red-500/60" : risk === "high" ? "border-orange-500/50" : risk === "medium" ? "border-amber-500/40" : "border-primary/25";
        return (
        <div key={rec.student_id}
          className="flex items-center gap-3 bg-secondary/20 border border-white/[0.04] rounded-xl px-3 py-2.5">
          {/* avatar with risk ring */}
          <div className={`w-8 h-8 rounded-full bg-primary/15 border-2 flex items-center justify-center text-xs font-bold text-primary flex-shrink-0 ${riskBorder}`}>
            {rec.full_name.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{rec.full_name}</p>
            <div className="flex items-center flex-wrap gap-1.5 mt-0.5">
              <span className="text-[10px] text-muted-foreground font-mono">{rec.student_code}</span>
              {(rec.method === "face_recognition" || rec.method === "ai") && (
                <span className="flex items-center gap-0.5 text-[10px] text-violet-400">
                  <BrainCircuit className="w-3 h-3" />AI
                </span>
              )}
              {rec.method === "manual" && (
                <span className="text-[10px] text-amber-400 flex items-center gap-0.5">
                  <UserCheck className="w-3 h-3" />Manual
                </span>
              )}
              {/* Behavior chips */}
              {rec.behaviors && rec.behaviors.length > 0 && rec.behaviors.map((b: BehaviorSummaryItem) => (
                <span key={b.behavior_type}
                  className={`text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-secondary/40 border border-white/[0.05] ${BEHAVIOR_COLOR[b.behavior_type] ?? "text-muted-foreground"}`}>
                  {b.behavior_type} ×{b.count ?? b.occurrences}
                </span>
              ))}
            </div>
          </div>
          {/* status badge */}
          <Badge className={`text-[10px] border ${STATUS_BADGE[rec.status as keyof typeof STATUS_BADGE] ?? ""}`}>
            {rec.status === "absent" ? "Absent" : rec.is_late ? "Late" : "Present"}
          </Badge>
          {/* manual override buttons */}
          {canEdit && (
            <div className="flex gap-1 flex-shrink-0">
              <button
                onClick={() => override.mutate({ student_id: rec.student_id, status: "present" })}
                disabled={override.isPending}
                className={`text-[10px] px-2 py-1 rounded-lg border transition-colors ${
                  rec.status === "present"
                    ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                    : "text-muted-foreground border-white/10 hover:bg-emerald-500/10 hover:text-emerald-400"
                }`}
              >P</button>
              <button
                onClick={() => override.mutate({ student_id: rec.student_id, status: "late" })}
                disabled={override.isPending}
                className={`text-[10px] px-2 py-1 rounded-lg border transition-colors ${
                  rec.status === "late"
                    ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                    : "text-muted-foreground border-white/10 hover:bg-amber-500/10 hover:text-amber-400"
                }`}
              >L</button>
              <button
                onClick={() => override.mutate({ student_id: rec.student_id, status: "absent" })}
                disabled={override.isPending}
                className={`text-[10px] px-2 py-1 rounded-lg border transition-colors ${
                  rec.status === "absent"
                    ? "bg-red-500/20 text-red-300 border-red-500/40"
                    : "text-muted-foreground border-white/10 hover:bg-red-500/10 hover:text-red-400"
                }`}
              >A</button>
            </div>
          )}
        </div>
        );
      })}
    </div>
  );
}

// ── Session card ─────────────────────────────────────────────────────
function SessionCard({ session, canEdit, isStudent }: { session: Session; canEdit: boolean; isStudent: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const att = session.my_attendance;
  const rate = session.total_enrolled > 0
    ? Math.round((session.total_present / session.total_enrolled) * 100)
    : null;

  return (
    <div className={`tilt-3d depth-card glass rounded-2xl border transition-all ${
      session.status === "active"
        ? "halo-3d animate-pulse border-primary/30 shadow-[0_0_20px_hsl(217_91%_60%/0.08)]"
        : "border-white/[0.06]"
    }`}>
      {/* ── Card header ── */}
      <div
        className="flex items-start gap-4 p-4 cursor-pointer"
        onClick={() => !isStudent && setExpanded(e => !e)}
      >
        {/* Date block */}
        <div className="w-12 flex-shrink-0 text-center bg-secondary/40 rounded-xl p-2 border border-white/[0.05]">
          <p className="text-[10px] text-muted-foreground">{new Date(session.started_at).toLocaleDateString([], { month: "short" })}</p>
          <p className="text-lg font-bold text-foreground leading-none">{new Date(session.started_at).getDate()}</p>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            {session.status === "active" && (
              <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 rounded-full animate-pulse">
                ● LIVE
              </span>
            )}
            <span className="text-sm font-bold text-foreground">
              {session.course_name ?? session.course_id}
            </span>
            {session.course_code && (
              <span className="text-[10px] text-muted-foreground font-mono">{session.course_code}</span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <BookOpen className="w-3 h-3" />
              {TYPE_LABEL[session.session_type] ?? session.session_type}
            </span>
            <span className="flex items-center gap-1">
              <CalendarDays className="w-3 h-3" />
              Week {session.week_number}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {fmtTime(session.started_at)}
              {session.sched_end ? ` – ${session.sched_end}` : session.ended_at ? ` – ${fmtTime(session.ended_at)}` : ""}
            </span>
            {session.doctor_name && <span>{session.doctor_name}</span>}
          </div>
        </div>

        <div className="flex flex-col items-end gap-2 flex-shrink-0">
          {/* Student: my attendance badge */}
          {isStudent && att && (
            <Badge className={`text-xs border ${STATUS_BADGE[att.status as keyof typeof STATUS_BADGE] ?? ""}`}>
              {att.status === "present" ? "Present" : att.status === "late" ? "Late" : "Absent"}
            </Badge>
          )}
          {isStudent && !att && (
            <Badge variant="secondary" className="text-xs">Not recorded</Badge>
          )}

          {/* Staff: attendance rate */}
          {!isStudent && rate !== null && (
            <span className="text-xs font-bold text-foreground tabular-nums">
              {session.total_present}/{session.total_enrolled}
              <span className="text-muted-foreground font-normal ml-1">({rate}%)</span>
            </span>
          )}

          {!isStudent && (
            <ChevronRight className={`w-4 h-4 text-muted-foreground transition-transform ${expanded ? "rotate-90" : ""}`} />
          )}
        </div>
      </div>

      {/* Student: my session details */}
      {isStudent && att && (
        <div className="px-4 pb-4 pt-0">
          <div className="bg-secondary/20 rounded-xl p-3 border border-white/[0.04] text-xs text-muted-foreground space-y-1">
            {att.status !== "absent" && att.confirmed_at && (
              <p>Confirmed at: <span className="text-foreground">{fmtTime(att.confirmed_at)}</span></p>
            )}
            <p>Method: <span className="text-foreground capitalize">{att.method?.replace("_", " ")}</span></p>
            {att.is_late === 1 && <p className="text-amber-400">Marked as late arrival</p>}
          </div>
        </div>
      )}

      {/* Staff: expandable attendance panel */}
      {!isStudent && expanded && (
        <div className="px-4 pb-4 border-t border-white/[0.05] pt-3">
          <SessionAttendancePanel session={session} canEdit={canEdit} />
        </div>
      )}
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────
// Lists class sessions with attendance details; students see their own attendance, staff see full analytics and can override.
const Sessions = () => {
  const { role, user } = useAuth();
  const isStudent = role === "student";
  const canEdit   = role === "admin" || role === "dean" || role === "doctor";

  const [filterCourse, setFilterCourse] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const qc = useQueryClient();

  // Fetches all courses from the local REST API for the filter dropdown.
  const { data: courses = [] } = useQuery<{ id: string; name: string; code?: string }[]>({
    queryKey: ["sessions-courses"],
    queryFn: async () => {
      const r = await fetch(`${LOCAL_API}/rest/v1/courses`);
      return r.json();
    },
  });

  // Fetches sessions with active filters; includes student's own attendance when role is student; polls every 3s.
  const { data: sessions = [], isLoading, refetch } = useQuery<Session[]>({
    queryKey: ["sessions-list", filterCourse, filterStatus, user?.id],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: "100" });
      if (filterCourse !== "all") params.set("course_id", filterCourse);
      if (filterStatus !== "all") params.set("status", filterStatus);
      if (isStudent && user?.id) params.set("student_id", user.id);
      const r = await fetch(`${LOCAL_API}/api/session/list?${params}`);
      return r.json();
    },
    staleTime: 0,
    refetchInterval: 3000,
    refetchOnWindowFocus: true,
  });

  const activeSessions  = sessions.filter(s => s.status === "active");
  const endedSessions   = sessions.filter(s => s.status === "ended");

  const totalAttendance = sessions.reduce((s, sess) => s + sess.total_present, 0);
  const totalEnrolled = sessions.reduce((s, sess) => s + sess.total_enrolled, 0);
  const avgRate = totalEnrolled > 0 ? Math.round((totalAttendance / totalEnrolled) * 100) : 0;

  return (
    <MainLayout title="Sessions">
      <div className="space-y-6">
        {/* Page Header */}
        <PageHeader
          icon={CalendarDays}
          label="Class Management"
          title={isStudent ? "My Sessions" : "All Sessions"}
          description={`${sessions.length} total · ${activeSessions.length} active · ${endedSessions.length} ended`}
          iconColor="text-primary"
          glowColor="bg-primary/12"
        >
          <button
            onClick={() => refetch()}
            className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground border border-white/[0.08] hover:bg-secondary/40 px-3 py-2 rounded-xl transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </PageHeader>

        {/* Stats Cards */}
        {!isStudent && (
          <StatsGrid items={[
            { icon: CalendarDays, label: "Total Sessions", value: sessions.length, color: "primary" },
            { icon: Play, label: "Active Now", value: activeSessions.length, color: "emerald" },
            { icon: ClipboardCheck, label: "Avg. Attendance", value: `${avgRate}%`, color: avgRate >= 80 ? "emerald" : avgRate >= 60 ? "amber" : "red" },
            { icon: Activity, label: "Ended", value: endedSessions.length, color: "violet" },
          ]} />
        )}

        {/* Filters */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex flex-wrap items-center gap-3 glass rounded-2xl px-4 py-3 border border-border/50"
        >
          <Select value={filterCourse} onValueChange={setFilterCourse}>
            <SelectTrigger className="w-52 bg-secondary/40 border-white/[0.08] rounded-xl">
              <SelectValue placeholder="All Courses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Courses</SelectItem>
              {courses.map(c => (
                <SelectItem key={c.id} value={c.id}>{c.code ? `${c.code} — ` : ""}{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-36 bg-secondary/40 border-white/[0.08] rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="ended">Ended</SelectItem>
            </SelectContent>
          </Select>

          <div className="ml-auto text-[10px] text-muted-foreground">
            {sessions.length} result{sessions.length !== 1 ? "s" : ""}
          </div>
        </motion.div>

        {isLoading && (
          <div className="space-y-3">
            {[1,2,3].map(i => (
              <div key={i} className="rounded-2xl border border-white/[0.06] p-5 animate-pulse bg-card/30">
                <div className="flex gap-4">
                  <div className="w-12 h-14 rounded-xl bg-secondary/40" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-40 rounded bg-secondary/40" />
                    <div className="h-3 w-60 rounded bg-secondary/30" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Active sessions */}
        {activeSessions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="space-y-3"
          >
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_6px_#22c55e]" />
              Active Sessions ({activeSessions.length})
            </h3>
            {activeSessions.map((s, i) => (
              <motion.div key={s.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 + i * 0.05 }}>
                <SessionCard session={s} canEdit={canEdit} isStudent={isStudent} />
              </motion.div>
            ))}
          </motion.div>
        )}

        {/* Ended sessions */}
        {endedSessions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="space-y-3"
          >
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <Square className="w-3 h-3 text-muted-foreground/40" />
              Past Sessions ({endedSessions.length})
            </h3>
            {endedSessions.map((s, i) => (
              <motion.div key={s.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 + i * 0.03 }}>
                <SessionCard session={s} canEdit={canEdit} isStudent={isStudent} />
              </motion.div>
            ))}
          </motion.div>
        )}

        {!isLoading && sessions.length === 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-20 rounded-2xl border border-border/30 bg-card/50"
          >
            <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/15 flex items-center justify-center mx-auto mb-4">
              <CalendarDays className="w-7 h-7 text-primary/40" />
            </div>
            <p className="font-semibold text-foreground">No sessions found</p>
            <p className="text-sm text-muted-foreground mt-1.5">Sessions are created automatically from schedules</p>
          </motion.div>
        )}
      </div>
    </MainLayout>
  );
};

export default Sessions;
