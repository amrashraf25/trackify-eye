import { describe, it, expect, beforeEach } from "vitest";
import {
  filterByWeek,
  buildWeeklySummary,
  categorizePct,
  AttendanceRecord,
  Student,
  WeeklySummaryRow,
} from "./feature_files/WeeklyAttendanceSummary";

// ─── TEST DATA ────────────────────────────────────────────────────────────────

let records: AttendanceRecord[];
let students: Student[];

// Week boundaries used across tests: Mon 2025-01-06 → Sun 2025-01-12
const WEEK_START = new Date("2025-01-06T00:00:00.000Z");
const WEEK_END   = new Date("2025-01-12T23:59:59.999Z");

beforeEach(() => {
  students = [
    { id: "s1", name: "Alice Johnson", code: "STU001" },
    { id: "s2", name: "Bob Smith",     code: "STU002" },
    { id: "s3", name: "Carol White",   code: "STU003" },
  ];

  records = [
    // Alice: 3 present, 1 absent, 1 late  — within week
    { id: "r1", student_id: "s1", session_id: "sess1", status: "present", confirmed_at: "2025-01-06T09:00:00.000Z" },
    { id: "r2", student_id: "s1", session_id: "sess2", status: "present", confirmed_at: "2025-01-07T09:00:00.000Z" },
    { id: "r3", student_id: "s1", session_id: "sess3", status: "absent",  confirmed_at: "2025-01-08T09:00:00.000Z" },
    { id: "r4", student_id: "s1", session_id: "sess4", status: "late",    confirmed_at: "2025-01-09T09:00:00.000Z" },
    { id: "r5", student_id: "s1", session_id: "sess5", status: "present", confirmed_at: "2025-01-10T09:00:00.000Z" },
    // Bob: 1 record within week
    { id: "r6", student_id: "s2", session_id: "sess1", status: "present", confirmed_at: "2025-01-06T09:00:00.000Z" },
    // Carol: no records within week
    // Out-of-week record for Alice (previous week)
    { id: "r7", student_id: "s1", session_id: "sess0", status: "present", confirmed_at: "2025-01-05T09:00:00.000Z" },
    // Out-of-week record for Bob (next week)
    { id: "r8", student_id: "s2", session_id: "sess6", status: "present", confirmed_at: "2025-01-13T09:00:00.000Z" },
  ];
});

// ─── AC1: filterByWeek — generates records within the weekly window ───────────

describe("AC1: filterByWeek — weekly window filtering", () => {
  it("Happy path: returns only records within [weekStart, weekEnd]", () => {
    // Arrange
    const input = records;
    // Act
    const result = filterByWeek(input, WEEK_START, WEEK_END);
    // Assert — r7 (Jan 5) and r8 (Jan 13) must be excluded
    expect(result.length).toBe(6);
    expect(result.every((r) => {
      const ts = new Date(r.confirmed_at).getTime();
      return ts >= WEEK_START.getTime() && ts <= WEEK_END.getTime();
    })).toBe(true);
  });

  it("Edge case: record exactly on weekStart boundary is included", () => {
    // Arrange
    const boundary: AttendanceRecord[] = [
      { id: "b1", student_id: "s1", session_id: "sx", status: "present", confirmed_at: WEEK_START.toISOString() },
    ];
    // Act
    const result = filterByWeek(boundary, WEEK_START, WEEK_END);
    // Assert
    expect(result.length).toBe(1);
  });

  it("Edge case: record exactly on weekEnd boundary is included", () => {
    // Arrange
    const boundary: AttendanceRecord[] = [
      { id: "b2", student_id: "s1", session_id: "sx", status: "absent", confirmed_at: WEEK_END.toISOString() },
    ];
    // Act
    const result = filterByWeek(boundary, WEEK_START, WEEK_END);
    // Assert
    expect(result.length).toBe(1);
  });

  it("Negative test: weekEnd before weekStart returns empty array", () => {
    // Arrange
    const invertedEnd = new Date("2025-01-01T00:00:00.000Z");
    // Act
    const result = filterByWeek(records, WEEK_START, invertedEnd);
    // Assert
    expect(result).toEqual([]);
  });

  it("No crash: empty records array returns empty array without throwing", () => {
    // Arrange
    const empty: AttendanceRecord[] = [];
    // Act + Assert
    expect(() => filterByWeek(empty, WEEK_START, WEEK_END)).not.toThrow();
    expect(filterByWeek(empty, WEEK_START, WEEK_END)).toEqual([]);
  });
});

// ─── AC2: buildWeeklySummary — per-student totals and percentages ─────────────

describe("AC2: buildWeeklySummary — aggregation and percentages", () => {
  it("Happy path: student with mixed statuses gets correct totals", () => {
    // Arrange — use only in-week records (5 for Alice, 1 for Bob)
    const inWeek = filterByWeek(records, WEEK_START, WEEK_END);
    // Act
    const summary = buildWeeklySummary(inWeek, students);
    const alice = summary.find((r) => r.studentId === "s1")!;
    // Assert
    expect(alice.sessions).toBe(5);
    expect(alice.present).toBe(3);
    expect(alice.absent).toBe(1);
    expect(alice.late).toBe(1);
    // pct = (present + late) / sessions = 4/5 = 80%
    expect(alice.pct).toBe(80);
  });

  it("Happy path: student with only 1 record gets 100% if present", () => {
    // Arrange
    const singleRecord: AttendanceRecord[] = [
      { id: "r6", student_id: "s2", session_id: "sess1", status: "present", confirmed_at: "2025-01-06T09:00:00.000Z" },
    ];
    // Act
    const summary = buildWeeklySummary(singleRecord, students);
    const bob = summary.find((r) => r.studentId === "s2")!;
    // Assert
    expect(bob.sessions).toBe(1);
    expect(bob.present).toBe(1);
    expect(bob.pct).toBe(100);
  });

  it("Edge case: student with no records in week gets pct 0 and zero counts", () => {
    // Arrange — Carol has no in-week records
    const inWeek = filterByWeek(records, WEEK_START, WEEK_END);
    // Act
    const summary = buildWeeklySummary(inWeek, students);
    const carol = summary.find((r) => r.studentId === "s3")!;
    // Assert
    expect(carol.sessions).toBe(0);
    expect(carol.present).toBe(0);
    expect(carol.absent).toBe(0);
    expect(carol.late).toBe(0);
    expect(carol.pct).toBe(0);
  });

  it("Edge case: student name and code are carried through correctly", () => {
    // Arrange
    const inWeek = filterByWeek(records, WEEK_START, WEEK_END);
    // Act
    const summary = buildWeeklySummary(inWeek, students);
    // Assert
    expect(summary.find((r) => r.studentId === "s1")?.name).toBe("Alice Johnson");
    expect(summary.find((r) => r.studentId === "s1")?.code).toBe("STU001");
  });

  it("Negative test: records referencing unknown student_id are silently skipped", () => {
    // Arrange
    const orphan: AttendanceRecord[] = [
      { id: "x1", student_id: "s_unknown", session_id: "s1", status: "present", confirmed_at: "2025-01-06T09:00:00.000Z" },
    ];
    // Act
    const summary = buildWeeklySummary(orphan, students);
    // Assert — no row should have studentId "s_unknown"
    expect(summary.find((r) => r.studentId === "s_unknown")).toBeUndefined();
  });

  it("No crash: empty records and students arrays do not throw", () => {
    // Arrange + Act + Assert
    expect(() => buildWeeklySummary([], [])).not.toThrow();
    expect(buildWeeklySummary([], [])).toEqual([]);
  });

  it("No crash: empty records with valid students returns rows with zero counts", () => {
    // Arrange
    const empty: AttendanceRecord[] = [];
    // Act
    const result = buildWeeklySummary(empty, students);
    // Assert — still returns a row per student
    expect(result.length).toBe(3);
    expect(result.every((r) => r.sessions === 0)).toBe(true);
  });
});

// ─── AC3: categorizePct — color-coded thresholds ──────────────────────────────

describe("AC3: categorizePct — percentage categorization", () => {
  it("Happy path: 75% returns 'good'", () => {
    // Arrange
    const pct = 75;
    // Act
    const result = categorizePct(pct);
    // Assert
    expect(result).toBe("good");
  });

  it("Happy path: 100% returns 'good'", () => {
    // Arrange
    const pct = 100;
    // Act
    const result = categorizePct(pct);
    // Assert
    expect(result).toBe("good");
  });

  it("Happy path: 50% returns 'warning'", () => {
    // Arrange
    const pct = 50;
    // Act
    const result = categorizePct(pct);
    // Assert
    expect(result).toBe("warning");
  });

  it("Happy path: 74% (just below good threshold) returns 'warning'", () => {
    // Arrange
    const pct = 74;
    // Act
    const result = categorizePct(pct);
    // Assert
    expect(result).toBe("warning");
  });

  it("Negative test: 49% (just below warning threshold) returns 'danger'", () => {
    // Arrange
    const pct = 49;
    // Act
    const result = categorizePct(pct);
    // Assert
    expect(result).toBe("danger");
  });

  it("Negative test: 0% returns 'danger'", () => {
    // Arrange
    const pct = 0;
    // Act
    const result = categorizePct(pct);
    // Assert
    expect(result).toBe("danger");
  });

  it("No crash: negative percentage does not throw and returns 'danger'", () => {
    // Arrange + Act + Assert
    expect(() => categorizePct(-1)).not.toThrow();
    expect(categorizePct(-1)).toBe("danger");
  });
});

// ─── AC4: Admin weekly report — integration of all three functions ─────────────

describe("AC4: full weekly report pipeline", () => {
  it("Happy path: pipeline produces sorted valid report for all students", () => {
    // Arrange — simulate admin requesting current week report
    const inWeek = filterByWeek(records, WEEK_START, WEEK_END);
    // Act
    const summary = buildWeeklySummary(inWeek, students);
    const withCategory = summary.map((r) => ({
      ...r,
      category: categorizePct(r.pct),
    }));
    // Assert — all three students appear, categories are valid
    expect(withCategory.length).toBe(3);
    const validCategories = ["good", "warning", "danger"] as const;
    for (const row of withCategory) {
      expect(validCategories).toContain(row.category);
    }
  });

  it("Edge case: previous week with no records still returns full student list", () => {
    // Arrange — far-future week with no records
    const futureStart = new Date("2030-01-06T00:00:00.000Z");
    const futureEnd   = new Date("2030-01-12T23:59:59.999Z");
    // Act
    const inWeek = filterByWeek(records, futureStart, futureEnd);
    const summary = buildWeeklySummary(inWeek, students);
    // Assert — all students still present with 0 sessions
    expect(summary.length).toBe(3);
    expect(summary.every((r) => r.sessions === 0)).toBe(true);
  });

  it("Negative test: report with all-absent week flags everyone as danger", () => {
    // Arrange — all records are absent
    const allAbsent: AttendanceRecord[] = students.map((s, i) => ({
      id: `x${i}`,
      student_id: s.id,
      session_id: "sess1",
      status: "absent",
      confirmed_at: "2025-01-07T09:00:00.000Z",
    }));
    // Act
    const summary = buildWeeklySummary(allAbsent, students);
    const categories = summary.map((r) => categorizePct(r.pct));
    // Assert
    expect(categories.every((c) => c === "danger")).toBe(true);
  });

  it("No crash: pipeline handles completely empty data without throwing", () => {
    // Arrange
    const empty: AttendanceRecord[] = [];
    const emptyStudents: Student[] = [];
    // Act + Assert
    expect(() => {
      const inWeek = filterByWeek(empty, WEEK_START, WEEK_END);
      const summary = buildWeeklySummary(inWeek, emptyStudents);
      summary.map((r) => categorizePct(r.pct));
    }).not.toThrow();
  });
});
