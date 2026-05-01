# Generate Reports — Tests

Unit tests for the generate reports feature (Jira: TP-6, TP-7, TP-8, TP-9, TP-10).

## Folder
```
tests/generate_reports/
├── feature_files/
│   └── GenerateReports.tsx
├── test_generate_reports.test.tsx
└── README.md
```

## Run
```bash
npx vitest run tests/generate_reports/test_generate_reports.test.tsx
```

## Coverage
| describe block | AC | What it verifies |
|---|---|---|
| AC1: Department and date range filtering | AC1 (TP-8, TP-10) | filterByDepartment and filterByDateRange — valid dept, empty dept, nonexistent dept, exact date boundary, out-of-range dates |
| AC2: Misconduct incident type filtering | AC2 (TP-7) | filterByIncidentType — exact match, empty type returns all, nonexistent type, case-insensitivity, required fields present |
| AC3: Engagement summary computation | AC3 (TP-6) | buildEngagementSummary — avg attention score, high/low counts, empty input zeros, single record |
| AC4: Export filename formatting | AC4 (TP-9) | formatExportFilename — correct filename pattern, spaces→hyphens, uppercase→lowercase, always .csv |

## Upload as a branch
```bash
git checkout -b feature/generate-reports-tests
git add tests/generate_reports/
git commit -m "test: unit tests for generate reports feature"
git push origin feature/generate-reports-tests
```
