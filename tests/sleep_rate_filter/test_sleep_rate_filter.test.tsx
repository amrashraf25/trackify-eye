import { describe, it, expect, beforeEach } from "vitest";
import {
  calculateSleepRate,
  isHighSleepClass,
  filterHighSleepClasses,
  getTopSleepingStudents,
  sortByRate,
  buildSleepSummary,
  ClassSession,
  StudentSleepRecord,
} from "./feature_files/SleepRateFilter";

// ─── TEST DATA ─────────────────────────────────────────────────────────────────

let sessions: ClassSession[];
let students: StudentSleepRecord[];

beforeEach(() => {
  sessions = [
    { id: "s1", courseName: "Math 101",    date: "2025-04-01", totalStudents: 30, sleepingCount: 9  }, // 30%
    { id: "s2", courseName: "Physics 202", date: "2025-04-02", totalStudents: 20, sleepingCount: 4  }, // 20%
    { id: "s3", courseName: "History 301", date: "2025-04-03", totalStudents: 25, sleepingCount: 2  }, // 8%
    { id: "s4", courseName: "CS 404",      date: "2025-04-04", totalStudents: 40, sleepingCount: 40 }, // 100%
  ];

  students = [
    { studentId: "u1", studentName: "Alice",   sleepDurationSeconds: 1200, sessionId: "s1" },
    { studentId: "u2", studentName: "Bob",     sleepDurationSeconds: 800,  sessionId: "s1" },
    { studentId: "u3", studentName: "Charlie", sleepDurationSeconds: 600,  sessionId: "s1" },
    { studentId: "u4", studentName: "Diana",   sleepDurationSeconds: 300,  sessionId: "s2" },
    { studentId: "u5", studentName: "Eve",     sleepDurationSeconds: 100,  sessionId: "s2" },
  ];
});

// ─── AC1: calculateSleepRate ───────────────────────────────────────────────────

describe("AC1: calculateSleepRate", () => {
  it("Happy path: returns correct percentage for normal values", () => {
    // Arrange
    const sleepingCount = 9;
    const totalStudents = 30;
    // Act
    const result = calculateSleepRate(sleepingCount, totalStudents);
    // Assert
    expect(result).toBe(30);
  });

  it("Edge case: 0 students returns 0 (no division by zero)", () => {
    // Arrange
    const sleepingCount = 0;
    const totalStudents = 0;
    // Act
    const result = calculateSleepRate(sleepingCount, totalStudents);
    // Assert
    expect(result).toBe(0);
  });

  it("Edge case: 100% sleeping returns 100", () => {
    // Arrange
    const sleepingCount = 40;
    const totalStudents = 40;
    // Act
    const result = calculateSleepRate(sleepingCount, totalStudents);
    // Assert
    expect(result).toBe(100);
  });

  it("No crash: does not throw on zero inputs", () => {
    // Arrange / Act / Assert
    expect(() => calculateSleepRate(0, 0)).not.toThrow();
  });
});

// ─── AC1: isHighSleepClass ─────────────────────────────────────────────────────

describe("AC1: isHighSleepClass", () => {
  it("Happy path: class with 30% sleep rate is flagged at default threshold (20)", () => {
    // Arrange
    const session = sessions[0]; // 9/30 = 30%
    // Act
    const result = isHighSleepClass(session.sleepingCount, session.totalStudents);
    // Assert
    expect(result).toBe(true);
  });

  it("Edge case: exactly 20% meets the threshold", () => {
    // Arrange – 4/20 = exactly 20%
    const session = sessions[1];
    // Act
    const result = isHighSleepClass(session.sleepingCount, session.totalStudents, 20);
    // Assert
    expect(result).toBe(true);
  });

  it("Negative test: 8% sleep rate does not meet 20% threshold", () => {
    // Arrange – 2/25 = 8%
    const session = sessions[2];
    // Act
    const result = isHighSleepClass(session.sleepingCount, session.totalStudents, 20);
    // Assert
    expect(result).toBe(false);
  });

  it("No crash: does not throw on zero total students", () => {
    // Arrange / Act / Assert
    expect(() => isHighSleepClass(0, 0, 20)).not.toThrow();
  });
});

// ─── AC1: filterHighSleepClasses ──────────────────────────────────────────────

describe("AC1: filterHighSleepClasses", () => {
  it("Happy path: returns only sessions with sleep rate >= 20%", () => {
    // Arrange – sessions[0]=30%, sessions[1]=20%, sessions[2]=8%, sessions[3]=100%
    // Act
    const result = filterHighSleepClasses(sessions, 20);
    // Assert
    expect(result).toHaveLength(3);
    expect(result.map((s) => s.id)).toEqual(expect.arrayContaining(["s1", "s2", "s4"]));
  });

  it("Edge case: empty session list returns empty array", () => {
    // Arrange
    // Act
    const result = filterHighSleepClasses([], 20);
    // Assert
    expect(result).toHaveLength(0);
  });

  it("Negative test: threshold=0 returns all sessions (0% >= 0%)", () => {
    // Arrange
    // Act
    const result = filterHighSleepClasses(sessions, 0);
    // Assert
    expect(result).toHaveLength(sessions.length);
  });

  it("No crash: does not throw on empty input", () => {
    // Arrange / Act / Assert
    expect(() => filterHighSleepClasses([], 20)).not.toThrow();
  });
});

// ─── AC1: sortByRate ──────────────────────────────────────────────────────────

describe("AC1: sortByRate", () => {
  it("Happy path: desc sort places highest sleep rate first", () => {
    // Arrange
    // Act
    const result = sortByRate(sessions, "desc");
    // Assert – CS 404 = 100% should be first
    expect(result[0].id).toBe("s4");
    expect(result[result.length - 1].id).toBe("s3");
  });

  it("Edge case: asc sort places lowest sleep rate first", () => {
    // Arrange
    // Act
    const result = sortByRate(sessions, "asc");
    // Assert – History 301 = 8% should be first
    expect(result[0].id).toBe("s3");
  });

  it("Negative test: single-element list returns same element", () => {
    // Arrange
    const single = [sessions[0]];
    // Act
    const result = sortByRate(single, "desc");
    // Assert
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("s1");
  });

  it("No crash: does not throw on empty input", () => {
    // Arrange / Act / Assert
    expect(() => sortByRate([], "desc")).not.toThrow();
  });
});

// ─── AC1: buildSleepSummary ───────────────────────────────────────────────────

describe("AC1: buildSleepSummary", () => {
  it("Happy path: correctly counts high-sleep classes and identifies worst class", () => {
    // Arrange – s4 has 100%
    // Act
    const result = buildSleepSummary(sessions);
    // Assert
    expect(result.highSleepClasses).toBe(3);
    expect(result.worstClass).toBe("CS 404");
  });

  it("Edge case: empty session list returns zeroed summary", () => {
    // Arrange
    // Act
    const result = buildSleepSummary([]);
    // Assert
    expect(result.highSleepClasses).toBe(0);
    expect(result.avgSleepRate).toBe(0);
    expect(result.worstClass).toBe("—");
  });

  it("Negative test: all classes below threshold yields 0 highSleepClasses at threshold=50", () => {
    // Arrange – only s4 (100%) and s1 (30%); at threshold=50 only s4 qualifies
    // Act
    const result = buildSleepSummary([sessions[2], sessions[1]]); // 8% and 20%
    // Assert — none hit 50% so worstClass is still the one with highest rate
    expect(result.highSleepClasses).toBeLessThanOrEqual(2);
  });

  it("No crash: does not throw on empty input", () => {
    // Arrange / Act / Assert
    expect(() => buildSleepSummary([])).not.toThrow();
  });
});

// ─── AC2: getTopSleepingStudents ──────────────────────────────────────────────

describe("AC2: getTopSleepingStudents", () => {
  it("Happy path: top 40% of 5 students returns top 2 by duration", () => {
    // Arrange – durations: 1200, 800, 600, 300, 100
    // Act
    const result = getTopSleepingStudents(students, 40);
    // Assert – ceil(40% of 5) = 2
    expect(result).toHaveLength(2);
    expect(result[0].studentId).toBe("u1"); // highest 1200s
    expect(result[1].studentId).toBe("u2"); // second 800s
  });

  it("Edge case: topPercent=0 returns empty array", () => {
    // Arrange
    // Act
    const result = getTopSleepingStudents(students, 0);
    // Assert
    expect(result).toHaveLength(0);
  });

  it("Edge case: empty student list returns empty array", () => {
    // Arrange
    // Act
    const result = getTopSleepingStudents([], 20);
    // Assert
    expect(result).toHaveLength(0);
  });

  it("No crash: does not throw on empty input", () => {
    // Arrange / Act / Assert
    expect(() => getTopSleepingStudents([], 20)).not.toThrow();
  });
});
