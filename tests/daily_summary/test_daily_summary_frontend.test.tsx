/**
 * ====================================================================
 * Daily Behavior Summary — Frontend Unit Tests
 * Follows JUnit-style structure adapted for TypeScript / Vitest:
 *
 *   AAA Pattern  : Arrange → Act → Assert in every test
 *   beforeEach() : mocks fetch globally (@BeforeEach equivalent)
 *   afterEach()  : restores all mocks (@AfterEach equivalent)
 *   Assertions   : expect(...).toBeInTheDocument / toBeTruthy / toBeGreaterThanOrEqual
 *   Mocking      : vi.stubGlobal("fetch", vi.fn(...)) — Mockito equivalent
 *
 *   Testing Checklist:
 *     ✅ Happy path  – normal inputs, expected behaviour
 *     ✅ Edge cases  – empty, null, zero, boundary values
 *     ✅ Negative    – invalid inputs, network failure
 *     ✅ No crashes  – all edge paths return safe results, no throws
 *
 * Covers:
 *   AC1 — Incidents returned from API are rendered
 *   AC2 — Aggregated totals (total, by_type, top_behavior) are shown correctly
 *   AC3 — Staff-facing summary card renders all required sections
 * ====================================================================
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { format, subDays } from "date-fns";
import DailySummaryCard from "../../src/components/dashboard/DailySummaryCard";

// ── Shared fixtures ──────────────────────────────────────────────────────────
const TODAY     = format(new Date(), "yyyy-MM-dd");
const YESTERDAY = format(subDays(new Date(), 1), "yyyy-MM-dd");

const MOCK_SUMMARY = {
  date: TODAY,
  total: 5,
  by_type: {
    phone_use: 2,
    sleeping:  2,
    fighting:  1,
  },
  by_severity: {
    high:     2,
    medium:   1,
    critical: 1,
    low:      1,
  },
  top_behavior: "phone_use",
  incidents: [
    { id: "a1", incident_type: "phone_use", severity: "high",     detected_at: `${TODAY}T08:10:00+00:00`, room_number: "101", student_id: "s1" },
    { id: "a2", incident_type: "sleeping",  severity: "medium",   detected_at: `${TODAY}T09:00:00+00:00`, room_number: "101", student_id: "s2" },
    { id: "a3", incident_type: "phone_use", severity: "high",     detected_at: `${TODAY}T10:05:00+00:00`, room_number: "202", student_id: "s1" },
    { id: "a4", incident_type: "fighting",  severity: "critical", detected_at: `${TODAY}T11:20:00+00:00`, room_number: "101", student_id: "s3" },
    { id: "a5", incident_type: "sleeping",  severity: "low",      detected_at: `${TODAY}T13:00:00+00:00`, room_number: "303", student_id: "s4" },
  ],
};

const EMPTY_SUMMARY = {
  date: YESTERDAY,
  total: 0,
  by_type: {},
  by_severity: {},
  top_behavior: null,
  incidents: [],
};

// ── Test wrapper — provides React Query context ──────────────────────────────
const wrapper = ({ children }: { children: React.ReactNode }) => {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
};

// ── @BeforeEach — stub fetch to return mock data ─────────────────────────────
beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string) => {
      if (url.includes(YESTERDAY)) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(EMPTY_SUMMARY),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(MOCK_SUMMARY),
      });
    })
  );
});

// ── @AfterEach — restore all mocks ──────────────────────────────────────────
afterEach(() => {
  vi.restoreAllMocks();
});

// ════════════════════════════════════════════════════════════════════════════
//  AC1 — Incidents are recorded and rendered
// ════════════════════════════════════════════════════════════════════════════
describe("AC1: Incident recording rendered", () => {
  it("Happy path: renders the card header and title", async () => {
    // Arrange
    render(<DailySummaryCard />, { wrapper });

    // Act + Assert
    await waitFor(() => {
      expect(screen.getByText(/daily behavior summary/i)).toBeInTheDocument();
    });
  });

  it("Happy path: renders behavior type labels once data loads", async () => {
    // Arrange
    render(<DailySummaryCard />, { wrapper });

    // Act + Assert — getAllByText handles the label appearing in both the chart
    // and the "Most common today" badge without throwing MultipleElements error
    await waitFor(() => {
      expect(screen.getAllByText(/phone use/i).length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText(/sleeping/i).length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText(/fighting/i).length).toBeGreaterThanOrEqual(1);
    });
  });

  it("No crash: does not throw when API returns an empty incidents array", async () => {
    // Arrange — navigate to yesterday which returns EMPTY_SUMMARY
    render(<DailySummaryCard />, { wrapper });
    const buttons = screen.getAllByRole("button");

    // Act
    expect(() => fireEvent.click(buttons[0])).not.toThrow();

    // Assert — component still renders (no crash)
    await waitFor(() => {
      expect(screen.getByText(/daily behavior summary/i)).toBeInTheDocument();
    });
  });
});

// ════════════════════════════════════════════════════════════════════════════
//  AC2 — Daily totals are displayed correctly
// ════════════════════════════════════════════════════════════════════════════
describe("AC2: Daily aggregation displayed", () => {
  it("Happy path: shows the correct total incident count", async () => {
    // Arrange
    render(<DailySummaryCard />, { wrapper });

    // Act + Assert
    await waitFor(() => {
      expect(screen.getByText("5")).toBeInTheDocument();
    });
  });

  it("Happy path: shows per-type counts in the breakdown", async () => {
    // Arrange
    render(<DailySummaryCard />, { wrapper });

    // Act + Assert — phone_use count "2" appears at least once in the bar chart
    await waitFor(() => {
      const twos = screen.getAllByText("2");
      expect(twos.length).toBeGreaterThanOrEqual(1);
    });
  });

  it("Happy path: shows the top behavior badge with most-common label", async () => {
    // Arrange
    render(<DailySummaryCard />, { wrapper });

    // Act + Assert
    await waitFor(() => {
      expect(screen.getByText(/most common today/i)).toBeInTheDocument();
      expect(screen.getAllByText(/phone use/i).length).toBeGreaterThanOrEqual(1);
    });
  });

  it("Happy path: shows 'Today' label when viewing the current date", async () => {
    // Arrange
    render(<DailySummaryCard />, { wrapper });

    // Act + Assert
    await waitFor(() => {
      expect(screen.getByText("Today")).toBeInTheDocument();
    });
  });

  it("Edge case: shows zero total when there are no incidents", async () => {
    // Arrange — navigate to yesterday which has total: 0
    render(<DailySummaryCard />, { wrapper });
    const buttons = screen.getAllByRole("button");

    // Act — click the prev-day button
    fireEvent.click(buttons[0]);

    // Assert — total becomes "0"
    await waitFor(() => {
      expect(screen.getByText("0")).toBeInTheDocument();
    });
  });
});

// ════════════════════════════════════════════════════════════════════════════
//  AC3 — Staff summary dashboard renders required sections
// ════════════════════════════════════════════════════════════════════════════
describe("AC3: Staff summary dashboard sections", () => {
  it("Happy path: renders the Total KPI card", async () => {
    // Arrange
    render(<DailySummaryCard />, { wrapper });

    // Act + Assert
    await waitFor(() => {
      expect(screen.getByText(/total/i)).toBeInTheDocument();
    });
  });

  it("Happy path: renders severity breakdown pills", async () => {
    // Arrange
    render(<DailySummaryCard />, { wrapper });

    // Act + Assert — at least one severity label appears
    await waitFor(() => {
      const hasSev =
        screen.queryByText(/high/i) ||
        screen.queryByText(/critical/i) ||
        screen.queryByText(/medium/i) ||
        screen.queryByText(/low/i);
      expect(hasSev).toBeTruthy();
    });
  });

  it("Happy path: renders the 'Breakdown by behavior type' section header", async () => {
    // Arrange
    render(<DailySummaryCard />, { wrapper });

    // Act + Assert
    await waitFor(() => {
      expect(screen.getByText(/breakdown by behavior type/i)).toBeInTheDocument();
    });
  });

  it("Happy path: renders the date navigator with prev/next buttons", async () => {
    // Arrange
    render(<DailySummaryCard />, { wrapper });

    // Act + Assert — two chevron buttons must be present
    const buttons = screen.getAllByRole("button");
    expect(buttons.length).toBeGreaterThanOrEqual(2);
  });

  it("Edge case: shows 'No incidents' message on a day with empty data", async () => {
    // Arrange
    render(<DailySummaryCard />, { wrapper });
    const buttons = screen.getAllByRole("button");
    const prevBtn = buttons[0]; // ChevronLeft = navigate to yesterday

    // Act
    fireEvent.click(prevBtn);

    // Assert
    await waitFor(() => {
      expect(screen.getByText(/no incidents on this day/i)).toBeInTheDocument();
    });
  });

  it("Negative test: shows error state when backend is unreachable", async () => {
    // Arrange — override fetch to simulate network failure
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new Error("Network Error")))
    );

    // Act
    render(<DailySummaryCard />, { wrapper });

    // Assert — error message rendered, no unhandled exception
    await waitFor(() => {
      expect(screen.getByText(/could not load summary/i)).toBeInTheDocument();
    });
  });

  it("No crash: does not throw on fetch rejection", () => {
    // Arrange
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new Error("Unexpected error")))
    );

    // Act + Assert — rendering must never throw
    expect(() => render(<DailySummaryCard />, { wrapper })).not.toThrow();
  });
});
