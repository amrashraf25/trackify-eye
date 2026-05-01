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

// ─── SHARED TEST DATA ─────────────────────────────────────────────────────────

let incidents: MisconductRecord[];

beforeEach(() => {
  incidents = [
    {
      id: "1",
      behaviorType: "smoking",
      cameraId: "cam-01",
      cameraName: "Library Cam A",
      confidence: 0.92,
      timestamp: "2026-05-01T09:00:00.000Z",
      location: "Library - Floor 1",
    },
    {
      id: "2",
      behaviorType: "aggression",
      cameraId: "cam-02",
      cameraName: "Corridor Cam B",
      confidence: 0.75,
      timestamp: "2026-05-01T10:30:00.000Z",
      location: "Corridor - Block C",
    },
    {
      id: "3",
      behaviorType: "fight",
      cameraId: "cam-03",
      cameraName: "Canteen Cam C",
      confidence: 0.60,
      timestamp: "2026-05-01T11:15:00.000Z",
      location: "Canteen",
    },
    {
      id: "4",
      behaviorType: "smoking",
      cameraId: "cam-04",
      cameraName: "Rooftop Cam D",
      confidence: 0.80,
      timestamp: "2026-05-01T08:00:00.000Z",
      location: "Rooftop",
    },
    {
      id: "5",
      behaviorType: "fight",
      cameraId: "cam-05",
      cameraName: "Parking Cam E",
      confidence: 0.74,
      timestamp: "2026-05-01T12:00:00.000Z",
      location: "Parking Lot",
    },
  ];
});

// ─── AC1: formatIncidentDisplay (timestamp + location) ───────────────────────

describe("AC1: formatIncidentDisplay — timestamp and location in display", () => {
  it("Happy path: returns correct label, cameraLabel, timeLabel, and severityColor", () => {
    // Arrange
    const incident = incidents[0]; // smoking, 0.92 confidence → red severity

    // Act
    const result = formatIncidentDisplay(incident);

    // Assert
    expect(result.label).toBe("Smoking");
    expect(result.cameraLabel).toBe("Library Cam A");
    expect(result.timeLabel).toContain("2026");
    expect(result.severityColor).toBe("hsl(0 72% 51%)"); // red for ≥ 0.90
  });

  it("Edge case: unknown behavior type uses raw type string as label", () => {
    // Arrange
    const incident: MisconductRecord = {
      ...incidents[0],
      behaviorType: "vandalism",
      confidence: 0.80,
    };

    // Act
    const result = formatIncidentDisplay(incident);

    // Assert
    expect(result.label).toBe("vandalism");
    expect(result.severityColor).toBe("hsl(38 92% 50%)"); // orange for 0.75–0.89
  });

  it("Negative test: confidence below 0.75 yields yellow severity color", () => {
    // Arrange
    const incident = incidents[2]; // fight, 0.60 confidence

    // Act
    const result = formatIncidentDisplay(incident);

    // Assert
    expect(result.severityColor).toBe("hsl(48 96% 53%)"); // yellow
  });

  it("No crash: does not throw on minimal incident data", () => {
    // Arrange
    const minimal: MisconductRecord = {
      id: "x",
      behaviorType: "smoking",
      cameraId: "cam-x",
      cameraName: "",
      confidence: 0,
      timestamp: "2026-01-01T00:00:00.000Z",
      location: "",
    };

    // Act / Assert
    expect(() => formatIncidentDisplay(minimal)).not.toThrow();
  });

  it("Edge case: cameraName falls back to cameraId when empty", () => {
    // Arrange
    const incident: MisconductRecord = {
      ...incidents[0],
      cameraName: "",
      cameraId: "cam-fallback",
    };

    // Act
    const result = formatIncidentDisplay(incident);

    // Assert
    expect(result.cameraLabel).toBe("cam-fallback");
  });
});

// ─── AC2: meetsConfidenceThreshold & filterByConfidence ──────────────────────

describe("AC2: meetsConfidenceThreshold and filterByConfidence", () => {
  it("Happy path: confidence exactly at threshold returns true", () => {
    // Arrange
    const confidence = 0.75;
    const threshold = 0.75;

    // Act
    const result = meetsConfidenceThreshold(confidence, threshold);

    // Assert
    expect(result).toBe(true);
  });

  it("Edge case: confidence just below threshold (0.749) returns false", () => {
    // Arrange
    const confidence = 0.749;
    const threshold = 0.75;

    // Act
    const result = meetsConfidenceThreshold(confidence, threshold);

    // Assert
    expect(result).toBe(false);
  });

  it("Negative test: confidence 0 always fails for any positive threshold", () => {
    // Arrange
    const confidence = 0;

    // Act
    const result0_75 = meetsConfidenceThreshold(confidence, 0.75);
    const result0_1 = meetsConfidenceThreshold(confidence, 0.1);

    // Assert
    expect(result0_75).toBe(false);
    expect(result0_1).toBe(false);
  });

  it("No crash: does not throw on edge numeric inputs", () => {
    // Arrange / Act / Assert
    expect(() => meetsConfidenceThreshold(0, 0)).not.toThrow();
    expect(() => meetsConfidenceThreshold(1, 1)).not.toThrow();
  });

  it("Happy path: filterByConfidence keeps only incidents meeting threshold", () => {
    // Arrange — default threshold 0.75: incidents 1,2,4 pass; 3,5 do not
    const threshold = 0.75;

    // Act
    const result = filterByConfidence(incidents, threshold);

    // Assert
    expect(result.map((i) => i.id)).toEqual(expect.arrayContaining(["1", "2", "4"]));
    expect(result.find((i) => i.id === "3")).toBeUndefined(); // 0.60 < 0.75
    expect(result.find((i) => i.id === "5")).toBeUndefined(); // 0.74 < 0.75
  });

  it("Edge case: threshold 0 returns all incidents (every confidence ≥ 0)", () => {
    // Arrange
    const threshold = 0;

    // Act
    const result = filterByConfidence(incidents, threshold);

    // Assert
    expect(result.length).toBe(incidents.length);
  });

  it("Edge case: empty incidents list returns empty array", () => {
    // Arrange
    const empty: MisconductRecord[] = [];

    // Act
    const result = filterByConfidence(empty, 0.75);

    // Assert
    expect(result).toEqual([]);
  });
});

// ─── AC3: groupByBehaviorType, sortByTimestamp, filterByBehaviorType ─────────

describe("AC3: groupByBehaviorType, sortByTimestamp, filterByBehaviorType", () => {
  it("Happy path: groupByBehaviorType counts each type correctly", () => {
    // Arrange — incidents has: smoking×2, aggression×1, fight×2

    // Act
    const result = groupByBehaviorType(incidents);

    // Assert
    expect(result["smoking"]).toBe(2);
    expect(result["aggression"]).toBe(1);
    expect(result["fight"]).toBe(2);
  });

  it("Edge case: all same behavior type returns single-key record", () => {
    // Arrange
    const allSmoking: MisconductRecord[] = incidents.map((i) => ({
      ...i,
      behaviorType: "smoking",
    }));

    // Act
    const result = groupByBehaviorType(allSmoking);

    // Assert
    expect(Object.keys(result)).toEqual(["smoking"]);
    expect(result["smoking"]).toBe(5);
  });

  it("Edge case: empty incidents returns empty object", () => {
    // Arrange
    const empty: MisconductRecord[] = [];

    // Act
    const result = groupByBehaviorType(empty);

    // Assert
    expect(result).toEqual({});
  });

  it("Happy path: sortByTimestamp desc puts newest incident first", () => {
    // Arrange — incident 5 is at 12:00, the latest

    // Act
    const result = sortByTimestamp(incidents, "desc");

    // Assert
    expect(result[0].id).toBe("5");
  });

  it("Happy path: sortByTimestamp asc puts oldest incident first", () => {
    // Arrange — incident 4 is at 08:00, the earliest

    // Act
    const result = sortByTimestamp(incidents, "asc");

    // Assert
    expect(result[0].id).toBe("4");
  });

  it("No crash: sortByTimestamp does not mutate original array", () => {
    // Arrange
    const original = [...incidents];

    // Act
    sortByTimestamp(incidents, "desc");

    // Assert — original array unchanged
    expect(incidents.map((i) => i.id)).toEqual(original.map((i) => i.id));
  });

  it("Happy path: filterByBehaviorType 'all' returns every incident", () => {
    // Arrange / Act
    const result = filterByBehaviorType(incidents, "all");

    // Assert
    expect(result.length).toBe(incidents.length);
  });

  it("Happy path: filterByBehaviorType 'smoking' returns only smoking incidents", () => {
    // Arrange / Act
    const result = filterByBehaviorType(incidents, "smoking");

    // Assert
    expect(result.every((i) => i.behaviorType === "smoking")).toBe(true);
    expect(result.length).toBe(2);
  });

  it("Negative test: filterByBehaviorType with unknown type returns empty", () => {
    // Arrange
    const unknownType = "vandalism";

    // Act
    const result = filterByBehaviorType(incidents, unknownType);

    // Assert
    expect(result).toEqual([]);
  });

  it("No crash: filterByBehaviorType does not throw on empty incidents", () => {
    // Arrange / Act / Assert
    expect(() => filterByBehaviorType([], "smoking")).not.toThrow();
  });
});
