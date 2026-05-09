/**
 * ====================================================================
 * Weekly Attendance Summary — Unit Tests
 * Exactly 4 tests per function: Happy path / Edge case / Negative / No crash
 * ====================================================================
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  filterByWeek,
  buildWeeklySummary,
  categorizePct,
  AttendanceRecord,
  Student,
} from "./feature_files/WeeklyAttendanceSummary";

let records: AttendanceRecord[];
let students: Student[];

const WEEK_START = new Date("2025-01-06T00:00:00.000Z");
const WEEK_END   = new Date("2025-01-12T23:59:59.999Z");

beforeEach(() => {
  students = [
    { id: "s1", name: "Alice Johnson", code: "STU001" },
    { id: "s2", name: "Bob Smith",     code: "STU002" },
    { id: "s3", name: "Carol White",   code: "STU003" },
  ];

  records = [
    { id: "r1", student_id: "s1", session_id: "sess1", status: "present", confirmed_at: "2025-01-06T09:00:00.000Z" },
    { id: "r2", student_id: "s1", session_id: "sess2", status: "present", confirmed_at: "2025-01-07T09:00:00.000Z" },
    { id: "r3", student_id: "s1", session_id: "sess3", status: "absent",  confirmed_at: "2025-01-08T09:00:00.000Z" },
    { id: "r4", student_id: "s1", session_id: "sess4", status: "late",    confirmed_at: "2025-01-09T09:00:00.000Z" },
    { id: "r5", student_id: "s1", session_id: "sess5", status: "present", confirmed_at: "2025-01-10T09:00:00.000Z" },
    { id: "r6", student_id: "s2", session_id: "sess1", status: "present", confirmed_at: "2025-01-06T09:00:00.000Z" },
    // Out-of-week records (excluded)
    { id: "r7", student_id: "s1", session_id: "sess0", status: "present", confirmed_at: "2025-01-05T09:00:00.000Z" },
    { id: "r8", student_id: "s2", session_id: "sess6", status: "present", confirmed_at: "2025-01-13T09:00:00.000Z" },
  ];
});

// ─── AC1: filterByWeek ───────────────────────────────────────────────────────

describe("AC1: filterByWeek — weekly window filtering", () => {
  it("Happy path: returns only records within [weekStart, weekEnd], excluding out-of-week", () => {
    const result = filterByWeek(records, WEEK_START, WEEK_END);
    expect(result.length).toBe(6);
    expect(result.every((r) => {
      const ts = new Date(r.confirmed_at).getTime();
      return ts >= WEEK_START.getTime() && ts <= WEEK_END.getTime();
    })).toBe(true);
  });

  it("Edge case: records exactly on weekStart and weekEnd boundaries are included", () => {
    const boundary: AttendanceRecord[] = [
      { id: "b1", student_id: "s1", session_id: "sx", status: "present", confirmed_at: WEEK_START.toISOString() },
      { id: "b2", student_id: "s1", session_id: "sy", status: "absent",  confirmed_at: WEEK_END.toISOString() },
    ];
    expect(filterByWeek(boundary, WEEK_START, WEEK_END).length).toBe(2);
  });

  it("Negative test: weekEnd before weekStart returns empty array", () => {
    const invertedEnd = new Date("2025-01-01T00:00:00.000Z");
    expect(filterByWeek(records, WEEK_START, invertedEnd)).toEqual([]);
  });

  it("No crash: empty records array returns empty without throwing", () => {
    expect(() => filterByWeek([], WEEK_START, WEEK_END)).not.toThrow();
    expect(filterByWeek([], WEEK_START, WEEK_END)).toEqual([]);
  });
});

// ─── AC2: buildWeeklySummary ─────────────────────────────────────────────────

describe("AC2: buildWeeklySummary — aggregation and percentages", () => {
  it("Happy path: Alice gets correct totals (5 sessions, 80% pct) and name/code carried through", () => {
    const inWeek = filterByWeek(records, WEEK_START, WEEK_END);
    const summary = buildWeeklySummary(inWeek, students);
    const alice = summary.find((r) => r.studentId === "s1")!;
    expect(alice.sessions).toBe(5);
    expect(alice.present).toBe(3);
    expect(alice.absent).toBe(1);
    expect(alice.late).toBe(1);
    expect(alice.pct).toBe(80);
    expect(alice.name).toBe("Alice Johnson");
    expect(alice.code).toBe("STU001");
  });

  it("Edge case: student with no in-week records gets 0 counts and 0% pct", () => {
    const inWeek = filterByWeek(records, WEEK_START, WEEK_END);
    const summary = buildWeeklySummary(inWeek, students);
    const carol = summary.find((r) => r.studentId === "s3")!;
    expect(carol.sessions).toBe(0);
    expect(carol.pct).toBe(0);
  });

  it("Negative test: records referencing unknown student_id are silently skipped", () => {
    const orphan: AttendanceRecord[] = [
      { id: "x1", student_id: "s_unknown", session_id: "s1", status: "present", confirmed_at: "2025-01-06T09:00:00.000Z" },
    ];
    const summary = buildWeeklySummary(orphan, students);
    expect(summary.find((r) => r.studentId === "s_unknown")).toBeUndefined();
  });

  it("No crash: empty records and students arrays do not throw", () => {
    expect(() => buildWeeklySummary([], [])).not.toThrow();
    expect(buildWeeklySummary([], [])).toEqual([]);
  });
});

// ─── AC3: categorizePct ──────────────────────────────────────────────────────

describe("AC3: categorizePct — percentage categorization", () => {
  it("Happy path: ≥75% → 'good'; 50–74% → 'warning'; <50% → 'danger'", () => {
    expect(categorizePct(75)).toBe("good");
    expect(categorizePct(100)).toBe("good");
    expect(categorizePct(50)).toBe("warning");
    expect(categorizePct(74)).toBe("warning");
    expect(categorizePct(49)).toBe("danger");
    expect(categorizePct(0)).toBe("danger");
  });

  it("Edge case: negative percentage does not throw and returns 'danger'", () => {
    expect(() => categorizePct(-1)).not.toThrow();
    expect(categorizePct(-1)).toBe("danger");
  });

  it("Negative test: values just below each boundary return lower category", () => {
    expect(categorizePct(74)).toBe("warning"); // just below 'good'
    expect(categorizePct(49)).toBe("danger");  // just below 'warning'
  });

  it("No crash: pipeline handles completely empty data without throwing", () => {
    expect(() => {
      const inWeek = filterByWeek([], WEEK_START, WEEK_END);
      const summary = buildWeeklySummary(inWeek, []);
      summary.map((r) => categorizePct(r.pct));
    }).not.toThrow();
  });
});

// ─── AC4: full weekly report pipeline ────────────────────────────────────────

describe("AC4: full weekly report pipeline", () => {
  it("Happy path: pipeline produces valid report with correct categories for all students", () => {
    const inWeek = filterByWeek(records, WEEK_START, WEEK_END);
    const summary = buildWeeklySummary(inWeek, students);
    const withCategory = summary.map((r) => ({ ...r, category: categorizePct(r.pct) }));
    expect(withCategory.length).toBe(3);
    const validCategories = ["good", "warning", "danger"] as const;
    withCategory.forEach((row) => expect(validCategories).toContain(row.category));
  });

  it("Edge case: future week with no records returns all students with 0 sessions", () => {
    const futureStart = new Date("2030-01-06T00:00:00.000Z");
    const futureEnd   = new Date("2030-01-12T23:59:59.999Z");
    const inWeek = filterByWeek(records, futureStart, futureEnd);
    const summary = buildWeeklySummary(inWeek, students);
    expect(summary.every((r) => r.sessions === 0)).toBe(true);
  });

  it("Negative test: all-absent week flags everyone as 'danger'", () => {
    const allAbsent: AttendanceRecord[] = students.map((s, i) => ({
      id: `x${i}`, student_id: s.id, session_id: "sess1", status: "absent",
      confirmed_at: "2025-01-07T09:00:00.000Z",
    }));
    const summary = buildWeeklySummary(allAbsent, students);
    expect(summary.map((r) => categorizePct(r.pct)).every((c) => c === "danger")).toBe(true);
  });

  it("No crash: completely empty data does not throw", () => {
    expect(() => {
      const inWeek = filterByWeek([], WEEK_START, WEEK_END);
      buildWeeklySummary(inWeek, []).map((r) => categorizePct(r.pct));
    }).not.toThrow();
  });
});
