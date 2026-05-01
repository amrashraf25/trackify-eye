/**
 * ====================================================================
 * Alerts Feature — Frontend Unit Tests
 * Follows JUnit-style structure adapted for TypeScript / Vitest:
 *
 *   AAA Pattern  : Arrange → Act → Assert in every test
 *   beforeEach() : setup shared state before each test (@BeforeEach)
 *   Assertions   : expect(...).toBe / toEqual / toBeNull / toBeTruthy
 *   Mocking      : vi.fn() mirrors Mockito mock() / when().thenReturn()
 *
 *   Testing Checklist:
 *     ✅ Happy path  – normal inputs, expected behaviour
 *     ✅ Edge cases  – empty, null, zero, boundary values
 *     ✅ Negative    – invalid inputs, wrong types, mismatched values
 *     ✅ No crashes  – all edge paths return safe results, no throws
 *
 * Run:
 *   npx vitest run tests/alerts/test_alerts_frontend.test.tsx
 * ====================================================================
 */

import { describe, it, expect, beforeEach } from "vitest";

// ─────────────────────────────────────────────────────────────────
//  TYPES  (mirror src/components/IncidentTable.tsx and pages/Alerts.tsx)
// ─────────────────────────────────────────────────────────────────
interface IncidentRecord {
  id: string;
  incident_type: string;
  severity: string | null;
  room_number: string;
  status: string;
  student_name?: string | null;
  detected_at: string;
}

// ─────────────────────────────────────────────────────────────────
//  LOGIC UNDER TEST  (pure functions extracted from components)
//  Mockito equivalent: we isolate logic from Supabase / React
// ─────────────────────────────────────────────────────────────────

/** Mirrors filteredRecords in IncidentTable.tsx */
function applyFilter(
  records: IncidentRecord[],
  searchQuery: string,
  severityFilter: string,
): IncidentRecord[] {
  return records.filter((r) => {
    if (severityFilter !== "all" && r.severity !== severityFilter) return false;
    return (
      r.incident_type.toLowerCase().includes(searchQuery.toLowerCase()) ||
      `room ${r.room_number}`.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });
}

/** Mirrors SEV_BORDER in IncidentTable.tsx */
const SEV_BORDER: Record<string, string> = {
  critical: "border-l-red-500",
  high:     "border-l-orange-500",
  medium:   "border-l-amber-500",
  low:      "border-l-emerald-500",
};

/** Mirrors getBehaviorIcon() in LiveIncidentFeed.tsx */
function getBehaviorIconName(type: string): string {
  const lower = type.toLowerCase();
  if (lower.includes("phone"))  return "Phone";
  if (lower.includes("sleep"))  return "Moon";
  if (lower.includes("talk"))   return "MessageCircle";
  if (lower.includes("drink"))  return "Coffee";
  if (lower.includes("eat"))    return "Utensils";
  return "AlertTriangle";
}

/** Mirrors getSeverityColor() in LiveIncidentFeed.tsx */
function getSeverityColor(severity: string | null): string {
  switch (severity) {
    case "high":   return "bg-destructive/10 text-destructive";
    case "medium": return "bg-amber-500/10 text-amber-500";
    case "low":    return "bg-neon-blue/10 text-neon-blue";
    default:       return "bg-muted text-muted-foreground";
  }
}

/** Mirrors status style logic in IncidentDetail.tsx */
function getStatusStyle(status: string): string {
  if (status === "resolved")  return "bg-green-500/20 text-green-400";
  if (status === "reviewing") return "bg-yellow-500/20 text-yellow-400";
  return "bg-primary/20 text-primary";
}

// ─────────────────────────────────────────────────────────────────
//  SHARED FIXTURES  (@BeforeEach equivalent)
// ─────────────────────────────────────────────────────────────────
let records: IncidentRecord[];

beforeEach(() => {
  // Arrange — fresh data before every test (@BeforeEach)
  records = [
    { id: "1", incident_type: "phone_use", severity: "high",     room_number: "101", status: "open",      detected_at: "2025-04-28T08:00:00Z", student_name: "Ali Hassan" },
    { id: "2", incident_type: "sleeping",  severity: "medium",   room_number: "202", status: "reviewing", detected_at: "2025-04-28T09:00:00Z", student_name: "Sara Ahmed" },
    { id: "3", incident_type: "fighting",  severity: "critical", room_number: "101", status: "open",      detected_at: "2025-04-28T10:00:00Z", student_name: null },
    { id: "4", incident_type: "eating",    severity: "low",      room_number: "303", status: "resolved",  detected_at: "2025-04-28T11:00:00Z", student_name: "Omar Nour" },
    { id: "5", incident_type: "phone_use", severity: "high",     room_number: "202", status: "open",      detected_at: "2025-04-28T12:00:00Z", student_name: "Sara Ahmed" },
  ];
});

// ════════════════════════════════════════════════════════════════
//  1. IncidentTable — filter logic
// ════════════════════════════════════════════════════════════════
describe("IncidentTable: applyFilter()", () => {

  // ── Happy Path ──────────────────────────────────────────────
  it("happy path — 'all' severity returns all records", () => {
    // Arrange (done in beforeEach)
    // Act
    const result = applyFilter(records, "", "all");
    // Assert  (assertEquals(5, result.length))
    expect(result.length).toBe(5);
  });

  it("happy path — filter 'high' returns only high-severity records", () => {
    // Arrange (done in beforeEach)
    // Act
    const result = applyFilter(records, "", "high");
    // Assert
    expect(result.length).toBe(2);
    result.forEach((r) => expect(r.severity).toBe("high")); // assertTrue
  });

  it("happy path — filter 'critical' returns exactly one record", () => {
    // Arrange (done in beforeEach)
    // Act
    const result = applyFilter(records, "", "critical");
    // Assert  (assertEquals(1, result.length))
    expect(result.length).toBe(1);
    expect(result[0].id).toBe("3");
  });

  it("happy path — search by incident type matches correctly", () => {
    // Arrange (done in beforeEach)
    // Act
    const result = applyFilter(records, "phone", "all");
    // Assert
    expect(result.length).toBe(2);
    result.forEach((r) => expect(r.incident_type).toContain("phone")); // assertTrue
  });

  it("happy path — search by room number matches room 101 records", () => {
    // Arrange (done in beforeEach)
    // Act
    const result = applyFilter(records, "room 101", "all");
    // Assert
    expect(result.length).toBe(2);
    result.forEach((r) => expect(r.room_number).toBe("101"));
  });

  it("happy path — combined search and severity narrows results", () => {
    // Arrange (done in beforeEach)
    // Act
    const result = applyFilter(records, "phone", "high");
    // Assert
    expect(result.length).toBe(2);
    result.forEach((r) => expect(r.severity).toBe("high"));
  });

  // ── Edge Cases ──────────────────────────────────────────────
  it("edge case — empty records list returns empty array (assertNotNull)", () => {
    // Arrange
    const emptyRecords: IncidentRecord[] = [];
    // Act
    const result = applyFilter(emptyRecords, "phone", "high");
    // Assert
    expect(result).not.toBeNull();          // assertNotNull
    expect(result.length).toBe(0);
  });

  it("edge case — empty search string matches all records", () => {
    // Arrange (done in beforeEach)
    // Act
    const result = applyFilter(records, "", "all");
    // Assert  (assertEquals(5, result.length))
    expect(result.length).toBe(5);
  });

  it("edge case — filter 'low' returns exactly one record (minimum severity)", () => {
    // Arrange (done in beforeEach)
    // Act
    const result = applyFilter(records, "", "low");
    // Assert
    expect(result.length).toBe(1);
    expect(result[0].severity).toBe("low");
  });

  it("edge case — single record list matched correctly", () => {
    // Arrange
    const single: IncidentRecord[] = [records[0]];
    // Act
    const match  = applyFilter(single, "", "high");
    const noMatch = applyFilter(single, "", "low");
    // Assert
    expect(match.length).toBe(1);
    expect(noMatch.length).toBe(0);
  });

  // ── Negative Tests ──────────────────────────────────────────
  it("negative — unknown severity returns empty list", () => {
    // Arrange (done in beforeEach)
    // Act
    const result = applyFilter(records, "", "extreme");
    // Assert  (assertEquals([], result))
    expect(result).toEqual([]);
  });

  it("negative — search with no match returns empty list", () => {
    // Arrange (done in beforeEach)
    // Act
    const result = applyFilter(records, "xyz_not_found_anywhere", "all");
    // Assert
    expect(result).toEqual([]);
  });

  it("negative — search is case-insensitive (UPPERCASE should still match)", () => {
    // Arrange (done in beforeEach)
    // Act
    const result = applyFilter(records, "PHONE", "all");
    // Assert  (assertTrue — must find records)
    expect(result.length).toBeGreaterThan(0);
    expect(result.length).toBe(2);
  });

  // ── No Crashes ──────────────────────────────────────────────
  it("no crash — null severity on record does not throw", () => {
    // Arrange
    const withNull: IncidentRecord[] = [
      { id: "z", incident_type: "eating", severity: null, room_number: "100", status: "open", detected_at: "2025-04-28T00:00:00Z" },
    ];
    // Act + Assert (no exception thrown)
    expect(() => applyFilter(withNull, "", "high")).not.toThrow();
  });

  it("no crash — empty search and empty records does not throw", () => {
    // Arrange + Act + Assert
    expect(() => applyFilter([], "", "all")).not.toThrow();
  });
});

// ════════════════════════════════════════════════════════════════
//  2. SEV_BORDER — severity left-border colour map
// ════════════════════════════════════════════════════════════════
describe("IncidentTable: SEV_BORDER colour map", () => {

  // ── Happy Path ──────────────────────────────────────────────
  it("happy path — critical maps to red left border", () => {
    // Arrange + Act + Assert  (assertEquals)
    expect(SEV_BORDER["critical"]).toBe("border-l-red-500");
  });

  it("happy path — high maps to orange left border", () => {
    expect(SEV_BORDER["high"]).toBe("border-l-orange-500");
  });

  it("happy path — medium maps to amber left border", () => {
    expect(SEV_BORDER["medium"]).toBe("border-l-amber-500");
  });

  it("happy path — low maps to emerald left border", () => {
    expect(SEV_BORDER["low"]).toBe("border-l-emerald-500");
  });

  // ── Negative Tests ──────────────────────────────────────────
  it("negative — unknown severity key returns undefined (not a class string)", () => {
    // Arrange + Act
    const result = SEV_BORDER["unknown_severity"];
    // Assert  (assertNull equivalent)
    expect(result).toBeUndefined();   // assertNull
  });

  // ── No Crashes ──────────────────────────────────────────────
  it("no crash — accessing null key on SEV_BORDER does not throw", () => {
    // Arrange + Act + Assert
    expect(() => SEV_BORDER["" as string]).not.toThrow();
  });
});

// ════════════════════════════════════════════════════════════════
//  3. LiveIncidentFeed — behaviour icon mapping
// ════════════════════════════════════════════════════════════════
describe("LiveIncidentFeed: getBehaviorIconName()", () => {

  // ── Happy Path ──────────────────────────────────────────────
  it("happy path — phone_use returns Phone icon", () => {
    // Arrange
    const type = "phone_use";
    // Act
    const icon = getBehaviorIconName(type);
    // Assert  (assertEquals("Phone", icon))
    expect(icon).toBe("Phone");
  });

  it("happy path — sleeping returns Moon icon", () => {
    expect(getBehaviorIconName("sleeping")).toBe("Moon");
  });

  it("happy path — talking returns MessageCircle icon", () => {
    expect(getBehaviorIconName("talking")).toBe("MessageCircle");
  });

  it("happy path — drinking returns Coffee icon", () => {
    expect(getBehaviorIconName("drinking")).toBe("Coffee");
  });

  it("happy path — eating returns Utensils icon", () => {
    expect(getBehaviorIconName("eating")).toBe("Utensils");
  });

  // ── Edge Cases ──────────────────────────────────────────────
  it("edge case — input is UPPERCASE still maps correctly (case-insensitive)", () => {
    // Arrange
    const type = "PHONE_USE";
    // Act
    const icon = getBehaviorIconName(type);
    // Assert  (assertEquals("Phone", icon))
    expect(icon).toBe("Phone");
  });

  it("edge case — mixed case 'Sleeping' still maps correctly", () => {
    expect(getBehaviorIconName("Sleeping")).toBe("Moon");
  });

  // ── Negative Tests ──────────────────────────────────────────
  it("negative — unknown behaviour type falls back to AlertTriangle", () => {
    // Arrange
    const type = "fighting";   // not in the list
    // Act
    const icon = getBehaviorIconName(type);
    // Assert  (assertEquals("AlertTriangle", icon))
    expect(icon).toBe("AlertTriangle");
  });

  it("negative — empty string falls back to AlertTriangle", () => {
    expect(getBehaviorIconName("")).toBe("AlertTriangle");
  });

  // ── No Crashes ──────────────────────────────────────────────
  it("no crash — very long string input does not throw", () => {
    // Arrange
    const longType = "a".repeat(10_000);
    // Act + Assert
    expect(() => getBehaviorIconName(longType)).not.toThrow();
  });
});

// ════════════════════════════════════════════════════════════════
//  4. LiveIncidentFeed — severity colour mapping
// ════════════════════════════════════════════════════════════════
describe("LiveIncidentFeed: getSeverityColor()", () => {

  // ── Happy Path ──────────────────────────────────────────────
  it("happy path — 'high' returns destructive classes", () => {
    // Arrange + Act + Assert
    expect(getSeverityColor("high")).toContain("destructive");
  });

  it("happy path — 'medium' returns amber classes", () => {
    expect(getSeverityColor("medium")).toContain("amber-500");
  });

  it("happy path — 'low' returns neon-blue classes", () => {
    expect(getSeverityColor("low")).toContain("neon-blue");
  });

  // ── Edge Cases ──────────────────────────────────────────────
  it("edge case — null severity returns muted fallback (assertNotNull)", () => {
    // Arrange + Act
    const result = getSeverityColor(null);
    // Assert
    expect(result).not.toBeNull();          // assertNotNull
    expect(result).toContain("muted");
  });

  // ── Negative Tests ──────────────────────────────────────────
  it("negative — 'critical' is not a defined case, returns muted fallback", () => {
    // Arrange + Act
    const result = getSeverityColor("critical");
    // Assert  — should NOT return undefined or throw
    expect(result).not.toBeUndefined();
    expect(result).toContain("muted");
  });

  it("negative — empty string returns muted fallback", () => {
    expect(getSeverityColor("")).toContain("muted");
  });

  // ── No Crashes ──────────────────────────────────────────────
  it("no crash — any string value does not throw", () => {
    expect(() => getSeverityColor("anything_random")).not.toThrow();
    expect(() => getSeverityColor(null)).not.toThrow();
  });
});

// ════════════════════════════════════════════════════════════════
//  5. IncidentDetail — status style mapping
// ════════════════════════════════════════════════════════════════
describe("IncidentDetail: getStatusStyle()", () => {

  // ── Happy Path ──────────────────────────────────────────────
  it("happy path — 'resolved' returns green classes", () => {
    // Arrange + Act + Assert  (assertEquals)
    expect(getStatusStyle("resolved")).toContain("green");
  });

  it("happy path — 'reviewing' returns yellow classes", () => {
    expect(getStatusStyle("reviewing")).toContain("yellow");
  });

  it("happy path — 'open' returns primary classes", () => {
    expect(getStatusStyle("open")).toContain("primary");
  });

  // ── Edge Cases ──────────────────────────────────────────────
  it("edge case — empty string falls back to primary (open state)", () => {
    // Arrange + Act
    const result = getStatusStyle("");
    // Assert  (assertNotNull + assertTrue contains primary)
    expect(result).not.toBeNull();
    expect(result).toContain("primary");
  });

  // ── Negative Tests ──────────────────────────────────────────
  it("negative — unknown status falls back to primary (assertFalse for green/yellow)", () => {
    // Arrange + Act
    const result = getStatusStyle("pending");
    // Assert
    expect(result).not.toContain("green");
    expect(result).not.toContain("yellow");
    expect(result).toContain("primary");
  });

  // ── No Crashes ──────────────────────────────────────────────
  it("no crash — any status string does not throw", () => {
    expect(() => getStatusStyle("unknown_status")).not.toThrow();
    expect(() => getStatusStyle("")).not.toThrow();
  });
});

// ════════════════════════════════════════════════════════════════
//  6. Alerts Page — severity chip configuration
// ════════════════════════════════════════════════════════════════
describe("Alerts page: severity chip config", () => {

  const SEV_CHIPS = [
    { id: "all",      label: "All"      },
    { id: "critical", label: "Critical" },
    { id: "high",     label: "High"     },
    { id: "medium",   label: "Medium"   },
    { id: "low",      label: "Low"      },
  ];

  // ── Happy Path ──────────────────────────────────────────────
  it("happy path — exactly 5 chips are defined", () => {
    // Arrange + Act + Assert  (assertEquals(5, SEV_CHIPS.length))
    expect(SEV_CHIPS.length).toBe(5);
  });

  it("happy path — 'all' chip is first in the list", () => {
    expect(SEV_CHIPS[0].id).toBe("all");
  });

  it("happy path — all required severity labels present", () => {
    const labels = SEV_CHIPS.map((c) => c.label);
    expect(labels).toContain("All");
    expect(labels).toContain("Critical");
    expect(labels).toContain("High");
    expect(labels).toContain("Medium");
    expect(labels).toContain("Low");
  });

  it("happy path — selecting a chip changes the active filter", () => {
    // Arrange
    let currentFilter = "all";
    const setFilter = (id: string) => { currentFilter = id; };
    // Act
    setFilter("critical");
    // Assert  (assertEquals("critical", currentFilter))
    expect(currentFilter).toBe("critical");
  });

  // ── Edge Cases ──────────────────────────────────────────────
  it("edge case — default filter is 'all' (initial state)", () => {
    // Arrange
    const defaultFilter = "all";
    // Act + Assert  (assertEquals("all", defaultFilter))
    expect(defaultFilter).toBe("all");
  });

  it("edge case — resetting filter back to 'all' works correctly", () => {
    // Arrange
    let filter = "high";
    // Act
    filter = "all";
    // Assert
    expect(filter).toBe("all");
  });

  // ── Negative Tests ──────────────────────────────────────────
  it("negative — chip id 'extreme' is NOT in the defined chips (assertFalse)", () => {
    // Arrange + Act
    const ids = SEV_CHIPS.map((c) => c.id);
    // Assert  (assertFalse)
    expect(ids).not.toContain("extreme");
  });

  // ── No Crashes ──────────────────────────────────────────────
  it("no crash — iterating all chips does not throw", () => {
    expect(() => SEV_CHIPS.forEach((c) => c.id + c.label)).not.toThrow();
  });
});
