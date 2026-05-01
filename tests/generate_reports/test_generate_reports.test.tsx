import { describe, it, expect, beforeEach } from "vitest";
import {
  filterByDepartment,
  filterByDateRange,
  filterByIncidentType,
  buildEngagementSummary,
  formatExportFilename,
  ReportRecord,
  IncidentRecord,
  EngagementRecord,
} from "./feature_files/GenerateReports";

// ─── Shared test data ─────────────────────────────────────────────────────────

let reportRecords: ReportRecord[];
let incidentRecords: IncidentRecord[];
let engagementRecords: EngagementRecord[];

beforeEach(() => {
  reportRecords = [
    {
      id: "r1",
      studentId: "s1",
      studentName: "Alice Johnson",
      departmentId: "cs",
      courseId: "CS101",
      studentLevel: "undergraduate",
      date: "2024-01-10",
    },
    {
      id: "r2",
      studentId: "s2",
      studentName: "Bob Smith",
      departmentId: "eng",
      courseId: "ENG201",
      studentLevel: "undergraduate",
      date: "2024-01-15",
    },
    {
      id: "r3",
      studentId: "s3",
      studentName: "Carol White",
      departmentId: "cs",
      courseId: "CS102",
      studentLevel: "postgraduate",
      date: "2024-02-05",
    },
    {
      id: "r4",
      studentId: "s4",
      studentName: "Dan Brown",
      departmentId: "biz",
      courseId: "BIZ301",
      studentLevel: "undergraduate",
      date: "2024-02-20",
    },
  ];

  incidentRecords = [
    {
      id: "i1",
      studentId: "s1",
      studentName: "Alice Johnson",
      incidentType: "fighting",
      location: "Corridor A",
      timestamp: "2024-01-10T09:30:00",
      departmentId: "cs",
    },
    {
      id: "i2",
      studentId: "s2",
      studentName: "Bob Smith",
      incidentType: "smoking",
      location: "Courtyard",
      timestamp: "2024-01-12T11:00:00",
      departmentId: "eng",
    },
    {
      id: "i3",
      studentId: "s3",
      studentName: "Carol White",
      incidentType: "fighting",
      location: "Room 201",
      timestamp: "2024-01-14T14:15:00",
      departmentId: "cs",
    },
    {
      id: "i4",
      studentId: "s4",
      studentName: "Dan Brown",
      incidentType: "phone_use",
      location: "Lecture Hall B",
      timestamp: "2024-01-18T10:00:00",
      departmentId: "biz",
    },
  ];

  engagementRecords = [
    {
      id: "e1",
      studentId: "s1",
      studentName: "Alice Johnson",
      departmentId: "cs",
      courseId: "CS101",
      date: "2024-01-10",
      participationLevel: "high",
      attentionScore: 90,
      interactionFrequency: 15,
    },
    {
      id: "e2",
      studentId: "s2",
      studentName: "Bob Smith",
      departmentId: "eng",
      courseId: "ENG201",
      date: "2024-01-15",
      participationLevel: "medium",
      attentionScore: 70,
      interactionFrequency: 8,
    },
    {
      id: "e3",
      studentId: "s3",
      studentName: "Carol White",
      departmentId: "cs",
      courseId: "CS102",
      date: "2024-02-05",
      participationLevel: "low",
      attentionScore: 40,
      interactionFrequency: 2,
    },
    {
      id: "e4",
      studentId: "s4",
      studentName: "Dan Brown",
      departmentId: "biz",
      courseId: "BIZ301",
      date: "2024-02-20",
      participationLevel: "high",
      attentionScore: 85,
      interactionFrequency: 12,
    },
  ];
});

// ─── AC1: Department + Date Range Filtering (TP-8, TP-10) ─────────────────────

describe("AC1: Department and date range filtering", () => {
  it("Happy path: filterByDepartment returns only matching department records", () => {
    // Arrange
    const input = reportRecords;

    // Act
    const result = filterByDepartment(input, "cs");

    // Assert
    expect(result.length).toBe(2);
    result.forEach((r) => expect(r.departmentId).toBe("cs"));
  });

  it("Edge case: empty department string returns all records unchanged", () => {
    // Arrange
    const input = reportRecords;

    // Act
    const result = filterByDepartment(input, "");

    // Assert
    expect(result.length).toBe(reportRecords.length);
  });

  it("Negative test: nonexistent department returns empty array", () => {
    // Arrange + Act
    const result = filterByDepartment(reportRecords, "__ghost_dept__");

    // Assert
    expect(result.length).toBe(0);
  });

  it("No crash: does not throw on empty records array", () => {
    expect(() => filterByDepartment([], "cs")).not.toThrow();
  });

  it("Happy path: filterByDateRange returns records within the inclusive range", () => {
    // Arrange
    const from = new Date("2024-01-01");
    const to = new Date("2024-01-31");

    // Act
    const result = filterByDateRange(reportRecords, from, to);

    // Assert
    expect(result.length).toBe(2);
    result.forEach((r) => {
      const d = new Date(r.date);
      expect(d.getTime()).toBeGreaterThanOrEqual(from.getTime());
      expect(d.getTime()).toBeLessThanOrEqual(to.getTime());
    });
  });

  it("Edge case: from === to returns only records on that exact date", () => {
    // Arrange
    const exact = new Date("2024-01-10");

    // Act
    const result = filterByDateRange(reportRecords, exact, exact);

    // Assert
    expect(result.length).toBe(1);
    expect(result[0].date).toBe("2024-01-10");
  });

  it("Negative test: date range with no matching records returns empty array", () => {
    // Arrange
    const from = new Date("2020-01-01");
    const to = new Date("2020-12-31");

    // Act
    const result = filterByDateRange(reportRecords, from, to);

    // Assert
    expect(result.length).toBe(0);
  });

  it("No crash: filterByDateRange does not throw on empty array", () => {
    expect(() =>
      filterByDateRange([], new Date("2024-01-01"), new Date("2024-12-31"))
    ).not.toThrow();
  });
});

// ─── AC2: Misconduct Filter (TP-7) ────────────────────────────────────────────

describe("AC2: Misconduct incident type filtering", () => {
  it("Happy path: filter by 'fighting' returns only fighting incidents", () => {
    // Arrange
    const input = incidentRecords;

    // Act
    const result = filterByIncidentType(input, "fighting");

    // Assert
    expect(result.length).toBe(2);
    result.forEach((i) => expect(i.incidentType).toBe("fighting"));
  });

  it("Edge case: empty type string returns all incidents", () => {
    // Arrange
    const input = incidentRecords;

    // Act
    const result = filterByIncidentType(input, "");

    // Assert
    expect(result.length).toBe(incidentRecords.length);
  });

  it("Negative test: nonexistent incident type returns empty array", () => {
    // Arrange + Act
    const result = filterByIncidentType(incidentRecords, "vandalism_xyz");

    // Assert
    expect(result.length).toBe(0);
  });

  it("No crash: does not throw on empty incidents array", () => {
    expect(() => filterByIncidentType([], "fighting")).not.toThrow();
  });

  it("Case-insensitive: 'SMOKING' matches 'smoking'", () => {
    // Arrange + Act
    const result = filterByIncidentType(incidentRecords, "SMOKING");

    // Assert
    expect(result.length).toBe(1);
    expect(result[0].incidentType).toBe("smoking");
  });

  it("Incident record has all required fields", () => {
    // Arrange + Act
    const result = filterByIncidentType(incidentRecords, "phone_use");

    // Assert
    expect(result.length).toBe(1);
    const record = result[0];
    expect(record).toHaveProperty("studentName");
    expect(record).toHaveProperty("location");
    expect(record).toHaveProperty("timestamp");
    expect(record).toHaveProperty("incidentType");
  });
});

// ─── AC3: Engagement Summary (TP-6) ───────────────────────────────────────────

describe("AC3: Engagement summary computation", () => {
  it("Happy path: computes correct average attention score from multiple records", () => {
    // Arrange
    const input = engagementRecords; // scores: 90, 70, 40, 85 → avg = 71

    // Act
    const summary = buildEngagementSummary(input);

    // Assert
    expect(summary.avgAttentionScore).toBe(71);
    expect(summary.totalParticipants).toBe(4);
  });

  it("Happy path: counts high and low engagement correctly", () => {
    // Arrange
    const input = engagementRecords; // high: 2 (e1, e4), low: 1 (e3)

    // Act
    const summary = buildEngagementSummary(input);

    // Assert
    expect(summary.highEngagementCount).toBe(2);
    expect(summary.lowEngagementCount).toBe(1);
  });

  it("Edge case: empty array returns all zeros", () => {
    // Arrange
    const empty: EngagementRecord[] = [];

    // Act
    const summary = buildEngagementSummary(empty);

    // Assert
    expect(summary.avgAttentionScore).toBe(0);
    expect(summary.totalParticipants).toBe(0);
    expect(summary.highEngagementCount).toBe(0);
    expect(summary.lowEngagementCount).toBe(0);
  });

  it("Edge case: single record returns its own score as average", () => {
    // Arrange
    const single: EngagementRecord[] = [engagementRecords[0]]; // attentionScore: 90

    // Act
    const summary = buildEngagementSummary(single);

    // Assert
    expect(summary.avgAttentionScore).toBe(90);
    expect(summary.totalParticipants).toBe(1);
  });

  it("Negative test: records with all low engagement returns 0 high count", () => {
    // Arrange
    const allLow: EngagementRecord[] = engagementRecords.map((r) => ({
      ...r,
      participationLevel: "low" as const,
    }));

    // Act
    const summary = buildEngagementSummary(allLow);

    // Assert
    expect(summary.highEngagementCount).toBe(0);
    expect(summary.lowEngagementCount).toBe(allLow.length);
  });

  it("No crash: does not throw on empty engagement records", () => {
    expect(() => buildEngagementSummary([])).not.toThrow();
  });
});

// ─── AC4: Export Filename Formatting (TP-9) ───────────────────────────────────

describe("AC4: Export filename formatting", () => {
  it("Happy path: formats engagement report filename correctly", () => {
    // Arrange
    const type = "engagement";
    const range = "2024-01";

    // Act
    const filename = formatExportFilename(type, range);

    // Assert
    expect(filename).toBe("engagement-report-2024-01.csv");
  });

  it("Happy path: formats misconduct report filename correctly", () => {
    // Arrange
    const type = "misconduct";
    const range = "2024-01-01_2024-01-31";

    // Act
    const filename = formatExportFilename(type, range);

    // Assert
    expect(filename).toBe("misconduct-report-2024-01-01_2024-01-31.csv");
  });

  it("Edge case: spaces in reportType are converted to hyphens", () => {
    // Arrange
    const type = "student attendance";
    const range = "2024-02";

    // Act
    const filename = formatExportFilename(type, range);

    // Assert
    expect(filename).toBe("student-attendance-report-2024-02.csv");
  });

  it("Edge case: uppercase reportType is lowercased in output", () => {
    // Arrange
    const type = "ENGAGEMENT";
    const range = "2024-03";

    // Act
    const filename = formatExportFilename(type, range);

    // Assert
    expect(filename).toBe("engagement-report-2024-03.csv");
  });

  it("Negative test: empty reportType produces minimal valid filename", () => {
    // Arrange + Act
    const filename = formatExportFilename("", "2024-01");

    // Assert
    expect(filename).toMatch(/\.csv$/);
    expect(filename).not.toContain("undefined");
  });

  it("No crash: does not throw on empty strings", () => {
    expect(() => formatExportFilename("", "")).not.toThrow();
  });

  it("Output always ends with .csv extension", () => {
    // Arrange
    const cases = [
      ["engagement", "2024-01"],
      ["misconduct", "2024-02"],
      ["attendance", "2024-03"],
    ];

    // Act + Assert
    cases.forEach(([type, range]) => {
      const filename = formatExportFilename(type, range);
      expect(filename.endsWith(".csv")).toBe(true);
    });
  });
});
