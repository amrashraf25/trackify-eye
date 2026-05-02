/**
 * ====================================================================
 * Chronic Absentees — Unit Tests
 * Exactly 4 tests per function: Happy path / Edge case / Negative / No crash
 * ====================================================================
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  isChronicAbsentee,
  filterChronicAbsentees,
  sortByAttendance,
  buildAbsenteeRows,
  AttendanceRecord,
  Student,
  Enrollment,
  StudentRow,
} from "./feature_files/ChronicAbsentees";

let students: Student[];
let records: AttendanceRecord[];
let enrollments: Enrollment[];

beforeEach(() => {
  students = [
    { id: "s1", name: "Alice Johnson", code: "STU001" },
    { id: "s2", name: "Bob Smith",     code: "STU002" },
    { id: "s3", name: "Carol White",   code: "STU003" },
    { id: "s4", name: "Dan Brown",     code: "STU004" },
  ];

  enrollments = [
    { student_id: "s1", course_id: "c1", course_name: "Mathematics" },
    { student_id: "s1", course_id: "c2", course_name: "Physics" },
    { student_id: "s2", course_id: "c1", course_name: "Mathematics" },
    { student_id: "s3", course_id: "c2", course_name: "Physics" },
    { student_id: "s3", course_id: "c3", course_name: "Chemistry" },
  ];

  records = [
    // Alice: 10 sessions, 8 present (80%)
    ...Array.from({ length: 8 }, (_, i) => ({
      id: `a_p${i}`, student_id: "s1", session_id: `sess${i}`,
      status: "present" as const, confirmed_at: "2025-01-10T09:00:00.000Z",
    })),
    ...Array.from({ length: 2 }, (_, i) => ({
      id: `a_ab${i}`, student_id: "s1", session_id: `sess${i + 8}`,
      status: "absent" as const, confirmed_at: "2025-01-10T09:00:00.000Z",
    })),
    // Bob: 10 sessions, 5 present (50%)
    ...Array.from({ length: 5 }, (_, i) => ({
      id: `b_p${i}`, student_id: "s2", session_id: `sess${i + 10}`,
      status: "present" as const, confirmed_at: "2025-01-10T09:00:00.000Z",
    })),
    ...Array.from({ length: 5 }, (_, i) => ({
      id: `b_ab${i}`, student_id: "s2", session_id: `sess${i + 15}`,
      status: "absent" as const, confirmed_at: "2025-01-10T09:00:00.000Z",
    })),
    // Carol: 10 sessions, 2 late (20%)
    ...Array.from({ length: 2 }, (_, i) => ({
      id: `c_p${i}`, student_id: "s3", session_id: `sess${i + 20}`,
      status: "late" as const, confirmed_at: "2025-01-10T09:00:00.000Z",
    })),
    ...Array.from({ length: 8 }, (_, i) => ({
      id: `c_ab${i}`, student_id: "s3", session_id: `sess${i + 22}`,
      status: "absent" as const, confirmed_at: "2025-01-10T09:00:00.000Z",
    })),
    // Dan: 0 records
  ];
});

// ─── AC1: isChronicAbsentee ───────────────────────────────────────────────────

describe("AC1: isChronicAbsentee — threshold evaluation", () => {
  it("Happy path: 40% attendance with 60% threshold is chronic; 80% is not", () => {
    expect(isChronicAbsentee(10, 4, 60)).toBe(true);
    expect(isChronicAbsentee(10, 8, 60)).toBe(false);
    expect(isChronicAbsentee(10, 6, 60)).toBe(false); // exactly at threshold
  });

  it("Edge case: 0 total classes returns false (no data is not an absence)", () => {
    expect(isChronicAbsentee(0, 0, 60)).toBe(false);
  });

  it("Negative test: 0% attendance is always chronic regardless of threshold", () => {
    expect(isChronicAbsentee(5, 0, 60)).toBe(true);
  });

  it("No crash: very high threshold (99%) does not throw", () => {
    expect(() => isChronicAbsentee(10, 9, 99)).not.toThrow();
    expect(isChronicAbsentee(10, 9, 99)).toBe(true);
  });
});

// ─── AC2: filterChronicAbsentees ─────────────────────────────────────────────

describe("AC2: filterChronicAbsentees — filtering by threshold", () => {
  it("Happy path: 60% threshold keeps Bob (50%) and Carol (20%), excludes Alice (80%)", () => {
    const allRows = buildAbsenteeRows(records, students, enrollments);
    const result = filterChronicAbsentees(allRows, 60);
    const ids = result.map((r) => r.studentId);
    expect(ids).toContain("s2");
    expect(ids).toContain("s3");
    expect(ids).not.toContain("s1");
  });

  it("Edge case: threshold of 0% returns no one as chronic", () => {
    const allRows = buildAbsenteeRows(records, students, enrollments);
    expect(filterChronicAbsentees(allRows, 0)).toEqual([]);
  });

  it("Negative test: threshold 100% flags every student with at least one absence", () => {
    const allRows = buildAbsenteeRows(records, students, enrollments);
    const withClasses = allRows.filter((r) => r.totalClasses > 0 && r.pct < 100);
    const result = filterChronicAbsentees(allRows, 100);
    expect(result.length).toBe(withClasses.length);
  });

  it("No crash: empty rows array does not throw", () => {
    expect(() => filterChronicAbsentees([], 60)).not.toThrow();
    expect(filterChronicAbsentees([], 60)).toEqual([]);
  });
});

// ─── AC3: sortByAttendance ────────────────────────────────────────────────────

describe("AC3: sortByAttendance — worst-first ordering", () => {
  it("Happy path: rows sorted ascending by pct (worst first)", () => {
    const rows: StudentRow[] = [
      { studentId: "s1", name: "Alice", code: "001", courses: [], totalClasses: 10, attended: 8, absences: 2, pct: 80 },
      { studentId: "s3", name: "Carol", code: "003", courses: [], totalClasses: 10, attended: 2, absences: 8, pct: 20 },
      { studentId: "s2", name: "Bob",   code: "002", courses: [], totalClasses: 10, attended: 5, absences: 5, pct: 50 },
    ];
    const sorted = sortByAttendance(rows);
    expect(sorted[0].studentId).toBe("s3");
    expect(sorted[1].studentId).toBe("s2");
    expect(sorted[2].studentId).toBe("s1");
  });

  it("Edge case: single-element array returns same element; original array not mutated", () => {
    const rows: StudentRow[] = [
      { studentId: "s1", name: "Alice", code: "001", courses: [], totalClasses: 5, attended: 3, absences: 2, pct: 60 },
    ];
    const originalFirst = rows[0].studentId;
    const result = sortByAttendance(rows);
    expect(result.length).toBe(1);
    expect(rows[0].studentId).toBe(originalFirst);
  });

  it("Negative test: empty array returns empty array", () => {
    expect(sortByAttendance([])).toEqual([]);
  });

  it("No crash: array of one does not throw", () => {
    expect(() =>
      sortByAttendance([
        { studentId: "s1", name: "A", code: "001", courses: [], totalClasses: 0, attended: 0, absences: 0, pct: 0 },
      ])
    ).not.toThrow();
  });
});

// ─── AC3: buildAbsenteeRows ───────────────────────────────────────────────────

describe("AC3: buildAbsenteeRows — aggregation and course list", () => {
  it("Happy path: courses collected from enrollments and absence count correct", () => {
    const rows = buildAbsenteeRows(records, students, enrollments);
    const alice = rows.find((r) => r.studentId === "s1")!;
    expect(alice.courses).toContain("Mathematics");
    expect(alice.courses).toContain("Physics");
    const carol = rows.find((r) => r.studentId === "s3")!;
    expect(carol.absences).toBe(8);
    expect(carol.attended).toBe(2);
  });

  it("Edge case: student with no records has 0 total classes and 100% pct", () => {
    const rows = buildAbsenteeRows(records, students, enrollments);
    const dan = rows.find((r) => r.studentId === "s4")!;
    expect(dan.totalClasses).toBe(0);
    expect(dan.pct).toBe(100);
  });

  it("Negative test: records for unknown student_id are ignored", () => {
    const orphan: AttendanceRecord[] = [
      { id: "z1", student_id: "s_ghost", session_id: "s1", status: "absent", confirmed_at: "2025-01-10T09:00:00.000Z" },
    ];
    const rows = buildAbsenteeRows(orphan, students, enrollments);
    expect(rows.find((r) => r.studentId === "s_ghost")).toBeUndefined();
  });

  it("No crash: empty arrays for all params do not throw", () => {
    expect(() => buildAbsenteeRows([], [], [])).not.toThrow();
    expect(buildAbsenteeRows([], [], [])).toEqual([]);
  });
});
