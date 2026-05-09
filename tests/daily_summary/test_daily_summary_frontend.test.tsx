/**
 * ====================================================================
 * Daily Behavior Summary — Unit Tests
 * Tests pure logic functions extracted from DailySummaryCard.
 * Exactly 4 tests per function: Happy path / Edge case / Negative / No crash
 *
 *   Testing Checklist:
 *     ✅ Happy path  – normal inputs, expected behaviour
 *     ✅ Edge cases  – empty, null, zero, boundary values
 *     ✅ Negative    – invalid inputs, unknown keys
 *     ✅ No crashes  – all edge paths return safe results, no throws
 *
 * Covers:
 *   AC1 — getBehaviorLabel: human-readable label for behavior type
 *   AC2 — getSeverityColorClass: CSS class for severity level
 *   AC3 — getTopBehavior: most common behavior from by_type map
 *   AC3 — sortBehaviorsByCount: descending sort of behavior counts
 * ====================================================================
 */

import { describe, it, expect } from "vitest";
import {
  getBehaviorLabel,
  getSeverityColorClass,
  getTopBehavior,
  sortBehaviorsByCount,
} from "./feature_files/DailySummaryCard";

// ════════════════════════════════════════════════════════════════════════════
//  AC1 — getBehaviorLabel
// ════════════════════════════════════════════════════════════════════════════
describe("AC1: getBehaviorLabel — behavior type to display label", () => {
  it("Happy path: known behavior types return their correct display labels", () => {
    expect(getBehaviorLabel("phone_use")).toBe("Phone Use");
    expect(getBehaviorLabel("sleeping")).toBe("Sleeping");
    expect(getBehaviorLabel("fighting")).toBe("Fighting");
    expect(getBehaviorLabel("eating")).toBe("Eating");
  });

  it("Edge case: empty string returns empty string (underscores replaced with spaces)", () => {
    expect(getBehaviorLabel("")).toBe("");
  });

  it("Negative test: unknown type falls back to raw type with underscores replaced", () => {
    expect(getBehaviorLabel("unknown_behavior")).toBe("unknown behavior");
    expect(getBehaviorLabel("custom_type")).toBe("custom type");
  });

  it("No crash: any string input does not throw", () => {
    expect(() => getBehaviorLabel("")).not.toThrow();
    expect(() => getBehaviorLabel("a".repeat(1000))).not.toThrow();
  });
});

// ════════════════════════════════════════════════════════════════════════════
//  AC2 — getSeverityColorClass
// ════════════════════════════════════════════════════════════════════════════
describe("AC2: getSeverityColorClass — severity to CSS dot-color class", () => {
  it("Happy path: known severity levels return their CSS color classes", () => {
    expect(getSeverityColorClass("critical")).toBe("bg-red-500");
    expect(getSeverityColorClass("high")).toBe("bg-orange-500");
    expect(getSeverityColorClass("medium")).toBe("bg-amber-400");
    expect(getSeverityColorClass("low")).toBe("bg-blue-400");
  });

  it("Edge case: 'normal' severity returns green class", () => {
    expect(getSeverityColorClass("normal")).toBe("bg-emerald-400");
  });

  it("Negative test: unknown severity returns empty string (not undefined)", () => {
    const result = getSeverityColorClass("extreme");
    expect(result).toBe("");
    expect(result).not.toBeUndefined();
  });

  it("No crash: empty string and unknown values do not throw", () => {
    expect(() => getSeverityColorClass("")).not.toThrow();
    expect(() => getSeverityColorClass("unknown")).not.toThrow();
  });
});

// ════════════════════════════════════════════════════════════════════════════
//  AC3 — getTopBehavior
// ════════════════════════════════════════════════════════════════════════════
describe("AC3: getTopBehavior — most common behavior type", () => {
  it("Happy path: returns key with highest count from by_type map", () => {
    expect(getTopBehavior({ phone_use: 3, sleeping: 1, fighting: 2 })).toBe("phone_use");
    expect(getTopBehavior({ sleeping: 5, phone_use: 3 })).toBe("sleeping");
  });

  it("Edge case: single entry map returns that entry's key", () => {
    expect(getTopBehavior({ fighting: 1 })).toBe("fighting");
  });

  it("Negative test: empty map returns null", () => {
    expect(getTopBehavior({})).toBeNull();
  });

  it("No crash: empty object does not throw", () => {
    expect(() => getTopBehavior({})).not.toThrow();
    expect(() => getTopBehavior({ a: 0 })).not.toThrow();
  });
});

// ════════════════════════════════════════════════════════════════════════════
//  AC3 — sortBehaviorsByCount
// ════════════════════════════════════════════════════════════════════════════
describe("AC3: sortBehaviorsByCount — descending sort of behavior counts", () => {
  it("Happy path: returns entries sorted highest count first", () => {
    const result = sortBehaviorsByCount({ phone_use: 2, sleeping: 5, fighting: 1 });
    expect(result[0]).toEqual(["sleeping", 5]);
    expect(result[1]).toEqual(["phone_use", 2]);
    expect(result[2]).toEqual(["fighting", 1]);
  });

  it("Edge case: empty map returns empty array", () => {
    expect(sortBehaviorsByCount({})).toEqual([]);
  });

  it("Negative test: single entry map returns that entry as the only element", () => {
    const result = sortBehaviorsByCount({ phone_use: 7 });
    expect(result.length).toBe(1);
    expect(result[0]).toEqual(["phone_use", 7]);
  });

  it("No crash: empty and zero-count maps do not throw", () => {
    expect(() => sortBehaviorsByCount({})).not.toThrow();
    expect(() => sortBehaviorsByCount({ a: 0, b: 0 })).not.toThrow();
  });
});
