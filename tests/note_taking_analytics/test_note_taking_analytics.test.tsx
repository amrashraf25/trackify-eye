import { describe, it, expect, beforeEach } from "vitest";
import {
  formatDuration,
  calcEngagementScore,
  filterBySession,
  buildStudentSummary,
  sortByDuration,
  getTopEngaged,
  NoteTakingRecord,
  StudentNoteSummary,
} from "./feature_files/NoteTakingAnalytics";

// ─── TEST DATA ─────────────────────────────────────────────────────────────────

let records: NoteTakingRecord[];

beforeEach(() => {
  records = [
    // Alice — two sessions
    {
      id: "r1",
      studentId: "stu-01",
      studentName: "Alice",
      sessionId: "sess-A",
      durationSeconds: 1800,
      detectedAt: "2025-04-10T09:00:00.000Z",
    },
    {
      id: "r2",
      studentId: "stu-01",
      studentName: "Alice",
      sessionId: "sess-B",
      durationSeconds: 2700,
      detectedAt: "2025-04-11T09:00:00.000Z",
    },
    // Bob — one session
    {
      id: "r3",
      studentId: "stu-02",
      studentName: "Bob",
      sessionId: "sess-A",
      durationSeconds: 900,
      detectedAt: "2025-04-10T09:10:00.000Z",
    },
    // Charlie — one session with very high note-taking (> 3600s hypothetical)
    {
      id: "r4",
      studentId: "stu-03",
      studentName: "Charlie",
      sessionId: "sess-A",
      durationSeconds: 3700,
      detectedAt: "2025-04-10T09:20:00.000Z",
    },
    // Diana — zero seconds (edge case)
    {
      id: "r5",
      studentId: "stu-04",
      studentName: "Diana",
      sessionId: "sess-B",
      durationSeconds: 0,
      detectedAt: "2025-04-11T09:15:00.000Z",
    },
  ];
});

// ─── AC3: formatDuration ──────────────────────────────────────────────────────

describe("AC3: formatDuration", () => {
  it("Happy path: 754 seconds formats to '12m 34s'", () => {
    // Arrange
    const seconds = 754;
    // Act
    const result = formatDuration(seconds);
    // Assert
    expect(result).toBe("12m 34s");
  });

  it("Edge case: 0 seconds formats to '0m 00s'", () => {
    // Arrange
    const seconds = 0;
    // Act
    const result = formatDuration(seconds);
    // Assert
    expect(result).toBe("0m 00s");
  });

  it("Edge case: exactly 60 seconds formats to '1m 00s'", () => {
    // Arrange
    const seconds = 60;
    // Act
    const result = formatDuration(seconds);
    // Assert
    expect(result).toBe("1m 00s");
  });

  it("No crash: does not throw on 0 input", () => {
    // Arrange / Act / Assert
    expect(() => formatDuration(0)).not.toThrow();
  });
});

// ─── AC1: calcEngagementScore ─────────────────────────────────────────────────

describe("AC1: calcEngagementScore — detection validation", () => {
  it("Happy path: 1800s note-taking in a 3600s session = 50% score", () => {
    // Arrange
    const noteTaking = 1800;
    const sessionDuration = 3600;
    // Act
    const score = calcEngagementScore(noteTaking, sessionDuration);
    // Assert
    expect(score).toBe(50);
  });

  it("Edge case: 0-second session returns 0 score (no division by zero)", () => {
    // Arrange
    const noteTaking = 500;
    const sessionDuration = 0;
    // Act
    const score = calcEngagementScore(noteTaking, sessionDuration);
    // Assert
    expect(score).toBe(0);
  });

  it("Edge case: note-taking > session duration is capped at 100", () => {
    // Arrange
    const noteTaking = 5000;
    const sessionDuration = 3600;
    // Act
    const score = calcEngagementScore(noteTaking, sessionDuration);
    // Assert
    expect(score).toBe(100);
  });

  it("No crash: does not throw when both values are 0", () => {
    // Arrange / Act / Assert
    expect(() => calcEngagementScore(0, 0)).not.toThrow();
  });
});

// ─── AC2: filterBySession ─────────────────────────────────────────────────────

describe("AC2: filterBySession", () => {
  it("Happy path: returns only records for sess-A", () => {
    // Arrange
    // Act
    const result = filterBySession(records, "sess-A");
    // Assert
    expect(result).toHaveLength(3); // r1 (Alice), r3 (Bob), r4 (Charlie)
    result.forEach((r) => expect(r.sessionId).toBe("sess-A"));
  });

  it("Edge case: session with single record returns that record", () => {
    // Arrange
    // Act
    const result = filterBySession(records, "sess-B");
    // Assert – r2 (Alice) + r5 (Diana)
    expect(result).toHaveLength(2);
  });

  it("Negative test: non-existent session returns empty", () => {
    // Arrange
    // Act
    const result = filterBySession(records, "sess-Z");
    // Assert
    expect(result).toHaveLength(0);
  });

  it("No crash: does not throw on empty record list", () => {
    // Arrange / Act / Assert
    expect(() => filterBySession([], "sess-A")).not.toThrow();
  });
});

// ─── AC2: buildStudentSummary ─────────────────────────────────────────────────

describe("AC2: buildStudentSummary — correct aggregation", () => {
  it("Happy path: Alice's totalSeconds sums both session records", () => {
    // Arrange – Alice has 1800 + 2700 = 4500s
    // Act
    const summaries = buildStudentSummary(records);
    const alice = summaries.find((s) => s.studentId === "stu-01");
    // Assert
    expect(alice).toBeDefined();
    expect(alice!.totalSeconds).toBe(4500);
    expect(alice!.sessionCount).toBe(2);
  });

  it("Edge case: single student with single record — correct summary", () => {
    // Arrange
    const singleRecord = [records[2]]; // Bob, 900s, sess-A
    // Act
    const summaries = buildStudentSummary(singleRecord);
    // Assert
    expect(summaries).toHaveLength(1);
    expect(summaries[0].studentId).toBe("stu-02");
    expect(summaries[0].totalSeconds).toBe(900);
    expect(summaries[0].sessionCount).toBe(1);
  });

  it("Edge case: student with 0-second record has engagementScore=0", () => {
    // Arrange – Diana has 0s
    // Act
    const summaries = buildStudentSummary([records[4]]);
    const diana = summaries.find((s) => s.studentId === "stu-04");
    // Assert
    expect(diana).toBeDefined();
    expect(diana!.engagementScore).toBe(0);
  });

  it("No crash: does not throw on empty record list", () => {
    // Arrange / Act / Assert
    expect(() => buildStudentSummary([])).not.toThrow();
  });
});

// ─── AC3: sortByDuration ──────────────────────────────────────────────────────

describe("AC3: sortByDuration", () => {
  it("Happy path: desc sort places highest totalSeconds first", () => {
    // Arrange
    const summaries = buildStudentSummary(records);
    // Act
    const result = sortByDuration(summaries, "desc");
    // Assert — first element has the highest totalSeconds
    expect(result[0].totalSeconds).toBeGreaterThanOrEqual(result[1].totalSeconds);
  });

  it("Edge case: asc sort places lowest totalSeconds first", () => {
    // Arrange
    const summaries = buildStudentSummary(records);
    // Act
    const result = sortByDuration(summaries, "asc");
    // Assert
    expect(result[0].totalSeconds).toBeLessThanOrEqual(result[1].totalSeconds);
  });

  it("Negative test: single summary returns same element regardless of direction", () => {
    // Arrange
    const single: StudentNoteSummary[] = [
      { studentId: "x", name: "X", totalSeconds: 100, avgSecondsPerSession: 100, sessionCount: 1, engagementScore: 50 },
    ];
    // Act
    const desc = sortByDuration(single, "desc");
    const asc  = sortByDuration(single, "asc");
    // Assert
    expect(desc[0].studentId).toBe("x");
    expect(asc[0].studentId).toBe("x");
  });

  it("No crash: does not throw on empty input", () => {
    // Arrange / Act / Assert
    expect(() => sortByDuration([], "desc")).not.toThrow();
  });
});

// ─── AC3: getTopEngaged ───────────────────────────────────────────────────────

describe("AC3: getTopEngaged", () => {
  it("Happy path: returns top 2 students by engagement score", () => {
    // Arrange
    const summaries = buildStudentSummary(records);
    // Act
    const result = getTopEngaged(summaries, 2);
    // Assert
    expect(result).toHaveLength(2);
    expect(result[0].engagementScore).toBeGreaterThanOrEqual(result[1].engagementScore);
  });

  it("Edge case: n=0 returns empty array", () => {
    // Arrange
    const summaries = buildStudentSummary(records);
    // Act
    const result = getTopEngaged(summaries, 0);
    // Assert
    expect(result).toHaveLength(0);
  });

  it("Edge case: n > total students returns all students", () => {
    // Arrange
    const summaries = buildStudentSummary(records);
    const total = summaries.length;
    // Act
    const result = getTopEngaged(summaries, total + 10);
    // Assert
    expect(result).toHaveLength(total);
  });

  it("No crash: does not throw on empty input", () => {
    // Arrange / Act / Assert
    expect(() => getTopEngaged([], 5)).not.toThrow();
  });
});
