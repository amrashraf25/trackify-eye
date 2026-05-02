/**
 * ====================================================================
 * Attendance Report Feature — Unit Tests
 * Exactly 4 tests per function: Happy path / Edge case / Negative / No crash
 * ====================================================================
 */

import { describe, it, expect, beforeEach } from "vitest";
import { subDays, subMonths, isAfter } from "date-fns";

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

function getDateRangeStart(range: "week" | "month" | "quarter" | "year"): Date {
  const now = new Date();
  switch (range) {
    case "week":    return subDays(now, 7);
    case "month":   return subMonths(now, 1);
    case "quarter": return subMonths(now, 3);
    case "year":    return subMonths(now, 12);
  }
}

function filterAttendance(
  records: AttendanceRecord[],
  courses: Course[],
  opts: { dateRange: "week" | "month" | "quarter" | "year"; courseFilter: string; deptFilter: string; semesterFilter: string },
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

function buildStudentRows(filtered: AttendanceRecord[], students: Student[]) {
  const byStudent: Record<string, { name: string; code: string; total: number; present: number; absent: number; late: number }> = {};
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
    .map((row) => ({ ...row, pct: row.total > 0 ? Math.round((row.present / row.total) * 100) : 0 }))
    .sort((a, b) => a.pct - b.pct);
}

function deriveSemesters(courses: Course[]): string[] {
  const set = new Set<string>();
  courses.forEach((c) => { if (c.semester) set.add(c.semester); });
  return Array.from(set).sort();
}

const RECENT = subDays(new Date(), 3).toISOString();
const OLD    = subMonths(new Date(), 6).toISOString();

let courses: Course[];
let students: Student[];
let records: AttendanceRecord[];

beforeEach(() => {
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
    { id: "r1",  student_id: "s1", course_id: "c1", status: "present", confirmed_at: RECENT },
    { id: "r2",  student_id: "s1", course_id: "c1", status: "present", confirmed_at: RECENT },
    { id: "r3",  student_id: "s1", course_id: "c1", status: "absent",  confirmed_at: RECENT },
    { id: "r4",  student_id: "s1", course_id: "c1", status: "late",    confirmed_at: RECENT },
    { id: "r5",  student_id: "s2", course_id: "c2", status: "present", confirmed_at: RECENT },
    { id: "r6",  student_id: "s2", course_id: "c2", status: "absent",  confirmed_at: RECENT },
    { id: "r7",  student_id: "s2", course_id: "c2", status: "absent",  confirmed_at: RECENT },
    { id: "r8",  student_id: "s3", course_id: "c3", status: "present", confirmed_at: RECENT },
    { id: "r9",  student_id: "s3", course_id: "c3", status: "present", confirmed_at: RECENT },
    { id: "r10", student_id: "s3", course_id: "c3", status: "present", confirmed_at: RECENT },
    { id: "r11", student_id: "s1", course_id: "c1", status: "present", confirmed_at: OLD }, // old — must be excluded
  ];
});

const ALL_FILTERS = { dateRange: "month" as const, courseFilter: "all", deptFilter: "all", semesterFilter: "all" };

// ─── AC1: Report generation ───────────────────────────────────────────────────

describe("AC1: Report generation", () => {
  it("Happy path: returns 10 recent records and excludes old record (r11)", () => {
    const result = filterAttendance(records, courses, ALL_FILTERS);
    expect(result.length).toBe(10);
    expect(result.map((r) => r.id)).not.toContain("r11");
  });

  it("Edge case: empty records list returns empty array", () => {
    const result = filterAttendance([], courses, ALL_FILTERS);
    expect(result).not.toBeNull();
    expect(result.length).toBe(0);
  });

  it("Negative test: invalid date string records are handled without throwing", () => {
    const withBadDate: AttendanceRecord[] = [
      { id: "bad", student_id: "s1", course_id: "c1", status: "present", confirmed_at: "not-a-date" },
    ];
    expect(() => filterAttendance(withBadDate, courses, ALL_FILTERS)).not.toThrow();
  });

  it("No crash: empty courses list does not throw", () => {
    expect(() => filterAttendance(records, [], ALL_FILTERS)).not.toThrow();
  });
});

// ─── AC2: Per-student attendance metrics ─────────────────────────────────────

describe("AC2: Per-student attendance metrics", () => {
  it("Happy path: correct totals, percentages, and sort order for all students", () => {
    const filtered = filterAttendance(records, courses, ALL_FILTERS);
    const rows = buildStudentRows(filtered, students);
    expect(rows.length).toBe(3);
    const ali = rows.find((r) => r.name === "Ali Hassan")!;
    expect(ali.total).toBe(4);
    expect(ali.present).toBe(2);
    expect(ali.pct).toBe(50);
    const omar = rows.find((r) => r.name === "Omar Nour")!;
    expect(omar.pct).toBe(100);
    const pcts = rows.map((r) => r.pct);
    expect(pcts).toEqual([...pcts].sort((a, b) => a - b));
  });

  it("Edge case: student with all absent gets 0% pct; all present gets 100% pct", () => {
    const allAbsent: AttendanceRecord[] = [
      { id: "x1", student_id: "s1", course_id: "c1", status: "absent", confirmed_at: RECENT },
      { id: "x2", student_id: "s1", course_id: "c1", status: "absent", confirmed_at: RECENT },
    ];
    expect(buildStudentRows(allAbsent, students)[0].pct).toBe(0);
    const allPresent: AttendanceRecord[] = [
      { id: "y1", student_id: "s1", course_id: "c1", status: "present", confirmed_at: RECENT },
    ];
    expect(buildStudentRows(allPresent, students)[0].pct).toBe(100);
  });

  it("Negative test: student not in list falls back to '—' for name and code", () => {
    const unknown: AttendanceRecord[] = [
      { id: "z1", student_id: "s_unknown", course_id: "c1", status: "present", confirmed_at: RECENT },
    ];
    const result = buildStudentRows(unknown, students);
    expect(result[0].name).toBe("—");
    expect(result[0].code).toBe("—");
  });

  it("No crash: null student_name and empty filtered array do not throw", () => {
    const withNull: AttendanceRecord[] = [
      { id: "n1", student_id: "s1", student_name: null, course_id: "c1", status: "present", confirmed_at: RECENT },
    ];
    expect(() => buildStudentRows(withNull, students)).not.toThrow();
    expect(buildStudentRows([], students).length).toBe(0);
  });
});

// ─── AC3: Course filter ───────────────────────────────────────────────────────

describe("AC3: Course filter", () => {
  it("Happy path: filter by c1 returns only c1 records (4); 'all' returns all 10", () => {
    const c1 = filterAttendance(records, courses, { ...ALL_FILTERS, courseFilter: "c1" });
    expect(c1.length).toBe(4);
    c1.forEach((r) => expect(r.course_id).toBe("c1"));
    expect(filterAttendance(records, courses, { ...ALL_FILTERS, courseFilter: "all" }).length).toBe(10);
  });

  it("Edge case: filter by course with a single student returns only that student's rows", () => {
    const filtered = filterAttendance(records, courses, { ...ALL_FILTERS, courseFilter: "c2" });
    const rows = buildStudentRows(filtered, students);
    expect(rows.length).toBe(1);
    expect(rows[0].name).toBe("Sara Ahmed");
  });

  it("Negative test: unknown course id returns empty list", () => {
    expect(filterAttendance(records, courses, { ...ALL_FILTERS, courseFilter: "c_does_not_exist" })).toEqual([]);
  });

  it("No crash: empty string course filter does not throw", () => {
    expect(() => filterAttendance(records, courses, { ...ALL_FILTERS, courseFilter: "" })).not.toThrow();
  });
});

// ─── AC3: Department filter ───────────────────────────────────────────────────

describe("AC3: Department filter", () => {
  it("Happy path: filter d1 returns 7 records (c1+c3); filter d2 returns 3 (c2 only)", () => {
    expect(filterAttendance(records, courses, { ...ALL_FILTERS, deptFilter: "d1" }).length).toBe(7);
    const d2 = filterAttendance(records, courses, { ...ALL_FILTERS, deptFilter: "d2" });
    expect(d2.length).toBe(3);
    d2.forEach((r) => expect(r.course_id).toBe("c2"));
  });

  it("Edge case: 'all' department returns all recent records (10)", () => {
    expect(filterAttendance(records, courses, { ...ALL_FILTERS, deptFilter: "all" }).length).toBe(10);
  });

  it("Negative test: unknown department id returns empty list", () => {
    expect(filterAttendance(records, courses, { ...ALL_FILTERS, deptFilter: "d_unknown" })).toEqual([]);
  });

  it("No crash: null department_id on course does not throw", () => {
    const coursesWithNull: Course[] = [
      { id: "c1", name: "Math", course_code: "M", semester: "Fall 2024", department_id: null as any },
    ];
    expect(() => filterAttendance(records, coursesWithNull, { ...ALL_FILTERS, deptFilter: "d1" })).not.toThrow();
  });
});

// ─── AC3: Semester filter ─────────────────────────────────────────────────────

describe("AC3: Semester filter", () => {
  it("Happy path: filter 'Fall 2024' returns 7; filter 'Spring 2025' returns 3", () => {
    expect(filterAttendance(records, courses, { ...ALL_FILTERS, semesterFilter: "Fall 2024" }).length).toBe(7);
    expect(filterAttendance(records, courses, { ...ALL_FILTERS, semesterFilter: "Spring 2025" }).length).toBe(3);
  });

  it("Edge case: course with null semester is excluded when semester filter is active", () => {
    const courseWithNull: Course[] = [
      { id: "c9", name: "No Sem", course_code: "NS", semester: null, department_id: "d1" },
    ];
    const r: AttendanceRecord[] = [
      { id: "rx", student_id: "s1", course_id: "c9", status: "present", confirmed_at: RECENT },
    ];
    expect(filterAttendance(r, courseWithNull, { ...ALL_FILTERS, semesterFilter: "Fall 2024" }).length).toBe(0);
  });

  it("Negative test: unknown semester string returns empty list", () => {
    expect(filterAttendance(records, courses, { ...ALL_FILTERS, semesterFilter: "Summer 1990" })).toEqual([]);
  });

  it("No crash: conflicting course+semester filters return empty safely", () => {
    expect(() => filterAttendance(records, courses, {
      ...ALL_FILTERS, courseFilter: "c1", semesterFilter: "Spring 2025",
    })).not.toThrow();
    expect(filterAttendance(records, courses, {
      ...ALL_FILTERS, courseFilter: "c1", semesterFilter: "Spring 2025",
    })).toEqual([]);
  });
});

// ─── AC3: Combined filters ────────────────────────────────────────────────────

describe("AC3: Combined filters", () => {
  it("Happy path: course + matching semester returns expected count (4)", () => {
    const result = filterAttendance(records, courses, { ...ALL_FILTERS, courseFilter: "c1", semesterFilter: "Fall 2024" });
    expect(result.length).toBe(4);
  });

  it("Edge case: dept + semester (all d1 = Fall 2024) still returns 7", () => {
    expect(filterAttendance(records, courses, { ...ALL_FILTERS, deptFilter: "d1", semesterFilter: "Fall 2024" }).length).toBe(7);
  });

  it("Negative test: conflicting course + dept or course + semester returns empty", () => {
    expect(filterAttendance(records, courses, { ...ALL_FILTERS, courseFilter: "c1", deptFilter: "d2" })).toEqual([]);
    expect(filterAttendance(records, courses, { ...ALL_FILTERS, courseFilter: "c1", semesterFilter: "Spring 2025" })).toEqual([]);
  });

  it("No crash: all three filters set to unknown values returns empty safely", () => {
    expect(() => filterAttendance(records, courses, { ...ALL_FILTERS, courseFilter: "x", deptFilter: "x", semesterFilter: "x" })).not.toThrow();
  });
});

// ─── Semester dropdown: deriveSemesters() ─────────────────────────────────────

describe("Semester dropdown: deriveSemesters()", () => {
  it("Happy path: extracts unique sorted semesters from courses", () => {
    const sems = deriveSemesters(courses);
    expect(sems.length).toBe(2);
    expect(sems).toContain("Fall 2024");
    expect(sems).toContain("Spring 2025");
    expect(sems).toEqual([...sems].sort());
  });

  it("Edge case: null semester excluded; duplicates de-duplicated", () => {
    const withNull: Course[] = [...courses, { id: "c99", name: "No Sem", course_code: "NS", semester: null, department_id: "d1" }];
    const sems = deriveSemesters(withNull);
    expect(sems).not.toContain(null);
    expect(sems.length).toBe(2);
    const withDupe: Course[] = [...courses, { id: "c10", name: "Math 102", course_code: "M102", semester: "Fall 2024", department_id: "d1" }];
    expect(deriveSemesters(withDupe).filter((s) => s === "Fall 2024").length).toBe(1);
  });

  it("Negative test: semester not in courses is not in dropdown", () => {
    expect(deriveSemesters(courses)).not.toContain("Summer 2020");
  });

  it("No crash: empty courses list and all-null semesters return empty without throwing", () => {
    expect(() => deriveSemesters([])).not.toThrow();
    expect(deriveSemesters([])).toEqual([]);
    expect(deriveSemesters(courses.map((c) => ({ ...c, semester: null })))).toEqual([]);
  });
});
