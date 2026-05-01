# Attendance Download — Tests

Unit tests for the attendance report download feature.

## Folder
```
tests/attendance_download/
├── feature_files/
│   └── AttendanceDownload.tsx
├── test_attendance_download.test.tsx
└── README.md
```

## Run
```bash
npx vitest run tests/attendance_download/test_attendance_download.test.tsx
```

## Coverage

| describe block | AC | What it verifies |
|---|---|---|
| AC1: getStatusLabel | AC1 | present/absent/late map to human labels; case-insensitive; unknown/empty → "Unknown" |
| AC2: formatCsvRow | AC2 | Correct 5-element row order; date formatted en-GB; empty fields return empty strings; unknown status → "Unknown" |
| AC3: buildCsvContent | AC3 | Header row matches columns; one row per record; commas and quotes in values properly escaped; empty records returns header only |
| AC3: filterDownloadableRecords | AC3 | "all" returns every record; specific courseId filters correctly; non-existent courseId returns empty; empty input is safe |

## Jira stories
- TP-20 — Attendance Report Download Feature

## Upload as a branch
```bash
git checkout -b feature/attendance-download-tests
git add tests/attendance_download/
git commit -m "test: unit tests for attendance report download"
git push origin feature/attendance-download-tests
```
