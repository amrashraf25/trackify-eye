/**
 * ====================================================================
 * Generate Reports — Unit Tests
 * Exactly 4 tests per function: Happy path / Edge case / Negative / No crash
 * ====================================================================
 */

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

let reportRecords: ReportRecord[];
let incidentRecords: IncidentRecord[];
let engagementRecords: EngagementRecord[];

beforeEach(() => {
  reportRecords = [
    { id: "r1", studentId: "s1", studentName: "Alice Johnson", departmentId: "cs",  courseId: "CS101", studentLevel: "undergraduate", date: "2024-01-10" },
    { id: "r2", studentId: "s2", studentName: "Bob Smith",     departmentId: "eng", courseId: "ENG201",studentLevel: "undergraduate", date: "2024-01-15" },
    { id: "r3", studentId: "s3", studentName: "Carol White",   departmentId: "cs",  courseId: "CS102", studentLevel: "postgraduate",  date: "2024-02-05" },
    { id: "r4", studentId: "s4", studentName: "Dan Brown",     departmentId: "biz", courseId: "BIZ301",studentLevel: "undergraduate", date: "2024-02-20" },
  ];

  incidentRecords = [
    { id: "i1", studentId: "s1", studentName: "Alice Johnson", incidentType: "fighting",  location: "Corridor A",    timestamp: "2024-01-10T09:30:00", departmentId: "cs" },
    { id: "i2", studentId: "s2", studentName: "Bob Smith",     incidentType: "smoking",   location: "Courtyard",     timestamp: "2024-01-12T11:00:00", departmentId: "eng" },
    { id: "i3", studentId: "s3", studentName: "Carol White",   incidentType: "fighting",  location: "Room 201",      timestamp: "2024-01-14T14:15:00", departmentId: "cs" },
    { id: "i4", studentId: "s4", studentName: "Dan Brown",     incidentType: "phone_use", location: "Lecture Hall B",timestamp: "2024-01-18T10:00:00", departmentId: "biz" },
  ];

  engagementRecords = [
    { id: "e1", studentId: "s1", studentName: "Alice Johnson", departmentId: "cs",  courseId: "CS101", date: "2024-01-10", participationLevel: "high",   attentionScore: 90, interactionFrequency: 15 },
    { id: "e2", studentId: "s2", studentName: "Bob Smith",     departmentId: "eng", courseId: "ENG201",date: "2024-01-15", participationLevel: "medium", attentionScore: 70, interactionFrequency: 8  },
    { id: "e3", studentId: "s3", studentName: "Carol White",   departmentId: "cs",  courseId: "CS102", date: "2024-02-05", participationLevel: "low",    attentionScore: 40, interactionFrequency: 2  },
    { id: "e4", studentId: "s4", studentName: "Dan Brown",     departmentId: "biz", courseId: "BIZ301",date: "2024-02-20", participationLevel: "high",   attentionScore: 85, interactionFrequency: 12 },
  ];
});

// ─── AC1: Department and date range filtering ─────────────────────────────────

describe("AC1: Department and date range filtering", () => {
  it("Happy path: filterByDepartment returns matching dept; filterByDateRange returns within range", () => {
    const byDept = filterByDepartment(reportRecords, "cs");
    expect(byDept.length).toBe(2);
    byDept.forEach((r) => expect(r.departmentId).toBe("cs"));
    const from = new Date("2024-01-01");
    const to   = new Date("2024-01-31");
    const byDate = filterByDateRange(reportRecords, from, to);
    expect(byDate.length).toBe(2);
  });

  it("Edge case: empty dept string returns all records; from === to returns only that date", () => {
    expect(filterByDepartment(reportRecords, "").length).toBe(reportRecords.length);
    const exact = new Date("2024-01-10");
    expect(filterByDateRange(reportRecords, exact, exact).length).toBe(1);
  });

  it("Negative test: nonexistent dept returns empty; date range with no match returns empty", () => {
    expect(filterByDepartment(reportRecords, "__ghost__").length).toBe(0);
    expect(filterByDateRange(reportRecords, new Date("2020-01-01"), new Date("2020-12-31")).length).toBe(0);
  });

  it("No crash: empty arrays do not throw", () => {
    expect(() => filterByDepartment([], "cs")).not.toThrow();
    expect(() => filterByDateRange([], new Date("2024-01-01"), new Date("2024-12-31"))).not.toThrow();
  });
});

// ─── AC2: Misconduct incident type filtering ──────────────────────────────────

describe("AC2: Misconduct incident type filtering", () => {
  it("Happy path: filter by 'fighting' returns only fighting; 'SMOKING' matches case-insensitively", () => {
    const fighting = filterByIncidentType(incidentRecords, "fighting");
    expect(fighting.length).toBe(2);
    fighting.forEach((i) => expect(i.incidentType).toBe("fighting"));
    expect(filterByIncidentType(incidentRecords, "SMOKING").length).toBe(1);
  });

  it("Edge case: empty type string returns all incidents", () => {
    expect(filterByIncidentType(incidentRecords, "").length).toBe(incidentRecords.length);
  });

  it("Negative test: nonexistent incident type returns empty array", () => {
    expect(filterByIncidentType(incidentRecords, "vandalism_xyz").length).toBe(0);
  });

  it("No crash: empty incidents array does not throw", () => {
    expect(() => filterByIncidentType([], "fighting")).not.toThrow();
  });
});

// ─── AC3: Engagement summary computation ─────────────────────────────────────

describe("AC3: Engagement summary computation", () => {
  it("Happy path: correct avg attention score, totalParticipants, and high/low counts", () => {
    const summary = buildEngagementSummary(engagementRecords); // 90+70+40+85=285/4=71
    expect(summary.avgAttentionScore).toBe(71);
    expect(summary.totalParticipants).toBe(4);
    expect(summary.highEngagementCount).toBe(2);
    expect(summary.lowEngagementCount).toBe(1);
  });

  it("Edge case: empty array returns all zeros", () => {
    const summary = buildEngagementSummary([]);
    expect(summary.avgAttentionScore).toBe(0);
    expect(summary.totalParticipants).toBe(0);
    expect(summary.highEngagementCount).toBe(0);
    expect(summary.lowEngagementCount).toBe(0);
  });

  it("Negative test: all-low records returns 0 highEngagementCount", () => {
    const allLow: EngagementRecord[] = engagementRecords.map((r) => ({ ...r, participationLevel: "low" as const }));
    const summary = buildEngagementSummary(allLow);
    expect(summary.highEngagementCount).toBe(0);
    expect(summary.lowEngagementCount).toBe(allLow.length);
  });

  it("No crash: empty engagement records does not throw", () => {
    expect(() => buildEngagementSummary([])).not.toThrow();
  });
});

// ─── AC4: Export filename formatting ─────────────────────────────────────────

describe("AC4: Export filename formatting", () => {
  it("Happy path: engagement and misconduct filenames formatted correctly", () => {
    expect(formatExportFilename("engagement", "2024-01")).toBe("engagement-report-2024-01.csv");
    expect(formatExportFilename("misconduct", "2024-01-01_2024-01-31")).toBe("misconduct-report-2024-01-01_2024-01-31.csv");
  });

  it("Edge case: spaces become hyphens; UPPERCASE is lowercased", () => {
    expect(formatExportFilename("student attendance", "2024-02")).toBe("student-attendance-report-2024-02.csv");
    expect(formatExportFilename("ENGAGEMENT", "2024-03")).toBe("engagement-report-2024-03.csv");
  });

  it("Negative test: output always ends with .csv and never contains 'undefined'", () => {
    const f = formatExportFilename("", "2024-01");
    expect(f.endsWith(".csv")).toBe(true);
    expect(f).not.toContain("undefined");
  });

  it("No crash: empty strings do not throw", () => {
    expect(() => formatExportFilename("", "")).not.toThrow();
  });
});
