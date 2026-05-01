# Chronic Absentees — Tests

Unit tests for the chronic absentee monitoring feature.

## Folder
```
tests/chronic_absentees/
├── feature_files/
│   └── ChronicAbsentees.tsx
├── test_chronic_absentees.test.tsx
└── README.md
```

## Run
```bash
npx vitest run tests/chronic_absentees/test_chronic_absentees.test.tsx
```

## Coverage

| describe block | AC | What it verifies |
|---|---|---|
| AC1: isChronicAbsentee | AC1 | Correctly identifies students below threshold; 0 total classes is not flagged; 0% attendance always flagged |
| AC2: filterChronicAbsentees | AC2 | Default 60% threshold filters correctly; threshold 0 returns no one; threshold 100 flags everyone with an absence |
| AC3: sortByAttendance | AC3 | Ascending sort (worst first); original array not mutated; ties and single elements handled |
| AC3: buildAbsenteeRows | AC3 | Course names from enrollments; absence counts correct; no-class students get 100%; duplicate enrollments deduplicated |

## Jira stories
- TP-16 — Chronic Absentee Students View

## Upload as a branch
```bash
git checkout -b feature/chronic-absentees-tests
git add tests/chronic_absentees/
git commit -m "test: unit tests for chronic absentee monitoring"
git push origin feature/chronic-absentees-tests
```
