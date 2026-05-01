import { describe, it, expect, beforeEach } from "vitest";
import {
  formatCsvRow,
  buildCsvContent,
  getStatusLabel,
  filterDownloadableRecords,
  AttendanceRecord,
  CsvColumn,
} from "./feature_files/AttendanceDownload";

// ─── TEST DATA ────────────────────────────────────────────────────────────────

let records: AttendanceRecord[];

const DEFAULT_COLUMNS: CsvColumn[] = [
  { key: "student_name", label: "Student Name" },
  { key: "student_code", label: "Student Code" },
  { key: "course_name",  label: "Course" },
  { key: "session_date", label: "Date" },
  { key: "status",       label: "Status" },
];

beforeEach(() => {
  records = [
    {
      id: "r1",
      student_id: "s1",
      student_name: "Alice Johnson",
      student_code: "STU001",
      course_id: "c1",
      course_name: "Mathematics",
      session_date: "2025-01-06T09:00:00.000Z",
      status: "present",
    },
    {
      id: "r2",
      student_id: "s2",
      student_name: "Bob Smith",
      student_code: "STU002",
      course_id: "c1",
      course_name: "Mathematics",
      session_date: "2025-01-06T09:00:00.000Z",
      status: "absent",
    },
    {
      id: "r3",
      student_id: "s3",
      student_name: "Carol White",
      student_code: "STU003",
      course_id: "c2",
      course_name: "Physics",
      session_date: "2025-01-07T09:00:00.000Z",
      status: "late",
    },
    {
      id: "r4",
      student_id: "s1",
      student_name: "Alice Johnson",
      student_code: "STU001",
      course_id: "c2",
      course_name: "Physics",
      session_date: "2025-01-07T09:00:00.000Z",
      status: "present",
    },
  ];
});

// ─── AC1: getStatusLabel — human-readable status labels ───────────────────────

describe("AC1: getStatusLabel — status label mapping", () => {
  it("Happy path: 'present' maps to 'Present'", () => {
    // Arrange
    const status = "present";
    // Act
    const result = getStatusLabel(status);
    // Assert
    expect(result).toBe("Present");
  });

  it("Happy path: 'absent' maps to 'Absent'", () => {
    // Arrange
    const status = "absent";
    // Act
    const result = getStatusLabel(status);
    // Assert
    expect(result).toBe("Absent");
  });

  it("Happy path: 'late' maps to 'Late'", () => {
    // Arrange
    const status = "late";
    // Act
    const result = getStatusLabel(status);
    // Assert
    expect(result).toBe("Late");
  });

  it("Happy path: uppercase 'PRESENT' is handled case-insensitively", () => {
    // Arrange
    const status = "PRESENT";
    // Act
    const result = getStatusLabel(status);
    // Assert
    expect(result).toBe("Present");
  });

  it("Edge case: empty string returns 'Unknown'", () => {
    // Arrange
    const status = "";
    // Act
    const result = getStatusLabel(status);
    // Assert
    expect(result).toBe("Unknown");
  });

  it("Negative test: unrecognized status returns 'Unknown'", () => {
    // Arrange
    const status = "excused";
    // Act
    const result = getStatusLabel(status);
    // Assert
    expect(result).toBe("Unknown");
  });

  it("No crash: null-like empty string does not throw", () => {
    // Arrange + Act + Assert
    expect(() => getStatusLabel("")).not.toThrow();
  });
});

// ─── AC2: formatCsvRow — row data extraction ──────────────────────────────────

describe("AC2: formatCsvRow — row array generation", () => {
  it("Happy path: formats a complete record into correct column order", () => {
    // Arrange
    const record = records[0]; // Alice, STU001, Mathematics, present
    // Act
    const row = formatCsvRow(record);
    // Assert
    expect(row[0]).toBe("Alice Johnson");
    expect(row[1]).toBe("STU001");
    expect(row[2]).toBe("Mathematics");
    expect(row[3]).toBe("06/01/2025"); // en-GB format
    expect(row[4]).toBe("Present");
  });

  it("Happy path: absent record maps status to 'Absent'", () => {
    // Arrange
    const record = records[1]; // Bob, absent
    // Act
    const row = formatCsvRow(record);
    // Assert
    expect(row[4]).toBe("Absent");
  });

  it("Happy path: late record maps status to 'Late'", () => {
    // Arrange
    const record = records[2]; // Carol, late
    // Act
    const row = formatCsvRow(record);
    // Assert
    expect(row[4]).toBe("Late");
  });

  it("Edge case: record with empty student_name returns empty string at index 0", () => {
    // Arrange
    const record: AttendanceRecord = {
      ...records[0],
      student_name: "",
    };
    // Act
    const row = formatCsvRow(record);
    // Assert
    expect(row[0]).toBe("");
  });

  it("Edge case: record with missing session_date returns empty string at index 3", () => {
    // Arrange
    const record: AttendanceRecord = {
      ...records[0],
      session_date: "",
    };
    // Act
    const row = formatCsvRow(record);
    // Assert
    expect(row[3]).toBe("");
  });

  it("Negative test: unknown status returns 'Unknown' in row", () => {
    // Arrange
    const record: AttendanceRecord = { ...records[0], status: "excused" };
    // Act
    const row = formatCsvRow(record);
    // Assert
    expect(row[4]).toBe("Unknown");
  });

  it("No crash: record with all empty fields does not throw", () => {
    // Arrange
    const minimal: AttendanceRecord = {
      id: "x", student_id: "s", student_name: "", student_code: "",
      course_id: "", course_name: "", session_date: "", status: "",
    };
    // Act + Assert
    expect(() => formatCsvRow(minimal)).not.toThrow();
  });
});

// ─── AC3: buildCsvContent — full CSV generation ───────────────────────────────

describe("AC3: buildCsvContent — CSV file content generation", () => {
  it("Happy path: CSV has correct header as first line", () => {
    // Arrange
    const input = records;
    // Act
    const csv = buildCsvContent(input, DEFAULT_COLUMNS);
    const lines = csv.split("\n");
    // Assert
    expect(lines[0]).toBe("Student Name,Student Code,Course,Date,Status");
  });

  it("Happy path: CSV has one data row per record", () => {
    // Arrange
    const input = records;
    // Act
    const csv = buildCsvContent(input, DEFAULT_COLUMNS);
    const lines = csv.split("\n");
    // Assert — 1 header + 4 data rows
    expect(lines.length).toBe(5);
  });

  it("Happy path: data rows contain correct student names", () => {
    // Arrange
    const input = [records[0]]; // Only Alice
    // Act
    const csv = buildCsvContent(input, DEFAULT_COLUMNS);
    const lines = csv.split("\n");
    // Assert
    expect(lines[1]).toContain("Alice Johnson");
  });

  it("Edge case: empty records returns only the header row", () => {
    // Arrange
    const empty: AttendanceRecord[] = [];
    // Act
    const csv = buildCsvContent(empty, DEFAULT_COLUMNS);
    // Assert — just the header, no newline after
    expect(csv).toBe("Student Name,Student Code,Course,Date,Status");
  });

  it("Edge case: value with comma is wrapped in double quotes", () => {
    // Arrange
    const record: AttendanceRecord = {
      ...records[0],
      student_name: "Smith, John", // contains comma
    };
    // Act
    const csv = buildCsvContent([record], DEFAULT_COLUMNS);
    const dataLine = csv.split("\n")[1];
    // Assert — name should be quoted
    expect(dataLine.startsWith('"Smith, John"')).toBe(true);
  });

  it("Edge case: value with double quotes is escaped correctly", () => {
    // Arrange
    const record: AttendanceRecord = {
      ...records[0],
      course_name: 'Intro to "AI"', // contains double quotes
    };
    // Act
    const csv = buildCsvContent([record], DEFAULT_COLUMNS);
    const dataLine = csv.split("\n")[1];
    // Assert — inner quotes are doubled
    expect(dataLine).toContain('"Intro to ""AI"""');
  });

  it("Negative test: custom column set produces header matching that set", () => {
    // Arrange
    const customCols: CsvColumn[] = [
      { key: "student_name", label: "Name" },
      { key: "status", label: "Attendance" },
    ];
    // Act
    const csv = buildCsvContent(records, customCols);
    const header = csv.split("\n")[0];
    // Assert
    expect(header).toBe("Name,Attendance");
  });

  it("No crash: empty columns array does not throw", () => {
    // Arrange + Act + Assert
    expect(() => buildCsvContent(records, [])).not.toThrow();
  });
});

// ─── AC3 cont.: filterDownloadableRecords — course filtering ──────────────────

describe("AC3: filterDownloadableRecords — course-based filtering", () => {
  it("Happy path: 'all' returns all records unchanged", () => {
    // Arrange
    const input = records;
    // Act
    const result = filterDownloadableRecords(input, "all");
    // Assert
    expect(result.length).toBe(records.length);
    expect(result).toEqual(records);
  });

  it("Happy path: specific courseId returns only matching records", () => {
    // Arrange — 'c1' = Mathematics (r1, r2)
    // Act
    const result = filterDownloadableRecords(records, "c1");
    // Assert
    expect(result.length).toBe(2);
    expect(result.every((r) => r.course_id === "c1")).toBe(true);
  });

  it("Happy path: specific courseId 'c2' returns Physics records only", () => {
    // Arrange
    // Act
    const result = filterDownloadableRecords(records, "c2");
    // Assert
    expect(result.length).toBe(2);
    expect(result.every((r) => r.course_name === "Physics")).toBe(true);
  });

  it("Edge case: empty records array returns empty regardless of courseId", () => {
    // Arrange
    const empty: AttendanceRecord[] = [];
    // Act
    const result = filterDownloadableRecords(empty, "c1");
    // Assert
    expect(result).toEqual([]);
  });

  it("Edge case: courseId that does not exist returns empty array", () => {
    // Arrange
    // Act
    const result = filterDownloadableRecords(records, "c_nonexistent");
    // Assert
    expect(result).toEqual([]);
  });

  it("Negative test: non-matching courseId returns empty, not partial list", () => {
    // Arrange
    // Act
    const result = filterDownloadableRecords(records, "c999");
    // Assert
    expect(result.length).toBe(0);
  });

  it("No crash: empty string courseId does not throw and returns empty result", () => {
    // Arrange + Act + Assert
    expect(() => filterDownloadableRecords(records, "")).not.toThrow();
    expect(filterDownloadableRecords(records, "")).toEqual([]);
  });

  it("No crash: empty records with 'all' does not throw", () => {
    // Arrange + Act + Assert
    expect(() => filterDownloadableRecords([], "all")).not.toThrow();
    expect(filterDownloadableRecords([], "all")).toEqual([]);
  });
});
