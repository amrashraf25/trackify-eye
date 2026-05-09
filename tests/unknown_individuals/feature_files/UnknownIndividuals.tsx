import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";

// ─── TYPES ────────────────────────────────────────────────────────────────────

export interface UnknownDetection {
  id: string;
  cameraId: string;
  cameraName: string;
  detectedAt: string; // ISO string
  matchScore: number;
  imageUrl?: string;
}

export interface DailyReport {
  date: string;
  total: number;
  byCamera: Record<string, number>;
  timeline: UnknownDetection[];
}

// ─── PURE FUNCTIONS (exported for testing) ────────────────────────────────────

/**
 * Returns true when the face match score falls below the identity threshold.
 * threshold defaults to 0.85.
 */
export function isUnknownFace(matchScore: number, threshold: number = 0.85): boolean {
  return matchScore < threshold;
}

/**
 * Filters detections to those that occurred on the given YYYY-MM-DD date.
 * Matches on the date portion of the ISO detectedAt string.
 */
export function filterByDate(
  detections: UnknownDetection[],
  date: string
): UnknownDetection[] {
  if (!date) return [];
  return detections.filter((d) => d.detectedAt.startsWith(date));
}

/**
 * Filters detections to those captured by the given camera.
 */
export function filterByCamera(
  detections: UnknownDetection[],
  cameraId: string
): UnknownDetection[] {
  return detections.filter((d) => d.cameraId === cameraId);
}

/**
 * Builds a structured daily report from the detections matching the given date.
 */
export function buildDailyReport(
  detections: UnknownDetection[],
  date: string
): DailyReport {
  const timeline = filterByDate(detections, date);
  const byCamera: Record<string, number> = {};
  for (const det of timeline) {
    byCamera[det.cameraId] = (byCamera[det.cameraId] ?? 0) + 1;
  }
  return { date, total: timeline.length, byCamera, timeline };
}

/**
 * Classifies the alert priority based on how low the face match score is.
 * <0.50 → "high", <0.70 → "medium", else → "low"
 */
export function classifyAlertPriority(
  matchScore: number
): "high" | "medium" | "low" {
  if (matchScore < 0.5) return "high";
  if (matchScore < 0.7) return "medium";
  return "low";
}

/**
 * Returns a human-readable alert string for a detection event.
 */
export function formatDetectionAlert(detection: UnknownDetection): string {
  const time = new Date(detection.detectedAt).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  return `Unknown individual detected at ${detection.cameraName} at ${time}`;
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────

const PRIORITY_STYLES: Record<string, { label: string; color: string; border: string }> = {
  high:   { label: "HIGH",   color: "hsl(0 84% 60%)",    border: "hsl(0 84% 60% / 0.3)"  },
  medium: { label: "MEDIUM", color: "hsl(38 100% 56%)",  border: "hsl(38 100% 56% / 0.3)" },
  low:    { label: "LOW",    color: "hsl(142 71% 45%)",  border: "hsl(142 71% 45% / 0.3)" },
};

// ─── COMPONENT ────────────────────────────────────────────────────────────────

const UnknownIndividuals = () => {
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );

  const { data: detections = [] } = useQuery<UnknownDetection[]>({
    queryKey: ["unknown-detections"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("unknown_detections")
        .select("*")
        .order("detected_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((row: Record<string, unknown>) => ({
        id: String(row.id),
        cameraId: String(row.camera_id),
        cameraName: String(row.camera_name),
        detectedAt: String(row.detected_at),
        matchScore: Number(row.match_score),
        imageUrl: row.image_url ? String(row.image_url) : undefined,
      }));
    },
    refetchInterval: 10_000,
  });

  const liveAlerts = useMemo(
    () =>
      detections
        .filter((d) => classifyAlertPriority(d.matchScore) === "high")
        .slice(0, 10),
    [detections]
  );

  const dailyReport = useMemo(
    () => buildDailyReport(detections, selectedDate),
    [detections, selectedDate]
  );

  const handleExport = () => {
    const csv = [
      "ID,Camera,Detected At,Match Score,Priority",
      ...dailyReport.timeline.map((d) =>
        [
          d.id,
          d.cameraName,
          d.detectedAt,
          d.matchScore.toFixed(3),
          classifyAlertPriority(d.matchScore),
        ].join(",")
      ),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `unknown-individuals-${selectedDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen p-6 space-y-6" style={{ background: "hsl(225 25% 5%)" }}>
      {/* ── Live Alerts ── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-red-500/20 overflow-hidden"
        style={{ background: "hsl(225 25% 7%)" }}
      >
        <div
          className="px-5 py-4 border-b border-white/[0.06]"
          style={{
            background: "linear-gradient(90deg, hsl(0 84% 60% / 0.08), transparent)",
          }}
        >
          <div className="flex items-center gap-2">
            {/* pulsing dot */}
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
            </span>
            <h2 className="text-white font-semibold text-lg">Live Alerts</h2>
            <span className="ml-auto text-xs text-red-400 border border-red-500/30 px-2 py-0.5 rounded-full">
              HIGH PRIORITY
            </span>
          </div>
          <p className="text-white/50 text-sm mt-0.5">TP-26/TP-27 — Real-time unknown face alerts</p>
        </div>
        <div className="p-5 space-y-2">
          <AnimatePresence>
            {liveAlerts.length === 0 ? (
              <p className="text-white/40 text-sm">No high-priority alerts at this time.</p>
            ) : (
              liveAlerts.map((det) => (
                <motion.div
                  key={det.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  className="flex items-center gap-3 py-3 px-4 rounded-xl border border-red-500/30"
                  style={{ background: "hsl(0 84% 60% / 0.06)" }}
                >
                  {det.imageUrl && (
                    <img
                      src={det.imageUrl}
                      alt="Detection frame"
                      className="w-10 h-10 rounded-lg object-cover border border-white/10"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm truncate">
                      {formatDetectionAlert(det)}
                    </p>
                    <p className="text-white/40 text-xs">
                      Score: {det.matchScore.toFixed(3)} · Camera {det.cameraId}
                    </p>
                  </div>
                  <span
                    className="text-xs font-bold px-2 py-1 rounded-full"
                    style={{
                      color: PRIORITY_STYLES.high.color,
                      border: `1px solid ${PRIORITY_STYLES.high.border}`,
                      background: "hsl(0 84% 60% / 0.08)",
                    }}
                  >
                    HIGH
                  </span>
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* ── Daily Report ── */}
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
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h2 className="text-white font-semibold text-lg">Daily Report</h2>
              <p className="text-white/50 text-sm">
                {dailyReport.total} detection{dailyReport.total !== 1 ? "s" : ""} on {selectedDate}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="px-3 py-1.5 rounded-lg border border-white/[0.1] text-white text-sm bg-transparent focus:outline-none focus:border-blue-500/50"
              />
              <button
                onClick={handleExport}
                className="px-4 py-1.5 rounded-lg border border-blue-500/30 text-blue-400 text-sm hover:border-blue-400/60 transition-colors"
                style={{ background: "hsl(217 91% 60% / 0.06)" }}
              >
                Export CSV
              </button>
            </div>
          </div>
        </div>
        <div className="p-5">
          {dailyReport.total === 0 ? (
            <p className="text-white/40 text-sm text-center py-8">
              No unknown detections on {selectedDate}.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-white/40 text-xs border-b border-white/[0.06]">
                  <th className="text-left pb-3 font-medium">Time</th>
                  <th className="text-left pb-3 font-medium">Camera</th>
                  <th className="text-left pb-3 font-medium">Match Score</th>
                  <th className="text-left pb-3 font-medium">Priority</th>
                </tr>
              </thead>
              <tbody>
                {dailyReport.timeline.map((det) => {
                  const priority = classifyAlertPriority(det.matchScore);
                  const style    = PRIORITY_STYLES[priority];
                  return (
                    <tr
                      key={det.id}
                      className="border-b border-white/[0.04] last:border-0"
                      style={
                        priority === "high"
                          ? { borderLeft: "3px solid hsl(0 84% 60% / 0.6)" }
                          : {}
                      }
                    >
                      <td className="py-3 text-white/70">
                        {new Date(det.detectedAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                        })}
                      </td>
                      <td className="py-3 text-white">{det.cameraName}</td>
                      <td className="py-3 text-white/60 font-mono">
                        {det.matchScore.toFixed(3)}
                      </td>
                      <td className="py-3">
                        <span
                          className="text-xs font-semibold px-2 py-0.5 rounded-full"
                          style={{
                            color: style.color,
                            border: `1px solid ${style.border}`,
                            background: `${style.color}10`,
                          }}
                        >
                          {style.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default UnknownIndividuals;
