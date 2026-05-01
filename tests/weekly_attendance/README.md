# Weekly Attendance — Tests

Unit tests for the weekly attendance summary feature.

## Folder
```
tests/weekly_attendance/
├── feature_files/
│   └── WeeklyAttendanceSummary.tsx
├── test_weekly_attendance.test.tsx
└── README.md
```

## Run
```bash
npx vitest run tests/weekly_attendance/test_weekly_attendance.test.tsx
```

## Coverage

| describe block | AC | What it verifies |
|---|---|---|
| AC1: filterByWeek | AC1 | Only records within [weekStart, weekEnd] are returned; boundary values included; inverted range returns empty |
| AC2: buildWeeklySummary | AC2 | Correct totals per student (present/absent/late/pct); students with no records get zero counts; orphan records silently skipped |
| AC3: categorizePct | AC3 | ≥75 → good, ≥50 → warning, <50 → danger; boundary values; negative pct handled |
| AC4: full pipeline | AC4 | All three functions chained together produce a valid report; empty data is safe; all-absent week flags everyone danger |

## Jira stories
- TP-1 — Weekly Attendance Overview
- TP-3 — Automated Weekly Attendance (Admin)
- TP-34 — Weekly Attendance Summary Generation

## Upload as a branch
```bash
git checkout -b feature/weekly-attendance-tests
git add tests/weekly_attendance/
git commit -m "test: unit tests for weekly attendance summary"
git push origin feature/weekly-attendance-tests
```
