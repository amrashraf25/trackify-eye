import MainLayout from "@/components/layout/MainLayout";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus, Pencil, Trash2, CalendarDays, Clock, MapPin,
  ChevronDown, ChevronRight, BookOpen, X,
  GraduationCap, AlertCircle, Layers,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

const LOCAL_API = "http://localhost:3001";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DAY_SHORT: Record<string, string> = {
  Sunday: "Sun", Monday: "Mon", Tuesday: "Tue", Wednesday: "Wed",
  Thursday: "Thu", Friday: "Fri", Saturday: "Sat",
};
const SESSION_TYPES = [
  { value: "lecture",         label: "Lecture" },
  { value: "problem_solving", label: "Problem Solving" },
  { value: "lab",             label: "Lab" },
  { value: "tutorial",        label: "Tutorial" },
];
const WEEKS = Array.from({ length: 16 }, (_, i) => i + 1);

const TYPE_STYLE: Record<string, { badge: string; dot: string }> = {
  lecture:         { badge: "bg-primary/10 text-primary border-primary/25",             dot: "bg-primary" },
  problem_solving: { badge: "bg-violet-500/10 text-violet-400 border-violet-500/25",    dot: "bg-violet-400" },
  lab:             { badge: "bg-emerald-500/10 text-emerald-400 border-emerald-500/25", dot: "bg-emerald-400" },
  tutorial:        { badge: "bg-amber-500/10 text-amber-400 border-amber-500/25",       dot: "bg-amber-400" },
};

type Course  = { id: string; name: string; code?: string };
type Profile = { id: string; full_name: string };
type Schedule = {
  id: string;
  course_id: string;
  course_name?: string;
  course_code?: string;
  doctor_id?: string;
  doctor_name?: string;
  day_of_week: string;
  start_time: string;
  end_time: string;
  room_number?: string;
  session_type: string;
  week_number: number;
  is_active: number;
};

const BLANK = {
  course_id: "", doctor_id: "", day_of_week: "Monday", start_time: "08:00",
  end_time: "09:30", room_number: "", session_type: "lecture", week_number: 1,
};

// ── 12-hour time helpers ─────────────────────────────────────────────
function parse12h(time24: string): { hour: string; minute: string; period: "AM" | "PM" } {
  const [hStr = "8", mStr = "00"] = time24.split(":");
  let h = parseInt(hStr, 10);
  const period: "AM" | "PM" = h >= 12 ? "PM" : "AM";
  if (h === 0) h = 12;
  else if (h > 12) h -= 12;
  return { hour: String(h), minute: mStr, period };
}

function to24h(hour: string, minute: string, period: "AM" | "PM"): string {
  let h = parseInt(hour, 10);
  if (period === "AM" && h === 12) h = 0;
  else if (period === "PM" && h !== 12) h += 12;
  return `${String(h).padStart(2, "0")}:${minute}`;
}

const HOURS   = ["1","2","3","4","5","6","7","8","9","10","11","12"];
const MINUTES = ["00","05","10","15","20","25","30","35","40","45","50","55"];

function TimePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { hour, minute, period } = parse12h(value);
  const set = (h: string, m: string, p: "AM" | "PM") => onChange(to24h(h, m, p));

  return (
    <div className="flex items-center gap-1">
      {/* Hour */}
      <Select value={hour} onValueChange={h => set(h, minute, period)}>
        <SelectTrigger className="h-9 w-16 bg-secondary/40 border-white/[0.08] text-center px-2">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {HOURS.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}
        </SelectContent>
      </Select>

      <span className="text-muted-foreground font-bold text-sm">:</span>

      {/* Minute */}
      <Select value={minute} onValueChange={m => set(hour, m, period)}>
        <SelectTrigger className="h-9 w-16 bg-secondary/40 border-white/[0.08] text-center px-2">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {MINUTES.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
        </SelectContent>
      </Select>

      {/* AM / PM toggle */}
      <div className="flex rounded-lg overflow-hidden border border-white/[0.08]">
        {(["AM", "PM"] as const).map(p => (
          <button
            key={p}
            type="button"
            onClick={() => set(hour, minute, p)}
            className={`h-9 px-2.5 text-xs font-bold transition-colors
              ${period === p
                ? "bg-primary text-white"
                : "bg-secondary/40 text-muted-foreground hover:text-foreground hover:bg-secondary/60"
              }`}
          >
            {p}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Form modal ───────────────────────────────────────────────────────
function ScheduleForm({
  initial, courses, doctors, onSubmit, onClose, isPending,
}: {
  initial: typeof BLANK & { id?: string };
  courses: Course[];
  doctors: Profile[];
  onSubmit: (d: typeof BLANK & { id?: string }) => void;
  onClose: () => void;
  isPending: boolean;
}) {
  const [form, setForm] = useState(initial);
  const set = (k: string, v: unknown) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="glass rounded-2xl border border-white/[0.1] w-full max-w-md p-6 space-y-4 shadow-2xl"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-foreground">
            {initial.id ? "Edit Schedule" : "New Schedule"}
          </h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-1">
          <label className="text-xs text-muted-foreground uppercase tracking-wider">Course *</label>
          <Select value={form.course_id} onValueChange={v => set("course_id", v)}>
            <SelectTrigger className="h-9 bg-secondary/40 border-white/[0.08]">
              <SelectValue placeholder="Select course…" />
            </SelectTrigger>
            <SelectContent>
              {courses.map(c => (
                <SelectItem key={c.id} value={c.id}>{c.code ? `${c.code} — ` : ""}{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <label className="text-xs text-muted-foreground uppercase tracking-wider">Doctor (optional)</label>
          <Select value={form.doctor_id || "none"} onValueChange={v => set("doctor_id", v === "none" ? "" : v)}>
            <SelectTrigger className="h-9 bg-secondary/40 border-white/[0.08]">
              <SelectValue placeholder="Unassigned" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Unassigned</SelectItem>
              {doctors.map(d => (
                <SelectItem key={d.id} value={d.id}>{d.full_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground uppercase tracking-wider">Day *</label>
            <Select value={form.day_of_week} onValueChange={v => set("day_of_week", v)}>
              <SelectTrigger className="h-9 bg-secondary/40 border-white/[0.08]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DAYS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground uppercase tracking-wider">Week *</label>
            <Select value={String(form.week_number)} onValueChange={v => set("week_number", Number(v))}>
              <SelectTrigger className="h-9 bg-secondary/40 border-white/[0.08]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {WEEKS.map(w => <SelectItem key={w} value={String(w)}>Week {w}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground uppercase tracking-wider">Start Time *</label>
            <TimePicker value={form.start_time} onChange={v => set("start_time", v)} />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground uppercase tracking-wider">End Time *</label>
            <TimePicker value={form.end_time} onChange={v => set("end_time", v)} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground uppercase tracking-wider">Session Type</label>
            <Select value={form.session_type} onValueChange={v => set("session_type", v)}>
              <SelectTrigger className="h-9 bg-secondary/40 border-white/[0.08]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SESSION_TYPES.map(t => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground uppercase tracking-wider">Room</label>
            <Input placeholder="e.g. B-301" value={form.room_number}
              onChange={e => set("room_number", e.target.value)}
              className="h-9 bg-secondary/40 border-white/[0.08]" />
          </div>
        </div>

        <div className="flex gap-2 pt-1">
          <Button variant="outline" className="flex-1" onClick={onClose} disabled={isPending}>Cancel</Button>
          <Button
            className="flex-1 bg-gradient-to-r from-primary to-accent text-white"
            onClick={() => onSubmit(form)}
            disabled={isPending || !form.course_id || !form.start_time || !form.end_time}
          >
            {isPending ? "Saving…" : initial.id ? "Save Changes" : "Create"}
          </Button>
        </div>
      </motion.div>
    </div>
  );
}

// ── Single session row ───────────────────────────────────────────────
function SessionRow({
  s, onEdit, onDelete,
}: {
  s: Schedule;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const style = TYPE_STYLE[s.session_type] ?? TYPE_STYLE.lecture;
  const typeLabel = SESSION_TYPES.find(t => t.value === s.session_type)?.label ?? s.session_type;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 8, transition: { duration: 0.15 } }}
      className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors
        ${s.is_active
          ? "bg-secondary/20 border-white/[0.05] hover:bg-secondary/30"
          : "bg-secondary/10 border-dashed border-white/[0.04] opacity-50"
        }`}
    >
      {/* Type dot */}
      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${style.dot}`} />

      {/* Course + day */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-foreground truncate">
            {s.course_code ? `${s.course_code}` : ""}{s.course_name ? ` — ${s.course_name}` : "Course"}
          </span>
          <span className={`text-[10px] border px-1.5 py-0.5 rounded-md flex-shrink-0 ${style.badge}`}>
            {typeLabel}
          </span>
        </div>

        <div className="flex items-center flex-wrap gap-3 mt-1">
          <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <CalendarDays className="w-3 h-3" />
            {DAY_SHORT[s.day_of_week] ?? s.day_of_week}
          </span>
          <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <Clock className="w-3 h-3" />
            {(() => {
              const fmt = (t: string) => {
                const { hour, minute, period } = parse12h(t);
                return `${hour}:${minute} ${period}`;
              };
              return `${fmt(s.start_time)} – ${fmt(s.end_time)}`;
            })()}
          </span>
          {s.room_number && (
            <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <MapPin className="w-3 h-3" />
              {s.room_number}
            </span>
          )}
          {s.doctor_name && (
            <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <GraduationCap className="w-3 h-3" />
              {s.doctor_name}
            </span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 flex-shrink-0">
        <button
          onClick={onEdit}
          className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors"
          title="Edit"
        >
          <Pencil className="w-3 h-3" />
        </button>
        <button
          onClick={onDelete}
          className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
          title="Delete"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
    </motion.div>
  );
}

// ── Week accordion panel ─────────────────────────────────────────────
function WeekPanel({
  week, schedules, onEdit, onDelete, defaultOpen,
}: {
  week: number;
  schedules: Schedule[];
  onEdit: (s: Schedule) => void;
  onDelete: (id: string) => void;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  // Sort by day then start time
  const sorted = [...schedules].sort((a, b) => {
    const dA = DAYS.indexOf(a.day_of_week);
    const dB = DAYS.indexOf(b.day_of_week);
    if (dA !== dB) return dA - dB;
    return a.start_time.localeCompare(b.start_time);
  });

  return (
    <div className={`glass rounded-2xl border overflow-hidden transition-colors
      ${open ? "border-white/[0.08]" : "border-white/[0.04]"}`}>

      {/* Week header */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-5 py-4 hover:bg-secondary/20 transition-colors text-left"
      >
        {/* Week badge */}
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 font-black text-sm transition-colors
          ${open ? "bg-primary/15 text-primary" : "bg-secondary/40 text-muted-foreground"}`}>
          W{week}
        </div>

        <div className="flex-1">
          <p className="text-sm font-bold text-foreground">Week {week}</p>
          <p className="text-[11px] text-muted-foreground">
            {schedules.length === 0
              ? "No sessions"
              : `${schedules.length} session${schedules.length !== 1 ? "s" : ""} · ${[...new Set(schedules.map(s => DAY_SHORT[s.day_of_week]))].join(", ")}`
            }
          </p>
        </div>

        {/* Day pills preview */}
        <div className="hidden sm:flex items-center gap-1 flex-wrap max-w-[200px]">
          {[...new Set(sorted.map(s => s.day_of_week))].map(day => (
            <span key={day} className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-secondary/50 text-muted-foreground border border-white/[0.06]">
              {DAY_SHORT[day]}
            </span>
          ))}
        </div>

        <span className={`flex-shrink-0 transition-transform duration-200 text-muted-foreground ${open ? "rotate-180" : ""}`}>
          <ChevronDown className="w-4 h-4" />
        </span>
      </button>

      {/* Sessions list */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-2 border-t border-white/[0.05] pt-3">
              <AnimatePresence mode="popLayout">
                {sorted.length === 0 ? (
                  <motion.div
                    key="empty"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-center py-8 text-muted-foreground/50"
                  >
                    <BookOpen className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">No sessions in Week {week}</p>
                  </motion.div>
                ) : (
                  sorted.map(s => (
                    <SessionRow
                      key={s.id}
                      s={s}
                      onEdit={() => onEdit(s)}
                      onDelete={() => onDelete(s.id)}
                    />
                  ))
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────
const Schedules = () => {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Schedule | null>(null);
  const [showEmpty, setShowEmpty] = useState(false);

  const { data: schedules = [] } = useQuery<Schedule[]>({
    queryKey: ["schedules-all"],
    queryFn: async () => {
      const r = await fetch(`${LOCAL_API}/api/schedule?active_only=1`);
      return r.json();
    },
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  const { data: courses = [] } = useQuery<Course[]>({
    queryKey: ["sched-courses"],
    queryFn: async () => {
      const r = await fetch(`${LOCAL_API}/rest/v1/courses`);
      return r.json();
    },
  });

  const { data: doctors = [] } = useQuery<Profile[]>({
    queryKey: ["sched-doctors"],
    queryFn: async () => {
      const r = await fetch(`${LOCAL_API}/rest/v1/profiles?role=doctor`);
      const data = await r.json();
      return Array.isArray(data) ? data.filter((p: any) => p.role === "doctor") : [];
    },
  });

  const invalidate = () => qc.refetchQueries({ queryKey: ["schedules-all"] });

  const create = useMutation({
    mutationFn: async (data: typeof BLANK) => {
      const r = await fetch(`${LOCAL_API}/api/schedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, doctor_id: data.doctor_id || null }),
      });
      if (!r.ok) throw new Error((await r.json()).error);
    },
    onSuccess: () => { invalidate(); setShowForm(false); toast.success("Schedule created"); },
    onError: (e: any) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<typeof BLANK> }) => {
      const r = await fetch(`${LOCAL_API}/api/schedule/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!r.ok) throw new Error((await r.json()).error);
    },
    onSuccess: () => { invalidate(); setEditing(null); toast.success("Schedule updated"); },
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`${LOCAL_API}/api/schedule/${id}`, { method: "DELETE" });
      if (!r.ok) throw new Error((await r.json()).error);
    },
    onSuccess: () => { invalidate(); toast.success("Schedule deleted"); },
    onError: (e: any) => toast.error(e.message),
  });

  const handleSubmit = (form: typeof BLANK & { id?: string }) => {
    if (form.id) {
      const { id, ...data } = form;
      update.mutate({ id, data });
    } else {
      create.mutate(form);
    }
  };

  // Summary stats
  const activeCount  = schedules.filter(s => s.is_active).length;
  const weeksUsed    = new Set(schedules.map(s => s.week_number)).size;
  const coursesUsed  = new Set(schedules.map(s => s.course_id)).size;

  // Weeks that have at least one session
  const weeksWithSessions = new Set(schedules.map(s => s.week_number));
  const visibleWeeks = showEmpty
    ? WEEKS
    : WEEKS.filter(w => weeksWithSessions.has(w));

  return (
    <MainLayout title="Schedules">
      {(showForm || editing) && (
        <ScheduleForm
          initial={editing
            ? { ...editing, doctor_id: editing.doctor_id ?? "", room_number: editing.room_number ?? "" }
            : { ...BLANK }}
          courses={courses}
          doctors={doctors}
          onSubmit={handleSubmit}
          onClose={() => { setShowForm(false); setEditing(null); }}
          isPending={create.isPending || update.isPending}
        />
      )}

      <div className="space-y-5">

        {/* ── Header ── */}
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 200, damping: 22 }}
          className="relative overflow-hidden rounded-2xl border border-black/[0.08] dark:border-white/[0.08] bg-gradient-to-br from-slate-50 via-violet-50/50 to-slate-100 dark:from-[hsl(228,35%,8%)] dark:via-[hsl(225,30%,6%)] dark:to-[hsl(230,35%,7%)]"
        >
          <div className="absolute inset-0 pointer-events-none opacity-10 dark:opacity-25" style={{
            backgroundImage: "linear-gradient(hsl(263 70% 58% / 0.07) 1px, transparent 1px), linear-gradient(90deg, hsl(263 70% 58% / 0.07) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }} />
          <div className="absolute -top-16 -right-16 w-72 h-72 rounded-full bg-violet-500/10 blur-[80px] pointer-events-none" />
          <div className="absolute -bottom-12 -left-12 w-56 h-56 rounded-full bg-primary/8 blur-[60px] pointer-events-none" />

          <div className="relative z-10 p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-violet-500/15 border border-violet-500/20 flex items-center justify-center shadow-lg">
                <CalendarDays className="w-6 h-6 text-violet-400" />
              </div>
              <div>
                <span className="text-[10px] uppercase tracking-[0.15em] text-violet-400/80 font-bold">Timetable</span>
                <h2 className="text-xl font-black text-foreground tracking-tight">Semester Schedule</h2>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {activeCount} active · {weeksUsed} week{weeksUsed !== 1 ? "s" : ""} · {coursesUsed} course{coursesUsed !== 1 ? "s" : ""}
                </p>
              </div>
            </div>
            <Button
              className="h-11 px-5 bg-gradient-to-r from-primary to-accent text-white text-sm shadow-lg shadow-primary/20 rounded-xl font-semibold"
              onClick={() => setShowForm(true)}
            >
              <Plus className="w-4 h-4 mr-1.5" />New Schedule
            </Button>
          </div>
        </motion.div>

        {/* ── Summary cards ── */}
        {schedules.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="grid grid-cols-3 gap-3">
            {[
              { icon: Layers, label: "Total Sessions", value: schedules.length, gradient: "from-primary/20 to-primary/5", border: "border-primary/25", text: "text-primary", iconBg: "bg-primary/20 text-primary" },
              { icon: CalendarDays, label: "Weeks Covered", value: `${weeksUsed} / 16`, gradient: "from-violet-500/20 to-violet-500/5", border: "border-violet-500/25", text: "text-violet-400", iconBg: "bg-violet-500/20 text-violet-400" },
              { icon: BookOpen, label: "Courses", value: coursesUsed, gradient: "from-emerald-500/20 to-emerald-500/5", border: "border-emerald-500/25", text: "text-emerald-400", iconBg: "bg-emerald-500/20 text-emerald-400" },
            ].map((card, i) => (
              <motion.div
                key={card.label}
                initial={{ opacity: 0, y: 12, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ delay: 0.12 + i * 0.06, type: "spring", stiffness: 300, damping: 24 }}
                whileHover={{ y: -3, scale: 1.02, transition: { duration: 0.15 } }}
                className={`rounded-2xl bg-gradient-to-b ${card.gradient} ${card.border} border p-4`}
                style={{ boxShadow: "0 2px 16px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.04)" }}
              >
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${card.iconBg}`}>
                  <card.icon className="w-4 h-4" />
                </div>
                <p className={`text-2xl font-black tabular-nums ${card.text}`}>{card.value}</p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-1">{card.label}</p>
              </motion.div>
            ))}
          </motion.div>
        )}

        {/* ── Info banner ── */}
        <div className="flex items-start gap-3 bg-primary/5 border border-primary/15 rounded-xl px-4 py-3 text-xs text-muted-foreground">
          <AlertCircle className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
          <span>
            <span className="text-foreground font-semibold">Fully automatic.</span>{" "}
            Sessions start and end at their scheduled times. Each week is independent — sessions don't carry over between weeks.
          </span>
        </div>

        {/* ── Week-by-week list ── */}
        {schedules.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-20 text-muted-foreground"
          >
            <CalendarDays className="w-14 h-14 mx-auto mb-3 opacity-20" />
            <p className="font-semibold text-foreground/60">No schedules yet</p>
            <p className="text-sm mt-1 opacity-50">Create a schedule to get started</p>
            <Button
              className="mt-4 bg-gradient-to-r from-primary to-accent text-white"
              onClick={() => setShowForm(true)}
            >
              <Plus className="w-4 h-4 mr-1.5" />Create First Schedule
            </Button>
          </motion.div>
        ) : (
          <div className="space-y-3">
            <AnimatePresence mode="popLayout">
              {visibleWeeks.map((week, i) => (
                <motion.div
                  key={week}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={{ delay: i * 0.03 }}
                >
                  <WeekPanel
                    week={week}
                    schedules={schedules.filter(s => s.week_number === week)}
                    onEdit={s => setEditing(s)}
                    onDelete={id => remove.mutate(id)}
                    defaultOpen={weeksWithSessions.has(week) && weeksWithSessions.size <= 4}
                  />
                </motion.div>
              ))}
            </AnimatePresence>

            {/* Show/hide empty weeks toggle */}
            <button
              onClick={() => setShowEmpty(v => !v)}
              className="w-full py-2.5 rounded-xl border border-dashed border-white/[0.08] text-[11px] text-muted-foreground hover:text-foreground hover:border-white/[0.15] hover:bg-secondary/20 transition-colors flex items-center justify-center gap-2"
            >
              <ChevronRight className={`w-3.5 h-3.5 transition-transform ${showEmpty ? "rotate-90" : ""}`} />
              {showEmpty ? "Hide empty weeks" : `Show all 16 weeks (${16 - weeksWithSessions.size} empty)`}
            </button>
          </div>
        )}
      </div>
    </MainLayout>
  );
};

export default Schedules;
