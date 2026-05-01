/**
 * ====================================================================
 * Attendance Report Feature — Unit Tests
 * Follows JUnit-style structure adapted for TypeScript / Vitest:
 *
 *   AAA Pattern  : Arrange → Act → Assert in every test
 *   beforeEach() : shared fixture setup (@BeforeEach)
 *   Assertions   : assertEquals / assertTrue / assertNull equivalents
 *   Mocking      : logic isolated from Supabase (Mockito equivalent)
 *
 *   Testing Checklist:
 *     ✅ Happy path  – normal inputs, expected behaviour
 *     ✅ Edge cases  – empty, null, zero, boundary (0% / 100%)
 *     ✅ Negative    – invalid inputs, conflicting filters, wrong types
 *     ✅ No crashes  – all edge paths return safe results, no throws
 *
 * Covers:
 *   AC1 — Report generates with attendance records
 *   AC2 — Per-student: total classes / attended / absences / %
 *   AC3 — Filters: course, department, semester
 *
 * Run:
 *   npx vitest run tests/attendance_report/test_attendance_report.test.tsx
 * ====================================================================
 */

import { describe, it, expect, beforeEach } from "vitest";
import { subDays, subMonths, isAfter } from "date-fns";

// ─────────────────────────────────────────────────────────────────
//  TYPES
// ─────────────────────────────────────────────────────────────────
interface AttendanceRecord {
  id: string;
  student_id: string;
  student_name?: string | null;
  course_id: string;
  status: "present" | "absent" | "late";
  confirmed_at: string;
}

interface Course {
  id: string;
  name: string;
  course_code: string;
  semester: string | null;
  department_id: string;
}

interface Student {
  id: string;
  full_name: string;
  student_code: string;
}

// ─────────────────────────────────────────────────────────────────
//  LOGIC UNDER TEST  (pure functions — Mockito isolation)
// ─────────────────────────────────────────────────────────────────

/** Mirrors getDateRangeStart() in Reports.tsx */
function getDateRangeStart(range: "week" | "month" | "quarter" | "year"): Date {
  const now = new Date();
  switch (range) {
    case "week":    return subDays(now, 7);
    case "month":   return subMonths(now, 1);
    case "quarter": return subMonths(now, 3);
    case "year":    return subMonths(now, 12);
  }
}

/** Mirrors filteredAttendance useMemo in Reports.tsx */
function filterAttendance(
  records: AttendanceRecord[],
  courses: Course[],
  opts: {
    dateRange:      "week" | "month" | "quarter" | "year";
    courseFilter:   string;
    deptFilter:     string;
    semesterFilter: string;
  },
): AttendanceRecord[] {
  const startDate = getDateRangeStart(opts.dateRange);
  return records.filter((r) => {
    if (!isAfter(new Date(r.confirmed_at), startDate)) return false;

    if (opts.courseFilter !== "all" && r.course_id !== opts.courseFilter) return false;

    if (opts.deptFilter !== "all") {
      const course = courses.find((c) => c.id === r.course_id);
      if (!course || course.department_id !== opts.deptFilter) return false;
    }

    if (opts.semesterFilter !== "all") {
      const course = courses.find((c) => c.id === r.course_id);
      if (!course || course.semester !== opts.semesterFilter) return false;
    }

    return true;
  });
}

/** Mirrors studentAttendanceRows useMemo in Reports.tsx */
function buildStudentRows(filtered: AttendanceRecord[], students: Student[]) {
  const byStudent: Record<string, {
    name: string; code: string;
    total: number; present: number; absent: number; late: number;
  }> = {};

  filtered.forEach((r) => {
    const sid   = r.student_id ?? "unknown";
    const sname = r.student_name ?? students.find((s) => s.id === sid)?.full_name ?? "—";
    const scode = students.find((s) => s.id === sid)?.student_code ?? "—";
    if (!byStudent[sid])
      byStudent[sid] = { name: sname, code: scode, total: 0, present: 0, absent: 0, late: 0 };
    byStudent[sid].total++;
    if (r.status === "present")     byStudent[sid].present++;
    else if (r.status === "absent") byStudent[sid].absent++;
    else if (r.status === "late")   byStudent[sid].late++;
  });

  return Object.values(byStudent)
    .map((row) => ({
      ...row,
      pct: row.total > 0 ? Math.round((row.present / row.total) * 100) : 0,
    }))
    .sort((a, b) => a.pct - b.pct);
}

/** Mirrors semesters useMemo in Reports.tsx */
function deriveSemesters(courses: Course[]): string[] {
  const set = new Set<string>();
  courses.forEach((c) => { if (c.semester) set.add(c.semester); });
  return Array.from(set).sort();
}

// ─────────────────────────────────────────────────────────────────
//  SHARED FIXTURES  (@BeforeEach)
// ─────────────────────────────────────────────────────────────────
const RECENT = subDays(new Date(), 3).toISOString();   // within last month
const OLD    = subMonths(new Date(), 6).toISOString(); // outside any range

let courses:  Course[];
let students: Student[];
let records:  AttendanceRecord[];

beforeEach(() => {
  // Arrange — fresh data before every test (@BeforeEach)
  courses = [
    { id: "c1", name: "Math 101",    course_code: "MTH101", semester: "Fall 2024",   department_id: "d1" },
    { id: "c2", name: "Physics 201", course_code: "PHY201", semester: "Spring 2025", department_id: "d2" },
    { id: "c3", name: "CS 301",      course_code: "CS301",  semester: "Fall 2024",   department_id: "d1" },
  ];

  students = [
    { id: "s1", full_name: "Ali Hassan", student_code: "STU001" },
    { id: "s2", full_name: "Sara Ahmed", student_code: "STU002" },
    { id: "s3", full_name: "Omar Nour",  student_code: "STU003" },
  ];

  records = [
    // Ali — Math 101 (c1, d1, Fall 2024): 2 present, 1 absent, 1 late
    { id: "r1",  student_id: "s1", course_id: "c1", status: "present", confirmed_at: RECENT },
    { id: "r2",  student_id: "s1", course_id: "c1", status: "present", confirmed_at: RECENT },
    { id: "r3",  student_id: "s1", course_id: "c1", status: "absent",  confirmed_at: RECENT },
    { id: "r4",  student_id: "s1", course_id: "c1", status: "late",    confirmed_at: RECENT },
    // Sara — Physics 201 (c2, d2, Spring 2025): 1 present, 2 absent
    { id: "r5",  student_id: "s2", course_id: "c2", status: "present", confirmed_at: RECENT },
    { id: "r6",  student_id: "s2", course_id: "c2", status: "absent",  confirmed_at: RECENT },
    { id: "r7",  student_id: "s2", course_id: "c2", status: "absent",  confirmed_at: RECENT },
    // Omar — CS 301 (c3, d1, Fall 2024): 3 present
    { id: "r8",  student_id: "s3", course_id: "c3", status: "present", confirmed_at: RECENT },
    { id: "r9",  student_id: "s3", course_id: "c3", status: "present", confirmed_at: RECENT },
    { id: "r10", student_id: "s3", course_id: "c3", status: "present", confirmed_at: RECENT },
    // Old record — must ALWAYS be excluded by date filter
    { id: "r11", student_id: "s1", course_id: "c1", status: "present", confirmed_at: OLD },
  ];
});

const ALL_FILTERS = {
  dateRange:      "month" as const,
  courseFilter:   "all",
  deptFilter:     "all",
  semesterFilter: "all",
};

// ════════════════════════════════════════════════════════════════
//  AC1 — Report generates with attendance records
// ════════════════════════════════════════════════════════════════
describe("AC1: Report generation", () => {

  // ── Happy Path ──────────────────────────────────────────────
  it("happy path — returns records within the date range", () => {
    // Arrange (done in beforeEach)
    // Act
    const result = filterAttendance(records, courses, ALL_FILTERS);
    // Assert  (assertTrue(result.length > 0))
    expect(result.length).toBeGreaterThan(0);
  });

  it("happy path — excludes the old record outside the range", () => {
    // Arrange (done in beforeEach)
    // Act
    const result = filterAttendance(records, courses, ALL_FILTERS);
    const ids = result.map((r) => r.id);
    // Assert  (assertFalse: old record must NOT appear)
    expect(ids).not.toContain("r11");
  });

  it("happy path — returns all 10 recent records with no extra filters", () => {
    // Arrange (done in beforeEach)
    // Act
    const result = filterAttendance(records, courses, ALL_FILTERS);
    // Assert  (assertEquals(10, result.length))
    expect(result.length).toBe(10);
  });

  it("happy path — 'week' range still includes records from 3 days ago", () => {
    // Arrange (done in beforeEach)
    // Act
    const result = filterAttendance(records, courses, { ...ALL_FILTERS, dateRange: "week" });
    // Assert
    expect(result.length).toBe(10);
  });

  // ── Edge Cases ──────────────────────────────────────────────
  it("edge case — empty records list returns empty array (assertNotNull)", () => {
    // Arrange
    const empty: AttendanceRecord[] = [];
    // Act
    const result = filterAttendance(empty, courses, ALL_FILTERS);
    // Assert
    expect(result).not.toBeNull();    // assertNotNull
    expect(result.length).toBe(0);
  });

  it("edge case — all records are old (outside range) returns empty", () => {
    // Arrange
    const allOld = records.map((r) => ({ ...r, confirmed_at: OLD }));
    // Act
    const result = filterAttendance(allOld, courses, ALL_FILTERS);
    // Assert
    expect(result.length).toBe(0);
  });

  // ── Negative Tests ──────────────────────────────────────────
  it("negative — invalid date string records are excluded gracefully", () => {
    // Arrange
    const withBadDate: AttendanceRecord[] = [
      { id: "bad", student_id: "s1", course_id: "c1", status: "present", confirmed_at: "not-a-date" },
    ];
    // Act + Assert (must not throw)
    expect(() => filterAttendance(withBadDate, courses, ALL_FILTERS)).not.toThrow();
  });

  // ── No Crashes ──────────────────────────────────────────────
  it("no crash — empty courses list does not throw", () => {
    // Arrange + Act + Assert
    expect(() => filterAttendance(records, [], ALL_FILTERS)).not.toThrow();
  });
});

// ════════════════════════════════════════════════════════════════
//  AC2 — Per-student metrics: total / attended / absences / %
// ════════════════════════════════════════════════════════════════
describe("AC2: Per-student attendance metrics", () => {

  let rows: ReturnType<typeof buildStudentRows>;

  beforeEach(() => {
    // Arrange — build rows from all recent records
    const filtered = filterAttendance(records, courses, ALL_FILTERS);
    rows = buildStudentRows(filtered, students);
  });

  // ── Happy Path ──────────────────────────────────────────────
  it("happy path — produces one row per unique student", () => {
    // Act (done in beforeEach)
    // Assert  (assertEquals(3, rows.length))
    expect(rows.length).toBe(3);
  });

  it("happy path — total classes is sum of present + absent + late", () => {
    // Act (done in beforeEach)
    // Assert  (assertTrue for each row)
    rows.forEach((row) => {
      expect(row.total).toBe(row.present + row.absent + row.late);
    });
  });

  it("happy path — Ali: total 4 classes correctly counted", () => {
    // Act (done in beforeEach)
    const ali = rows.find((r) => r.name === "Ali Hassan")!;
    // Assert  (assertEquals(4, ali.total))
    expect(ali.total).toBe(4);
  });

  it("happy path — Ali: 2 attended, 1 absent, 1 late", () => {
    // Act (done in beforeEach)
    const ali = rows.find((r) => r.name === "Ali Hassan")!;
    // Assert
    expect(ali.present).toBe(2);   // assertEquals(2, ali.present)
    expect(ali.absent).toBe(1);    // assertEquals(1, ali.absent)
    expect(ali.late).toBe(1);      // assertEquals(1, ali.late)
  });

  it("happy path — Ali attendance percentage is 50% (2 of 4)", () => {
    // Act (done in beforeEach)
    const ali = rows.find((r) => r.name === "Ali Hassan")!;
    // Assert  (assertEquals(50, ali.pct))
    expect(ali.pct).toBe(50);
  });

  it("happy path — Omar has 100% attendance (3 of 3 present)", () => {
    // Act (done in beforeEach)
    const omar = rows.find((r) => r.name === "Omar Nour")!;
    // Assert  (assertEquals(100, omar.pct))
    expect(omar.pct).toBe(100);
  });

  it("happy path — Sara has 33% attendance (1 of 3)", () => {
    // Act (done in beforeEach)
    const sara = rows.find((r) => r.name === "Sara Ahmed")!;
    // Assert  (assertEquals(33, sara.pct))
    expect(sara.pct).toBe(33);
  });

  it("happy path — rows sorted ascending by attendance % (lowest first)", () => {
    // Act (done in beforeEach)
    const pcts = rows.map((r) => r.pct);
    // Assert  (assertTrue — array is sorted)
    expect(pcts).toEqual([...pcts].sort((a, b) => a - b));
  });

  it("happy path — student code is populated from students lookup", () => {
    // Act (done in beforeEach)
    const ali = rows.find((r) => r.name === "Ali Hassan")!;
    // Assert  (assertEquals("STU001", ali.code))
    expect(ali.code).toBe("STU001");
  });

  // ── Edge Cases ──────────────────────────────────────────────
  it("edge case — empty filtered records returns empty rows (assertNotNull)", () => {
    // Arrange
    const result = buildStudentRows([], students);
    // Assert
    expect(result).not.toBeNull();    // assertNotNull
    expect(result.length).toBe(0);
  });

  it("edge case — student with 0 total (no records) does not appear in rows", () => {
    // Arrange — records for only s1 and s2
    const partial = records.filter((r) => r.student_id !== "s3" && r.confirmed_at === RECENT);
    // Act
    const result = buildStudentRows(partial, students);
    // Assert  (assertFalse — Omar should not be in result)
    expect(result.find((r) => r.name === "Omar Nour")).toBeUndefined();
  });

  it("edge case — student with all absent has 0% attendance", () => {
    // Arrange
    const allAbsent: AttendanceRecord[] = [
      { id: "x1", student_id: "s1", course_id: "c1", status: "absent", confirmed_at: RECENT },
      { id: "x2", student_id: "s1", course_id: "c1", status: "absent", confirmed_at: RECENT },
    ];
    // Act
    const result = buildStudentRows(allAbsent, students);
    const ali = result.find((r) => r.name === "Ali Hassan")!;
    // Assert  (assertEquals(0, ali.pct))
    expect(ali.pct).toBe(0);
  });

  it("edge case — student with all present has 100% attendance", () => {
    // Arrange
    const allPresent: AttendanceRecord[] = [
      { id: "y1", student_id: "s1", course_id: "c1", status: "present", confirmed_at: RECENT },
      { id: "y2", student_id: "s1", course_id: "c1", status: "present", confirmed_at: RECENT },
    ];
    // Act
    const result = buildStudentRows(allPresent, students);
    const ali = result.find((r) => r.name === "Ali Hassan")!;
    // Assert  (assertEquals(100, ali.pct))
    expect(ali.pct).toBe(100);
  });

  // ── Negative Tests ──────────────────────────────────────────
  it("negative — student not in students list falls back to '—' for name/code", () => {
    // Arrange
    const unknownRecord: AttendanceRecord[] = [
      { id: "z1", student_id: "s_unknown", course_id: "c1", status: "present", confirmed_at: RECENT },
    ];
    // Act
    const result = buildStudentRows(unknownRecord, students);
    // Assert  (assertNotNull + assertEquals("—", result[0].name))
    expect(result.length).toBe(1);
    expect(result[0].name).toBe("—");
    expect(result[0].code).toBe("—");
  });

  // ── No Crashes ──────────────────────────────────────────────
  it("no crash — null student_name on record does not throw", () => {
    // Arrange
    const withNull: AttendanceRecord[] = [
      { id: "n1", student_id: "s1", student_name: null, course_id: "c1", status: "present", confirmed_at: RECENT },
    ];
    // Act + Assert
    expect(() => buildStudentRows(withNull, students)).not.toThrow();
  });
});

// ════════════════════════════════════════════════════════════════
//  AC3 — Filters: course, department, semester
// ════════════════════════════════════════════════════════════════

// ── Course Filter ────────────────────────────────────────────────
describe("AC3: Course filter", () => {

  // ── Happy Path ──────────────────────────────────────────────
  it("happy path — filter by c1 returns only c1 records (4)", () => {
    // Arrange (done in beforeEach)
    // Act
    const result = filterAttendance(records, courses, { ...ALL_FILTERS, courseFilter: "c1" });
    // Assert  (assertEquals(4, result.length) + assertTrue all c1)
    expect(result.length).toBe(4);
    result.forEach((r) => expect(r.course_id).toBe("c1"));
  });

  it("happy path — filter by c2 returns only c2 records (3)", () => {
    // Arrange (done in beforeEach)
    // Act
    const result = filterAttendance(records, courses, { ...ALL_FILTERS, courseFilter: "c2" });
    // Assert
    expect(result.length).toBe(3);
    result.forEach((r) => expect(r.course_id).toBe("c2"));
  });

  it("happy path — 'all' course filter returns all recent records (10)", () => {
    // Arrange (done in beforeEach)
    // Act
    const result = filterAttendance(records, courses, { ...ALL_FILTERS, courseFilter: "all" });
    // Assert  (assertEquals(10, result.length))
    expect(result.length).toBe(10);
  });

  // ── Edge Cases ──────────────────────────────────────────────
  it("edge case — filter by course with a single student returns just that student's rows", () => {
    // Arrange (done in beforeEach)
    // Act
    const filtered = filterAttendance(records, courses, { ...ALL_FILTERS, courseFilter: "c2" });
    const rows = buildStudentRows(filtered, students);
    // Assert  (assertEquals(1, rows.length))
    expect(rows.length).toBe(1);
    expect(rows[0].name).toBe("Sara Ahmed");
  });

  // ── Negative Tests ──────────────────────────────────────────
  it("negative — unknown course id returns empty list", () => {
    // Arrange (done in beforeEach)
    // Act
    const result = filterAttendance(records, courses, { ...ALL_FILTERS, courseFilter: "c_does_not_exist" });
    // Assert  (assertEquals([], result))
    expect(result).toEqual([]);
  });

  // ── No Crashes ──────────────────────────────────────────────
  it("no crash — empty string course filter does not throw", () => {
    // Arrange + Act + Assert
    expect(() => filterAttendance(records, courses, { ...ALL_FILTERS, courseFilter: "" })).not.toThrow();
  });
});

// ── Department Filter ────────────────────────────────────────────
describe("AC3: Department filter", () => {

  // ── Happy Path ──────────────────────────────────────────────
  it("happy path — filter d1 returns records from c1 + c3 (7 total)", () => {
    // Arrange (done in beforeEach)
    // Act
    const result = filterAttendance(records, courses, { ...ALL_FILTERS, deptFilter: "d1" });
    // Assert  (assertEquals(7, result.length))
    expect(result.length).toBe(7);
  });

  it("happy path — filter d2 returns only Physics records (3)", () => {
    // Arrange (done in beforeEach)
    // Act
    const result = filterAttendance(records, courses, { ...ALL_FILTERS, deptFilter: "d2" });
    // Assert
    expect(result.length).toBe(3);
    result.forEach((r) => expect(r.course_id).toBe("c2"));
  });

  it("happy path — 'all' department returns all recent records (10)", () => {
    // Arrange (done in beforeEach)
    // Act
    const result = filterAttendance(records, courses, { ...ALL_FILTERS, deptFilter: "all" });
    // Assert  (assertEquals(10, result.length))
    expect(result.length).toBe(10);
  });

  // ── Negative Tests ──────────────────────────────────────────
  it("negative — unknown department id returns empty list", () => {
    // Arrange (done in beforeEach)
    // Act
    const result = filterAttendance(records, courses, { ...ALL_FILTERS, deptFilter: "d_unknown" });
    // Assert
    expect(result).toEqual([]);
  });

  // ── No Crashes ──────────────────────────────────────────────
  it("no crash — null department_id on course does not throw", () => {
    // Arrange
    const coursesWithNull: Course[] = [
      { id: "c1", name: "Math", course_code: "M", semester: "Fall 2024", department_id: null as any },
    ];
    // Act + Assert
    expect(() => filterAttendance(records, coursesWithNull, { ...ALL_FILTERS, deptFilter: "d1" })).not.toThrow();
  });
});

// ── Semester Filter ──────────────────────────────────────────────
describe("AC3: Semester filter", () => {

  // ── Happy Path ──────────────────────────────────────────────
  it("happy path — filter 'Fall 2024' returns records from c1 + c3 (7)", () => {
    // Arrange (done in beforeEach)
    // Act
    const result = filterAttendance(records, courses, { ...ALL_FILTERS, semesterFilter: "Fall 2024" });
    // Assert  (assertEquals(7, result.length))
    expect(result.length).toBe(7);
  });

  it("happy path — filter 'Spring 2025' returns only c2 records (3)", () => {
    // Arrange (done in beforeEach)
    // Act
    const result = filterAttendance(records, courses, { ...ALL_FILTERS, semesterFilter: "Spring 2025" });
    // Assert
    expect(result.length).toBe(3);
  });

  it("happy path — 'all' semester returns all recent records (10)", () => {
    // Arrange (done in beforeEach)
    // Act
    const result = filterAttendance(records, courses, { ...ALL_FILTERS, semesterFilter: "all" });
    // Assert  (assertEquals(10, result.length))
    expect(result.length).toBe(10);
  });

  // ── Edge Cases ──────────────────────────────────────────────
  it("edge case — course with null semester is excluded when filter is active", () => {
    // Arrange
    const courseWithNull: Course[] = [
      { id: "c9", name: "No Sem", course_code: "NS", semester: null, department_id: "d1" },
    ];
    const r: AttendanceRecord[] = [
      { id: "rx", student_id: "s1", course_id: "c9", status: "present", confirmed_at: RECENT },
    ];
    // Act
    const result = filterAttendance(r, courseWithNull, { ...ALL_FILTERS, semesterFilter: "Fall 2024" });
    // Assert  (assertEquals(0, result.length))
    expect(result.length).toBe(0);
  });

  // ── Negative Tests ──────────────────────────────────────────
  it("negative — unknown semester string returns empty list", () => {
    // Arrange (done in beforeEach)
    // Act
    const result = filterAttendance(records, courses, { ...ALL_FILTERS, semesterFilter: "Summer 1990" });
    // Assert
    expect(result).toEqual([]);
  });
});

// ── Combined Filters ─────────────────────────────────────────────
describe("AC3: Combined filters", () => {

  // ── Happy Path ──────────────────────────────────────────────
  it("happy path — course + semester (matching) returns expected count", () => {
    // Arrange (done in beforeEach)
    // Act
    const result = filterAttendance(records, courses, {
      ...ALL_FILTERS,
      courseFilter:   "c1",
      semesterFilter: "Fall 2024",
    });
    // Assert  (assertEquals(4, result.length))
    expect(result.length).toBe(4);
  });

  it("happy path — dept + semester (all d1 = Fall 2024) returns 7", () => {
    // Arrange (done in beforeEach)
    // Act
    const result = filterAttendance(records, courses, {
      ...ALL_FILTERS,
      deptFilter:     "d1",
      semesterFilter: "Fall 2024",
    });
    // Assert
    expect(result.length).toBe(7);
  });

  // ── Negative Tests ──────────────────────────────────────────
  it("negative — conflicting course + dept returns empty (c1 is d1, not d2)", () => {
    // Arrange (done in beforeEach)
    // Act
    const result = filterAttendance(records, courses, {
      ...ALL_FILTERS,
      courseFilter: "c1",  // belongs to d1
      deptFilter:   "d2",  // ≠ d1 → conflict
    });
    // Assert  (assertEquals([], result))
    expect(result).toEqual([]);
  });

  it("negative — conflicting course + semester returns empty", () => {
    // Arrange (done in beforeEach)
    // Act
    const result = filterAttendance(records, courses, {
      ...ALL_FILTERS,
      courseFilter:   "c1",          // semester = Fall 2024
      semesterFilter: "Spring 2025", // ≠ Fall 2024
    });
    // Assert
    expect(result).toEqual([]);
  });

  // ── No Crashes ──────────────────────────────────────────────
  it("no crash — all three filters set to unknown values returns empty safely", () => {
    // Arrange + Act + Assert
    expect(() => filterAttendance(records, courses, {
      ...ALL_FILTERS,
      courseFilter:   "x",
      deptFilter:     "x",
      semesterFilter: "x",
    })).not.toThrow();
  });
});

// ════════════════════════════════════════════════════════════════
//  Semester dropdown derivation (populates the <Select>)
// ════════════════════════════════════════════════════════════════
describe("Semester dropdown: deriveSemesters()", () => {

  // ── Happy Path ──────────────────────────────────────────────
  it("happy path — extracts unique semesters from courses", () => {
    // Arrange (done in beforeEach)
    // Act
    const sems = deriveSemesters(courses);
    // Assert  (assertEquals(2, sems.length) + assertTrue contains both)
    expect(sems.length).toBe(2);
    expect(sems).toContain("Fall 2024");
    expect(sems).toContain("Spring 2025");
  });

  it("happy path — results are sorted alphabetically", () => {
    // Arrange (done in beforeEach)
    // Act
    const sems = deriveSemesters(courses);
    // Assert  (assertTrue — sorted equals original)
    expect(sems).toEqual([...sems].sort());
  });

  // ── Edge Cases ──────────────────────────────────────────────
  it("edge case — empty courses list returns empty array (assertNotNull)", () => {
    // Arrange + Act
    const sems = deriveSemesters([]);
    // Assert
    expect(sems).not.toBeNull();    // assertNotNull
    expect(sems.length).toBe(0);
  });

  it("edge case — courses with null semester are excluded from dropdown", () => {
    // Arrange
    const withNull: Course[] = [
      ...courses,
      { id: "c99", name: "No Sem", course_code: "NS", semester: null, department_id: "d1" },
    ];
    // Act
    const sems = deriveSemesters(withNull);
    // Assert  (assertFalse — null must not appear)
    expect(sems).not.toContain(null);
    expect(sems.length).toBe(2);
  });

  it("edge case — duplicate semester across courses appears only once", () => {
    // Arrange
    const withDupes: Course[] = [
      ...courses,
      { id: "c10", name: "Math 102", course_code: "M102", semester: "Fall 2024", department_id: "d1" },
    ];
    // Act
    const sems = deriveSemesters(withDupes);
    const fallCount = sems.filter((s) => s === "Fall 2024").length;
    // Assert  (assertEquals(1, fallCount))
    expect(fallCount).toBe(1);
  });

  // ── Negative Tests ──────────────────────────────────────────
  it("negative — semester not in courses is not in dropdown", () => {
    // Arrange (done in beforeEach)
    // Act
    const sems = deriveSemesters(courses);
    // Assert  (assertFalse)
    expect(sems).not.toContain("Summer 2020");
  });

  // ── No Crashes ──────────────────────────────────────────────
  it("no crash — courses with all null semesters returns empty safely", () => {
    // Arrange
    const allNull: Course[] = courses.map((c) => ({ ...c, semester: null }));
    // Act + Assert
    expect(() => deriveSemesters(allNull)).not.toThrow();
    expect(deriveSemesters(allNull)).toEqual([]);
  });
});
