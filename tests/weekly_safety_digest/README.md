# Weekly Safety Digest — Tests

Unit tests for the weekly campus safety digest feature (Jira: TP-15).

## Folder
```
tests/weekly_safety_digest/
├── feature_files/
│   └── WeeklySafetyDigest.tsx
├── test_weekly_safety_digest.test.tsx
└── README.md
```

## Run
```bash
npx vitest run tests/weekly_safety_digest/test_weekly_safety_digest.test.tsx
```

## Coverage
| describe block | AC | What it verifies |
|---|---|---|
| AC1: Week filtering | AC1 (TP-15) | filterByWeek — incidents within range, boundary inclusion (start/end), out-of-week exclusion, empty input, single incident |
| AC2/AC3: Incident grouping and digest summary | AC2/AC3 (TP-15) | groupByType — correct counts, all-same-type, all-different; groupByLocation — correct counts; buildDigestSummary — topType, topLocation, empty input zeros, single incident |
| AC4: Export digest as CSV | AC4 (TP-15) | formatDigestCsv — week label on first line, total count, type rows, location rows, empty summary, no undefined/null, blank-line section separators |

## Upload as a branch
```bash
git checkout -b feature/weekly-safety-digest-tests
git add tests/weekly_safety_digest/
git commit -m "test: unit tests for weekly safety digest feature"
git push origin feature/weekly-safety-digest-tests
```
