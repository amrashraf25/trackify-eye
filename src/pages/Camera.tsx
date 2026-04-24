import MainLayout from "@/components/layout/MainLayout";
import { useState, useRef, useCallback, useEffect } from "react";
import {
  Video, VideoOff, Users, Clock, Eye, Camera as CameraIcon,
  Square, Scan, Zap, Activity, Wifi, WifiOff,
  UserCheck, AlertTriangle, CircleDot, Radio, RefreshCw, BookUser,
  ShieldAlert, BrainCircuit, Flame, GraduationCap,
  Smartphone, MessageCircle, Moon, EyeOff, ShieldCheck, X, TrendingUp,
  BookOpen, CalendarDays, ChevronDown, MapPin, GraduationCap as GradCap,
  CheckCircle2, XCircle, Timer, BarChart2, ChevronRight,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";

const BACKEND_URL   = "http://localhost:5000";
const LOCAL_API_URL = "http://localhost:3001";

// ── Types ─────────────────────────────────────────────────────────────

type RoomInfo = {
  room_number: string;
  has_active: boolean;
  active_course: string | null;
  active_since: string | null;
  next_course: string | null;
  next_start: string | null;
};

type RoomDashboard = {
  room_number: string;
  activeSession: ActiveSession | null;
  attendance: AttendanceRecord[];
  behaviorSummary: BehaviorItem[];
  nextSession: NextSession | null;
};

type ActiveSession = {
  id: string;
  course_id: string;
  course_name: string;
  course_code: string;
  doctor_name: string;
  session_type: string;
  week_number: number;
  started_at: string;
  scheduled_end_at?: string;
  sched_start?: string;
  sched_end?: string;
  total_enrolled: number;
  total_present: number;
  stats: { total: number; present: number; absent: number; late: number; rate: number };
};

type AttendanceRecord = {
  id: string;
  student_id: string;
  student_code: string;
  full_name: string;
  status: "present" | "absent" | "late";
  is_late: number;
  confirmed_at: string;
  method: string;
  confidence: number;
  behavior_score: number;
  behaviors: { behavior_type: string; severity: string; count: number }[];
};

type BehaviorItem = {
  behavior_type: string;
  severity: string;
  count: number;
  total_sec: number;
  unique_students: number;
};

type NextSession = {
  course_name: string;
  course_code: string;
  doctor_name: string;
  session_type: string;
  week_number: number;
  start_time: string;
  end_time: string;
};

type BackendFace = {
  name: string;
  behavior: string;
  behaviors: string[];
  severity: "critical" | "high" | "medium" | "low" | "normal";
  confidence: number;
  student_code?: string;
  student_id?: string;
};
type BackendStatus = {
  faces: BackendFace[];
  face_count: number;
  fps: number;
  connected: boolean;
  alerts?: Record<string, number>;
};
type AlertCounts = { fighting: number; cheating: number; sleeping: number; phone: number; talking: number; drowsy: number };
type LiveNotif = { id: string; text: string; name: string; severity: "critical" | "high" };

// ── Constants ─────────────────────────────────────────────────────────

const SESSION_TYPES = [
  { value: "lecture",         label: "Lecture" },
  { value: "problem_solving", label: "Problem Solving" },
  { value: "lab",             label: "Lab" },
  { value: "tutorial",        label: "Tutorial" },
];

const TYPE_LABEL: Record<string, string> = {
  lecture: "Lecture", problem_solving: "Problem Solving", lab: "Lab", tutorial: "Tutorial",
};

const BEHAVIOR_STYLE: Record<string, string> = {
  Normal:   "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  Talking:  "bg-amber-500/15   text-amber-400   border-amber-500/30",
  Sleeping: "bg-red-500/15     text-red-400     border-red-500/30",
  Drowsy:   "bg-orange-500/15  text-orange-400  border-orange-500/30",
  Phone:    "bg-red-500/15     text-red-400     border-red-500/30",
  Cheating: "bg-orange-600/15  text-orange-300  border-orange-600/30",
  Fighting: "bg-red-700/20     text-red-300     border-red-600/40",
};

const BEHAVIOR_COLOR: Record<string, string> = {
  phone: "text-orange-400", sleeping: "text-blue-400", talking: "text-yellow-400",
  fighting: "text-red-500", cheating: "text-rose-400", drowsy: "text-purple-400",
};

const BEHAVIOR_ICONS: Record<string, React.ElementType> = {
  Normal: ShieldCheck, Talking: MessageCircle, Sleeping: Moon,
  Drowsy: EyeOff, Phone: Smartphone, Cheating: Eye, Fighting: Flame,
};

const SEVERITY_BORDER: Record<string, string> = {
  critical: "border-l-[3px] border-l-red-500",
  high:     "border-l-[3px] border-l-orange-500",
  medium:   "border-l-[3px] border-l-amber-500",
  low:      "border-l-[3px] border-l-emerald-500/50",
  normal:   "",
};

const ALERT_CFG = [
  { key: "fighting" as const, label: "Fighting", Icon: Flame,         color: "text-red-400",    bg: "bg-red-500/10    border-red-500/25" },
  { key: "cheating" as const, label: "Cheating", Icon: Eye,           color: "text-orange-400", bg: "bg-orange-500/10 border-orange-500/25" },
  { key: "sleeping" as const, label: "Sleeping", Icon: Moon,          color: "text-red-400",    bg: "bg-red-500/10    border-red-500/25" },
  { key: "phone"    as const, label: "Phone",    Icon: Smartphone,    color: "text-amber-400",  bg: "bg-amber-500/10  border-amber-500/25" },
  { key: "talking"  as const, label: "Talking",  Icon: MessageCircle, color: "text-amber-400",  bg: "bg-amber-500/10  border-amber-500/25" },
  { key: "drowsy"   as const, label: "Drowsy",   Icon: EyeOff,        color: "text-orange-400", bg: "bg-orange-500/10 border-orange-500/25" },
] as const;

function fmtTime(iso?: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function minutesUntil(hhmm?: string) {
  if (!hhmm) return null;
  const [h, m] = hhmm.split(":").map(Number);
  const now = new Date();
  const target = new Date(now);
  target.setHours(h, m, 0, 0);
  return Math.round((target.getTime() - now.getTime()) / 60000);
}

// ── Sub-components ────────────────────────────────────────────────────

/** Live attendance + behavior student row */
function StudentRow({ rec }: { rec: AttendanceRecord }) {
  const risk = rec.behavior_score < 60 ? "high" : rec.behavior_score < 80 ? "medium" : "low";
  const ringCls = risk === "high" ? "border-red-500/60" : risk === "medium" ? "border-amber-500/40" : "border-emerald-500/30";
  const statusCls = rec.status === "present"
    ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
    : rec.status === "late"
    ? "bg-amber-500/15 text-amber-400 border-amber-500/30"
    : "bg-red-500/15 text-red-400 border-red-500/30";

  return (
    <div className="flex items-center gap-2.5 bg-secondary/20 border border-white/[0.04] rounded-xl px-3 py-2.5 hover:bg-secondary/30 transition-colors">
      <div className={`w-8 h-8 rounded-full bg-secondary/60 border-2 ${ringCls} flex items-center justify-center text-xs font-bold text-foreground flex-shrink-0`}>
        {rec.full_name.charAt(0).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-foreground truncate">{rec.full_name}</p>
        <div className="flex items-center flex-wrap gap-1 mt-0.5">
          <span className="text-[10px] text-muted-foreground font-mono">{rec.student_code}</span>
          {rec.method === "face_recognition" || rec.method === "ai" ? (
            <span className="text-[9px] text-violet-400 flex items-center gap-0.5">
              <BrainCircuit className="w-2.5 h-2.5" />AI
            </span>
          ) : rec.method === "manual" ? (
            <span className="text-[9px] text-amber-400 flex items-center gap-0.5">
              <UserCheck className="w-2.5 h-2.5" />Manual
            </span>
          ) : null}
          {rec.behaviors.map(b => (
            <span key={b.behavior_type}
              className={`text-[9px] px-1 py-0.5 rounded bg-secondary/60 border border-white/[0.05] ${BEHAVIOR_COLOR[b.behavior_type] ?? "text-muted-foreground"}`}>
              {b.behavior_type}×{b.count}
            </span>
          ))}
        </div>
      </div>
      <span className={`text-[10px] border px-1.5 py-0.5 rounded-lg flex-shrink-0 ${statusCls}`}>
        {rec.status === "present" ? (rec.is_late ? "Late" : "Present") : "Absent"}
      </span>
    </div>
  );
}

/** Session info card shown in right panel */
function SessionInfoCard({ session, streaming }: { session: ActiveSession; streaming: boolean }) {
  const endAt = session.scheduled_end_at;
  const minsLeft = endAt
    ? Math.max(0, Math.round((new Date(endAt).getTime() - Date.now()) / 60000))
    : null;
  const timeWarnCls = minsLeft !== null && minsLeft < 10 ? "text-red-400" : "text-amber-400/80";

  return (
    <div className={`rounded-2xl p-4 border space-y-3 ${
      streaming
        ? "bg-primary/5 border-primary/20 shadow-[0_0_20px_hsl(217_91%_60%/0.06)]"
        : "glass border-border/50"
    }`}>
      {/* Status badge */}
      <div className="flex items-center justify-between">
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
          streaming
            ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30 animate-pulse"
            : "bg-secondary text-muted-foreground border-border"
        }`}>
          {streaming ? "● LIVE SESSION" : "SESSION READY"}
        </span>
        {minsLeft !== null && (
          <span className={`text-[10px] font-mono ${timeWarnCls}`}>
            {minsLeft}m remaining
          </span>
        )}
      </div>

      {/* Course */}
      <div>
        <p className="text-base font-bold text-foreground leading-tight">{session.course_name}</p>
        {session.course_code && (
          <p className="text-[11px] text-muted-foreground font-mono">{session.course_code}</p>
        )}
      </div>

      {/* Meta grid */}
      <div className="grid grid-cols-2 gap-2 text-[11px]">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <BookOpen className="w-3 h-3 flex-shrink-0" />
          <span>{TYPE_LABEL[session.session_type] ?? session.session_type}</span>
        </div>
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <CalendarDays className="w-3 h-3 flex-shrink-0" />
          <span>Week {session.week_number}</span>
        </div>
        {session.doctor_name && (
          <div className="flex items-center gap-1.5 text-muted-foreground col-span-2">
            <GradCap className="w-3 h-3 flex-shrink-0" />
            <span>{session.doctor_name}</span>
          </div>
        )}
        <div className="flex items-center gap-1.5 text-muted-foreground col-span-2">
          <Clock className="w-3 h-3 flex-shrink-0" />
          <span>
            {fmtTime(session.started_at)}
            {(session.sched_end || session.scheduled_end_at) &&
              ` → ${session.sched_end || fmtTime(session.scheduled_end_at)}`}
          </span>
        </div>
      </div>

      {/* Attendance bar */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-muted-foreground flex items-center gap-1">
            <Users className="w-3 h-3" /> Enrolled
          </span>
          <span className="font-bold text-foreground">
            {session.stats.present}/{session.stats.total}
            <span className="text-muted-foreground font-normal ml-1">({session.stats.rate}%)</span>
          </span>
        </div>
        <div className="h-1.5 bg-secondary/60 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ${
              session.stats.rate >= 80 ? "bg-emerald-500" :
              session.stats.rate >= 60 ? "bg-amber-500" : "bg-red-500"
            }`}
            style={{ width: `${session.stats.rate}%` }}
          />
        </div>
        <div className="flex gap-3 text-[10px]">
          <span className="text-emerald-400">{session.stats.present} present</span>
          <span className="text-amber-400">{session.stats.late} late</span>
          <span className="text-red-400">{session.stats.absent} absent</span>
        </div>
      </div>
    </div>
  );
}

/** Behavior summary chips */
function BehaviorSummaryPanel({ items }: { items: BehaviorItem[] }) {
  if (!items.length) return null;
  return (
    <div className="glass rounded-2xl p-4 border border-border/50 space-y-3">
      <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
        <BarChart2 className="w-3.5 h-3.5" /> Behavior Summary
      </h4>
      <div className="grid grid-cols-2 gap-2">
        {items.map(b => (
          <div key={b.behavior_type}
            className={`flex items-center justify-between px-3 py-2 rounded-xl border bg-secondary/20 border-white/[0.04]`}>
            <span className={`text-xs capitalize ${BEHAVIOR_COLOR[b.behavior_type] ?? "text-muted-foreground"}`}>
              {b.behavior_type}
            </span>
            <span className={`text-sm font-bold tabular-nums ${BEHAVIOR_COLOR[b.behavior_type] ?? "text-foreground"}`}>
              {b.count}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** "Next session" preview card */
function NextSessionCard({ next }: { next: NextSession }) {
  const minsUntil = minutesUntil(next.start_time);
  return (
    <div className="glass rounded-2xl p-4 border border-white/[0.06] space-y-2">
      <div className="flex items-center gap-2 text-[10px] text-muted-foreground uppercase tracking-wider">
        <ChevronRight className="w-3 h-3" /> Next Session
        {minsUntil !== null && minsUntil > 0 && (
          <span className="ml-auto text-amber-400 font-bold">in {minsUntil}m</span>
        )}
      </div>
      <p className="text-sm font-bold text-foreground">{next.course_name}</p>
      <div className="flex flex-wrap gap-2 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <Clock className="w-3 h-3" />{next.start_time} – {next.end_time}
        </span>
        <span className="flex items-center gap-1">
          <BookOpen className="w-3 h-3" />{TYPE_LABEL[next.session_type] ?? next.session_type}
        </span>
        {next.doctor_name && (
          <span className="flex items-center gap-1">
            <GradCap className="w-3 h-3" />{next.doctor_name}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────

const Camera = () => {
  const { toast } = useToast();

  // ── streaming state ──────────────────────────────────────────────
  const [elapsed, setElapsed]                        = useState(0);
  const timerRef                                     = useRef<ReturnType<typeof setInterval> | null>(null);
  const [isStarting, setIsStarting]                  = useState(false);
  const [backendConnected, setBackendConnected]      = useState(false);
  const [backendStatus, setBackendStatus]            = useState<BackendStatus | null>(null);
  const [backendDebug, setBackendDebug]              = useState<any | null>(null);
  const [isReloading, setIsReloading]                = useState(false);
  const [alertCounts, setAlertCounts]                = useState<AlertCounts>(
    { fighting: 0, cheating: 0, sleeping: 0, phone: 0, talking: 0, drowsy: 0 }
  );
  const [flashingAlerts, setFlashingAlerts]          = useState<Set<string>>(new Set());
  const [liveNotifs, setLiveNotifs]                  = useState<LiveNotif[]>([]);
  const [snapshotTs, setSnapshotTs]                  = useState(0);
  const [activeSessionId, setActiveSessionId]        = useState<string | null>(null);

  // ── room state ───────────────────────────────────────────────────
  const [selectedRoom, setSelectedRoom]              = useState<string>("");
  // Manual override form (used when no auto-detected session)
  const [manualCourseId, setManualCourseId]          = useState<string>("");
  const [manualWeek, setManualWeek]                  = useState<string>("1");
  const [manualType, setManualType]                  = useState<string>("lecture");
  const [courses, setCourses]                        = useState<{ id: string; name: string; code?: string }[]>([]);
  const [showManual, setShowManual]                  = useState(false);

  const esRef             = useRef<EventSource | null>(null);
  const reconnectAttempts = useRef(0);
  const reconnectTimer    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const prevAlertRef = useRef<AlertCounts>({ fighting: 0, cheating: 0, sleeping: 0, phone: 0, talking: 0, drowsy: 0 });
  const prevFacesRef = useRef<BackendFace[]>([]);
  const notifTimers  = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const isStreaming  = backendConnected;

  // ── probe Python backend availability ────────────────────────────
  const { data: pythonOnline = false } = useQuery<boolean>({
    queryKey: ["python-health"],
    queryFn: async () => {
      try {
        const r = await fetch(`${BACKEND_URL}/health`, { signal: AbortSignal.timeout(2000) });
        return r.ok;
      } catch { return false; }
    },
    refetchInterval: 10000,
    enabled: !backendConnected,
  });

  // ── fetch rooms list ─────────────────────────────────────────────
  const { data: rooms = [] } = useQuery<RoomInfo[]>({
    queryKey: ["camera-rooms"],
    queryFn: async () => {
      const r = await fetch(`${LOCAL_API_URL}/api/camera/rooms`);
      return r.ok ? r.json() : [];
    },
    staleTime: 0,
    refetchInterval: 5000,
    refetchOnWindowFocus: true,
  });

  // ── fetch room dashboard (live polling when streaming) ───────────
  const { data: roomDash, refetch: refetchDash } = useQuery<RoomDashboard | null>({
    queryKey: ["camera-room-dash", selectedRoom],
    queryFn: async () => {
      if (!selectedRoom) return null;
      const r = await fetch(`${LOCAL_API_URL}/api/camera/room/${encodeURIComponent(selectedRoom)}`);
      return r.ok ? r.json() : null;
    },
    enabled: !!selectedRoom,
    staleTime: 0,
    refetchInterval: isStreaming ? 4000 : 4000,
    refetchOnWindowFocus: true,
  });

  // ── load courses for manual override ────────────────────────────
  useEffect(() => {
    fetch(`${LOCAL_API_URL}/rest/v1/courses`)
      .then(r => r.json())
      .then((d: any[]) => { if (Array.isArray(d)) setCourses(d); })
      .catch((err) => { console.error("Camera fetch error:", err); });
  }, []);

  // ── MJPEG key bump ───────────────────────────────────────────────
  useEffect(() => {
    if (backendConnected) setSnapshotTs(Date.now());
  }, [backendConnected]);

  // ── Backend restart recovery: sync activeSessionId from room dash ─
  // If the node process restarted, activeSessionId state is lost but
  // the DB still has the active session — restore it from roomDash.
  useEffect(() => {
    if (!backendConnected && roomDash?.activeSession?.id && !activeSessionId) {
      setActiveSessionId(roomDash.activeSession.id);
    }
  }, [roomDash, backendConnected, activeSessionId]);

  // ── elapsed timer ────────────────────────────────────────────────
  useEffect(() => {
    if (isStreaming) {
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed(s => s + 1), 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isStreaming]);

  const fmt = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  // ── flash on new alert ───────────────────────────────────────────
  useEffect(() => {
    const prev = prevAlertRef.current;
    const flashing = new Set<string>();
    (Object.keys(alertCounts) as Array<keyof AlertCounts>).forEach(k => {
      if (alertCounts[k] > prev[k]) flashing.add(k);
    });
    if (flashing.size) {
      setFlashingAlerts(flashing);
      const t = setTimeout(() => setFlashingAlerts(new Set()), 700);
      prevAlertRef.current = { ...alertCounts };
      return () => clearTimeout(t);
    }
    prevAlertRef.current = { ...alertCounts };
  }, [alertCounts]);

  // ── push live notification ───────────────────────────────────────
  const pushNotif = useCallback((face: BackendFace) => {
    const id = `${Date.now()}-${Math.random()}`;
    const notif: LiveNotif = {
      id, text: face.behavior, name: face.name === "Unknown" ? "Unknown person" : face.name,
      severity: face.severity as "critical" | "high",
    };
    setLiveNotifs(n => [notif, ...n].slice(0, 4));
    const t = setTimeout(() => {
      setLiveNotifs(n => n.filter(x => x.id !== id));
      notifTimers.current.delete(id);
    }, 4000);
    notifTimers.current.set(id, t);
  }, []);

  // ── SSE stream from Python (with auto-reconnect) ────────────────
  const connectSSE = useCallback(() => {
    if (esRef.current) { esRef.current.close(); esRef.current = null; }

    const es = new EventSource(`${BACKEND_URL}/stream`);
    esRef.current = es;

    es.onopen = () => {
      reconnectAttempts.current = 0;
      setIsReconnecting(false);
    };

    es.onmessage = (e) => {
      try {
        const data: BackendStatus = JSON.parse(e.data);
        setBackendStatus(data);
        if (data.alerts) setAlertCounts(prev => ({ ...prev, ...data.alerts }));
        if (data.faces) {
          data.faces.forEach(face => {
            if (face.severity === "critical" || face.severity === "high") {
              const prev = prevFacesRef.current.find(p => p.name === face.name);
              if (!prev || (prev.severity !== "critical" && prev.severity !== "high")) pushNotif(face);
            }
          });
          prevFacesRef.current = data.faces;
        }
      } catch {}
    };

    es.onerror = () => {
      es.close();
      esRef.current = null;
      setBackendStatus(null);
      setSnapshotTs(0);

      const MAX_ATTEMPTS = 5;
      const attempt = reconnectAttempts.current + 1;
      reconnectAttempts.current = attempt;

      if (attempt <= MAX_ATTEMPTS) {
        // Exponential backoff: 2s, 4s, 8s, 16s, 30s
        const delay = Math.min(2000 * Math.pow(2, attempt - 1), 30000);
        setIsReconnecting(true);
        reconnectTimer.current = setTimeout(() => {
          // Verify Python is still up before reconnecting
          fetch(`${BACKEND_URL}/health`)
            .then(r => { if (r.ok) connectSSE(); else throw new Error(); })
            .catch((err) => {
              // Health check failed — stop retrying, mark fully disconnected
              console.error("Camera fetch error:", err);
              reconnectAttempts.current = MAX_ATTEMPTS + 1;
              setIsReconnecting(false);
              setBackendConnected(false);
            });
        }, delay);
      } else {
        setIsReconnecting(false);
        setBackendConnected(false);
        toast({ title: "Camera Disconnected", description: "Could not reconnect to AI backend. Session preserved.", variant: "destructive" });
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pushNotif, toast]);

  useEffect(() => {
    if (!backendConnected) {
      if (reconnectTimer.current) { clearTimeout(reconnectTimer.current); reconnectTimer.current = null; }
      if (esRef.current) { esRef.current.close(); esRef.current = null; }
      setIsReconnecting(false);
      reconnectAttempts.current = 0;
      return;
    }
    connectSSE();
    return () => {
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      if (esRef.current) { esRef.current.close(); esRef.current = null; }
    };
  }, [backendConnected, connectSSE]);

  // ── start camera ─────────────────────────────────────────────────
  const startCamera = useCallback(async () => {
    if (!selectedRoom) {
      toast({ title: "Select a room first", variant: "destructive" }); return;
    }
    setIsStarting(true);
    try {
      // Use auto-detected active session if present; else start a new one
      let sessionId = roomDash?.activeSession?.id ?? null;
      let courseIdToUse = roomDash?.activeSession?.course_id ?? manualCourseId;

      if (!sessionId) {
        // No active session — start one (require manual course selection)
        if (!courseIdToUse) {
          toast({ title: "No active session in this room", description: "Select a course to start a manual session.", variant: "destructive" });
          setIsStarting(false);
          setShowManual(true);
          return;
        }
        const sessRes = await fetch(`${LOCAL_API_URL}/api/session/start`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            course_id: courseIdToUse,
            room_number: selectedRoom,
            week_number: Number(manualWeek),
            session_type: manualType,
          }),
        });
        if (!sessRes.ok) throw new Error("Session start failed");
        const sessData = await sessRes.json();
        sessionId = sessData.session?.id;
        courseIdToUse = sessData.session?.course_id ?? courseIdToUse;
      }

      setActiveSessionId(sessionId);

      // Start Python pipeline — give a clear error if it's not running
      let healthOk = false;
      try {
        const health = await fetch(`${BACKEND_URL}/health`, { signal: AbortSignal.timeout(3000) });
        healthOk = health.ok;
      } catch {
        toast({
          title: "Python AI Backend Not Running",
          description: `Start it with: python trackify_backend.py  (expected at ${BACKEND_URL})`,
          variant: "destructive",
        });
        setIsStarting(false);
        return;
      }

      if (!healthOk) {
        toast({ title: "AI Backend Unhealthy", description: `${BACKEND_URL}/health returned an error.`, variant: "destructive" });
        setIsStarting(false);
        return;
      }

      await fetch(`${BACKEND_URL}/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId, course_id: courseIdToUse }),
      });

      setBackendConnected(true);
      try {
        const d = await fetch(`${BACKEND_URL}/debug`);
        if (d.ok) setBackendDebug(await d.json());
      } catch (err) { console.error("Camera fetch error:", err); }

      toast({
        title: "Camera Started",
        description: `Room ${selectedRoom} · ${roomDash?.activeSession?.course_name ?? "Session"}`,
      });
      refetchDash();
    } catch (e: any) {
      toast({ title: "Could Not Start", description: e.message, variant: "destructive" });
    }
    setIsStarting(false);
  }, [selectedRoom, roomDash, manualCourseId, manualWeek, manualType, toast, refetchDash]);

  // ── stop camera ──────────────────────────────────────────────────
  const stopCamera = useCallback(async () => {
    try { await fetch(`${BACKEND_URL}/stop`, { method: "POST" }); } catch (err) { console.error("Camera fetch error:", err); }
    if (activeSessionId) {
      try {
        await fetch(`${LOCAL_API_URL}/api/session/end`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ session_id: activeSessionId }),
        });
      } catch (err) { console.error("Camera fetch error:", err); }
      setActiveSessionId(null);
    }
    setBackendConnected(false);
    setBackendStatus(null);
    setBackendDebug(null);
    setLiveNotifs([]);
    toast({ title: "Camera Stopped" });
    refetchDash();
  }, [activeSessionId, toast, refetchDash]);

  const reloadStudents = useCallback(async () => {
    setIsReloading(true);
    try {
      const res  = await fetch(`${BACKEND_URL}/reload-students`, { method: "POST" });
      const data = await res.json();
      if (data.success) {
        const d = await fetch(`${BACKEND_URL}/debug`);
        if (d.ok) setBackendDebug(await d.json());
        toast({ title: "Students Reloaded", description: `${data.students_loaded} loaded` });
      }
    } catch (err) { console.error("Camera fetch error:", err); toast({ title: "Reload Failed", variant: "destructive" }); }
    setIsReloading(false);
  }, [toast]);

  const resetAlerts = useCallback(async () => {
    try {
      await fetch(`${BACKEND_URL}/alerts/reset`, { method: "POST" });
      setAlertCounts({ fighting: 0, cheating: 0, sleeping: 0, phone: 0, talking: 0, drowsy: 0 });
      toast({ title: "Alerts Reset" });
    } catch (err) { console.error("Camera fetch error:", err); }
  }, [toast]);

  const detectedCount   = backendStatus?.face_count ?? 0;
  const identifiedCount = backendStatus ? backendStatus.faces.filter(f => f.name !== "Unknown").length : 0;

  const session      = roomDash?.activeSession ?? null;
  const attendance   = roomDash?.attendance ?? [];
  const behaviorSum  = roomDash?.behaviorSummary ?? [];
  const nextSession  = roomDash?.nextSession ?? null;

  // ── JSX ──────────────────────────────────────────────────────────
  return (
    <MainLayout title="Camera Monitoring">

      {/* ── Floating live alert notifications ── */}
      <div className="fixed top-20 right-5 z-50 space-y-2 pointer-events-none w-72">
        <AnimatePresence>
          {liveNotifs.map(n => (
            <motion.div key={n.id}
              initial={{ opacity: 0, x: 48, scale: 0.9 }}
              animate={{ opacity: 1, x: 0,  scale: 1   }}
              exit={{    opacity: 0, x: 48, scale: 0.9  }}
              transition={{ type: "spring", stiffness: 400, damping: 28 }}
              className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl backdrop-blur-md border text-xs font-medium shadow-xl pointer-events-auto ${
                n.severity === "critical"
                  ? "bg-red-950/80 border-red-500/50 text-red-200"
                  : "bg-orange-950/80 border-orange-500/50 text-orange-200"
              }`}
            >
              <ShieldAlert className="w-4 h-4 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-semibold truncate">{n.name}</p>
                <p className="opacity-70 text-[10px]">{n.text} detected</p>
              </div>
              <button className="opacity-40 hover:opacity-80 transition-opacity pointer-events-auto"
                onClick={() => setLiveNotifs(p => p.filter(x => x.id !== n.id))}>
                <X className="w-3 h-3" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* ── Main grid: 2-col left feed, 1-col right dashboard ── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

        {/* ═══════════ LEFT — VIDEO FEED + CONTROLS ═══════════ */}
        <div className="xl:col-span-2 space-y-4">

          {/* ── Room selector bar ── */}
          <div className="glass rounded-2xl px-4 py-3 flex flex-wrap items-center gap-3 border border-border/50">
            <div className="flex items-center gap-2 text-sm font-bold text-foreground">
              <MapPin className="w-4 h-4 text-primary" />
              Room
            </div>

            <Select value={selectedRoom} onValueChange={v => { setSelectedRoom(v); setShowManual(false); }}>
              <SelectTrigger className="w-48 h-9 rounded-xl bg-secondary/40 border-white/[0.08] text-sm">
                <SelectValue placeholder="Select room…" />
              </SelectTrigger>
              <SelectContent>
                {rooms.length === 0 ? (
                  <SelectItem value="__none" disabled>No rooms found</SelectItem>
                ) : rooms.map(r => (
                  <SelectItem key={r.room_number} value={r.room_number}>
                    <div className="flex items-center gap-2">
                      <span className={`w-1.5 h-1.5 rounded-full ${r.has_active ? "bg-emerald-500" : "bg-muted-foreground/30"}`} />
                      {r.room_number}
                      {r.has_active && (
                        <span className="text-[10px] text-emerald-400 font-medium">● LIVE</span>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Show room status pill */}
            {selectedRoom && roomDash && (
              <div className="flex items-center gap-2">
                {session ? (
                  <span className="text-[11px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-1 rounded-lg font-medium">
                    ● Active: {session.course_name}
                  </span>
                ) : (
                  <span className="text-[11px] bg-secondary/40 text-muted-foreground border border-white/[0.08] px-2.5 py-1 rounded-lg">
                    No active session
                  </span>
                )}
              </div>
            )}

            {/* AI + REC badges */}
            <div className="ml-auto flex items-center gap-2">
              {backendConnected && (
                <Badge className="gap-1.5 text-[10px] bg-violet-500/15 text-violet-300 border border-violet-500/30">
                  <Zap className="w-3 h-3" /> AI ACTIVE
                </Badge>
              )}
              {isStreaming && (
                <Badge className="gap-1.5 text-[10px] bg-red-500/15 text-red-400 border border-red-500/30 animate-pulse">
                  <CircleDot className="w-3 h-3" /> REC
                </Badge>
              )}
            </div>
          </div>

          {/* ── Python backend offline warning ── */}
          {!backendConnected && !pythonOnline && selectedRoom && (
            <div className="flex items-center gap-3 bg-amber-500/10 border border-amber-500/25 rounded-xl px-4 py-3 text-sm">
              <WifiOff className="w-4 h-4 text-amber-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-amber-300">Python AI Backend Offline</p>
                <p className="text-[11px] text-amber-400/70 font-mono mt-0.5">
                  Start it with: <span className="bg-black/30 px-1.5 py-0.5 rounded">python trackify_backend.py</span>
                  &nbsp;· expected at {BACKEND_URL}
                </p>
              </div>
            </div>
          )}

          {/* ── VIDEO FEED ── */}
          <div
            className={`relative rounded-2xl overflow-hidden shadow-2xl bg-black transition-all duration-500 ${
              backendConnected
                ? "ring-1 ring-primary/30 shadow-[0_0_50px_hsl(217_91%_60%/0.12)]"
                : "border border-white/[0.06]"
            }`}
            style={{ aspectRatio: "16/9" }}
          >
            {backendConnected ? (
              <img
                key={snapshotTs}
                src={`${BACKEND_URL}/video_feed`}
                alt="AI Stream"
                className="w-full h-full object-cover"
                onError={e => { (e.target as HTMLImageElement).style.opacity = "0"; }}
                onLoad={e  => { (e.target as HTMLImageElement).style.opacity = "1"; }}
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center gap-5 bg-gradient-to-br from-background via-secondary/20 to-background">
                <div
                  className="absolute inset-0 pointer-events-none opacity-[0.03]"
                  style={{
                    backgroundImage: "linear-gradient(rgba(100,220,255,1) 1px,transparent 1px),linear-gradient(90deg,rgba(100,220,255,1) 1px,transparent 1px)",
                    backgroundSize: "48px 48px",
                  }}
                />
                <div className="relative">
                  <div className="w-24 h-24 rounded-full bg-primary/8 border border-primary/15 flex items-center justify-center">
                    <div className="w-16 h-16 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
                      <CameraIcon className="w-7 h-7 text-primary/40" />
                    </div>
                  </div>
                  <div className="absolute inset-0 rounded-full border border-primary/15 animate-ping opacity-20" />
                  <div className="absolute inset-[-12px] rounded-full border border-dashed border-primary/10 animate-spin [animation-duration:8s]" />
                </div>
                <div className="text-center z-10 space-y-2">
                  <p className="text-sm font-semibold text-foreground/60">
                    {isReconnecting
                      ? `Reconnecting… (attempt ${reconnectAttempts.current}/5)`
                      : selectedRoom ? `Room ${selectedRoom} — Camera offline` : "Select a room to begin"}
                  </p>
                  <p className="text-[11px] text-muted-foreground/50">
                    {isReconnecting
                      ? "Waiting for AI backend to come back online"
                      : selectedRoom
                        ? session
                          ? "Active session detected — press Start Camera to resume"
                          : "No session running — start one manually"
                        : "Pick a room from the selector above"}
                  </p>
                  {/* Resume session shortcut */}
                  {!isReconnecting && selectedRoom && session && (
                    <button
                      onClick={startCamera}
                      disabled={isStarting}
                      className="mt-2 flex items-center gap-2 mx-auto bg-primary/15 hover:bg-primary/25 border border-primary/30 text-primary text-xs font-semibold px-4 py-2 rounded-xl transition-colors disabled:opacity-50"
                    >
                      <Radio className="w-3.5 h-3.5" />
                      Resume: {session.course_name}
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Reconnecting overlay */}
            {isReconnecting && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm z-20">
                <div className="flex items-center gap-2.5 bg-black/70 border border-amber-500/40 text-amber-300 text-xs font-semibold px-4 py-2.5 rounded-xl shadow-xl">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Reconnecting to AI backend…
                </div>
              </div>
            )}

            {/* Scan line */}
            {isStreaming && (
              <div className="absolute inset-0 pointer-events-none overflow-hidden">
                <div className="absolute w-full h-[2px] bg-gradient-to-r from-transparent via-neon-cyan/25 to-transparent animate-scan-line" />
              </div>
            )}

            {/* Corner brackets */}
            {(["tl","tr","bl","br"] as const).map(c => (
              <div key={c} className={`absolute w-7 h-7 pointer-events-none transition-opacity duration-500 ${
                isStreaming ? "opacity-100" : "opacity-30"
              } ${c==="tl"?"top-3 left-3":c==="tr"?"top-3 right-3":c==="bl"?"bottom-3 left-3":"bottom-3 right-3"}`}>
                <div className={`absolute inset-0 border-neon-cyan/60 rounded-sm ${
                  c==="tl"?"border-t-2 border-l-2":c==="tr"?"border-t-2 border-r-2":
                  c==="bl"?"border-b-2 border-l-2":"border-b-2 border-r-2"
                }`} />
              </div>
            ))}

            {/* Top-left: REC badge */}
            {isStreaming && (
              <div className="absolute top-4 left-5 flex items-center gap-1.5 bg-black/60 backdrop-blur-sm border border-red-500/40 text-red-400 text-[11px] font-bold px-2.5 py-1.5 rounded-lg">
                <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse shadow-[0_0_6px_#ef4444]" />
                REC
              </div>
            )}

            {/* Top-right: FPS + AI */}
            {isStreaming && (
              <div className="absolute top-4 right-5 flex items-center gap-2">
                {backendStatus && (
                  <span className="bg-black/60 backdrop-blur-sm border border-neon-cyan/30 text-neon-cyan text-[11px] font-mono px-2.5 py-1.5 rounded-lg">
                    {backendStatus.fps} FPS
                  </span>
                )}
                <span className="flex items-center gap-1.5 bg-black/60 backdrop-blur-sm border border-violet-500/40 text-violet-300 text-[11px] font-bold px-2.5 py-1.5 rounded-lg">
                  <Scan className="w-3 h-3" /> AI ON
                </span>
              </div>
            )}

            {/* Bottom-left: face count */}
            {isStreaming && detectedCount > 0 && (
              <div className="absolute bottom-10 left-5 flex items-center gap-1.5 bg-black/55 backdrop-blur-sm border border-emerald-500/30 text-emerald-400 text-[11px] font-bold px-2.5 py-1.5 rounded-lg">
                <Users className="w-3 h-3" /> {detectedCount} detected
              </div>
            )}

            {/* Bottom-center: session pill */}
            {isStreaming && session && (
              <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-black/65 backdrop-blur-sm border border-white/10 rounded-xl px-4 py-2 text-[11px] font-medium text-white/80 shadow-xl pointer-events-none">
                <span className="flex items-center gap-1 text-primary/90 font-semibold">
                  <BookOpen className="w-3 h-3" />{session.course_name}
                </span>
                <span className="opacity-30">|</span>
                <span>Wk {session.week_number} · {TYPE_LABEL[session.session_type] ?? session.session_type}</span>
                <span className="opacity-30">|</span>
                <span className="flex items-center gap-1 text-neon-cyan/80 font-mono">
                  <Clock className="w-3 h-3" />{fmt(elapsed)}
                </span>
                {session.scheduled_end_at && (() => {
                  const rem = Math.max(0, Math.round((new Date(session.scheduled_end_at).getTime() - Date.now()) / 60000));
                  return (
                    <>
                      <span className="opacity-30">|</span>
                      <span className={`font-mono ${rem < 10 ? "text-red-400" : "text-amber-400/80"}`}>{rem}m left</span>
                    </>
                  );
                })()}
                <span className="opacity-30">|</span>
                <span className="flex items-center gap-1 text-emerald-400/90">
                  <Users className="w-3 h-3" />{session.stats.present}/{session.stats.total}
                </span>
              </div>
            )}

            {/* Bottom HUD */}
            {isStreaming && (
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent px-5 py-3 flex items-center justify-between">
                <span className="text-[10px] font-mono text-white/50">
                  ROOM {selectedRoom} &nbsp;·&nbsp; {new Date().toLocaleTimeString()}
                </span>
                <span className="text-[10px] font-mono text-neon-cyan/60">PYTHON AI · TRACKIFY</span>
              </div>
            )}
          </div>

          {/* ── Manual session form (shown when no active session) ── */}
          {!backendConnected && selectedRoom && !session && showManual && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              className="glass rounded-2xl p-4 space-y-3 border border-amber-500/20">
              <p className="text-[11px] text-amber-400 font-medium">
                No active session detected — configure manually:
              </p>
              <div className="space-y-1">
                <label className="text-[11px] text-muted-foreground uppercase tracking-wider">Course</label>
                <Select value={manualCourseId} onValueChange={setManualCourseId}>
                  <SelectTrigger className="h-9 rounded-xl bg-secondary/40 border-white/[0.08] text-sm">
                    <SelectValue placeholder="Select course…" />
                  </SelectTrigger>
                  <SelectContent>
                    {courses.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.code ? `${c.code} — ` : ""}{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[11px] text-muted-foreground uppercase tracking-wider">Week</label>
                  <Select value={manualWeek} onValueChange={setManualWeek}>
                    <SelectTrigger className="h-9 rounded-xl bg-secondary/40 border-white/[0.08] text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 16 }, (_, i) => i + 1).map(w => (
                        <SelectItem key={w} value={String(w)}>Week {w}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] text-muted-foreground uppercase tracking-wider">Type</label>
                  <Select value={manualType} onValueChange={setManualType}>
                    <SelectTrigger className="h-9 rounded-xl bg-secondary/40 border-white/[0.08] text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SESSION_TYPES.map(t => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </motion.div>
          )}

          {/* ── Controls ── */}
          <div className="flex gap-3">
            {isReconnecting ? (
              /* Reconnecting state — show cancel + retry */
              <>
                <div className="flex-1 h-11 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center gap-2 text-amber-300 text-sm font-medium">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Reconnecting ({reconnectAttempts.current}/5)…
                </div>
                <button
                  onClick={() => { setBackendConnected(false); }}
                  className="px-4 h-11 rounded-xl border border-white/[0.08] text-muted-foreground hover:bg-secondary/40 text-[11px] transition-colors"
                >
                  Cancel
                </button>
              </>
            ) : !backendConnected ? (
              <>
                <motion.div whileTap={{ scale: 0.97 }} whileHover={{ scale: 1.01 }} className="flex-1">
                  <Button
                    className="w-full h-11 rounded-xl bg-gradient-to-r from-primary to-accent text-white font-semibold shadow-lg shadow-primary/25 hover:shadow-primary/40 disabled:opacity-50"
                    onClick={startCamera}
                    disabled={isStarting || !selectedRoom}
                  >
                    <CameraIcon className="w-4 h-4 mr-2" />
                    {isStarting
                      ? "Starting…"
                      : !selectedRoom
                      ? "Select a room first"
                      : session
                      ? `Resume: ${session.course_name}`
                      : "Start Camera (Manual)"}
                  </Button>
                </motion.div>
                {selectedRoom && !session && !showManual && (
                  <button onClick={() => setShowManual(true)}
                    className="px-4 h-11 rounded-xl border border-white/[0.08] text-muted-foreground hover:bg-secondary/40 text-[11px] transition-colors">
                    Manual
                  </button>
                )}
              </>
            ) : (
              <>
                <motion.div whileTap={{ scale: 0.97 }} className="flex-1">
                  <Button className="w-full h-11 rounded-xl" variant="destructive" onClick={stopCamera}>
                    <Square className="w-4 h-4 mr-2" /> End Session
                  </Button>
                </motion.div>
                <button onClick={reloadStudents} disabled={isReloading}
                  className="flex items-center gap-1.5 px-4 h-11 rounded-xl border border-violet-500/30 text-violet-300 hover:bg-violet-500/10 text-[11px] font-medium transition-colors disabled:opacity-50">
                  <RefreshCw className={`w-3.5 h-3.5 ${isReloading ? "animate-spin" : ""}`} />
                  {isReloading ? "Reloading…" : "Reload"}
                </button>
              </>
            )}
          </div>

          {/* ── Live faces detection panel ── */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="glass rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-primary/15 flex items-center justify-center">
                  <Activity className="w-3.5 h-3.5 text-primary" />
                </div>
                <h3 className="text-sm font-bold text-foreground">Live Detection</h3>
              </div>
              <span className="text-[11px] text-muted-foreground">
                {detectedCount} detected · {identifiedCount} identified
                {backendConnected && <span className="inline-block w-2 h-2 bg-emerald-500 rounded-full ml-2 animate-pulse shadow-[0_0_6px_#22c55e]" />}
              </span>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-3 gap-3">
              {([
                { label: "Detected",   value: detectedCount,                  color: "text-foreground",  bg: "bg-secondary/40" },
                { label: "Identified", value: identifiedCount,                color: "text-emerald-400", bg: "bg-emerald-500/8" },
                { label: "Unknown",    value: Math.max(0, detectedCount - identifiedCount), color: "text-amber-400", bg: "bg-amber-500/8" },
              ]).map(({ label, value, color, bg }) => (
                <div key={label} className={`${bg} rounded-xl p-3 text-center border border-white/[0.04]`}>
                  <p className={`text-2xl font-bold tabular-nums ${color}`}>{value}</p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">{label}</p>
                </div>
              ))}
            </div>

            {/* Session alerts */}
            {backendConnected && (
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Alerts</span>
                  <button onClick={resetAlerts}
                    className="text-[10px] text-muted-foreground/50 hover:text-muted-foreground transition-colors px-2 py-0.5 rounded hover:bg-secondary/50">
                    Reset
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {ALERT_CFG.map(({ key, label, Icon, color, bg }) => (
                    <motion.div key={key}
                      animate={flashingAlerts.has(key) ? { scale: [1, 1.08, 1] } : {}}
                      transition={{ duration: 0.4 }}
                      className={`rounded-xl p-3 border text-center ${bg}`}>
                      <Icon className={`w-4 h-4 mx-auto mb-1.5 ${color}`} />
                      <p className={`text-xl font-bold tabular-nums ${color}`}>{alertCounts[key]}</p>
                      <p className="text-[9px] text-muted-foreground uppercase tracking-wider mt-0.5">{label}</p>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {/* Per-face cards */}
            <AnimatePresence mode="popLayout">
              {backendConnected && backendStatus && backendStatus.faces.length > 0 ? (
                <div className="space-y-2">
                  {backendStatus.faces.map((face, i) => {
                    const BehIcon = BEHAVIOR_ICONS[face.behavior] ?? ShieldCheck;
                    return (
                      <motion.div key={`${face.name}-${i}`}
                        initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 12 }}
                        transition={{ delay: i * 0.04 }}
                        className={`flex items-center gap-3 bg-secondary/20 border border-white/[0.05] rounded-xl px-4 py-3 ${SEVERITY_BORDER[face.severity ?? "normal"] ?? ""} hover:bg-secondary/30 transition-colors`}>
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                          face.name !== "Unknown"
                            ? "bg-primary/20 text-primary border border-primary/30"
                            : "bg-muted/40 text-muted-foreground border border-white/10"
                        }`}>
                          {face.name !== "Unknown" ? face.name.charAt(0).toUpperCase() : "?"}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate">{face.name}</p>
                          {face.student_code && (
                            <p className="text-[10px] text-muted-foreground font-mono">{face.student_code}</p>
                          )}
                          {face.confidence > 0 && (
                            <div className="flex items-center gap-1.5 mt-1">
                              <div className="flex-1 h-1 bg-secondary rounded-full overflow-hidden max-w-[70px]">
                                <motion.div
                                  className="h-full bg-gradient-to-r from-primary to-accent rounded-full"
                                  initial={{ width: 0 }}
                                  animate={{ width: `${Math.round(face.confidence * 100)}%` }}
                                  transition={{ duration: 0.5 }}
                                />
                              </div>
                              <span className="text-[10px] text-muted-foreground tabular-nums">
                                {Math.round(face.confidence * 100)}%
                              </span>
                            </div>
                          )}
                          {face.behaviors && face.behaviors.length > 1 && (
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {face.behaviors.map(beh => (
                                <span key={beh} className={`text-[9px] border px-1.5 py-0.5 rounded-md ${BEHAVIOR_STYLE[beh] ?? BEHAVIOR_STYLE["Normal"]}`}>
                                  {beh}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className={`flex items-center gap-1 text-[10px] border px-2 py-1 rounded-lg ${BEHAVIOR_STYLE[face.behavior] ?? BEHAVIOR_STYLE["Normal"]}`}>
                          <BehIcon className="w-3 h-3" />{face.behavior}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center py-8 gap-2">
                  <div className="w-12 h-12 rounded-full bg-secondary/40 flex items-center justify-center">
                    <Users className="w-5 h-5 text-muted-foreground/30" />
                  </div>
                  <p className="text-xs text-muted-foreground font-medium">
                    {backendConnected ? "No faces detected" : "No active feed"}
                  </p>
                  <p className="text-[11px] text-muted-foreground/50">
                    {backendConnected ? "Waiting for people in frame…" : "Start camera to begin monitoring"}
                  </p>
                </div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>

        {/* ═══════════ RIGHT — SESSION DASHBOARD ═══════════ */}
        <div className="space-y-4">

          {/* ── No room selected ── */}
          {!selectedRoom && (
            <div className="glass rounded-2xl p-8 border border-border/50 text-center space-y-3">
              <MapPin className="w-10 h-10 mx-auto text-muted-foreground/25" />
              <p className="text-sm font-medium text-muted-foreground">Select a room</p>
              <p className="text-[11px] text-muted-foreground/60">
                Choose a room from the selector to see its session status and live data.
              </p>
            </div>
          )}

          {/* ── Session info card ── */}
          {selectedRoom && session && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <SessionInfoCard session={session} streaming={isStreaming} />
            </motion.div>
          )}

          {/* ── No session + next session ── */}
          {selectedRoom && !session && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              className="glass rounded-2xl p-5 border border-border/50 text-center space-y-3">
              <div className="w-10 h-10 rounded-full bg-secondary/40 mx-auto flex items-center justify-center">
                <CameraIcon className="w-5 h-5 text-muted-foreground/40" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">No active session</p>
              <p className="text-[11px] text-muted-foreground/60">Room {selectedRoom} has no running session right now.</p>
            </motion.div>
          )}

          {/* ── Behavior summary (from DB) ── */}
          {selectedRoom && behaviorSum.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
              <BehaviorSummaryPanel items={behaviorSum} />
            </motion.div>
          )}

          {/* ── Student list (from DB) ── */}
          {selectedRoom && attendance.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
              className="glass rounded-2xl p-4 border border-border/50 space-y-3">
              <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5" /> Students
                <span className="ml-auto text-[10px] font-normal normal-case text-muted-foreground/60">
                  {attendance.filter(r => r.status !== "absent").length}/{attendance.length} present
                </span>
              </h4>
              <div className="space-y-1.5 max-h-[420px] overflow-y-auto pr-0.5">
                {attendance.map(rec => (
                  <StudentRow key={rec.student_id} rec={rec} />
                ))}
              </div>
            </motion.div>
          )}

          {/* ── Next session preview ── */}
          {selectedRoom && nextSession && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
              <NextSessionCard next={nextSession} />
            </motion.div>
          )}

          {/* ── Debug info ── */}
          {backendConnected && backendDebug && (
            <div className="glass rounded-2xl p-4 border border-border/50 space-y-2">
              <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <BrainCircuit className="w-3.5 h-3.5" /> AI Debug
              </h4>
              <div className="text-[11px] space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Students loaded</span>
                  <span className={backendDebug.students_loaded > 0 ? "text-emerald-400 font-bold" : "text-amber-400"}>
                    {backendDebug.students_loaded}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">InsightFace</span>
                  <span className={backendDebug.insightface ? "text-emerald-400" : "text-red-400"}>
                    {backendDebug.insightface ? "OK" : "Off"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">MediaPipe</span>
                  <span className={backendDebug.mediapipe ? "text-emerald-400" : "text-red-400"}>
                    {backendDebug.mediapipe ? "OK" : "Off"}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
};

export default Camera;
