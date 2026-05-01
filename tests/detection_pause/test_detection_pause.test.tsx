import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  isPauseActive,
  getRemainingSeconds,
  formatCountdown,
  validateDuration,
  getPauseStatus,
} from "./feature_files/DetectionPause";

// ─── SHARED TEST DATA ─────────────────────────────────────────────────────────

let now: Date;
let fiveMinutesAgo: Date;
let ninetySecondsAgo: Date;
let justNow: Date;

beforeEach(() => {
  // Freeze time so every test has a stable reference point
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-05-01T10:00:00.000Z"));

  now = new Date();
  fiveMinutesAgo = new Date(now.getTime() - 5 * 60_000);
  ninetySecondsAgo = new Date(now.getTime() - 90_000);
  justNow = new Date(now.getTime());
});

afterEach(() => {
  vi.useRealTimers();
});

// ─── AC1: isPauseActive & getPauseStatus ─────────────────────────────────────

describe("AC1: isPauseActive and getPauseStatus", () => {
  it("Happy path: returns true when pause has not expired", () => {
    // Arrange
    const pausedAt = justNow; // paused right now, 5-min window
    const duration = 5;

    // Act
    const result = isPauseActive(pausedAt, duration);

    // Assert
    expect(result).toBe(true);
  });

  it("Edge case: pausedAt = null returns false (idle)", () => {
    // Arrange
    const pausedAt = null;

    // Act
    const active = isPauseActive(pausedAt, 5);
    const status = getPauseStatus(pausedAt, 5);

    // Assert
    expect(active).toBe(false);
    expect(status).toBe("idle");
  });

  it("Negative test: pause that has already expired returns false", () => {
    // Arrange — paused exactly 5 min ago with a 5-min window → boundary is now
    const pausedAt = fiveMinutesAgo;
    const duration = 5;

    // Act
    const result = isPauseActive(pausedAt, duration);

    // Assert — Date.now() === expiresAt, so NOT strictly less than → false
    expect(result).toBe(false);
  });

  it("No crash: does not throw on null pausedAt or zero duration", () => {
    // Arrange / Act / Assert
    expect(() => isPauseActive(null, 0)).not.toThrow();
    expect(() => isPauseActive(null, 5)).not.toThrow();
  });

  it("getPauseStatus: active when more than 10 s remain", () => {
    // Arrange — paused 30 s ago with 5-min window → 270 s remain
    const pausedAt = new Date(now.getTime() - 30_000);

    // Act
    const status = getPauseStatus(pausedAt, 5);

    // Assert
    expect(status).toBe("active");
  });

  it("getPauseStatus: resuming when ≤ 10 s remain", () => {
    // Arrange — paused 4 min 55 s ago → 5 s remain
    const pausedAt = new Date(now.getTime() - (5 * 60 - 5) * 1_000);

    // Act
    const status = getPauseStatus(pausedAt, 5);

    // Assert
    expect(status).toBe("resuming");
  });

  it("getPauseStatus: idle when pause exactly expires at boundary", () => {
    // Arrange — paused exactly 5 min ago
    const pausedAt = fiveMinutesAgo;

    // Act
    const status = getPauseStatus(pausedAt, 5);

    // Assert
    expect(status).toBe("idle");
  });
});

// ─── AC2: validateDuration & getRemainingSeconds ──────────────────────────────

describe("AC2: validateDuration and getRemainingSeconds", () => {
  it("Happy path: validates acceptable duration values", () => {
    // Arrange
    const validDurations = [1, 5, 10, 15, 30, 60];

    // Act & Assert
    validDurations.forEach((d) => {
      expect(validateDuration(d)).toBe(true);
    });
  });

  it("Edge case: boundary values 1 and 60 are valid", () => {
    // Arrange / Act / Assert
    expect(validateDuration(1)).toBe(true);
    expect(validateDuration(60)).toBe(true);
  });

  it("Negative test: duration 0 is invalid", () => {
    // Arrange
    const duration = 0;

    // Act
    const result = validateDuration(duration);

    // Assert
    expect(result).toBe(false);
  });

  it("Negative test: duration 61 is invalid (exceeds maximum)", () => {
    // Arrange
    const duration = 61;

    // Act
    const result = validateDuration(duration);

    // Assert
    expect(result).toBe(false);
  });

  it("Negative test: negative duration is invalid", () => {
    // Arrange
    const duration = -1;

    // Act
    const result = validateDuration(duration);

    // Assert
    expect(result).toBe(false);
  });

  it("No crash: does not throw on non-finite values", () => {
    // Arrange / Act / Assert
    expect(() => validateDuration(NaN)).not.toThrow();
    expect(() => validateDuration(Infinity)).not.toThrow();
    expect(validateDuration(NaN)).toBe(false);
    expect(validateDuration(Infinity)).toBe(false);
  });

  it("Happy path: getRemainingSeconds returns correct value mid-pause", () => {
    // Arrange — paused 90 s ago, 5-min window → 210 s remain
    const pausedAt = ninetySecondsAgo;

    // Act
    const result = getRemainingSeconds(pausedAt, 5);

    // Assert
    expect(result).toBe(210);
  });

  it("Edge case: getRemainingSeconds returns 0 at exact expiry", () => {
    // Arrange — paused exactly 5 min ago
    const pausedAt = fiveMinutesAgo;

    // Act
    const result = getRemainingSeconds(pausedAt, 5);

    // Assert
    expect(result).toBe(0);
  });

  it("Edge case: getRemainingSeconds does not return negative values", () => {
    // Arrange — paused 10 min ago but only 5-min window
    const tenMinutesAgo = new Date(now.getTime() - 10 * 60_000);

    // Act
    const result = getRemainingSeconds(tenMinutesAgo, 5);

    // Assert
    expect(result).toBeGreaterThanOrEqual(0);
    expect(result).toBe(0);
  });
});

// ─── AC3: formatCountdown & getRemainingSeconds edge cases ────────────────────

describe("AC3: formatCountdown and countdown-to-zero behaviour", () => {
  it("Happy path: formats seconds to MM:SS correctly", () => {
    // Arrange
    const cases: [number, string][] = [
      [272, "4:32"],
      [60, "1:00"],
      [0, "0:00"],
      [9, "0:09"],
      [3599, "59:59"],
    ];

    cases.forEach(([input, expected]) => {
      // Act
      const result = formatCountdown(input);

      // Assert
      expect(result).toBe(expected);
    });
  });

  it("Edge case: formatCountdown(0) returns '0:00'", () => {
    // Arrange
    const seconds = 0;

    // Act
    const result = formatCountdown(seconds);

    // Assert
    expect(result).toBe("0:00");
  });

  it("Negative test: negative input is clamped to '0:00'", () => {
    // Arrange
    const seconds = -30;

    // Act
    const result = formatCountdown(seconds);

    // Assert
    expect(result).toBe("0:00");
  });

  it("No crash: does not throw on empty / invalid input", () => {
    // Arrange / Act / Assert
    expect(() => formatCountdown(0)).not.toThrow();
    expect(() => formatCountdown(-1)).not.toThrow();
  });

  it("getRemainingSeconds reaches 0 when pause duration elapses", () => {
    // Arrange — pause started 5 min ago with exactly 5-min window
    const pausedAt = fiveMinutesAgo;

    // Act
    const remaining = getRemainingSeconds(pausedAt, 5);

    // Assert — should be at or below zero (clamped to 0)
    expect(remaining).toBe(0);
  });

  it("formatCountdown: single-digit seconds are zero-padded", () => {
    // Arrange
    const seconds = 65; // → "1:05"

    // Act
    const result = formatCountdown(seconds);

    // Assert
    expect(result).toBe("1:05");
  });
});
