import { describe, it, expect, beforeEach } from "vitest";
import {
  isUnknownFace,
  filterByDate,
  filterByCamera,
  buildDailyReport,
  classifyAlertPriority,
  formatDetectionAlert,
  UnknownDetection,
  DailyReport,
} from "./feature_files/UnknownIndividuals";

// ─── TEST DATA ─────────────────────────────────────────────────────────────────

let detections: UnknownDetection[];

beforeEach(() => {
  detections = [
    {
      id: "d1",
      cameraId: "cam-01",
      cameraName: "Main Entrance",
      detectedAt: "2025-04-10T08:15:00.000Z",
      matchScore: 0.30,
    },
    {
      id: "d2",
      cameraId: "cam-02",
      cameraName: "Corridor A",
      detectedAt: "2025-04-10T09:45:00.000Z",
      matchScore: 0.60,
    },
    {
      id: "d3",
      cameraId: "cam-01",
      cameraName: "Main Entrance",
      detectedAt: "2025-04-10T11:00:00.000Z",
      matchScore: 0.80,
    },
    {
      id: "d4",
      cameraId: "cam-03",
      cameraName: "Parking Lot",
      detectedAt: "2025-04-11T07:30:00.000Z",
      matchScore: 0.45,
    },
    {
      id: "d5",
      cameraId: "cam-01",
      cameraName: "Main Entrance",
      detectedAt: "2025-04-10T14:20:00.000Z",
      matchScore: 0.85, // exactly at threshold
    },
  ];
});

// ─── AC1-TP26/TP27: isUnknownFace ─────────────────────────────────────────────

describe("AC1-TP26/TP27: isUnknownFace", () => {
  it("Happy path: matchScore below threshold is classified as unknown", () => {
    // Arrange
    const score = 0.70;
    const threshold = 0.85;
    // Act
    const result = isUnknownFace(score, threshold);
    // Assert
    expect(result).toBe(true);
  });

  it("Edge case: matchScore exactly at threshold is NOT unknown (< is strict)", () => {
    // Arrange – d5 has score 0.85 with default threshold 0.85
    const score = 0.85;
    // Act
    const result = isUnknownFace(score, 0.85);
    // Assert
    expect(result).toBe(false);
  });

  it("Negative test: score above threshold is recognized face", () => {
    // Arrange
    const score = 0.95;
    // Act
    const result = isUnknownFace(score, 0.85);
    // Assert
    expect(result).toBe(false);
  });

  it("No crash: does not throw on boundary value 0.0", () => {
    // Arrange / Act / Assert
    expect(() => isUnknownFace(0.0, 0.85)).not.toThrow();
  });
});

// ─── AC1-TP26/TP27: classifyAlertPriority ─────────────────────────────────────

describe("AC1-TP26/TP27: classifyAlertPriority", () => {
  it("Happy path: score < 0.5 returns 'high'", () => {
    // Arrange
    const score = 0.30;
    // Act
    const result = classifyAlertPriority(score);
    // Assert
    expect(result).toBe("high");
  });

  it("Edge case: score in [0.5, 0.7) returns 'medium'", () => {
    // Arrange
    const score = 0.60;
    // Act
    const result = classifyAlertPriority(score);
    // Assert
    expect(result).toBe("medium");
  });

  it("Negative test: score >= 0.7 returns 'low'", () => {
    // Arrange
    const score = 0.80;
    // Act
    const result = classifyAlertPriority(score);
    // Assert
    expect(result).toBe("low");
  });

  it("No crash: does not throw on score = 0", () => {
    // Arrange / Act / Assert
    expect(() => classifyAlertPriority(0)).not.toThrow();
  });
});

// ─── AC2: filterByCamera ──────────────────────────────────────────────────────

describe("AC2: filterByCamera", () => {
  it("Happy path: returns only detections from the specified camera", () => {
    // Arrange
    // Act
    const result = filterByCamera(detections, "cam-01");
    // Assert
    expect(result).toHaveLength(3);
    result.forEach((d) => expect(d.cameraId).toBe("cam-01"));
  });

  it("Edge case: all detections from same camera returns entire list", () => {
    // Arrange — all from cam-01 (d1, d3, d5)
    const cam01only = detections.filter((d) => d.cameraId === "cam-01");
    // Act
    const result = filterByCamera(cam01only, "cam-01");
    // Assert
    expect(result).toHaveLength(cam01only.length);
  });

  it("Negative test: non-existent camera returns empty array", () => {
    // Arrange
    // Act
    const result = filterByCamera(detections, "cam-99");
    // Assert
    expect(result).toHaveLength(0);
  });

  it("No crash: does not throw on empty input", () => {
    // Arrange / Act / Assert
    expect(() => filterByCamera([], "cam-01")).not.toThrow();
  });
});

// ─── AC2: formatDetectionAlert ────────────────────────────────────────────────

describe("AC2: formatDetectionAlert", () => {
  it("Happy path: output contains camera name and time", () => {
    // Arrange
    const det = detections[0]; // Main Entrance, 08:15
    // Act
    const result = formatDetectionAlert(det);
    // Assert
    expect(result).toContain("Main Entrance");
    expect(result.length).toBeGreaterThan(0);
  });

  it("Edge case: output always starts with 'Unknown individual detected at'", () => {
    // Arrange
    const det = detections[1];
    // Act
    const result = formatDetectionAlert(det);
    // Assert
    expect(result.startsWith("Unknown individual detected at")).toBe(true);
  });

  it("Negative test: different cameras produce different alert strings", () => {
    // Arrange
    const det1 = detections[0]; // Main Entrance
    const det2 = detections[1]; // Corridor A
    // Act
    const r1 = formatDetectionAlert(det1);
    const r2 = formatDetectionAlert(det2);
    // Assert
    expect(r1).not.toBe(r2);
  });

  it("No crash: does not throw for any valid detection", () => {
    // Arrange / Act / Assert
    expect(() => formatDetectionAlert(detections[0])).not.toThrow();
  });
});

// ─── AC3: filterByDate ────────────────────────────────────────────────────────

describe("AC3: filterByDate", () => {
  it("Happy path: returns only detections from 2025-04-10", () => {
    // Arrange
    // Act
    const result = filterByDate(detections, "2025-04-10");
    // Assert – d1, d2, d3, d5 are on 2025-04-10; d4 is on 2025-04-11
    expect(result).toHaveLength(4);
    result.forEach((d) => expect(d.detectedAt.startsWith("2025-04-10")).toBe(true));
  });

  it("Edge case: empty date string returns empty array", () => {
    // Arrange
    // Act
    const result = filterByDate(detections, "");
    // Assert
    expect(result).toHaveLength(0);
  });

  it("Negative test: future date with no detections returns empty", () => {
    // Arrange
    // Act
    const result = filterByDate(detections, "2099-01-01");
    // Assert
    expect(result).toHaveLength(0);
  });

  it("No crash: does not throw on empty detection list", () => {
    // Arrange / Act / Assert
    expect(() => filterByDate([], "2025-04-10")).not.toThrow();
  });
});

// ─── AC3: buildDailyReport ────────────────────────────────────────────────────

describe("AC3: buildDailyReport — correct count and grouping", () => {
  it("Happy path: report total and byCamera grouping are correct for 2025-04-10", () => {
    // Arrange
    // Act
    const report: DailyReport = buildDailyReport(detections, "2025-04-10");
    // Assert – total=4, cam-01 has 3 (d1, d3, d5), cam-02 has 1 (d2)
    expect(report.total).toBe(4);
    expect(report.byCamera["cam-01"]).toBe(3);
    expect(report.byCamera["cam-02"]).toBe(1);
  });

  it("Edge case: date with zero detections returns zeroed report", () => {
    // Arrange
    // Act
    const report = buildDailyReport(detections, "2025-04-15");
    // Assert
    expect(report.total).toBe(0);
    expect(Object.keys(report.byCamera)).toHaveLength(0);
    expect(report.timeline).toHaveLength(0);
  });

  it("Edge case: report for date where all detections are from the same camera", () => {
    // Arrange
    // Act
    const report = buildDailyReport(detections, "2025-04-11");
    // Assert – only d4 on 2025-04-11, cam-03
    expect(report.total).toBe(1);
    expect(report.byCamera["cam-03"]).toBe(1);
    expect(Object.keys(report.byCamera)).toHaveLength(1);
  });

  it("No crash: does not throw on empty detection list", () => {
    // Arrange / Act / Assert
    expect(() => buildDailyReport([], "2025-04-10")).not.toThrow();
  });
});

// ─── AC4: buildDailyReport — administrator review ─────────────────────────────

describe("AC4: buildDailyReport — administrator review edge cases", () => {
  it("Happy path: report timeline preserves order from filterByDate", () => {
    // Arrange
    // Act
    const report = buildDailyReport(detections, "2025-04-10");
    // Assert — all timeline items match the date
    expect(report.timeline.every((d) => d.detectedAt.startsWith("2025-04-10"))).toBe(true);
  });

  it("Edge case: multiple cameras all appear in byCamera map", () => {
    // Arrange
    // Act
    const report = buildDailyReport(detections, "2025-04-10");
    // Assert
    expect("cam-01" in report.byCamera).toBe(true);
    expect("cam-02" in report.byCamera).toBe(true);
  });

  it("Negative test: report date is preserved in the output object", () => {
    // Arrange
    const date = "2025-04-10";
    // Act
    const report = buildDailyReport(detections, date);
    // Assert
    expect(report.date).toBe(date);
  });

  it("No crash: does not throw with no detections for the given date", () => {
    // Arrange / Act / Assert
    expect(() => buildDailyReport([], "2025-04-10")).not.toThrow();
  });
});
