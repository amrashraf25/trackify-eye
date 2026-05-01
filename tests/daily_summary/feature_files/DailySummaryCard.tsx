// DailySummaryCard — Daily behavior summary for staff dashboards.
// Fetches /api/summary/daily?date=YYYY-MM-DD from the Python backend and renders:
//   • Total incidents count with severity breakdown
//   • Per-behavior-type bar chart (horizontal bars)
//   • Date picker so staff can browse any past day
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { format, subDays, addDays } from "date-fns";
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Smartphone,
  BedDouble,
  MessageSquare,
  Swords,
  Utensils,
  Eye,
  BarChart2,
  TrendingUp,
  CalendarDays,
} from "lucide-react";

const LOCAL_API = "http://localhost:5000";

// ── helpers ──────────────────────────────────────────────────────────────────
const BEHAVIOR_META: Record<string, { label: string; icon: React.ElementType; color: string; bg: string; barColor: string }> = {
  phone_use:  { label: "Phone Use",   icon: Smartphone,    color: "text-amber-400",   bg: "bg-amber-500/15",   barColor: "hsl(38 92% 50%)"    },
  sleeping:   { label: "Sleeping",    icon: BedDouble,     color: "text-blue-400",    bg: "bg-blue-500/15",    barColor: "hsl(217 91% 60%)"   },
  talking:    { label: "Talking",     icon: MessageSquare, color: "text-violet-400",  bg: "bg-violet-500/15",  barColor: "hsl(263 70% 58%)"   },
  fighting:   { label: "Fighting",    icon: Swords,        color: "text-red-400",     bg: "bg-red-500/15",     barColor: "hsl(0 84% 60%)"     },
  eating:     { label: "Eating",      icon: Utensils,      color: "text-emerald-400", bg: "bg-emerald-500/15", barColor: "hsl(160 84% 39%)"   },
  cheating:   { label: "Cheating",    icon: Eye,           color: "text-orange-400",  bg: "bg-orange-500/15",  barColor: "hsl(25 95% 53%)"    },
  drinking:   { label: "Drinking",    icon: Utensils,      color: "text-cyan-400",    bg: "bg-cyan-500/15",    barColor: "hsl(187 92% 69%)"   },
};

const SEVERITY_COLOR: Record<string, string> = {
  critical: "bg-red-500",
  high:     "bg-orange-500",
  medium:   "bg-amber-400",
  low:      "bg-blue-400",
  normal:   "bg-emerald-400",
};

const SEVERITY_TEXT: Record<string, string> = {
  critical: "text-red-400",
  high:     "text-orange-400",
  medium:   "text-amber-400",
  low:      "text-blue-400",
  normal:   "text-emerald-400",
};

interface DailySummaryData {
  date: string;
  total: number;
  by_type: Record<string, number>;
  by_severity: Record<string, number>;
  top_behavior: string | null;
  incidents: any[];
}

// ── component ─────────────────────────────────────────────────────────────────
const DailySummaryCard = () => {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const dateStr = format(selectedDate, "yyyy-MM-dd");
  const isToday  = dateStr === format(new Date(), "yyyy-MM-dd");
  const isFuture = selectedDate > new Date();

  const { data, isLoading, isError } = useQuery<DailySummaryData>({
    queryKey: ["daily-summary", dateStr],
    queryFn: async () => {
      const r = await fetch(`${LOCAL_API}/api/summary/daily?date=${dateStr}`);
      if (!r.ok) throw new Error("Failed to fetch daily summary");
      return r.json();
    },
    staleTime: 60_000,      // refetch at most once per minute
    refetchInterval: isToday ? 60_000 : false,  // live-poll only for today
  });

  // Sorted behavior types descending by count
  const sortedTypes = data
    ? Object.entries(data.by_type).sort((a, b) => b[1] - a[1])
    : [];

  const maxCount = sortedTypes.length > 0 ? sortedTypes[0][1] : 1;

  const severityOrder = ["critical", "high", "medium", "low", "normal"];
  const severityCounts = severityOrder
    .filter((s) => data?.by_severity[s])
    .map((s) => ({ key: s, count: data!.by_severity[s] }));

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.35 }}
      className="glass rounded-2xl p-5 space-y-4"
    >
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-1 h-6 rounded-full bg-gradient-to-b from-primary to-accent" />
          <div>
            <h3 className="text-base font-bold text-foreground flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-primary" />
              Daily Behavior Summary
            </h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Flagged incidents detected by AI surveillance
            </p>
          </div>
        </div>

        {/* Date Navigator */}
        <div className="flex items-center gap-1 bg-secondary/60 rounded-xl px-1 py-1">
          <button
            onClick={() => setSelectedDate((d) => subDays(d, 1))}
            className="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <div className="flex items-center gap-1.5 px-2 min-w-[110px] justify-center">
            <CalendarDays className="w-3 h-3 text-primary" />
            <span className="text-xs font-semibold text-foreground">
              {isToday ? "Today" : format(selectedDate, "MMM d, yyyy")}
            </span>
          </div>
          <button
            onClick={() => setSelectedDate((d) => addDays(d, 1))}
            disabled={isFuture}
            className="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ── Loading ─────────────────────────────────────────────────────── */}
      <AnimatePresence mode="wait">
        {isLoading && (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-3"
          >
            {[...Array(4)].map((_, i) => (
              <div key={i} className="shimmer rounded-xl h-10 w-full" />
            ))}
          </motion.div>
        )}

        {/* ── Error ─────────────────────────────────────────────────────── */}
        {isError && !isLoading && (
          <motion.div
            key="error"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center py-8 gap-2 text-muted-foreground"
          >
            <AlertTriangle className="w-8 h-8 text-destructive/60" />
            <p className="text-sm">Could not load summary — is the Python backend running?</p>
          </motion.div>
        )}

        {/* ── Data ──────────────────────────────────────────────────────── */}
        {data && !isLoading && (
          <motion.div
            key={dateStr}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="space-y-4"
          >
            {/* Totals strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {/* Total */}
              <div className="col-span-2 sm:col-span-1 rounded-xl bg-primary/10 border border-primary/20 p-3 flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-primary/20 flex items-center justify-center flex-shrink-0">
                  <TrendingUp className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-semibold">Total</p>
                  <p className="text-2xl font-black text-foreground leading-none mt-0.5">{data.total}</p>
                </div>
              </div>

              {/* Severity pills */}
              {severityCounts.length === 0 ? (
                <div className="col-span-2 sm:col-span-3 flex items-center justify-center rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-3">
                  <p className="text-sm font-semibold text-emerald-400">✓ No incidents on this day</p>
                </div>
              ) : (
                severityCounts.slice(0, 3).map(({ key, count }) => (
                  <div
                    key={key}
                    className="rounded-xl bg-secondary/60 border border-border/40 p-3 flex items-center gap-2"
                  >
                    <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${SEVERITY_COLOR[key] ?? "bg-gray-400"}`} />
                    <div>
                      <p className={`text-[10px] uppercase tracking-wide font-bold ${SEVERITY_TEXT[key] ?? "text-muted-foreground"}`}>
                        {key}
                      </p>
                      <p className="text-xl font-black text-foreground leading-none">{count}</p>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Per-type horizontal bar chart */}
            {sortedTypes.length > 0 && (
              <div className="space-y-2.5">
                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                  Breakdown by behavior type
                </p>
                {sortedTypes.map(([type, count], i) => {
                  const meta = BEHAVIOR_META[type] ?? {
                    label: type.replace(/_/g, " "),
                    icon: AlertTriangle,
                    color: "text-muted-foreground",
                    bg: "bg-secondary",
                  };
                  const Icon = meta.icon;
                  const pct = Math.round((count / maxCount) * 100);

                  return (
                    <motion.div
                      key={type}
                      initial={{ opacity: 0, x: -16 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.06, type: "spring", stiffness: 280, damping: 24 }}
                      className="flex items-center gap-3"
                    >
                      {/* Icon */}
                      <div className={`w-7 h-7 rounded-lg ${meta.bg} flex items-center justify-center flex-shrink-0`}>
                        <Icon className={`w-3.5 h-3.5 ${meta.color}`} />
                      </div>

                      {/* Label + bar */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-semibold text-foreground capitalize">
                            {meta.label}
                          </span>
                          <span className="text-xs font-bold tabular-nums text-muted-foreground">
                            {count}
                          </span>
                        </div>
                        <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                          <motion.div
                            className="h-full rounded-full"
                            style={{ background: meta.barColor, opacity: 0.85 }}
                            initial={{ width: 0 }}
                            animate={{ width: `${pct}%` }}
                            transition={{ duration: 0.8, ease: "easeOut", delay: 0.2 + i * 0.06 }}
                          />
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}

            {/* Top behavior badge */}
            {data.top_behavior && data.total > 0 && (
              <div className="flex items-center gap-2 pt-1 border-t border-border/30">
                <span className="text-[11px] text-muted-foreground">Most common today:</span>
                <span className={`text-[11px] font-bold capitalize px-2 py-0.5 rounded-full ${
                  (BEHAVIOR_META[data.top_behavior]?.bg ?? "bg-secondary") + " " +
                  (BEHAVIOR_META[data.top_behavior]?.color ?? "text-foreground")
                }`}>
                  {(BEHAVIOR_META[data.top_behavior]?.label ?? data.top_behavior).replace(/_/g, " ")}
                </span>
                <span className="text-[11px] text-muted-foreground ml-auto">
                  {data.by_type[data.top_behavior]}× detected
                </span>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default DailySummaryCard;
