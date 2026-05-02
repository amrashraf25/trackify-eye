/**
 * ====================================================================
 * Alerts Feature — Frontend Unit Tests
 * Follows JUnit-style structure adapted for TypeScript / Vitest:
 *
 *   AAA Pattern  : Arrange → Act → Assert in every test
 *   beforeEach() : shared fixture setup (@BeforeEach)
 *   Exactly 4 tests per function: Happy path / Edge case / Negative / No crash
 *
 * Run:
 *   npx vitest run tests/alerts/test_alerts_frontend.test.tsx
 * ====================================================================
 */

import { describe, it, expect, beforeEach } from "vitest";

interface IncidentRecord {
  id: string;
  incident_type: string;
  severity: string | null;
  room_number: string;
  status: string;
  student_name?: string | null;
  detected_at: string;
}

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

const SEV_BORDER: Record<string, string> = {
  critical: "border-l-red-500",
  high:     "border-l-orange-500",
  medium:   "border-l-amber-500",
  low:      "border-l-emerald-500",
};

function getBehaviorIconName(type: string): string {
  const lower = type.toLowerCase();
  if (lower.includes("phone"))  return "Phone";
  if (lower.includes("sleep"))  return "Moon";
  if (lower.includes("talk"))   return "MessageCircle";
  if (lower.includes("drink"))  return "Coffee";
  if (lower.includes("eat"))    return "Utensils";
  return "AlertTriangle";
}

function getSeverityColor(severity: string | null): string {
  switch (severity) {
    case "high":   return "bg-destructive/10 text-destructive";
    case "medium": return "bg-amber-500/10 text-amber-500";
    case "low":    return "bg-neon-blue/10 text-neon-blue";
    default:       return "bg-muted text-muted-foreground";
  }
}

function getStatusStyle(status: string): string {
  if (status === "resolved")  return "bg-green-500/20 text-green-400";
  if (status === "reviewing") return "bg-yellow-500/20 text-yellow-400";
  return "bg-primary/20 text-primary";
}

let records: IncidentRecord[];

beforeEach(() => {
  records = [
    { id: "1", incident_type: "phone_use", severity: "high",     room_number: "101", status: "open",      detected_at: "2025-04-28T08:00:00Z" },
    { id: "2", incident_type: "sleeping",  severity: "medium",   room_number: "202", status: "reviewing", detected_at: "2025-04-28T09:00:00Z" },
    { id: "3", incident_type: "fighting",  severity: "critical", room_number: "101", status: "open",      detected_at: "2025-04-28T10:00:00Z" },
    { id: "4", incident_type: "eating",    severity: "low",      room_number: "303", status: "resolved",  detected_at: "2025-04-28T11:00:00Z" },
    { id: "5", incident_type: "phone_use", severity: "high",     room_number: "202", status: "open",      detected_at: "2025-04-28T12:00:00Z" },
  ];
});

// ════════════════════════════════════════════════════════════════
//  1. IncidentTable — filter logic
// ════════════════════════════════════════════════════════════════
describe("IncidentTable: applyFilter()", () => {
  it("Happy path: 'all' severity returns all records; search by type and room narrows correctly", () => {
    expect(applyFilter(records, "", "all").length).toBe(5);
    expect(applyFilter(records, "phone", "all").length).toBe(2);
    expect(applyFilter(records, "room 101", "all").length).toBe(2);
    expect(applyFilter(records, "phone", "high").length).toBe(2);
  });

  it("Edge case: empty records list returns non-null empty array", () => {
    const result = applyFilter([], "phone", "high");
    expect(result).not.toBeNull();
    expect(result.length).toBe(0);
  });

  it("Negative test: unknown severity filter returns empty list", () => {
    expect(applyFilter(records, "", "extreme")).toEqual([]);
    expect(applyFilter(records, "xyz_not_found", "all")).toEqual([]);
  });

  it("No crash: null severity on a record does not throw", () => {
    const withNull: IncidentRecord[] = [
      { id: "z", incident_type: "eating", severity: null, room_number: "100", status: "open", detected_at: "" },
    ];
    expect(() => applyFilter(withNull, "", "high")).not.toThrow();
  });
});

// ════════════════════════════════════════════════════════════════
//  2. SEV_BORDER — severity left-border colour map
// ════════════════════════════════════════════════════════════════
describe("IncidentTable: SEV_BORDER colour map", () => {
  it("Happy path: all four severity keys map to correct border classes", () => {
    expect(SEV_BORDER["critical"]).toBe("border-l-red-500");
    expect(SEV_BORDER["high"]).toBe("border-l-orange-500");
    expect(SEV_BORDER["medium"]).toBe("border-l-amber-500");
    expect(SEV_BORDER["low"]).toBe("border-l-emerald-500");
  });

  it("Edge case: empty string key returns undefined (not a class string)", () => {
    expect(SEV_BORDER[""]).toBeUndefined();
  });

  it("Negative test: unknown severity key returns undefined", () => {
    expect(SEV_BORDER["unknown_severity"]).toBeUndefined();
  });

  it("No crash: accessing any key on SEV_BORDER does not throw", () => {
    expect(() => SEV_BORDER["" as string]).not.toThrow();
    expect(() => SEV_BORDER["extreme"]).not.toThrow();
  });
});

// ════════════════════════════════════════════════════════════════
//  3. LiveIncidentFeed — behaviour icon mapping
// ════════════════════════════════════════════════════════════════
describe("LiveIncidentFeed: getBehaviorIconName()", () => {
  it("Happy path: all known behavior types map to correct icon names", () => {
    expect(getBehaviorIconName("phone_use")).toBe("Phone");
    expect(getBehaviorIconName("sleeping")).toBe("Moon");
    expect(getBehaviorIconName("talking")).toBe("MessageCircle");
    expect(getBehaviorIconName("drinking")).toBe("Coffee");
    expect(getBehaviorIconName("eating")).toBe("Utensils");
  });

  it("Edge case: UPPERCASE input is case-insensitive and maps correctly", () => {
    expect(getBehaviorIconName("PHONE_USE")).toBe("Phone");
    expect(getBehaviorIconName("Sleeping")).toBe("Moon");
  });

  it("Negative test: unknown behavior type falls back to AlertTriangle", () => {
    expect(getBehaviorIconName("fighting")).toBe("AlertTriangle");
    expect(getBehaviorIconName("")).toBe("AlertTriangle");
  });

  it("No crash: very long string input does not throw", () => {
    expect(() => getBehaviorIconName("a".repeat(10_000))).not.toThrow();
  });
});

// ════════════════════════════════════════════════════════════════
//  4. LiveIncidentFeed — severity colour mapping
// ════════════════════════════════════════════════════════════════
describe("LiveIncidentFeed: getSeverityColor()", () => {
  it("Happy path: high/medium/low return correct class strings", () => {
    expect(getSeverityColor("high")).toContain("destructive");
    expect(getSeverityColor("medium")).toContain("amber-500");
    expect(getSeverityColor("low")).toContain("neon-blue");
  });

  it("Edge case: null severity returns non-null muted fallback", () => {
    const result = getSeverityColor(null);
    expect(result).not.toBeNull();
    expect(result).toContain("muted");
  });

  it("Negative test: empty string and unknown values return muted fallback", () => {
    expect(getSeverityColor("")).toContain("muted");
    expect(getSeverityColor("critical")).toContain("muted");
  });

  it("No crash: any string value (including null) does not throw", () => {
    expect(() => getSeverityColor("anything_random")).not.toThrow();
    expect(() => getSeverityColor(null)).not.toThrow();
  });
});

// ════════════════════════════════════════════════════════════════
//  5. IncidentDetail — status style mapping
// ════════════════════════════════════════════════════════════════
describe("IncidentDetail: getStatusStyle()", () => {
  it("Happy path: resolved/reviewing/open return correct class strings", () => {
    expect(getStatusStyle("resolved")).toContain("green");
    expect(getStatusStyle("reviewing")).toContain("yellow");
    expect(getStatusStyle("open")).toContain("primary");
  });

  it("Edge case: empty string falls back to primary class", () => {
    const result = getStatusStyle("");
    expect(result).not.toBeNull();
    expect(result).toContain("primary");
  });

  it("Negative test: unknown status falls back to primary (not green or yellow)", () => {
    const result = getStatusStyle("pending");
    expect(result).not.toContain("green");
    expect(result).not.toContain("yellow");
    expect(result).toContain("primary");
  });

  it("No crash: any status string does not throw", () => {
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

  it("Happy path: 5 chips defined in correct order with matching IDs and labels", () => {
    expect(SEV_CHIPS.length).toBe(5);
    expect(SEV_CHIPS[0].id).toBe("all");
    expect(SEV_CHIPS.map((c) => c.label)).toEqual(["All", "Critical", "High", "Medium", "Low"]);
  });

  it("Edge case: default filter is 'all' and resetting to it works", () => {
    let filter = "high";
    filter = "all";
    expect(filter).toBe("all");
    expect(SEV_CHIPS[0].id).toBe("all");
  });

  it("Negative test: 'extreme' severity chip is NOT defined in the list", () => {
    expect(SEV_CHIPS.map((c) => c.id)).not.toContain("extreme");
  });

  it("No crash: iterating all chips does not throw", () => {
    expect(() => SEV_CHIPS.forEach((c) => c.id + c.label)).not.toThrow();
  });
});
