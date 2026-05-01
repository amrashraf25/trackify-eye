import { describe, it, expect, beforeEach } from "vitest";
import {
  isLateArrival,
  isEarlyDeparture,
  getMinutesLate,
  buildPunctualityAlert,
  filterAlertsByStaff,
  PunctualityAlert,
} from "./feature_files/StaffPunctualityAlerts";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Construct a Date offset from a base date by a given number of seconds. */
function offsetDate(base: Date, offsetSeconds: number): Date {
  return new Date(base.getTime() + offsetSeconds * 1000);
}

// ─── Shared test data ─────────────────────────────────────────────────────────

let baseDate: Date;
let alerts: PunctualityAlert[];

beforeEach(() => {
  // Monday 9:00:00 AM — used as the scheduled start for most tests
  baseDate = new Date("2024-03-04T09:00:00");

  alerts = [
    {
      id: "a1",
      staffId: "staff_101",
      staffName: "Dr. Eleanor Vance",
      role: "lecturer",
      type: "late_arrival",
      minutesDiff: 15,
      scheduledTime: "2024-03-04T09:00:00",
      actualTime: "2024-03-04T09:15:00",
      sessionId: "sess_01",
      location: "Hall A",
      detectedAt: "2024-03-04T09:15:05",
    },
    {
      id: "a2",
      staffId: "staff_102",
      staffName: "Mr. James Okafor",
      role: "ta",
      type: "early_departure",
      minutesDiff: 20,
      scheduledTime: "2024-03-04T11:00:00",
      actualTime: "2024-03-04T10:40:00",
      sessionId: "sess_02",
      location: "Lab B",
      detectedAt: "2024-03-04T10:40:10",
    },
    {
      id: "a3",
      staffId: "staff_101",
      staffName: "Dr. Eleanor Vance",
      role: "lecturer",
      type: "early_departure",
      minutesDiff: 5,
      scheduledTime: "2024-03-04T14:00:00",
      actualTime: "2024-03-04T13:55:00",
      sessionId: "sess_03",
      location: "Room 201",
      detectedAt: "2024-03-04T13:55:08",
    },
    {
      id: "a4",
      staffId: "staff_103",
      staffName: "Dr. Amina Khalil",
      role: "lecturer",
      type: "late_arrival",
      minutesDiff: 3,
      scheduledTime: "2024-03-04T10:00:00",
      actualTime: "2024-03-04T10:03:00",
      sessionId: "sess_04",
      location: "Hall C",
      detectedAt: "2024-03-04T10:03:02",
    },
  ];
});

// ─── AC1: Late Arrival Detection (TP-14) ──────────────────────────────────────

describe("AC1: Late arrival detection", () => {
  it("Happy path: arrival 15 minutes after scheduled start (tolerance 10) is late", () => {
    // Arrange
    const scheduled = baseDate;
    const actual = offsetDate(baseDate, 15 * 60); // +15 min

    // Act
    const result = isLateArrival(scheduled, actual, 10);

    // Assert
    expect(result).toBe(true);
  });

  it("Edge case: arrival exactly at tolerance boundary (10 min) is NOT late", () => {
    // Arrange
    const scheduled = baseDate;
    const actual = offsetDate(baseDate, 10 * 60); // exactly +10 min

    // Act
    const result = isLateArrival(scheduled, actual, 10);

    // Assert
    expect(result).toBe(false);
  });

  it("Edge case: arrival 1 second past tolerance (10 min + 1 sec) IS late", () => {
    // Arrange
    const scheduled = baseDate;
    const actual = offsetDate(baseDate, 10 * 60 + 1); // 10 min 1 sec

    // Act
    const result = isLateArrival(scheduled, actual, 10);

    // Assert
    expect(result).toBe(true);
  });

  it("Edge case: arrival exactly on time (0 min diff) is NOT late", () => {
    // Arrange
    const scheduled = baseDate;
    const actual = new Date(baseDate.getTime()); // same time

    // Act
    const result = isLateArrival(scheduled, actual, 10);

    // Assert
    expect(result).toBe(false);
  });

  it("Negative test: staff arrived EARLY (negative diff) is not late", () => {
    // Arrange
    const scheduled = baseDate;
    const actual = offsetDate(baseDate, -5 * 60); // arrived 5 min early

    // Act
    const result = isLateArrival(scheduled, actual, 10);

    // Assert
    expect(result).toBe(false);
  });

  it("No crash: does not throw when dates are equal", () => {
    expect(() => isLateArrival(baseDate, baseDate, 10)).not.toThrow();
  });

  it("getMinutesLate: returns positive number when late", () => {
    // Arrange
    const scheduled = baseDate;
    const actual = offsetDate(baseDate, 20 * 60); // 20 min late

    // Act
    const minutes = getMinutesLate(scheduled, actual);

    // Assert
    expect(minutes).toBe(20);
  });

  it("getMinutesLate: returns negative number when arrived early", () => {
    // Arrange
    const scheduled = baseDate;
    const actual = offsetDate(baseDate, -8 * 60); // 8 min early

    // Act
    const minutes = getMinutesLate(scheduled, actual);

    // Assert
    expect(minutes).toBe(-8);
  });

  it("getMinutesLate: returns 0 when on time", () => {
    // Arrange
    const scheduled = baseDate;
    const actual = new Date(baseDate.getTime());

    // Act
    const minutes = getMinutesLate(scheduled, actual);

    // Assert
    expect(minutes).toBe(0);
  });

  it("No crash: getMinutesLate does not throw with equal dates", () => {
    expect(() => getMinutesLate(baseDate, baseDate)).not.toThrow();
  });
});

// ─── AC2: Early Departure Detection (TP-14) ───────────────────────────────────

describe("AC2: Early departure detection", () => {
  it("Happy path: departure 20 minutes before scheduled end is early", () => {
    // Arrange
    const scheduledEnd = new Date("2024-03-04T11:00:00");
    const actualDep = new Date("2024-03-04T10:40:00"); // 20 min early

    // Act
    const result = isEarlyDeparture(scheduledEnd, actualDep);

    // Assert
    expect(result).toBe(true);
  });

  it("Edge case: departure exactly at scheduled end time is NOT early", () => {
    // Arrange
    const scheduledEnd = new Date("2024-03-04T11:00:00");
    const actualDep = new Date("2024-03-04T11:00:00"); // exactly on time

    // Act
    const result = isEarlyDeparture(scheduledEnd, actualDep);

    // Assert
    expect(result).toBe(false);
  });

  it("Edge case: departure 1 second before scheduled end IS early", () => {
    // Arrange
    const scheduledEnd = new Date("2024-03-04T11:00:00");
    const actualDep = offsetDate(scheduledEnd, -1); // 1 second early

    // Act
    const result = isEarlyDeparture(scheduledEnd, actualDep);

    // Assert
    expect(result).toBe(true);
  });

  it("Negative test: departure after scheduled end is NOT early departure", () => {
    // Arrange
    const scheduledEnd = new Date("2024-03-04T11:00:00");
    const actualDep = offsetDate(scheduledEnd, 5 * 60); // left 5 min late

    // Act
    const result = isEarlyDeparture(scheduledEnd, actualDep);

    // Assert
    expect(result).toBe(false);
  });

  it("No crash: does not throw when departure equals scheduled end", () => {
    const scheduledEnd = new Date("2024-03-04T11:00:00");
    expect(() => isEarlyDeparture(scheduledEnd, scheduledEnd)).not.toThrow();
  });

  it("buildPunctualityAlert: returns correct alert object for late_arrival", () => {
    // Arrange
    const scheduledTime = baseDate;

    // Act
    const alert = buildPunctualityAlert(
      "Dr. Eleanor Vance",
      "late_arrival",
      15,
      scheduledTime
    );

    // Assert
    expect(alert.staffName).toBe("Dr. Eleanor Vance");
    expect(alert.type).toBe("late_arrival");
    expect(alert.minutesDiff).toBe(15);
    expect(alert.scheduledTime).toBe(scheduledTime.toISOString());
  });

  it("buildPunctualityAlert: returns correct alert object for early_departure", () => {
    // Arrange
    const scheduledEnd = new Date("2024-03-04T11:00:00");

    // Act
    const alert = buildPunctualityAlert(
      "Mr. James Okafor",
      "early_departure",
      20,
      scheduledEnd
    );

    // Assert
    expect(alert.type).toBe("early_departure");
    expect(alert.minutesDiff).toBe(20);
    expect(alert.staffName).toBe("Mr. James Okafor");
  });

  it("buildPunctualityAlert: 0-minute difference is captured correctly", () => {
    // Arrange + Act
    const alert = buildPunctualityAlert("Staff X", "late_arrival", 0, baseDate);

    // Assert
    expect(alert.minutesDiff).toBe(0);
  });

  it("No crash: buildPunctualityAlert does not throw on empty staffName", () => {
    expect(() =>
      buildPunctualityAlert("", "early_departure", 10, baseDate)
    ).not.toThrow();
  });

  it("filterAlertsByStaff: returns only alerts for the specified staffId", () => {
    // Arrange
    const input = alerts;

    // Act
    const result = filterAlertsByStaff(input, "staff_101");

    // Assert
    expect(result.length).toBe(2);
    result.forEach((a) => expect(a.staffId).toBe("staff_101"));
  });

  it("filterAlertsByStaff: empty staffId returns all alerts", () => {
    // Arrange + Act
    const result = filterAlertsByStaff(alerts, "");

    // Assert
    expect(result.length).toBe(alerts.length);
  });

  it("filterAlertsByStaff: nonexistent staffId returns empty array", () => {
    // Arrange + Act
    const result = filterAlertsByStaff(alerts, "staff_999_unknown");

    // Assert
    expect(result.length).toBe(0);
  });

  it("No crash: filterAlertsByStaff does not throw on empty alerts array", () => {
    expect(() => filterAlertsByStaff([], "staff_101")).not.toThrow();
  });
});
