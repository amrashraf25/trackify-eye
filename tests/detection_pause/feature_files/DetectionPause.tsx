import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";

// ─── TYPES ────────────────────────────────────────────────────────────────────

export interface PauseState {
  pausedAt: Date | null;
  durationMinutes: number;
}

export type PauseStatus = "active" | "idle" | "resuming";

// ─── PURE FUNCTIONS (exported for testing) ────────────────────────────────────

/**
 * Returns true if a pause is currently active (not yet expired).
 */
export function isPauseActive(
  pausedAt: Date | null,
  durationMinutes: number
): boolean {
  if (pausedAt === null) return false;
  const expiresAt = pausedAt.getTime() + durationMinutes * 60_000;
  return Date.now() < expiresAt;
}

/**
 * Returns the number of seconds remaining in the pause.
 * Returns 0 if the pause has expired or was never started.
 */
export function getRemainingSeconds(
  pausedAt: Date,
  durationMinutes: number
): number {
  const expiresAt = pausedAt.getTime() + durationMinutes * 60_000;
  const remaining = Math.floor((expiresAt - Date.now()) / 1_000);
  return Math.max(0, remaining);
}

/**
 * Formats a number of seconds as MM:SS (e.g. 272 → "4:32").
 */
export function formatCountdown(seconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(safeSeconds / 60);
  const secs = safeSeconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

/**
 * Validates that a duration (in minutes) is within the allowed range [1, 60].
 */
export function validateDuration(minutes: number): boolean {
  return Number.isFinite(minutes) && minutes >= 1 && minutes <= 60;
}

/**
 * Returns the descriptive status of the pause:
 *  - "idle"     — no pause active
 *  - "resuming" — pause active but ≤ 10 seconds remaining
 *  - "active"   — pause active with > 10 seconds remaining
 */
export function getPauseStatus(
  pausedAt: Date | null,
  durationMinutes: number
): PauseStatus {
  if (!isPauseActive(pausedAt, durationMinutes)) return "idle";
  const remaining = getRemainingSeconds(pausedAt as Date, durationMinutes);
  return remaining <= 10 ? "resuming" : "active";
}

// ─── DURATION OPTIONS ─────────────────────────────────────────────────────────

const DURATION_OPTIONS = [1, 5, 10, 15, 30] as const;
const DEFAULT_DURATION = 5;

// ─── COMPONENT ────────────────────────────────────────────────────────────────

const DetectionPause = () => {
  const [pausedAt, setPausedAt] = useState<Date | null>(null);
  const [durationMinutes, setDurationMinutes] = useState<number>(DEFAULT_DURATION);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [showDurationMenu, setShowDurationMenu] = useState<boolean>(false);

  // Live countdown via setInterval
  useEffect(() => {
    if (!pausedAt) {
      setRemainingSeconds(0);
      return;
    }

    const tick = () => {
      const remaining = getRemainingSeconds(pausedAt, durationMinutes);
      setRemainingSeconds(remaining);
      if (remaining === 0) {
        setPausedAt(null);
      }
    };

    tick(); // immediate first tick
    const id = setInterval(tick, 1_000);
    return () => clearInterval(id);
  }, [pausedAt, durationMinutes]);

  const status = useMemo(
    () => getPauseStatus(pausedAt, durationMinutes),
    [pausedAt, durationMinutes, remainingSeconds] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const progressFraction = useMemo(() => {
    if (!pausedAt) return 0;
    return remainingSeconds / (durationMinutes * 60);
  }, [pausedAt, durationMinutes, remainingSeconds]);

  // ─── Circumference for SVG progress ring ───────────────────────────────────
  const RADIUS = 44;
  const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
  const strokeDashoffset = CIRCUMFERENCE * (1 - progressFraction);

  // ─── Handlers ───────────────────────────────────────────────────────────────

  const handlePause = async () => {
    if (!validateDuration(durationMinutes)) return;
    setIsLoading(true);
    try {
      await fetch("/api/detection/pause", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ durationMinutes }),
      });
      setPausedAt(new Date());
    } catch (err) {
      console.error("Failed to pause detection:", err);
    } finally {
      setIsLoading(false);
      setShowDurationMenu(false);
    }
  };

  const handleResume = async () => {
    setIsLoading(true);
    try {
      await fetch("/api/detection/resume", { method: "POST" });
      setPausedAt(null);
    } catch (err) {
      console.error("Failed to resume detection:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const statusColors: Record<PauseStatus, string> = {
    active: "hsl(217 91% 60%)",
    resuming: "hsl(38 92% 50%)",
    idle: "hsl(142 71% 45%)",
  };

  const statusLabels: Record<PauseStatus, string> = {
    active: "Detection Paused",
    resuming: "Resuming Soon",
    idle: "Detection Active",
  };

  return (
    <div className="min-h-screen p-6" style={{ background: "hsl(225 25% 5%)" }}>
      {/* Page header */}
      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <h1 className="text-2xl font-semibold text-white/90 tracking-tight">
          AI Detection Control
        </h1>
        <p className="mt-1 text-sm text-white/40">
          Temporarily pause automated behaviour detection during exams or
          supervised assessments.
        </p>
      </motion.div>

      {/* Main card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="rounded-2xl border border-white/[0.07] overflow-hidden max-w-lg"
        style={{ background: "hsl(225 25% 7%)" }}
      >
        {/* Card header */}
        <div
          className="px-5 py-4 border-b border-white/[0.06]"
          style={{
            background:
              "linear-gradient(90deg, hsl(217 91% 60% / 0.06), transparent)",
          }}
        >
          <div className="flex items-center gap-3">
            {/* Status indicator */}
            <span
              className="w-2.5 h-2.5 rounded-full"
              style={{
                background: statusColors[status],
                boxShadow: `0 0 8px ${statusColors[status]}88`,
              }}
            />
            <span className="text-sm font-medium text-white/80">
              {statusLabels[status]}
            </span>
          </div>
        </div>

        <div className="p-5 space-y-6">
          {/* Idle state — pause controls */}
          <AnimatePresence mode="wait">
            {status === "idle" ? (
              <motion.div
                key="idle"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-4"
              >
                {/* Duration selector */}
                <div className="relative">
                  <label className="block text-xs text-white/40 mb-1.5 uppercase tracking-widest">
                    Pause duration
                  </label>
                  <button
                    onClick={() => setShowDurationMenu((v) => !v)}
                    className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl border border-white/[0.08] text-white/80 text-sm transition-colors hover:border-white/[0.15]"
                    style={{ background: "hsl(225 25% 9%)" }}
                  >
                    <span>{durationMinutes} minutes</span>
                    <svg
                      className="w-4 h-4 text-white/40"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </button>

                  <AnimatePresence>
                    {showDurationMenu && (
                      <motion.div
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        className="absolute z-10 w-full mt-1 rounded-xl border border-white/[0.08] overflow-hidden"
                        style={{ background: "hsl(225 25% 9%)" }}
                      >
                        {DURATION_OPTIONS.map((opt) => (
                          <button
                            key={opt}
                            onClick={() => {
                              setDurationMinutes(opt);
                              setShowDurationMenu(false);
                            }}
                            className="w-full px-4 py-2.5 text-left text-sm text-white/70 hover:bg-white/[0.04] transition-colors"
                          >
                            {opt} minute{opt !== 1 ? "s" : ""}
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Pause button */}
                <button
                  onClick={handlePause}
                  disabled={isLoading}
                  className="w-full py-3 rounded-xl font-semibold text-sm transition-all active:scale-95 disabled:opacity-50"
                  style={{
                    background: "hsl(217 91% 60%)",
                    color: "hsl(225 25% 5%)",
                    boxShadow: "0 0 24px hsl(217 91% 60% / 0.3)",
                  }}
                >
                  {isLoading ? "Pausing…" : "Pause AI Detection"}
                </button>
              </motion.div>
            ) : (
              /* Active / Resuming state — countdown */
              <motion.div
                key="active"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center gap-5"
              >
                {/* Progress ring */}
                <div className="relative flex items-center justify-center">
                  <svg width="120" height="120" className="-rotate-90">
                    {/* Background track */}
                    <circle
                      cx="60"
                      cy="60"
                      r={RADIUS}
                      fill="none"
                      stroke="hsl(225 25% 12%)"
                      strokeWidth="6"
                    />
                    {/* Progress arc */}
                    <circle
                      cx="60"
                      cy="60"
                      r={RADIUS}
                      fill="none"
                      stroke={statusColors[status]}
                      strokeWidth="6"
                      strokeLinecap="round"
                      strokeDasharray={CIRCUMFERENCE}
                      strokeDashoffset={strokeDashoffset}
                      style={{ transition: "stroke-dashoffset 1s linear" }}
                    />
                  </svg>
                  {/* Countdown label */}
                  <span
                    className="absolute text-2xl font-bold tabular-nums"
                    style={{ color: statusColors[status] }}
                  >
                    {formatCountdown(remainingSeconds)}
                  </span>
                </div>

                <p className="text-xs text-white/40">
                  {status === "resuming"
                    ? "Detection resuming automatically…"
                    : `Paused for ${durationMinutes} min — detection suspended`}
                </p>

                {/* Resume Now button */}
                <button
                  onClick={handleResume}
                  disabled={isLoading}
                  className="w-full py-2.5 rounded-xl font-medium text-sm border transition-colors disabled:opacity-50 hover:bg-white/[0.04]"
                  style={{
                    borderColor: "hsl(0 72% 51% / 0.4)",
                    color: "hsl(0 72% 65%)",
                  }}
                >
                  {isLoading ? "Resuming…" : "Resume Now"}
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
};

export default DetectionPause;
