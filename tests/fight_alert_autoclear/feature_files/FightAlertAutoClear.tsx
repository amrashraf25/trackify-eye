import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";

// ─── TYPES ────────────────────────────────────────────────────────────────────

export interface FightAlert {
  id: string;
  location: string;
  createdAt: Date;
  status: "active" | "monitoring" | "resolved" | "cleared";
  cameraId: string;
}

export interface ClearNotification {
  alertId: string;
  location: string;
  originalTime: Date;
  clearedAt: Date;
  message: string;
}

// ─── PURE FUNCTIONS (exported for testing) ────────────────────────────────────

/**
 * Returns the number of seconds elapsed since the alert was created.
 */
export function getAlertAge(alertCreatedAt: Date, now: Date): number {
  return Math.max(0, Math.floor((now.getTime() - alertCreatedAt.getTime()) / 1000));
}

/**
 * Returns true when the alert is old enough to be re-evaluated.
 * checkDelaySeconds defaults to 300 (5 minutes).
 */
export function isEligibleForAutoClear(
  alertCreatedAt: Date,
  now: Date,
  checkDelaySeconds: number = 300
): boolean {
  return getAlertAge(alertCreatedAt, now) >= checkDelaySeconds;
}

/**
 * Returns true when the alert has passed the 5-minute checkpoint AND
 * the camera currently shows no active behavior.
 */
export function shouldAutoClear(
  alert: FightAlert,
  cameraStatus: "clear" | "active" | "unknown"
): boolean {
  const now = new Date();
  return isEligibleForAutoClear(alert.createdAt, now) && cameraStatus === "clear";
}

/**
 * Derives a display status from the alert's stored status and age.
 * "monitoring" = alert has passed the 5-min mark but is not yet cleared.
 * "cleared"    = resolved via auto-clear.
 */
export function getAlertStatus(
  alert: FightAlert
): "active" | "monitoring" | "resolved" | "cleared" {
  if (alert.status === "cleared") return "cleared";
  if (alert.status === "resolved") return "resolved";
  const now = new Date();
  if (isEligibleForAutoClear(alert.createdAt, now)) return "monitoring";
  return "active";
}

/**
 * Builds a ClearNotification to be dispatched to the security team.
 */
export function buildClearNotification(
  alert: FightAlert,
  clearedAt: Date
): ClearNotification {
  return {
    alertId: alert.id,
    location: alert.location,
    originalTime: alert.createdAt,
    clearedAt,
    message: `Fight alert at ${alert.location} (ID: ${alert.id}) has been automatically cleared at ${clearedAt.toLocaleTimeString()}. No further abnormal behavior detected.`,
  };
}

/**
 * Filters a list of FightAlerts by the given status string.
 */
export function filterByStatus(alerts: FightAlert[], status: string): FightAlert[] {
  return alerts.filter((a) => a.status === status);
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function formatAge(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${String(s).padStart(2, "0")}s`;
}

const STATUS_COLORS: Record<FightAlert["status"], string> = {
  active:     "hsl(0 84% 60%)",
  monitoring: "hsl(38 100% 56%)",
  resolved:   "hsl(142 71% 45%)",
  cleared:    "hsl(142 71% 45%)",
};

// ─── COMPONENT ────────────────────────────────────────────────────────────────

const FightAlertAutoClear = () => {
  const [now, setNow] = useState(() => new Date());

  // Tick every second to keep age countdowns live
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const { data: rawAlerts = [], refetch } = useQuery<FightAlert[]>({
    queryKey: ["fight-alerts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fight_alerts")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((row: Record<string, unknown>) => ({
        id: String(row.id),
        location: String(row.location),
        createdAt: new Date(row.created_at as string),
        status: row.status as FightAlert["status"],
        cameraId: String(row.camera_id),
      }));
    },
    refetchInterval: 30_000, // AC1: auto-poll every 30s
  });

  const alerts = useMemo(
    () =>
      rawAlerts.map((a) => ({
        ...a,
        derivedStatus: getAlertStatus(a),
        age: getAlertAge(a.createdAt, now),
      })),
    [rawAlerts, now]
  );

  const clearedAlerts = alerts.filter((a) => a.status === "cleared");
  const activeAlerts  = alerts.filter((a) => a.status !== "cleared");

  return (
    <div className="min-h-screen p-6" style={{ background: "hsl(225 25% 5%)" }}>
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-white/[0.07] overflow-hidden mb-6"
        style={{ background: "hsl(225 25% 7%)" }}
      >
        <div
          className="px-5 py-4 border-b border-white/[0.06]"
          style={{
            background: "linear-gradient(90deg, hsl(0 84% 60% / 0.08), transparent)",
          }}
        >
          <h2 className="text-white font-semibold text-lg">Fight Alert Auto-Clear</h2>
          <p className="text-white/50 text-sm mt-0.5">TP-25 — Security Dashboard</p>
        </div>
        <div className="p-5 flex items-center gap-3">
          <span className="text-white/60 text-sm">
            {activeAlerts.length} active · {clearedAlerts.length} cleared
          </span>
          <button
            onClick={() => refetch()}
            className="ml-auto px-3 py-1.5 rounded-lg border border-white/[0.1] text-white/60 text-xs hover:text-white transition-colors"
            style={{ background: "hsl(225 25% 9%)" }}
          >
            Refresh
          </button>
        </div>
      </motion.div>

      {/* Cleared notifications banner */}
      <AnimatePresence>
        {clearedAlerts.map((alert) => (
          <motion.div
            key={`cleared-${alert.id}`}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mb-4 rounded-2xl border border-green-500/30 px-5 py-4 flex items-center gap-3"
            style={{ background: "hsl(142 71% 45% / 0.08)" }}
          >
            <span className="w-2 h-2 rounded-full bg-green-400 flex-shrink-0" />
            <p className="text-green-400 text-sm">
              <span className="font-medium">{alert.location}</span> — fight alert cleared
              automatically. No abnormal behavior detected.
            </p>
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Alert list */}
      <div className="space-y-3">
        {activeAlerts.length === 0 && (
          <p className="text-white/40 text-sm text-center py-12">No active fight alerts.</p>
        )}
        {activeAlerts.map((alert) => (
          <motion.div
            key={alert.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-white/[0.07] overflow-hidden"
            style={{ background: "hsl(225 25% 7%)" }}
          >
            <div
              className="px-5 py-4 border-b border-white/[0.06]"
              style={{
                background: "linear-gradient(90deg, hsl(0 84% 60% / 0.05), transparent)",
              }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white font-medium">{alert.location}</p>
                  <p className="text-white/40 text-xs mt-0.5">
                    Camera {alert.cameraId} · detected{" "}
                    {alert.createdAt.toLocaleTimeString()}
                  </p>
                </div>
                <div className="text-right">
                  <span
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
                    style={{
                      background: `${STATUS_COLORS[alert.derivedStatus as FightAlert["status"]]}20`,
                      color: STATUS_COLORS[alert.derivedStatus as FightAlert["status"]],
                      border: `1px solid ${STATUS_COLORS[alert.derivedStatus as FightAlert["status"]]}40`,
                    }}
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full"
                      style={{
                        background: STATUS_COLORS[alert.derivedStatus as FightAlert["status"]],
                      }}
                    />
                    {alert.derivedStatus}
                  </span>
                </div>
              </div>
            </div>
            <div className="px-5 py-3 flex items-center gap-2">
              <span className="text-white/40 text-xs">Age:</span>
              <span className="text-white/70 text-xs font-mono">{formatAge(alert.age)}</span>
              {alert.derivedStatus === "monitoring" && (
                <span className="ml-auto text-amber-400/70 text-xs">
                  Re-evaluation in progress…
                </span>
              )}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default FightAlertAutoClear;
