/**
 * ====================================================================
 * Detection Pause — Unit Tests
 * Exactly 4 tests per function: Happy path / Edge case / Negative / No crash
 * ====================================================================
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  isPauseActive,
  getRemainingSeconds,
  formatCountdown,
  validateDuration,
  getPauseStatus,
} from "./feature_files/DetectionPause";

let now: Date;
let fiveMinutesAgo: Date;
let ninetySecondsAgo: Date;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-05-01T10:00:00.000Z"));
  now = new Date();
  fiveMinutesAgo    = new Date(now.getTime() - 5 * 60_000);
  ninetySecondsAgo  = new Date(now.getTime() - 90_000);
});

afterEach(() => {
  vi.useRealTimers();
});

// ─── AC1: isPauseActive and getPauseStatus ───────────────────────────────────

describe("AC1: isPauseActive and getPauseStatus", () => {
  it("Happy path: active pause returns true; 30 s in returns 'active' status", () => {
    expect(isPauseActive(now, 5)).toBe(true);
    const pausedAt30s = new Date(now.getTime() - 30_000);
    expect(getPauseStatus(pausedAt30s, 5)).toBe("active");
  });

  it("Edge case: null pausedAt returns false and 'idle' status", () => {
    expect(isPauseActive(null, 5)).toBe(false);
    expect(getPauseStatus(null, 5)).toBe("idle");
  });

  it("Negative test: exactly-expired pause returns false and 'idle' status", () => {
    expect(isPauseActive(fiveMinutesAgo, 5)).toBe(false);
    expect(getPauseStatus(fiveMinutesAgo, 5)).toBe("idle");
  });

  it("No crash: null pausedAt or zero duration does not throw", () => {
    expect(() => isPauseActive(null, 0)).not.toThrow();
    expect(() => getPauseStatus(null, 5)).not.toThrow();
  });
});

// ─── AC2: validateDuration and getRemainingSeconds ───────────────────────────

describe("AC2: validateDuration and getRemainingSeconds", () => {
  it("Happy path: valid durations (1–60) all return true; 90 s in → 210 s remain", () => {
    [1, 5, 10, 15, 30, 60].forEach((d) => expect(validateDuration(d)).toBe(true));
    expect(getRemainingSeconds(ninetySecondsAgo, 5)).toBe(210);
  });

  it("Edge case: boundary values 1 and 60 are valid; exact expiry returns 0", () => {
    expect(validateDuration(1)).toBe(true);
    expect(validateDuration(60)).toBe(true);
    expect(getRemainingSeconds(fiveMinutesAgo, 5)).toBe(0);
  });

  it("Negative test: 0, 61, and -1 are invalid durations", () => {
    expect(validateDuration(0)).toBe(false);
    expect(validateDuration(61)).toBe(false);
    expect(validateDuration(-1)).toBe(false);
  });

  it("No crash: NaN and Infinity do not throw and return false", () => {
    expect(() => validateDuration(NaN)).not.toThrow();
    expect(() => validateDuration(Infinity)).not.toThrow();
    expect(validateDuration(NaN)).toBe(false);
    expect(validateDuration(Infinity)).toBe(false);
  });
});

// ─── AC3: formatCountdown and countdown-to-zero behaviour ────────────────────

describe("AC3: formatCountdown and countdown-to-zero behaviour", () => {
  it("Happy path: formats seconds to MM:SS correctly with zero-padded single digits", () => {
    expect(formatCountdown(272)).toBe("4:32");
    expect(formatCountdown(60)).toBe("1:00");
    expect(formatCountdown(65)).toBe("1:05");
    expect(formatCountdown(9)).toBe("0:09");
  });

  it("Edge case: formatCountdown(0) returns '0:00'; expired pause clamps to 0", () => {
    expect(formatCountdown(0)).toBe("0:00");
    expect(getRemainingSeconds(fiveMinutesAgo, 5)).toBe(0);
  });

  it("Negative test: negative input is clamped to '0:00'", () => {
    expect(formatCountdown(-30)).toBe("0:00");
  });

  it("No crash: does not throw on zero or negative input", () => {
    expect(() => formatCountdown(0)).not.toThrow();
    expect(() => formatCountdown(-1)).not.toThrow();
  });
});
