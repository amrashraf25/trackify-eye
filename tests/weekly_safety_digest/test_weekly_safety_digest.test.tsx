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

// ─── Shared test data ─────────────────────────────────────────────────────────

let incidents: Incident[];

// Week boundaries used in most tests: Mon 2024-01-08 00:00:00 → Sun 2024-01-14 23:59:59
const WEEK_START = new Date("2024-01-08T00:00:00");
const WEEK_END = new Date("2024-01-14T23:59:59");

beforeEach(() => {
  incidents = [
    // Inside the test week
    {
      id: "inc1",
      type: "fighting",
      location: "Corridor A",
      timestamp: "2024-01-08T09:00:00",
      reportedBy: "Camera 1",
      severity: "high",
    },
    {
      id: "inc2",
      type: "smoking",
      location: "Courtyard",
      timestamp: "2024-01-10T11:30:00",
      reportedBy: "Guard",
      severity: "medium",
    },
    {
      id: "inc3",
      type: "fighting",
      location: "Corridor A",
      timestamp: "2024-01-11T14:00:00",
      reportedBy: "Camera 2",
      severity: "high",
    },
    {
      id: "inc4",
      type: "phone_use",
      location: "Room 101",
      timestamp: "2024-01-12T08:45:00",
      reportedBy: "Camera 3",
      severity: "low",
    },
    {
      id: "inc5",
      type: "fighting",
      location: "Courtyard",
      timestamp: "2024-01-14T16:00:00",
      reportedBy: "Guard",
      severity: "high",
    },
    // Outside the test week
    {
      id: "inc6",
      type: "smoking",
      location: "Room 101",
      timestamp: "2024-01-07T23:59:59", // day before week start
      reportedBy: "Guard",
      severity: "low",
    },
    {
      id: "inc7",
      type: "vandalism",
      location: "Parking Lot",
      timestamp: "2024-01-15T00:00:01", // day after week end
      reportedBy: "Camera 4",
      severity: "medium",
    },
  ];
});

// ─── AC1: Week Filter (TP-15) ─────────────────────────────────────────────────

describe("AC1: Week filtering", () => {
  it("Happy path: returns only incidents within the given week", () => {
    // Arrange
    const input = incidents;

    // Act
    const result = filterByWeek(input, WEEK_START, WEEK_END);

    // Assert
    expect(result.length).toBe(5);
    result.forEach((inc) => {
      const t = new Date(inc.timestamp).getTime();
      expect(t).toBeGreaterThanOrEqual(WEEK_START.getTime());
      expect(t).toBeLessThanOrEqual(WEEK_END.getTime());
    });
  });

  it("Edge case: incident exactly on weekStart boundary is included", () => {
    // Arrange
    const boundary: Incident[] = [
      {
        id: "b1",
        type: "fighting",
        location: "Hall A",
        timestamp: WEEK_START.toISOString(),
        reportedBy: "Camera",
        severity: "low",
      },
    ];

    // Act
    const result = filterByWeek(boundary, WEEK_START, WEEK_END);

    // Assert
    expect(result.length).toBe(1);
  });

  it("Edge case: incident exactly on weekEnd boundary is included", () => {
    // Arrange
    const boundary: Incident[] = [
      {
        id: "b2",
        type: "smoking",
        location: "Rooftop",
        timestamp: WEEK_END.toISOString(),
        reportedBy: "Guard",
        severity: "medium",
      },
    ];

    // Act
    const result = filterByWeek(boundary, WEEK_START, WEEK_END);

    // Assert
    expect(result.length).toBe(1);
  });

  it("Negative test: incidents outside the week are excluded", () => {
    // Arrange: only the two out-of-week incidents
    const outside = [incidents[5], incidents[6]];

    // Act
    const result = filterByWeek(outside, WEEK_START, WEEK_END);

    // Assert
    expect(result.length).toBe(0);
  });

  it("Edge case: empty incidents array returns empty", () => {
    // Arrange
    const empty: Incident[] = [];

    // Act
    const result = filterByWeek(empty, WEEK_START, WEEK_END);

    // Assert
    expect(result).toEqual([]);
  });

  it("No crash: does not throw on empty input", () => {
    expect(() => filterByWeek([], WEEK_START, WEEK_END)).not.toThrow();
  });

  it("Single incident inside the week is returned", () => {
    // Arrange
    const single: Incident[] = [incidents[0]];

    // Act
    const result = filterByWeek(single, WEEK_START, WEEK_END);

    // Assert
    expect(result.length).toBe(1);
    expect(result[0].id).toBe("inc1");
  });
});

// ─── AC2 / AC3: Summary Stats — groupByType, groupByLocation, buildDigestSummary ──

describe("AC2/AC3: Incident grouping and digest summary", () => {
  it("Happy path: groupByType returns correct counts", () => {
    // Arrange
    const weekly = filterByWeek(incidents, WEEK_START, WEEK_END);
    // fighting: 3, smoking: 1, phone_use: 1

    // Act
    const byType = groupByType(weekly);

    // Assert
    expect(byType["fighting"]).toBe(3);
    expect(byType["smoking"]).toBe(1);
    expect(byType["phone_use"]).toBe(1);
  });

  it("Happy path: groupByLocation returns correct counts", () => {
    // Arrange
    const weekly = filterByWeek(incidents, WEEK_START, WEEK_END);
    // Corridor A: 2, Courtyard: 2, Room 101: 1

    // Act
    const byLocation = groupByLocation(weekly);

    // Assert
    expect(byLocation["Corridor A"]).toBe(2);
    expect(byLocation["Courtyard"]).toBe(2);
    expect(byLocation["Room 101"]).toBe(1);
  });

  it("Edge case: all same incident type maps to one key", () => {
    // Arrange
    const allFighting: Incident[] = incidents
      .slice(0, 3)
      .map((i) => ({ ...i, type: "fighting" }));

    // Act
    const byType = groupByType(allFighting);

    // Assert
    expect(Object.keys(byType).length).toBe(1);
    expect(byType["fighting"]).toBe(3);
  });

  it("Edge case: all different types produces one entry per incident", () => {
    // Arrange
    const allDiff: Incident[] = [
      { ...incidents[0], type: "fighting" },
      { ...incidents[1], type: "smoking" },
      { ...incidents[2], type: "vandalism" },
    ];

    // Act
    const byType = groupByType(allDiff);

    // Assert
    expect(Object.keys(byType).length).toBe(3);
    Object.values(byType).forEach((c) => expect(c).toBe(1));
  });

  it("Negative test: empty incidents produces empty objects", () => {
    // Arrange + Act
    const byType = groupByType([]);
    const byLocation = groupByLocation([]);

    // Assert
    expect(byType).toEqual({});
    expect(byLocation).toEqual({});
  });

  it("No crash: groupByType does not throw on empty array", () => {
    expect(() => groupByType([])).not.toThrow();
  });

  it("buildDigestSummary: returns correct topType and topLocation", () => {
    // Arrange
    const weekly = filterByWeek(incidents, WEEK_START, WEEK_END);
    // top type = fighting (3), top location = tie: Corridor A / Courtyard (2 each — first in sort wins)

    // Act
    const summary = buildDigestSummary(weekly);

    // Assert
    expect(summary.topType).toBe("fighting");
    expect(summary.totalIncidents).toBe(5);
    expect(["Corridor A", "Courtyard"]).toContain(summary.topLocation);
  });

  it("buildDigestSummary: empty week produces all-zero/empty summary", () => {
    // Arrange + Act
    const summary = buildDigestSummary([]);

    // Assert
    expect(summary.totalIncidents).toBe(0);
    expect(summary.byType).toEqual({});
    expect(summary.byLocation).toEqual({});
    expect(summary.topType).toBe("");
    expect(summary.topLocation).toBe("");
  });

  it("buildDigestSummary: single incident summary is correct", () => {
    // Arrange
    const single: Incident[] = [incidents[0]]; // fighting, Corridor A

    // Act
    const summary = buildDigestSummary(single);

    // Assert
    expect(summary.totalIncidents).toBe(1);
    expect(summary.topType).toBe("fighting");
    expect(summary.topLocation).toBe("Corridor A");
    expect(summary.byType["fighting"]).toBe(1);
    expect(summary.byLocation["Corridor A"]).toBe(1);
  });

  it("No crash: buildDigestSummary does not throw on empty array", () => {
    expect(() => buildDigestSummary([])).not.toThrow();
  });
});

// ─── AC4: Export — formatDigestCsv ────────────────────────────────────────────

describe("AC4: Export digest as CSV", () => {
  it("Happy path: CSV contains the week label on the first line", () => {
    // Arrange
    const weekly = filterByWeek(incidents, WEEK_START, WEEK_END);
    const summary = buildDigestSummary(weekly);
    const weekLabel = "2024-01-08_2024-01-14";

    // Act
    const csv = formatDigestCsv(summary, weekLabel);

    // Assert
    const firstLine = csv.split("\n")[0];
    expect(firstLine).toBe(`Week,${weekLabel}`);
  });

  it("Happy path: CSV contains correct total incident count", () => {
    // Arrange
    const weekly = filterByWeek(incidents, WEEK_START, WEEK_END);
    const summary = buildDigestSummary(weekly);

    // Act
    const csv = formatDigestCsv(summary, "2024-01-08_2024-01-14");

    // Assert
    expect(csv).toContain(`Total Incidents,${weekly.length}`);
  });

  it("Happy path: CSV contains each incident type as a row", () => {
    // Arrange
    const weekly = filterByWeek(incidents, WEEK_START, WEEK_END);
    const summary = buildDigestSummary(weekly);

    // Act
    const csv = formatDigestCsv(summary, "2024-01-08_2024-01-14");

    // Assert
    expect(csv).toContain("fighting,3");
    expect(csv).toContain("smoking,1");
    expect(csv).toContain("phone_use,1");
  });

  it("Happy path: CSV contains each location as a row", () => {
    // Arrange
    const weekly = filterByWeek(incidents, WEEK_START, WEEK_END);
    const summary = buildDigestSummary(weekly);

    // Act
    const csv = formatDigestCsv(summary, "2024-01-08_2024-01-14");

    // Assert
    expect(csv).toContain("Corridor A,2");
    expect(csv).toContain("Courtyard,2");
    expect(csv).toContain("Room 101,1");
  });

  it("Edge case: empty summary produces CSV with zero total and no type/location rows", () => {
    // Arrange
    const emptySummary: DigestSummary = {
      totalIncidents: 0,
      byType: {},
      byLocation: {},
      topType: "",
      topLocation: "",
    };

    // Act
    const csv = formatDigestCsv(emptySummary, "2024-01-08_2024-01-14");

    // Assert
    expect(csv).toContain("Total Incidents,0");
    // After the "Incident Type,Count" header there should be no type rows
    const lines = csv.split("\n");
    const typeHeaderIdx = lines.findIndex((l) => l === "Incident Type,Count");
    expect(typeHeaderIdx).toBeGreaterThan(-1);
    // Next non-empty line after header is the blank separator or Location section
    const lineAfterTypeHeader = lines[typeHeaderIdx + 1];
    expect(lineAfterTypeHeader).toBe(""); // blank line separating sections
  });

  it("Negative test: CSV output does not contain 'undefined' or 'null'", () => {
    // Arrange
    const weekly = filterByWeek(incidents, WEEK_START, WEEK_END);
    const summary = buildDigestSummary(weekly);

    // Act
    const csv = formatDigestCsv(summary, "2024-01-08_2024-01-14");

    // Assert
    expect(csv).not.toContain("undefined");
    expect(csv).not.toContain("null");
  });

  it("No crash: does not throw when called with an empty summary and empty label", () => {
    const emptySummary: DigestSummary = {
      totalIncidents: 0,
      byType: {},
      byLocation: {},
      topType: "",
      topLocation: "",
    };
    expect(() => formatDigestCsv(emptySummary, "")).not.toThrow();
  });

  it("CSV sections are separated by blank lines", () => {
    // Arrange
    const weekly = filterByWeek(incidents, WEEK_START, WEEK_END);
    const summary = buildDigestSummary(weekly);

    // Act
    const csv = formatDigestCsv(summary, "2024-01-08_2024-01-14");
    const lines = csv.split("\n");

    // Assert — find at least two blank lines acting as section dividers
    const blankCount = lines.filter((l) => l === "").length;
    expect(blankCount).toBeGreaterThanOrEqual(2);
  });
});
