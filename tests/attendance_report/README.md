# Attendance Report Feature — Tests

Unit tests for the student attendance report in `src/pages/Reports.tsx`.

## Folder

```
tests/attendance_report/
├── test_attendance_report.test.tsx   ← all tests
└── README.md
```

## Run

```bash
npx vitest run tests/attendance_report/test_attendance_report.test.tsx
```

## Coverage

| describe block | AC | What it verifies |
|---|---|---|
| AC1: Attendance report generation | AC1 | Records within date range are included; old records excluded |
| AC2: Per-student attendance metrics | AC2 | total classes, present, absent, late, % per student |
| AC3: Course filter | AC3 | Only the selected course's records are returned |
| AC3: Department filter | AC3 | Only courses belonging to the selected dept are returned |
| AC3: Semester filter | AC3 | Only courses matching the selected semester are returned |
| AC3: Combined filters | AC3 | Multiple filters work together, conflicts return empty |
| Semester dropdown population | AC3 | Unique, sorted semester list derived from courses |

## Upload as a branch

```bash
git checkout -b feature/attendance-report-tests
git add tests/attendance_report/
git commit -m "test: unit tests for attendance report (AC1/AC2/AC3)"
git push origin feature/attendance-report-tests
```
