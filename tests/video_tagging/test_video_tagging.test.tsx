/**
 * ====================================================================
 * Video Tagging — Unit Tests
 * Exactly 4 tests per function: Happy path / Edge case / Negative / No crash
 * ====================================================================
 */

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

let clips: VideoClip[];

beforeEach(() => {
  clips = [
    { id: "clip-1", cameraId: "cam-01", cameraName: "Library Cam A",  durationSeconds: 120, timestamp: "2026-05-01T08:00:00.000Z", tagged: false, label: null },
    { id: "clip-2", cameraId: "cam-02", cameraName: "Corridor Cam B", durationSeconds: 45,  timestamp: "2026-05-01T09:30:00.000Z", tagged: true,  label: "fight" },
    { id: "clip-3", cameraId: "cam-03", cameraName: "Canteen Cam C",  durationSeconds: 90,  timestamp: "2026-05-01T11:00:00.000Z", tagged: true,  label: "smoking" },
    { id: "clip-4", cameraId: "cam-04", cameraName: "Rooftop Cam D",  durationSeconds: 30,  timestamp: "2026-05-01T07:00:00.000Z", tagged: false, label: null },
    { id: "clip-5", cameraId: "cam-05", cameraName: "Parking Cam E",  durationSeconds: 60,  timestamp: "2026-05-01T13:00:00.000Z", tagged: true,  label: "phone_usage" },
  ];
});

// ─── AC1: isValidLabel and validateClipForTag ─────────────────────────────────

describe("AC1: isValidLabel and validateClipForTag", () => {
  it("Happy path: all valid labels accepted; untagged clip with valid label passes validation", () => {
    ["fight", "smoking", "aggression", "phone_usage", "sleeping"].forEach((lbl) => {
      expect(isValidLabel(lbl)).toBe(true);
    });
    const result = validateClipForTag(clips[0], "fight"); // untagged clip
    expect(result.valid).toBe(true);
  });

  it("Edge case: empty string is not valid; re-tagging with a different valid label is allowed", () => {
    expect(isValidLabel("")).toBe(false);
    expect(validateClipForTag(clips[1], "smoking").valid).toBe(true); // clips[1] tagged with "fight"
  });

  it("Negative test: unknown label returns false; already-tagged with same label fails validation", () => {
    expect(isValidLabel("dancing")).toBe(false);
    const result = validateClipForTag(clips[1], "fight"); // already tagged with "fight"
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("fight");
  });

  it("No crash: arbitrary strings and invalid labels do not throw", () => {
    expect(() => isValidLabel("")).not.toThrow();
    expect(() => isValidLabel("FIGHT")).not.toThrow();
    expect(isValidLabel("FIGHT")).toBe(false);
  });
});

// ─── AC2: filterByTagged ──────────────────────────────────────────────────────

describe("AC2: filterByTagged — tagged clip storage and retrieval", () => {
  it("Happy path: filterByTagged(true) returns only tagged clips; filterByTagged(false) returns untagged", () => {
    const tagged = filterByTagged(clips, true);
    expect(tagged.every((c) => c.tagged)).toBe(true);
    expect(tagged.length).toBe(3);
    const untagged = filterByTagged(clips, false);
    expect(untagged.every((c) => !c.tagged)).toBe(true);
    expect(untagged.length).toBe(2);
  });

  it("Edge case: empty clips list returns empty for both tagged and untagged", () => {
    expect(filterByTagged([], true)).toEqual([]);
    expect(filterByTagged([], false)).toEqual([]);
  });

  it("Negative test: requesting tagged clips from a list of all-untagged returns empty", () => {
    const allUntagged = clips.map((c) => ({ ...c, tagged: false, label: null }));
    expect(filterByTagged(allUntagged, true)).toEqual([]);
  });

  it("No crash: does not throw on empty clips", () => {
    expect(() => filterByTagged([], true)).not.toThrow();
    expect(() => filterByTagged([], false)).not.toThrow();
  });
});

// ─── AC3: filterByLabel, buildTagSummary, and sortClipsByDate ────────────────

describe("AC3: filterByLabel, buildTagSummary, and sortClipsByDate", () => {
  it("Happy path: 'all' returns all clips; buildTagSummary correct; sort desc newest first", () => {
    expect(filterByLabel(clips, "all").length).toBe(clips.length);
    const summary: TagSummary = buildTagSummary(clips);
    expect(summary.total).toBe(5);
    expect(summary.tagged).toBe(3);
    expect(summary.untagged).toBe(2);
    expect(sortClipsByDate(clips, "desc")[0].id).toBe("clip-5");
  });

  it("Edge case: filterByLabel with 0 matching clips returns empty; empty clips gives all-zero summary", () => {
    expect(filterByLabel(clips, "sleeping")).toEqual([]);
    const emptySummary = buildTagSummary([]);
    expect(emptySummary.total).toBe(0);
    expect(emptySummary.byLabel).toEqual({});
  });

  it("Negative test: filterByLabel with unknown label returns empty; sort asc puts oldest first", () => {
    expect(filterByLabel(clips, "vandalism")).toEqual([]);
    expect(sortClipsByDate(clips, "asc")[0].id).toBe("clip-4");
  });

  it("No crash: filterByLabel and sortClipsByDate do not mutate original and don't throw on empty", () => {
    const original = [...clips];
    sortClipsByDate(clips, "desc");
    expect(clips.map((c) => c.id)).toEqual(original.map((c) => c.id));
    expect(() => filterByLabel([], "fight")).not.toThrow();
    expect(() => filterByLabel([], "all")).not.toThrow();
  });
});
