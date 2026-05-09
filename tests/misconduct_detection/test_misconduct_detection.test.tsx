/**
 * ====================================================================
 * Misconduct Detection — Unit Tests
 * Exactly 4 tests per function: Happy path / Edge case / Negative / No crash
 * ====================================================================
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  meetsConfidenceThreshold,
  filterByConfidence,
  filterByBehaviorType,
  formatIncidentDisplay,
  groupByBehaviorType,
  sortByTimestamp,
  MisconductRecord,
} from "./feature_files/MisconductDetection";

let incidents: MisconductRecord[];

beforeEach(() => {
  incidents = [
    { id: "1", behaviorType: "smoking",   cameraId: "cam-01", cameraName: "Library Cam A",  confidence: 0.92, timestamp: "2026-05-01T09:00:00.000Z", location: "Library - Floor 1" },
    { id: "2", behaviorType: "aggression",cameraId: "cam-02", cameraName: "Corridor Cam B", confidence: 0.75, timestamp: "2026-05-01T10:30:00.000Z", location: "Corridor - Block C" },
    { id: "3", behaviorType: "fight",     cameraId: "cam-03", cameraName: "Canteen Cam C",  confidence: 0.60, timestamp: "2026-05-01T11:15:00.000Z", location: "Canteen" },
    { id: "4", behaviorType: "smoking",   cameraId: "cam-04", cameraName: "Rooftop Cam D",  confidence: 0.80, timestamp: "2026-05-01T08:00:00.000Z", location: "Rooftop" },
    { id: "5", behaviorType: "fight",     cameraId: "cam-05", cameraName: "Parking Cam E",  confidence: 0.74, timestamp: "2026-05-01T12:00:00.000Z", location: "Parking Lot" },
  ];
});

// ─── AC1: formatIncidentDisplay ───────────────────────────────────────────────

describe("AC1: formatIncidentDisplay — timestamp and location in display", () => {
  it("Happy path: returns correct label, cameraLabel, timeLabel, and severityColor", () => {
    const result = formatIncidentDisplay(incidents[0]); // smoking, 0.92 → red
    expect(result.label).toBe("Smoking");
    expect(result.cameraLabel).toBe("Library Cam A");
    expect(result.timeLabel).toContain("2026");
    expect(result.severityColor).toBe("hsl(0 72% 51%)");
  });

  it("Edge case: empty cameraName falls back to cameraId; unknown type uses raw string", () => {
    const noName: MisconductRecord = { ...incidents[0], cameraName: "", cameraId: "cam-fallback" };
    expect(formatIncidentDisplay(noName).cameraLabel).toBe("cam-fallback");
    const unknownType: MisconductRecord = { ...incidents[0], behaviorType: "vandalism", confidence: 0.80 };
    expect(formatIncidentDisplay(unknownType).label).toBe("vandalism");
  });

  it("Negative test: confidence below 0.75 yields yellow severity color", () => {
    const result = formatIncidentDisplay(incidents[2]); // fight, 0.60
    expect(result.severityColor).toBe("hsl(48 96% 53%)");
  });

  it("No crash: minimal incident data does not throw", () => {
    const minimal: MisconductRecord = {
      id: "x", behaviorType: "smoking", cameraId: "cam-x", cameraName: "",
      confidence: 0, timestamp: "2026-01-01T00:00:00.000Z", location: "",
    };
    expect(() => formatIncidentDisplay(minimal)).not.toThrow();
  });
});

// ─── AC2: meetsConfidenceThreshold and filterByConfidence ────────────────────

describe("AC2: meetsConfidenceThreshold and filterByConfidence", () => {
  it("Happy path: threshold met → true; filterByConfidence keeps only passing incidents", () => {
    expect(meetsConfidenceThreshold(0.75, 0.75)).toBe(true);
    const result = filterByConfidence(incidents, 0.75);
    expect(result.map((i) => i.id)).toEqual(expect.arrayContaining(["1", "2", "4"]));
    expect(result.find((i) => i.id === "3")).toBeUndefined();
  });

  it("Edge case: threshold 0 returns all incidents; just below threshold returns false", () => {
    expect(filterByConfidence(incidents, 0).length).toBe(incidents.length);
    expect(meetsConfidenceThreshold(0.749, 0.75)).toBe(false);
  });

  it("Negative test: confidence 0 always fails any positive threshold", () => {
    expect(meetsConfidenceThreshold(0, 0.75)).toBe(false);
    expect(meetsConfidenceThreshold(0, 0.1)).toBe(false);
  });

  it("No crash: edge numeric inputs (0,1) do not throw; empty list returns empty", () => {
    expect(() => meetsConfidenceThreshold(0, 0)).not.toThrow();
    expect(() => meetsConfidenceThreshold(1, 1)).not.toThrow();
    expect(filterByConfidence([], 0.75)).toEqual([]);
  });
});

// ─── AC3: groupByBehaviorType, sortByTimestamp, filterByBehaviorType ─────────

describe("AC3: groupByBehaviorType, sortByTimestamp, filterByBehaviorType", () => {
  it("Happy path: group counts correct; sort desc puts newest first; filter 'all' returns all", () => {
    const groups = groupByBehaviorType(incidents);
    expect(groups["smoking"]).toBe(2);
    expect(groups["fight"]).toBe(2);
    expect(groups["aggression"]).toBe(1);
    expect(sortByTimestamp(incidents, "desc")[0].id).toBe("5");
    expect(filterByBehaviorType(incidents, "all").length).toBe(incidents.length);
  });

  it("Edge case: all same type → single key; sort asc puts oldest first", () => {
    const allSmoking = incidents.map((i) => ({ ...i, behaviorType: "smoking" }));
    expect(Object.keys(groupByBehaviorType(allSmoking))).toEqual(["smoking"]);
    expect(sortByTimestamp(incidents, "asc")[0].id).toBe("4");
  });

  it("Negative test: filterByBehaviorType with unknown type returns empty", () => {
    expect(filterByBehaviorType(incidents, "vandalism")).toEqual([]);
  });

  it("No crash: sortByTimestamp does not mutate original; empty input does not throw", () => {
    const original = [...incidents];
    sortByTimestamp(incidents, "desc");
    expect(incidents.map((i) => i.id)).toEqual(original.map((i) => i.id));
    expect(() => groupByBehaviorType([])).not.toThrow();
    expect(() => filterByBehaviorType([], "smoking")).not.toThrow();
  });
});
