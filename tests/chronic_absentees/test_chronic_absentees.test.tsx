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

// ─── TEST DATA ────────────────────────────────────────────────────────────────

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
    // s4 has no enrollments
  ];

  records = [
    // Alice: 10 sessions, 8 attended (80%) — not chronic
    ...Array.from({ length: 8 }, (_, i) => ({
      id: `a_p${i}`, student_id: "s1", session_id: `sess${i}`,
      status: "present" as const, confirmed_at: "2025-01-10T09:00:00.000Z",
    })),
    ...Array.from({ length: 2 }, (_, i) => ({
      id: `a_ab${i}`, student_id: "s1", session_id: `sess${i + 8}`,
      status: "absent" as const, confirmed_at: "2025-01-10T09:00:00.000Z",
    })),

    // Bob: 10 sessions, 5 attended (50%) — borderline, below 60% threshold
    ...Array.from({ length: 5 }, (_, i) => ({
      id: `b_p${i}`, student_id: "s2", session_id: `sess${i + 10}`,
      status: "present" as const, confirmed_at: "2025-01-10T09:00:00.000Z",
    })),
    ...Array.from({ length: 5 }, (_, i) => ({
      id: `b_ab${i}`, student_id: "s2", session_id: `sess${i + 15}`,
      status: "absent" as const, confirmed_at: "2025-01-10T09:00:00.000Z",
    })),

    // Carol: 10 sessions, 2 attended (20%) — severely chronic
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

// ─── AC1: isChronicAbsentee — identifies students below threshold ──────────────

describe("AC1: isChronicAbsentee — threshold evaluation", () => {
  it("Happy path: student attending 40% with 60% threshold is chronic absentee", () => {
    // Arrange
    const totalClasses = 10;
    const attended = 4;
    const threshold = 60;
    // Act
    const result = isChronicAbsentee(totalClasses, attended, threshold);
    // Assert
    expect(result).toBe(true);
  });

  it("Happy path: student attending exactly at threshold is NOT chronic absentee", () => {
    // Arrange
    const totalClasses = 10;
    const attended = 6; // 60% exactly — not below threshold
    const threshold = 60;
    // Act
    const result = isChronicAbsentee(totalClasses, attended, threshold);
    // Assert
    expect(result).toBe(false);
  });

  it("Happy path: student attending 80% with default 60% threshold is not chronic", () => {
    // Arrange
    const totalClasses = 10;
    const attended = 8;
    const threshold = 60;
    // Act
    const result = isChronicAbsentee(totalClasses, attended, threshold);
    // Assert
    expect(result).toBe(false);
  });

  it("Edge case: 0 total classes returns false (no data is not an absence)", () => {
    // Arrange
    const totalClasses = 0;
    const attended = 0;
    const threshold = 60;
    // Act
    const result = isChronicAbsentee(totalClasses, attended, threshold);
    // Assert
    expect(result).toBe(false);
  });

  it("Negative test: student attending 0% is always chronic absentee", () => {
    // Arrange
    const totalClasses = 5;
    const attended = 0;
    const threshold = 60;
    // Act
    const result = isChronicAbsentee(totalClasses, attended, threshold);
    // Assert
    expect(result).toBe(true);
  });

  it("No crash: very high threshold (99%) does not throw", () => {
    // Arrange + Act + Assert
    expect(() => isChronicAbsentee(10, 9, 99)).not.toThrow();
    expect(isChronicAbsentee(10, 9, 99)).toBe(true); // 90% < 99%
  });
});

// ─── AC2: filterChronicAbsentees — list of students below threshold ────────────

describe("AC2: filterChronicAbsentees — filtering by threshold", () => {
  it("Happy path: default 60% threshold filters out students above it", () => {
    // Arrange
    const allRows = buildAbsenteeRows(records, students, enrollments);
    // Act
    const result = filterChronicAbsentees(allRows, 60);
    const studentIds = result.map((r) => r.studentId);
    // Assert — only Bob (50%) and Carol (20%) should be flagged
    expect(studentIds).toContain("s2");
    expect(studentIds).toContain("s3");
    expect(studentIds).not.toContain("s1"); // Alice 80%
    expect(studentIds).not.toContain("s4"); // Dan 0 classes → not flagged
  });

  it("Happy path: raising threshold to 85% also flags Alice", () => {
    // Arrange
    const allRows = buildAbsenteeRows(records, students, enrollments);
    // Act
    const result = filterChronicAbsentees(allRows, 85);
    const studentIds = result.map((r) => r.studentId);
    // Assert
    expect(studentIds).toContain("s1");
    expect(studentIds).toContain("s2");
    expect(studentIds).toContain("s3");
  });

  it("Edge case: threshold of 0% returns no one as chronic", () => {
    // Arrange
    const allRows = buildAbsenteeRows(records, students, enrollments);
    // Act — 0% threshold means attended/total < 0 which is never true
    const result = filterChronicAbsentees(allRows, 0);
    // Assert
    expect(result).toEqual([]);
  });

  it("Edge case: empty rows array returns empty result", () => {
    // Arrange
    const empty: StudentRow[] = [];
    // Act
    const result = filterChronicAbsentees(empty, 60);
    // Assert
    expect(result).toEqual([]);
  });

  it("Negative test: threshold 100% flags every student with at least one absence", () => {
    // Arrange
    const allRows = buildAbsenteeRows(records, students, enrollments);
    const withClasses = allRows.filter((r) => r.totalClasses > 0 && r.pct < 100);
    // Act
    const result = filterChronicAbsentees(allRows, 100);
    // Assert
    expect(result.length).toBe(withClasses.length);
  });

  it("No crash: null-like threshold (0) does not throw", () => {
    // Arrange
    const allRows = buildAbsenteeRows(records, students, enrollments);
    // Act + Assert
    expect(() => filterChronicAbsentees(allRows, 0)).not.toThrow();
  });
});

// ─── AC3: sortByAttendance and buildAbsenteeRows — display data ───────────────

describe("AC3: sortByAttendance — worst-first ordering", () => {
  it("Happy path: rows are sorted ascending by pct (worst first)", () => {
    // Arrange
    const rows: StudentRow[] = [
      { studentId: "s1", name: "Alice", code: "001", courses: [], totalClasses: 10, attended: 8, absences: 2, pct: 80 },
      { studentId: "s3", name: "Carol", code: "003", courses: [], totalClasses: 10, attended: 2, absences: 8, pct: 20 },
      { studentId: "s2", name: "Bob",   code: "002", courses: [], totalClasses: 10, attended: 5, absences: 5, pct: 50 },
    ];
    // Act
    const sorted = sortByAttendance(rows);
    // Assert — Carol (20%) first, Bob (50%) second, Alice (80%) third
    expect(sorted[0].studentId).toBe("s3");
    expect(sorted[1].studentId).toBe("s2");
    expect(sorted[2].studentId).toBe("s1");
  });

  it("Happy path: original array is not mutated", () => {
    // Arrange
    const rows: StudentRow[] = [
      { studentId: "s1", name: "Alice", code: "001", courses: [], totalClasses: 10, attended: 8, absences: 2, pct: 80 },
      { studentId: "s2", name: "Bob",   code: "002", courses: [], totalClasses: 10, attended: 2, absences: 8, pct: 20 },
    ];
    const originalFirst = rows[0].studentId;
    // Act
    sortByAttendance(rows);
    // Assert
    expect(rows[0].studentId).toBe(originalFirst);
  });

  it("Edge case: single-element array returns same element", () => {
    // Arrange
    const rows: StudentRow[] = [
      { studentId: "s1", name: "Alice", code: "001", courses: [], totalClasses: 5, attended: 3, absences: 2, pct: 60 },
    ];
    // Act
    const result = sortByAttendance(rows);
    // Assert
    expect(result.length).toBe(1);
    expect(result[0].studentId).toBe("s1");
  });

  it("Edge case: rows with same pct preserve relative order (stable-ish)", () => {
    // Arrange
    const rows: StudentRow[] = [
      { studentId: "s1", name: "A", code: "001", courses: [], totalClasses: 10, attended: 5, absences: 5, pct: 50 },
      { studentId: "s2", name: "B", code: "002", courses: [], totalClasses: 10, attended: 5, absences: 5, pct: 50 },
    ];
    // Act
    const result = sortByAttendance(rows);
    // Assert — both are included
    expect(result.length).toBe(2);
    expect(result.map((r) => r.pct)).toEqual([50, 50]);
  });

  it("Negative test: empty array returns empty array", () => {
    // Arrange
    const empty: StudentRow[] = [];
    // Act
    const result = sortByAttendance(empty);
    // Assert
    expect(result).toEqual([]);
  });

  it("No crash: array of one does not throw", () => {
    // Arrange + Act + Assert
    expect(() =>
      sortByAttendance([
        { studentId: "s1", name: "A", code: "001", courses: [], totalClasses: 0, attended: 0, absences: 0, pct: 0 },
      ])
    ).not.toThrow();
  });
});

describe("AC3: buildAbsenteeRows — aggregation and course list", () => {
  it("Happy path: student courses are correctly collected from enrollments", () => {
    // Arrange — Alice enrolled in Mathematics + Physics
    // Act
    const rows = buildAbsenteeRows(records, students, enrollments);
    const alice = rows.find((r) => r.studentId === "s1")!;
    // Assert
    expect(alice.courses).toContain("Mathematics");
    expect(alice.courses).toContain("Physics");
    expect(alice.courses.length).toBe(2);
  });

  it("Happy path: absence count equals sessions where status is 'absent'", () => {
    // Arrange
    // Act
    const rows = buildAbsenteeRows(records, students, enrollments);
    const carol = rows.find((r) => r.studentId === "s3")!;
    // Assert — Carol has 8 absent + 2 late (late counts as attended)
    expect(carol.absences).toBe(8);
    expect(carol.attended).toBe(2);
  });

  it("Edge case: student with no records has 100% pct (treated as no-data)", () => {
    // Arrange — Dan has no records
    // Act
    const rows = buildAbsenteeRows(records, students, enrollments);
    const dan = rows.find((r) => r.studentId === "s4")!;
    // Assert
    expect(dan.totalClasses).toBe(0);
    expect(dan.pct).toBe(100);
  });

  it("Edge case: duplicate enrollment entries do not duplicate course names", () => {
    // Arrange — add duplicate enrollment for Alice in Mathematics
    const withDupe: Enrollment[] = [
      ...enrollments,
      { student_id: "s1", course_id: "c1", course_name: "Mathematics" },
    ];
    // Act
    const rows = buildAbsenteeRows(records, students, withDupe);
    const alice = rows.find((r) => r.studentId === "s1")!;
    // Assert — still only one "Mathematics" entry
    expect(alice.courses.filter((c) => c === "Mathematics").length).toBe(1);
  });

  it("Negative test: records for unknown student_id are ignored gracefully", () => {
    // Arrange
    const orphan: AttendanceRecord[] = [
      { id: "z1", student_id: "s_ghost", session_id: "s1", status: "absent", confirmed_at: "2025-01-10T09:00:00.000Z" },
    ];
    // Act
    const rows = buildAbsenteeRows(orphan, students, enrollments);
    // Assert — ghost student doesn't appear
    expect(rows.find((r) => r.studentId === "s_ghost")).toBeUndefined();
  });

  it("No crash: empty arrays for all params do not throw", () => {
    // Arrange + Act + Assert
    expect(() => buildAbsenteeRows([], [], [])).not.toThrow();
    expect(buildAbsenteeRows([], [], [])).toEqual([]);
  });
});
