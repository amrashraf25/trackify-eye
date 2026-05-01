import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";

// ─── INTERFACES ───────────────────────────────────────────────────────────────

export interface Incident {
  id: string;
  type: string;
  location: string;
  timestamp: string; // ISO datetime string
  reportedBy: string;
  severity: "low" | "medium" | "high";
}

export interface DigestSummary {
  totalIncidents: number;
  byType: Record<string, number>;
  byLocation: Record<string, number>;
  topLocation: string;
  topType: string;
}

// ─── PURE FUNCTIONS (exported for testing) ────────────────────────────────────

/**
 * Returns incidents whose timestamp falls within [weekStart, weekEnd] inclusive.
 */
export function filterByWeek(
  incidents: Incident[],
  weekStart: Date,
  weekEnd: Date
): Incident[] {
  const startMs = weekStart.getTime();
  const endMs = weekEnd.getTime();
  return incidents.filter((inc) => {
    const t = new Date(inc.timestamp).getTime();
    return t >= startMs && t <= endMs;
  });
}

/**
 * Groups incidents by their type and returns a count map.
 * Example: { fighting: 3, smoking: 2 }
 */
export function groupByType(incidents: Incident[]): Record<string, number> {
  return incidents.reduce<Record<string, number>>((acc, inc) => {
    acc[inc.type] = (acc[inc.type] ?? 0) + 1;
    return acc;
  }, {});
}

/**
 * Groups incidents by their location and returns a count map.
 * Example: { "Room 101": 2, "Corridor A": 1 }
 */
export function groupByLocation(incidents: Incident[]): Record<string, number> {
  return incidents.reduce<Record<string, number>>((acc, inc) => {
    acc[inc.location] = (acc[inc.location] ?? 0) + 1;
    return acc;
  }, {});
}

/**
 * Builds a full DigestSummary from a list of incidents.
 */
export function buildDigestSummary(incidents: Incident[]): DigestSummary {
  if (incidents.length === 0) {
    return {
      totalIncidents: 0,
      byType: {},
      byLocation: {},
      topLocation: "",
      topType: "",
    };
  }

  const byType = groupByType(incidents);
  const byLocation = groupByLocation(incidents);

  const topType =
    Object.entries(byType).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
  const topLocation =
    Object.entries(byLocation).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";

  return {
    totalIncidents: incidents.length,
    byType,
    byLocation,
    topLocation,
    topType,
  };
}

/**
 * Serializes a DigestSummary into a CSV string suitable for download.
 *
 * Format:
 *   Week,<weekLabel>
 *   Total Incidents,<n>
 *   Top Type,<topType>
 *   Top Location,<topLocation>
 *   (blank line)
 *   Incident Type,Count
 *   <type>,<count>
 *   ...
 *   (blank line)
 *   Location,Count
 *   <location>,<count>
 *   ...
 */
export function formatDigestCsv(
  summary: DigestSummary,
  weekLabel: string
): string {
  const lines: string[] = [];

  lines.push(`Week,${weekLabel}`);
  lines.push(`Total Incidents,${summary.totalIncidents}`);
  lines.push(`Top Type,${summary.topType}`);
  lines.push(`Top Location,${summary.topLocation}`);
  lines.push("");

  lines.push("Incident Type,Count");
  for (const [type, count] of Object.entries(summary.byType)) {
    lines.push(`${type},${count}`);
  }
  lines.push("");

  lines.push("Location,Count");
  for (const [location, count] of Object.entries(summary.byLocation)) {
    lines.push(`${location},${count}`);
  }

  return lines.join("\n");
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function getWeekBounds(referenceDate: Date): { start: Date; end: Date } {
  const d = new Date(referenceDate);
  const day = d.getDay(); // 0 = Sunday
  const diffToMonday = (day === 0 ? -6 : 1 - day);
  const monday = new Date(d);
  monday.setDate(d.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  return { start: monday, end: sunday };
}

function formatWeekLabel(start: Date, end: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  return `${fmt(start)}_${fmt(end)}`;
}

// ─── COMPONENT ────────────────────────────────────────────────────────────────

const WeeklySafetyDigest = () => {
  const [referenceDate, setReferenceDate] = useState<Date>(() => new Date());

  const { start: weekStart, end: weekEnd } = useMemo(
    () => getWeekBounds(referenceDate),
    [referenceDate]
  );

  const weekLabel = useMemo(
    () => formatWeekLabel(weekStart, weekEnd),
    [weekStart, weekEnd]
  );

  const { data: rawIncidents = [], isLoading } = useQuery({
    queryKey: ["incidents_weekly", weekLabel],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("incidents")
        .select("*")
        .gte("timestamp", weekStart.toISOString())
        .lte("timestamp", weekEnd.toISOString());

      if (error) throw error;

      return (data ?? []).map((row: any): Incident => ({
        id: row.id,
        type: row.incident_type,
        location: row.location,
        timestamp: row.timestamp,
        reportedBy: row.reported_by ?? "System",
        severity: row.severity ?? "medium",
      }));
    },
  });

  const summary = useMemo(
    () => buildDigestSummary(rawIncidents),
    [rawIncidents]
  );

  const handlePrevWeek = () => {
    setReferenceDate((d) => new Date(d.getTime() - 7 * 24 * 60 * 60 * 1000));
  };

  const handleNextWeek = () => {
    setReferenceDate((d) => new Date(d.getTime() + 7 * 24 * 60 * 60 * 1000));
  };

  const handleExport = () => {
    const csv = formatDigestCsv(summary, weekLabel);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `safety-digest-${weekLabel}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen p-6" style={{ background: "hsl(225 25% 5%)" }}>
      {/* Page header */}
      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6"
      >
        <h1 className="text-2xl font-bold text-white">Weekly Safety Digest</h1>
        <p className="text-sm text-white/50 mt-1">
          Summary of campus safety incidents for the selected week
        </p>
      </motion.div>

      {/* Week navigator */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="rounded-2xl border border-white/[0.07] overflow-hidden mb-5"
        style={{ background: "hsl(225 25% 7%)" }}
      >
        <div
          className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between"
          style={{
            background:
              "linear-gradient(90deg, hsl(217 91% 60% / 0.06), transparent)",
          }}
        >
          <button
            onClick={handlePrevWeek}
            className="px-3 py-1.5 rounded-lg bg-white/[0.05] border border-white/[0.08] text-white/70 text-sm hover:bg-white/[0.09] transition-colors"
          >
            Previous Week
          </button>

          <span className="text-sm font-semibold text-white/80">
            {weekStart.toLocaleDateString()} – {weekEnd.toLocaleDateString()}
          </span>

          <button
            onClick={handleNextWeek}
            className="px-3 py-1.5 rounded-lg bg-white/[0.05] border border-white/[0.08] text-white/70 text-sm hover:bg-white/[0.09] transition-colors"
          >
            Next Week
          </button>
        </div>
      </motion.div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
        {[
          {
            label: "Total Incidents",
            value: summary.totalIncidents,
            color: "text-white",
          },
          {
            label: "Top Incident Type",
            value: summary.topType || "—",
            color: "text-red-400",
          },
          {
            label: "Top Location",
            value: summary.topLocation || "—",
            color: "text-amber-400",
          },
        ].map((kpi) => (
          <motion.div
            key={kpi.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
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
              <span className="text-xs font-semibold text-white/50 uppercase tracking-wider">
                {kpi.label}
              </span>
            </div>
            <div className="p-5">
              <p className={`text-2xl font-bold ${kpi.color}`}>{kpi.value}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Breakdown tables */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
        {/* By type */}
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
            <span className="text-sm font-semibold text-white/80 uppercase tracking-wider">
              By Incident Type
            </span>
          </div>
          <div className="p-5">
            {isLoading ? (
              <p className="text-white/40 text-sm text-center py-4">Loading...</p>
            ) : Object.keys(summary.byType).length === 0 ? (
              <p className="text-white/40 text-sm text-center py-4">
                No incidents this week
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-white/40 text-xs uppercase tracking-wider border-b border-white/[0.06]">
                    <th className="pb-2 text-left">Type</th>
                    <th className="pb-2 text-right">Count</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(summary.byType)
                    .sort((a, b) => b[1] - a[1])
                    .map(([type, count]) => (
                      <tr
                        key={type}
                        className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors"
                      >
                        <td className="py-2.5 text-white/80 capitalize">
                          {type}
                        </td>
                        <td className="py-2.5 text-right text-red-400 font-semibold">
                          {count}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            )}
          </div>
        </motion.div>

        {/* By location */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
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
            <span className="text-sm font-semibold text-white/80 uppercase tracking-wider">
              By Location
            </span>
          </div>
          <div className="p-5">
            {isLoading ? (
              <p className="text-white/40 text-sm text-center py-4">Loading...</p>
            ) : Object.keys(summary.byLocation).length === 0 ? (
              <p className="text-white/40 text-sm text-center py-4">
                No incidents this week
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-white/40 text-xs uppercase tracking-wider border-b border-white/[0.06]">
                    <th className="pb-2 text-left">Location</th>
                    <th className="pb-2 text-right">Count</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(summary.byLocation)
                    .sort((a, b) => b[1] - a[1])
                    .map(([location, count]) => (
                      <tr
                        key={location}
                        className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors"
                      >
                        <td className="py-2.5 text-white/80">{location}</td>
                        <td className="py-2.5 text-right text-amber-400 font-semibold">
                          {count}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            )}
          </div>
        </motion.div>
      </div>

      {/* Export button */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.25 }}
        className="flex justify-end"
      >
        <button
          onClick={handleExport}
          disabled={summary.totalIncidents === 0}
          className="px-5 py-2.5 rounded-xl bg-blue-600/20 border border-blue-500/30 text-blue-300 text-sm font-semibold hover:bg-blue-600/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Export Weekly Digest (CSV)
        </button>
      </motion.div>
    </div>
  );
};

export default WeeklySafetyDigest;
