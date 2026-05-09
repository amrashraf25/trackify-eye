import { describe, it, expect, beforeEach } from "vitest";
import {
  getAlertAge,
  isEligibleForAutoClear,
  shouldAutoClear,
  getAlertStatus,
  buildClearNotification,
  filterByStatus,
  FightAlert,
  ClearNotification,
} from "./feature_files/FightAlertAutoClear";

// ─── TEST DATA ─────────────────────────────────────────────────────────────────

let baseTime: Date;
let alertActive: FightAlert;
let alertCleared: FightAlert;
let alertMonitoring: FightAlert;
let allAlerts: FightAlert[];

beforeEach(() => {
  baseTime = new Date("2025-04-01T10:00:00.000Z");

  alertActive = {
    id: "a1",
    location: "Corridor B",
    createdAt: new Date("2025-04-01T10:00:00.000Z"),
    status: "active",
    cameraId: "cam-01",
  };

  alertCleared = {
    id: "a2",
    location: "Cafeteria",
    createdAt: new Date("2025-04-01T09:00:00.000Z"),
    status: "cleared",
    cameraId: "cam-02",
  };

  alertMonitoring = {
    id: "a3",
    location: "Gym",
    createdAt: new Date("2025-04-01T09:50:00.000Z"),
    status: "monitoring",
    cameraId: "cam-03",
  };

  allAlerts = [alertActive, alertCleared, alertMonitoring];
});

// ─── AC1: getAlertAge ─────────────────────────────────────────────────────────

describe("AC1: getAlertAge", () => {
  it("Happy path: returns correct seconds elapsed between two dates", () => {
    // Arrange
    const created = new Date("2025-04-01T10:00:00.000Z");
    const now     = new Date("2025-04-01T10:05:00.000Z"); // +300s
    // Act
    const age = getAlertAge(created, now);
    // Assert
    expect(age).toBe(300);
  });

  it("Edge case: same timestamps return 0 seconds", () => {
    // Arrange
    const t = new Date("2025-04-01T10:00:00.000Z");
    // Act
    const age = getAlertAge(t, t);
    // Assert
    expect(age).toBe(0);
  });

  it("Negative test: now before createdAt clamps to 0 (no negative age)", () => {
    // Arrange
    const created = new Date("2025-04-01T10:05:00.000Z");
    const now     = new Date("2025-04-01T10:00:00.000Z");
    // Act
    const age = getAlertAge(created, now);
    // Assert
    expect(age).toBeGreaterThanOrEqual(0);
  });

  it("No crash: does not throw with arbitrary dates", () => {
    // Arrange / Act / Assert
    expect(() => getAlertAge(new Date(), new Date())).not.toThrow();
  });
});

// ─── AC1: isEligibleForAutoClear ──────────────────────────────────────────────

describe("AC1: isEligibleForAutoClear — exactly at 5-min boundary", () => {
  it("Happy path: alert at exactly 300s is eligible", () => {
    // Arrange
    const created = new Date("2025-04-01T10:00:00.000Z");
    const now     = new Date("2025-04-01T10:05:00.000Z"); // exactly 300s later
    // Act
    const result = isEligibleForAutoClear(created, now, 300);
    // Assert
    expect(result).toBe(true);
  });

  it("Edge case: alert at 299s is NOT eligible (< 300s)", () => {
    // Arrange
    const created = new Date("2025-04-01T10:00:00.000Z");
    const now     = new Date("2025-04-01T10:04:59.000Z"); // 299s later
    // Act
    const result = isEligibleForAutoClear(created, now, 300);
    // Assert
    expect(result).toBe(false);
  });

  it("Negative test: fresh alert (5s old) is not eligible", () => {
    // Arrange
    const created = new Date("2025-04-01T10:00:00.000Z");
    const now     = new Date("2025-04-01T10:00:05.000Z"); // only 5s later
    // Act
    const result = isEligibleForAutoClear(created, now, 300);
    // Assert
    expect(result).toBe(false);
  });

  it("No crash: does not throw when dates are equal", () => {
    // Arrange
    const t = new Date();
    // Act / Assert
    expect(() => isEligibleForAutoClear(t, t, 300)).not.toThrow();
  });
});

// ─── AC2: shouldAutoClear ─────────────────────────────────────────────────────

describe("AC2: shouldAutoClear", () => {
  it("Happy path: eligible alert + clear camera = should auto-clear", () => {
    // Arrange — alert created 10 minutes ago
    const oldAlert: FightAlert = {
      ...alertActive,
      createdAt: new Date(Date.now() - 10 * 60 * 1000), // 10 min ago
    };
    // Act
    const result = shouldAutoClear(oldAlert, "clear");
    // Assert
    expect(result).toBe(true);
  });

  it("Edge case: cameraStatus='unknown' never triggers auto-clear", () => {
    // Arrange — alert is old enough
    const oldAlert: FightAlert = {
      ...alertActive,
      createdAt: new Date(Date.now() - 10 * 60 * 1000),
    };
    // Act
    const result = shouldAutoClear(oldAlert, "unknown");
    // Assert
    expect(result).toBe(false);
  });

  it("Negative test: camera is 'active' — no auto-clear even if eligible", () => {
    // Arrange
    const oldAlert: FightAlert = {
      ...alertActive,
      createdAt: new Date(Date.now() - 10 * 60 * 1000),
    };
    // Act
    const result = shouldAutoClear(oldAlert, "active");
    // Assert
    expect(result).toBe(false);
  });

  it("No crash: does not throw with fresh alert + unknown status", () => {
    // Arrange / Act / Assert
    expect(() => shouldAutoClear(alertActive, "unknown")).not.toThrow();
  });
});

// ─── AC2: getAlertStatus ──────────────────────────────────────────────────────

describe("AC2: getAlertStatus", () => {
  it("Happy path: alert with status='cleared' returns 'cleared'", () => {
    // Arrange
    // Act
    const result = getAlertStatus(alertCleared);
    // Assert
    expect(result).toBe("cleared");
  });

  it("Edge case: alert with status='resolved' returns 'resolved'", () => {
    // Arrange
    const resolvedAlert: FightAlert = { ...alertActive, status: "resolved" };
    // Act
    const result = getAlertStatus(resolvedAlert);
    // Assert
    expect(result).toBe("resolved");
  });

  it("Negative test: brand-new alert (< 5 min) returns 'active'", () => {
    // Arrange — created just now
    const freshAlert: FightAlert = { ...alertActive, createdAt: new Date() };
    // Act
    const result = getAlertStatus(freshAlert);
    // Assert
    expect(result).toBe("active");
  });

  it("No crash: does not throw for any valid alert", () => {
    // Arrange / Act / Assert
    expect(() => getAlertStatus(alertActive)).not.toThrow();
  });
});

// ─── AC3: buildClearNotification ─────────────────────────────────────────────

describe("AC3: buildClearNotification", () => {
  it("Happy path: notification contains all required fields and non-empty message", () => {
    // Arrange
    const clearedAt = new Date("2025-04-01T10:10:00.000Z");
    // Act
    const notification: ClearNotification = buildClearNotification(alertActive, clearedAt);
    // Assert
    expect(notification.alertId).toBe("a1");
    expect(notification.location).toBe("Corridor B");
    expect(notification.originalTime).toEqual(alertActive.createdAt);
    expect(notification.clearedAt).toEqual(clearedAt);
    expect(notification.message.length).toBeGreaterThan(0);
  });

  it("Edge case: notification message includes the location name", () => {
    // Arrange
    const clearedAt = new Date();
    // Act
    const notification = buildClearNotification(alertActive, clearedAt);
    // Assert
    expect(notification.message).toContain("Corridor B");
  });

  it("Negative test: different alert produces different alertId in notification", () => {
    // Arrange
    const clearedAt = new Date();
    // Act
    const n1 = buildClearNotification(alertActive,   clearedAt);
    const n2 = buildClearNotification(alertCleared,  clearedAt);
    // Assert
    expect(n1.alertId).not.toBe(n2.alertId);
  });

  it("No crash: does not throw when building a notification", () => {
    // Arrange / Act / Assert
    expect(() => buildClearNotification(alertActive, new Date())).not.toThrow();
  });
});

// ─── AC3: filterByStatus ─────────────────────────────────────────────────────

describe("AC3: filterByStatus", () => {
  it("Happy path: returns only alerts matching the requested status", () => {
    // Arrange
    // Act
    const result = filterByStatus(allAlerts, "cleared");
    // Assert
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("a2");
  });

  it("Edge case: filtering empty list returns empty array", () => {
    // Arrange
    // Act
    const result = filterByStatus([], "active");
    // Assert
    expect(result).toHaveLength(0);
  });

  it("Negative test: filtering for non-existent status returns empty", () => {
    // Arrange
    // Act
    const result = filterByStatus(allAlerts, "nonexistent");
    // Assert
    expect(result).toHaveLength(0);
  });

  it("No crash: does not throw on empty input", () => {
    // Arrange / Act / Assert
    expect(() => filterByStatus([], "active")).not.toThrow();
  });
});
