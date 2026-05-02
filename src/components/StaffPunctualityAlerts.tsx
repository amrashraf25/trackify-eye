import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";

// ─── INTERFACES ───────────────────────────────────────────────────────────────

export interface PunctualityAlert {
  id: string;
  staffId: string;
  staffName: string;
  role: "lecturer" | "ta";
  type: "late_arrival" | "early_departure";
  minutesDiff: number;
  scheduledTime: string; // ISO datetime
  actualTime: string;    // ISO datetime
  sessionId: string;
  location: string;
  detectedAt: string;    // ISO datetime
}

// ─── PURE FUNCTIONS (exported for testing) ────────────────────────────────────

/**
 * Returns true if actualArrival is MORE than toleranceMinutes after scheduledStart.
 * Exactly at the boundary is NOT considered late.
 */
export function isLateArrival(
  scheduledStart: Date,
  actualArrival: Date,
  toleranceMinutes: number
): boolean {
  const diffMs = actualArrival.getTime() - scheduledStart.getTime();
  const diffMinutes = diffMs / 60000;
  return diffMinutes > toleranceMinutes;
}

/**
 * Returns true if actualDeparture is strictly BEFORE scheduledEnd.
 */
export function isEarlyDeparture(
  scheduledEnd: Date,
  actualDeparture: Date
): boolean {
  return actualDeparture.getTime() < scheduledEnd.getTime();
}

/**
 * Returns the number of minutes between scheduledStart and actualArrival.
 * Positive = late, negative = arrived early (before scheduled start).
 */
export function getMinutesLate(
  scheduledStart: Date,
  actualArrival: Date
): number {
  const diffMs = actualArrival.getTime() - scheduledStart.getTime();
  return Math.round(diffMs / 60000);
}

/**
 * Constructs a PunctualityAlert object from the provided parameters.
 */
export function buildPunctualityAlert(
  staffName: string,
  type: "late_arrival" | "early_departure",
  minutesDiff: number,
  scheduledTime: Date
): Omit<PunctualityAlert, "id" | "staffId" | "sessionId" | "location" | "actualTime" | "detectedAt" | "role"> {
  return {
    staffName,
    type,
    minutesDiff,
    scheduledTime: scheduledTime.toISOString(),
  };
}

/**
 * Filters a list of PunctualityAlerts to those belonging to a specific staffId.
 */
export function filterAlertsByStaff(
  alerts: PunctualityAlert[],
  staffId: string
): PunctualityAlert[] {
  if (!staffId || staffId.trim() === "") return alerts;
  return alerts.filter((a) => a.staffId === staffId);
}

// ─── COMPONENT ────────────────────────────────────────────────────────────────

const TODAY_ISO = new Date().toISOString().slice(0, 10);

const StaffPunctualityAlerts = () => {
  const [staffFilter, setStaffFilter] = useState<string>("");
  const [typeFilter, setTypeFilter] = useState<"" | "late_arrival" | "early_departure">("");

  const { data: rawAlerts = [], isLoading } = useQuery({
    queryKey: ["staff_punctuality_alerts", TODAY_ISO],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("staff_attendance")
        .select("*")
        .gte("scheduled_time", `${TODAY_ISO}T00:00:00`)
        .lte("scheduled_time", `${TODAY_ISO}T23:59:59`);

      if (error) throw error;

      return (data ?? []).map((row: any): PunctualityAlert => ({
        id: row.id,
        staffId: row.staff_id,
        staffName: row.staff_name,
        role: row.role,
        type: row.alert_type,
        minutesDiff: row.minutes_diff,
        scheduledTime: row.scheduled_time,
        actualTime: row.actual_time,
        sessionId: row.session_id,
        location: row.location,
        detectedAt: row.detected_at,
      }));
    },
  });

  const staffOptions = useMemo(() => {
    const seen = new Set<string>();
    const opts: { id: string; name: string }[] = [{ id: "", name: "All Staff" }];
    rawAlerts.forEach((a) => {
      if (!seen.has(a.staffId)) {
        seen.add(a.staffId);
        opts.push({ id: a.staffId, name: a.staffName });
      }
    });
    return opts;
  }, [rawAlerts]);

  const filteredAlerts = useMemo(() => {
    let result = filterAlertsByStaff(rawAlerts, staffFilter);
    if (typeFilter) result = result.filter((a) => a.type === typeFilter);
    return result;
  }, [rawAlerts, staffFilter, typeFilter]);

  return (
    <div className="min-h-screen p-6" style={{ background: "hsl(225 25% 5%)" }}>
      {/* Page header */}
      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6"
      >
        <h1 className="text-2xl font-bold text-white">Staff Punctuality Alerts</h1>
        <p className="text-sm text-white/50 mt-1">
          Facial-recognition–detected late arrivals and early departures — today
        </p>
      </motion.div>

      {/* Filters */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="rounded-2xl border border-white/[0.07] overflow-hidden mb-5"
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
            Filters
          </span>
        </div>
        <div className="p-5 flex flex-wrap gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-white/50 uppercase tracking-wide">
              Staff Member
            </label>
            <select
              value={staffFilter}
              onChange={(e) => setStaffFilter(e.target.value)}
              className="rounded-lg border border-white/[0.1] bg-white/[0.05] text-white text-sm px-3 py-2 focus:outline-none focus:border-blue-500/60"
            >
              {staffOptions.map((o) => (
                <option key={o.id} value={o.id} className="bg-gray-900">
                  {o.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-white/50 uppercase tracking-wide">
              Alert Type
            </label>
            <select
              value={typeFilter}
              onChange={(e) =>
                setTypeFilter(e.target.value as typeof typeFilter)
              }
              className="rounded-lg border border-white/[0.1] bg-white/[0.05] text-white text-sm px-3 py-2 focus:outline-none focus:border-blue-500/60"
            >
              <option value="" className="bg-gray-900">All Types</option>
              <option value="late_arrival" className="bg-gray-900">Late Arrival</option>
              <option value="early_departure" className="bg-gray-900">Early Departure</option>
            </select>
          </div>
        </div>
      </motion.div>

      {/* KPI chips */}
      <div className="flex gap-3 mb-5 flex-wrap">
        {[
          {
            label: "Total Alerts",
            value: filteredAlerts.length,
            color: "text-white",
          },
          {
            label: "Late Arrivals",
            value: filteredAlerts.filter((a) => a.type === "late_arrival").length,
            color: "text-amber-400",
          },
          {
            label: "Early Departures",
            value: filteredAlerts.filter((a) => a.type === "early_departure").length,
            color: "text-red-400",
          },
        ].map((chip) => (
          <div
            key={chip.label}
            className="rounded-xl border border-white/[0.06] px-4 py-3"
            style={{ background: "hsl(225 25% 9%)" }}
          >
            <p className="text-xs text-white/40 mb-1">{chip.label}</p>
            <p className={`text-xl font-bold ${chip.color}`}>{chip.value}</p>
          </div>
        ))}
      </div>

      {/* Alerts list */}
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
            Alert Log
          </span>
        </div>
        <div className="p-5">
          {isLoading ? (
            <p className="text-white/40 text-sm text-center py-8">
              Loading alerts...
            </p>
          ) : filteredAlerts.length === 0 ? (
            <p className="text-white/40 text-sm text-center py-8">
              No punctuality alerts found for today
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {filteredAlerts.map((alert) => (
                <motion.div
                  key={alert.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  className={`rounded-xl border p-4 ${
                    alert.type === "late_arrival"
                      ? "border-amber-500/30 bg-amber-500/[0.06]"
                      : "border-red-500/30 bg-red-500/[0.06]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className={`text-xs font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                            alert.type === "late_arrival"
                              ? "bg-amber-500/20 text-amber-400"
                              : "bg-red-500/20 text-red-400"
                          }`}
                        >
                          {alert.type === "late_arrival"
                            ? "Late Arrival"
                            : "Early Departure"}
                        </span>
                        <span className="text-xs text-white/40 capitalize">
                          {alert.role}
                        </span>
                      </div>
                      <p className="text-white font-semibold">{alert.staffName}</p>
                      <p className="text-white/50 text-sm mt-0.5">
                        {alert.location}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p
                        className={`text-lg font-bold ${
                          alert.type === "late_arrival"
                            ? "text-amber-400"
                            : "text-red-400"
                        }`}
                      >
                        {Math.abs(alert.minutesDiff)} min
                        {alert.type === "late_arrival" ? " late" : " early"}
                      </p>
                      <p className="text-xs text-white/40 mt-1">
                        Scheduled:{" "}
                        {new Date(alert.scheduledTime).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                      <p className="text-xs text-white/40">
                        Actual:{" "}
                        {new Date(alert.actualTime).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default StaffPunctualityAlerts;
