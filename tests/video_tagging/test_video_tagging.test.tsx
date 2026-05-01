import { describe, it, expect, beforeEach } from "vitest";
import {
  isValidLabel,
  filterByLabel,
  filterByTagged,
  buildTagSummary,
  sortClipsByDate,
  validateClipForTag,
  VideoClip,
  TagSummary,
} from "./feature_files/VideoTagging";

// ─── SHARED TEST DATA ─────────────────────────────────────────────────────────

let clips: VideoClip[];

beforeEach(() => {
  clips = [
    {
      id: "clip-1",
      cameraId: "cam-01",
      cameraName: "Library Cam A",
      durationSeconds: 120,
      timestamp: "2026-05-01T08:00:00.000Z",
      tagged: false,
      label: null,
    },
    {
      id: "clip-2",
      cameraId: "cam-02",
      cameraName: "Corridor Cam B",
      durationSeconds: 45,
      timestamp: "2026-05-01T09:30:00.000Z",
      tagged: true,
      label: "fight",
    },
    {
      id: "clip-3",
      cameraId: "cam-03",
      cameraName: "Canteen Cam C",
      durationSeconds: 90,
      timestamp: "2026-05-01T11:00:00.000Z",
      tagged: true,
      label: "smoking",
    },
    {
      id: "clip-4",
      cameraId: "cam-04",
      cameraName: "Rooftop Cam D",
      durationSeconds: 30,
      timestamp: "2026-05-01T07:00:00.000Z",
      tagged: false,
      label: null,
    },
    {
      id: "clip-5",
      cameraId: "cam-05",
      cameraName: "Parking Cam E",
      durationSeconds: 60,
      timestamp: "2026-05-01T13:00:00.000Z",
      tagged: true,
      label: "phone_usage",
    },
  ];
});

// ─── AC1: isValidLabel & validateClipForTag ───────────────────────────────────

describe("AC1: isValidLabel and validateClipForTag", () => {
  it("Happy path: all valid labels are accepted", () => {
    // Arrange
    const validLabels = ["fight", "smoking", "aggression", "phone_usage", "sleeping"];

    // Act & Assert
    validLabels.forEach((lbl) => {
      expect(isValidLabel(lbl)).toBe(true);
    });
  });

  it("Negative test: unknown label returns false", () => {
    // Arrange
    const unknownLabel = "dancing";

    // Act
    const result = isValidLabel(unknownLabel);

    // Assert
    expect(result).toBe(false);
  });

  it("Edge case: empty string is not a valid label", () => {
    // Arrange
    const empty = "";

    // Act
    const result = isValidLabel(empty);

    // Assert
    expect(result).toBe(false);
  });

  it("No crash: does not throw on arbitrary string input", () => {
    // Arrange / Act / Assert
    expect(() => isValidLabel("")).not.toThrow();
    expect(() => isValidLabel("FIGHT")).not.toThrow(); // case-sensitive
    expect(isValidLabel("FIGHT")).toBe(false);
  });

  it("Happy path: validateClipForTag returns valid for an untagged clip with valid label", () => {
    // Arrange
    const clip = clips[0]; // untagged, label null

    // Act
    const result = validateClipForTag(clip, "fight");

    // Assert
    expect(result.valid).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it("Negative test: validateClipForTag fails when clip already tagged with same label", () => {
    // Arrange
    const alreadyTagged = clips[1]; // tagged = true, label = "fight"

    // Act
    const result = validateClipForTag(alreadyTagged, "fight");

    // Assert
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("fight");
  });

  it("Negative test: validateClipForTag fails when label is invalid", () => {
    // Arrange
    const clip = clips[0];
    const badLabel = "vandalism";

    // Act
    const result = validateClipForTag(clip, badLabel);

    // Assert
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("vandalism");
  });

  it("Edge case: re-tagging with a different valid label is allowed", () => {
    // Arrange
    const taggedWithFight = clips[1]; // currently "fight"

    // Act — try tagging with "smoking" instead
    const result = validateClipForTag(taggedWithFight, "smoking");

    // Assert
    expect(result.valid).toBe(true);
  });
});

// ─── AC2: filterByTagged — tagged storage / retrieval ────────────────────────

describe("AC2: filterByTagged — tagged clip storage and retrieval", () => {
  it("Happy path: filterByTagged(true) returns only tagged clips", () => {
    // Arrange — clips 2, 3, 5 are tagged

    // Act
    const result = filterByTagged(clips, true);

    // Assert
    expect(result.every((c) => c.tagged)).toBe(true);
    expect(result.length).toBe(3);
    expect(result.map((c) => c.id)).toEqual(
      expect.arrayContaining(["clip-2", "clip-3", "clip-5"])
    );
  });

  it("Happy path: filterByTagged(false) returns only untagged clips", () => {
    // Arrange — clips 1, 4 are untagged

    // Act
    const result = filterByTagged(clips, false);

    // Assert
    expect(result.every((c) => !c.tagged)).toBe(true);
    expect(result.length).toBe(2);
  });

  it("Edge case: empty clips list returns empty for both tagged and untagged", () => {
    // Arrange
    const empty: VideoClip[] = [];

    // Act
    const tagged = filterByTagged(empty, true);
    const untagged = filterByTagged(empty, false);

    // Assert
    expect(tagged).toEqual([]);
    expect(untagged).toEqual([]);
  });

  it("No crash: does not throw on empty clips", () => {
    // Arrange / Act / Assert
    expect(() => filterByTagged([], true)).not.toThrow();
    expect(() => filterByTagged([], false)).not.toThrow();
  });
});

// ─── AC3: filterByLabel, buildTagSummary, sortClipsByDate ────────────────────

describe("AC3: filterByLabel, buildTagSummary, and sortClipsByDate", () => {
  it("Happy path: filterByLabel 'all' returns every clip", () => {
    // Arrange / Act
    const result = filterByLabel(clips, "all");

    // Assert
    expect(result.length).toBe(clips.length);
  });

  it("Happy path: filterByLabel 'fight' returns only fight-labelled clips", () => {
    // Arrange / Act
    const result = filterByLabel(clips, "fight");

    // Assert
    expect(result.every((c) => c.label === "fight")).toBe(true);
    expect(result.length).toBe(1);
    expect(result[0].id).toBe("clip-2");
  });

  it("Edge case: filterByLabel with 0 matching clips returns empty array", () => {
    // Arrange — no clip has label "sleeping"

    // Act
    const result = filterByLabel(clips, "sleeping");

    // Assert
    expect(result).toEqual([]);
  });

  it("Negative test: filterByLabel with unknown label returns empty", () => {
    // Arrange
    const unknown = "vandalism";

    // Act
    const result = filterByLabel(clips, unknown);

    // Assert
    expect(result).toEqual([]);
  });

  it("No crash: filterByLabel does not throw on empty clips", () => {
    // Arrange / Act / Assert
    expect(() => filterByLabel([], "fight")).not.toThrow();
    expect(() => filterByLabel([], "all")).not.toThrow();
  });

  it("Happy path: buildTagSummary returns correct total, tagged, untagged", () => {
    // Arrange — 5 clips total, 3 tagged, 2 untagged

    // Act
    const summary: TagSummary = buildTagSummary(clips);

    // Assert
    expect(summary.total).toBe(5);
    expect(summary.tagged).toBe(3);
    expect(summary.untagged).toBe(2);
  });

  it("Happy path: buildTagSummary counts labels correctly in byLabel", () => {
    // Arrange / Act
    const summary = buildTagSummary(clips);

    // Assert — fight×1, smoking×1, phone_usage×1
    expect(summary.byLabel["fight"]).toBe(1);
    expect(summary.byLabel["smoking"]).toBe(1);
    expect(summary.byLabel["phone_usage"]).toBe(1);
  });

  it("Edge case: buildTagSummary on empty clips returns all zeros", () => {
    // Arrange
    const empty: VideoClip[] = [];

    // Act
    const summary = buildTagSummary(empty);

    // Assert
    expect(summary.total).toBe(0);
    expect(summary.tagged).toBe(0);
    expect(summary.untagged).toBe(0);
    expect(summary.byLabel).toEqual({});
  });

  it("Happy path: sortClipsByDate desc places newest clip first", () => {
    // Arrange — clip-5 at 13:00 is newest

    // Act
    const result = sortClipsByDate(clips, "desc");

    // Assert
    expect(result[0].id).toBe("clip-5");
  });

  it("Happy path: sortClipsByDate asc places oldest clip first", () => {
    // Arrange — clip-4 at 07:00 is oldest

    // Act
    const result = sortClipsByDate(clips, "asc");

    // Assert
    expect(result[0].id).toBe("clip-4");
  });

  it("No crash: sortClipsByDate does not mutate original array", () => {
    // Arrange
    const original = [...clips];

    // Act
    sortClipsByDate(clips, "desc");

    // Assert
    expect(clips.map((c) => c.id)).toEqual(original.map((c) => c.id));
  });
});
