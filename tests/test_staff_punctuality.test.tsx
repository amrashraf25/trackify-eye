/**
 * ====================================================================
 * Staff Punctuality Alerts — Unit Tests
 * Exactly 4 tests per function: Happy path / Edge case / Negative / No crash
 * ====================================================================
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  isLateArrival,
  isEarlyDeparture,
  getMinutesLate,
  buildPunctualityAlert,
  filterAlertsByStaff,
  PunctualityAlert,
} from "../src/components/StaffPunctualityAlerts";

function offsetDate(base: Date, offsetSeconds: number): Date {
  return new Date(base.getTime() + offsetSeconds * 1000);
}

let baseDate: Date;
let alerts: PunctualityAlert[];

beforeEach(() => {
  baseDate = new Date("2024-03-04T09:00:00");
  alerts = [
    { id: "a1", staffId: "staff_101", staffName: "Dr. Eleanor Vance", role: "lecturer", type: "late_arrival",    minutesDiff: 15, scheduledTime: "2024-03-04T09:00:00", actualTime: "2024-03-04T09:15:00", sessionId: "sess_01", location: "Hall A",    detectedAt: "2024-03-04T09:15:05" },
    { id: "a2", staffId: "staff_102", staffName: "Mr. James Okafor",  role: "ta",       type: "early_departure", minutesDiff: 20, scheduledTime: "2024-03-04T11:00:00", actualTime: "2024-03-04T10:40:00", sessionId: "sess_02", location: "Lab B",    detectedAt: "2024-03-04T10:40:10" },
    { id: "a3", staffId: "staff_101", staffName: "Dr. Eleanor Vance", role: "lecturer", type: "early_departure", minutesDiff: 5,  scheduledTime: "2024-03-04T14:00:00", actualTime: "2024-03-04T13:55:00", sessionId: "sess_03", location: "Room 201", detectedAt: "2024-03-04T13:55:08" },
    { id: "a4", staffId: "staff_103", staffName: "Dr. Amina Khalil",  role: "lecturer", type: "late_arrival",    minutesDiff: 3,  scheduledTime: "2024-03-04T10:00:00", actualTime: "2024-03-04T10:03:00", sessionId: "sess_04", location: "Hall C",   detectedAt: "2024-03-04T10:03:02" },
  ];
});

// ─── AC1: Late arrival detection ──────────────────────────────────────────────

describe("AC1: Late arrival detection (isLateArrival and getMinutesLate)", () => {
  it("Happy path: 15 min late (tolerance 10) is late; getMinutesLate returns correct signed value", () => {
    expect(isLateArrival(baseDate, offsetDate(baseDate, 15 * 60), 10)).toBe(true);
    expect(getMinutesLate(baseDate, offsetDate(baseDate, 20 * 60))).toBe(20);
    expect(getMinutesLate(baseDate, offsetDate(baseDate, -8 * 60))).toBe(-8);
    expect(getMinutesLate(baseDate, new Date(baseDate.getTime()))).toBe(0);
  });

  it("Edge case: exactly at tolerance boundary (10 min) is NOT late; on time = 0", () => {
    expect(isLateArrival(baseDate, offsetDate(baseDate, 10 * 60), 10)).toBe(false);
    expect(isLateArrival(baseDate, new Date(baseDate.getTime()), 10)).toBe(false);
  });

  it("Negative test: arrival before scheduled time (early arrival) is not late", () => {
    expect(isLateArrival(baseDate, offsetDate(baseDate, -5 * 60), 10)).toBe(false);
  });

  it("No crash: equal dates and getMinutesLate do not throw", () => {
    expect(() => isLateArrival(baseDate, baseDate, 10)).not.toThrow();
    expect(() => getMinutesLate(baseDate, baseDate)).not.toThrow();
  });
});

// ─── AC2: Early departure detection, alert building, and staff filtering ──────

describe("AC2: Early departure, buildPunctualityAlert, and filterAlertsByStaff", () => {
  it("Happy path: 20 min early is early departure; buildPunctualityAlert returns correct object", () => {
    const scheduledEnd = new Date("2024-03-04T11:00:00");
    expect(isEarlyDeparture(scheduledEnd, new Date("2024-03-04T10:40:00"))).toBe(true);
    const alert = buildPunctualityAlert("Dr. Eleanor Vance", "late_arrival", 15, baseDate);
    expect(alert.staffName).toBe("Dr. Eleanor Vance");
    expect(alert.type).toBe("late_arrival");
    expect(alert.minutesDiff).toBe(15);
  });

  it("Edge case: departure exactly at scheduled end is NOT early; 1 second early IS early", () => {
    const scheduledEnd = new Date("2024-03-04T11:00:00");
    expect(isEarlyDeparture(scheduledEnd, scheduledEnd)).toBe(false);
    expect(isEarlyDeparture(scheduledEnd, offsetDate(scheduledEnd, -1))).toBe(true);
  });

  it("Negative test: departure after scheduled end is not early; filterAlertsByStaff with unknown id returns empty", () => {
    const scheduledEnd = new Date("2024-03-04T11:00:00");
    expect(isEarlyDeparture(scheduledEnd, offsetDate(scheduledEnd, 5 * 60))).toBe(false);
    expect(filterAlertsByStaff(alerts, "staff_999_unknown").length).toBe(0);
  });

  it("No crash: empty staffName in buildPunctualityAlert and empty alerts array do not throw", () => {
    expect(() => buildPunctualityAlert("", "early_departure", 10, baseDate)).not.toThrow();
    expect(() => filterAlertsByStaff([], "staff_101")).not.toThrow();
  });
});
