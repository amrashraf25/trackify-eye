/**
 * ====================================================================
 * Weekly Safety Digest — Unit Tests
 * Exactly 4 tests per function: Happy path / Edge case / Negative / No crash
 * ====================================================================
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  filterByWeek,
  groupByType,
  groupByLocation,
  buildDigestSummary,
  formatDigestCsv,
  Incident,
  DigestSummary,
} from "./feature_files/WeeklySafetyDigest";

let incidents: Incident[];

const WEEK_START = new Date("2024-01-08T00:00:00");
const WEEK_END   = new Date("2024-01-14T23:59:59");

beforeEach(() => {
  incidents = [
    { id: "inc1", type: "fighting",  location: "Corridor A", timestamp: "2024-01-08T09:00:00", reportedBy: "Camera 1", severity: "high" },
    { id: "inc2", type: "smoking",   location: "Courtyard",  timestamp: "2024-01-10T11:30:00", reportedBy: "Guard",    severity: "medium" },
    { id: "inc3", type: "fighting",  location: "Corridor A", timestamp: "2024-01-11T14:00:00", reportedBy: "Camera 2", severity: "high" },
    { id: "inc4", type: "phone_use", location: "Room 101",   timestamp: "2024-01-12T08:45:00", reportedBy: "Camera 3", severity: "low" },
    { id: "inc5", type: "fighting",  location: "Courtyard",  timestamp: "2024-01-14T16:00:00", reportedBy: "Guard",    severity: "high" },
    // Outside the test week
    { id: "inc6", type: "smoking",   location: "Room 101",   timestamp: "2024-01-07T23:59:59", reportedBy: "Guard",    severity: "low" },
    { id: "inc7", type: "vandalism", location: "Parking Lot",timestamp: "2024-01-15T00:00:01", reportedBy: "Camera 4", severity: "medium" },
  ];
});

// ─── AC1: Week filtering ──────────────────────────────────────────────────────

describe("AC1: Week filtering", () => {
  it("Happy path: returns only incidents within the given week boundaries (inclusive)", () => {
    const result = filterByWeek(incidents, WEEK_START, WEEK_END);
    expect(result.length).toBe(5);
    result.forEach((inc) => {
      const t = new Date(inc.timestamp).getTime();
      expect(t).toBeGreaterThanOrEqual(WEEK_START.getTime());
      expect(t).toBeLessThanOrEqual(WEEK_END.getTime());
    });
  });

  it("Edge case: incidents exactly on weekStart and weekEnd boundaries are included", () => {
    const boundary: Incident[] = [
      { id: "b1", type: "fighting", location: "Hall A", timestamp: WEEK_START.toISOString(), reportedBy: "Camera", severity: "low" },
      { id: "b2", type: "smoking",  location: "Rooftop", timestamp: WEEK_END.toISOString(),  reportedBy: "Guard",  severity: "medium" },
    ];
    expect(filterByWeek(boundary, WEEK_START, WEEK_END).length).toBe(2);
  });

  it("Negative test: incidents outside the week are fully excluded", () => {
    expect(filterByWeek([incidents[5], incidents[6]], WEEK_START, WEEK_END).length).toBe(0);
  });

  it("No crash: empty input does not throw", () => {
    expect(() => filterByWeek([], WEEK_START, WEEK_END)).not.toThrow();
    expect(filterByWeek([], WEEK_START, WEEK_END)).toEqual([]);
  });
});

// ─── AC2/AC3: Incident grouping and digest summary ────────────────────────────

describe("AC2/AC3: Incident grouping and digest summary", () => {
  it("Happy path: groupByType and groupByLocation return correct counts; buildDigestSummary correct", () => {
    const weekly = filterByWeek(incidents, WEEK_START, WEEK_END);
    const byType = groupByType(weekly);
    expect(byType["fighting"]).toBe(3);
    expect(byType["smoking"]).toBe(1);
    expect(byType["phone_use"]).toBe(1);
    const byLocation = groupByLocation(weekly);
    expect(byLocation["Corridor A"]).toBe(2);
    const summary = buildDigestSummary(weekly);
    expect(summary.topType).toBe("fighting");
    expect(summary.totalIncidents).toBe(5);
  });

  it("Edge case: all same type → single key; empty produces all-zero/empty summary", () => {
    const allFighting = incidents.slice(0, 3).map((i) => ({ ...i, type: "fighting" }));
    expect(Object.keys(groupByType(allFighting))).toEqual(["fighting"]);
    const emptySummary = buildDigestSummary([]);
    expect(emptySummary.totalIncidents).toBe(0);
    expect(emptySummary.topType).toBe("");
  });

  it("Negative test: empty incidents produces empty objects for both grouping functions", () => {
    expect(groupByType([])).toEqual({});
    expect(groupByLocation([])).toEqual({});
  });

  it("No crash: groupByType and buildDigestSummary do not throw on empty array", () => {
    expect(() => groupByType([])).not.toThrow();
    expect(() => buildDigestSummary([])).not.toThrow();
  });
});

// ─── AC4: Export digest as CSV ────────────────────────────────────────────────

describe("AC4: Export digest as CSV", () => {
  it("Happy path: CSV contains week label, total count, type rows, and location rows", () => {
    const weekly = filterByWeek(incidents, WEEK_START, WEEK_END);
    const summary = buildDigestSummary(weekly);
    const weekLabel = "2024-01-08_2024-01-14";
    const csv = formatDigestCsv(summary, weekLabel);
    expect(csv.split("\n")[0]).toBe(`Week,${weekLabel}`);
    expect(csv).toContain(`Total Incidents,${weekly.length}`);
    expect(csv).toContain("fighting,3");
    expect(csv).toContain("Corridor A,2");
  });

  it("Edge case: empty summary produces CSV with zero total and blank type section", () => {
    const emptySummary: DigestSummary = { totalIncidents: 0, byType: {}, byLocation: {}, topType: "", topLocation: "" };
    const csv = formatDigestCsv(emptySummary, "2024-01-08_2024-01-14");
    expect(csv).toContain("Total Incidents,0");
    const lines = csv.split("\n");
    const typeHeaderIdx = lines.findIndex((l) => l === "Incident Type,Count");
    expect(typeHeaderIdx).toBeGreaterThan(-1);
    expect(lines[typeHeaderIdx + 1]).toBe("");
  });

  it("Negative test: CSV output does not contain 'undefined' or 'null'", () => {
    const weekly = filterByWeek(incidents, WEEK_START, WEEK_END);
    const csv = formatDigestCsv(buildDigestSummary(weekly), "2024-01-08_2024-01-14");
    expect(csv).not.toContain("undefined");
    expect(csv).not.toContain("null");
  });

  it("No crash: empty summary and empty label do not throw", () => {
    const emptySummary: DigestSummary = { totalIncidents: 0, byType: {}, byLocation: {}, topType: "", topLocation: "" };
    expect(() => formatDigestCsv(emptySummary, "")).not.toThrow();
  });
});
