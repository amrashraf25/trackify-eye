import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";

// ─── TYPES ────────────────────────────────────────────────────────────────────

export type BehaviorType = "smoking" | "aggression" | "fight" | string;

export interface MisconductRecord {
  id: string;
  behaviorType: BehaviorType;
  cameraId: string;
  cameraName: string;
  confidence: number; // 0–1
  timestamp: string;  // ISO-8601
  location: string;
}

export interface IncidentDisplay {
  label: string;
  cameraLabel: string;
  timeLabel: string;
  severityColor: string;
}

// ─── PURE FUNCTIONS (exported for testing) ────────────────────────────────────

/**
 * Returns true when confidence meets or exceeds the threshold.
 */
export function meetsConfidenceThreshold(
  confidence: number,
  threshold: number
): boolean {
  return confidence >= threshold;
}

/**
 * Filters incidents whose confidence meets or exceeds the given threshold.
 */
export function filterByConfidence(
  incidents: MisconductRecord[],
  threshold: number
): MisconductRecord[] {
  return incidents.filter((i) => meetsConfidenceThreshold(i.confidence, threshold));
}

/**
 * Filters incidents to those matching the given behavior type.
 * Pass "all" to return every incident.
 */
export function filterByBehaviorType(
  incidents: MisconductRecord[],
  type: string
): MisconductRecord[] {
  if (type === "all") return incidents;
  return incidents.filter((i) => i.behaviorType === type);
}

/**
 * Builds a human-readable display object for a single incident.
 * severityColor is a CSS-compatible string based on confidence:
 *   ≥ 0.90 → red, ≥ 0.75 → orange, else → yellow
 */
export function formatIncidentDisplay(incident: MisconductRecord): IncidentDisplay {
  const behaviorLabels: Record<string, string> = {
    smoking: "Smoking",
    aggression: "Aggression",
    fight: "Fight",
  };

  const label = behaviorLabels[incident.behaviorType] ?? incident.behaviorType;
  const cameraLabel = incident.cameraName || incident.cameraId;

  const date = new Date(incident.timestamp);
  const timeLabel = date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  let severityColor: string;
  if (incident.confidence >= 0.9) {
    severityColor = "hsl(0 72% 51%)";      // red — high severity
  } else if (incident.confidence >= 0.75) {
    severityColor = "hsl(38 92% 50%)";     // orange — medium severity
  } else {
    severityColor = "hsl(48 96% 53%)";     // yellow — low severity
  }

  return { label, cameraLabel, timeLabel, severityColor };
}

/**
 * Counts incidents grouped by behavior type.
 * Returns a Record<behaviorType, count>.
 */
export function groupByBehaviorType(
  incidents: MisconductRecord[]
): Record<string, number> {
  return incidents.reduce<Record<string, number>>((acc, incident) => {
    acc[incident.behaviorType] = (acc[incident.behaviorType] ?? 0) + 1;
    return acc;
  }, {});
}

/**
 * Sorts incidents by timestamp.
 * direction "asc" = oldest first, "desc" = newest first.
 */
export function sortByTimestamp(
  incidents: MisconductRecord[],
  direction: "asc" | "desc"
): MisconductRecord[] {
  return [...incidents].sort((a, b) => {
    const diff =
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
    return direction === "asc" ? diff : -diff;
  });
}

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

const CONFIDENCE_THRESHOLD_DEFAULT = 0.75;
const BEHAVIOR_TYPES = ["all", "smoking", "aggression", "fight"] as const;

// ─── BADGE COLOR MAP ──────────────────────────────────────────────────────────

const BADGE_COLORS: Record<string, { bg: string; text: string }> = {
  smoking: { bg: "hsl(38 92% 50% / 0.15)", text: "hsl(38 92% 65%)" },
  aggression: { bg: "hsl(0 72% 51% / 0.15)", text: "hsl(0 72% 65%)" },
  fight: { bg: "hsl(280 80% 60% / 0.15)", text: "hsl(280 80% 75%)" },
};

// ─── COMPONENT ────────────────────────────────────────────────────────────────

const MisconductDetection = () => {
  const [behaviorFilter, setBehaviorFilter] = useState<string>("all");
  const [confidenceThreshold, setConfidenceThreshold] = useState<number>(
    CONFIDENCE_THRESHOLD_DEFAULT
  );
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");

  // Fetch incidents from Supabase
  const { data: rawIncidents = [], isLoading } = useQuery<MisconductRecord[]>({
    queryKey: ["misconduct_incidents"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("behavior_logs")
        .select("*")
        .order("timestamp", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((row: any) => ({
        id: row.id,
        behaviorType: row.behavior_type,
        cameraId: row.camera_id,
        cameraName: row.camera_name ?? row.camera_id,
        confidence: row.confidence,
        timestamp: row.timestamp,
        location: row.location ?? "",
      }));
    },
  });

  // Apply filters and sorting
  const filteredIncidents = useMemo(() => {
    let result = filterByConfidence(rawIncidents, confidenceThreshold);
    result = filterByBehaviorType(result, behaviorFilter);

    if (dateFrom) {
      result = result.filter(
        (i) => new Date(i.timestamp) >= new Date(dateFrom)
      );
    }
    if (dateTo) {
      result = result.filter(
        (i) => new Date(i.timestamp) <= new Date(dateTo + "T23:59:59")
      );
    }

    return sortByTimestamp(result, sortDir);
  }, [rawIncidents, confidenceThreshold, behaviorFilter, dateFrom, dateTo, sortDir]);

  // KPI summary
  const summary = useMemo(
    () => groupByBehaviorType(filteredIncidents),
    [filteredIncidents]
  );

  return (
    <div className="min-h-screen p-6" style={{ background: "hsl(225 25% 5%)" }}>
      {/* Page header */}
      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <h1 className="text-2xl font-semibold text-white/90 tracking-tight">
          Misconduct Detection
        </h1>
        <p className="mt-1 text-sm text-white/40">
          AI-flagged behaviour incidents across all monitored classrooms.
        </p>
      </motion.div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {(["smoking", "aggression", "fight"] as const).map((type, idx) => (
          <motion.div
            key={type}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05 }}
            className="rounded-2xl border border-white/[0.07] overflow-hidden"
            style={{ background: "hsl(225 25% 7%)" }}
          >
            <div
              className="px-5 py-4 border-b border-white/[0.06]"
              style={{
                background:
                  "linear-gradient(90deg, hsl(217 91% 60% / 0.06), transparent)",
              }}
            >
              <p className="text-xs text-white/40 uppercase tracking-widest">
                {type}
              </p>
            </div>
            <div className="p-5">
              <p className="text-3xl font-bold text-white/90">
                {summary[type] ?? 0}
              </p>
            </div>
          </motion.div>
        ))}

        {/* Total */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="rounded-2xl border border-white/[0.07] overflow-hidden"
          style={{ background: "hsl(225 25% 7%)" }}
        >
          <div
            className="px-5 py-4 border-b border-white/[0.06]"
            style={{
              background:
                "linear-gradient(90deg, hsl(217 91% 60% / 0.06), transparent)",
            }}
          >
            <p className="text-xs text-white/40 uppercase tracking-widest">
              Total
            </p>
          </div>
          <div className="p-5">
            <p className="text-3xl font-bold text-white/90">
              {filteredIncidents.length}
            </p>
          </div>
        </motion.div>
      </div>

      {/* Filters card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="rounded-2xl border border-white/[0.07] overflow-hidden mb-6"
        style={{ background: "hsl(225 25% 7%)" }}
      >
        <div
          className="px-5 py-4 border-b border-white/[0.06]"
          style={{
            background:
              "linear-gradient(90deg, hsl(217 91% 60% / 0.06), transparent)",
          }}
        >
          <p className="text-sm font-medium text-white/70">Filters</p>
        </div>
        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Behavior type */}
          <div>
            <label className="block text-xs text-white/40 mb-1.5 uppercase tracking-widest">
              Behavior type
            </label>
            <select
              value={behaviorFilter}
              onChange={(e) => setBehaviorFilter(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-white/[0.08] text-white/80 text-sm"
              style={{ background: "hsl(225 25% 9%)" }}
            >
              {BEHAVIOR_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t === "all" ? "All types" : t.charAt(0).toUpperCase() + t.slice(1)}
                </option>
              ))}
            </select>
          </div>

          {/* Confidence threshold */}
          <div>
            <label className="block text-xs text-white/40 mb-1.5 uppercase tracking-widest">
              Min. confidence: {Math.round(confidenceThreshold * 100)}%
            </label>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={confidenceThreshold}
              onChange={(e) => setConfidenceThreshold(parseFloat(e.target.value))}
              className="w-full accent-blue-500"
            />
          </div>

          {/* Date from */}
          <div>
            <label className="block text-xs text-white/40 mb-1.5 uppercase tracking-widest">
              From date
            </label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-white/[0.08] text-white/80 text-sm"
              style={{ background: "hsl(225 25% 9%)" }}
            />
          </div>

          {/* Date to */}
          <div>
            <label className="block text-xs text-white/40 mb-1.5 uppercase tracking-widest">
              To date
            </label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-white/[0.08] text-white/80 text-sm"
              style={{ background: "hsl(225 25% 9%)" }}
            />
          </div>
        </div>
      </motion.div>

      {/* Incidents table card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="rounded-2xl border border-white/[0.07] overflow-hidden"
        style={{ background: "hsl(225 25% 7%)" }}
      >
        <div
          className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between"
          style={{
            background:
              "linear-gradient(90deg, hsl(217 91% 60% / 0.06), transparent)",
          }}
        >
          <p className="text-sm font-medium text-white/70">
            Incidents ({filteredIncidents.length})
          </p>
          <button
            onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
            className="text-xs text-white/40 hover:text-white/70 transition-colors"
          >
            Sort: {sortDir === "desc" ? "Newest first" : "Oldest first"}
          </button>
        </div>

        <div className="p-5">
          {isLoading ? (
            <p className="text-sm text-white/40 text-center py-8">
              Loading incidents…
            </p>
          ) : filteredIncidents.length === 0 ? (
            <p className="text-sm text-white/40 text-center py-8">
              No incidents match the current filters.
            </p>
          ) : (
            <div className="space-y-2">
              {filteredIncidents.map((incident) => {
                const display = formatIncidentDisplay(incident);
                const badge =
                  BADGE_COLORS[incident.behaviorType] ?? {
                    bg: "hsl(217 91% 60% / 0.15)",
                    text: "hsl(217 91% 75%)",
                  };

                return (
                  <motion.div
                    key={incident.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex items-center gap-4 px-4 py-3 rounded-xl border border-white/[0.05]"
                    style={{ background: "hsl(225 25% 9%)" }}
                  >
                    {/* Behavior badge */}
                    <span
                      className="px-2.5 py-1 rounded-lg text-xs font-semibold shrink-0"
                      style={{ background: badge.bg, color: badge.text }}
                    >
                      {display.label}
                    </span>

                    {/* Camera */}
                    <span className="text-sm text-white/60 shrink-0">
                      {display.cameraLabel}
                    </span>

                    {/* Timestamp */}
                    <span className="text-xs text-white/40 flex-1">
                      {display.timeLabel}
                    </span>

                    {/* Confidence */}
                    <span
                      className="text-xs font-medium shrink-0"
                      style={{ color: display.severityColor }}
                    >
                      {Math.round(incident.confidence * 100)}%
                    </span>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default MisconductDetection;
